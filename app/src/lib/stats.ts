import type { ProgressStore, Question, QuestionProgress } from '../types';
import { allQuestions } from './dataset';

export const UNASSIGNED = '__unassigned';
export const UNCATEGORIZED = '__uncat';

export function lastAttempt(p?: QuestionProgress) {
  return p && p.attempts.length ? p.attempts[p.attempts.length - 1] : null;
}

export function isSeen(p?: QuestionProgress): boolean {
  return !!p && p.attempts.length > 0;
}

export function lastCorrect(p?: QuestionProgress): boolean | null {
  const a = lastAttempt(p);
  return a ? a.correct : null;
}

export function everWrong(p?: QuestionProgress): boolean {
  return !!p && p.attempts.some((a) => !a.correct);
}

export interface GroupStat {
  key: string;
  label: string;
  total: number;
  seen: number;
  correct: number; // last attempt correct
  wrong: number; // last attempt wrong
  accuracy: number | null; // correct / seen
}

function blank(key: string, label: string): GroupStat {
  return { key, label, total: 0, seen: 0, correct: 0, wrong: 0, accuracy: null };
}

function finalize(g: GroupStat): GroupStat {
  g.accuracy = g.seen ? g.correct / g.seen : null;
  return g;
}

function aggregate(
  store: ProgressStore,
  keyOf: (q: Question) => string,
  labelOf: (q: Question) => string,
): GroupStat[] {
  const groups = new Map<string, GroupStat>();
  for (const q of allQuestions) {
    const key = keyOf(q);
    if (!groups.has(key)) groups.set(key, blank(key, labelOf(q)));
    const g = groups.get(key)!;
    g.total += 1;
    const lc = lastCorrect(store.questions[q.qid]);
    if (lc !== null) {
      g.seen += 1;
      if (lc) g.correct += 1;
      else g.wrong += 1;
    }
  }
  return [...groups.values()].map(finalize);
}

export function byCategory(store: ProgressStore): GroupStat[] {
  return aggregate(
    store,
    (q) => (q.category == null ? UNCATEGORIZED : String(q.category)),
    (q) => (q.category == null ? 'Uncategorized' : q.categoryName ?? `Category ${q.category}`),
  ).sort((a, b) => {
    if (a.key === UNCATEGORIZED) return 1;
    if (b.key === UNCATEGORIZED) return -1;
    return Number(a.key) - Number(b.key);
  });
}

export function byTopic(store: ProgressStore): GroupStat[] {
  return aggregate(
    store,
    (q) => q.topic ?? UNASSIGNED,
    (q) => q.topic ?? 'Unassigned',
  );
}

export function byPaper(store: ProgressStore): GroupStat[] {
  return aggregate(
    store,
    (q) => q.paper ?? UNASSIGNED,
    (q) => q.paper ?? 'Unassigned',
  );
}

export interface Overall {
  total: number;
  seen: number;
  correct: number;
  wrong: number;
  flagged: number;
  due: number;
  accuracy: number | null;
}

export function overall(store: ProgressStore, now: number = Date.now()): Overall {
  let seen = 0;
  let correct = 0;
  let wrong = 0;
  let flagged = 0;
  let due = 0;
  for (const q of allQuestions) {
    const p = store.questions[q.qid];
    if (!p) continue;
    if (p.flagged) flagged += 1;
    if (p.srs && p.srs.due <= now) due += 1;
    const lc = lastCorrect(p);
    if (lc !== null) {
      seen += 1;
      if (lc) correct += 1;
      else wrong += 1;
    }
  }
  return {
    total: allQuestions.length,
    seen,
    correct,
    wrong,
    flagged,
    due,
    accuracy: seen ? correct / seen : null,
  };
}

// Minimum questions in a topic for it to count as a meaningful weak area.
const MIN_TOPIC_SIZE = 3;

// ---- Learning depth (coverage-aware mastery) ----
// A question is "mastered" once its spaced-repetition interval has matured.
export const MASTERED_INTERVAL_DAYS = 21;

export type LearnStatus = 'new' | 'learning' | 'mastered';

export function statusOf(p?: QuestionProgress): LearnStatus {
  if (!p || p.attempts.length === 0) return 'new';
  if (p.srs && p.srs.intervalDays >= MASTERED_INTERVAL_DAYS) return 'mastered';
  return 'learning';
}

export interface MasteryMix {
  new: number;
  learning: number;
  mastered: number;
  total: number;
}

export function learningMix(store: ProgressStore): MasteryMix {
  const mix: MasteryMix = { new: 0, learning: 0, mastered: 0, total: allQuestions.length };
  for (const q of allQuestions) mix[statusOf(store.questions[q.qid])] += 1;
  return mix;
}

export interface CategoryMastery {
  id: number;
  name: string;
  total: number;
  mastered: number;
  pct: number;
}

// Mastery per declared category (uncategorized questions excluded — the radar is
// about the bank's own taxonomy).
export function categoryMastery(store: ProgressStore): CategoryMastery[] {
  const map = new Map<number, { name: string; total: number; mastered: number }>();
  for (const q of allQuestions) {
    if (q.category == null) continue;
    if (!map.has(q.category)) map.set(q.category, { name: q.categoryName ?? `Category ${q.category}`, total: 0, mastered: 0 });
    const d = map.get(q.category)!;
    d.total += 1;
    if (statusOf(store.questions[q.qid]) === 'mastered') d.mastered += 1;
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, d]) => ({ id, name: d.name, total: d.total, mastered: d.mastered, pct: d.total ? d.mastered / d.total : 0 }));
}

export function readiness(store: ProgressStore): { pct: number; label: string } {
  const m = learningMix(store);
  const pct = m.total ? m.mastered / m.total : 0;
  const label = pct >= 0.85 ? 'Exam-ready' : pct >= 0.6 ? 'Strong' : pct >= 0.3 ? 'On track' : 'Building';
  return { pct, label };
}

// Topics ranked by weakness (most wrong first), among attempted topics only.
export function mostFailedTopics(store: ProgressStore, limit = 12): GroupStat[] {
  return byTopic(store)
    .filter((g) => g.total >= MIN_TOPIC_SIZE && g.seen > 0 && g.wrong > 0)
    .sort((a, b) => b.wrong - a.wrong || (a.accuracy ?? 1) - (b.accuracy ?? 1))
    .slice(0, limit);
}
