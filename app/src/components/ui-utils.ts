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

export type ContentLang = 'zh' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko';

// Script detection for bank content. manifest.language is free text, so the
// `lang` attribute is derived from the text itself. Kana and hangul are checked
// before han because Japanese and Korean text also contain han characters.
// `zhScript`, when the displayed Chinese script is known, refines 'zh' so the
// OS picks the matching SC/TC glyph forms.
export function contentLang(text: string, zhScript?: 'zh-Hans' | 'zh-Hant'): ContentLang | undefined {
  if (/[぀-ヿ]/.test(text)) return 'ja';
  if (/[가-힯ᄀ-ᇿ]/.test(text)) return 'ko';
  if (/[㐀-䶿一-鿿豈-﫿]/.test(text)) return zhScript ?? 'zh';
  return undefined;
}

// SessionRunner binds Enter on window to check/advance. Controls that are not
// part of answering stop Enter/Space here so activating them doesn't also
// advance the session; the native button activation still fires.
export function stopEnterSpace(e: { key: string; stopPropagation: () => void }): void {
  if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();
}
