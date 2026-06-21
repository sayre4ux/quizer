import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { validateBank } from './lib/quizbank/validate';
import { buildDataset } from './lib/buildDataset';
import { applyDataset } from './lib/dataset';
import { store } from './lib/storage';
import { HomeTab } from './modes/HomeTab';
import { AnalysisTab } from './modes/AnalysisTab';
import { ExamMode } from './modes/ExamMode';
import { QuestionCard } from './components/QuestionCard';
import { allQuestions } from './lib/dataset';
import { ModuleCarousel } from './modes/ModuleCarousel';
import { ImportDialog } from './modes/ImportDialog';
import { ManageModules } from './modes/ManageModules';
import type { BankMeta } from './lib/quizbank/idb';

function manifest(withCategories: boolean) {
  const m: Record<string, unknown> = {
    format: 'quizbank', formatVersion: 1, id: 'demo', title: 'Demo', module: 'DEMO',
    questions: Array.from({ length: 6 }, (_, i) => ({
      id: `q${i + 1}`, prompt: `Question ${i + 1}?`,
      options: [{ label: 'A', text: 'a' }, { label: 'B', text: 'b' }], correct: ['A'],
      ...(withCategories ? { category: (i % 3) + 1, topic: `topic ${i % 2}`, paper: 'Paper 1' } : {}),
    })),
  };
  if (withCategories) m.categories = [{ id: 1, name: 'Security and Risk' }, { id: 2, name: 'Asset Security' }, { id: 3, name: 'Network' }];
  return m;
}

function applyManifest(withCategories: boolean) {
  const r = validateBank(manifest(withCategories), new Map());
  if (!r.ok) throw new Error(r.errors.join('; '));
  applyDataset(buildDataset('demo', r.value.manifest));
  store.adopt('demo', null);
}

describe('SSR smoke — generalized components render', () => {
  const noop = () => {};

  it('renders with a categorized bank', () => {
    applyManifest(true);
    expect(renderToString(createElement(HomeTab, { start: noop, startExam: noop }))).toContain('Practice by category');
    expect(renderToString(createElement(AnalysisTab, { start: noop }))).toContain('Performance by category');
    expect(renderToString(createElement(ExamMode, { onExit: noop }))).toContain('Exam simulation');
    const q = allQuestions[0];
    expect(renderToString(createElement(QuestionCard, { question: q, selected: [], onToggle: noop, revealed: true }))).toContain('Question 1');
  });

  it('renders a category-less bank without category UI', () => {
    applyManifest(false);
    const home = renderToString(createElement(HomeTab, { start: noop, startExam: noop }));
    expect(home).not.toContain('Practice by category');
    const analysis = renderToString(createElement(AnalysisTab, { start: noop }));
    expect(analysis).not.toContain('Performance by category');
    expect(analysis).toContain('Overview'); // overview still renders
  });
});

function meta(id: string, name: string): BankMeta {
  return {
    installedId: id, sourceId: id, displayName: name, module: 'X',
    questionCount: 100, categoryCount: 3, importedAt: 0, coverPath: null,
    summary: { seen: 0, mastered: 0, accuracy: null, progressPct: 0.5 },
  };
}

describe('SSR smoke — carousel + dialogs', () => {
  const noop = () => {};
  const metas = [meta('a', 'Bank A'), meta('b', 'Bank B')];

  it('carousel renders the active module detail', () => {
    const html = renderToString(createElement(ModuleCarousel, { metas, activeId: 'a', onOpen: noop, onAdd: noop, onManage: noop, onLoadSample: noop }));
    expect(html).toContain('Bank A');
  });

  it('carousel empty state shows the add prompt', () => {
    const html = renderToString(createElement(ModuleCarousel, { metas: [], activeId: null, onOpen: noop, onAdd: noop, onManage: noop, onLoadSample: noop }));
    expect(html).toContain('Add a question bank');
  });

  it('import dialog and manage list render', () => {
    expect(renderToString(createElement(ImportDialog, { onClose: noop, onInstalled: noop }))).toContain('Add a module');
    const manage = renderToString(createElement(ManageModules, { metas, activeId: 'a', onClose: noop, onOpen: noop, onAdd: noop }));
    expect(manage).toContain('Manage modules');
    expect(manage).toContain('Bank B');
  });
});
