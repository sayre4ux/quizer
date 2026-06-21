import type { CategoryMeta, Question, RuntimeDataset } from '../types';

// The active bank's dataset, as live module bindings. They start empty and are
// reassigned by applyDataset() once a bank is loaded from IDB at boot / switch.
// Consumers (pools, stats, components) read these inside functions/render — after
// the boot gate — so they always see the active bank's data via ES live bindings.

export let allQuestions: Question[] = [];
export let questionsById: Map<string, Question> = new Map();
export let categories: CategoryMeta[] = [];
export let papers: string[] = [];
export let moduleLabel = '';
export let activeInstalledId: string | null = null;

export function applyDataset(d: RuntimeDataset | null): void {
  allQuestions = d?.questions ?? [];
  questionsById = d?.questionsById ?? new Map();
  categories = d?.categories ?? [];
  papers = d?.papers ?? [];
  moduleLabel = d?.moduleLabel ?? '';
  activeInstalledId = d?.installedId ?? null;
}

export function categoryName(id: number): string {
  return categories.find((c) => c.id === id)?.name ?? `Category ${id}`;
}

export function getQuestion(qid: string): Question | undefined {
  return questionsById.get(qid);
}
