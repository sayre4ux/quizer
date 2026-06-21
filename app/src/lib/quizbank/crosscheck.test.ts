import { describe, it, expect } from 'vitest';
import { crossCheckLedger } from '../../../../quizbank-author/scripts/lib/validate-core.mjs';

// The packager's structural ledger<->manifest cross-check (Codex P1).
const manifest = {
  questions: [
    { id: 'q1', correct: ['A'] },
    { id: 'q2', correct: ['A', 'B'] },
  ],
};

describe('crossCheckLedger', () => {
  it('passes when every question has a matching ok row', () => {
    const report = {
      items: [
        { id: 'q1', status: 'ok', mappedCorrect: ['A'] },
        { id: 'q2', status: 'ok', mappedCorrect: ['B', 'A'] }, // order-insensitive
        { id: 'q9', status: 'unresolved', mappedCorrect: [], reason: 'no answer' },
      ],
    };
    expect(crossCheckLedger(manifest, report).ok).toBe(true);
  });

  it('accepts a bare array of rows', () => {
    const rows = [{ id: 'q1', status: 'ok', mappedCorrect: ['A'] }, { id: 'q2', status: 'ok', mappedCorrect: ['A', 'B'] }];
    expect(crossCheckLedger(manifest, rows).ok).toBe(true);
  });

  it('rejects a string mappedCorrect instead of treating it as a char set (Codex P1)', () => {
    // "AB" iterates to {"A","B"}, which would spuriously satisfy correct: ["A","B"].
    const report = { items: [{ id: 'q1', status: 'ok', mappedCorrect: ['A'] }, { id: 'q2', status: 'ok', mappedCorrect: 'AB' }] };
    const r = crossCheckLedger(manifest, report);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/q2.*array of strings/i);
  });

  it('rejects a non-string element in mappedCorrect', () => {
    const report = { items: [{ id: 'q1', status: 'ok', mappedCorrect: [1] }, { id: 'q2', status: 'ok', mappedCorrect: ['A', 'B'] }] };
    const r = crossCheckLedger(manifest, report);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/q1.*array of strings/i);
  });

  it('fails when mappedCorrect != manifest correct', () => {
    const report = { items: [{ id: 'q1', status: 'ok', mappedCorrect: ['B'] }, { id: 'q2', status: 'ok', mappedCorrect: ['A', 'B'] }] };
    const r = crossCheckLedger(manifest, report);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/q1.*does not equal/i);
  });

  it('fails when a manifest question has no ok row', () => {
    const report = { items: [{ id: 'q1', status: 'ok', mappedCorrect: ['A'] }] };
    expect(crossCheckLedger(manifest, report).ok).toBe(false);
  });

  it('fails when a non-ok row appears in the manifest', () => {
    const report = {
      items: [
        { id: 'q1', status: 'ok', mappedCorrect: ['A'] },
        { id: 'q2', status: 'ok', mappedCorrect: ['A', 'B'] },
        { id: 'q1', status: 'dropped-by-user', mappedCorrect: [] },
      ],
    };
    expect(crossCheckLedger(manifest, report).ok).toBe(false);
  });

  it('fails when the report has no items', () => {
    expect(crossCheckLedger(manifest, { nope: true }).ok).toBe(false);
  });
});
