import { describe, expect, it, beforeEach } from 'vitest';
import { applyDataset } from './dataset';
import { buildPool, poolCount } from './pools';
import type { Question, ProgressStore, QuestionProgress } from '../types';

function makeQuestion(id: string, opts: Partial<Question> = {}): Question {
  return {
    qid: `bank:${id}`, bankId: 'bank', localId: id, number: Number(id),
    type: 'single', prompt: `Q${id}`, promptImage: null,
    options: [{ label: 'A', text: 'a', image: null }, { label: 'B', text: 'b', image: null }],
    correct: ['A'], explanation: null,
    category: 1, categoryName: 'Cat1', paper: 'Paper1', topic: 'Topic1', difficulty: null,
    ...opts,
  };
}

const questions = [
  makeQuestion('1', { paper: 'P1', category: 1, topic: 'Auth' }),
  makeQuestion('2', { paper: 'P1', category: 1, topic: 'Auth' }),
  makeQuestion('3', { paper: 'P2', category: 2, topic: 'Net' }),
  makeQuestion('4', { paper: 'P2', category: 2, topic: 'Net' }),
  makeQuestion('5', { paper: 'P2', category: null, categoryName: null, topic: null }),
];

const emptyStore: ProgressStore = { questions: {}, settings: { examCount: 5, examMinutes: 10 } };

function withProgress(qids: string[], correct: boolean, extra?: Partial<QuestionProgress>): ProgressStore {
  const qs: Record<string, QuestionProgress> = {};
  for (const qid of qids) {
    qs[qid] = {
      attempts: [{ t: 1000, choice: ['A'], correct, mode: 'drill' }],
      flagged: false, srs: null,
      ...extra,
    };
  }
  return { questions: qs, settings: { examCount: 5, examMinutes: 10 } };
}

beforeEach(() => {
  applyDataset({
    installedId: 'bank',
    moduleLabel: 'Test',
    questions,
    questionsById: new Map(questions.map((q) => [q.qid, q])),
    categories: [{ id: 1, name: 'Cat1' }, { id: 2, name: 'Cat2' }],
    papers: ['P1', 'P2'],
  });
});

describe('buildPool filters', () => {
  it('kind: all returns all questions', () => {
    const pool = buildPool(emptyStore, { filter: { kind: 'all' } });
    expect(pool.length).toBe(5);
  });

  it('kind: paper filters by paper', () => {
    const pool = buildPool(emptyStore, { filter: { kind: 'paper', value: 'P1' } });
    expect(pool.length).toBe(2);
    expect(pool.every((q) => q.paper === 'P1')).toBe(true);
  });

  it('kind: category filters by category id', () => {
    const pool = buildPool(emptyStore, { filter: { kind: 'category', value: 2 } });
    expect(pool.length).toBe(2);
  });

  it('kind: category null matches uncategorized', () => {
    const pool = buildPool(emptyStore, { filter: { kind: 'category', value: null } });
    expect(pool.length).toBe(1);
    expect(pool[0].qid).toBe('bank:5');
  });

  it('kind: topic filters by topic', () => {
    const pool = buildPool(emptyStore, { filter: { kind: 'topic', value: 'Auth' } });
    expect(pool.length).toBe(2);
  });

  it('kind: unseen returns questions with no attempts', () => {
    const store = withProgress(['bank:1', 'bank:2'], true);
    const pool = buildPool(store, { filter: { kind: 'unseen' } });
    expect(pool.length).toBe(3);
    expect(pool.every((q) => !store.questions[q.qid])).toBe(true);
  });

  it('kind: wrong returns questions where last attempt was wrong', () => {
    const store = withProgress(['bank:1'], false);
    const pool = buildPool(store, { filter: { kind: 'wrong' } });
    expect(pool.length).toBe(1);
    expect(pool[0].qid).toBe('bank:1');
  });

  it('kind: everWrong returns questions that were ever answered wrong', () => {
    const store: ProgressStore = {
      questions: {
        'bank:1': {
          attempts: [
            { t: 1, choice: ['B'], correct: false, mode: 'drill' },
            { t: 2, choice: ['A'], correct: true, mode: 'drill' },
          ],
          flagged: false, srs: null,
        },
      },
      settings: { examCount: 5, examMinutes: 10 },
    };
    const pool = buildPool(store, { filter: { kind: 'everWrong' } });
    expect(pool.length).toBe(1);
    expect(pool[0].qid).toBe('bank:1');
  });

  it('kind: flagged returns flagged questions', () => {
    const store = withProgress(['bank:3'], true, { flagged: true });
    const pool = buildPool(store, { filter: { kind: 'flagged' } });
    expect(pool.length).toBe(1);
    expect(pool[0].qid).toBe('bank:3');
  });

  it('kind: due returns questions with SRS due <= now', () => {
    const store: ProgressStore = {
      questions: {
        'bank:1': { attempts: [], flagged: false, srs: { reps: 1, ease: 2.5, intervalDays: 1, due: 1 } },
        'bank:2': { attempts: [], flagged: false, srs: { reps: 1, ease: 2.5, intervalDays: 1, due: Date.now() + 999999 } },
      },
      settings: { examCount: 5, examMinutes: 10 },
    };
    const pool = buildPool(store, { filter: { kind: 'due' } });
    expect(pool.length).toBe(1);
    expect(pool[0].qid).toBe('bank:1');
  });
});

describe('AND filter', () => {
  it('combines two filters with AND logic', () => {
    const store = withProgress(['bank:1'], false);
    const pool = buildPool(store, { filter: { kind: 'paper', value: 'P1' }, and: { kind: 'wrong' } });
    expect(pool.length).toBe(1);
    expect(pool[0].qid).toBe('bank:1');
  });
});

describe('shuffle determinism', () => {
  it('same seed produces same order', () => {
    const a = buildPool(emptyStore, { filter: { kind: 'all' }, shuffle: true, seed: 42 });
    const b = buildPool(emptyStore, { filter: { kind: 'all' }, shuffle: true, seed: 42 });
    expect(a.map((q) => q.qid)).toEqual(b.map((q) => q.qid));
  });

  it('different seeds produce different orders', () => {
    const a = buildPool(emptyStore, { filter: { kind: 'all' }, shuffle: true, seed: 42 });
    const b = buildPool(emptyStore, { filter: { kind: 'all' }, shuffle: true, seed: 99 });
    const same = a.every((q, i) => q.qid === b[i].qid);
    expect(same).toBe(false);
  });
});

describe('limit', () => {
  it('limits output size', () => {
    const pool = buildPool(emptyStore, { filter: { kind: 'all' }, limit: 2 });
    expect(pool.length).toBe(2);
  });
});

describe('poolCount', () => {
  it('counts matching questions without building the full array', () => {
    expect(poolCount(emptyStore, { kind: 'all' })).toBe(5);
    expect(poolCount(emptyStore, { kind: 'paper', value: 'P2' })).toBe(3);
  });
});
