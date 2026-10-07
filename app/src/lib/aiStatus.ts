import type { Question } from '../types';
import { sameSet } from './sameSet';

// How a question's advisory AI answer relates to the source key. Computed at
// runtime from the answers themselves; no stored agreement flag is trusted.
export type AiStatus = 'none' | 'agrees' | 'doubts' | 'differs';

export function aiStatus(q: Pick<Question, 'ai' | 'correct'>): AiStatus {
  if (q.ai === null) return 'none';
  if (!sameSet(q.ai.answer, q.correct)) return 'differs';
  return q.ai.doubt ? 'doubts' : 'agrees';
}

// Whether the AI section starts expanded on a revealed question. A dispute
// (differs) or a doubt always opens it; plain agreement opens only when the
// user's "Always show AI analysis" preference is on.
export function aiDefaultOpen(status: Exclude<AiStatus, 'none'>, alwaysExpanded: boolean): boolean {
  return alwaysExpanded || status !== 'agrees';
}
