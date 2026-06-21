# Recipe — Anki export

Anki decks export as `.apkg`/`.colpkg` (a zip with a SQLite collection + a
`collection.media` folder) or as a tab-separated `.txt`.

- **TSV export:** each row is `front<TAB>back` (+ optional tags). Many decks aren't
  multiple-choice — if the back is just the answer text with no options, this is
  **not** a quizbank question; tell the user (MCQ-style sources only) unless options
  can be reconstructed from the source.
- **MCQ-style notes:** when the note has a question + lettered options + a marked
  answer (e.g. cloze or a custom note type), map options/answer per the CSV recipe.
- **Media:** images are referenced in fields as `<img src="foo.png">`; the binaries
  live in `collection.media`. Copy referenced images into `assets/` and rewrite the
  refs to `assets/foo.png` (see `images.md`). HTML in fields → convert to plain text
  (strip tags; keep the text).

Anything that isn't clearly a multiple-choice question with a source-stated answer →
`unresolved` / ask the user. Never fabricate options or an answer.
