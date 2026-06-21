import { describe, it, expect } from 'vitest';
import { validateBank as appValidate } from './validate';
import { fixtures } from './fixtures';
import type { Result, ValidatedBank } from './format';
import { validateBank as coreValidate } from '../../../../quizbank-author/scripts/lib/validate-core.mjs';

// Anti-drift: the standalone skill validator (JS) must produce identical results to
// the app validator (TS) — same ok/err, same errors, and on success the same
// normalized output (manifest, cover path, referenced asset keys).
function norm(r: Result<ValidatedBank>) {
  if (!r.ok) return { ok: false as const, errors: [...r.errors].sort() };
  return {
    ok: true as const,
    manifest: JSON.stringify(r.value.manifest),
    cover: r.value.coverManifestPath,
    assets: [...r.value.referencedAssets.keys()].sort(),
  };
}

describe('parity: app validator ≡ skill validate-core', () => {
  for (const f of fixtures) {
    it(f.name, () => {
      const app = norm(appValidate(f.manifest, f.assets));
      const core = norm(coreValidate(f.manifest, f.assets) as Result<ValidatedBank>);
      expect(core).toEqual(app);
    });
  }
});
