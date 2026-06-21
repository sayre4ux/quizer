import { parseBankFile } from './quizbank/parse';
import { validateBank } from './quizbank/validate';
import { installBank, isDisplayNameTaken, listBankMeta, suggestDisplayName } from './quizbank/idb';
import type { BankMeta } from './quizbank/idb';
import type { ValidatedBank } from './quizbank/format';
import { afterImport, enterEphemeral } from './activeBank';

export interface PreparedImport {
  ok: true;
  validated: ValidatedBank;
  metas: BankMeta[];
  suggestedName: string;
  sourceExists: boolean; // a bank with this sourceId is already installed → separate copy
}
export interface PreparedError {
  ok: false;
  errors: string[];
}

// Step 1: parse + validate a file and compute the suggested unique display name.
export async function prepareImport(file: File): Promise<PreparedImport | PreparedError> {
  const parsed = await parseBankFile(file);
  if (!parsed.ok) return { ok: false, errors: parsed.errors };
  const validated = validateBank(parsed.value.manifest, parsed.value.assets);
  if (!validated.ok) return { ok: false, errors: validated.errors };

  const metas = await listBankMeta();
  const sourceId = validated.value.manifest.id;
  return {
    ok: true,
    validated: validated.value,
    metas,
    suggestedName: suggestDisplayName(validated.value.manifest.title, metas),
    sourceExists: metas.some((m) => m.sourceId === sourceId),
  };
}

// Re-export so the dialog can run live availability checks without reaching into idb.
export { isDisplayNameTaken };

// Step 2: install under the chosen (unique) display name and activate it.
export async function finalizeImport(validated: ValidatedBank, displayName: string): Promise<string> {
  const { installedId } = await installBank(validated, displayName.trim());
  await afterImport(installedId);
  return installedId;
}

const SAMPLE_URL = `${import.meta.env.BASE_URL}samples/demo.quizbank.json`;

// Open the bundled sample as an EPHEMERAL trial (precached for offline). It is
// never persisted — no IDB record, nothing in the carousel/Manage, discarded on
// exit. Progress is in-memory only.
export async function importSampleEphemeral(): Promise<{ ok: true } | PreparedError> {
  let text: string;
  try {
    const res = await fetch(SAMPLE_URL);
    if (!res.ok) return { ok: false, errors: ['could not load the sample bank'] };
    text = await res.text();
  } catch {
    return { ok: false, errors: ['could not load the sample bank (offline?)'] };
  }
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['sample bank is not valid JSON'] };
  }
  const validated = validateBank(manifest, new Map());
  if (!validated.ok) return { ok: false, errors: validated.errors };
  enterEphemeral(validated.value);
  return { ok: true };
}
