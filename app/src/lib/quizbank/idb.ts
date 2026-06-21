import { EXAM_MAX_MINUTES, EXAM_MIN_QUESTIONS } from '../constants';
import { sniffImageMime } from './format';
import type { QuizBankManifest, ValidatedBank } from './format';
import type { QuestionProgress, Settings } from '../../types';

// Single source of truth for bank content + assets + per-bank progress.
// Staged/atomic install via one transaction.

const DB_NAME = 'quizer';
const DB_VERSION = 1;
type StoreName = 'banks' | 'bankMeta' | 'progress' | 'assets' | 'meta';
const ACTIVE_KEY = 'active';

export interface BankSummary {
  seen: number;
  mastered: number;
  accuracy: number | null;
  progressPct: number;
}
export interface BankMeta {
  installedId: string;
  sourceId: string;
  displayName: string;
  module: string | null;
  questionCount: number;
  categoryCount: number;
  importedAt: number;
  coverPath: string | null;
  summary: BankSummary;
}
export interface BankRecord {
  installedId: string;
  manifest: QuizBankManifest;
}
export interface ProgressRecord {
  installedId: string;
  questions: Record<string, QuestionProgress>;
  settings: Settings;
}
interface AssetRecord {
  key: string; // `${installedId}/${manifestPath}`
  bytes: Uint8Array;
  type: string;
}

const EMPTY_SUMMARY: BankSummary = { seen: 0, mastered: 0, accuracy: null, progressPct: 0 };

// ---- low-level helpers ----

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('banks')) db.createObjectStore('banks', { keyPath: 'installedId' });
      if (!db.objectStoreNames.contains('bankMeta')) db.createObjectStore('bankMeta', { keyPath: 'installedId' });
      if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'installedId' });
      if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('failed to open IndexedDB'));
  });
  return dbPromise;
}

function reqDone<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
    tx.onerror = () => reject(tx.error ?? new Error('transaction error'));
  });
}

async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return reqDone(db.transaction(store, 'readonly').objectStore(store).getAll() as IDBRequest<T[]>);
}

async function getOne<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDB();
  return reqDone(db.transaction(store, 'readonly').objectStore(store).get(key) as IDBRequest<T | undefined>);
}

// ---- active bank pointer ----

export async function getActiveBankId(): Promise<string | null> {
  const rec = await getOne<{ k: string; v: string | null }>('meta', ACTIVE_KEY);
  return rec?.v ?? null;
}

export async function setActiveBankId(installedId: string | null): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put({ k: ACTIVE_KEY, v: installedId });
  await txDone(tx);
}

// ---- reads ----

export const listBankMeta = () => getAll<BankMeta>('bankMeta');
export const getBankRecord = (installedId: string) => getOne<BankRecord>('banks', installedId);
export const getProgressRecord = (installedId: string) => getOne<ProgressRecord>('progress', installedId);

export async function putProgressRecord(rec: ProgressRecord): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('progress', 'readwrite');
  tx.objectStore('progress').put(rec);
  await txDone(tx);
}

export async function putBankMeta(meta: BankMeta): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('bankMeta', 'readwrite');
  tx.objectStore('bankMeta').put(meta);
  await txDone(tx);
}

export async function renameBank(installedId: string, displayName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bankMeta', 'readwrite');
    const store = tx.objectStore('bankMeta');
    const getReq = store.get(installedId);
    getReq.onsuccess = () => {
      const meta = getReq.result as BankMeta | undefined;
      if (meta) { meta.displayName = displayName; store.put(meta); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('rename failed'));
    tx.onabort = () => reject(tx.error ?? new Error('rename aborted'));
  });
}

// Read-modify-write a bank's summary in one transaction. The put is issued
// synchronously inside the get's success handler so the tx stays alive.
export async function updateBankSummary(installedId: string, summary: BankSummary): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('bankMeta', 'readwrite');
    const store = tx.objectStore('bankMeta');
    const getReq = store.get(installedId);
    getReq.onsuccess = () => {
      const meta = getReq.result as BankMeta | undefined;
      if (meta) { meta.summary = summary; store.put(meta); }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('summary update failed'));
    tx.onabort = () => reject(tx.error ?? new Error('summary update aborted'));
  });
}

// ---- dedup helpers (used by the import dialog, Phase 5) ----

export function computeInstalledId(sourceId: string, existing: Set<string>): string {
  if (!existing.has(sourceId)) return sourceId;
  let n = 1;
  while (existing.has(`${sourceId}--copy-${n}`)) n++;
  return `${sourceId}--copy-${n}`;
}

const norm = (s: string) => s.trim().toLowerCase();

export function isDisplayNameTaken(name: string, metas: BankMeta[], exceptId?: string): boolean {
  const n = norm(name);
  return metas.some((m) => m.installedId !== exceptId && norm(m.displayName) === n);
}

export function suggestDisplayName(baseName: string, metas: BankMeta[]): string {
  if (!isDisplayNameTaken(baseName, metas)) return baseName;
  let n = 1;
  while (isDisplayNameTaken(`${baseName} ${n}`, metas)) n++;
  return `${baseName} ${n}`;
}

// ---- install (staged, atomic) ----

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

function defaultSettings(m: QuizBankManifest): Settings {
  const total = m.questions.length;
  const examCount = clamp(m.exam?.count ?? Math.min(125, total), EXAM_MIN_QUESTIONS, total);
  const examMinutes = clamp(m.exam?.minutes ?? Math.round(examCount * 1.4), 1, EXAM_MAX_MINUTES);
  return { examCount, examMinutes };
}

export interface InstallResult {
  installedId: string;
  meta: BankMeta;
}

// Installs a validated bank under a fresh installedId (dedup-safe) and makes it
// active. All content/assets/progress/meta are written in ONE transaction so a
// mid-write failure rolls back wholesale — no half-installed bank (§5, Codex P1-2).
export async function installBank(validated: ValidatedBank, displayName: string): Promise<InstallResult> {
  const db = await openDB();
  const metas = await listBankMeta();
  const existing = new Set(metas.map((m) => m.installedId));
  const sourceId = validated.manifest.id;
  const installedId = computeInstalledId(sourceId, existing);

  const coverPath = validated.coverManifestPath ? `${installedId}/${validated.coverManifestPath}` : null;
  const meta: BankMeta = {
    installedId,
    sourceId,
    displayName,
    module: validated.manifest.module ?? null,
    questionCount: validated.manifest.questions.length,
    categoryCount: validated.manifest.categories?.length ?? 0,
    importedAt: nowStamp(),
    coverPath,
    summary: { ...EMPTY_SUMMARY },
  };
  const bank: BankRecord = { installedId, manifest: validated.manifest };
  const progress: ProgressRecord = { installedId, questions: {}, settings: defaultSettings(validated.manifest) };
  const assetRecs: AssetRecord[] = [...validated.referencedAssets].map(([path, bytes]) => ({
    key: `${installedId}/${path}`,
    bytes,
    type: sniffImageMime(bytes) ?? 'application/octet-stream',
  }));

  const tx = db.transaction(['banks', 'bankMeta', 'progress', 'assets'], 'readwrite');
  tx.objectStore('banks').put(bank);
  tx.objectStore('bankMeta').put(meta);
  tx.objectStore('progress').put(progress);
  const astore = tx.objectStore('assets');
  for (const a of assetRecs) astore.put(a);
  await txDone(tx); // resolves only if the whole tx committed

  await setActiveBankId(installedId); // commit the pointer last
  return { installedId, meta };
}

// importedAt timestamp — isolated so it's the only Date use here (kept out of tests' way).
function nowStamp(): number {
  return Date.now();
}

// ---- delete ----

function assetKeyRange(installedId: string): IDBKeyRange {
  return IDBKeyRange.bound(`${installedId}/`, `${installedId}/￿`);
}

export async function deleteBank(installedId: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(['banks', 'bankMeta', 'progress', 'assets'], 'readwrite');
  tx.objectStore('banks').delete(installedId);
  tx.objectStore('bankMeta').delete(installedId);
  tx.objectStore('progress').delete(installedId);
  const astore = tx.objectStore('assets');
  const cursorReq = astore.openKeyCursor(assetKeyRange(installedId));
  cursorReq.onsuccess = () => {
    const cur = cursorReq.result;
    if (cur) {
      astore.delete(cur.primaryKey);
      cur.continue();
    }
  };
  await txDone(tx);

  revokeBankAssetURLs(installedId);
  const active = await getActiveBankId();
  if (active === installedId) {
    const remaining = await listBankMeta();
    await setActiveBankId(remaining[0]?.installedId ?? null);
  }
}

// ---- asset object URLs (cached per asset key; revocable per bank) ----

const urlCache = new Map<string, string>();

export async function getAssetURL(key: string): Promise<string | null> {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const cached = urlCache.get(key);
  if (cached) return cached;
  const rec = await getOne<AssetRecord>('assets', key);
  if (!rec) return null;
  const url = URL.createObjectURL(new Blob([rec.bytes as BlobPart], { type: rec.type }));
  urlCache.set(key, url);
  return url;
}

export function revokeBankAssetURLs(installedId: string): void {
  const prefix = `${installedId}/`;
  for (const [key, url] of urlCache) {
    if (key.startsWith(prefix)) {
      URL.revokeObjectURL(url);
      urlCache.delete(key);
    }
  }
}

export function revokeAllAssetURLs(): void {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

// Test-only: close + drop the cached connection so deleteDatabase isn't blocked.
export async function __closeDbForTests(): Promise<void> {
  if (dbPromise) {
    try { (await dbPromise).close(); } catch { /* already closed */ }
    dbPromise = null;
  }
  revokeAllAssetURLs();
}
