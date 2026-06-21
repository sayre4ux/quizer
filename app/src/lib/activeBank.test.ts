import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { installBank, __closeDbForTests } from './quizbank/idb';
import { validateBank } from './quizbank/validate';
import {
  activeBank, initActiveBank, switchBank, afterImport,
  enterEphemeral, exitEphemeral, removeBank,
} from './activeBank';
import { store } from './storage';
import { allQuestions } from './dataset';

function makeValidated(id: string, title: string) {
  const raw = {
    format: 'quizbank', formatVersion: 1, id, title,
    categories: [{ id: 1, name: 'Cat' }],
    questions: Array.from({ length: 5 }, (_, i) => ({
      id: `q${i + 1}`, category: 1, prompt: `Q${i + 1}?`,
      options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }],
      correct: ['A'],
    })),
  };
  const r = validateBank(raw, new Map());
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.value;
}

async function install(id: string, title: string): Promise<string> {
  const v = makeValidated(id, title);
  const result = await installBank(v, title);
  return result.installedId;
}

beforeEach(async () => {
  await __closeDbForTests();
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase('quizer');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

describe('initActiveBank', () => {
  it('sets status to empty when no banks are installed', async () => {
    await initActiveBank();
    expect(activeBank.snapshot().status).toBe('empty');
    expect(activeBank.snapshot().metas).toEqual([]);
  });

  it('activates the first bank when one exists', async () => {
    await install('bank_a', 'Bank A');
    await initActiveBank();
    const snap = activeBank.snapshot();
    expect(snap.status).toBe('ready');
    expect(snap.activeBankId).toContain('bank_a');
    expect(allQuestions.length).toBe(5);
  });
});

describe('switchBank', () => {
  it('switches dataset and progress to the new bank', async () => {
    const idA = await install('bank_a', 'Bank A');
    const idB = await install('bank_b', 'Bank B');
    await initActiveBank();

    // Determine which bank was activated first, then switch to the other
    const initial = activeBank.snapshot().activeBankId!;
    const other = initial === idA ? idB : idA;

    await switchBank(other);

    expect(activeBank.snapshot().activeBankId).toBe(other);
    expect(allQuestions[0].bankId).toBe(other);
    expect(allQuestions[0].qid).toContain(other);
  });

  it('no-ops when switching to the already-active bank', async () => {
    const id = await install('bank_a', 'Bank A');
    await initActiveBank();
    await switchBank(id);
    expect(activeBank.snapshot().status).toBe('ready');
    expect(activeBank.snapshot().activeBankId).toBe(id);
  });

  it('hides the active dataset while switching and honors the latest request', async () => {
    const idA = await install('bank_a', 'Bank A');
    const idB = await install('bank_b', 'Bank B');
    await initActiveBank();

    const initial = activeBank.snapshot().activeBankId!;
    const other = initial === idA ? idB : idA;
    const first = switchBank(other);
    expect(activeBank.snapshot().status).toBe('loading');
    const second = switchBank(initial);

    await Promise.all([first, second]);
    expect(activeBank.snapshot().status).toBe('ready');
    expect(activeBank.snapshot().activeBankId).toBe(initial);
    expect(allQuestions[0].bankId).toBe(initial);
  });
});

describe('afterImport', () => {
  it('activates the newly imported bank', async () => {
    await install('bank_a', 'Bank A');
    await initActiveBank();

    const idB = await install('bank_b', 'Bank B');
    await afterImport(idB);

    expect(activeBank.snapshot().activeBankId).toBe(idB);
    expect(activeBank.snapshot().metas.length).toBe(2);
  });
});

describe('removeBank', () => {
  it('removes a bank and falls back to another', async () => {
    const idA = await install('bank_a', 'Bank A');
    const idB = await install('bank_b', 'Bank B');
    await initActiveBank();

    await removeBank(idA);
    const snap = activeBank.snapshot();
    expect(snap.status).toBe('ready');
    expect(snap.metas.length).toBe(1);
    expect(snap.activeBankId).toBe(idB);
  });

  it('sets status to empty when last bank is removed', async () => {
    const id = await install('bank_a', 'Bank A');
    await initActiveBank();

    await removeBank(id);
    expect(activeBank.snapshot().status).toBe('empty');
    expect(allQuestions.length).toBe(0);
  });
});

describe('ephemeral mode', () => {
  it('loads a bank without persisting', async () => {
    await initActiveBank();
    const v = makeValidated('sample', 'Sample');
    enterEphemeral(v);

    expect(activeBank.snapshot().ephemeral).toBe(true);
    expect(activeBank.snapshot().activeBankId).toBe(null);
    expect(allQuestions.length).toBe(5);

    store.recordAttempt(allQuestions[0].qid, ['A'], true, 'drill');
    expect(store.get(allQuestions[0].qid)!.attempts.length).toBe(1);
  });

  it('exitEphemeral returns to empty state when no banks installed', async () => {
    await initActiveBank();
    expect(activeBank.snapshot().status).toBe('empty');
    const v = makeValidated('sample', 'Sample');
    enterEphemeral(v);
    await exitEphemeral();

    expect(activeBank.snapshot().ephemeral).toBe(false);
    expect(activeBank.snapshot().status).toBe('empty');
  });

  it('exitEphemeral returns to real bank when one exists', async () => {
    const id = await install('real', 'Real');
    await initActiveBank();

    const vs = makeValidated('sample', 'Sample');
    enterEphemeral(vs);
    await exitEphemeral();

    expect(activeBank.snapshot().ephemeral).toBe(false);
    expect(activeBank.snapshot().activeBankId).toBe(id);
  });
});
