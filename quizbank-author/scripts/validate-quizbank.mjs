#!/usr/bin/env node
// Validate a quizbank manifest (+assets/) or a .quizbank.zip against the v1 schema.
// Optionally cross-check a conversion-report.json ledger (--report).
// Exit 0 = valid; 1 = invalid; 2 = usage error.
import { readFileSync } from 'node:fs';
import { validateBank, crossCheckLedger } from './lib/validate-core.mjs';
import { loadFromManifest, loadFromZip, parseArgs } from './lib/io.mjs';

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input) {
  console.error('Usage: validate-quizbank <quizbank.json | bank.zip> [--assets <dir>] [--report <conversion-report.json>]');
  process.exit(2);
}

let manifest, assets;
try {
  ({ manifest, assets } = input.endsWith('.zip') ? loadFromZip(input) : loadFromManifest(input, args.assets));
} catch (e) {
  console.error(`Could not read input: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

const res = validateBank(manifest, assets);
if (!res.ok) {
  console.error('INVALID:');
  for (const e of res.errors) console.error(`  - ${e}`);
  process.exit(1);
}

if (args.report) {
  let report;
  try { report = JSON.parse(readFileSync(args.report, 'utf8')); }
  catch (e) { console.error(`Could not read report: ${e instanceof Error ? e.message : e}`); process.exit(1); }
  const x = crossCheckLedger(res.value.manifest, report);
  if (!x.ok) {
    console.error('LEDGER MISMATCH (conversion-report.json vs manifest):');
    for (const e of x.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

const m = res.value.manifest;
console.error(
  `VALID: ${m.questions.length} questions, ${(m.categories || []).length} categories, ` +
  `${res.value.referencedAssets.size} images${args.report ? ' (ledger OK)' : ''}`,
);
