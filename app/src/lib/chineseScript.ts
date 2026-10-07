import { useEffect, useSyncExternalStore } from 'react';
import { bankScript as activeBankScript } from './dataset';
import { usePrefs, type ChineseScriptPref } from './prefs';

// Simplified <-> Traditional display for Chinese banks. Glyphs only (OpenCC's
// standard "t" form, no Taiwan/HK vocabulary), applied at render: the dataset,
// grading, filters and persistence always keep the bank's original text.

export type BankScript = 'hans' | 'hant';
export type ScriptLang = 'zh-Hans' | 'zh-Hant';
export type Direction = 'toHant' | 'toHans';

// Very common characters that exist in only one script, so a hit is real
// signal. Simplified forms that are also valid Traditional characters
// (后, 于, 干, 里, 面…) are left out on purpose.
const HANS_ONLY = new Set('这们来说对时会为与网络传据机统开关应测试个国过发动实现进产种问题务业经级报数门间规则设计认证访码权资错误处将样还类护险评储构执签显环节选读写页线号');
const HANT_ONLY = new Set('這們來說對時會為爲與網絡傳據機統開關應測試個國過發動實現進產種問題務業經級報數門間規則設計認證訪碼權資錯誤處將樣還類護險評儲構執簽籤顯環節選讀寫頁線號');

const MIN_HITS = 5;
// Hiragana, katakana (minus the ・ and ー marks Chinese text borrows), hangul.
const KANA_HANGUL = /[ぁ-ゖァ-ヺ가-힯ᄀ-ᇿ]/;
const MIN_RATIO = 3;

const HANS_REGIONS = new Set(['cn', 'sg', 'my']);
const HANT_REGIONS = new Set(['tw', 'hk', 'mo']);

function scriptFromTag(tag: string): BankScript | null | undefined {
  const parts = tag.trim().toLowerCase().split(/[-_]/);
  if (parts[0] !== 'zh') return undefined;
  for (const p of parts.slice(1)) {
    if (p === 'hans') return 'hans';
    if (p === 'hant') return 'hant';
  }
  for (const p of parts.slice(1)) {
    if (HANS_REGIONS.has(p)) return 'hans';
    if (HANT_REGIONS.has(p)) return 'hant';
  }
  return null; // bare "zh" (or an unknown subtag): Chinese, script unknown
}

// The bank's script: a zh-* BCP-47 tag naming a script or region decides.
// Any other tag ("en", "中文", bare "zh") or none: the text decides, so an
// English bank with Chinese explanations still reads as Chinese.
// null = no Chinese, or too little signal to tell.
export function detectBankScript(manifestLanguage: string | undefined, sampleTexts: string[]): BankScript | null {
  const fromTag = manifestLanguage ? scriptFromTag(manifestLanguage) : undefined;
  if (fromTag) return fromTag;
  let hans = 0;
  let hant = 0;
  let other = 0;
  for (const text of sampleTexts) {
    for (const ch of text) {
      if (HANS_ONLY.has(ch)) hans += 1;
      else if (HANT_ONLY.has(ch)) hant += 1;
      else if (KANA_HANGUL.test(ch)) other += 1;
    }
  }
  // Japanese/Korean text: its kanji/hanja would read as noise. A stray kana
  // (e.g. the ・ middle dot Chinese text also uses) doesn't count.
  if (other >= MIN_HITS) return null;
  if (hans >= MIN_HITS && hans >= MIN_RATIO * hant) return 'hans';
  if (hant >= MIN_HITS && hant >= MIN_RATIO * hans) return 'hant';
  return null;
}

export function scriptLang(script: BankScript): ScriptLang {
  return script === 'hans' ? 'zh-Hans' : 'zh-Hant';
}

// Which conversion, if any, the preference asks of a bank in `script`.
export function conversionFor(script: BankScript | null, pref: ChineseScriptPref): Direction | null {
  if (script === 'hans' && pref === 'traditional') return 'toHant';
  if (script === 'hant' && pref === 'simplified') return 'toHans';
  return null;
}

// ---- Lazy OpenCC converters ------------------------------------------------
// The dictionaries (~1 MB raw for s2t) load only when a conversion is needed,
// as separate chunks the service worker precaches for offline use. Built from
// opencc-js's core + the exact dictionaries of its s2t / t2s configs, rather
// than its preset bundles, so no Taiwan/HK/Japanese tables come along.

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type Convert = (s: string) => string;

interface Slot {
  state: LoadState;
  fn: Convert | null;
  promise: Promise<void> | null;
  memo: Map<string, string>;
  bound: Convert; // stable memoizing wrapper, valid once ready
}

// Distinct strings memoized per direction; cleared wholesale past this, which
// a bank's worth of labels and the questions of one session stay well under.
const MEMO_LIMIT = 4000;

const identity: Convert = (s) => s;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version += 1;
  for (const l of listeners) l();
}

function makeSlot(): Slot {
  const slot: Slot = {
    state: 'idle',
    fn: null,
    promise: null,
    memo: new Map(),
    bound: (s) => {
      if (!slot.fn || s === '') return s;
      const hit = slot.memo.get(s);
      if (hit !== undefined) return hit;
      const out = slot.fn(s);
      if (slot.memo.size >= MEMO_LIMIT) slot.memo.clear();
      slot.memo.set(s, out);
      return out;
    },
  };
  return slot;
}

const slots: Record<Direction, Slot> = { toHant: makeSlot(), toHans: makeSlot() };

async function loadToHant(): Promise<Convert> {
  const [{ ConverterFactory }, cjk, phrases, regional, chars] = await Promise.all([
    import('opencc-js/core'),
    import('opencc-js/dict/CJK_Compatibility_Ideographs'),
    import('opencc-js/dict/STPhrases'),
    import('opencc-js/dict/STPhrases_GeneratedFromRegionalPhrases'),
    import('opencc-js/dict/STCharacters'),
  ]);
  // Same chain as opencc-js's s2t config: normalize, then phrases before characters.
  const normalize = ConverterFactory([cjk.default]);
  const convert = ConverterFactory([phrases.default, regional.default, chars.default]);
  return (s) => convert(normalize(s));
}

async function loadToHans(): Promise<Convert> {
  const [{ ConverterFactory }, cjk, phrases, chars] = await Promise.all([
    import('opencc-js/core'),
    import('opencc-js/dict/CJK_Compatibility_Ideographs'),
    import('opencc-js/dict/TSPhrases'),
    import('opencc-js/dict/TSCharacters'),
  ]);
  // opencc-js's t2s config.
  const normalize = ConverterFactory([cjk.default]);
  const convert = ConverterFactory([phrases.default, chars.default]);
  return (s) => convert(normalize(s));
}

// Load (or retry after a failure) the converter for one direction. Resolves
// once it is ready; rejects if the chunk can't be fetched (offline before the
// service worker cached it), leaving the state 'error' so a later call retries.
export function ensureConverterLoaded(dir: Direction): Promise<void> {
  const slot = slots[dir];
  if (slot.state === 'ready') return Promise.resolve();
  if (slot.promise) return slot.promise;
  slot.state = 'loading';
  notify();
  slot.promise = (dir === 'toHant' ? loadToHant() : loadToHans()).then(
    (fn) => {
      slot.fn = fn;
      slot.state = 'ready';
      slot.promise = null;
      notify();
    },
    (err: unknown) => {
      slot.state = 'error';
      slot.promise = null;
      notify();
      throw err;
    },
  );
  return slot.promise;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getVersion = () => version;

export interface ScriptConverter {
  convert: Convert;
  // The script bank text is displayed in, for `lang` (undefined: not Chinese
  // or unknown script).
  lang: ScriptLang | undefined;
  // false while the needed converter is still loading (or failed): `convert`
  // is the identity until then.
  ready: boolean;
  failed: boolean;
}

// Pure core of the hook, for a given bank script and preference.
export function scriptConverter(script: BankScript | null, pref: ChineseScriptPref): ScriptConverter {
  const dir = conversionFor(script, pref);
  if (!dir) return { convert: identity, lang: script ? scriptLang(script) : undefined, ready: true, failed: false };
  const slot = slots[dir];
  if (slot.state === 'ready') {
    return { convert: slot.bound, lang: dir === 'toHant' ? 'zh-Hant' : 'zh-Hans', ready: true, failed: false };
  }
  return { convert: identity, lang: script ? scriptLang(script) : undefined, ready: false, failed: slot.state === 'error' };
}

// The service worker does not precache the dictionaries (English-only users
// would pay for them); it caches them on first fetch. So once a Chinese bank is
// open, fetch the dictionaries this bank could need in idle time — just the
// module download, not building the converter — so the 简体/繁體 switch works
// offline later even if it was never used online. Once per direction.
const prefetched = new Set<Direction>();

function prefetchDictionaries(dir: Direction): void {
  if (prefetched.has(dir) || slots[dir].state !== 'idle') return;
  prefetched.add(dir);
  const run = () => {
    const mods = dir === 'toHant'
      ? [
          import('opencc-js/core'),
          import('opencc-js/dict/CJK_Compatibility_Ideographs'),
          import('opencc-js/dict/STPhrases'),
          import('opencc-js/dict/STPhrases_GeneratedFromRegionalPhrases'),
          import('opencc-js/dict/STCharacters'),
        ]
      : [
          import('opencc-js/core'),
          import('opencc-js/dict/CJK_Compatibility_Ideographs'),
          import('opencc-js/dict/TSPhrases'),
          import('opencc-js/dict/TSCharacters'),
        ];
    // Offline or blocked: forget it so a later visit tries again.
    Promise.all(mods).catch(() => prefetched.delete(dir));
  };
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 10_000 });
  else setTimeout(run, 3_000);
}

// The display converter for the ACTIVE bank under the current preference.
// Kicks off the lazy load when needed and re-renders once it lands.
export function useScriptConverter(): ScriptConverter {
  const pref = usePrefs().chineseScript;
  useSyncExternalStore(subscribe, getVersion, getVersion);
  // Live binding, read in render like the rest of the dataset.
  const script = activeBankScript;
  const dir = conversionFor(script, pref);
  const idle = dir !== null && slots[dir].state === 'idle';
  useEffect(() => {
    // A failed load is retried from Settings, not on every render.
    if (dir && idle) ensureConverterLoaded(dir).catch(() => {});
  }, [dir, idle]);
  // The direction this bank would convert to if the user switched scripts.
  const warm: Direction | null = script === 'hans' ? 'toHant' : script === 'hant' ? 'toHans' : null;
  useEffect(() => {
    if (warm && typeof window !== 'undefined') prefetchDictionaries(warm);
  }, [warm]);
  return scriptConverter(script, pref);
}

// Test hook: forget loaded converters and memoized strings.
export function __resetConvertersForTests(): void {
  for (const d of ['toHant', 'toHans'] as const) slots[d] = makeSlot();
  notify();
}
