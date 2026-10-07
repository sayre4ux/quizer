import { describe, it, expect } from 'vitest';
import { validateBank } from './validate';
import { LIMITS } from './format';
import { aiBank } from './fixtures';

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

describe('ai analysis', () => {
  const AI_META = { model: 'Claude Opus 5.5', date: '2026-10', note: 'Advisory only.' };
  // Default bank with question 0 carrying `ai` (+ `extra`), labelled by `aiAnalysis`.
  function bankWithAi(ai: unknown, extra: Record<string, unknown> = {}, aiAnalysis: unknown = AI_META) {
    const qs = questions(5) as Record<string, unknown>[];
    Object.assign(qs[0], extra, { ai });
    return base({ aiAnalysis, questions: qs });
  }
  function errorsOf(m: unknown): string[] {
    const r = validateBank(m, noAssets());
    return r.ok ? [] : r.errors;
  }

  describe('accepts', () => {
    it('the five-state fixture and copies ai/aiAnalysis into the normalized output', () => {
      const r = validateBank(aiBank(), noAssets());
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const qs = r.value.manifest.questions;
      expect(qs[1].ai).toEqual({ answer: ['B'], explanation: 'B is right, not A.', doubt: undefined });
      expect(qs[2].ai?.doubt).toBe(true);
      expect(qs[3].ai).toEqual({ answer: ['B'], explanation: 'Only B holds.', doubt: undefined });
      expect(qs[4].ai).toBeUndefined();
      expect(r.value.manifest.aiAnalysis).toEqual(AI_META);
    });
    it('places ai last in each question and aiAnalysis just before questions (parity key order)', () => {
      const r = validateBank(aiBank(), noAssets());
      if (!r.ok) throw new Error(r.errors.join('; '));
      const keys = Object.keys(r.value.manifest);
      expect(keys.slice(-3)).toEqual(['exam', 'aiAnalysis', 'questions']);
      expect(Object.keys(r.value.manifest.questions[0]).at(-1)).toBe('ai');
      expect(Object.keys(r.value.manifest.questions[0].ai ?? {})).toEqual(['answer', 'explanation', 'doubt']);
      expect(Object.keys(r.value.manifest.aiAnalysis ?? {})).toEqual(['model', 'date', 'note']);
    });
    it('aiAnalysis with only a model; date and note normalize to undefined', () => {
      const r = validateBank(bankWithAi({ answer: ['A'], explanation: 'e' }, {}, { model: 'm' }), noAssets());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.manifest.aiAnalysis).toEqual({ model: 'm', date: undefined, note: undefined });
    });
    it('aiAnalysis present while no question has ai', () => {
      const r = validateBank(base({ aiAnalysis: AI_META }), noAssets());
      expect(r.ok).toBe(true);
    });
    it('doubt: false is kept as false', () => {
      const r = validateBank(bankWithAi({ answer: ['A'], explanation: 'e', doubt: false }), noAssets());
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.value.manifest.questions[0].ai?.doubt).toBe(false);
    });
    it('a multi question with 1 or with more AI labels than the key (cardinality dispute)', () => {
      const multi = { type: 'multi', options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }, { label: 'C', text: 'c' }], correct: ['A', 'B'] };
      expect(errorsOf(bankWithAi({ answer: ['C'], explanation: 'e' }, multi))).toEqual([]);
      expect(errorsOf(bankWithAi({ answer: ['A', 'B', 'C'], explanation: 'e' }, multi))).toEqual([]);
    });
    it('an explanation of exactly aiExplanationMax chars', () => {
      expect(LIMITS.aiExplanationMax).toBe(4000);
      expect(errorsOf(bankWithAi({ answer: ['A'], explanation: 'x'.repeat(4000) }))).toEqual([]);
    });
  });

  describe('rejects with the exact error', () => {
    it('ai that is not a plain object (string, null, array)', () => {
      for (const ai of ['A', null, [{ answer: ['A'] }]]) {
        expect(errorsOf(bankWithAi(ai))).toContain('questions[0].ai must be an object');
      }
    });
    it('an unknown key inside ai', () => {
      expect(errorsOf(bankWithAi({ answer: ['A'], explanation: 'e', confidence: 0.9 })))
        .toContain('questions[0].ai: unknown field "confidence"');
    });
    it('answer missing, not an array, or empty', () => {
      for (const ai of [{ explanation: 'e' }, { answer: 'A', explanation: 'e' }, { answer: [], explanation: 'e' }]) {
        expect(errorsOf(bankWithAi(ai))).toContain('questions[0].ai.answer must be a non-empty array of option labels');
      }
    });
    it('a non-string answer element', () => {
      expect(errorsOf(bankWithAi({ answer: [1], explanation: 'e' })))
        .toContain('questions[0].ai.answer must contain only strings');
    });
    it('an answer label that is not an option', () => {
      expect(errorsOf(bankWithAi({ answer: ['Z'], explanation: 'e' })))
        .toContain('questions[0].ai.answer references unknown label "Z"');
    });
    it('a duplicate answer label', () => {
      const multi = { correct: ['A', 'B'] };
      expect(errorsOf(bankWithAi({ answer: ['A', 'A'], explanation: 'e' }, multi)))
        .toEqual(['questions[0].ai.answer lists "A" more than once']);
    });
    it('more than one AI answer on a declared single question', () => {
      expect(errorsOf(bankWithAi({ answer: ['A', 'B'], explanation: 'e' }, { type: 'single' })))
        .toEqual(['questions[0].ai: type "single" requires exactly 1 AI answer']);
    });
    it('more than one AI answer on a derived single question', () => {
      expect(errorsOf(bankWithAi({ answer: ['A', 'B'], explanation: 'e' })))
        .toEqual(['questions[0].ai: type "single" requires exactly 1 AI answer']);
    });
    it('explanation missing, non-string, empty, or over the limit', () => {
      expect(errorsOf(bankWithAi({ answer: ['A'] }))).toEqual(['questions[0].ai.explanation is required']);
      expect(errorsOf(bankWithAi({ answer: ['A'], explanation: 42 }))).toEqual(['questions[0].ai.explanation must be a string']);
      expect(errorsOf(bankWithAi({ answer: ['A'], explanation: '' }))).toEqual(['questions[0].ai.explanation must not be empty']);
      expect(errorsOf(bankWithAi({ answer: ['A'], explanation: 'x'.repeat(4001) })))
        .toEqual(['questions[0].ai.explanation exceeds 4000 chars']);
    });
    it('a non-boolean doubt', () => {
      for (const doubt of ['yes', 1, null]) {
        expect(errorsOf(bankWithAi({ answer: ['A'], explanation: 'e', doubt }))).toEqual(['questions[0].ai.doubt must be a boolean']);
      }
    });
    it('aiAnalysis that is not a plain object', () => {
      for (const a of [['m'], 'x', null]) {
        expect(errorsOf(base({ aiAnalysis: a }))).toEqual(['manifest.aiAnalysis must be an object']);
      }
    });
    it('an unknown key inside aiAnalysis', () => {
      expect(errorsOf(base({ aiAnalysis: { model: 'm', version: 2 } }))).toEqual(['aiAnalysis: unknown field "version"']);
    });
    it('aiAnalysis.model missing, non-string, empty, or over the limit', () => {
      expect(errorsOf(base({ aiAnalysis: { note: 'n' } }))).toEqual(['aiAnalysis.model is required']);
      expect(errorsOf(base({ aiAnalysis: { model: 5 } }))).toEqual(['aiAnalysis.model must be a string']);
      expect(errorsOf(base({ aiAnalysis: { model: '' } }))).toEqual(['aiAnalysis.model must not be empty']);
      expect(errorsOf(base({ aiAnalysis: { model: 'm'.repeat(81) } }))).toEqual(['aiAnalysis.model exceeds 80 chars']);
      expect(errorsOf(base({ aiAnalysis: { model: 'm'.repeat(80) } }))).toEqual([]);
    });
    it('aiAnalysis.date or note non-string or over the limit', () => {
      expect(errorsOf(base({ aiAnalysis: { model: 'm', date: 2026 } }))).toEqual(['aiAnalysis.date must be a string']);
      expect(errorsOf(base({ aiAnalysis: { model: 'm', date: 'd'.repeat(41) } }))).toEqual(['aiAnalysis.date exceeds 40 chars']);
      expect(errorsOf(base({ aiAnalysis: { model: 'm', note: ['n'] } }))).toEqual(['aiAnalysis.note must be a string']);
      expect(errorsOf(base({ aiAnalysis: { model: 'm', note: 'n'.repeat(501) } }))).toEqual(['aiAnalysis.note exceeds 500 chars']);
      expect(errorsOf(base({ aiAnalysis: { model: 'm', date: 'd'.repeat(40), note: 'n'.repeat(500) } }))).toEqual([]);
    });
    it('ai without aiAnalysis, reported exactly once for several ai questions', () => {
      const qs = questions(5) as Record<string, unknown>[];
      qs[0].ai = { answer: ['A'], explanation: 'e' };
      qs[3].ai = { answer: ['B'], explanation: 'e' };
      expect(errorsOf(base({ questions: qs }))).toEqual(['manifest.aiAnalysis is required when any question has "ai"']);
    });
    it('an invalid ai still triggers the required check (raw presence)', () => {
      const qs = questions(5) as Record<string, unknown>[];
      qs[0].ai = null;
      expect(errorsOf(base({ questions: qs }))).toEqual([
        'questions[0].ai must be an object',
        'manifest.aiAnalysis is required when any question has "ai"',
      ]);
    });
    it('ai with an invalid aiAnalysis reports only the object error, not "required"', () => {
      const errs = errorsOf(bankWithAi({ answer: ['A'], explanation: 'e' }, {}, 'x'));
      expect(errs).toEqual(['manifest.aiAnalysis must be an object']);
    });
  });
});
