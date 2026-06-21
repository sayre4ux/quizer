import type { Question } from '../types';
import { Badge } from './ui';
import { AssetImage } from './AssetImage';
import { cx } from './ui-utils';

interface Props {
  question: Question;
  selected: string[];
  onToggle: (label: string) => void;
  revealed: boolean;
  index?: number;
  total?: number;
}

export function QuestionCard({ question, selected, onToggle, revealed, index, total }: Props) {
  const correctSet = new Set(question.correct);

  function optionClass(label: string) {
    const isSelected = selected.includes(label);
    if (revealed) {
      if (correctSet.has(label)) return 'border-good/50 bg-good/10 text-fg';
      if (isSelected) return 'border-bad/50 bg-bad/10 text-fg';
      return 'border-line bg-surface text-faint';
    }
    return isSelected
      ? 'border-fg/35 bg-surface-2 text-fg shadow-soft'
      : 'border-line bg-surface text-fg hover:border-line-strong hover:bg-surface-2';
  }

  function markClass(label: string) {
    const isSelected = selected.includes(label);
    if (revealed) {
      if (correctSet.has(label)) return 'border-transparent bg-good text-onprimary';
      if (isSelected) return 'border-transparent bg-bad text-onprimary';
      return 'border-line text-faint';
    }
    return isSelected ? 'border-transparent bg-fg text-onprimary' : 'border-line-strong text-muted';
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        {question.categoryName && <Badge>{question.categoryName}</Badge>}
        {question.topic && <Badge>{question.topic}</Badge>}
        <Badge>{question.paper ? `${question.paper} #${question.number}` : `#${question.number}`}</Badge>
        {index != null && total != null && (
          <span className="tnum ml-auto text-faint">
            {index + 1} / {total}
          </span>
        )}
      </div>

      <h2 className="text-left text-[1.35rem] font-semibold leading-[1.3] text-fg">{question.prompt}</h2>
      {question.promptImage && (
        <AssetImage assetKey={question.promptImage} className="max-h-72 w-auto rounded-xl border border-line" />
      )}

      <div className="flex flex-col gap-2.5">
        {question.options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => !revealed && onToggle(opt.label)}
            disabled={revealed}
            className={cx(
              'flex items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left transition duration-150 ease-out',
              !revealed && 'active:scale-[0.995]',
              optionClass(opt.label),
            )}
          >
            <span
              className={cx(
                'mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[13px] font-semibold transition',
                markClass(opt.label),
              )}
            >
              {opt.label}
            </span>
            <span className="flex flex-col gap-2 text-[15px] leading-relaxed">
              {opt.text}
              {opt.image && <AssetImage assetKey={opt.image} className="max-h-44 w-auto rounded-lg border border-line" />}
            </span>
          </button>
        ))}
      </div>

      {revealed && (
        <div className="rounded-xl border border-line bg-surface-2 p-4 text-left">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-tight text-muted">
            <span className="inline-flex h-5 items-center rounded-md bg-good/15 px-1.5 text-good">
              {question.correct.join(', ')}
            </span>
            <span>Explanation</span>
          </div>
          {question.explanation ? (
            <p className="whitespace-pre-wrap text-[15px] text-fg/90">{question.explanation}</p>
          ) : (
            <p className="text-sm italic text-faint">No explanation provided for this question.</p>
          )}
        </div>
      )}
    </div>
  );
}
