# Quizbank v1 — field reference

A bank is a `quizbank.json` **manifest** (text-only → ship as `.json`) plus an
optional `assets/` folder of images (→ ship as `.zip`). Authoritative spec: the
app source — `app/src/lib/quizbank/format.ts` (types/limits) and `validate.ts`
(rules). The bundled validator enforces all of this and is kept in lockstep by a
parity test.

## Manifest

```jsonc
{
  "format": "quizbank",        // required, exactly this
  "formatVersion": 1,          // required, exactly 1
  "id": "my_bank",             // required; ^[a-z0-9][a-z0-9_-]{1,63}$  (lowercase, 2–64)
  "title": "My Bank",          // required, 1–120
  "module": "DEMO",            // optional, ≤32 — short header chip
  "language": "English",       // optional, ≤32
  "description": "…",          // optional, ≤2000
  "author": "…",               // optional, ≤120
  "license": "…",              // optional, ≤64
  "sourceUrl": "https://…",    // optional, ≤2048
  "tags": ["x"],               // optional, ≤32 items, each ≤32
  "createdAt": "2026-01-01",   // optional, ≤40 (not parsed)
  "cover": "assets/cover.png", // optional image (see Images)

  "categories": [              // optional taxonomy; omit if the source has none
    { "id": 1, "name": "Topic A" }   // id: positive int, unique; name ≤120; ≤64 categories
  ],

  "exam": { "count": 50, "minutes": 60 },  // optional; count ∈ [5, #questions], minutes ∈ [1, 1440]

  "questions": [ /* 5–5000 items */ ]
}
```

## Question

```jsonc
{
  "id": "q1",                 // required; unique within the file; ^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$
  "type": "single",           // optional "single" | "multi"; derived from #correct if omitted
  "prompt": "…",              // required, 1–4000
  "promptImage": "assets/d.png", // optional image
  "options": [                // 2–10 entries
    { "label": "A", "text": "…", "image": "assets/x.png" }  // label ≤8 & UNIQUE in question; text 1–1000; image optional
  ],
  "correct": ["A"],           // non-empty; each is an option label; labels must be DISTINCT
                              // single ⇒ exactly 1; multi ⇒ ≥2 (or omit type and it's derived)
  "explanation": "…",         // optional, ≤8000
  "category": 1,              // optional; must be a declared categories[].id
  "paper": "Section 1",       // optional grouping, ≤120
  "topic": "Subtopic",        // optional, ≤120
  "difficulty": 3             // optional integer 1–5
}
```

## Images

- Allowed: **PNG, JPEG, WebP** (checked by file signature, not extension). **No SVG/GIF.**
- ≤ **2 MB** per image; path ≤ 256 chars.
- Paths are **relative, under `assets/`** — no `..`, no absolute paths.
- Every referenced image must exist in `assets/`. SVG/vector diagrams must be
  rasterized to PNG/WebP first (export ~2× display size).

## Rejected (the import is fail-closed)

Unknown fields anywhere (manifest / question / option / category / exam); missing
required fields; `correct` not ⊆ options or with duplicate labels; `single` with ≠1
correct; duplicate question ids; category ref with no declared categories;
oversized/wrong-type/missing/traversing images; < 5 or > 5000 questions.
