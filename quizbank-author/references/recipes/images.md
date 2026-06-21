# Recipe — images & diagrams

Quizer supports an image on the prompt (`promptImage`), per option (`image`), and a
bank `cover`. You **carry through** the user's images — you never create or edit them.

## Steps

1. **Collect** the user's figures. Ask them to put the files in an `assets/` folder
   next to `quizbank.json`, or point you at where they are.
2. **Match** each figure to its question — use filenames, the user's hints ("the
   diagram on slide 12 is Q7"), or by viewing the image alongside the question text.
3. **Reference** with a relative path under `assets/`, e.g.
   `"promptImage": "assets/q7-topology.png"`. You may rename files to a tidy
   convention (`assets/q7.png`) but must not alter image content.
4. **Formats:** PNG / JPEG / WebP only. **SVG/vector → ask the user to export to
   PNG/WebP** (~2× display size). Keep each image ≤ 2 MB; if larger, ask them to
   resize (don't downscale yourself).
5. **Package** with `pack-quizbank.mjs`; it validates every referenced image
   (signature, size, path) and zips only the valid, referenced ones.

## When it's messy (clarify → drop)

If you can't tell which image belongs to a question, or files are missing:
- **Keep asking** the user, one focused question at a time.
- **Soft cap:** after **3** clarification rounds on the same unresolved image set,
  **offer to drop** those picture questions and package the rest. Record dropped
  items in the ledger as `status: "dropped-by-user"`. Text questions always ship.

Never invent a missing figure, and never guess which image goes where.
