# Recipe — Markdown / doc tables

A common doc shape:

```
| # | Question        | A    | B    | C    | Answer | Explanation |
|---|-----------------|------|------|------|--------|-------------|
| 1 | What is 2+2?    | 3    | 4    | 5    | B      | 2+2=4       |
```

- Header cells name the option columns (`A`/`B`/`C` → labels) and the meta columns
  (`Answer`, `Explanation`, `Category`, `Topic`).
- Map answer → `correct` per `INTERPRETATION.md`.
- Prose docs (not tables) often look like:
  ```
  1. What is 2+2?
     A) 3   B) 4   C) 5
     Answer: B — because 2+2=4
  ```
  Parse the lettered options and the `Answer:` line; the trailing rationale → `explanation`.
- Multiple tables / sections → use the section heading as `paper` or `category`.

Ambiguous answer lines (e.g. "B or C", "see notes") → `unresolved` + ask the user.
