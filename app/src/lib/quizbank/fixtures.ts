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
];
