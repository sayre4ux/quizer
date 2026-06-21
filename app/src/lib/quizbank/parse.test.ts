import { describe, it, expect } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import { parseBankFile } from './parse';

const PNG = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const manifest = { format: 'quizbank', formatVersion: 1, id: 'demo', title: 'Demo', questions: [] };

function zipFile(files: Record<string, Uint8Array>, name = 'b.zip'): File {
  return new File([zipSync(files) as BlobPart], name);
}

describe('parseBankFile', () => {
  it('parses a .zip with manifest + assets', async () => {
    const f = zipFile({
      'quizbank.json': strToU8(JSON.stringify(manifest)),
      'assets/cover.png': PNG(),
    });
    const r = await parseBankFile(f);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect((r.value.manifest as Record<string, unknown>).id).toBe('demo');
      expect(r.value.assets.has('assets/cover.png')).toBe(true);
    }
  });

  it('parses a bare .json file', async () => {
    const f = new File([JSON.stringify(manifest)], 'b.json');
    const r = await parseBankFile(f);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.assets.size).toBe(0);
  });

  it('rejects a zip without a root manifest', async () => {
    const f = zipFile({ 'assets/cover.png': PNG() });
    expect((await parseBankFile(f)).ok).toBe(false);
  });

  it('rejects a bare file that is not JSON', async () => {
    const f = new File(['not json'], 'b.json');
    expect((await parseBankFile(f)).ok).toBe(false);
  });

  it('ignores stray files outside assets/', async () => {
    const f = zipFile({
      'quizbank.json': strToU8(JSON.stringify(manifest)),
      'README.txt': strToU8('hi'),
      'assets/a.png': PNG(),
    });
    const r = await parseBankFile(f);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.assets.has('assets/a.png')).toBe(true);
      expect(r.value.assets.has('README.txt')).toBe(false);
    }
  });
});
