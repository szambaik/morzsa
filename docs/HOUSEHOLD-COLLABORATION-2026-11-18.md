# Household collaboration — implementation and verification

Date: 2026-11-18. Branch: codex/household-collaboration.
Base: origin/main c5febb2. Work was isolated from the other sessions.

## Customer behavior

| Requirement | Implementation |
| --- | --- |
| Shared started and favourite recipes | The active household has a shared recipe library. Each member's heart remains their own, while everyone's favourites and started recipes are discoverable under Saved. |
| Shared recipe history | Persisted recipe conversations automatically attach to their originating household. Generic conversations remain private. Explicitly unsharing a recipe history survives later progress saves and legacy adoption. |
| Current cooking | Recipe discovery, recipe reading and Overview show who is preparing, cooking or paused, with the current step where available. Completed sessions leave the current-cooking section. Dormant sessions become paused after 24 hours. |
| Independent cooking | Opening another member's history is read-only. “Saját főzés indítása” starts independent progress using the same persisted recipe and cached assets. It cannot advance the partner's steps or start their timers. |
| Safe shopping | Field-level intentions rebase against fresh server records. Case, Unicode and whitespace aliases resolve to one canonical product. Household locking, revisions and tombstones protect concurrent writes. |
| Retry safety | Persisted batch UUIDs receive durable server receipts. A committed request whose HTTP response is lost cannot run twice, even if a partner removes the item before retry. Newly queued actions stay outside a frozen retry batch. |
| Authors | Normal and focused shopping rows show the real adding/checking member. Names come from a household nickname or existing account display name. Attribution is written by the server, including edits from older clients. |
| Shared preferences | Household diet, avoided ingredients, usual portions and cooking time feed Morzsa's existing recommendation context. Personal preference overrides and personal allergy handling remain available. |
| Activity | Named notices and Overview activity describe real server events. Initial history, the viewer's own events and repeated refreshes do not produce duplicate notices. |

## Fixes found during verification

- The shopping row's fast update path refreshed quantities and notes but could leave an old author label. It now inserts, updates or removes attribution without replacing the edited row.
- The own-cooking action for shared histories previously lived inside a composer hidden in cooking mode. The visible cooking dock now provides it alongside Ingredients.
- Shared timers must not notify the viewer as if they were their own timers. Timer notifications now only use writable, owned sessions.
- The existing release harness intercepted only the legacy shopping RPC. Its save holds and failure injection now cover both the legacy and idempotent RPC, preserving all existing receipt/Undo assertions.

## Backend rollout

Apply [20261118_household_collaboration.sql](../supabase/migrations/20261118_household_collaboration.sql) **before** releasing the new client. It is transactional and repeatable, reloads the PostgREST schema and registers the new realtime tables.

The migration adds household recipe entries, household member names and idempotency receipts. Existing recipe documents, images, shopping records, local saves, RPC signatures and server attribution remain in place. New tables deny direct client writes; authenticated member RPCs perform mutations under membership checks. Read access and revocation remain protected by RLS.

Legacy started/favourite recipes are adopted into the first selected household when their owner loads the library. Recipes already attached to another household are excluded. Plain chat history is excluded. There is no destructive sweep of old shopping duplicates: normalization prevents new aliases, while historic records and tombstones are preserved.

Additive RPCs have precise missing-function fallbacks for older servers. Such a server keeps the previous personal recipe library and existing shared preferences/shopping behavior; full household recipes, nicknames and durable retry receipts require the migration. Other database/network errors are not silently downgraded.

**Deployment status:** SQL was validated in an isolated PostgreSQL-compatible fixture. It has not been applied to production in this task. No production data, invitations or paid AI calls were used. Applying the migration is still required for the complete feature to work live.

## Verification

- npm test: **370 JavaScript tests passed**, plus **11 SQL suites**, including the new household collaboration suite.
- SQL covers repeated migration, legacy adoption, explicit unshare preservation, private chats, immutable recipe IDs, independent member favourites, cooking states, shared names/preferences, normalized stale list writes, server authors, durable retry after partner deletion, direct-write denial and revoked access.
- node tests/household-collaboration.browser.mjs: **17 checks passed** with independent Anna/Peti browser contexts using the real UI against the isolated fixture.
- Browser checks include shared favourites with a separate own heart, partner cooking/history, disabled partner mutations, independent own cooking, paused states, adding/checking authors, named activity, shared dietary context, private generic chat and a real dropped-response/retry scenario.
- Responsive checks and screenshots: **320, 360, 390 and 1280 px**; no horizontal overflow or browser JavaScript errors.
- npm run build:web and npm run build:mobile: passed. This verifies the bundled frontend; no signed iPhone build was produced here.
- node design-audit/check-release.mjs: passed on the final product source. Run 2026-11-18T06-03-27-834Z-fba0b8: full audit, **32 axe scans**, **54 targeted checks**, native control scope/fallback checks, progressive recipe checks and dynamic cooking regressions.
- git diff --check: passed.

Evidence: [browser-results.json](household-collaboration-2026-11-18/browser-results.json), [mobile recipes](household-collaboration-2026-11-18/recipes-390.png), [narrow mobile recipes](household-collaboration-2026-11-18/recipes-320.png), [shopping authors/activity](household-collaboration-2026-11-18/shopping-390.png).

Fixture food imagery is synthetic test evidence; generated food-image accuracy, real Supabase realtime transport, physical-device behavior and production migration execution were not validated by these tests.
