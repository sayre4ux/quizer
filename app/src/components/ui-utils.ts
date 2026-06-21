// Non-component helpers, kept out of ui.tsx so that file only exports
// components (satisfies react-refresh/only-export-components).

// Short abbreviation for a category name, for compact radar axis labels.
// "Security and Risk Management" -> "SRM"; single words -> first 4 letters.
export function shortLabel(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => !/^(and|of|the|&|in)$/i.test(w));
  if (words.length >= 2) return words.slice(0, 3).map((w) => w[0]?.toUpperCase() ?? '').join('');
  return name.slice(0, 4);
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function pct(value: number | null): string {
  if (value === null) return '—';
  return `${Math.round(value * 100)}%`;
}
