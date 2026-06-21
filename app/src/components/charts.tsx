import type { MasteryMix } from '../lib/stats';

// Hand-built SVG, monochrome, hairline — matches the app's restrained aesthetic.
// Color is reserved for correctness elsewhere; these read as quiet instruments.

const FILL_MID = 'color-mix(in oklab, var(--fg) 34%, transparent)';
const FILL_FAINT = 'var(--line-strong)';

export function ReadinessRing({ value, label }: { value: number; label: string }) {
  const r = 46;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, value)));
  return (
    <div className="relative grid h-32 w-32 place-items-center">
      <svg width="128" height="128" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--fg)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(0.4,0,0.2,1)' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="tnum text-[1.7rem] font-semibold leading-none tracking-tight text-fg">
          {Math.round(value * 100)}%
        </div>
        <div className="mt-1 text-[11px] font-medium text-muted">{label}</div>
      </div>
    </div>
  );
}

export function CategoryRadar({
  data,
  onAxis,
}: {
  data: { id: number; label: string; short: string; value: number }[];
  onAxis?: (id: number) => void;
}) {
  const N = data.length;
  const C = 100;
  const R = 66;
  const ang = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / N;
  const pt = (i: number, f: number): [number, number] => [
    C + Math.cos(ang(i)) * f * R,
    C + Math.sin(ang(i)) * f * R,
  ];
  const ringPoly = (f: number) => data.map((_, i) => pt(i, f).join(',')).join(' ');
  const dataPoly = data.map((d, i) => pt(i, Math.max(d.value, 0.002)).join(',')).join(' ');

  return (
    <svg viewBox="0 0 200 200" className="mx-auto block w-full max-w-[248px]" aria-label="Mastery by category">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} points={ringPoly(f)} fill="none" stroke="var(--line)" strokeWidth="1" />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="var(--line)" strokeWidth="1" />;
      })}
      <polygon
        points={dataPoly}
        fill="color-mix(in oklab, var(--fg) 13%, transparent)"
        stroke="var(--fg)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ transition: 'all .5s cubic-bezier(0.4,0,0.2,1)' }}
      />
      {data.map((d, i) => {
        const [px, py] = pt(i, d.value);
        return <circle key={`p${i}`} cx={px} cy={py} r="2.2" fill="var(--fg)" />;
      })}
      {data.map((d, i) => {
        const [lx, ly] = pt(i, 1.17);
        const interactive = !!onAxis;
        return (
          <text
            key={d.id}
            x={lx}
            y={ly}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="9"
            fontWeight="600"
            fill="var(--muted)"
            style={{ cursor: interactive ? 'pointer' : 'default' }}
            className={interactive ? 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ring)] focus-visible:outline-offset-2' : undefined}
            {...(interactive && {
              role: 'button',
              tabIndex: 0,
              'aria-label': `Filter by ${d.label}`,
              onClick: () => onAxis(d.id),
              onKeyDown: (e: React.KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAxis(d.id); }
              },
            })}
            {...(!interactive && { 'aria-hidden': true })}
          >
            {d.short}
          </text>
        );
      })}
    </svg>
  );
}

export function MasteryBar({ mix }: { mix: MasteryMix }) {
  const items = [
    { k: 'Mastered', n: mix.mastered, color: 'var(--fg)' },
    { k: 'Learning', n: mix.learning, color: FILL_MID },
    { k: 'New', n: mix.new, color: FILL_FAINT },
  ];
  const w = (n: number) => (mix.total ? (n / mix.total) * 100 : 0);
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        {items.map(
          (it) =>
            it.n > 0 && (
              <div
                key={it.k}
                style={{ width: `${w(it.n)}%`, background: it.color, transition: 'width .5s cubic-bezier(0.4,0,0.2,1)' }}
              />
            ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {items.map((it) => (
          <span key={it.k} className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
            {it.k}
            <span className="tnum font-medium text-fg">{it.n}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
