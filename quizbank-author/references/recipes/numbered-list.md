# Recipe — numbered list / quiz prose

Free-form quiz text, e.g.:

```
7) Which protocol encrypts web traffic?
   a. HTTP
   b. HTTPS
   c. FTP
   Correct answer: b (HTTPS encrypts via TLS)

8. Select all that apply: which are private IP ranges?
   A) 10.0.0.0/8
   B) 8.8.8.0/24
   C) 192.168.0.0/16
   Answers: A, C
```

- The leading number → question order (and `id` if you have no better one: `q7`, `q8`).
- Lettered/numbered lines → `options[]` (label = the letter/number, normalized to a
  consistent case; text = the rest of the line).
- The `Answer(s):` / `Correct:` line → `correct` (single or comma/`and`-separated →
  `multi`). Trailing rationale → `explanation`.
- Watch for inconsistent label casing (`a` vs `A`) — normalize labels within each
  question and keep `correct` consistent with them.

If a question has no answer line, or the answer letter isn't among the options →
`unresolved` + ask the user. Never infer the answer.
