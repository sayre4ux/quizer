// Filesystem/zip loaders that produce the (manifest, assets-map) shape the core
// validator expects. The map key is the manifest-relative path (e.g. assets/x.png).
import { lstatSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { unzipSync } from 'fflate';
import { ASSETS_PREFIX, LIMITS, MANIFEST_NAME } from './validate-core.mjs';

function dirExists(p) {
  try {
    const stat = lstatSync(p);
    if (stat.isSymbolicLink()) throw new Error(`assets directory must not be a symbolic link: ${p}`);
    return stat.isDirectory();
  } catch (e) {
    if (e && typeof e === 'object' && e.code === 'ENOENT') return false;
    throw e;
  }
}

function walk(root, dir, assets) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = lstatSync(full);
    const rel = path.relative(root, full).split(path.sep).join('/');
    if (stat.isSymbolicLink()) throw new Error(`symbolic links are not allowed in assets: ${rel}`);
    if (stat.isDirectory()) {
      walk(root, full, assets);
      continue;
    }
    if (!stat.isFile()) throw new Error(`unsupported asset file type: ${rel}`);
    if (rel.startsWith('../') || path.isAbsolute(rel)) throw new Error(`asset escapes the assets directory: ${rel}`);
    assets.set(ASSETS_PREFIX + rel, new Uint8Array(readFileSync(full)));
  }
}

// Load a manifest.json plus its sibling assets/ dir (or an override dir).
export function loadFromManifest(manifestPath, assetsDirOverride) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const assets = new Map();
  const assetsDir = assetsDirOverride || path.join(path.dirname(manifestPath), 'assets');
  if (dirExists(assetsDir)) walk(assetsDir, assetsDir, assets);
  return { manifest, assets };
}

// Load a .quizbank.zip (manifest at root + assets/). Mirrors the app's container
// parser (app/src/lib/quizbank/parse.ts) so the validator can't pass a ZIP the app
// would reject: file-size cap, uncompressed-size (zip-bomb) cap, duplicate-entry
// rejection, and asset-count cap.
export function loadFromZip(zipPath) {
  const raw = new Uint8Array(readFileSync(zipPath));
  if (raw.length > LIMITS.fileBytes) {
    throw new Error(`file exceeds the ${LIMITS.fileBytes / (1024 * 1024)} MB limit`);
  }

  let total = 0;
  const seen = new Set();
  let entries;
  try {
    // filter runs before each entry is inflated: keep only manifest + assets/, cap
    // cumulative uncompressed size, and fail-closed on duplicate entry names.
    entries = unzipSync(raw, {
      filter: (f) => {
        if (f.name !== MANIFEST_NAME && !f.name.startsWith(ASSETS_PREFIX)) return false;
        if (seen.has(f.name)) throw new Error(`dupe:${f.name}`);
        seen.add(f.name);
        total += f.originalSize;
        if (total > LIMITS.uncompressedBytes) throw new Error('zipbomb');
        return true;
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === 'zipbomb') throw new Error('archive is too large when uncompressed');
    if (e instanceof Error && e.message.startsWith('dupe:')) throw new Error(`archive contains a duplicate entry "${e.message.slice(5)}"`);
    throw e;
  }

  const manifestBytes = entries[MANIFEST_NAME];
  if (!manifestBytes) throw new Error(`zip is missing ${MANIFEST_NAME} at its root`);
  const manifest = JSON.parse(Buffer.from(manifestBytes).toString('utf8'));
  const assets = new Map();
  for (const [name, data] of Object.entries(entries)) {
    if (name === MANIFEST_NAME || name.endsWith('/') || !name.startsWith(ASSETS_PREFIX)) continue;
    if (assets.size >= LIMITS.maxAssets) throw new Error(`too many asset files (max ${LIMITS.maxAssets})`);
    assets.set(name, data);
  }
  return { manifest, assets };
}

export function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--assets') o.assets = argv[++i];
    else if (a === '--report') o.report = argv[++i];
    else if (a === '--no-report') o.noReport = true;
    else if (a === '--out') o.out = argv[++i];
    else o._.push(a);
  }
  return o;
}
