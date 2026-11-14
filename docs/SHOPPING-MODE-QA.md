# Shopping Mode release verification

Verified 14 November 2026.

## Automated verification

- `npm test`: 193 JavaScript tests passed, plus all eight SQL suites.
- Shopping SQL checks: repeatable migration, two members sharing the active session, server purchase attribution, conflicting route changes, atomic rollback, retry-safe completion, unchecked/custom-item preservation and non-member isolation.
- Session tests: short reopen, 25-minute boundary, retained history, protected drafts, active recipes and shopping progress.
- `npm run build:web`: succeeded with 46 runtime files.
- Production: shopping migration applied; both new tables have RLS, all three RPCs exist and the tables are in the realtime publication.

## Frontend verification

The existing frontend was exercised with the local simulation fixture and canned AI/image responses. Mobile widths of 320 and 390 px and desktop at 1440 px had no horizontal overflow. Purchase controls are 44 by 44 px.

Verified start/resume, one-tap purchase moving into the completed section, purchased quick-add, duplicate handling, removal/undo, search, category navigation/route ordering, session reload and purchase completion/history. The final pass also checked list removal/undo from the pantry without changing the destination.

Recipe preview does not create a thread; explicit cooking start does. Full reading shows the compact ingredients/question dock and hides the full composer. Useful step images are requested automatically and cached. Tests checked 10-minute and 30-minute reopen, protected drafts and active recipe-step restoration.

Final screenshots:

- [Mobile cooking](../design/product-evolution-2026-11-13/qa/07-cooking-mobile-final.png)
- [Mobile Shopping Mode](../design/product-evolution-2026-11-13/qa/08-shopping-mobile-final.png)
- [Desktop Shopping Mode](../design/product-evolution-2026-11-13/qa/09-shopping-desktop-final.png)

The fixture uses a canned food photograph; the cooking screenshot does not establish live recipe-image relevance. No browser console errors were observed.

## Remaining validation

Database tests exercise two-member safety. A real two-phone supermarket trial, native keyboard/microphone/offline behavior and live image-generation quota/quality still need validation. The paid tier is a proposal; no billing or paid provider has been enabled.
