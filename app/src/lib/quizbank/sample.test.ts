import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateBank } from './validate';

// The bundled sample must always be a valid v1 bank (it's offered via "Load sample").
describe('bundled demo sample', () => {
  it('validates against the v1 schema', () => {
    const fp = path.resolve(process.cwd(), 'public/samples/demo.quizbank.json');
    const m = JSON.parse(readFileSync(fp, 'utf8'));
    const r = validateBank(m, new Map());
    if (!r.ok) console.error(r.errors);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.manifest.questions.length).toBeGreaterThanOrEqual(5);
      expect(r.value.manifest.categories?.length).toBe(3);
    }
  });
});
