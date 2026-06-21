import { AccuracyBar, Button, Card } from '../components/ui';
import { CategoryRadar, MasteryBar, ReadinessRing } from '../components/charts';
import { pct, shortLabel } from '../components/ui-utils';
import {
  byCategory, byPaper, categoryMastery, learningMix, mostFailedTopics, readiness, UNCATEGORIZED,
} from '../lib/stats';
import type { PoolFilter } from '../lib/pools';
import { useProgress } from '../state/useStore';
import type { Mode } from '../types';

export interface StartCfg {
  title: string;
  filter: PoolFilter;
  and?: PoolFilter;
  mode?: Mode;
}

interface Props {
  start: (cfg: StartCfg) => void;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-faint">{children}</h2>;
}

// A GroupStat key back to a category filter value (null = the Uncategorized bucket).
function categoryValue(key: string): number | null {
  return key === UNCATEGORIZED ? null : Number(key);
}

export function AnalysisTab({ start }: Props) {
  const progress = useProgress();
  const cats = byCategory(progress);
  const papers = byPaper(progress);
  const failedTopics = mostFailedTopics(progress);
  const ready = readiness(progress);
  const mix = learningMix(progress);
  const mastery = categoryMastery(progress);
  const hasCategories = mastery.length > 0;
  const radarData = mastery.map((d) => ({ id: d.id, label: d.name, short: shortLabel(d.name), value: d.pct }));

  return (
    <div className="mx-auto max-w-2xl md:max-w-4xl">
      <SectionTitle>Overview</SectionTitle>
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <div className="flex flex-col items-center gap-2">
            <ReadinessRing value={ready.pct} label={ready.label} />
            <p className="max-w-[12rem] text-center text-[11px] leading-snug text-faint">
              Mastered = retained through spaced review (21+ day interval)
            </p>
          </div>
          {hasCategories && (
            <div className="w-full flex-1">
              {mastery.length >= 3 ? (
                <CategoryRadar
                  data={radarData}
                  onAxis={(id) =>
                    start({ title: `Drill · ${mastery.find((d) => d.id === id)?.name ?? `Category ${id}`}`, filter: { kind: 'category', value: id } })
                  }
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {mastery.map((d) => (
                    <div key={d.id} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-sm text-fg">{d.name}</span>
                      <div className="flex-1">
                        <AccuracyBar value={d.pct} />
                      </div>
                      <span className="tnum w-10 text-right text-xs text-faint">{pct(d.pct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <MasteryBar mix={mix} />
        </div>
      </Card>

      {hasCategories && (
        <>
          <div className="mt-10">
            <SectionTitle>Performance by category</SectionTitle>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {cats.map((d) => (
              <Card key={d.key} className="p-4">
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold tracking-tight text-fg">{d.label}</span>
                  <span className="tnum ml-auto text-sm font-medium text-fg">{pct(d.accuracy)}</span>
                </div>
                <div className="mt-3">
                  <AccuracyBar value={d.accuracy} />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="tnum text-xs text-faint">
                    {d.seen}/{d.total} seen · {d.wrong} wrong
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="px-3 py-1.5 text-xs"
                      onClick={() => start({ title: `Drill · ${d.label}`, filter: { kind: 'category', value: categoryValue(d.key) } })}
                    >
                      Practice
                    </Button>
                    <Button
                      variant="danger"
                      className="px-3 py-1.5 text-xs"
                      disabled={d.wrong === 0}
                      onClick={() =>
                        start({
                          title: `Redo wrong · ${d.label}`,
                          filter: { kind: 'category', value: categoryValue(d.key) },
                          and: { kind: 'everWrong' },
                        })
                      }
                    >
                      Redo wrong
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <div className="mt-10">
        <SectionTitle>Most-failed topics</SectionTitle>
        {failedTopics.length === 0 ? (
          <p className="text-sm text-faint">No misses recorded yet — keep practicing.</p>
        ) : (
          <Card className="divide-y divide-line overflow-hidden">
            {failedTopics.map((t) => (
              <div key={t.key} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-fg">{t.label}</div>
                  <div className="tnum text-xs text-faint">
                    {t.wrong} wrong · {pct(t.accuracy)} acc
                  </div>
                </div>
                <Button
                  variant="secondary"
                  className="px-3 py-1.5 text-xs"
                  onClick={() =>
                    start({ title: `Redo · ${t.label}`, filter: { kind: 'topic', value: t.key }, and: { kind: 'everWrong' } })
                  }
                >
                  Redo
                </Button>
              </div>
            ))}
          </Card>
        )}
      </div>

      <div className="mt-10">
        <SectionTitle>By paper</SectionTitle>
        <Card className="flex flex-col gap-3.5 p-4">
          {papers.map((p) => (
            <div key={p.key} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm text-fg">{p.label}</span>
              <div className="flex-1">
                <AccuracyBar value={p.accuracy} />
              </div>
              <span className="tnum w-16 text-right text-xs text-faint">
                {p.seen}/{p.total}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
