import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseBankFile } from './parse';
import { validateBank } from './validate';

// End-to-end: the skill packager output must import cleanly through the APP's own
// parse + validate (text-only -> .json, image -> .zip).
const PACK = path.resolve(process.cwd(), '..', 'quizbank-author', 'scripts', 'pack-quizbank.mjs');
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function questions(n: number, withImg = false) {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`, prompt: `Q${i + 1}`,
    options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A'],
    ...(withImg && i === 0 ? { promptImage: 'assets/d.png' } : {}),
  }));
}

async function importFile(file: File) {
  const parsed = await parseBankFile(file);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error('parse failed');
  return validateBank(parsed.value.manifest, parsed.value.assets);
}

describe('skill packager round-trips through the app importer', () => {
  it('text-only -> .json imports valid', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qb-'));
    const manifest = { format: 'quizbank', formatVersion: 1, id: 'rt_text', title: 'RT Text', questions: questions(5) };
    writeFileSync(path.join(dir, 'quizbank.json'), JSON.stringify(manifest));
    const out = path.join(dir, 'out.quizbank.json');
    execFileSync('node', [PACK, path.join(dir, 'quizbank.json'), '--no-report', '--out', out]);

    const file = new File([readFileSync(out) as unknown as BlobPart], 'rt_text.quizbank.json');
    const r = await importFile(file);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.manifest.questions.length).toBe(5);
  });

  it('with image -> .zip imports valid and carries the asset', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qb-'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'assets', 'd.png'), PNG);
    const manifest = { format: 'quizbank', formatVersion: 1, id: 'rt_img', title: 'RT Img', questions: questions(5, true) };
    writeFileSync(path.join(dir, 'quizbank.json'), JSON.stringify(manifest));
    const out = path.join(dir, 'out.quizbank.zip');
    execFileSync('node', [PACK, path.join(dir, 'quizbank.json'), '--no-report', '--out', out]);

    const file = new File([readFileSync(out) as unknown as BlobPart], 'rt_img.quizbank.zip');
    const r = await importFile(file);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.referencedAssets.has('assets/d.png')).toBe(true);
      expect(r.value.manifest.questions[0].promptImage).toBe('assets/d.png');
    }
  });

  it('refuses to package without a ledger unless --no-report is given (Codex P2)', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qb-'));
    const manifest = { format: 'quizbank', formatVersion: 1, id: 'rt_noledger', title: 'RT', questions: questions(5) };
    writeFileSync(path.join(dir, 'quizbank.json'), JSON.stringify(manifest));
    const out = path.join(dir, 'out.quizbank.json');
    expect(() => execFileSync('node', [PACK, path.join(dir, 'quizbank.json'), '--out', out], { stdio: 'pipe' })).toThrow();
  });

  it('refuses assets that are symbolic links outside the assets directory', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qb-'));
    const outside = path.join(dir, 'outside.png');
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(outside, PNG);
    symlinkSync(outside, path.join(dir, 'assets', 'leak.png'));
    const manifest = {
      format: 'quizbank', formatVersion: 1, id: 'rt_symlink', title: 'RT Symlink',
      questions: questions(5).map((q, i) => i === 0 ? { ...q, promptImage: 'assets/leak.png' } : q),
    };
    writeFileSync(path.join(dir, 'quizbank.json'), JSON.stringify(manifest));
    const out = path.join(dir, 'out.quizbank.zip');

    expect(() => execFileSync(
      'node',
      [PACK, path.join(dir, 'quizbank.json'), '--no-report', '--out', out],
      { stdio: 'pipe' },
    )).toThrow();
  });
});
