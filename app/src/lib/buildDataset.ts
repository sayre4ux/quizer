import type { ManifestQuestion, QuizBankManifest } from './quizbank/format';
import { detectBankScript } from './chineseScript';
import type { CategoryMeta, Question, QuestionAi, RuntimeDataset } from '../types';

// Derives the in-memory dataset for an installed bank from its validated manifest.
// Asset references become IDB asset keys (`${installedId}/${manifestPath}`); qids
// are namespaced by installedId so duplicate installs never collide.
export function buildDataset(installedId: string, manifest: QuizBankManifest): RuntimeDataset {
  const categories: CategoryMeta[] = (manifest.categories ?? []).map((c) => ({ id: c.id, name: c.name }));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const assetKey = (p: string | undefined): string | null => (p ? `${installedId}/${p}` : null);
  const aiPart = (q: ManifestQuestion): QuestionAi | null => {
    const ai = q.ai;
    if (!ai) return null;
    // Option order, so the UI reads "A, C" rather than the authored "C, A".
    // Display-only: agreement is computed with the order-insensitive sameSet.
    return {
      answer: q.options.map((o) => o.label).filter((l) => ai.answer.includes(l)),
      explanation: ai.explanation,
      doubt: ai.doubt === true,
    };
  };

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
    ai: aiPart(q),
  }));

  return {
    installedId,
    moduleLabel: manifest.module ?? manifest.title,
    questions,
    questionsById: new Map(questions.map((q) => [q.qid, q])),
    categories,
    papers: [...new Set(questions.map((q) => q.paper).filter((p): p is string => p !== null))],
    aiProvenance: manifest.aiAnalysis
      ? { model: manifest.aiAnalysis.model, date: manifest.aiAnalysis.date ?? null, note: manifest.aiAnalysis.note ?? null }
      : null,
    bankScript: detectBankScript(manifest.language, scriptSample(manifest)),
  };
}

// Enough text to call the script reliably without walking a huge bank. Every
// text field counts: a bank can be English except for its explanations.
const SAMPLE_QUESTIONS = 200;

function scriptSample(manifest: QuizBankManifest): string[] {
  const texts = [manifest.title, ...(manifest.categories ?? []).map((c) => c.name)];
  for (const q of manifest.questions.slice(0, SAMPLE_QUESTIONS)) {
    texts.push(q.prompt, ...q.options.map((o) => o.text), q.explanation ?? '', q.ai?.explanation ?? '');
  }
  return texts;
}
