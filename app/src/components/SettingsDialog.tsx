import { useId, useState } from 'react';
import { DialogOverlay } from './ui';
import { contentLang, cx, stopEnterSpace } from './ui-utils';
import { setPref, usePrefs, type ChineseScriptPref } from '../lib/prefs';
import { aiProvenance, bankScript } from '../lib/dataset';
import { conversionFor, ensureConverterLoaded, useScriptConverter } from '../lib/chineseScript';

const SCRIPT_OPTIONS: { id: ChineseScriptPref; label: string; lang?: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'simplified', label: '简体', lang: 'zh-Hans' },
  { id: 'traditional', label: '繁體', lang: 'zh-Hant' },
];

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const prefs = usePrefs();
  const titleId = useId();
  const descId = useId();
  const on = prefs.aiAlwaysExpanded;
  // Live binding: read in render so it reflects the active bank.
  const prov = aiProvenance;
  const script = bankScript;
  const { convert, lang: zhScript, ready, failed } = useScriptConverter();

  function chooseScript(value: ChineseScriptPref) {
    setPref('chineseScript', value);
    // Also the retry path after a failed load: re-choosing the same value
    // doesn't change the preference, so ask for the converter directly.
    const dir = conversionFor(script, value);
    if (dir) ensureConverterLoaded(dir).catch(() => {});
  }

  return (
    <DialogOverlay onClose={onClose} label="Settings">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold tracking-tight text-fg">Settings</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-my-2 -mr-2 grid h-11 w-11 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Answer review</div>
      <div className="mt-2 flex min-h-11 items-start gap-4 rounded-xl border border-line bg-surface-2 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div id={titleId} className="text-sm font-medium text-fg">
            <span aria-hidden="true" className="mr-1 text-[13px]">✦</span>Always show AI analysis
          </div>
          <p id={descId} className="mt-1 text-xs leading-relaxed text-muted">
            Expand the AI section on every revealed question. When off, it opens only when the AI disagrees with or
            doubts the source answer.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={titleId}
          aria-describedby={descId}
          onClick={() => setPref('aiAlwaysExpanded', !on)}
          className={cx(
            // The pseudo-element extends the hit area to 44px tall.
            "relative mt-0.5 inline-flex h-6 w-10 shrink-0 items-center rounded-full after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-[''] motion-safe:transition-colors motion-safe:duration-200",
            on ? 'bg-fg' : 'bg-line-strong',
          )}
        >
          <span
            aria-hidden="true"
            className={cx(
              'absolute left-0.5 h-5 w-5 rounded-full shadow-soft motion-safe:transition-transform motion-safe:duration-200',
              on ? 'translate-x-4 bg-surface' : 'bg-muted',
            )}
          />
        </button>
      </div>

      {script !== null && (
        <>
          <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.06em] text-faint">Chinese text</div>
          <div role="radiogroup" aria-label="Chinese script" className="mt-2 flex rounded-xl bg-surface-2 p-1">
            {SCRIPT_OPTIONS.map((o) => {
              const checked = prefs.chineseScript === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  lang={o.lang}
                  onClick={() => chooseScript(o.id)}
                  onKeyDown={stopEnterSpace}
                  className={cx(
                    'min-h-11 flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition duration-150',
                    checked ? 'bg-surface text-fg shadow-soft' : 'text-muted hover:text-fg',
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Converts characters only; exam terms stay the same. Text inside figures is not converted.
          </p>
          <p aria-live="polite" className="text-xs leading-relaxed text-faint">
            {failed
              ? "Couldn't load the converter. Go online once and choose again; after that it works offline."
              : !ready && (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-line border-t-muted" />
                    Loading converter…
                  </span>
                )}
          </p>
        </>
      )}

      {prov && (
        <p className="mt-3 text-xs leading-relaxed text-muted">
          <span className="font-medium text-fg">About AI analysis:</span> {prov.model}
          {prov.date && ` · ${prov.date}`}
          {prov.note && (
            <>
              {' — '}
              <span lang={contentLang(prov.note, zhScript)}>{convert(prov.note)}</span>
            </>
          )}
        </p>
      )}
    </DialogOverlay>
  );
}

const GEAR =
  'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z';

// Gear button that owns its dialog, so every host (Shell header, session and
// exam top bars) gets the same control without threading state through App.
export function SettingsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="Settings"
        title="Settings"
        onClick={() => setOpen(true)}
        onKeyDown={stopEnterSpace}
        className={cx(
          'grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg active:scale-95',
          className,
        )}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d={GEAR} />
        </svg>
      </button>
      {open && <SettingsDialog onClose={() => setOpen(false)} />}
    </>
  );
}
