import { describe, expect, it } from 'vitest';
import { aiDefaultOpen, aiStatus } from './aiStatus';
import type { QuestionAi } from '../types';

const ai = (answer: string[], doubt = false): QuestionAi => ({ answer, explanation: 'e', doubt });

describe('aiStatus', () => {
  it('none when the question has no ai', () => {
    expect(aiStatus({ ai: null, correct: ['A'] })).toBe('none');
  });
  it('agrees when the AI answer equals the key and there is no doubt', () => {
    expect(aiStatus({ ai: ai(['A']), correct: ['A'] })).toBe('agrees');
  });
  it('doubts when the AI answer equals the key but doubt is set', () => {
    expect(aiStatus({ ai: ai(['A'], true), correct: ['A'] })).toBe('doubts');
  });
  it('differs when the answers differ, whatever the doubt flag', () => {
    expect(aiStatus({ ai: ai(['B']), correct: ['A'] })).toBe('differs');
    expect(aiStatus({ ai: ai(['B'], true), correct: ['A'] })).toBe('differs');
  });
  it('multi comparison is order-insensitive', () => {
    expect(aiStatus({ ai: ai(['B', 'A']), correct: ['A', 'B'] })).toBe('agrees');
  });
  it('multi partial overlap, subset and superset all differ', () => {
    expect(aiStatus({ ai: ai(['A', 'C']), correct: ['A', 'B'] })).toBe('differs');
    expect(aiStatus({ ai: ai(['B']), correct: ['A', 'B'] })).toBe('differs');
    expect(aiStatus({ ai: ai(['A', 'B', 'C']), correct: ['A', 'B'] })).toBe('differs');
  });
});

describe('aiDefaultOpen (status × "Always show AI analysis")', () => {
  const table: [Parameters<typeof aiDefaultOpen>[0], boolean, boolean][] = [
    ['agrees', true, true],
    ['agrees', false, false],
    ['doubts', true, true],
    ['doubts', false, true],
    ['differs', true, true],
    ['differs', false, true],
  ];
  for (const [status, alwaysExpanded, open] of table) {
    it(`${status}, setting ${alwaysExpanded ? 'ON' : 'OFF'} → ${open ? 'open' : 'collapsed'}`, () => {
      expect(aiDefaultOpen(status, alwaysExpanded)).toBe(open);
    });
  }
});
