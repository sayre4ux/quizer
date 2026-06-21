#!/usr/bin/env node
// Validate then package a quizbank: manifest.json (+assets/) -> <id>.quizbank.{json,zip}.
// Refuses to package anything that fails the schema or the (optional) ledger check.
// Packages ONLY the validated, referenced assets. Exit 0 = wrote; 1 = refused.
import { writeFileSync, readFileSync } from 'node:fs';
import { zipSync } from 'fflate';
import { validateBank, crossCheckLedger } from './lib/validate-core.mjs';
import { loadFromManifest, parseArgs } from './lib/io.mjs';

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input) {
  console.error('Usage: pack-quizbank <quizbank.json> [--assets <dir>] (--report <conversion-report.json> | --no-report) [--out <path>]');
  process.exit(2);
}

if (!args.report && !args.noReport) {
  console.error('Refusing to package — a conversion ledger is required.');
  console.error('  Pass --report <conversion-report.json>, or --no-report for hand-authored/test manifests.');
  process.exit(1);
}

let manifest, assets;
try {
  ({ manifest, assets } = loadFromManifest(input, args.assets));
} catch (e) {
  console.error(`Could not read input: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
}

const res = validateBank(manifest, assets);
if (!res.ok) {
  console.error('Refusing to package — INVALID:');
  for (const e of res.errors) console.error(`  - ${e}`);
  process.exit(1);
}

if (args.report) {
  let report;
  try { report = JSON.parse(readFileSync(args.report, 'utf8')); }
  catch (e) { console.error(`Could not read report: ${e instanceof Error ? e.message : e}`); process.exit(1); }
  const x = crossCheckLedger(res.value.manifest, report);
  if (!x.ok) {
    console.error('Refusing to package — LEDGER MISMATCH:');
    for (const e of x.errors) console.error(`  - ${e}`);
    process.exit(1);
  }
}

const id = res.value.manifest.id;
const manifestJson = new TextEncoder().encode(JSON.stringify(manifest));
const referenced = res.value.referencedAssets; // only validated, referenced assets

let out;
if (referenced.size === 0) {
  out = args.out || `${id}.quizbank.json`;
  writeFileSync(out, manifestJson);
} else {
  const files = { 'quizbank.json': manifestJson };
  for (const [key, bytes] of referenced) files[key] = bytes;
  out = args.out || `${id}.quizbank.zip`;
  writeFileSync(out, zipSync(files));
}

console.error(`WROTE ${out} (${res.value.manifest.questions.length} questions, ${referenced.size} images)`);
