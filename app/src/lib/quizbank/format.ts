// The quizbank v1 file format — the contract for imported question banks.
// This module is the authoritative format spec. erasableSyntaxOnly: no enums/namespaces.

export const FORMAT_TAG = 'quizbank';
export const FORMAT_VERSION = 1;

// ---- Hard limits (validator §4) ----
export const LIMITS = {
  fileBytes: 20 * 1024 * 1024, // .zip and bare .json
  uncompressedBytes: 60 * 1024 * 1024, // zip-bomb guard
  maxQuestions: 5000,
  minQuestions: 5,
  maxAssets: 2000,
  imageBytes: 2 * 1024 * 1024,
  assetPathLen: 256,
  idMin: 2,
  idMax: 64,
  questionIdMax: 128,
  titleMax: 120,
  moduleMax: 32,
  topicMax: 120,
  paperMax: 120,
  promptMax: 4000,
  explanationMax: 8000,
  optionLabelMax: 8,
  optionTextMax: 1000,
  categoryNameMax: 120,
  tagMax: 32,
  maxCategories: 64,
  maxTags: 32,
  minOptions: 2,
  maxOptions: 10,
  maxDifficulty: 5,
} as const;

export const BANK_ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
export const QUESTION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
export const ASSETS_PREFIX = 'assets/';
export const MANIFEST_NAME = 'quizbank.json';

export type QuestionType = 'single' | 'multi';

// Image type by magic bytes (file signature) — never trust extension/declared MIME.
// Shared by the validator (allowlist check) and the IDB layer (Blob MIME).
export function sniffImageMime(b: Uint8Array): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

// ---- Manifest shape (as authored in quizbank.json) ----
export interface ManifestOption {
  label: string;
  text: string;
  image?: string;
}

export interface ManifestQuestion {
  id: string;
  type?: QuestionType;
  prompt: string;
  promptImage?: string;
  options: ManifestOption[];
  correct: string[];
  explanation?: string;
  category?: number;
  paper?: string;
  topic?: string;
  difficulty?: number;
}

export interface ManifestCategory {
  id: number;
  name: string;
}

export interface ManifestExam {
  count?: number;
  minutes?: number;
}

export interface QuizBankManifest {
  format: typeof FORMAT_TAG;
  formatVersion: number;
  id: string;
  title: string;
  module?: string;
  language?: string;
  description?: string;
  author?: string;
  license?: string;
  sourceUrl?: string;
  tags?: string[];
  createdAt?: string;
  cover?: string;
  categories?: ManifestCategory[];
  exam?: ManifestExam;
  questions: ManifestQuestion[];
}

// Allowed keys per object — strict unknown-field rejection (decision #10).
export const MANIFEST_KEYS = new Set<string>([
  'format', 'formatVersion', 'id', 'title', 'module', 'language', 'description',
  'author', 'license', 'sourceUrl', 'tags', 'createdAt', 'cover', 'categories',
  'exam', 'questions',
]);
export const QUESTION_KEYS = new Set<string>([
  'id', 'type', 'prompt', 'promptImage', 'options', 'correct', 'explanation',
  'category', 'paper', 'topic', 'difficulty',
]);
export const OPTION_KEYS = new Set<string>(['label', 'text', 'image']);
export const CATEGORY_KEYS = new Set<string>(['id', 'name']);
export const EXAM_KEYS = new Set<string>(['count', 'minutes']);

// ---- Pipeline results ----

// Raw container after unzip/parse: manifest still untyped, assets by manifest path.
export interface ParsedContainer {
  manifest: unknown;
  assets: Map<string, Uint8Array>; // key = manifest-relative path, e.g. "assets/cover.png"
}

// A validated bank ready to install. coverManifestPath is the normalized manifest
// path (NOT the IDB key — install composes `${installedId}/${path}`).
export interface ValidatedBank {
  manifest: QuizBankManifest;
  referencedAssets: Map<string, Uint8Array>;
  coverManifestPath: string | null;
}

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };
