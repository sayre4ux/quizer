import { useState } from 'react';
import { buildPool } from './lib/pools';
import { allQuestions, categories, moduleLabel } from './lib/dataset';
import { exitEphemeral, initActiveBank, switchBank } from './lib/activeBank';
import { importSampleEphemeral } from './lib/importBank';
import { store, useActiveBank, useProgress } from './state/useStore';
import { Button } from './components/ui';
import { cx } from './components/ui-utils';
import { AnalysisTab, type StartCfg } from './modes/AnalysisTab';
import { ExamMode } from './modes/ExamMode';
import { HomeTab } from './modes/HomeTab';
import { SessionRunner } from './modes/SessionRunner';
import { ModuleCarousel } from './modes/ModuleCarousel';
import { ImportDialog } from './modes/ImportDialog';
import { ManageModules } from './modes/ManageModules';
import type { Mode, Question } from './types';

type Active =
  | { type: 'session'; title: string; questions: Question[]; mode: Mode }
  | { type: 'exam' }
  | null;

type Tab = 'home' | 'analysis';
type View = 'home' | 'study';

export default function App() {
  const ab = useActiveBank();
  const [tab, setTab] = useState<Tab>('home');
  const [active, setActive] = useState<Active>(null);
  // Land in the last active module; the carousel is one tap away (header icon).
  // The empty/onboarding state still shows the carousel regardless of this.
  const [view, setView] = useState<View>('study');
  const [showImport, setShowImport] = useState(false);
  const [showManage, setShowManage] = useState(false);

  if (ab.status === 'loading') {
    return (
      <Centered>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-fg" />
      </Centered>
    );
  }

  if (ab.status === 'error') {
    return (
      <Centered>
        <p className="text-sm text-muted">Couldn't load your modules.</p>
        {ab.error && <p className="mt-1 text-xs text-faint">{ab.error}</p>}
        <Button variant="primary" className="mt-4" onClick={() => void initActiveBank()}>Retry</Button>
      </Centered>
    );
  }

  function goHome() {
    setActive(null);
    if (ab.ephemeral) void exitEphemeral(); // discard the sample trial on leaving
    setView('home');
  }
  function openModule(id: string) {
    setActive(null);
    void switchBank(id);
    setTab('home');
    setView('study');
  }
  async function loadSample() {
    const r = await importSampleEphemeral();
    if (r.ok) { setActive(null); setTab('home'); setView('study'); }
    else setShowImport(true); // fall back to manual import if the sample can't load
  }

  const dialogs = (
    <>
      {showImport && (
        <ImportDialog
          onClose={() => setShowImport(false)}
          onInstalled={() => { setShowImport(false); setShowManage(false); setActive(null); setTab('home'); setView('study'); }}
        />
      )}
      {showManage && (
        <ManageModules
          metas={ab.metas}
          activeId={ab.activeBankId}
          onClose={() => setShowManage(false)}
          onOpen={(id) => { setShowManage(false); openModule(id); }}
          onAdd={() => { setShowManage(false); setShowImport(true); }}
        />
      )}
    </>
  );

  // First-run / no banks: a dedicated, compact onboarding (not the carousel — a
  // single giant blank "Add" card reads as broken).
  if (ab.status === 'empty') {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 pt-[env(safe-area-inset-top)] text-center">
        <img src="/icon-192.png" alt="Quizer" width="64" height="64" className="h-16 w-16 rounded-2xl object-cover shadow-soft ring-1 ring-line" />
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-fg">Quizer</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
          Add a question bank to begin — import a <span className="font-medium text-fg">.zip</span> or{' '}
          <span className="font-medium text-fg">.json</span> from your device, or try a sample.
        </p>
        <div className="mt-6 flex items-center gap-2">
          <Button variant="primary" onClick={() => setShowImport(true)}>Add a question bank</Button>
          <Button variant="ghost" onClick={() => void loadSample()}>Load sample</Button>
        </div>
        {dialogs}
      </div>
    );
  }

  // Carousel home / switcher (only reached when at least one bank exists).
  if (view === 'home') {
    return (
      <div className="flex min-h-[100dvh] flex-col overflow-x-clip px-4 pt-[env(safe-area-inset-top)] sm:px-6">
        <header className="mx-auto flex w-full max-w-3xl items-center justify-center gap-3 py-6">
          <img src="/icon-192.png" alt="Quizer" width="36" height="36" className="h-9 w-9 rounded-xl object-cover shadow-soft ring-1 ring-line" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-fg">Quizer</div>
            <div className="text-xs text-faint">Train · Hack · Improve</div>
          </div>
        </header>
        <div className="flex flex-1 flex-col justify-center pb-16">
          <ModuleCarousel
            metas={ab.metas}
            activeId={ab.activeBankId}
            onOpen={openModule}
            onAdd={() => setShowImport(true)}
            onManage={() => setShowManage(true)}
            onLoadSample={() => void loadSample()}
          />
        </div>
        {dialogs}
      </div>
    );
  }

  function start(cfg: StartCfg) {
    const seed = Date.now() % 2147483647;
    const questions = buildPool(store.snapshot(), { filter: cfg.filter, and: cfg.and, shuffle: true, seed });
    setActive({ type: 'session', title: cfg.title, questions, mode: cfg.mode ?? 'drill' });
  }

  if (active?.type === 'session') {
    return (
      <Shell>
        <SessionRunner title={active.title} questions={active.questions} mode={active.mode} onExit={() => setActive(null)} />
      </Shell>
    );
  }

  if (active?.type === 'exam') {
    return (
      <Shell>
        <ExamMode onExit={() => setActive(null)} />
      </Shell>
    );
  }

  return (
    <Shell tabs={<Segmented tab={tab} setTab={setTab} />} container="max-w-2xl md:max-w-4xl" onModules={goHome}>
      {tab === 'home' ? (
        <HomeTab start={start} startExam={() => setActive({ type: 'exam' })} />
      ) : (
        <AnalysisTab start={start} />
      )}
      {dialogs}
    </Shell>
  );
}

// Non-blocking notice when a progress write fails (e.g. storage full). Study
// continues; this just tells the user their progress may not be saved.
function SaveErrorBanner() {
  useProgress(); // re-render on store changes
  const err = store.lastError();
  if (!err) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-md rounded-xl border border-bad/30 bg-surface px-4 py-2.5 text-center text-xs text-bad shadow-pop">
        Couldn't save progress — storage may be full. You can keep going, but recent answers might not persist.
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center px-6 pt-[env(safe-area-inset-top)] text-center">
      <div>{children}</div>
    </div>
  );
}

function Segmented({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Study' },
    { id: 'analysis', label: 'Analysis' },
  ];
  return (
    <div className="inline-flex rounded-xl bg-surface-2 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          className={cx(
            'min-h-11 rounded-lg px-4 py-1.5 text-sm font-medium transition duration-150 sm:min-h-9',
            tab === t.id ? 'bg-surface text-fg shadow-soft' : 'text-muted hover:text-fg',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Shell({
  children,
  tabs,
  container = 'max-w-2xl',
  onModules,
}: {
  children: React.ReactNode;
  tabs?: React.ReactNode;
  container?: string;
  onModules?: () => void;
}) {
  const categoryNote = categories.length > 0 ? ` · ${categories.length} categories` : '';
  return (
    <div className="min-h-[100dvh] px-4 pt-[env(safe-area-inset-top)] sm:px-6">
      <header className={cx('mx-auto flex items-center gap-3 py-5', container)}>
        {onModules && (
          <button
            onClick={onModules}
            className="-ml-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg active:scale-95"
            aria-label="Back to modules"
            title="Modules"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        )}
        <img src="/icon-192.png" alt="Quizer" width="36" height="36" className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-soft ring-1 ring-line" />
        <div className="leading-tight">
          <div className="text-[15px] font-semibold tracking-tight text-fg">Quizer</div>
          {moduleLabel && (
            <div className="mt-1 mb-0.5">
              <span className="inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
                {moduleLabel}
              </span>
            </div>
          )}
          <div className="tnum text-xs text-faint">{allQuestions.length.toLocaleString()} questions{categoryNote}</div>
        </div>
        {tabs && <div className="ml-auto">{tabs}</div>}
      </header>
      <main className="pb-12">{children}</main>
      <SaveErrorBanner />
    </div>
  );
}
