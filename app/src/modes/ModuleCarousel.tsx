import { useCallback, useEffect, useRef, useState } from 'react';
import type { BankMeta } from '../lib/quizbank/idb';
import { CoverArt, AddCoverArt } from '../components/ModuleCard';
import { Button } from '../components/ui';

interface Props {
  metas: BankMeta[];
  activeId: string | null;
  onOpen: (installedId: string) => void;
  onAdd: () => void;
  onManage: () => void;
  onLoadSample: () => void;
}

type Item = { kind: 'bank'; meta: BankMeta } | { kind: 'add' };

const SPACING = 95; // each side card's CENTRE sits this % of a card-width out from the middle
const MAX_VISIBLE = 1.8;
const SLOT_WINDOW = 3;

function readinessLabel(pct: number): string {
  return pct >= 0.85 ? 'Exam-ready' : pct >= 0.6 ? 'Strong' : pct >= 0.3 ? 'On track' : 'Building';
}

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

export function ModuleCarousel({ metas, activeId, onOpen, onAdd, onManage, onLoadSample }: Props) {
  const items: Item[] = [...metas.map((meta) => ({ kind: 'bank' as const, meta })), { kind: 'add' as const }];
  const n = items.length;
  const loop = n > 1; // infinite wrap only when there's more than one card

  // `index` is the centered slot; with looping it's unbounded (wrapped via modulo).
  const [index, setIndex] = useState(() => Math.max(0, metas.findIndex((m) => m.installedId === activeId)));
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);

  const reduceMotion = useMedia('(prefers-reduced-motion: reduce)');
  const trackRef = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ id: number; x: number; t: number; w: number } | null>(null);
  const moved = useRef(false); // a real drag fires a trailing click — suppress it

  const wrap = useCallback((i: number) => ((i % n) + n) % n, [n]);
  const setCenter = useCallback((i: number) => setIndex(loop ? i : Math.min(n - 1, Math.max(0, i))), [loop, n]);

  // Sync the centered card to the active bank when it changes — derived-state in
  // render. With looping, jump to the nearest equivalent slot so the move is short.
  const [seenActive, setSeenActive] = useState(activeId);
  if (activeId !== seenActive) {
    setSeenActive(activeId);
    const target = metas.findIndex((m) => m.installedId === activeId);
    if (target >= 0) setIndex((cur) => (loop ? target + Math.round((cur - target) / n) * n : target));
  }

  function cardWidthPx(): number {
    const w = trackRef.current?.clientWidth ?? 320;
    return Math.min(w * 0.56, 240);
  }

  function onPointerDown(e: React.PointerEvent) {
    pointer.current = { id: e.pointerId, x: e.clientX, t: e.timeStamp, w: cardWidthPx() };
    moved.current = false;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    if (Math.abs(e.clientX - p.x) > 6) moved.current = true;
    setDrag(-(e.clientX - p.x) / p.w);
  }
  function endDrag(e: React.PointerEvent) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    const dx = e.clientX - p.x;
    const dt = Math.max(1, e.timeStamp - p.t);
    const velocity = -dx / p.w / dt; // cards per ms
    const flick = Math.abs(velocity) > 0.0015 ? Math.sign(velocity) : 0;
    // Compute the landing slot from the live event, not the `drag` state — at
    // pointerup the last move's setDrag may not have committed yet (stale closure).
    // A flick biases half a card in its direction rather than adding a whole extra
    // step, so a quick flick advances exactly one card instead of overshooting by two.
    const dragUnits = -dx / p.w;
    setCenter(index + Math.round(dragUnits + flick * 0.5));
    setDrag(0);
    setDragging(false);
    pointer.current = null;
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowRight') { e.preventDefault(); setCenter(index + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); setCenter(index - 1); }
  }

  const pos = index + drag;
  const transition = dragging || reduceMotion ? 'none' : 'transform 380ms cubic-bezier(0.34,1.4,0.64,1), opacity 280ms ease';

  // Jump to item i via the shortest looped path (used by the dot pager).
  function goToItem(i: number) {
    let delta = i - wrap(index);
    if (loop) { if (delta > n / 2) delta -= n; else if (delta < -n / 2) delta += n; }
    setCenter(index + delta);
  }

  function activate(slot: number) {
    if (moved.current) { moved.current = false; return; } // was a drag, not a tap
    if (slot === index) {
      const it = items[wrap(slot)];
      if (it.kind === 'add') onAdd();
      else onOpen(it.meta.installedId);
    } else {
      setCenter(slot);
    }
  }

  // Virtual slots around the centre; each maps to an item by modulo (infinite wrap).
  const slots: number[] = [];
  const lo = Math.round(pos) - SLOT_WINDOW;
  const hi = Math.round(pos) + SLOT_WINDOW;
  for (let v = lo; v <= hi; v++) {
    if (!loop && (v < 0 || v > n - 1)) continue;
    if (Math.abs(v - pos) > MAX_VISIBLE) continue;
    slots.push(v);
  }

  const centered = items[wrap(index)];

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center">
      <div
        ref={trackRef}
        className="relative w-full touch-pan-y select-none"
        style={{
          height: 'min(56vw, 240px)', // wraps the square card; only the centred one shows
          isolation: 'isolate', // keep card z-indexes from leaking over modals
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        role="listbox"
        aria-label="Modules"
        aria-orientation="horizontal"
      >
        {slots.map((v) => {
          const it = items[wrap(v)];
          const offset = v - pos;
          const dist = Math.min(Math.abs(offset), 1);
          const scale = 1 - dist * 0.06;
          // Neighbours are invisible at rest (only the centred card shows) and fade
          // in as they slide toward centre during a swipe.
          const opacity = Math.max(0, 1 - Math.abs(offset));
          const isCenter = Math.abs(offset) < 0.5;
          const selected = v === index;
          const label = it.kind === 'add' ? 'Add module' : it.meta.displayName;
          return (
            <button
              key={v}
              role="option"
              aria-selected={selected}
              aria-label={`${label}, ${wrap(v) + 1} of ${n}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => activate(v)}
              className="absolute top-0 left-1/2 flex flex-col items-center focus:outline-none"
              style={{
                width: 'min(56vw, 240px)',
                transform: `translateX(calc(-50% + ${offset * SPACING}%)) scale(${scale})`,
                opacity,
                zIndex: 1000 - Math.round(Math.abs(offset) * 10),
                transition,
                pointerEvents: Math.abs(offset) > 0.6 ? 'none' : 'auto',
              }}
            >
              <div
                className="aspect-square w-full overflow-hidden rounded-2xl"
                style={{
                  boxShadow: isCenter
                    ? '0 0 0 1px var(--line-strong), 0 14px 34px -18px color-mix(in oklab, var(--fg) 28%, transparent)'
                    : '0 0 0 1px color-mix(in oklab, var(--fg) 16%, transparent)',
                  outline: selected ? '2px solid color-mix(in oklab, var(--fg) 55%, transparent)' : 'none',
                  outlineOffset: '3px',
                }}
              >
                {it.kind === 'add'
                  ? <AddCoverArt className="h-full w-full" />
                  : <CoverArt meta={it.meta} className="h-full w-full" />}
              </div>
            </button>
          );
        })}
      </div>

      {n > 1 && (
        <div className="mt-5 flex items-center justify-center gap-2" role="tablist" aria-label="Choose module">
          {items.map((it, i) => {
            const active = i === wrap(index);
            return (
              <button
                key={i}
                role="tab"
                aria-selected={active}
                aria-label={it.kind === 'add' ? 'Add module' : it.meta.displayName}
                onClick={() => goToItem(i)}
                className="grid place-items-center p-1.5 focus:outline-none"
              >
                <span
                  className="block rounded-full transition-all duration-300"
                  style={{
                    height: 6,
                    width: active ? 18 : 6,
                    background: active ? 'var(--fg)' : 'color-mix(in oklab, var(--fg) 26%, transparent)',
                  }}
                />
              </button>
            );
          })}
        </div>
      )}

      <Detail item={centered} activeId={activeId} onOpen={onOpen} onAdd={onAdd} onManage={onManage} onLoadSample={onLoadSample} />
    </div>
  );
}

function Detail({
  item, activeId, onOpen, onAdd, onManage, onLoadSample,
}: {
  item: Item;
  activeId: string | null;
  onOpen: (id: string) => void;
  onAdd: () => void;
  onManage: () => void;
  onLoadSample: () => void;
}) {
  if (item.kind === 'add') {
    return (
      <div className="mt-7 flex flex-col items-center text-center">
        <h2 className="text-lg font-semibold tracking-tight text-fg">Add a question bank</h2>
        <p className="mt-1 max-w-xs text-sm text-muted">Import a .zip or .json bank file from your device.</p>
        <div className="mt-4 flex items-center gap-2">
          <Button variant="primary" onClick={onAdd}>Add module</Button>
          <Button variant="ghost" onClick={onLoadSample}>Load sample</Button>
        </div>
      </div>
    );
  }
  const m = item.meta;
  const pctMastered = Math.round(m.summary.progressPct * 100);
  return (
    <div className="mt-7 flex flex-col items-center text-center">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-fg">{m.displayName}</h2>
        {m.module && (
          <span className="inline-flex items-center rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted">
            {m.module}
          </span>
        )}
      </div>
      <p className="tnum mt-1 text-sm text-muted">
        {m.questionCount.toLocaleString()} questions · {pctMastered}% mastered · {readinessLabel(m.summary.progressPct)}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <Button variant="primary" className="px-7" onClick={() => onOpen(m.installedId)}>
          {m.installedId === activeId ? 'Continue' : 'Open'}
        </Button>
        <Button variant="ghost" onClick={onManage}>Manage</Button>
      </div>
    </div>
  );
}
