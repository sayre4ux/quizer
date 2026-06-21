# Quizbank Author — portable guide (any agent)

For agents outside Claude Code (ChatGPT, Cursor, claude.ai, …). Same workflow as
`SKILL.md`; here it's self-contained. Paste this file + `SCHEMA.md` +
`INTERPRETATION.md` to your agent, or point it at this folder.

## What you're doing

Convert the user's **existing** questions into a `quizbank.json` (+ optional
`assets/` images) that imports into Quizer. **Conversion only** — extract answers
from the source, never invent or solve them. See the hard rules in `SKILL.md`.

## Steps

1. **Read** the user's source. Recognize its shape with `recipes/`
   (CSV / Anki / markdown-table / numbered-list / images).
2. **Confirm** the detected mapping on a few items with the user.
3. **Build** `quizbank.json` per `SCHEMA.md`, applying `INTERPRETATION.md` for
   answer→label mapping, dedupe, taxonomy, and images. Write a
   `conversion-report.json` evidence ledger (one row per source item).
4. **Images:** use only user-supplied files; match each to its question; never
   invent one. If messy, keep asking; after 3 rounds, offer to drop those questions.
5. **Validate** (the user runs this, or you do if you have a shell):
   ```
   node scripts/validate-quizbank.mjs quizbank.json --assets assets --report conversion-report.json
   ```
   Fix the reported **structural** errors and repeat until it passes.
6. **Package:**
   ```
   node scripts/pack-quizbank.mjs quizbank.json --assets assets --report conversion-report.json
   ```
   Produces `<id>.quizbank.json` (text) or `<id>.quizbank.zip` (with images).
7. **Deliver** the file + a summary (counts, unresolved, dropped) and this notice:
   *answers were taken from the source and checked only for structure, not truth.*

## If you have no shell

Still produce `quizbank.json` strictly per `SCHEMA.md` and hand it to the user with
the validate/pack commands above — the app will also reject anything malformed on
import, but running the validator first saves a round-trip.
