import { useId, useState } from 'react';
import type { AiProvenance, QuestionAi } from '../types';
import { aiDefaultOpen, type AiStatus } from '../lib/aiStatus';
import { usePrefs } from '../lib/prefs';
import { cx, stopEnterSpace, type ContentLang } from './ui-utils';

type Status = Exclude<AiStatus, 'none'>;

const STATUS: Record<Status, { label: string; sr: string; dot: string }> = {
  agrees: { label: 'Agrees', sr: ' with the source answer', dot: 'bg-good' },
  doubts: { label: 'Has doubts', sr: ' about this question; agrees with the source answer', dot: 'bg-warn' },
  differs: { label: 'Differs', sr: ' from the source answer', dot: 'bg-warn' },
};

export interface AiAnalysisViewProps {
  ai: QuestionAi;
  status: Status;
  provenance: AiProvenance | null;
  lang: ContentLang | undefined;
  open: boolean;
  animate: boolean; // play the reveal animation (only after a user toggle)
  onToggle: () => void;
  panelId: string;
}

// Footer section of the explanation box. Neutral ink for agrees/doubts; an
// amber tint (borders/background only, never text) when the AI differs.
export function AiAnalysisView({ ai, status, provenance, lang, open, animate, onToggle, panelId }: AiAnalysisViewProps) {
  const s = STATUS[status];
  const attention = status === 'differs';
  const footer = `${provenance ? `${provenance.model} · ` : ''}Advisory, scoring uses source answer`;
  return (
    <div
      data-ai-status={status}
      className={cx(
        'rounded-b-[calc(var(--radius-xl)-1px)] border-t',
        attention ? 'border-warn/30 bg-warn/[0.08]' : 'border-line',
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={stopEnterSpace}
        className="group flex min-h-11 w-full items-center gap-2 px-3.5 py-2.5 text-left sm:px-4"
      >
        <span aria-hidden="true" className="text-[13px] leading-none text-fg">✦</span>
        <span className="text-xs font-semibold tracking-tight text-muted">AI analysis</span>
        <span className="sr-only">. AI answer: </span>
        <span className="tnum inline-flex h-5 items-center rounded-md bg-fg/[0.07] px-1.5 text-xs font-semibold text-fg">
          {ai.answer.join(', ')}
        </span>
        <span
          className={cx(
            'ml-auto inline-flex shrink-0 items-center gap-1.5 text-xs font-medium',
            attention ? 'text-fg' : 'text-muted',
          )}
        >
          <span aria-hidden="true" className={cx('h-1.5 w-1.5 rounded-full', s.dot)} />
          {s.label}
          <span className="sr-only">{s.sr}</span>
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cx(
            'h-3.5 w-3.5 shrink-0 text-faint group-hover:text-fg motion-safe:transition-transform motion-safe:duration-200',
            open && 'rotate-180',
          )}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div id={panelId} hidden={!open} className={cx('px-3.5 pb-3.5 sm:px-4 sm:pb-4', animate && 'motion-safe:animate-ai-reveal')}>
        <p
          lang={lang}
          className="whitespace-pre-wrap text-[14.5px] leading-[1.65] text-fg/90 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-relaxed"
        >
          {ai.explanation}
        </p>
        <p className="mt-2 text-[11px] leading-snug text-faint sm:mt-3">{footer}</p>
      </div>
    </div>
  );
}

// Stateful wrapper. Until the user toggles it, the open state follows the
// "Always show AI analysis" preference live; a manual toggle then sticks for
// this card. Callers key it by qid so the state never leaks between questions.
// `onlyExplanation`: the source has no explanation, so the AI text is the only
// one there is — open it whatever the preference says.
export function AiAnalysis({
  ai,
  status,
  provenance,
  lang,
  onlyExplanation = false,
}: {
  ai: QuestionAi;
  status: Status;
  provenance: AiProvenance | null;
  lang: ContentLang | undefined;
  onlyExplanation?: boolean;
}) {
  const prefs = usePrefs();
  const [manual, setManual] = useState<boolean | null>(null);
  const [animate, setAnimate] = useState(false);
  const panelId = useId();
  const open = manual ?? (onlyExplanation || aiDefaultOpen(status, prefs.aiAlwaysExpanded));
  return (
    <AiAnalysisView
      ai={ai}
      status={status}
      provenance={provenance}
      lang={lang}
      open={open}
      animate={animate}
      onToggle={() => {
        setManual(!open);
        setAnimate(true);
      }}
      panelId={panelId}
    />
  );
}
