import { useCallback, useEffect, useMemo, useState } from 'react';
import { QuestionCard } from '../components/QuestionCard';
import { Button } from '../components/ui';
import { cx, pct } from '../components/ui-utils';
import { sameSet } from '../lib/sameSet';
import { store, useProgress } from '../state/useStore';
import type { Mode, Question } from '../types';

interface Props {
  title: string;
  questions: Question[];
  mode: Mode;
  onExit: () => void;
}

export function SessionRunner({ title, questions, mode, onExit }: Props) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const progress = useProgress();
  const q = questions[idx];
  const flagged = progress.questions[q?.qid ?? '']?.flagged ?? false;

  const toggle = useCallback(
    (label: string) => {
      setSelected((cur) => {
        if (q.type === 'multi') {
          return cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label];
        }
        return [label];
      });
    },
    [q],
  );

  const check = useCallback(() => {
    if (!selected.length || revealed) return;
    const correct = sameSet(selected, q.correct);
    store.recordAttempt(q.qid, selected, correct, mode);
    if (correct) setCorrectCount((c) => c + 1);
    setRevealed(true);
  }, [selected, revealed, q, mode]);

  const advance = useCallback(() => {
    if (idx + 1 >= questions.length) {
      setDone(true);
      void store.flush(); // persist immediately on session completion
      return;
    }
    setIdx((i) => i + 1);
    setSelected([]);
    setRevealed(false);
  }, [idx, questions.length]);

  const exit = useCallback(() => {
    void store.flush(); // persist before leaving the session
    onExit();
  }, [onExit]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || !q) return;
      const k = e.key.toLowerCase();
      const labels = q.options.map((o) => o.label.toLowerCase());
      const numIdx = Number(k) - 1;
      if (!revealed && labels.includes(k)) {
        toggle(q.options[labels.indexOf(k)].label);
      } else if (!revealed && numIdx >= 0 && numIdx < q.options.length) {
        toggle(q.options[numIdx].label);
      } else if (k === 'f') {
        store.toggleFlag(q.qid);
      } else if (e.key === 'Enter') {
        if (!revealed) check();
        else advance();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, revealed, done, toggle, check, advance]);

  const accuracy = useMemo(() => {
    const answered = done ? questions.length : idx + (revealed ? 1 : 0);
    return answered ? correctCount / answered : null;
  }, [correctCount, idx, revealed, done, questions.length]);

  if (!questions.length) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-muted">Nothing to study in this pool right now.</p>
        <Button className="mt-5" onClick={exit}>
          Back
        </Button>
      </div>
    );
  }

  if (done) {
    const answered = questions.length;
    const ratio = correctCount / answered;
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div
          className="tnum mx-auto flex h-24 w-24 items-center justify-center rounded-full text-3xl font-semibold text-fg"
          style={{ background: 'var(--surface)', boxShadow: 'var(--shadow-pop)' }}
        >
          {pct(ratio)}
        </div>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight text-fg">Session complete</h2>
        <p className="tnum mt-1.5 text-muted">
          {correctCount} of {answered} correct
        </p>
        <Button variant="primary" className="mt-7 px-6" onClick={exit}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 pb-28">
      <div className="flex items-center justify-between">
        <button className="-ml-1 text-sm font-medium text-muted transition hover:text-fg" onClick={exit}>
          ← {title}
        </button>
        <div className="tnum text-sm text-faint">{revealed || idx > 0 ? `${pct(accuracy)} acc` : ''}</div>
      </div>

      <QuestionCard
        question={q}
        selected={selected}
        onToggle={toggle}
        revealed={revealed}
        index={idx}
        total={questions.length}
      />

      <div
        className="fixed inset-x-0 bottom-0 border-t border-line backdrop-blur-xl"
        style={{ background: 'var(--glass)' }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <button
            className={cx(
              'rounded-xl border px-3 py-2.5 text-sm font-medium transition active:scale-95',
              flagged ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line text-muted hover:border-line-strong',
            )}
            onClick={() => store.toggleFlag(q.qid)}
            title="Flag (F)"
          >
            {flagged ? '★ Flagged' : '☆ Flag'}
          </button>

          {!revealed ? (
            <Button variant="primary" className="ml-auto px-7 py-2.5" onClick={check} disabled={!selected.length}>
              Check
            </Button>
          ) : (
            <Button variant="primary" className="ml-auto px-7 py-2.5" onClick={advance}>
              {idx + 1 >= questions.length ? 'Finish' : 'Next'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
