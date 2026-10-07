// Shared validator fixtures, consumed by parity.test.ts (app validator vs the
// standalone skill core) so the two can't drift. Each case is (manifest, assets).

const PNG = () => Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

function questions(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `q${i + 1}`, prompt: `Q${i + 1}`,
    options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A'],
  }));
}

function base(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { format: 'quizbank', formatVersion: 1, id: 'demo', title: 'Demo', questions: questions(5), ...over };
}

const noAssets = () => new Map<string, Uint8Array>();

const AI_ANALYSIS = { model: 'Claude Opus 5.5', date: '2026-10', note: 'Advisory only.' };

// Five questions covering every AI agreement state: q1 agrees, q2 differs, q3
// agrees with doubt, q4 multi where the AI disputes the cardinality, q5 has no ai.
// exam and q1's trailing optional fields are set so the parity JSON compare sees
// the position of `aiAnalysis` and `ai` relative to their neighbours.
export function aiBank(): Record<string, unknown> {
  const ab = () => [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }];
  return base({
    exam: { count: 5, minutes: 10 },
    aiAnalysis: { ...AI_ANALYSIS },
    questions: [
      { id: 'q1', prompt: 'Q1', options: ab(), correct: ['A'], topic: 't', difficulty: 2, ai: { answer: ['A'], explanation: 'A is right.' } },
      { id: 'q2', prompt: 'Q2', options: ab(), correct: ['A'], ai: { answer: ['B'], explanation: 'B is right, not A.' } },
      { id: 'q3', prompt: 'Q3', options: ab(), correct: ['A'], ai: { answer: ['A'], explanation: 'Probably A; the stem is ambiguous.', doubt: true } },
      {
        id: 'q4', type: 'multi', prompt: 'Q4',
        options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }, { label: 'C', text: 'c' }, { label: 'D', text: 'd' }],
        correct: ['A', 'B'], ai: { answer: ['B'], explanation: 'Only B holds.' },
      },
      { id: 'q5', prompt: 'Q5', options: ab(), correct: ['A'] },
    ],
  });
}

// A default 5-question bank whose question i carries `ai` (plus `extra` fields),
// labelled by `aiAnalysis` (pass a custom value to exercise that object's rules).
function withAi(i: number, ai: unknown, extra: Record<string, unknown> = {}, aiAnalysis: unknown = AI_ANALYSIS): Record<string, unknown> {
  return base({ aiAnalysis, questions: questions(5).map((q, j) => (j === i ? { ...q, ...extra, ai } : q)) });
}

export interface Fixture {
  name: string;
  manifest: unknown;
  assets: Map<string, Uint8Array>;
}

function withImage(): Record<string, unknown>[] {
  const qs = questions(5);
  qs[0].promptImage = 'assets/d.png';
  (qs[1].options as Record<string, unknown>[])[0].image = 'assets/o.png';
  return qs;
}

export const fixtures: Fixture[] = [
  { name: 'valid minimal', manifest: base(), assets: noAssets() },
  { name: 'valid + categories + cover', manifest: base({ categories: [{ id: 1, name: 'Cat' }], cover: 'assets/c.png', exam: { count: 5, minutes: 30 }, questions: questions(5).map((q) => ({ ...q, category: 1, topic: 't', paper: 'P1' })) }), assets: new Map([['assets/c.png', PNG()]]) },
  { name: 'valid + images', manifest: base({ questions: withImage() }), assets: new Map([['assets/d.png', PNG()], ['assets/o.png', PNG()]]) },
  { name: 'valid multi (derived)', manifest: base({ questions: [...questions(4), { id: 'm', prompt: 'm', options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A', 'B'] }] }), assets: noAssets() },
  { name: 'bad id', manifest: base({ id: 'Bad Id!' }), assets: noAssets() },
  { name: 'wrong format tag', manifest: base({ format: 'nope' }), assets: noAssets() },
  { name: 'formatVersion 2', manifest: base({ formatVersion: 2 }), assets: noAssets() },
  { name: 'too few questions', manifest: base({ questions: questions(4) }), assets: noAssets() },
  { name: 'unknown top field', manifest: base({ wat: 1 }), assets: noAssets() },
  { name: 'unknown exam field', manifest: base({ exam: { count: 5, foo: 1 } }), assets: noAssets() },
  { name: 'dup correct label', manifest: base({ questions: questions(5).map((q, i) => (i === 0 ? { ...q, correct: ['A', 'A'] } : q)) }), assets: noAssets() },
  { name: 'single with 2 correct', manifest: base({ questions: questions(5).map((q, i) => (i === 0 ? { ...q, type: 'single', correct: ['A', 'B'] } : q)) }), assets: noAssets() },
  { name: 'dup question ids', manifest: base({ questions: questions(5).map((q, i) => (i === 1 ? { ...q, id: 'q1' } : q)) }), assets: noAssets() },
  { name: 'category ref but none declared', manifest: base({ questions: questions(5).map((q, i) => (i === 0 ? { ...q, category: 1 } : q)) }), assets: noAssets() },
  { name: 'missing referenced asset', manifest: base({ questions: questions(5).map((q, i) => (i === 0 ? { ...q, promptImage: 'assets/missing.png' } : q)) }), assets: noAssets() },
  { name: 'asset path traversal', manifest: base({ cover: 'assets/../x.png' }), assets: new Map([['assets/../x.png', PNG()]]) },
  { name: 'bad magic bytes', manifest: base({ cover: 'assets/fake.png' }), assets: new Map([['assets/fake.png', Uint8Array.from([1, 2, 3, 4])]]) },
  { name: 'not an object', manifest: 42, assets: noAssets() },
  { name: 'valid + ai analysis', manifest: aiBank(), assets: noAssets() },
  { name: 'ai bad label', manifest: withAi(0, { answer: ['Z'], explanation: 'e' }), assets: noAssets() },
  { name: 'ai multi on single', manifest: withAi(0, { answer: ['A', 'B'], explanation: 'e' }, { type: 'single' }), assets: noAssets() },
  { name: 'ai multi on derived single', manifest: withAi(0, { answer: ['A', 'B'], explanation: 'e' }), assets: noAssets() },
  { name: 'ai explanation too long', manifest: withAi(0, { answer: ['A'], explanation: 'x'.repeat(4001) }), assets: noAssets() },
  { name: 'ai unknown key', manifest: withAi(0, { answer: ['A'], explanation: 'e', confidence: 0.9 }), assets: noAssets() },
  { name: 'ai not an object', manifest: base({ aiAnalysis: AI_ANALYSIS, questions: questions(5).map((q, i) => (i === 0 ? { ...q, ai: 'A' } : i === 1 ? { ...q, ai: null } : q)) }), assets: noAssets() },
  { name: 'ai doubt non-boolean', manifest: withAi(0, { answer: ['A'], explanation: 'e', doubt: 'yes' }), assets: noAssets() },
  { name: 'ai without aiAnalysis', manifest: base({ questions: questions(5).map((q, i) => (i < 2 ? { ...q, ai: { answer: ['A'], explanation: 'e' } } : q)) }), assets: noAssets() },
  { name: 'aiAnalysis unknown key / missing model', manifest: withAi(0, { answer: ['A'], explanation: 'e' }, {}, { note: 'n', version: 2 }), assets: noAssets() },
];
