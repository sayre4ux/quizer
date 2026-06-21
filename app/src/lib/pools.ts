import type { ProgressStore, Question } from '../types';
import { allQuestions } from './dataset';
import { everWrong, isSeen, lastCorrect } from './stats';

export type PoolFilter =
  | { kind: 'all' }
  | { kind: 'paper'; value: string }
  | { kind: 'category'; value: number | null } // null = uncategorized
  | { kind: 'topic'; value: string }
  | { kind: 'unseen' }
  | { kind: 'wrong' } // most recent attempt was wrong
  | { kind: 'everWrong' } // missed at least once ever
  | { kind: 'flagged' }
  | { kind: 'due' }; // SRS due now

export interface PoolOptions {
  filter: PoolFilter;
  and?: PoolFilter; // optional second predicate, AND-combined
  shuffle?: boolean;
  limit?: number;
  seed?: number;
}

function matches(q: Question, store: ProgressStore, filter: PoolFilter, now: number): boolean {
  const p = store.questions[q.qid];
  switch (filter.kind) {
    case 'all':
      return true;
    case 'paper':
      return q.paper === filter.value;
    case 'category':
      return q.category === filter.value;
    case 'topic':
      return q.topic === filter.value;
    case 'unseen':
      return !isSeen(p);
    case 'wrong':
      return lastCorrect(p) === false;
    case 'everWrong':
      return everWrong(p);
    case 'flagged':
      return !!p?.flagged;
    case 'due':
      return !!p?.srs && p.srs.due <= now;
  }
}

// Deterministic shuffle so a session order is stable across re-renders.
function shuffled<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildPool(store: ProgressStore, opts: PoolOptions): Question[] {
  const now = Date.now();
  let pool = allQuestions.filter(
    (q) =>
      matches(q, store, opts.filter, now) &&
      (!opts.and || matches(q, store, opts.and, now)),
  );
  if (opts.shuffle) pool = shuffled(pool, opts.seed ?? 1);
  if (opts.limit && opts.limit < pool.length) pool = pool.slice(0, opts.limit);
  return pool;
}

export function poolCount(store: ProgressStore, filter: PoolFilter): number {
  const now = Date.now();
  return allQuestions.reduce((n, q) => n + (matches(q, store, filter, now) ? 1 : 0), 0);
}
