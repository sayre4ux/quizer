import { unzipSync } from 'fflate';
import { ASSETS_PREFIX, LIMITS, MANIFEST_NAME } from './format';
import type { ParsedContainer, Result } from './format';

// Accepts a user-selected .zip (manifest + assets/) or a bare .json (manifest only)
// and returns the raw container. Schema validation is validateBank()'s job.

function isZip(b: Uint8Array): boolean {
  return b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
}

function decodeJson(bytes: Uint8Array, label: string): Result<unknown> {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, errors: [`${label} is not valid UTF-8 JSON`] };
  }
}

export async function parseBankFile(file: File): Promise<Result<ParsedContainer>> {
  if (file.size > LIMITS.fileBytes) {
    return { ok: false, errors: [`file exceeds the ${LIMITS.fileBytes / (1024 * 1024)} MB limit`] };
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    return { ok: false, errors: ['could not read the file'] };
  }
  return isZip(bytes) ? parseZip(bytes) : parseBare(bytes);
}

function parseBare(bytes: Uint8Array): Result<ParsedContainer> {
  const r = decodeJson(bytes, 'file');
  if (!r.ok) return r;
  return { ok: true, value: { manifest: r.value, assets: new Map() } };
}

function parseZip(bytes: Uint8Array): Result<ParsedContainer> {
  let entries: Record<string, Uint8Array>;
  let total = 0;
  const seenNames = new Set<string>();
  try {
    // filter runs before each entry is inflated: keep only manifest + assets/, cap
    // cumulative uncompressed size (zip-bomb guard), and reject duplicate entry
    // names (fflate would otherwise silently collapse them — fail-closed instead).
    entries = unzipSync(bytes, {
      filter: (f) => {
        if (f.name !== MANIFEST_NAME && !f.name.startsWith(ASSETS_PREFIX)) return false;
        if (seenNames.has(f.name)) throw new Error(`dupe:${f.name}`);
        seenNames.add(f.name);
        total += f.originalSize;
        if (total > LIMITS.uncompressedBytes) throw new Error('zipbomb');
        return true;
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'zipbomb') {
      return { ok: false, errors: ['archive is too large when uncompressed'] };
    }
    if (e instanceof Error && e.message.startsWith('dupe:')) {
      return { ok: false, errors: [`archive contains a duplicate entry "${e.message.slice(5)}"`] };
    }
    return { ok: false, errors: ['could not read the .zip archive'] };
  }

  const manifestBytes = entries[MANIFEST_NAME];
  if (!manifestBytes) {
    return { ok: false, errors: [`archive is missing ${MANIFEST_NAME} at its root`] };
  }
  const mr = decodeJson(manifestBytes, MANIFEST_NAME);
  if (!mr.ok) return mr;

  const assets = new Map<string, Uint8Array>();
  let actual = manifestBytes.length;
  for (const [path, data] of Object.entries(entries)) {
    if (path === MANIFEST_NAME || path.endsWith('/')) continue; // skip manifest + dir entries
    if (!path.startsWith(ASSETS_PREFIX)) continue;
    actual += data.length;
    if (actual > LIMITS.uncompressedBytes) return { ok: false, errors: ['archive is too large when uncompressed'] };
    if (assets.size >= LIMITS.maxAssets) return { ok: false, errors: [`too many asset files (max ${LIMITS.maxAssets})`] };
    assets.set(path, data);
  }
  return { ok: true, value: { manifest: mr.value, assets } };
}
