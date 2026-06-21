export interface Option {
  label: string;
  text: string;
  image: string | null; // IDB asset key, or null
}

export interface Question {
  qid: string; // `${installedId}:${localId}`
  bankId: string; // installedId
  localId: string;
  number: number; // 1-based position within the bank
  type: 'single' | 'multi';
  prompt: string;
  promptImage: string | null; // IDB asset key, or null
  options: Option[];
  correct: string[];
  explanation: string | null;
  category: number | null;
  categoryName: string | null;
  paper: string | null;
  topic: string | null;
  difficulty: number | null;
}

export interface CategoryMeta {
  id: number;
  name: string;
}

// The active bank's derived, in-memory dataset.
export interface RuntimeDataset {
  installedId: string;
  moduleLabel: string;
  questions: Question[];
  questionsById: Map<string, Question>;
  categories: CategoryMeta[];
  papers: string[];
}

export type Mode = 'drill' | 'exam' | 'review' | 'srs';

export interface Attempt {
  t: number;
  choice: string[];
  correct: boolean;
  mode: Mode;
}

export interface SrsState {
  reps: number;
  ease: number;
  intervalDays: number;
  due: number;
}

export interface QuestionProgress {
  attempts: Attempt[];
  flagged: boolean;
  srs: SrsState | null;
}

export interface Settings {
  examCount: number;
  examMinutes: number;
}

// Per-bank progress, held in memory for the active bank and persisted to IDB.
export interface ProgressStore {
  questions: Record<string, QuestionProgress>;
  settings: Settings;
}
