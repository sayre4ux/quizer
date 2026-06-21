import { useRef, useState } from 'react';
import { Button, Card, Stat } from '../components/ui';
import { cx, pct } from '../components/ui-utils';
import { categories } from '../lib/dataset';
import { poolCount } from '../lib/pools';
import { overall } from '../lib/stats';
import { store, useProgress } from '../state/useStore';
import type { CategoryMeta } from '../types';
import type { StartCfg } from './AnalysisTab';

interface Props {
  start: (cfg: StartCfg) => void;
  startExam: () => void;
}

function ModeCard({
  title,
  desc,
  count,
  onClick,
  primary,
  disabled,
}: {
  title: string;
  desc: string;
  count?: number;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx(
        'group flex flex-col items-start gap-1 rounded-2xl p-4 text-left shadow-soft transition duration-150 ease-out disabled:pointer-events-none disabled:opacity-40',
        primary
          ? 'bg-primary text-onprimary hover:opacity-95 active:scale-[0.99]'
          : 'bg-surface hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:scale-[0.99]',
      )}
    >
      <div className="flex w-full items-center gap-2">
        <span className={cx('text-[15px] font-semibold tracking-tight', primary ? 'text-onprimary' : 'text-fg')}>
          {title}
        </span>
        {count != null && (
          <span className={cx('tnum ml-auto text-sm', primary ? 'text-onprimary/70' : 'text-faint')}>{count}</span>
        )}
      </div>
      <span className={cx('text-[13px] leading-snug', primary ? 'text-onprimary/75' : 'text-muted')}>{desc}</span>
    </button>
  );
}

function BackupControls() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  function doExport() {
    const blob = new Blob([store.exportJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quizer-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Progress exported.');
  }

  function doImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setStatus('Import failed — file too large.');
      e.target.value = '';
      return;
    }
    file.text().then((text) => setStatus(store.importJSON(text) ? 'Progress imported.' : 'Import failed — invalid file.'));
    e.target.value = '';
  }

  return (
    <div className="mt-12 border-t border-line pt-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-faint">Backup (this module)</span>
        <Button variant="ghost" onClick={doExport}>
          Export
        </Button>
        <Button variant="ghost" onClick={() => fileRef.current?.click()}>
          Import
        </Button>
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={doImport} />
        {confirmReset ? (
          <span className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted">Erase this module's progress?</span>
            <Button variant="danger" onClick={() => { store.resetAll(); setConfirmReset(false); setStatus('Progress reset.'); }}>
              Confirm
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button variant="ghost" className="ml-auto text-bad hover:bg-bad/10" onClick={() => setConfirmReset(true)}>
            Reset
          </Button>
        )}
      </div>
      {status && <p className="mt-3 text-xs text-muted">{status}</p>}
    </div>
  );
}

export function HomeTab({ start, startExam }: Props) {
  const progress = useProgress();
  const o = overall(progress);
  const unseen = poolCount(progress, { kind: 'unseen' });
  const wrong = poolCount(progress, { kind: 'everWrong' });
  const due = o.due;
  const flagged = o.flagged;

  const categoryButton = (c: CategoryMeta, className: string) => (
    <button
      key={c.id}
      onClick={() => start({ title: `Drill · ${c.name}`, filter: { kind: 'category', value: c.id } })}
      className={className}
    >
      <span className="min-w-0 truncate text-sm font-medium text-fg">{c.name}</span>
      <span className="tnum ml-auto text-sm text-faint">{poolCount(progress, { kind: 'category', value: c.id })}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-2xl md:max-w-4xl">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Seen" value={<span className="tnum">{o.seen}</span>} sub={`of ${o.total}`} />
        <Stat label="Accuracy" value={pct(o.accuracy)} />
        <Stat label="Flagged" value={<span className="tnum">{flagged}</span>} />
        <Stat label="Due today" value={<span className="tnum">{due}</span>} />
      </div>

      <h2 className="mt-10 mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Study</h2>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        <ModeCard
          title="Continue"
          desc="Drill questions you haven't seen"
          count={unseen}
          primary
          onClick={() => start({ title: 'Continue', filter: { kind: 'unseen' } })}
          disabled={unseen === 0}
        />
        <ModeCard title="Exam simulation" desc="Timed and scored like the real thing" onClick={startExam} />
        <ModeCard
          title="Review wrong"
          desc="Questions you've missed before"
          count={wrong}
          onClick={() => start({ title: 'Review wrong', filter: { kind: 'everWrong' }, mode: 'review' })}
          disabled={wrong === 0}
        />
        <ModeCard
          title="Spaced repetition"
          desc="Cards scheduled for today"
          count={due}
          onClick={() => start({ title: 'SRS due', filter: { kind: 'due' }, mode: 'srs' })}
          disabled={due === 0}
        />
        <ModeCard
          title="Flagged"
          desc="Questions you starred"
          count={flagged}
          onClick={() => start({ title: 'Flagged', filter: { kind: 'flagged' } })}
          disabled={flagged === 0}
        />
        <ModeCard
          title="All questions"
          desc="Shuffle the entire bank"
          count={o.total}
          onClick={() => start({ title: 'All questions', filter: { kind: 'all' } })}
        />
      </div>

      {categories.length > 0 && (
        <>
          <h2 className="mt-10 mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Practice by category</h2>
          {/* Phone: single divided card. Tablet+: 2-up grid of cards. */}
          <Card className="divide-y divide-line overflow-hidden sm:hidden">
            {categories.map((c) =>
              categoryButton(c, 'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-2'),
            )}
          </Card>
          <div className="hidden gap-2 sm:grid sm:grid-cols-2">
            {categories.map((c) =>
              categoryButton(
                c,
                'flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-left shadow-soft transition duration-150 hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0 active:scale-[0.99]',
              ),
            )}
          </div>
        </>
      )}

      <BackupControls />
    </div>
  );
}
