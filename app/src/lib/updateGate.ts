// Decides WHEN a downloaded app update is applied. The service worker reports a
// waiting update; applying it reloads the page, so it waits until the user is
// not inside a session or exam (in-progress sessions live only in memory).

const FLAG = 'quizer.updated';

let pending: (() => void) | null = null;
let safe = true;

function maybeApply() {
  if (!pending || !safe) return;
  const apply = pending;
  pending = null;
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    // Storage blocked: the update still applies, just without the notice.
  }
  apply();
}

// A new version is installed and waiting; `apply` activates it and reloads.
export function offerUpdate(apply: () => void): void {
  pending = apply;
  maybeApply();
}

// Called by the app shell: true on home/analysis screens, false during a session or exam.
export function setUpdateSafe(isSafe: boolean): void {
  safe = isSafe;
  maybeApply();
}

// True once, on the first load after an update was applied.
export function consumeUpdatedFlag(): boolean {
  try {
    const hit = sessionStorage.getItem(FLAG) === '1';
    if (hit) sessionStorage.removeItem(FLAG);
    return hit;
  } catch {
    return false;
  }
}

// Read once at startup (not in render, so StrictMode's double render can't eat it).
export const justUpdated = consumeUpdatedFlag();

export function __resetUpdateGateForTests(): void {
  pending = null;
  safe = true;
}
