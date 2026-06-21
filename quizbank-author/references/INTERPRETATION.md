# Interpretation guidance (for the agent)

How to turn messy source items into valid schema fields **without inventing
answers**. This is judgment guidance — apply intelligence, but stay faithful.

## The fidelity rule

The `correct` answer must come from the user's source. You may reason **only to map
the source's stated answer to option labels** — never to *work out* the answer
yourself. If a question has no answer in the source, or you can't map it
confidently, it is **`unresolved`** (ask the user) — never a guess.

## Mapping the answer to option labels

`correct` is an array of option **labels** (e.g. `["B"]`). Sources state answers
many ways; map by these, in order, and stop at the first confident match:

1. **Exact label** — the source says `B` and `B` is an option label → `["B"]`.
2. **Normalized label** — `B.`, `b)`, `(B)` → `B`. A positional index (`2`, `#2`,
   `(2)`) → the label of the 2nd option.
3. **Exact option text** — the source gives the full answer text and it matches
   exactly one option's text (case/space-insensitive) → that option's label.
4. **Multi-answer** — split on one explicit separator (`,` `;` `/` `&` or "and"),
   map each part by 1–3; **all** parts must resolve uniquely. Set `type: "multi"`.
5. **True/False** — only if the options are exactly those.

If two rules disagree, or a token matches >1 option, or nothing matches → mark the
item `unresolved` and tell the user why. Record the chosen rule in the ledger.

## The evidence ledger (`conversion-report.json`)

Write one row per source item — this is the user's audit trail. Required fields:

```jsonc
{
  "id": "q1",                 // emitted question id, or null if unresolved/dropped
  "sourceRef": "row 3",       // where it came from
  "sourceExcerpt": "…",       // short VERBATIM snippet of the source incl. its answer
  "rawAnswer": "B. Firewall", // the answer exactly as the source wrote it
  "mappedCorrect": ["B"],     // resulting labels (must equal the question's correct)
  "chosenOptionText": "Firewall", // text of the mapped option(s)
  "mappingNote": "normalized label 'B.'",
  "status": "ok",             // ok | unresolved | needs-user | duplicate | dropped-by-user
  "reason": null
}
```

`pack-quizbank.mjs --report` cross-checks this against the manifest (ids match,
`mappedCorrect` == `correct`, non-`ok` rows absent from the bank) and refuses to
package on mismatch.

## Taxonomy

Use categories/topics **only if the source has them**. Otherwise leave the bank
uncategorized (the app handles that). You may *propose* a category list, but only as
labels and only after the user approves — it never changes any `correct`.

## Dedupe

Flag near-duplicate prompts (normalized text) in the report as `status:"duplicate"`;
let the user decide whether to drop. Duplicate question **ids** are invalid — assign
fresh sequential ids if the source lacks stable ones.

## Images (best-effort + clarify + drop)

- Use only files the user supplies; reference them via `promptImage` / option
  `image` / `cover`. Tidy filenames if helpful; **never edit or invent** a figure.
- Match each figure to its question from filenames, the user's hints, or by viewing
  the image. SVG/vector → ask the user to rasterize to PNG/WebP.
- If which-image-goes-where is unclear or files are missing, **keep asking the
  user**, one focused question at a time.
- **Soft cap:** after **3** clarification rounds on the same unresolved image set,
  **offer to drop** those picture questions and package the rest (ledger
  `status:"dropped-by-user"`). The user may choose to keep clarifying.

## Scale

For large sets, process in batches (e.g. 50–100), then merge into one manifest and
validate the whole. Keep ids stable across batches.
