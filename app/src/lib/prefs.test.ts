import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { __resetPrefsForTests, getPrefs, PREFS_KEY, setPref, subscribePrefs, usePrefs } from './prefs';

// Minimal in-memory Storage; vitest runs in node, which has no localStorage.
function memoryStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    data,
  };
}

const DEFAULTS = { aiAlwaysExpanded: true, chineseScript: 'original' };

const throwing = {
  getItem: () => { throw new Error('SecurityError'); },
  setItem: () => { throw new Error('QuotaExceededError'); },
};

beforeEach(() => __resetPrefsForTests());
afterEach(() => vi.unstubAllGlobals());

describe('prefs', () => {
  it('defaults aiAlwaysExpanded to true when nothing is stored', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    expect(getPrefs()).toEqual(DEFAULTS);
  });

  it('persists a change under quizer.prefs.v1 and reads it back on a fresh load', () => {
    const ls = memoryStorage();
    vi.stubGlobal('localStorage', ls);
    setPref('aiAlwaysExpanded', false);
    expect(PREFS_KEY).toBe('quizer.prefs.v1');
    expect(JSON.parse(ls.data.get('quizer.prefs.v1') ?? 'null')).toEqual({ aiAlwaysExpanded: false, chineseScript: 'original' });
    __resetPrefsForTests();
    expect(getPrefs().aiAlwaysExpanded).toBe(false);
  });

  it('falls back to defaults on corrupt or wrongly shaped JSON', () => {
    for (const raw of ['{not json', '[]', 'true', 'null', '{"aiAlwaysExpanded":"no"}']) {
      __resetPrefsForTests();
      vi.stubGlobal('localStorage', memoryStorage({ [PREFS_KEY]: raw }));
      expect(getPrefs(), raw).toEqual(DEFAULTS);
    }
  });

  it('falls back to defaults when storage throws, and still applies changes in memory', () => {
    vi.stubGlobal('localStorage', throwing);
    expect(getPrefs()).toEqual(DEFAULTS);
    expect(() => setPref('aiAlwaysExpanded', false)).not.toThrow();
    expect(getPrefs().aiAlwaysExpanded).toBe(false);
  });

  it('falls back to defaults when even touching localStorage throws', () => {
    const g = globalThis as Record<string, unknown>;
    const had = Object.getOwnPropertyDescriptor(g, 'localStorage');
    Object.defineProperty(g, 'localStorage', { configurable: true, get: () => { throw new Error('SecurityError'); } });
    try {
      expect(getPrefs()).toEqual(DEFAULTS);
      expect(() => setPref('aiAlwaysExpanded', false)).not.toThrow();
      expect(getPrefs().aiAlwaysExpanded).toBe(false);
    } finally {
      if (had) Object.defineProperty(g, 'localStorage', had);
      else delete g.localStorage;
    }
  });

  it('works with no localStorage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(getPrefs()).toEqual(DEFAULTS);
  });

  it('keeps a stable snapshot until a change, and notifies subscribers only on change', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const first = getPrefs();
    expect(getPrefs()).toBe(first);
    const seen: boolean[] = [];
    const unsubscribe = subscribePrefs(() => seen.push(getPrefs().aiAlwaysExpanded));
    setPref('aiAlwaysExpanded', true); // unchanged: no notification, same snapshot
    expect(getPrefs()).toBe(first);
    setPref('aiAlwaysExpanded', false);
    expect(getPrefs()).not.toBe(first);
    unsubscribe();
    setPref('aiAlwaysExpanded', true);
    expect(seen).toEqual([false]);
  });

  it('defaults chineseScript to original and round-trips each value', () => {
    const ls = memoryStorage();
    vi.stubGlobal('localStorage', ls);
    expect(getPrefs().chineseScript).toBe('original');
    for (const v of ['traditional', 'simplified', 'original'] as const) {
      setPref('chineseScript', v);
      __resetPrefsForTests();
      expect(getPrefs().chineseScript).toBe(v);
    }
  });

  it('drops an unknown chineseScript value without losing the other fields', () => {
    for (const bad of ['"zh-Hant"', '1', 'null', '"Traditional"']) {
      __resetPrefsForTests();
      vi.stubGlobal('localStorage', memoryStorage({ [PREFS_KEY]: `{"aiAlwaysExpanded":false,"chineseScript":${bad}}` }));
      expect(getPrefs(), bad).toEqual({ aiAlwaysExpanded: false, chineseScript: 'original' });
    }
    __resetPrefsForTests();
    vi.stubGlobal('localStorage', memoryStorage({ [PREFS_KEY]: '{"aiAlwaysExpanded":"no","chineseScript":"traditional"}' }));
    expect(getPrefs()).toEqual({ aiAlwaysExpanded: true, chineseScript: 'traditional' });
  });

  it('usePrefs renders the current value', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const Probe = () => createElement('span', null, String(usePrefs().aiAlwaysExpanded));
    expect(renderToString(createElement(Probe))).toBe('<span>true</span>');
    setPref('aiAlwaysExpanded', false);
    expect(renderToString(createElement(Probe))).toBe('<span>false</span>');
  });
});
