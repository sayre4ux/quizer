import type { SrsState } from '../types';

const DAY = 24 * 60 * 60 * 1000;

// SM-2. quality: 5 = easy/correct, 3 = correct-but-hard, <3 = missed.
export function schedule(prev: SrsState | null, quality: number, now: number): SrsState {
  let ease = prev?.ease ?? 2.5;
  let reps = prev?.reps ?? 0;
  let intervalDays: number;

  if (quality < 3) {
    reps = 0;
    intervalDays = 1;
  } else {
    reps += 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round((prev?.intervalDays ?? 6) * ease);
  }

  ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ease < 1.3) ease = 1.3;

  return { reps, ease, intervalDays, due: now + intervalDays * DAY };
}

export function isDue(srs: SrsState | null, now: number): boolean {
  if (!srs) return false;
  return srs.due <= now;
}
