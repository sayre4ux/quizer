import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { validateBank } from '../lib/quizbank/validate';
import { buildDataset } from '../lib/buildDataset';
import { allQuestions, applyDataset, bankScript } from '../lib/dataset';
import { store } from '../lib/storage';
import { __resetPrefsForTests, setPref } from '../lib/prefs';
import { ensureConverterLoaded } from '../lib/chineseScript';
import { buildPool } from '../lib/pools';
import { QuestionCard } from './QuestionCard';
import { AiAnalysisView } from './AiAnalysis';
import { SettingsDialog } from './SettingsDialog';
import { Shell } from '../App';
import { SessionRunner } from '../modes/SessionRunner';
import type { Question } from '../types';

const noop = () => {};

function loadDemo() {
  const fp = path.resolve(process.cwd(), 'src/test-fixtures/ai-demo.quizbank.json');
  const r = validateBank(JSON.parse(readFileSync(fp, 'utf8')), new Map());
  if (!r.ok) throw new Error(r.errors.join('; '));
  applyDataset(buildDataset('ai_demo', r.value.manifest));
  store.adopt('ai_demo', null);
}

function q(localId: string): Question {
  const found = allQuestions.find((x) => x.localId === localId);
  if (!found) throw new Error(`missing ${localId}`);
  return found;
}

function card(question: Question, selected: string[], revealed = true, meta?: 'full' | 'compact') {
  return renderToString(createElement(QuestionCard, { question, selected, onToggle: noop, revealed, meta }));
}

// The opening tag of an option row button, found by its test hook.
function optionTag(html: string, label: string): string {
  const m = html.match(new RegExp(`<button[^>]*data-option="${label}"[^>]*>`));
  if (!m) throw new Error(`no option ${label}`);
  return m[0];
}

// The full markup of an option row button (rows contain no nested buttons).
function optionRow(html: string, label: string): string {
  const start = html.indexOf(optionTag(html, label));
  return html.slice(start, html.indexOf('</button>', start));
}

function aiToggleTag(html: string): string {
  const m = html.match(/<button[^>]*aria-controls="[^"]*"[^>]*>/);
  if (!m) throw new Error('no AI toggle');
  return m[0];
}

describe('QuestionCard — AI analysis (ai-demo fixture)', () => {
  beforeAll(loadDemo);
  afterEach(() => __resetPrefsForTests());

  it('no AI data: no AI zone, no tag, explanation unchanged', () => {
    const html = card(q('ai_demo_006'), ['A']);
    expect(html).not.toContain('AI analysis');
    expect(html).not.toContain('data-ai-pick');
    expect(html).not.toContain('data-ai-status');
    expect(html).toContain('Explanation');
  });

  it('agrees opens by default (always-expanded preference on)', () => {
    const html = card(q('ai_demo_001'), ['B']);
    expect(html).toContain('data-ai-status="agrees"');
    expect(aiToggleTag(html)).toContain('aria-expanded="true"');
    expect(html).toContain('Agrees');
    expect(html).toContain('同意原答案');
    expect(html).not.toContain('data-ai-pick');
  });

  it('agrees starts collapsed when the preference is off', () => {
    setPref('aiAlwaysExpanded', false);
    const html = card(q('ai_demo_001'), ['B']);
    expect(aiToggleTag(html)).toContain('aria-expanded="false"');
    expect(html).toMatch(/<div hidden="" id="[^"]*"|<div id="[^"]*" hidden=""/);
  });

  it('doubts stays open when the preference is off', () => {
    setPref('aiAlwaysExpanded', false);
    const html = card(q('ai_demo_003'), ['A']);
    expect(html).toContain('data-ai-status="doubts"');
    expect(html).toContain('Has doubts');
    expect(aiToggleTag(html)).toContain('aria-expanded="true"');
    expect(html).not.toContain('data-ai-pick');
  });

  it('differs: expanded, one AI-tagged row, key row still green, footer present', () => {
    setPref('aiAlwaysExpanded', false);
    const html = card(q('ai_demo_004'), ['D']);
    expect(html).toContain('data-ai-status="differs"');
    expect(aiToggleTag(html)).toContain('aria-expanded="true"');
    expect(html.match(/data-ai-pick="true"/g)).toHaveLength(1);
    expect(optionTag(html, 'B')).toContain('data-ai-pick="true"');
    expect(optionTag(html, 'B')).toContain('text-muted');
    expect(optionRow(html, 'B')).toContain(' recommended');
    expect(optionTag(html, 'A')).toContain('bg-good/10');
    expect(html).toContain('bg-warn/[0.08]');
    expect(html).toContain('Claude Opus 5.5 · Advisory, scoring uses source answer');
    // The bank note is shown once in Settings, not on every question.
    expect(html).not.toContain('AI 解析仅供参考');
  });

  it('multi differs tags every AI pick, including ones that are also in the key', () => {
    // key A,B,C; AI A,C,D → A, C and D carry the tag; the key rows stay green.
    const html = card(q('ai_demo_005'), ['A', 'B']);
    expect(html).toContain('data-ai-status="differs"');
    expect(html.match(/data-ai-pick="true"/g)).toHaveLength(3);
    expect(html).toContain('A, C, D');
    expect(optionTag(html, 'A')).toContain('bg-good/10');
    expect(optionTag(html, 'B')).not.toContain('data-ai-pick');
  });

  it('unrevealed (in-exam): no zone, no tag, no compaction', () => {
    const html = card(q('ai_demo_004'), ['D'], false);
    expect(html).not.toContain('AI analysis');
    expect(html).not.toContain('data-ai-pick');
    expect(html).not.toContain('line-clamp-1');
    expect(html).not.toContain('aria-expanded');
  });

  it('compacts non-relevant rows after reveal', () => {
    // key A, AI B, user picked A → C and D are not relevant.
    const html = card(q('ai_demo_004'), ['A']);
    for (const l of ['C', 'D']) {
      expect(optionTag(html, l)).toContain('aria-expanded="false"');
      expect(optionTag(html, l)).not.toContain('disabled');
      expect(optionRow(html, l)).toContain('line-clamp-1');
    }
    for (const l of ['A', 'B']) {
      expect(optionTag(html, l)).not.toContain('aria-expanded');
      expect(optionTag(html, l)).toContain('disabled');
      expect(optionRow(html, l)).not.toContain('line-clamp-1');
    }
    expect(optionRow(html, 'A')).toContain('(correct answer)');
    expect(optionRow(html, 'A')).toContain('(your answer)');
  });

  it('keeps the user’s wrong pick in full', () => {
    const html = card(q('ai_demo_001'), ['C']);
    expect(optionRow(html, 'C')).not.toContain('line-clamp-1');
    expect(optionRow(html, 'C')).toContain('(your answer)');
    expect(optionRow(html, 'A')).toContain('line-clamp-1');
    expect(optionRow(html, 'D')).toContain('line-clamp-1');
  });

  it('empty source explanation + AI: header then AI section, no placeholder line', () => {
    const html = card(q('ai_demo_002'), ['B']);
    expect(html).toContain('AI analysis');
    expect(html).not.toContain('No explanation provided');
  });

  it('empty source explanation: the AI section opens even with the preference off', () => {
    setPref('aiAlwaysExpanded', false);
    const html = card(q('ai_demo_002'), ['B']);
    expect(aiToggleTag(html)).toContain('aria-expanded="true"');
  });

  it('empty source explanation without AI keeps the placeholder line', () => {
    const html = card({ ...q('ai_demo_002'), ai: null }, ['B']);
    expect(html).toContain('No explanation provided');
  });

  it('marks CJK content with the bank\'s script on the prompt', () => {
    const html = card(q('ai_demo_001'), []);
    expect(html).toMatch(/<h2 lang="zh-Hans"/);
  });

  it('compact meta: one faint line, no index, no badges', () => {
    const question = q('ai_demo_001');
    const full = renderToString(createElement(QuestionCard, { question, selected: [], onToggle: noop, revealed: false, index: 0, total: 7 }));
    expect(full).toContain('1<!-- --> / <!-- -->7');
    const compact = renderToString(
      createElement(QuestionCard, { question, selected: [], onToggle: noop, revealed: false, index: 0, total: 7, meta: 'compact' }),
    );
    expect(compact).not.toContain('/ <!-- -->7');
    expect(compact).toContain('信息安全评估 · #1');
    expect(compact).toContain('truncate text-[11px] text-faint');
  });
});

describe('QuestionCard — Latin content', () => {
  it('has no lang attribute for an English bank', () => {
    const r = validateBank(
      {
        format: 'quizbank', formatVersion: 1, id: 'en', title: 'EN',
        questions: Array.from({ length: 5 }, (_, i) => ({
          id: `q${i + 1}`, prompt: 'Which of the following?',
          options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A'],
        })),
      },
      new Map(),
    );
    if (!r.ok) throw new Error(r.errors.join('; '));
    const d = buildDataset('en', r.value.manifest);
    const html = renderToString(createElement(QuestionCard, { question: d.questions[0], selected: ['A'], onToggle: noop, revealed: true }));
    expect(html).not.toContain('lang=');
    expect(html).toContain('No explanation provided');
  });
});

describe('AiAnalysisView — toggled states', () => {
  const ai = { answer: ['C'], explanation: 'Because C.', doubt: false };
  const base = { ai, lang: undefined, animate: false, onToggle: noop, panelId: 'p1' } as const;
  const prov = { model: 'Claude Opus 5.5', date: '2026-10', note: 'note' };

  it('agrees expanded shows the panel text', () => {
    const html = renderToString(createElement(AiAnalysisView, { ...base, status: 'agrees', provenance: prov, open: true }));
    expect(html).toContain('aria-expanded="true"');
    expect(html).not.toContain('hidden=""');
    expect(html).toContain('Because C.');
    expect(html).toContain('bg-good');
  });

  it('differs collapsed keeps the amber tint with the panel hidden', () => {
    const html = renderToString(createElement(AiAnalysisView, { ...base, status: 'differs', provenance: prov, open: false }));
    expect(html).toContain('bg-warn/[0.08]');
    expect(html).toContain('hidden=""');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-controls="p1"');
  });

  it('without provenance the footer has no model', () => {
    const html = renderToString(createElement(AiAnalysisView, { ...base, status: 'agrees', provenance: null, open: true }));
    expect(html).toContain('>Advisory, scoring uses source answer<');
    expect(html).not.toContain('Claude');
  });

  it('plays the reveal animation only when asked', () => {
    const still = renderToString(createElement(AiAnalysisView, { ...base, status: 'agrees', provenance: null, open: true }));
    const moving = renderToString(createElement(AiAnalysisView, { ...base, status: 'agrees', provenance: null, open: true, animate: true }));
    expect(still).not.toContain('animate-ai-reveal');
    expect(moving).toContain('motion-safe:animate-ai-reveal');
  });
});

describe('Settings and focus shell', () => {
  beforeAll(loadDemo);
  afterEach(() => __resetPrefsForTests());

  it('settings dialog: switch reflects the preference and shows bank provenance', () => {
    let html = renderToString(createElement(SettingsDialog, { onClose: noop }));
    expect(html).toMatch(/role="switch"[^>]*aria-checked="true"/);
    expect(html).toContain('Always show AI analysis');
    expect(html).toContain('About AI analysis:');
    expect(html).toContain('Claude Opus 5.5');
    expect(html).toContain('2026-10');
    expect(html).toContain('AI 解析仅供参考');
    setPref('aiAlwaysExpanded', false);
    html = renderToString(createElement(SettingsDialog, { onClose: noop }));
    expect(html).toMatch(/role="switch"[^>]*aria-checked="false"/);
  });

  it('settings dialog omits the provenance line when the bank has none', () => {
    applyDataset(null);
    try {
      const html = renderToString(createElement(SettingsDialog, { onClose: noop }));
      expect(html).not.toContain('About AI analysis');
    } finally {
      loadDemo();
    }
  });

  it('focus-mode Shell renders no header; the normal Shell has one with a settings gear', () => {
    const focused = renderToString(createElement(Shell, { focus: true, children: createElement('p', null, 'body') }));
    expect(focused).not.toContain('<header');
    expect(focused).not.toContain('aria-label="Settings"');
    expect(focused).toContain('body');
    const normal = renderToString(createElement(Shell, { children: createElement('p', null, 'body') }));
    expect(normal).toContain('<header');
    expect(normal).toContain('aria-label="Settings"');
  });

  it('session top bar: back title, position, settings gear, compact meta', () => {
    const html = renderToString(
      createElement(SessionRunner, { title: '练习题第六卷', questions: allQuestions, mode: 'drill', onExit: noop }),
    );
    expect(html).toContain('练习题第六卷');
    expect(html).toContain('1<!-- --> / <!-- -->7');
    expect(html).toContain('aria-label="Settings"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('truncate text-[11px] text-faint');
  });
});

function loadFixture(file: string, id: string, patch?: (raw: Record<string, unknown>) => void) {
  const raw = JSON.parse(readFileSync(path.resolve(process.cwd(), `src/test-fixtures/${file}`), 'utf8')) as Record<string, unknown>;
  patch?.(raw);
  const r = validateBank(raw, new Map());
  if (!r.ok) throw new Error(r.errors.join('; '));
  applyDataset(buildDataset(id, r.value.manifest));
  store.adopt(id, null);
}

function explanationP(html: string): string {
  const m = html.match(/<p lang="[^"]*" class="whitespace-pre-wrap[^>]*>[^<]*<\/p>/);
  if (!m) throw new Error('no explanation');
  return m[0];
}

describe('Chinese script display (Simplified bank, Traditional preference)', () => {
  beforeAll(async () => {
    // Every question of ai_demo sits in paper 2019年真题, to check filters keep the original key.
    loadFixture('ai-demo.quizbank.json', 'ai_demo', (raw) => {
      for (const x of raw.questions as Record<string, unknown>[]) x.paper = '2019年真题';
      raw.module = '软件安全';
    });
    await ensureConverterLoaded('toHant');
  });
  afterEach(() => __resetPrefsForTests());

  it('the fixture is a Simplified bank', () => {
    expect(bankScript).toBe('hans');
  });

  it('converts prompt, options, source and AI explanations, with lang="zh-Hant"', () => {
    setPref('chineseScript', 'traditional');
    const html = card(q('ai_demo_004'), ['A']);
    const h2 = html.match(/<h2 lang="zh-Hant"[^>]*>([^<]*)<\/h2>/)?.[1] ?? '';
    expect(h2).toContain('網絡安全');
    expect(h2).toContain('這是');
    expect(html).not.toContain('网络安全');
    expect(html).not.toContain('这');
    expect(optionRow(html, 'A')).toContain('lang="zh-Hant"');
    expect(html).not.toContain('lang="zh-Hans"');
    expect(html).not.toContain('lang="zh"');
    const ai3 = card(q('ai_demo_003'), ['A']);
    expect(explanationP(ai3)).toContain('網絡');
    expect(ai3).toMatch(/<p lang="zh-Hant" class="whitespace-pre-wrap[^>]*>[^<]*網絡[^<]*<\/p>/);
    expect(ai3).not.toContain('网络');
  });

  it('keeps mainland vocabulary: 软件 -> 軟件, 信息 stays 信息', () => {
    setPref('chineseScript', 'traditional');
    const compact = card(q('ai_demo_005'), [], false, 'compact');
    expect(compact).toContain('軟件安全開發 · 2019年真題 #5');
    expect(card(q('ai_demo_001'), [])).toContain('信息安全');
  });

  it('original preference renders the bank text untouched', () => {
    setPref('chineseScript', 'original');
    const html = card(q('ai_demo_004'), ['A']);
    expect(html).toMatch(/<h2 lang="zh-Hans"/);
    expect(html).toContain('网络安全');
    expect(html).not.toContain('網絡');
  });

  it('display-only: dataset, filters and grading keys keep the original text', () => {
    setPref('chineseScript', 'traditional');
    card(q('ai_demo_004'), ['A']);
    expect(q('ai_demo_004').prompt).toContain('网络安全');
    expect(q('ai_demo_005').categoryName).toBe('软件安全开发');
    const pool = buildPool(store.snapshot(), { filter: { kind: 'paper', value: '2019年真题' } });
    expect(pool).toHaveLength(7);
    expect(buildPool(store.snapshot(), { filter: { kind: 'paper', value: '2019年真題' } })).toHaveLength(0);
  });

  it('session title and module label are converted', () => {
    setPref('chineseScript', 'traditional');
    const html = renderToString(
      createElement(SessionRunner, { title: 'Drill · 软件安全开发', questions: allQuestions, mode: 'drill', onExit: noop }),
    );
    expect(html).toContain('Drill · 軟件安全開發');
    expect(html).toMatch(/<span lang="zh-Hant" class="truncate">/);
    const shell = renderToString(createElement(Shell, { children: null }));
    expect(shell).toMatch(/<span lang="zh-Hant" class="inline-flex[^>]*>軟件安全<\/span>/);
  });

  it('settings: the Chinese text section reflects the preference', () => {
    setPref('chineseScript', 'traditional');
    const html = renderToString(createElement(SettingsDialog, { onClose: noop }));
    expect(html).toContain('role="radiogroup" aria-label="Chinese script"');
    expect(html).toMatch(/role="radio" aria-checked="true" lang="zh-Hant"[^>]*>繁體</);
    expect(html).toMatch(/role="radio" aria-checked="false"[^>]*>Original</);
    expect(html).toContain('Converts characters only; exam terms stay the same. Text inside figures is not converted.');
    expect(html).not.toContain('Loading converter');
    expect(html).toContain('AI 解析僅供參考'); // provenance note converted
  });
});

describe('Chinese script display — English and mixed banks', () => {
  beforeAll(() => ensureConverterLoaded('toHant'));
  afterEach(() => __resetPrefsForTests());

  it('an English bank: no Chinese section in settings, cards unchanged by the preference', () => {
    loadFixture('ai-demo.quizbank.json', 'ai_demo'); // reset, then swap in an English bank
    const r = validateBank(
      {
        format: 'quizbank', formatVersion: 1, id: 'en', title: 'EN',
        questions: Array.from({ length: 5 }, (_, i) => ({
          id: `q${i + 1}`, prompt: 'Which of the following?', explanation: 'Because.',
          options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A'],
        })),
      },
      new Map(),
    );
    if (!r.ok) throw new Error(r.errors.join('; '));
    applyDataset(buildDataset('en', r.value.manifest));
    expect(bankScript).toBeNull();
    const before = card(allQuestions[0], ['A']);
    setPref('chineseScript', 'traditional');
    expect(card(allQuestions[0], ['A'])).toBe(before);
    expect(renderToString(createElement(SettingsDialog, { onClose: noop }))).not.toContain('Chinese script');
  });

  it('a mixed card: English prompt and AI text untouched, Chinese explanation converted', () => {
    loadFixture('mixed-demo.quizbank.json', 'mixed_demo');
    expect(bankScript).toBe('hans');
    setPref('chineseScript', 'traditional');
    const html = card(allQuestions[0], ['A']);
    expect(html).toMatch(/<h2 class="[^"]*">Which of the following BEST describes the purpose of a security policy\?<\/h2>/);
    expect(optionTag(html, 'A')).not.toContain('lang=');
    expect(optionRow(html, 'A')).not.toContain('lang=');
    expect(explanationP(html)).toBe(
      '<p lang="zh-Hant" class="whitespace-pre-wrap text-[14.5px] leading-[1.65] text-fg/90 [overflow-wrap:anywhere] sm:text-[15px] sm:leading-relaxed">安全策略是管理層對信息安全的意圖聲明，這是網絡安全治理的基礎。</p>',
    );
    expect(html).toMatch(/<p class="whitespace-pre-wrap[^>]*>A security policy states management intent; the other options are lower-level artifacts\.<\/p>/);
    expect(renderToString(createElement(SettingsDialog, { onClose: noop }))).toContain('aria-label="Chinese script"');
  });
});
