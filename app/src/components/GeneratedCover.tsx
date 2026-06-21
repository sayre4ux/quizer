// Deterministic monochrome cover art for banks without a provided cover image.
// Big initials over a faint geometric motif seeded by installedId — distinct per
// bank, yet on-system (no colour; reads like a minimalist album sleeve).

function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return label.trim().slice(0, 2).toUpperCase();
}

function Motif({ seed }: { seed: number }) {
  const kind = seed % 3;
  const rot = (seed >> 3) % 90;
  const stroke = 'color-mix(in oklab, var(--fg) 12%, transparent)';
  if (kind === 0) {
    // concentric arcs
    return (
      <g fill="none" stroke={stroke} strokeWidth="1.4">
        {[18, 32, 46, 60].map((r) => <circle key={r} cx="78" cy="22" r={r} />)}
      </g>
    );
  }
  if (kind === 1) {
    // diagonal hairlines
    return (
      <g stroke={stroke} strokeWidth="1.2" transform={`rotate(${rot} 50 50)`}>
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={-20 + i * 14} y1="-20" x2={-20 + i * 14} y2="120" />)}
      </g>
    );
  }
  // offset grid of dots
  return (
    <g fill={stroke}>
      {Array.from({ length: 6 }, (_, r) =>
        Array.from({ length: 6 }, (_, c) => <circle key={`${r}-${c}`} cx={12 + c * 16} cy={12 + r * 16} r="1.6" />),
      )}
    </g>
  );
}

export function GeneratedCover({ label, className }: { label: string; className?: string }) {
  const seed = hash(label);
  return (
    <div
      className={className}
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(155deg, var(--surface-2), var(--surface))',
        display: 'grid',
        placeItems: 'center',
        containerType: 'inline-size',
      }}
    >
      <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden="true">
        <Motif seed={seed} />
      </svg>
      <span
        style={{
          position: 'relative',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          fontSize: 'clamp(2rem, 22cqi, 3.6rem)',
          color: 'var(--fg)',
        }}
      >
        {initials(label)}
      </span>
    </div>
  );
}
