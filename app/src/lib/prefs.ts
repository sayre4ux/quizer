import { useSyncExternalStore } from 'react';

// App-wide display preferences. They live in localStorage, not the per-bank IDB
// progress, because they apply across banks and before any bank is active.
// Storage can be unavailable or throw (private mode, quota, sandboxed frames),
// so every access is guarded and the in-memory value is the source of truth.

export type ChineseScriptPref = 'original' | 'simplified' | 'traditional';

export interface Prefs {
  aiAlwaysExpanded: boolean;
  chineseScript: ChineseScriptPref;
}

const SCRIPT_PREFS: readonly ChineseScriptPref[] = ['original', 'simplified', 'traditional'];

export const PREFS_KEY = 'quizer.prefs.v1';
export const DEFAULT_PREFS: Readonly<Prefs> = Object.freeze({ aiAlwaysExpanded: true, chineseScript: 'original' });

let current: Prefs | null = null;
const listeners = new Set<() => void>();

function readStored(): Prefs {
  try {
    const raw = globalThis.localStorage?.getItem(PREFS_KEY);
    if (raw != null) {
      const v: unknown = JSON.parse(raw);
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        const o = v as Record<string, unknown>;
        // Field by field, so one bad value doesn't discard the rest.
        return {
          aiAlwaysExpanded: typeof o.aiAlwaysExpanded === 'boolean' ? o.aiAlwaysExpanded : DEFAULT_PREFS.aiAlwaysExpanded,
          chineseScript: SCRIPT_PREFS.find((v) => v === o.chineseScript) ?? DEFAULT_PREFS.chineseScript,
        };
      }
    }
  } catch {
    // Unavailable storage or corrupt JSON: fall through to defaults.
  }
  return { ...DEFAULT_PREFS };
}

// Stable reference between changes, as useSyncExternalStore requires.
export function getPrefs(): Prefs {
  current ??= readStored();
  return current;
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]): void {
  const prev = getPrefs();
  if (prev[key] === value) return;
  current = { ...prev, [key]: value };
  try {
    globalThis.localStorage?.setItem(PREFS_KEY, JSON.stringify(current));
  } catch {
    // Keep the in-memory value for this session even if it can't be persisted.
  }
  for (const l of listeners) l();
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribePrefs, getPrefs, getPrefs);
}

// Test hook: drop the cached value so the next read goes back to storage.
export function __resetPrefsForTests(): void {
  current = null;
  listeners.clear();
}
