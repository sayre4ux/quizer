import { describe, expect, it } from 'vitest';
import { compareVersions, entriesToShow } from './whatsNew';
import { CHANGELOG } from '../changelog';

const log = [
  { version: '0.4.0', items: ['d'] },
  { version: '0.3.0', items: ['c'] },
  { version: '0.2.0', items: ['b'] },
];

describe('compareVersions', () => {
  it('orders numerically, not lexically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('0.2.0', '0.2.0')).toBe(0);
    expect(compareVersions('0.2', '0.2.0')).toBe(0);
    expect(compareVersions('1.0.0', '0.99.9')).toBeGreaterThan(0);
  });
});

describe('entriesToShow', () => {
  it('fresh install with no banks shows nothing', () => {
    expect(entriesToShow(log, '0.4.0', null, false)).toEqual([]);
  });

  it('existing user without a recorded version sees only the current release', () => {
    expect(entriesToShow(log, '0.4.0', null, true).map((e) => e.version)).toEqual(['0.4.0']);
  });

  it('shows every release newer than the last seen, up to the running one', () => {
    expect(entriesToShow(log, '0.4.0', '0.2.0', true).map((e) => e.version)).toEqual(['0.4.0', '0.3.0']);
    expect(entriesToShow(log, '0.3.0', '0.2.0', true).map((e) => e.version)).toEqual(['0.3.0']);
  });

  it('shows nothing when already seen', () => {
    expect(entriesToShow(log, '0.4.0', '0.4.0', true)).toEqual([]);
  });

  it('the shipped changelog has an entry for the app version', () => {
    expect(CHANGELOG.some((e) => e.version === __APP_VERSION__)).toBe(true);
  });
});
