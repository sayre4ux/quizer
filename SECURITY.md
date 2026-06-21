# Security Policy

## Scope

Quizer processes untrusted input: JSON manifests and ZIP archives containing
question banks are imported directly in the browser. The validation layer
(`app/src/lib/quizbank/validate.ts`) and its standalone port
(`quizbank-author/scripts/lib/validate-core.mjs`) enforce structural, size, and
format constraints before any data reaches the application state.

Relevant attack surface:
- JSON parsing of arbitrary manifests
- ZIP decompression (via fflate) with zip-bomb and path-traversal guards
- Image format sniffing (magic-byte validation, no extension trust)
- IndexedDB storage of imported data

## Reporting a Vulnerability

If you discover a security issue, please report it privately via
[GitHub Security Advisories](https://github.com/sayre4ux/quizer/security/advisories/new).

Please include:
- Description of the vulnerability
- Steps to reproduce
- Impact assessment

I will acknowledge receipt within 72 hours and aim to resolve confirmed issues
within 14 days.

## Out of Scope

- Denial-of-service via large but valid question banks (bounded by format limits)
- Browser-local data (IndexedDB) accessible to same-origin scripts (expected)
