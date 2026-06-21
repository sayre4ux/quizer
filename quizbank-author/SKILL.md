---
name: quizbank-author
description: >-
  Convert a user's EXISTING question bank (CSV, Anki export, docs, slides,
  markdown, prose, screenshots) into a valid Quizer quizbank file (.json or .zip)
  they can import. Use when the user wants to import their own questions into
  Quizer, or asks to make / build / convert / prepare a question bank. Conversion
  only: extract answers from the user's source — never invent or solve them.
---

# Quizbank Author

Turn a user's existing questions into a Quizer bank file they can import. You (the
agent) do the interpretation; the bundled scripts validate the structure and
package the file.

## Hard rules — read first

1. **Convert, don't author.** Extract prompts / options / answers / explanations
   from the user's source. Never write new questions or *solve* them.
2. **Answers come from the source.** Map the source's stated answer to option
   labels. If a question has no clear answer, or the mapping is ambiguous →
   **ask the user**, or mark it `unresolved`. **Never guess.**
3. **Reason only to map source evidence to schema fields** — you may not infer
   correctness without source evidence.
4. **Validate before delivering.** Run the bundled validator; fix structural
   errors; only hand over a file that passes.
5. **You are not an answer checker.** Tell the user: answers were taken from their
   source and checked only for *structure*, not verified for *truth*.

## Workflow

1. **Read the source.** See `references/recipes/` for CSV / Anki / markdown-table /
   numbered-list / images.
2. **Confirm.** Show the detected mapping for a few items and confirm with the user
   before processing everything.
3. **Build `quizbank.json`** per `references/SCHEMA.md`, applying
   `references/INTERPRETATION.md` (answer mapping, dedupe, taxonomy, images). Record
   **every** item in `conversion-report.json` — the evidence ledger.
4. **Images:** use only the files the user supplies; match each to its question;
   never invent one. If the material is messy, keep asking the user; after **3**
   focused clarification rounds on the same unresolved image set, offer to **drop**
   those picture questions and package the rest.
5. **Validate** (fix and repeat until it passes):
   ```
   node scripts/validate-quizbank.mjs quizbank.json --assets assets --report conversion-report.json
   ```
6. **Package:**
   ```
   node scripts/pack-quizbank.mjs quizbank.json --assets assets --report conversion-report.json
   ```
   → `<id>.quizbank.json` (text-only) or `<id>.quizbank.zip` (with images).
7. **Hand over** the bank file + a short summary (counts, unresolved, dropped) and
   the structure-only-not-truth notice.

## Setup

Run `npm ci` in this folder once (installs `fflate` for packaging). Node ≥ 18.

## References

- `references/SCHEMA.md` — fields, limits, examples.
- `references/INTERPRETATION.md` — mapping messy answers to option labels; dedupe; taxonomy; images.
- `references/GUIDE.md` — the same workflow for agents outside Claude Code.
- `examples/` — a worked CSV → bank conversion + an image example.
