import type { Attempt, Mode, ProgressStore, QuestionProgress, Settings, SrsState } from '../types';
import { schedule } from './srs';
import { allQuestions, questionsById } from './dataset';
import { lastCorrect, statusOf } from './stats';
import { EXAM_MAX_MINUTES, EXAM_MIN_QUESTIONS } from './constants';
import { putProgressRecord, updateBankSummary } from './quizbank/idb';
import type { BankSummary, ProgressRecord } from './quizbank/idb';

// Per-bank progress for the ACTIVE bank, held in memory and written through to
// IndexedDB (debounced). React reads the synchronous in-memory snapshot; the
// active bank is swapped in by activeBank.adopt() at boot / switch.

const MODES = new Set<Mode>(['drill', 'exam', 'review', 'srs']);
const MAX_ATTEMPTS_PER_Q = 100;
const FLUSH_DELAY = 250;

function defaultSettings(): Settings {
  const total = allQuestions.length;
  const examCount = total ? Math.min(125, total) : 125;
  return { examCount, examMinutes: Math.min(EXAM_MAX_MINUTES, Math.round(examCount * 1.4)) };
}

function emptyStore(): ProgressStore {
  return { questions: {}, settings: defaultSettings() };
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

function sanitizeAttempt(a: unknown): Attempt | null {
  if (!a || typeof a !== 'object') return null;
  const o = a as Record<string, unknown>;
  if (!isNum(o.t) || typeof o.correct !== 'boolean') return null;
  if (!Array.isArray(o.choice) || !o.choice.every((c) => typeof c === 'string')) return null;
  if (typeof o.mode !== 'string' || !MODES.has(o.mode as Mode)) return null;
  return { t: o.t, choice: o.choice as string[], correct: o.correct, mode: o.mode as Mode };
}

function sanitizeSrs(s: unknown): SrsState | null {
  if (!s || typeof s !== 'object') return null;
  const o = s as Record<string, unknown>;
  if (!isNum(o.reps) || !isNum(o.ease) || !isNum(o.intervalDays) || !isNum(o.due)) return null;
  if (o.due <= 0) return null;
  return {
    reps: Math.max(0, Math.round(o.reps)),
    ease: Math.min(5, Math.max(1.3, o.ease)),
    intervalDays: Math.min(36500, Math.max(0, Math.round(o.intervalDays))),
    due: o.due,
  };
}

// Validates progress against the ACTIVE bank's qid set (caller ensures the
// dataset is applied first). Unknown qids are dropped.
function sanitizeQuestions(raw: unknown): Record<string, QuestionProgress> {
  const out: Record<string, QuestionProgress> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [qid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!questionsById.has(qid) || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const attempts = Array.isArray(v.attempts)
      ? v.attempts.slice(-MAX_ATTEMPTS_PER_Q).map(sanitizeAttempt).filter((a): a is Attempt => a !== null)
      : [];
    out[qid] = { attempts, flagged: v.flagged === true, srs: sanitizeSrs(v.srs) };
  }
  return out;
}

function sanitizeSettings(raw: unknown): Settings {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const total = allQuestions.length || 1;
  const def = defaultSettings();
  return {
    examCount: isNum(o.examCount) ? clamp(o.examCount, EXAM_MIN_QUESTIONS, total) : def.examCount,
    examMinutes: isNum(o.examMinutes) ? clamp(o.examMinutes, 1, EXAM_MAX_MINUTES) : def.examMinutes,
  };
}

// ---- module state ----

let installedId: string | null = null;
let ephemeral = false; // sample trial: progress lives in memory only, never persisted
let state: ProgressStore = emptyStore();
let dirty = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastError: string | null = null;
const listeners = new Set<() => void>();

function notify() {
  state = { ...state };
  listeners.forEach((l) => l());
}

function computeSummary(): BankSummary {
  let seen = 0;
  let correct = 0;
  let mastered = 0;
  const total = allQuestions.length;
  for (const q of allQuestions) {
    const p = state.questions[q.qid];
    const lc = lastCorrect(p);
    if (lc !== null) { seen += 1; if (lc) correct += 1; }
    if (statusOf(p) === 'mastered') mastered += 1;
  }
  return { seen, mastered, accuracy: seen ? correct / seen : null, progressPct: total ? mastered / total : 0 };
}

async function flushNow() {
  if (ephemeral || !installedId || !dirty) return;
  const id = installedId;
  const rec: ProgressRecord = { installedId: id, questions: state.questions, settings: state.settings };
  dirty = false;
  try {
    await putProgressRecord(rec);
    await updateBankSummary(id, computeSummary());
    if (lastError !== null) { lastError = null; notify(); }
  } catch (e) {
    dirty = true; // keep trying on the next change
    lastError = e instanceof Error ? e.message : 'could not save progress';
    notify();
  }
}

function scheduleFlush() {
  dirty = true;
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; void flushNow(); }, FLUSH_DELAY);
}

function ensure(qid: string): QuestionProgress {
  if (!state.questions[qid]) state.questions[qid] = { attempts: [], flagged: false, srs: null };
  return state.questions[qid];
}

export const store = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  snapshot(): ProgressStore {
    return state;
  },
  lastError(): string | null {
    return lastError;
  },
  get(qid: string): QuestionProgress | undefined {
    return state.questions[qid];
  },

  // Swap in a bank's progress (already-applied dataset is the validation source).
  adopt(id: string, record: { questions?: unknown; settings?: unknown } | null) {
    installedId = id;
    ephemeral = false;
    state = {
      questions: sanitizeQuestions(record?.questions),
      settings: sanitizeSettings(record?.settings),
    };
    dirty = false;
    lastError = null;
    notify();
  },

  // In-memory-only progress for the sample trial — answers work but never persist.
  adoptEphemeral() {
    installedId = null;
    ephemeral = true;
    state = emptyStore();
    dirty = false;
    lastError = null;
    notify();
  },

  detach() {
    installedId = null;
    ephemeral = false;
    state = emptyStore();
    notify();
  },

  recordAttempt(qid: string, choice: string[], correct: boolean, mode: Mode) {
    if (!installedId && !ephemeral) return;
    const p = ensure(qid);
    const now = Date.now();
    const next = [...p.attempts, { t: now, choice, correct, mode }];
    p.attempts = next.length > MAX_ATTEMPTS_PER_Q ? next.slice(-MAX_ATTEMPTS_PER_Q) : next;
    if (choice.length > 0) p.srs = schedule(p.srs, correct ? 5 : 2, now);
    state.questions = { ...state.questions, [qid]: { ...p } };
    scheduleFlush();
    notify();
  },

  toggleFlag(qid: string) {
    if (!installedId && !ephemeral) return;
    const p = ensure(qid);
    p.flagged = !p.flagged;
    state.questions = { ...state.questions, [qid]: { ...p } };
    scheduleFlush();
    notify();
  },

  setSettings(patch: Partial<Settings>) {
    if (!installedId && !ephemeral) return;
    state.settings = { ...state.settings, ...patch };
    scheduleFlush();
    notify();
  },

  resetAll() {
    if (!installedId && !ephemeral) return;
    state = { questions: {}, settings: state.settings };
    scheduleFlush();
    notify();
  },

  async flush() {
    if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
    await flushNow();
  },

  exportJSON(): string {
    return JSON.stringify({ questions: state.questions, settings: state.settings }, null, 2);
  },

  importJSON(text: string): boolean {
    if (!installedId) return false;
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return false;
      }
      const questions = (parsed as Record<string, unknown>).questions;
      if (!questions || typeof questions !== 'object' || Array.isArray(questions)) {
        return false;
      }
      state = {
        questions: sanitizeQuestions(questions),
        settings: sanitizeSettings((parsed as Record<string, unknown>).settings),
      };
      scheduleFlush();
      notify();
      return true;
    } catch {
      return false;
    }
  },
};

// Best-effort flush on page hide / tab switch (Codex flush contract).
if (typeof window !== 'undefined') {
  const onHide = () => { void store.flush(); };
  window.addEventListener('pagehide', onHide);
  window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') onHide(); });
}
