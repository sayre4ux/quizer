# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, …) working on this
repository. Humans: see [README.md](README.md).

## What this repo is

Quizer is a local-first, offline-capable PWA for drilling exam question banks.
No backend, no accounts — question banks are imported at runtime into IndexedDB.

Two independent packages, no monorepo tool:

| Path | What it is |
|------|------------|
| `app/` | The web app — Vite + React 19 + TypeScript + Tailwind v4 |
| `quizbank-author/` | Standalone Node CLI that converts/validates/packages question banks |

The two share a format contract: `app/src/lib/quizbank/` is authoritative;
`quizbank-author/scripts/lib/validate-core.mjs` is a faithful port, kept in
lockstep by `app/src/lib/quizbank/parity.test.ts`. **If you change one
validator, change the other and keep the parity test green.**

## Setup & commands

Node `^20.19.0 || >=22.12.0` (see `.node-version`). Each package installs
separately.

```sh
# app
cd app && npm ci
npm run dev      # local dev server
npm test         # vitest
npm run lint     # eslint
npm run build    # tsc -b + vite build (also runs the type-check)

# authoring tool
cd quizbank-author && npm ci
```

## Required checks before you finish

From `app/`, all three must pass:

```sh
npm test && npm run lint && npm run build
```

`npm run build` runs `tsc -b`, so it is also the type-check. The project is
`strict: true` — do not weaken compiler options to make errors go away.

## Conventions

- **TypeScript strict.** No `any`, no `@ts-ignore`. Fix types properly.
- **Tests are real.** Assert specific values/behavior; never pad with trivially-
  true assertions or stub out the thing under test. New logic needs new tests.
- **Security boundary.** `app/src/lib/quizbank/validate.ts` and its port validate
  untrusted JSON/ZIP input. Treat changes there as security-sensitive: fail
  closed, preserve the zip-bomb / path-traversal / symlink / size guards, and run
  the parity test.
- **No new dependencies** without a clear reason — the app deps are intentionally
  lean.
- **Comments** explain *why*, not *what*. Match surrounding style.
- **Privacy.** The app makes no network calls after first load and stores
  everything client-side. Don't add telemetry, analytics, or remote calls.

## Project map

```
app/src/
  App.tsx              top-level shell + navigation
  modes/               study modes (Drill, Exam, Review, SRS, Analysis) + dialogs
  components/          UI primitives, charts, question/module cards
  lib/
    quizbank/          format spec, validator, parser, IndexedDB layer (authoritative)
    activeBank.ts      boot + bank-switch orchestrator (atomic dataset+progress swap)
    storage.ts         in-memory progress store, debounced write-through to IDB
    srs.ts             SM-2 spaced repetition
    stats.ts           mastery / accuracy / readiness aggregations
    pools.ts           question pool selection + seeded shuffle
quizbank-author/
  scripts/             validate + pack CLIs
  references/          format spec + conversion recipes (also agent-facing)
  SKILL.md             agent instructions for converting a user's bank
```

## Helping a user build their own question bank

If a user wants to import their own questions into Quizer (they mention CSV, Anki,
a doc, slides, screenshots, or "make/convert/prepare a question bank"), use the
**quizbank-author** skill — do not hand-roll the format.

- It's distributed as a Claude Code plugin. If it isn't already available, point
  the user to install it:
  `/plugin marketplace add sayre4ux/quizer` then
  `/plugin install quizbank-author@quizer`.
- The skill's full instructions live in
  [`quizbank-author/SKILL.md`](quizbank-author/SKILL.md), with reference material
  in [`quizbank-author/references/`](quizbank-author/references/).
- **Conversion only.** Extract answers from the user's source. Never invent or
  solve questions. Record every item in the conversion ledger.
- Always finish by running the bundled `validate` and `pack` scripts so the output
  is guaranteed-importable.

## Gotchas

- **Service worker caching.** A stale SW from a prior `preview`/build on the same
  origin will keep serving the old bundle. Dev mode does not register an SW; if
  edits seem to have "no effect," clear that origin's site data or use a private
  window.
- **Live module bindings.** `app/src/lib/dataset.ts` exports are reassigned at
  runtime by `applyDataset()`. Read them inside functions/render, not at import
  time, or you'll capture an empty initial dataset.
- **Bank switching is serialized.** Don't bypass `switchBank()` in `activeBank.ts`
  — it gates the UI and drains rapid selections so progress can't cross banks.
