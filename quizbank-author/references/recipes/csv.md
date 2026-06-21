# Recipe — CSV / spreadsheet

Common shapes:

```
question, A, B, C, D, answer, explanation, category
"What is 2+2?", "3", "4", "5", "6", "B", "2+2=4", "Math"
```

Mapping:
- Each option column (`A`–`D`, or `option1`…`optionN`) → an `options[]` entry with
  that column letter/number as the **label** and the cell as the **text**. Skip
  empty option cells.
- The `answer` column → `correct` via `INTERPRETATION.md` (it may be a label `B`, a
  letter list `B,C`, or the full option text).
- `explanation` / `category` / `topic` / `paper` columns map to those fields.
  Categories: collect the distinct category names into `categories[]` and reference
  by id.
- `question.id`: use an `id` column if present, else assign `q1`, `q2`, … in order.

Watch for: quoted commas, header variations (`Correct`, `Ans`, `Key`), and answer
cells that name the option text rather than its letter (use exact-text matching).
Anything ambiguous → `unresolved` + ask the user.
