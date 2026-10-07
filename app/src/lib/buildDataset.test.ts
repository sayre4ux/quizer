import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildDataset } from './buildDataset';
import { validateBank } from './quizbank/validate';
import { aiBank } from './quizbank/fixtures';
import { aiStatus } from './aiStatus';
import type { QuizBankManifest } from './quizbank/format';

function validated(raw: unknown): QuizBankManifest {
  const r = validateBank(raw, new Map());
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.value.manifest;
}

describe('buildDataset — ai', () => {
  it('maps ai into the runtime shape, defaulting doubt to false', () => {
    const d = buildDataset('demo', validated(aiBank()));
    expect(d.questions[0].ai).toEqual({ answer: ['A'], explanation: 'A is right.', doubt: false });
    expect(d.questions[1].ai).toEqual({ answer: ['B'], explanation: 'B is right, not A.', doubt: false });
    expect(d.questions[2].ai?.doubt).toBe(true);
    expect(d.questions[3].ai).toEqual({ answer: ['B'], explanation: 'Only B holds.', doubt: false });
    expect(d.questions[4].ai).toBeNull();
  });

  it('sorts the AI answer into option order without touching the manifest', () => {
    const raw = aiBank();
    const q4 = (raw.questions as Record<string, unknown>[])[3];
    q4.ai = { answer: ['D', 'B'], explanation: 'B and D.' };
    const manifest = validated(raw);
    const d = buildDataset('demo', manifest);
    expect(d.questions[3].ai?.answer).toEqual(['B', 'D']);
    expect(manifest.questions[3].ai?.answer).toEqual(['D', 'B']);
  });

  it('maps aiAnalysis to aiProvenance, nulling absent date/note', () => {
    expect(buildDataset('demo', validated(aiBank())).aiProvenance)
      .toEqual({ model: 'Claude Opus 5.5', date: '2026-10', note: 'Advisory only.' });
    const raw = aiBank();
    raw.aiAnalysis = { model: 'm' };
    expect(buildDataset('demo', validated(raw)).aiProvenance).toEqual({ model: 'm', date: null, note: null });
  });

  it('a manifest without ai/aiAnalysis yields null ai and null aiProvenance', () => {
    const raw = aiBank();
    delete raw.aiAnalysis;
    for (const q of raw.questions as Record<string, unknown>[]) delete q.ai;
    const d = buildDataset('demo', validated(raw));
    expect(d.aiProvenance).toBeNull();
    expect(d.questions.every((q) => q.ai === null)).toBe(true);
  });

  it('the ai-demo test fixture covers every agreement state', () => {
    const fp = path.resolve(process.cwd(), 'src/test-fixtures/ai-demo.quizbank.json');
    const d = buildDataset('ai_demo', validated(JSON.parse(readFileSync(fp, 'utf8'))));
    expect(d.questions.map(aiStatus)).toEqual(['agrees', 'agrees', 'doubts', 'differs', 'differs', 'none', 'agrees']);
    expect(d.questions[1].explanation).toBeNull(); // agrees with no source explanation
    expect(d.questions[4].type).toBe('multi');
    expect(d.questions[4].ai?.answer).toEqual(['A', 'C', 'D']); // authored C, A, D
    expect(d.questions[3].prompt.length).toBeGreaterThanOrEqual(400);
    expect(d.questions[5].options.some((o) => /https:\/\/\S{100,}/.test(o.text))).toBe(true);
    expect(d.aiProvenance).toEqual({ model: 'Claude Opus 5.5', date: '2026-10', note: 'AI 解析仅供参考，计分以原题库答案为准。' });
  });
});

describe('buildDataset — bankScript', () => {
  const fixture = (name: string) =>
    JSON.parse(readFileSync(path.resolve(process.cwd(), `src/test-fixtures/${name}`), 'utf8')) as Record<string, unknown>;

  it('an English bank has no Chinese script', () => {
    expect(buildDataset('demo', validated(aiBank())).bankScript).toBeNull();
  });

  it('a zh-Hans tag decides; free-text language falls back to the text', () => {
    const raw = fixture('ai-demo.quizbank.json');
    expect(raw.language).toBe('zh-Hans');
    expect(buildDataset('ai_demo', validated(raw)).bankScript).toBe('hans');
    raw.language = '中文';
    expect(buildDataset('ai_demo', validated(raw)).bankScript).toBe('hans');
    raw.language = 'zh-Hant'; // the tag outranks the Simplified text
    expect(buildDataset('ai_demo', validated(raw)).bankScript).toBe('hant');
  });

  it('a mixed bank (English questions, Chinese explanations) is detected from its explanations', () => {
    const raw = fixture('mixed-demo.quizbank.json');
    expect(raw.language).toBe('en');
    expect(buildDataset('mixed_demo', validated(raw)).bankScript).toBe('hans');
    for (const q of raw.questions as Record<string, unknown>[]) delete q.explanation;
    expect(buildDataset('mixed_demo', validated(raw)).bankScript).toBeNull();
  });

  it('AI explanations count toward detection too', () => {
    const raw = aiBank();
    (raw.questions as Record<string, unknown>[])[0].ai = { answer: ['A'], explanation: '这是关于网络安全的说明。' };
    expect(buildDataset('demo', validated(raw)).bankScript).toBe('hans');
  });

  it('keeps the original text in the dataset', () => {
    const d = buildDataset('ai_demo', validated(fixture('ai-demo.quizbank.json')));
    expect(d.questions[2].prompt).toContain('网络安全');
    expect(d.categories.map((c) => c.name)).toContain('软件安全开发');
  });
});
