import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect } from 'vitest';
import { validateBank } from './validate';
import {
  installBank, deleteBank, listBankMeta, getBankRecord, getProgressRecord,
  getActiveBankId, computeInstalledId, isDisplayNameTaken, suggestDisplayName,
  __closeDbForTests,
} from './idb';

const PNG = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

function validated(id = 'demo', title = 'Demo', cover = false) {
  const assets = cover ? new Map([['assets/cover.png', PNG()]]) : new Map<string, Uint8Array>();
  const m: Record<string, unknown> = {
    format: 'quizbank', formatVersion: 1, id, title,
    questions: Array.from({ length: 5 }, (_, i) => ({
      id: `q${i + 1}`, prompt: 'p', options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A'],
    })),
  };
  if (cover) m.cover = 'assets/cover.png';
  const r = validateBank(m, assets);
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.value;
}

function rawCount(store: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('quizer');
    req.onsuccess = () => {
      const db = req.result;
      const c = db.transaction(store, 'readonly').objectStore(store).count();
      c.onsuccess = () => { resolve(c.result); db.close(); };
      c.onerror = () => reject(c.error);
    };
    req.onerror = () => reject(req.error);
  });
}

beforeEach(async () => {
  await __closeDbForTests();
  await new Promise<void>((res) => {
    const req = indexedDB.deleteDatabase('quizer');
    req.onsuccess = () => res();
    req.onerror = () => res();
    req.onblocked = () => res();
  });
});

describe('installBank', () => {
  it('writes content, meta, progress and makes the bank active', async () => {
    const { installedId } = await installBank(validated(), 'Demo');
    expect(installedId).toBe('demo');
    expect(await getActiveBankId()).toBe('demo');
    expect((await listBankMeta()).length).toBe(1);
    expect((await getBankRecord('demo'))?.manifest.questions.length).toBe(5);
    const prog = await getProgressRecord('demo');
    expect(prog?.settings.examCount).toBe(5); // min(125, total=5)
    expect(prog?.questions).toEqual({});
  });

  it('dedups a duplicate sourceId into a separate copy', async () => {
    await installBank(validated('demo', 'Demo'), 'Demo');
    const second = await installBank(validated('demo', 'Demo'), 'Demo (copy)');
    expect(second.installedId).toBe('demo--copy-1');
    expect((await listBankMeta()).length).toBe(2);
  });

  it('stores the full asset key in coverPath', async () => {
    const { meta } = await installBank(validated('demo', 'Demo', true), 'Demo');
    expect(meta.coverPath).toBe('demo/assets/cover.png');
    expect(await rawCount('assets')).toBe(1);
  });
});

describe('deleteBank', () => {
  it('removes content, meta, progress, assets and reassigns active', async () => {
    await installBank(validated('aa', 'A', true), 'A');
    await installBank(validated('bb', 'B'), 'B');
    expect(await getActiveBankId()).toBe('bb');

    await deleteBank('bb');
    expect(await getActiveBankId()).toBe('aa'); // falls back to remaining
    expect((await listBankMeta()).map((m) => m.installedId)).toEqual(['aa']);

    await deleteBank('aa');
    expect(await getActiveBankId()).toBeNull();
    expect(await rawCount('assets')).toBe(0); // a's cover asset gone too
    expect(await rawCount('banks')).toBe(0);
  });
});

describe('dedup helpers', () => {
  it('computeInstalledId suffixes copies', () => {
    expect(computeInstalledId('x', new Set())).toBe('x');
    expect(computeInstalledId('x', new Set(['x']))).toBe('x--copy-1');
    expect(computeInstalledId('x', new Set(['x', 'x--copy-1']))).toBe('x--copy-2');
  });
  it('isDisplayNameTaken is case/space-insensitive and respects exceptId', () => {
    const metas = [{ installedId: 'x', displayName: 'CISSP' } as never];
    expect(isDisplayNameTaken('  cissp ', metas)).toBe(true);
    expect(isDisplayNameTaken('cissp', metas, 'x')).toBe(false);
  });
  it('suggestDisplayName appends a counter', () => {
    const metas = [{ installedId: 'x', displayName: 'CISSP' } as never];
    expect(suggestDisplayName('CISSP', metas)).toBe('CISSP 1');
  });
});
