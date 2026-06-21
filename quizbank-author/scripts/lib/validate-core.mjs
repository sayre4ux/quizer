// Quizbank v1 — standalone structural validator + ledger cross-check.
//
// A faithful JS port of app/src/lib/quizbank/{format,validate}.ts, kept in lockstep
// by app/src/lib/quizbank/parity.test.ts. Structure/syntax ONLY — it does not (and
// cannot) verify that an answer is correct. No dependencies.

export const FORMAT_TAG = 'quizbank';
export const FORMAT_VERSION = 1;
export const EXAM_MIN_QUESTIONS = 5;
export const EXAM_MAX_MINUTES = 24 * 60;

export const LIMITS = {
  fileBytes: 20 * 1024 * 1024,
  uncompressedBytes: 60 * 1024 * 1024,
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
};

export const BANK_ID_RE = /^[a-z0-9][a-z0-9_-]{1,63}$/;
export const QUESTION_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/;
export const ASSETS_PREFIX = 'assets/';
export const MANIFEST_NAME = 'quizbank.json';

const MANIFEST_KEYS = new Set([
  'format', 'formatVersion', 'id', 'title', 'module', 'language', 'description',
  'author', 'license', 'sourceUrl', 'tags', 'createdAt', 'cover', 'categories',
  'exam', 'questions',
]);
const QUESTION_KEYS = new Set([
  'id', 'type', 'prompt', 'promptImage', 'options', 'correct', 'explanation',
  'category', 'paper', 'topic', 'difficulty',
]);
const OPTION_KEYS = new Set(['label', 'text', 'image']);
const CATEGORY_KEYS = new Set(['id', 'name']);
const EXAM_KEYS = new Set(['count', 'minutes']);

export function sniffImageMime(b) {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  return null;
}

const isObj = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v) => typeof v === 'string';
const isInt = (v) => typeof v === 'number' && Number.isInteger(v);

function isSafeAssetPath(p) {
  if (!p.startsWith(ASSETS_PREFIX) || p.includes('\\')) return false;
  const segs = p.split('/');
  if (segs.length < 2) return false;
  for (const s of segs) if (s === '' || s === '.' || s === '..') return false;
  return true;
}

// validateBank(raw, assets: Map<string, Uint8Array>) -> { ok:true, value } | { ok:false, errors }
export function validateBank(raw, assets) {
  const errors = [];
  const err = (m) => errors.push(m);
  const referenced = new Map();

  const checkAsset = (ref, where) => {
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

  const checkStr = (v, where, max, required) => {
    if (v === undefined) { if (required) err(`${where} is required`); return !required; }
    if (!isStr(v)) { err(`${where} must be a string`); return false; }
    if (v.length === 0 && required) { err(`${where} must not be empty`); return false; }
    if (v.length > max) { err(`${where} exceeds ${max} chars`); return false; }
    return true;
  };

  const rejectUnknown = (o, allowed, where) => {
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

  // categories
  const categoryIds = new Set();
  let categories;
  if (m.categories !== undefined) {
    if (!Array.isArray(m.categories)) err('manifest.categories must be an array');
    else {
      if (m.categories.length > LIMITS.maxCategories) err(`manifest.categories exceeds ${LIMITS.maxCategories}`);
      const out = [];
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

  // exam
  let exam;
  if (m.exam !== undefined) {
    if (!isObj(m.exam)) err('manifest.exam must be an object');
    else {
      rejectUnknown(m.exam, EXAM_KEYS, 'exam');
      exam = {};
      if (m.exam.count !== undefined) {
        if (!isInt(m.exam.count)) err('exam.count must be an integer');
        else exam.count = m.exam.count;
      }
      if (m.exam.minutes !== undefined) {
        if (!isInt(m.exam.minutes) || m.exam.minutes < 1 || m.exam.minutes > EXAM_MAX_MINUTES) {
          err(`exam.minutes must be an integer in [1, ${EXAM_MAX_MINUTES}]`);
        } else exam.minutes = m.exam.minutes;
      }
    }
  }

  // cover
  const coverManifestPath = m.cover === undefined ? null : checkAsset(m.cover, 'manifest.cover');

  // questions
  const questions = [];
  if (!Array.isArray(m.questions)) {
    err('manifest.questions must be an array');
  } else {
    if (m.questions.length < EXAM_MIN_QUESTIONS) err(`a bank needs at least ${EXAM_MIN_QUESTIONS} questions (got ${m.questions.length})`);
    if (m.questions.length > LIMITS.maxQuestions) err(`too many questions (max ${LIMITS.maxQuestions})`);
    const seenIds = new Set();
    const dupIds = new Set();
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

      const labels = new Set();
      const validOptions = [];
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

      let correct = [];
      if (!Array.isArray(q.correct) || q.correct.length === 0) {
        err(`${where}.correct must be a non-empty array of option labels`);
      } else if (!q.correct.every(isStr)) {
        err(`${where}.correct must contain only strings`);
      } else {
        correct = q.correct;
        const seenCorrect = new Set();
        for (const c of correct) {
          if (!labels.has(c)) err(`${where}.correct references unknown label "${c}"`);
          else if (seenCorrect.has(c)) err(`${where}.correct lists "${c}" more than once`);
          else seenCorrect.add(c);
        }
      }

      let type;
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

    if (exam && exam.count !== undefined) {
      const total = m.questions.length;
      if (exam.count < EXAM_MIN_QUESTIONS || exam.count > total) {
        err(`exam.count must be an integer in [${EXAM_MIN_QUESTIONS}, ${total}]`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const manifest = {
    format: FORMAT_TAG,
    formatVersion: FORMAT_VERSION,
    id: m.id,
    title: m.title,
    module: isStr(m.module) ? m.module : undefined,
    language: isStr(m.language) ? m.language : undefined,
    description: isStr(m.description) ? m.description : undefined,
    author: isStr(m.author) ? m.author : undefined,
    license: isStr(m.license) ? m.license : undefined,
    sourceUrl: isStr(m.sourceUrl) ? m.sourceUrl : undefined,
    tags: Array.isArray(m.tags) ? m.tags : undefined,
    createdAt: isStr(m.createdAt) ? m.createdAt : undefined,
    cover: coverManifestPath ?? undefined,
    categories,
    exam,
    questions,
  };

  return { ok: true, value: { manifest, referencedAssets: referenced, coverManifestPath } };
}

const sameSet = (a, b) => {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
};

// Structural ledger<->manifest cross-check (Codex P1). Structure-only: confirms the
// evidence ledger matches the packaged manifest; does NOT judge answer truth.
// crossCheckLedger(manifest, report) -> { ok:true } | { ok:false, errors }
export function crossCheckLedger(manifest, report) {
  const errors = [];
  const rows = Array.isArray(report) ? report : (report && Array.isArray(report.items) ? report.items : null);
  if (!rows) return { ok: false, errors: ['conversion report has no items array'] };

  const qById = new Map(manifest.questions.map((q) => [q.id, q]));
  const okCount = new Map();

  for (const r of rows) {
    if (!r || typeof r !== 'object') { errors.push('a ledger row is not an object'); continue; }
    if (r.status === 'ok') {
      if (r.id == null) { errors.push('an "ok" ledger row has no id'); continue; }
      okCount.set(r.id, (okCount.get(r.id) || 0) + 1);
      const q = qById.get(r.id);
      if (!q) { errors.push(`ledger "ok" row "${r.id}" has no matching manifest question`); continue; }
      // mappedCorrect must be a real string[] — sameSet() would otherwise treat a
      // string like "AB" as the iterable {"A","B"} and let malformed reports pass.
      if (!Array.isArray(r.mappedCorrect) || !r.mappedCorrect.every((x) => typeof x === 'string')) {
        errors.push(`ledger "${r.id}" mappedCorrect must be an array of strings`);
      } else if (!sameSet(r.mappedCorrect, q.correct || [])) {
        errors.push(`ledger "${r.id}" mappedCorrect does not equal the manifest's correct`);
      }
    } else {
      if (r.id != null && qById.has(r.id)) {
        errors.push(`ledger "${r.id}" is "${r.status}" but appears in the manifest`);
      }
    }
  }

  for (const q of manifest.questions) {
    const c = okCount.get(q.id) || 0;
    if (c === 0) errors.push(`manifest question "${q.id}" has no "ok" ledger row`);
    else if (c > 1) errors.push(`manifest question "${q.id}" has ${c} "ok" ledger rows`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
