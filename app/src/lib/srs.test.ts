import { describe, expect, it } from 'vitest';
import { isDue, schedule } from './srs';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

describe('schedule', () => {
  it('first correct answer: interval = 1 day, reps = 1', () => {
    const s = schedule(null, 5, NOW);
    expect(s.reps).toBe(1);
    expect(s.intervalDays).toBe(1);
    expect(s.due).toBe(NOW + 1 * DAY);
  });

  it('second correct answer: interval = 6 days, reps = 2', () => {
    const first = schedule(null, 5, NOW);
    const second = schedule(first, 5, NOW + DAY);
    expect(second.reps).toBe(2);
    expect(second.intervalDays).toBe(6);
    expect(second.due).toBe(NOW + DAY + 6 * DAY);
  });

  it('third+ correct answers scale by previous interval * ease', () => {
    const s1 = schedule(null, 5, NOW);
    const s2 = schedule(s1, 5, NOW + DAY);
    const s3 = schedule(s2, 5, NOW + 7 * DAY);
    expect(s3.reps).toBe(3);
    // interval = round(prev.intervalDays * ease), where ease is updated AFTER interval calc
    expect(s3.intervalDays).toBe(Math.round(s2.intervalDays * s2.ease));
  });

  it('quality < 3 resets reps to 0 and interval to 1', () => {
    const mature = { reps: 5, ease: 2.5, intervalDays: 30, due: NOW };
    const reset = schedule(mature, 2, NOW);
    expect(reset.reps).toBe(0);
    expect(reset.intervalDays).toBe(1);
    expect(reset.due).toBe(NOW + DAY);
  });

  it('ease never drops below 1.3', () => {
    let s = schedule(null, 3, NOW);
    for (let i = 0; i < 20; i++) {
      s = schedule(s, 0, s.due);
    }
    expect(s.ease).toBe(1.3);
  });

  it('ease increases for quality 5 answers', () => {
    const initial = schedule(null, 5, NOW);
    expect(initial.ease).toBeGreaterThan(2.5);
  });

  it('ease decreases for quality 3 (hard correct) answers', () => {
    const initial = schedule(null, 3, NOW);
    expect(initial.ease).toBeLessThan(2.5);
  });
});

describe('isDue', () => {
  it('returns false for null state', () => {
    expect(isDue(null, NOW)).toBe(false);
  });

  it('returns true when current time >= due time', () => {
    const s = schedule(null, 5, NOW);
    expect(isDue(s, s.due)).toBe(true);
    expect(isDue(s, s.due + 1000)).toBe(true);
  });

  it('returns false when current time < due time', () => {
    const s = schedule(null, 5, NOW);
    expect(isDue(s, s.due - 1)).toBe(false);
  });
});
