import type { QuizBankManifest } from './quizbank/format';
import type { CategoryMeta, Question, RuntimeDataset } from '../types';

// Derives the in-memory dataset for an installed bank from its validated manifest.
// Asset references become IDB asset keys (`${installedId}/${manifestPath}`); qids
// are namespaced by installedId so duplicate installs never collide.
export function buildDataset(installedId: string, manifest: QuizBankManifest): RuntimeDataset {
  const categories: CategoryMeta[] = (manifest.categories ?? []).map((c) => ({ id: c.id, name: c.name }));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const assetKey = (p: string | undefined): string | null => (p ? `${installedId}/${p}` : null);

  const questions: Question[] = manifest.questions.map((q, i) => ({
    qid: `${installedId}:${q.id}`,
    bankId: installedId,
    localId: q.id,
    number: i + 1,
    type: q.type ?? (q.correct.length > 1 ? 'multi' : 'single'),
    prompt: q.prompt,
    promptImage: assetKey(q.promptImage),
    options: q.options.map((o) => ({ label: o.label, text: o.text, image: assetKey(o.image) })),
    correct: q.correct,
    explanation: q.explanation ?? null,
    category: q.category ?? null,
    categoryName: q.category != null ? catName.get(q.category) ?? null : null,
    paper: q.paper ?? null,
    topic: q.topic ?? null,
    difficulty: q.difficulty ?? null,
  }));

  return {
    installedId,
    moduleLabel: manifest.module ?? manifest.title,
    questions,
    questionsById: new Map(questions.map((q) => [q.qid, q])),
    categories,
    papers: [...new Set(questions.map((q) => q.paper).filter((p): p is string => p !== null))],
  };
}
