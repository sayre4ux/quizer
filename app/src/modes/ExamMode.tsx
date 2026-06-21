import { useEffect, useMemo, useRef, useState } from 'react';
import { QuestionCard } from '../components/QuestionCard';
import { AccuracyBar, Button, Card, DialogOverlay } from '../components/ui';
import { cx, pct } from '../components/ui-utils';
import { buildPool } from '../lib/pools';
import { allQuestions } from '../lib/dataset';
import { EXAM_MIN_QUESTIONS } from '../lib/constants';
import { sameSet } from '../lib/sameSet';
import { store, useProgress } from '../state/useStore';
import type { Question } from '../types';

interface Props {
  onExit: () => void;
}

type Phase = 'config' | 'running' | 'result';

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function ExamMode({ onExit }: Props) {
  const progress = useProgress();
  const [phase, setPhase] = useState<Phase>('config');
  const [count, setCount] = useState(progress.settings.examCount);
  const [minutes, setMinutes] = useState(progress.settings.examMinutes);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [idx, setIdx] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(0);
  const [reviewWrongOnly, setReviewWrongOnly] = useState(true);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const submittedRef = useRef(false);

  function start() {
    const startNow = Date.now();
    const seed = startNow % 2147483647;
    const safeCount = Math.max(EXAM_MIN_QUESTIONS, count);
    const pool = buildPool(store.snapshot(), { filter: { kind: 'all' }, shuffle: true, seed, limit: safeCount });
    setCount(safeCount);
    setQuestions(pool);
    setAnswers({});
    setIdx(0);
    submittedRef.current = false;
    setNow(startNow);
    setDeadline(startNow + minutes * 60000);
    store.setSettings({ examCount: safeCount, examMinutes: minutes });
    setPhase('running');
  }

  function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    for (const q of questions) {
      const sel = answers[q.qid] ?? [];
      store.recordAttempt(q.qid, sel, sel.length > 0 && sameSet(sel, q.correct), 'exam');
    }
    void store.flush(); // persist the whole exam immediately on submit
    setPhase('result');
  }

  useEffect(() => {
    if (phase !== 'running') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (phase === 'running' && now >= deadline) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase, deadline]);

  const results = useMemo(() => {
    if (phase !== 'result') return null;
    let correct = 0;
    const byCat = new Map<string, { name: string; total: number; correct: number }>();
    for (const q of questions) {
      const sel = answers[q.qid] ?? [];
      const ok = sel.length > 0 && sameSet(sel, q.correct);
      if (ok) correct += 1;
      const key = q.category == null ? '__uncat' : String(q.category);
      const name = q.category == null ? 'Uncategorized' : q.categoryName ?? `Category ${q.category}`;
      if (!byCat.has(key)) byCat.set(key, { name, total: 0, correct: 0 });
      const d = byCat.get(key)!;
      d.total += 1;
      if (ok) d.correct += 1;
    }
    const categories = [...byCat.entries()].sort((a, b) => {
      if (a[0] === '__uncat') return 1;
      if (b[0] === '__uncat') return -1;
      return Number(a[0]) - Number(b[0]);
    });
    return {
      correct,
      total: questions.length,
      ratio: questions.length ? correct / questions.length : 0,
      categories,
      hasCategories: categories.some(([k]) => k !== '__uncat'),
    };
  }, [phase, questions, answers]);

  // ---- CONFIG ----
  if (phase === 'config') {
    const inputClass =
      'mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-fg tnum transition focus:border-line-strong';
    return (
      <div className="mx-auto max-w-md py-8">
        <button className="-ml-1 mb-7 text-sm font-medium text-muted transition hover:text-fg" onClick={onExit}>
          ← Back
        </button>
        <h2 className="text-2xl font-semibold tracking-tight text-fg">Exam simulation</h2>
        <p className="mt-1.5 text-sm text-muted">
          Random questions from across the bank. No feedback until you submit.
        </p>
        <label className="mt-7 block text-sm font-medium text-muted">
          Questions
          <input
            type="number"
            min={EXAM_MIN_QUESTIONS}
            max={allQuestions.length}
            value={count}
            onChange={(e) => setCount(Math.max(EXAM_MIN_QUESTIONS, Number(e.target.value)))}
            className={inputClass}
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-muted">
          Time limit (minutes)
          <input
            type="number"
            min={1}
            value={minutes}
            onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
            className={inputClass}
          />
        </label>
        <Button variant="primary" className="mt-7 w-full py-3" onClick={start}>
          Start exam
        </Button>
      </div>
    );
  }

  // ---- RESULT ----
  if (phase === 'result' && results) {
    const passed = results.ratio >= 0.7;
    const reviewList = reviewWrongOnly
      ? questions.filter((q) => !sameSet(answers[q.qid] ?? [], q.correct))
      : questions;
    return (
      <div className="mx-auto max-w-2xl py-6">
        <div className="flex flex-col items-center py-4 text-center">
          <div
            className="tnum flex h-28 w-28 items-center justify-center rounded-full text-4xl font-semibold"
            style={{
              color: passed ? 'var(--good)' : 'var(--bad)',
              background: 'var(--surface)',
              boxShadow: 'var(--shadow-pop)',
            }}
          >
            {pct(results.ratio)}
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight text-fg">
            {passed ? 'Pass' : 'Below passing'}
          </h2>
          <p className="tnum mt-1 text-muted">
            {results.correct} of {results.total} correct · 70% to pass
          </p>
        </div>

        {results.hasCategories && (
          <>
            <h3 className="mt-6 mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-faint">By category</h3>
            <Card className="flex flex-col gap-3.5 p-4">
              {results.categories.map(([key, d]) => (
                <div key={key} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-fg">{d.name}</span>
                  <div className="flex-1">
                    <AccuracyBar value={d.correct / d.total} />
                  </div>
                  <div className="tnum w-14 text-right text-xs text-faint">
                    {d.correct}/{d.total}
                  </div>
                </div>
              ))}
            </Card>
          </>
        )}

        <div className="mt-8 mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-faint">Review</h3>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={reviewWrongOnly} onChange={(e) => setReviewWrongOnly(e.target.checked)} />
            Wrong only
          </label>
        </div>
        <div className="flex flex-col gap-4">
          {reviewList.map((q) => (
            <Card key={q.qid} className="p-4 sm:p-5">
              <QuestionCard question={q} selected={answers[q.qid] ?? []} onToggle={() => {}} revealed />
            </Card>
          ))}
        </div>

        <Button className="mt-8 w-full py-3" onClick={onExit}>
          Back to home
        </Button>
      </div>
    );
  }

  // ---- RUNNING ----
  const q = questions[idx];
  const sel = answers[q.qid] ?? [];
  const answeredCount = questions.filter((qq) => (answers[qq.qid]?.length ?? 0) > 0).length;
  function toggle(label: string) {
    setAnswers((cur) => {
      const prev = cur[q.qid] ?? [];
      const next = q.type === 'multi'
        ? prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
        : [label];
      return { ...cur, [q.qid]: next };
    });
  }

  const lowTime = deadline - now < 300000;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 pb-28">
      <div className="flex items-center justify-between">
        <span className="tnum text-sm text-muted">
          Answered {answeredCount}/{questions.length}
        </span>
        <span
          className={cx('tnum rounded-lg px-2.5 py-1 font-mono text-lg font-medium', lowTime && 'bg-bad/10')}
          style={{ color: lowTime ? 'var(--bad)' : 'var(--fg)' }}
        >
          {fmtTime(deadline - now)}
        </span>
      </div>

      <QuestionCard question={q} selected={sel} onToggle={toggle} revealed={false} index={idx} total={questions.length} />

      <div className="flex flex-wrap gap-1.5">
        {questions.map((qq, i) => {
          const ans = (answers[qq.qid]?.length ?? 0) > 0;
          return (
            <button
              key={qq.qid}
              onClick={() => setIdx(i)}
              className={cx(
                'tnum h-7 w-7 rounded-lg text-xs font-medium transition',
                i === idx
                  ? 'bg-primary text-onprimary'
                  : ans
                    ? 'bg-surface-2 text-fg'
                    : 'border border-line text-faint hover:border-line-strong',
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 border-t border-line backdrop-blur-xl"
        style={{ background: 'var(--glass)' }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <Button variant="danger" onClick={() => setConfirmEnd(true)}>
            End
          </Button>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0}>
              Prev
            </Button>
            {idx + 1 < questions.length ? (
              <Button variant="primary" className="px-7" onClick={() => setIdx((i) => i + 1)}>
                Next
              </Button>
            ) : (
              <button
                className="rounded-xl bg-good px-7 py-2.5 text-sm font-medium text-white shadow-soft transition hover:opacity-90 active:scale-[0.975]"
                onClick={submit}
              >
                Submit
              </button>
            )}
          </div>
        </div>
      </div>

      {confirmEnd && (
        <DialogOverlay onClose={() => setConfirmEnd(false)} label="End exam" panelClass="max-w-xs">
          <h3 className="text-base font-semibold tracking-tight text-fg">End this exam?</h3>
          <p className="mt-1.5 text-sm text-muted">
            This attempt will be discarded and won't count toward your stats.
          </p>
          <div className="mt-5 flex gap-2">
            <Button className="flex-1" onClick={() => setConfirmEnd(false)}>
              Cancel
            </Button>
            <Button variant="danger" className="flex-1" onClick={onExit}>
              Discard
            </Button>
          </div>
        </DialogOverlay>
      )}
    </div>
  );
}
