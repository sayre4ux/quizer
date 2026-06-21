import { describe, it, expect } from 'vitest';
import { validateBank } from './validate';
import { LIMITS } from './format';

const PNG = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = () => Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0]);
const WEBP = () => Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);

function questions(n = 5): unknown[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`, prompt: `Q${i + 1}`,
    options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A'],
  }));
}
function base(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { format: 'quizbank', formatVersion: 1, id: 'demo', title: 'Demo', questions: questions(), ...over };
}
const noAssets = () => new Map<string, Uint8Array>();
const ok = (r: ReturnType<typeof validateBank>) => r.ok === true;

describe('validateBank — happy path', () => {
  it('accepts a minimal valid bank', () => {
    const r = validateBank(base(), noAssets());
    expect(ok(r)).toBe(true);
  });

  it('derives type from correct cardinality', () => {
    const r = validateBank(base({
      questions: [
        ...questions(4),
        { id: 'm1', prompt: 'multi', options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A', 'B'] },
      ],
    }), noAssets());
    expect(ok(r)).toBe(true);
    if (r.ok) expect(r.value.manifest.questions.find((q) => q.id === 'm1')?.type).toBe('multi');
  });

  it('accepts JPEG and WebP question images by magic bytes', () => {
    const assets = new Map([['assets/a.jpg', JPEG()], ['assets/b.webp', WEBP()]]);
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].promptImage = 'assets/a.jpg';
    (qs[1].options as Record<string, unknown>[])[0].image = 'assets/b.webp';
    expect(ok(validateBank(base({ questions: qs }), assets))).toBe(true);
  });
});

describe('validateBank — structural rejects', () => {
  it('rejects bad id', () => {
    expect(ok(validateBank(base({ id: 'Bad Id!' }), noAssets()))).toBe(false);
  });
  it('rejects wrong format tag', () => {
    expect(ok(validateBank(base({ format: 'nope' }), noAssets()))).toBe(false);
  });
  it('rejects newer formatVersion', () => {
    const r = validateBank(base({ formatVersion: 2 }), noAssets());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/version/i);
  });
  it('rejects fewer than 5 questions', () => {
    expect(ok(validateBank(base({ questions: questions(4) }), noAssets()))).toBe(false);
  });
  it('rejects unknown top-level field', () => {
    expect(ok(validateBank(base({ wat: 1 }), noAssets()))).toBe(false);
  });
  it('rejects unknown field inside option', () => {
    const qs = questions(5) as Record<string, unknown>[];
    (qs[0].options as Record<string, unknown>[])[0].color = 'red';
    expect(ok(validateBank(base({ questions: qs }), noAssets()))).toBe(false);
  });
  it('rejects unknown field inside exam', () => {
    expect(ok(validateBank(base({ exam: { count: 5, foo: 1 } }), noAssets()))).toBe(false);
  });
  it('rejects unknown field inside category', () => {
    expect(ok(validateBank(base({ categories: [{ id: 1, name: 'C', extra: 1 }] }), noAssets()))).toBe(false);
  });
});

describe('validateBank — question integrity', () => {
  it('rejects a correct label not in options', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].correct = ['Z'];
    expect(ok(validateBank(base({ questions: qs }), noAssets()))).toBe(false);
  });
  it('rejects duplicate labels within correct', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].correct = ['A', 'A'];
    const r = validateBank(base({ questions: qs }), noAssets());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/more than once/i);
  });
  it('rejects single type with 2 correct', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].type = 'single';
    qs[0].correct = ['A', 'B'];
    expect(ok(validateBank(base({ questions: qs }), noAssets()))).toBe(false);
  });
  it('rejects duplicate question ids', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[1].id = 'q1';
    const r = validateBank(base({ questions: qs }), noAssets());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/duplicate question ids/i);
  });
  it('rejects duplicate option labels within a question', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].options = [{ label: 'A', text: 'a' }, { label: 'A', text: 'b' }];
    expect(ok(validateBank(base({ questions: qs }), noAssets()))).toBe(false);
  });
  it('rejects over-length option text', () => {
    const qs = questions(5) as Record<string, unknown>[];
    (qs[0].options as Record<string, unknown>[])[0].text = 'x'.repeat(LIMITS.optionTextMax + 1);
    expect(ok(validateBank(base({ questions: qs }), noAssets()))).toBe(false);
  });
  it('rejects category ref with no declared categories', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].category = 1;
    expect(ok(validateBank(base({ questions: qs }), noAssets()))).toBe(false);
  });
  it('rejects category ref not in declared set', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].category = 9;
    expect(ok(validateBank(base({ categories: [{ id: 1, name: 'C' }], questions: qs }), noAssets()))).toBe(false);
  });
  it('rejects difficulty out of range', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].difficulty = 6;
    expect(ok(validateBank(base({ questions: qs }), noAssets()))).toBe(false);
  });
});

describe('validateBank — assets', () => {
  it('rejects missing referenced asset', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].promptImage = 'assets/missing.png';
    expect(ok(validateBank(base({ questions: qs }), noAssets()))).toBe(false);
  });
  it('rejects path traversal', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].promptImage = 'assets/../secret.png';
    expect(ok(validateBank(base({ questions: qs }), new Map([['assets/../secret.png', PNG()]])))).toBe(false);
  });
  it('rejects a non-image (bad magic bytes) declared as image', () => {
    const qs = questions(5) as Record<string, unknown>[];
    qs[0].promptImage = 'assets/fake.png';
    const assets = new Map([['assets/fake.png', Uint8Array.from([1, 2, 3, 4])]]);
    expect(ok(validateBank(base({ questions: qs }), assets))).toBe(false);
  });
});

describe('validateBank — cover', () => {
  it('accepts a valid cover and records its manifest path', () => {
    const r = validateBank(base({ cover: 'assets/cover.png' }), new Map([['assets/cover.png', PNG()]]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.coverManifestPath).toBe('assets/cover.png');
  });
  it('coverManifestPath is null when absent', () => {
    const r = validateBank(base(), noAssets());
    if (r.ok) expect(r.value.coverManifestPath).toBeNull();
  });
  it('rejects missing cover asset', () => {
    expect(ok(validateBank(base({ cover: 'assets/cover.png' }), noAssets()))).toBe(false);
  });
  it('rejects traversal cover path', () => {
    expect(ok(validateBank(base({ cover: 'assets/../x.png' }), new Map([['assets/../x.png', PNG()]])))).toBe(false);
  });
  it('rejects oversized cover', () => {
    const big = new Uint8Array(LIMITS.imageBytes + 1);
    big.set(PNG());
    expect(ok(validateBank(base({ cover: 'assets/big.png' }), new Map([['assets/big.png', big]])))).toBe(false);
  });
});
