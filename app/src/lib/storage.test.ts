import { describe, expect, it, beforeEach } from 'vitest';
import { applyDataset } from './dataset';
import { store } from './storage';
import type { Question } from '../types';

function makeQuestion(id: string): Question {
  return {
    qid: `bank:${id}`, bankId: 'bank', localId: id, number: Number(id),
    type: 'single', prompt: `Q${id}`, promptImage: null,
    options: [{ label: 'A', text: 'a', image: null }, { label: 'B', text: 'b', image: null }],
    correct: ['A'], explanation: null,
    category: 1, categoryName: 'Cat1', paper: null, topic: null, difficulty: null,
  };
}

const questions = [makeQuestion('1'), makeQuestion('2'), makeQuestion('3')];

beforeEach(() => {
  applyDataset({
    installedId: 'bank',
    moduleLabel: 'Test',
    questions,
    questionsById: new Map(questions.map((q) => [q.qid, q])),
    categories: [{ id: 1, name: 'Cat1' }],
    papers: [],
  });
  store.adopt('bank', null);
});

describe('lifecycle guards', () => {
  it('recordAttempt is a no-op when detached (no bank, no ephemeral)', () => {
    store.detach();
    store.recordAttempt('bank:1', ['A'], true, 'drill');
    expect(store.get('bank:1')).toBeUndefined();
  });

  it('toggleFlag is a no-op when detached', () => {
    store.detach();
    store.toggleFlag('bank:1');
    expect(store.get('bank:1')).toBeUndefined();
  });

  it('setSettings is a no-op when detached', () => {
    store.detach();
    const before = store.snapshot().settings;
    store.setSettings({ examCount: 999 });
    expect(store.snapshot().settings).toEqual(before);
  });
});

describe('adopt', () => {
  it('initializes empty state when record is null', () => {
    store.adopt('bank', null);
    const snap = store.snapshot();
    expect(snap.questions).toEqual({});
    expect(snap.settings.examCount).toBeGreaterThan(0);
  });

  it('sanitizes progress: drops unknown qids', () => {
    store.adopt('bank', {
      questions: {
        'bank:1': { attempts: [{ t: 1, choice: ['A'], correct: true, mode: 'drill' }], flagged: false, srs: null },
        'bank:unknown': { attempts: [{ t: 1, choice: ['A'], correct: true, mode: 'drill' }], flagged: false, srs: null },
      },
    });
    expect(store.get('bank:1')).toBeDefined();
    expect(store.get('bank:unknown')).toBeUndefined();
  });

  it('sanitizes progress: rejects invalid attempts', () => {
    store.adopt('bank', {
      questions: {
        'bank:1': {
          attempts: [
            { t: 1, choice: ['A'], correct: true, mode: 'drill' },
            { t: 'not-a-number', choice: ['A'], correct: true, mode: 'drill' },
            { t: 2, choice: ['A'], correct: true, mode: 'invalid_mode' },
            null,
          ],
          flagged: false,
          srs: null,
        },
      },
    });
    const p = store.get('bank:1')!;
    expect(p.attempts.length).toBe(1);
    expect(p.attempts[0].t).toBe(1);
  });

  it('sanitizes SRS: rejects invalid state', () => {
    store.adopt('bank', {
      questions: {
        'bank:1': { attempts: [], flagged: false, srs: { reps: 1, ease: 'bad', intervalDays: 1, due: 1000 } },
      },
    });
    expect(store.get('bank:1')!.srs).toBe(null);
  });

  it('sanitizes SRS: clamps ease to [1.3, 5]', () => {
    store.adopt('bank', {
      questions: {
        'bank:1': { attempts: [], flagged: false, srs: { reps: 1, ease: 0.5, intervalDays: 1, due: 1000 } },
      },
    });
    expect(store.get('bank:1')!.srs!.ease).toBe(1.3);
  });

  it('sanitizes settings: clamps to valid range', () => {
    store.adopt('bank', { settings: { examCount: -5, examMinutes: 99999 } });
    const s = store.snapshot().settings;
    // With 3 questions, clamp(-5, EXAM_MIN_QUESTIONS=5, total=3) → 3 (hi wins)
    expect(s.examCount).toBe(3);
    // EXAM_MAX_MINUTES = 24*60 = 1440
    expect(s.examMinutes).toBeLessThanOrEqual(1440);
  });
});

describe('adoptEphemeral', () => {
  it('allows recording attempts in ephemeral mode', () => {
    store.adoptEphemeral();
    store.recordAttempt('bank:1', ['A'], true, 'drill');
    expect(store.get('bank:1')!.attempts.length).toBe(1);
  });
});

describe('recordAttempt', () => {
  it('records an attempt and updates SRS', () => {
    store.recordAttempt('bank:1', ['A'], true, 'drill');
    const p = store.get('bank:1')!;
    expect(p.attempts.length).toBe(1);
    expect(p.attempts[0].correct).toBe(true);
    expect(p.attempts[0].mode).toBe('drill');
    expect(p.srs).not.toBe(null);
    expect(p.srs!.reps).toBe(1);
  });

  it('does not update SRS for empty choice (unanswered in exam)', () => {
    store.recordAttempt('bank:1', [], false, 'exam');
    const p = store.get('bank:1')!;
    expect(p.attempts.length).toBe(1);
    expect(p.srs).toBe(null);
  });

  it('caps attempts at MAX_ATTEMPTS_PER_Q (100)', () => {
    for (let i = 0; i < 110; i++) {
      store.recordAttempt('bank:1', ['A'], true, 'drill');
    }
    expect(store.get('bank:1')!.attempts.length).toBe(100);
  });

  it('notifies subscribers on state change', () => {
    let called = 0;
    const unsub = store.subscribe(() => { called += 1; });
    store.recordAttempt('bank:1', ['A'], true, 'drill');
    expect(called).toBe(1);
    unsub();
  });
});

describe('toggleFlag', () => {
  it('toggles the flagged state', () => {
    store.toggleFlag('bank:2');
    expect(store.get('bank:2')!.flagged).toBe(true);
    store.toggleFlag('bank:2');
    expect(store.get('bank:2')!.flagged).toBe(false);
  });
});

describe('setSettings', () => {
  it('merges partial settings', () => {
    store.setSettings({ examCount: 50 });
    expect(store.snapshot().settings.examCount).toBe(50);
    expect(store.snapshot().settings.examMinutes).toBeGreaterThan(0);
  });
});

describe('resetAll', () => {
  it('clears question progress but keeps settings', () => {
    store.recordAttempt('bank:1', ['A'], true, 'drill');
    store.setSettings({ examCount: 77 });
    store.resetAll();
    expect(store.get('bank:1')).toBeUndefined();
    expect(store.snapshot().settings.examCount).toBe(77);
  });
});

describe('flush', () => {
  it('flush resolves without error in ephemeral mode (no-op)', async () => {
    store.adoptEphemeral();
    store.recordAttempt('bank:1', ['A'], true, 'drill');
    await expect(store.flush()).resolves.toBeUndefined();
  });

  it('flush resolves without error when detached (no-op)', async () => {
    store.detach();
    await expect(store.flush()).resolves.toBeUndefined();
  });
});

describe('exportJSON / importJSON', () => {
  it('round-trips progress', () => {
    store.recordAttempt('bank:1', ['A'], true, 'drill');
    store.toggleFlag('bank:2');
    const json = store.exportJSON();
    store.resetAll();
    expect(store.importJSON(json)).toBe(true);
    expect(store.get('bank:1')!.attempts.length).toBe(1);
    expect(store.get('bank:2')!.flagged).toBe(true);
  });

  it('rejects invalid JSON', () => {
    expect(store.importJSON('not json')).toBe(false);
  });

  it('rejects JSON without questions object', () => {
    expect(store.importJSON('{"foo": "bar"}')).toBe(false);
  });

  it.each(['null', '[]'])('rejects questions=%s without erasing existing progress', (questionsJson) => {
    store.recordAttempt('bank:1', ['A'], true, 'drill');
    expect(store.importJSON(`{"questions": ${questionsJson}}`)).toBe(false);
    expect(store.get('bank:1')!.attempts.length).toBe(1);
  });

  it('returns false when no bank is installed', () => {
    store.detach();
    expect(store.importJSON('{"questions": {}}')).toBe(false);
  });
});
