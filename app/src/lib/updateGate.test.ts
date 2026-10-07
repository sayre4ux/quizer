import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetUpdateGateForTests, offerUpdate, setUpdateSafe } from './updateGate';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

describe('updateGate', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', memoryStorage());
    __resetUpdateGateForTests();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('applies immediately when the user is not in a session', () => {
    const apply = vi.fn();
    offerUpdate(apply);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('waits during a session and applies once it ends', () => {
    const apply = vi.fn();
    setUpdateSafe(false);
    offerUpdate(apply);
    expect(apply).not.toHaveBeenCalled();
    setUpdateSafe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    setUpdateSafe(false);
    setUpdateSafe(true);
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
