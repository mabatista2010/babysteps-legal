# Legal channels — prepared, not published or activated

Policy B: existing app93 keeps the legacy document channel. The new client uses
explicit V2 read/status/record RPCs and accepts a shown immutable snapshot. No
mandatory update, implicit acceptance, history rewrite or legacy fail-closed.

- `privacy*.html`, `terms*.html`, existing versioned archives, shared CSS,
  index/robots/404 and `legal/manifest.json` remain byte-identical to the published
  Git base `95673d138bcbf8bc3a42caffbacb05bca985c8f0`.
- `data/legacy-channel-lock.json` fixes those hashes. The inherited June catalog /
  July public privacy mismatch is documented, NOT relabelled as new consent.
- New terms/privacy are under `legal/2026-09-24/` only. Their manifest identifies
  `checked-v2`; `currentUrl` is the immutable URL, NOT a legacy root alias.
- Privacy clauses retain July17 as their content base; September24 is the
  technical edition. Support remains `support@babysteps.space`.
- Support and recovery are operational surfaces, not a legal acceptance channel.
  Recovery/Auth configuration is a separate approval/deployment/real-QA step.

Checks:

```sh
node scripts/check-legal-manifest.mjs
node scripts/check-legal-channels.mjs
node scripts/generate-recovery.mjs --check
node scripts/test-recovery.mjs
```

These are local candidate checks, not claims of publication, human legal review,
HTTP delivery, SMTP or activation. A reviewed release must verify actual HTTP
bytes and hosting before V2 activation; do not overwrite any legacy alias or
published versioned resource. `publishedAt` is unknown until observed in a
separate deployment receipt. If the edition date changes, prepare/review a new
version before publishing; never silently backdate or rewrite this version.
