import { EXAM_MAX_MINUTES, EXAM_MIN_QUESTIONS } from '../constants';
import {
  ASSETS_PREFIX, BANK_ID_RE, CATEGORY_KEYS, EXAM_KEYS, FORMAT_TAG, FORMAT_VERSION,
  LIMITS, MANIFEST_KEYS, OPTION_KEYS, QUESTION_ID_RE, QUESTION_KEYS, sniffImageMime,
} from './format';
import type {
  ManifestCategory, ManifestOption, ManifestQuestion, QuizBankManifest, Result, ValidatedBank,
} from './format';

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

function isSafeAssetPath(p: string): boolean {
  if (!p.startsWith(ASSETS_PREFIX) || p.includes('\\')) return false;
  const segs = p.split('/');
  if (segs.length < 2) return false;
  for (const s of segs) if (s === '' || s === '.' || s === '..') return false;
  return true;
}

// Validates an untrusted manifest + its asset bytes into an installable bank.
// Fail-closed: any violation collects an error and the import is rejected wholesale.
export function validateBank(raw: unknown, assets: Map<string, Uint8Array>): Result<ValidatedBank> {
  const errors: string[] = [];
  const err = (m: string) => errors.push(m);
  const referenced = new Map<string, Uint8Array>();

  const checkAsset = (ref: unknown, where: string): string | null => {
    if (!isStr(ref)) { err(`${where}: image path must be a string`); return null; }
    if (ref.length > LIMITS.assetPathLen) { err(`${where}: image path too long`); return null; }
    if (!isSafeAssetPath(ref)) { err(`${where}: unsafe image path "${ref}" (must be under assets/, no "..")`); return null; }
    const bytes = assets.get(ref);
    if (!bytes) { err(`${where}: referenced asset "${ref}" is missing`); return null; }
    if (bytes.length > LIMITS.imageBytes) { err(`${where}: image "${ref}" exceeds size limit`); return null; }
    if (!sniffImageMime(bytes)) { err(`${where}: "${ref}" is not a valid PNG/JPEG/WebP (magic-byte check)`); return null; }
    referenced.set(ref, bytes);
    return ref;
  };

  const checkStr = (v: unknown, where: string, max: number, required: boolean): boolean => {
    if (v === undefined) { if (required) err(`${where} is required`); return !required; }
    if (!isStr(v)) { err(`${where} must be a string`); return false; }
    if (v.length === 0 && required) { err(`${where} must not be empty`); return false; }
    if (v.length > max) { err(`${where} exceeds ${max} chars`); return false; }
    return true;
  };

  const rejectUnknown = (o: Record<string, unknown>, allowed: Set<string>, where: string) => {
    for (const k of Object.keys(o)) if (!allowed.has(k)) err(`${where}: unknown field "${k}"`);
  };

  if (assets.size > LIMITS.maxAssets) err(`too many asset files (max ${LIMITS.maxAssets})`);

  if (!isObj(raw)) return { ok: false, errors: ['manifest is not an object'] };
  const m = raw;
  rejectUnknown(m, MANIFEST_KEYS, 'manifest');

  if (m.format !== FORMAT_TAG) err(`unsupported file: "format" must be "${FORMAT_TAG}"`);
  if (m.formatVersion !== FORMAT_VERSION) {
    err(`unsupported format version ${String(m.formatVersion)} (this app reads v${FORMAT_VERSION}; the file may be newer)`);
  }

  if (!isStr(m.id) || !BANK_ID_RE.test(m.id)) err('manifest.id must match ^[a-z0-9][a-z0-9_-]{1,63}$');
  checkStr(m.title, 'manifest.title', LIMITS.titleMax, true);
  checkStr(m.module, 'manifest.module', LIMITS.moduleMax, false);
  checkStr(m.language, 'manifest.language', 32, false);
  checkStr(m.description, 'manifest.description', 2000, false);
  checkStr(m.author, 'manifest.author', 120, false);
  checkStr(m.license, 'manifest.license', 64, false);
  checkStr(m.sourceUrl, 'manifest.sourceUrl', 2048, false);
  checkStr(m.createdAt, 'manifest.createdAt', 40, false);

  if (m.tags !== undefined) {
    if (!Array.isArray(m.tags)) err('manifest.tags must be an array');
    else {
      if (m.tags.length > LIMITS.maxTags) err(`manifest.tags exceeds ${LIMITS.maxTags} entries`);
      m.tags.forEach((t, i) => checkStr(t, `manifest.tags[${i}]`, LIMITS.tagMax, true));
    }
  }

  // ---- categories ----
  const categoryIds = new Set<number>();
  let categories: ManifestCategory[] | undefined;
  if (m.categories !== undefined) {
    if (!Array.isArray(m.categories)) err('manifest.categories must be an array');
    else {
      if (m.categories.length > LIMITS.maxCategories) err(`manifest.categories exceeds ${LIMITS.maxCategories}`);
      const out: ManifestCategory[] = [];
      m.categories.forEach((c, i) => {
        const where = `categories[${i}]`;
        if (!isObj(c)) { err(`${where} must be an object`); return; }
        rejectUnknown(c, CATEGORY_KEYS, where);
        if (!isInt(c.id) || c.id <= 0) err(`${where}.id must be a positive integer`);
        else if (categoryIds.has(c.id)) err(`${where}.id ${c.id} is duplicated`);
        else categoryIds.add(c.id);
        checkStr(c.name, `${where}.name`, LIMITS.categoryNameMax, true);
        if (isInt(c.id) && isStr(c.name)) out.push({ id: c.id, name: c.name });
      });
      categories = out;
    }
  }

  // ---- exam ----
  let exam: { count?: number; minutes?: number } | undefined;
  if (m.exam !== undefined) {
    if (!isObj(m.exam)) err('manifest.exam must be an object');
    else {
      rejectUnknown(m.exam, EXAM_KEYS, 'exam');
      exam = {};
      if (m.exam.count !== undefined) {
        if (!isInt(m.exam.count)) err('exam.count must be an integer');
        else exam.count = m.exam.count; // range checked against total below
      }
      if (m.exam.minutes !== undefined) {
        if (!isInt(m.exam.minutes) || m.exam.minutes < 1 || m.exam.minutes > EXAM_MAX_MINUTES) {
          err(`exam.minutes must be an integer in [1, ${EXAM_MAX_MINUTES}]`);
        } else exam.minutes = m.exam.minutes;
      }
    }
  }

  // ---- cover ----
  const coverManifestPath = m.cover === undefined ? null : checkAsset(m.cover, 'manifest.cover');

  // ---- questions ----
  const questions: ManifestQuestion[] = [];
  if (!Array.isArray(m.questions)) {
    err('manifest.questions must be an array');
  } else {
    if (m.questions.length < EXAM_MIN_QUESTIONS) {
      err(`a bank needs at least ${EXAM_MIN_QUESTIONS} questions (got ${m.questions.length})`);
    }
    if (m.questions.length > LIMITS.maxQuestions) {
      err(`too many questions (max ${LIMITS.maxQuestions})`);
    }
    const seenIds = new Set<string>();
    const dupIds = new Set<string>();
    m.questions.forEach((q, i) => {
      const where = `questions[${i}]`;
      if (!isObj(q)) { err(`${where} must be an object`); return; }
      rejectUnknown(q, QUESTION_KEYS, where);

      if (!isStr(q.id) || !QUESTION_ID_RE.test(q.id)) err(`${where}.id is missing or invalid`);
      else if (seenIds.has(q.id)) dupIds.add(q.id);
      else seenIds.add(q.id);

      checkStr(q.prompt, `${where}.prompt`, LIMITS.promptMax, true);
      checkStr(q.explanation, `${where}.explanation`, LIMITS.explanationMax, false);
      checkStr(q.paper, `${where}.paper`, LIMITS.paperMax, false);
      checkStr(q.topic, `${where}.topic`, LIMITS.topicMax, false);
      if (q.promptImage !== undefined) checkAsset(q.promptImage, `${where}.promptImage`);

      if (q.difficulty !== undefined && (!isInt(q.difficulty) || q.difficulty < 1 || q.difficulty > LIMITS.maxDifficulty)) {
        err(`${where}.difficulty must be an integer 1-${LIMITS.maxDifficulty}`);
      }

      if (q.category !== undefined) {
        if (!isInt(q.category)) err(`${where}.category must be an integer`);
        else if (!categories) err(`${where}.category set but the bank declares no categories`);
        else if (!categoryIds.has(q.category)) err(`${where}.category ${q.category} is not a declared category`);
      }

      // options
      const labels = new Set<string>();
      const validOptions: ManifestOption[] = [];
      if (!Array.isArray(q.options)) {
        err(`${where}.options must be an array`);
      } else {
        if (q.options.length < LIMITS.minOptions || q.options.length > LIMITS.maxOptions) {
          err(`${where}.options must have ${LIMITS.minOptions}-${LIMITS.maxOptions} entries`);
        }
        q.options.forEach((o, j) => {
          const ow = `${where}.options[${j}]`;
          if (!isObj(o)) { err(`${ow} must be an object`); return; }
          rejectUnknown(o, OPTION_KEYS, ow);
          const okLabel = checkStr(o.label, `${ow}.label`, LIMITS.optionLabelMax, true);
          checkStr(o.text, `${ow}.text`, LIMITS.optionTextMax, true);
          if (o.image !== undefined) checkAsset(o.image, `${ow}.image`);
          if (okLabel && isStr(o.label)) {
            if (labels.has(o.label)) err(`${ow}.label "${o.label}" is duplicated within the question`);
            else { labels.add(o.label); validOptions.push({ label: o.label, text: isStr(o.text) ? o.text : '', image: isStr(o.image) ? o.image : undefined }); }
          }
        });
      }

      // correct
      let correct: string[] = [];
      if (!Array.isArray(q.correct) || q.correct.length === 0) {
        err(`${where}.correct must be a non-empty array of option labels`);
      } else if (!q.correct.every(isStr)) {
        err(`${where}.correct must contain only strings`);
      } else {
        correct = q.correct as string[];
        const seenCorrect = new Set<string>();
        for (const c of correct) {
          if (!labels.has(c)) err(`${where}.correct references unknown label "${c}"`);
          else if (seenCorrect.has(c)) err(`${where}.correct lists "${c}" more than once`);
          else seenCorrect.add(c);
        }
      }

      // type (derive if omitted; enforce consistency if present)
      let type: 'single' | 'multi';
      if (q.type === undefined) {
        type = correct.length > 1 ? 'multi' : 'single';
      } else if (q.type === 'single' || q.type === 'multi') {
        type = q.type;
        if (type === 'single' && correct.length !== 1) err(`${where}: type "single" requires exactly 1 correct answer`);
        if (type === 'multi' && correct.length < 2) err(`${where}: type "multi" requires at least 2 correct answers`);
      } else {
        err(`${where}.type must be "single" or "multi"`);
        type = correct.length > 1 ? 'multi' : 'single';
      }

      if (isStr(q.id)) {
        questions.push({
          id: q.id, type, prompt: isStr(q.prompt) ? q.prompt : '', promptImage: isStr(q.promptImage) ? q.promptImage : undefined,
          options: validOptions, correct,
          explanation: isStr(q.explanation) ? q.explanation : undefined,
          category: isInt(q.category) ? q.category : undefined,
          paper: isStr(q.paper) ? q.paper : undefined,
          topic: isStr(q.topic) ? q.topic : undefined,
          difficulty: isInt(q.difficulty) ? q.difficulty : undefined,
        });
      }
    });
    if (dupIds.size > 0) err(`duplicate question ids: ${[...dupIds].join(', ')}`);

    // exam.count range now that total is known
    if (exam?.count !== undefined) {
      const total = m.questions.length;
      if (exam.count < EXAM_MIN_QUESTIONS || exam.count > total) {
        err(`exam.count must be an integer in [${EXAM_MIN_QUESTIONS}, ${total}]`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const manifest: QuizBankManifest = {
    format: FORMAT_TAG,
    formatVersion: FORMAT_VERSION,
    id: m.id as string,
    title: m.title as string,
    module: isStr(m.module) ? m.module : undefined,
    language: isStr(m.language) ? m.language : undefined,
    description: isStr(m.description) ? m.description : undefined,
    author: isStr(m.author) ? m.author : undefined,
    license: isStr(m.license) ? m.license : undefined,
    sourceUrl: isStr(m.sourceUrl) ? m.sourceUrl : undefined,
    tags: Array.isArray(m.tags) ? (m.tags as string[]) : undefined,
    createdAt: isStr(m.createdAt) ? m.createdAt : undefined,
    cover: coverManifestPath ?? undefined,
    categories,
    exam,
    questions,
  };

  return { ok: true, value: { manifest, referencedAssets: referenced, coverManifestPath } };
}
