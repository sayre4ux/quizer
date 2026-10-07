import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QuestionCard } from '../components/QuestionCard';
import { SettingsButton } from '../components/SettingsDialog';
import { Button } from '../components/ui';
import { contentLang, cx, pct } from '../components/ui-utils';
import { useScriptConverter } from '../lib/chineseScript';
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
  const revealAnchorRef = useRef<HTMLButtonElement>(null);
  const explanationRef = useRef<HTMLDivElement>(null);

  const progress = useProgress();
  const { convert, lang: zhScript } = useScriptConverter();
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
      // A dialog (settings, enlarged figure) owns the keyboard while open.
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
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

  // Phones only: after Check, bring the answer feedback into view when the
  // explanation box landed low on the screen. Never scrolls up.
  useEffect(() => {
    if (!revealed || window.matchMedia('(min-width: 640px)').matches) return;
    const id = requestAnimationFrame(() => {
      const anchor = revealAnchorRef.current;
      const box = explanationRef.current;
      if (!anchor || !box || box.getBoundingClientRect().top <= window.innerHeight * 0.6) return;
      const top = window.scrollY + anchor.getBoundingClientRect().top - 12;
      if (top <= window.scrollY) return;
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [revealed]);

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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 pb-[calc(var(--action-bar-h)+1rem)] sm:gap-6">
      <div className="flex min-h-11 items-center gap-2">
        <button
          className="-ml-2 inline-flex min-h-11 min-w-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-muted transition hover:text-fg"
          onClick={exit}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="-ml-0.5 shrink-0">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span lang={contentLang(title, zhScript)} className="truncate">{convert(title)}</span>
        </button>
        <div className="tnum ml-auto flex shrink-0 items-center gap-1.5 text-xs text-faint">
          <span>
            {idx + 1} / {questions.length}
          </span>
          {(revealed || idx > 0) && <span>· {pct(accuracy)}</span>}
          <SettingsButton className="-mr-2" />
        </div>
      </div>

      <QuestionCard
        question={q}
        selected={selected}
        onToggle={toggle}
        revealed={revealed}
        meta="compact"
        revealAnchorRef={revealAnchorRef}
        explanationRef={explanationRef}
      />

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line backdrop-blur-xl"
        style={{ background: 'var(--glass)' }}
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 pt-2 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] sm:pt-3 sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))]">
          <button
            className={cx(
              'min-h-11 rounded-xl border px-3.5 text-sm font-medium transition active:scale-95',
              flagged ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line text-muted hover:border-line-strong',
            )}
            onClick={() => store.toggleFlag(q.qid)}
            aria-pressed={flagged}
            title="Flag (F)"
          >
            {flagged ? '★ Flagged' : '☆ Flag'}
          </button>

          {!revealed ? (
            <Button variant="primary" className="ml-auto min-h-11 min-w-28 px-7" onClick={check} disabled={!selected.length}>
              Check
            </Button>
          ) : (
            <Button variant="primary" className="ml-auto min-h-11 min-w-28 px-7" onClick={advance}>
              {idx + 1 >= questions.length ? 'Finish' : 'Next'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
