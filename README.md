# BabySteps Legal

Static public legal website for BabySteps.

Published with GitHub Pages.

- Privacy Policy: `privacy.html`
- Support: `support.html`
- Password reset bridge: `reset-password.html`

## Checks

Before publishing password recovery changes, run:

```sh
node scripts/check-reset-page.mjs --verify-cdn
```

The check verifies the reset page has no server-only secrets, blocks indexing/referrers, supports Supabase recovery payload formats, and matches the pinned Supabase JS CDN SRI hash.

This repository intentionally contains only public legal/support pages and no app source code or secrets.
