# BabySteps Legal

Static public legal website for BabySteps in Spanish, English, French,
Portuguese (Portugal) and Italian.

Published with GitHub Pages.

- Privacy Policy: `privacy*.html`
- Terms of Use: `terms*.html`
- Support: `support*.html`
- Password reset bridge: `reset-password.html`

Versioned legal documents live under `legal/<date>/`. The v2 manifest at
`legal/manifest.json` versions each document family independently, so a privacy
update does not silently re-version unchanged terms.

## Checks

Before publishing legal or password recovery changes, run:

```sh
node scripts/check-legal-manifest.mjs
node scripts/check-reset-page.mjs --verify-cdn
```

The manifest check verifies the approved-human-review and publication gates,
the 5 × 2 privacy/terms matrix, exact current and versioned URLs, byte identity
for current/versioned privacy pages, per-family versions, versioned SHA-256
hashes, the admin-auth cookie inventory and the explicit analytics activation
gate. The reset check verifies the recovery page has no server-only secrets,
blocks indexing/referrers, supports Supabase recovery payload formats, and
matches the pinned Supabase JS CDN SRI hash.

This repository intentionally contains only public legal/support pages and no app source code or secrets.
