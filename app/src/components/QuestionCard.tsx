import { useState, type Ref } from 'react';
import type { Question } from '../types';
import { Badge } from './ui';
import { AssetImage, ZoomButton, ZoomableImage } from './AssetImage';
import { AiAnalysis } from './AiAnalysis';
import { contentLang, cx, stopEnterSpace } from './ui-utils';
import { aiStatus } from '../lib/aiStatus';
import { aiProvenance } from '../lib/dataset';
import { useScriptConverter } from '../lib/chineseScript';

interface Props {
  question: Question;
  selected: string[];
  onToggle: (label: string) => void;
  revealed: boolean;
  index?: number;
  total?: number;
  // 'compact': one faint meta line and no index (the session/exam top bar shows it).
  meta?: 'full' | 'compact';
  // Set after reveal: the first relevant option row, and the explanation box.
  revealAnchorRef?: Ref<HTMLButtonElement>;
  explanationRef?: Ref<HTMLDivElement>;
}

export function QuestionCard({
  question,
  selected,
  onToggle,
  revealed,
  index,
  total,
  meta = 'full',
  revealAnchorRef,
  explanationRef,
}: Props) {
  const correctSet = new Set(question.correct);
  // Display-only script conversion; grading and state keep the original text.
  const { convert, lang: zhScript } = useScriptConverter();
  // `lang` per text node, from that node's own text: a bank can mix English
  // prompts with Chinese explanations.
  const langOf = (text: string) => contentLang(text, zhScript);
  const lang = langOf(question.prompt);
  const cjk = lang !== undefined;
  const status = aiStatus(question);
  const ai = question.ai;
  const aiPick = status === 'differs' && ai ? new Set(ai.answer) : null;
  const hasAi = revealed && status !== 'none' && ai !== null;

  // Rows the user expanded after reveal. Tied to the qid so SessionRunner's
  // reused card starts every question collapsed.
  const [expanded, setExpanded] = useState<{ qid: string; labels: string[] }>({ qid: question.qid, labels: [] });
  const expandedLabels = expanded.qid === question.qid ? expanded.labels : [];
  function toggleExpanded(label: string) {
    const next = expandedLabels.includes(label) ? expandedLabels.filter((l) => l !== label) : [...expandedLabels, label];
    setExpanded({ qid: question.qid, labels: next });
  }

  // After reveal, the key, the user's pick and an AI pick stay in full; the
  // rest collapse to one line so the feedback fits on a phone screen.
  function isRelevant(label: string) {
    return correctSet.has(label) || selected.includes(label) || (aiPick?.has(label) ?? false);
  }
  const firstRelevant = revealed ? question.options.find((o) => isRelevant(o.label))?.label : undefined;

  function optionClass(label: string) {
    const isSelected = selected.includes(label);
    if (revealed) {
      if (correctSet.has(label)) return 'border-good/50 bg-good/10 text-fg';
      if (isSelected) return 'border-bad/50 bg-bad/10 text-fg';
      if (aiPick?.has(label)) return 'border-line-strong bg-surface text-muted';
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
      if (aiPick?.has(label)) return 'border-line-strong text-muted';
      return 'border-line text-faint';
    }
    return isSelected ? 'border-transparent bg-fg text-onprimary' : 'border-line-strong text-muted';
  }

  const paperRef = question.paper ? `${convert(question.paper)} #${question.number}` : `#${question.number}`;
  const categoryName = question.categoryName ? convert(question.categoryName) : null;
  const compactMeta = [categoryName, paperRef].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-3.5 sm:gap-5">
      {meta === 'compact' ? (
        <div lang={contentLang(compactMeta, zhScript)} className="truncate text-[11px] text-faint">
          {compactMeta}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {categoryName && <Badge lang={contentLang(categoryName, zhScript)}>{categoryName}</Badge>}
          {question.topic && <Badge lang={contentLang(question.topic, zhScript)}>{convert(question.topic)}</Badge>}
          <Badge lang={contentLang(paperRef, zhScript)}>{paperRef}</Badge>
          {index != null && total != null && (
            <span className="tnum ml-auto text-faint">
              {index + 1} / {total}
            </span>
          )}
        </div>
      )}

      <h2
        lang={lang}
        className={cx(
          'q-prompt text-left text-fg [overflow-wrap:anywhere]',
          cjk
            ? 'text-[1.0625rem] font-medium leading-[1.6] sm:text-[1.1875rem] sm:leading-[1.65]'
            : 'text-[1.2rem] font-semibold leading-[1.35] sm:text-[1.35rem] sm:leading-[1.3]',
        )}
      >
        {convert(question.prompt)}
      </h2>
      {question.promptImage && (
        <ZoomableImage
          assetKey={question.promptImage}
          className="max-h-48 w-auto max-w-full rounded-xl border border-line object-contain sm:max-h-72"
        />
      )}

      <div className="flex flex-col gap-2 sm:gap-2.5">
        {question.options.map((opt) => {
          const relevant = !revealed || isRelevant(opt.label);
          const compact = !relevant && !expandedLabels.includes(opt.label);
          const tagged = revealed && (aiPick?.has(opt.label) ?? false);
          const optLang = langOf(opt.text);
          return (
            <div key={opt.label} className="relative flex flex-col">
              <button
                ref={opt.label === firstRelevant ? revealAnchorRef : undefined}
                type="button"
                data-option={opt.label}
                data-ai-pick={tagged ? 'true' : undefined}
                onClick={() => {
                  if (!revealed) onToggle(opt.label);
                  else if (!relevant) toggleExpanded(opt.label);
                }}
                onKeyDown={revealed ? stopEnterSpace : undefined}
                disabled={revealed && relevant}
                aria-expanded={relevant ? undefined : !compact}
                className={cx(
                  'flex items-start rounded-xl border text-left transition duration-150 ease-out',
                  compact
                    ? 'min-h-10 gap-3 px-3.5 py-2 sm:gap-3.5 sm:px-4'
                    : 'min-h-11 gap-3 px-3.5 py-2.5 sm:min-h-12 sm:gap-3.5 sm:px-4 sm:py-3.5',
                  !revealed && 'active:scale-[0.995]',
                  optionClass(opt.label),
                )}
              >
                <span
                  className={cx(
                    'flex shrink-0 items-center justify-center rounded-lg border font-semibold transition',
                    compact ? 'h-5 w-5 text-[11px]' : 'mt-px h-6 w-6 text-[13px]',
                    markClass(opt.label),
                  )}
                >
                  {opt.label}
                </span>
                {compact ? (
                  <span lang={optLang} className="line-clamp-1 min-w-0 flex-1 text-[14px] leading-5 [overflow-wrap:anywhere]">
                    {convert(opt.text)}
                  </span>
                ) : (
                  <span
                    lang={optLang}
                    className={cx(
                      'flex min-w-0 flex-1 flex-col gap-2 text-[15px] [overflow-wrap:anywhere]',
                      optLang ? 'leading-[1.55] sm:leading-relaxed' : 'leading-relaxed',
                    )}
                  >
                    <span>
                      {convert(opt.text)}
                      {revealed && correctSet.has(opt.label) && <span className="sr-only"> (correct answer)</span>}
                      {revealed && selected.includes(opt.label) && <span className="sr-only"> (your answer)</span>}
                    </span>
                    {opt.image && (
                      <AssetImage
                        assetKey={opt.image}
                        className="max-h-44 w-auto max-w-[calc(100%-2.5rem)] self-start rounded-lg border border-line object-contain"
                      />
                    )}
                  </span>
                )}
                {tagged && (
                  <span className="mt-0.5 inline-flex h-5 shrink-0 items-center gap-1 self-start rounded-md border border-fg/20 bg-surface px-1.5 text-[11px] font-semibold leading-none text-fg">
                    <span aria-hidden="true">✦</span>AI<span className="sr-only"> recommended</span>
                  </span>
                )}
              </button>
              {/* A sibling, not a child: buttons can't nest, and tapping the row selects. */}
              {opt.image && !compact && (
                <ZoomButton assetKey={opt.image} className="absolute right-0.5 bottom-0.5" />
              )}
            </div>
          );
        })}
      </div>

      {revealed && (
        <div ref={explanationRef} className="rounded-xl border border-line bg-surface-2 text-left">
          <div className="px-3.5 py-3 sm:p-4">
            <div
              className={cx(
                'flex items-center gap-2 text-xs font-semibold tracking-tight text-muted',
                (question.explanation || !hasAi) && 'mb-2',
              )}
            >
              <span className="inline-flex h-5 items-center rounded-md bg-good/15 px-1.5 text-good">
                {question.correct.join(', ')}
              </span>
              <span>Explanation</span>
            </div>
            {question.explanation ? (
              <p
                lang={langOf(question.explanation)}
                className="whitespace-pre-wrap text-[14.5px] leading-[1.65] text-fg/90 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-relaxed"
              >
                {convert(question.explanation)}
              </p>
            ) : (
              !hasAi && <p className="text-sm italic text-faint">No explanation provided for this question.</p>
            )}
          </div>
          {hasAi && (
            <AiAnalysis
              key={question.qid}
              ai={{ ...ai, explanation: convert(ai.explanation) }}
              status={status}
              provenance={aiProvenance}
              lang={langOf(ai.explanation)}
              onlyExplanation={!question.explanation}
            />
          )}
        </div>
      )}
    </div>
  );
}
