import { describe, expect, it, beforeEach } from 'vitest';
import { applyDataset } from './dataset';
import type { Question, ProgressStore, QuestionProgress } from '../types';
import {
  overall, learningMix, readiness, statusOf, byCategory, byTopic,
  mostFailedTopics, isSeen, lastCorrect, everWrong, MASTERED_INTERVAL_DAYS,
} from './stats';

function makeQuestion(id: string, opts: Partial<Question> = {}): Question {
  return {
    qid: `bank:${id}`, bankId: 'bank', localId: id, number: 1,
    type: 'single', prompt: `Q${id}`, promptImage: null,
    options: [{ label: 'A', text: 'a', image: null }],
    correct: ['A'], explanation: null,
    category: 1, categoryName: 'Cat1', paper: null, topic: 'Topic1', difficulty: null,
    ...opts,
  };
}

function makeProgress(correct: boolean, mode: 'drill' | 'exam' | 'review' | 'srs' = 'drill'): QuestionProgress {
  return { attempts: [{ t: 1000, choice: ['A'], correct, mode }], flagged: false, srs: null };
}

const questions = [
  makeQuestion('1', { category: 1, categoryName: 'Security', topic: 'Auth' }),
  makeQuestion('2', { category: 1, categoryName: 'Security', topic: 'Auth' }),
  makeQuestion('3', { category: 2, categoryName: 'Network', topic: 'TCP' }),
  makeQuestion('4', { category: 2, categoryName: 'Network', topic: 'TCP' }),
  makeQuestion('5', { category: 2, categoryName: 'Network', topic: 'TCP' }),
];

beforeEach(() => {
  applyDataset({
    installedId: 'bank',
    moduleLabel: 'Test Bank',
    questions,
    questionsById: new Map(questions.map((q) => [q.qid, q])),
    categories: [{ id: 1, name: 'Security' }, { id: 2, name: 'Network' }],
    papers: [],
  });
});

describe('isSeen / lastCorrect / everWrong', () => {
  it('isSeen returns false for undefined or empty attempts', () => {
    expect(isSeen(undefined)).toBe(false);
    expect(isSeen({ attempts: [], flagged: false, srs: null })).toBe(false);
  });

  it('isSeen returns true when attempts exist', () => {
    expect(isSeen(makeProgress(true))).toBe(true);
  });

  it('lastCorrect returns null for unseen', () => {
    expect(lastCorrect(undefined)).toBe(null);
  });

  it('lastCorrect returns the correctness of last attempt', () => {
    const p: QuestionProgress = {
      attempts: [
        { t: 1, choice: ['A'], correct: true, mode: 'drill' },
        { t: 2, choice: ['B'], correct: false, mode: 'drill' },
      ],
      flagged: false, srs: null,
    };
    expect(lastCorrect(p)).toBe(false);
  });

  it('everWrong detects any wrong attempt', () => {
    const p: QuestionProgress = {
      attempts: [
        { t: 1, choice: ['A'], correct: true, mode: 'drill' },
        { t: 2, choice: ['A'], correct: false, mode: 'drill' },
        { t: 3, choice: ['A'], correct: true, mode: 'drill' },
      ],
      flagged: false, srs: null,
    };
    expect(everWrong(p)).toBe(true);
    expect(everWrong(makeProgress(true))).toBe(false);
  });
});

describe('overall', () => {
  it('returns zeros for empty progress', () => {
    const s: ProgressStore = { questions: {}, settings: { examCount: 5, examMinutes: 10 } };
    const o = overall(s);
    expect(o.total).toBe(5);
    expect(o.seen).toBe(0);
    expect(o.accuracy).toBe(null);
  });

  it('computes accuracy from last attempts', () => {
    const s: ProgressStore = {
      questions: {
        'bank:1': makeProgress(true),
        'bank:2': makeProgress(false),
        'bank:3': makeProgress(true),
      },
      settings: { examCount: 5, examMinutes: 10 },
    };
    const o = overall(s);
    expect(o.seen).toBe(3);
    expect(o.correct).toBe(2);
    expect(o.wrong).toBe(1);
    expect(o.accuracy).toBeCloseTo(2 / 3);
  });

  it('counts flagged and due', () => {
    const s: ProgressStore = {
      questions: {
        'bank:1': { ...makeProgress(true), flagged: true },
        'bank:2': { ...makeProgress(true), srs: { reps: 1, ease: 2.5, intervalDays: 1, due: 100 } },
      },
      settings: { examCount: 5, examMinutes: 10 },
    };
    const o = overall(s, 200);
    expect(o.flagged).toBe(1);
    expect(o.due).toBe(1);
  });
});

describe('learningMix / statusOf', () => {
  it('all questions are new with empty progress', () => {
    const mix = learningMix({ questions: {}, settings: { examCount: 5, examMinutes: 10 } });
    expect(mix.new).toBe(5);
    expect(mix.learning).toBe(0);
    expect(mix.mastered).toBe(0);
  });

  it('statusOf returns mastered when interval >= threshold', () => {
    const p: QuestionProgress = {
      attempts: [{ t: 1, choice: ['A'], correct: true, mode: 'drill' }],
      flagged: false,
      srs: { reps: 5, ease: 2.5, intervalDays: MASTERED_INTERVAL_DAYS, due: 99999 },
    };
    expect(statusOf(p)).toBe('mastered');
  });

  it('statusOf returns learning when seen but interval < threshold', () => {
    const p: QuestionProgress = {
      attempts: [{ t: 1, choice: ['A'], correct: true, mode: 'drill' }],
      flagged: false,
      srs: { reps: 2, ease: 2.5, intervalDays: 6, due: 99999 },
    };
    expect(statusOf(p)).toBe('learning');
  });
});

describe('readiness', () => {
  it('returns "Building" for empty progress (0%)', () => {
    const r = readiness({ questions: {}, settings: { examCount: 5, examMinutes: 10 } });
    expect(r.pct).toBe(0);
    expect(r.label).toBe('Building');
  });

  it('returns "On track" at 30% mastered', () => {
    const mastered: QuestionProgress = {
      attempts: [{ t: 1, choice: ['A'], correct: true, mode: 'drill' }],
      flagged: false,
      srs: { reps: 5, ease: 2.5, intervalDays: MASTERED_INTERVAL_DAYS, due: 99999 },
    };
    // 2 of 5 = 40% → "On track" (>= 0.3, < 0.6)
    const s: ProgressStore = {
      questions: { 'bank:1': mastered, 'bank:2': mastered },
      settings: { examCount: 5, examMinutes: 10 },
    };
    expect(readiness(s).label).toBe('On track');
  });

  it('returns "Strong" at 60% mastered', () => {
    const mastered: QuestionProgress = {
      attempts: [{ t: 1, choice: ['A'], correct: true, mode: 'drill' }],
      flagged: false,
      srs: { reps: 5, ease: 2.5, intervalDays: MASTERED_INTERVAL_DAYS, due: 99999 },
    };
    // 3 of 5 = 60% → "Strong" (>= 0.6, < 0.85)
    const s: ProgressStore = {
      questions: { 'bank:1': mastered, 'bank:2': mastered, 'bank:3': mastered },
      settings: { examCount: 5, examMinutes: 10 },
    };
    expect(readiness(s).label).toBe('Strong');
  });

  it('returns "Exam-ready" when 85%+ mastered', () => {
    const mastered: QuestionProgress = {
      attempts: [{ t: 1, choice: ['A'], correct: true, mode: 'drill' }],
      flagged: false,
      srs: { reps: 5, ease: 2.5, intervalDays: MASTERED_INTERVAL_DAYS, due: 99999 },
    };
    const s: ProgressStore = {
      questions: Object.fromEntries(questions.map((q) => [q.qid, mastered])),
      settings: { examCount: 5, examMinutes: 10 },
    };
    expect(readiness(s).label).toBe('Exam-ready');
  });
});

describe('byCategory', () => {
  it('groups questions by category with accuracy', () => {
    const s: ProgressStore = {
      questions: {
        'bank:1': makeProgress(true),
        'bank:2': makeProgress(false),
      },
      settings: { examCount: 5, examMinutes: 10 },
    };
    const cats = byCategory(s);
    expect(cats.length).toBe(2);
    const sec = cats.find((c) => c.label === 'Security')!;
    expect(sec.total).toBe(2);
    expect(sec.seen).toBe(2);
    expect(sec.accuracy).toBeCloseTo(0.5);
  });
});

describe('byTopic', () => {
  it('groups questions by topic', () => {
    const s: ProgressStore = { questions: {}, settings: { examCount: 5, examMinutes: 10 } };
    const topics = byTopic(s);
    expect(topics.length).toBe(2);
    expect(topics.find((t) => t.label === 'Auth')!.total).toBe(2);
    expect(topics.find((t) => t.label === 'TCP')!.total).toBe(3);
  });
});

describe('mostFailedTopics', () => {
  it('only includes topics with >= 3 questions that have wrongs', () => {
    const s: ProgressStore = {
      questions: {
        'bank:3': makeProgress(false),
        'bank:4': makeProgress(false),
        'bank:5': makeProgress(true),
      },
      settings: { examCount: 5, examMinutes: 10 },
    };
    const failed = mostFailedTopics(s);
    expect(failed.length).toBe(1);
    expect(failed[0].label).toBe('TCP');
    expect(failed[0].wrong).toBe(2);
  });

  it('excludes topics with < 3 questions', () => {
    const s: ProgressStore = {
      questions: {
        'bank:1': makeProgress(false),
        'bank:2': makeProgress(false),
      },
      settings: { examCount: 5, examMinutes: 10 },
    };
    const failed = mostFailedTopics(s);
    expect(failed.find((t) => t.label === 'Auth')).toBeUndefined();
  });
});
