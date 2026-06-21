# quizbank-author

Convert an existing question bank into a valid **Quizer** quizbank file (format v1)
that can be imported via *Add a question bank*. Designed to be run by an AI agent
(Claude Code via `SKILL.md`, or any capable agent via `references/GUIDE.md`), with
deterministic scripts that **validate the structure** and **package** the result.

> **Conversion only.** The agent extracts questions/answers from *your* source and
> never invents or solves them. The scripts check **structure/syntax**, not whether
> an answer is correct.

## Recommended models

This skill does careful extraction from messy, sometimes visual sources (scanned
tables, screenshots, ambiguous multi-answer questions). Fidelity matters more than
speed — a dropped or misread answer becomes a wrong flashcard.

What works well is **any mature, multi-capability model with solid long-context
reasoning** — and **vision is required if your source includes images or
screenshots**. The single most important filter is therefore *can the model see
images*, not the brand.

**Vision-capable (recommended — works for image/screenshot sources):**

| Model (or newer) | Type | Notes |
|------------------|------|-------|
| Claude Opus 4.x (e.g. 4.8) | Frontier, hosted | Strong on ambiguous answer mappings and long/messy sources |
| GPT-5.5 | Frontier, hosted | Comparable general-purpose choice |
| Qwen 3.7 Plus | Hosted | Multimodal sibling of Qwen 3.7 Max — sees images/video, cheaper |
| Qwen VL (open-weight, e.g. 3.x-VL) | Open-weight, self-host | Good open option; quality depends on quantization — prefer higher-bit (≥ Q5 / 8-bit) |

**Text-only — fine for clean text sources, *not* for images/screenshots:**

| Model | Why text-only matters here |
|-------|----------------------------|
| Qwen 3.7 Max | Strong on agentic/coding tasks, but text-only — use Qwen 3.7 Plus for image sources |
| DeepSeek V4 (base) | Launched text-first; a Vision mode is rolling out — confirm your endpoint actually supports images before using it on screenshots |
| GLM 5.2 | Vision support is unconfirmed for the base model; its family handles images via a separate vision model (GLM-V) — treat as text-only unless you verify |

Notes:

- **This is capability guidance as of mid-2026, not a benchmark.** I haven't formally
  measured each model on this skill, and model lines move fast — capabilities
  (especially vision) change between point releases, so **verify the current model's
  modalities before relying on it.** Real-world results are very welcome — open an issue.
- **Avoid the smallest/fastest tiers** (e.g. Haiku-class, mini/nano, tiny local
  models) for the *interpretation* step — they tend to drop edge cases on real sources.
- The deterministic `validate`/`pack` scripts use **no model at all**, so model
  choice only affects conversion quality, never the structural guarantees.

## Install

```sh
npm ci          # installs fflate (used only by the packager)
```

Node ≥ 18. The validator itself is dependency-free.

## Use

```sh
# validate a manifest (+ optional assets/ and conversion ledger)
node scripts/validate-quizbank.mjs quizbank.json --assets assets --report conversion-report.json
# or validate a packaged bank
node scripts/validate-quizbank.mjs mybank.quizbank.zip

# package -> <id>.quizbank.json (text) or <id>.quizbank.zip (with images)
node scripts/pack-quizbank.mjs quizbank.json --assets assets --report conversion-report.json --out mybank.quizbank.zip
```

`pack-quizbank` **requires** a conversion ledger (`--report`): it refuses to package
anything that fails the schema or the ledger↔manifest cross-check, and zips **only**
the validated, referenced assets. For hand-authored or test manifests with no ledger,
pass `--no-report` to opt out explicitly.

## Layout

- `SKILL.md` — Claude Code entry (the agent workflow + hard rules).
- `references/` — `SCHEMA.md`, `GUIDE.md`, `INTERPRETATION.md`, `recipes/`.
- `scripts/` — `validate-quizbank.mjs`, `pack-quizbank.mjs`, `lib/validate-core.mjs`.
- `examples/` — a worked CSV conversion + an image example.

## Format

The validator is a faithful port of the Quizer app's own validator and is kept in
lockstep by a parity test in the app repo (`app/src/lib/quizbank/parity.test.ts`).
The authoritative format spec is the app source — `app/src/lib/quizbank/format.ts`
(types/limits) and `validate.ts` (rules); `references/SCHEMA.md` is the readable
field reference.
