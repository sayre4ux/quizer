import type { ChangelogEntry } from '../changelog';

// Which changelog entries to show, by comparing the running version with the
// last one this device has seen. Independent of how the update arrived
// (service-worker reload, cold start, or a browser visit).

const KEY = 'quizer.lastSeenVersion';

function parts(v: string): number[] {
  return v.split('.').map((n) => Number.parseInt(n, 10) || 0);
}

export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// `lastSeen` null means this device never recorded a version: a fresh install
// (no banks yet) gets nothing; an existing user gets the current release.
export function entriesToShow(
  changelog: ChangelogEntry[],
  current: string,
  lastSeen: string | null,
  hasBanks: boolean,
): ChangelogEntry[] {
  if (lastSeen === null) {
    return hasBanks ? changelog.filter((e) => e.version === current) : [];
  }
  return changelog.filter(
    (e) => compareVersions(e.version, lastSeen) > 0 && compareVersions(e.version, current) <= 0,
  );
}

export function readLastSeen(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function markSeen(version: string): void {
  try {
    localStorage.setItem(KEY, version);
  } catch {
    // Storage blocked: the sheet may show again next launch; harmless.
  }
}
