// Decides WHEN a downloaded app update is applied. The service worker reports a
// waiting update; applying it reloads the page, so it waits until the user is
// not inside a session or exam (in-progress sessions live only in memory).

let pending: (() => void) | null = null;
let safe = true;

function maybeApply() {
  if (!pending || !safe) return;
  const apply = pending;
  pending = null;
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

export function __resetUpdateGateForTests(): void {
  pending = null;
  safe = true;
}
