# Browser harness implementation handoff

browser.mjs exports runBrowser({runDir,profile,repoRoot}). It is ready for an engine run. fixture.mjs exports startFixture({repoRoot,port=0}) and actors; returns {origin,ai,calls,unexpected,db,close}. auditContext(browser,origin,options) is exported for safe supplemental probes; every network origin except the ephemeral fixture is blocked, all WebSockets blocked, fresh contexts, service workers blocked. HTML and application scripts remain unchanged on disk. The served household-config.js points only at the local synthetic backend.

## Latest complete exploratory run

design-audit/runs/2026-11-16T17-34-39-767Z-browser

- 132 deterministic checks: 131 passed, 1 failed, 0 blocked.
- 86 screenshots with paired DOM/geometry JSON; 32 axe scans.
- A, B, D, E, F, G completed successfully. C completed its full flow but has one reproducible usability failure.
- C failure: C-start-reachable, screenshot evidence/017-C-post-edit-start-overlap-390x844.png. After editing shopping quantity, the 10-second save/Undo toast overlays the “Boltban vagyok” start button. Hit-test proves the control is obstructed; first exploratory run additionally timed out clicking for five seconds. The harness waits for toast expiry, then completes purchase/refresh/finish successfully. shopping-mode-ui.js:37 and workspace.css own this behavior.
- E includes explicit SQL readback of completed cooking phase and a refresh check. Both pass. Do NOT infer a resume bug from older exploratory screenshots: an early harness closed before async persistence settled; the latest harness waits for actual SQL confirmation.
- F uses real local HTTP, including delayed chunked NDJSON streaming, with explicitly canned answers. Tests cover simple question, pantry context, recipe card, stock/list proposals, approval and persistence, ambiguous/invalid request, 503 + retry, empty result, streaming, and an injected saveVoiceState=false failure. No live model called.
- G uses two synthetic users and actual in-memory PostgreSQL migrations/RPCs. It verifies cross-account stock update, reload synchronization, stale concurrent cart quantity conflict recovery (partner saves 3, stale client attempts 2; 3 is preserved), and new synthetic household creation. Invitation form is opened but never submitted.
- All six required viewports cover five primary destinations. Hungarian screenshots plus English at 390 px. Keyboard Tab/Enter/Escape exercise dialog focus, native browser chrome traversal, opener focus restoration, and combobox selection.
- Zero browser page exceptions. Network log retains intentional 503, real conflict 400, blocked external font requests, and conversation_page initialization 400s; do not claim no network failures.

## Evidence limitations

- Google Fonts is blocked by the no-outbound browser policy. Current screenshots use fallback fonts. Do not claim verified Sora/Inter font fidelity or treat fallback typography as a product defect. The next run automatically lists this limitation; the completed exploratory results predate that added wording.
- Axe confirms low-contrast small terracotta text on cream and additional muted text in several screens. Example .cooking-hero > p: 4.37:1 vs required 4.5:1. Current run has only color-contrast rule failures. Early target-size failures on recipe screens were caused by the same transient shopping toast, not inherently small recipe controls.
- Native mobile, real audio/voice services, real email/OAuth, external AI accuracy, production realtime WebSockets are untested.
- Bundled Chromium cache is incomplete; launch falls back to isolated installed Chrome (fresh profile). No user browser profile is used.

## Tests and dependencies

node --test design-audit/test/browser-safety.test.mjs: 2/2 passed. Verifies private/source files blocked by fixture, all HTML entry scripts available, production cloud config substituted, invitation RPC denied, anonymous/other-account household isolation, and duplicate run rejection before browser launch. Both JS modules pass node --check.

The fixture imports @electric-sql/pglite from the existing root dependency. For fully standalone npm --prefix design-audit ci, add pinned @electric-sql/pglite@0.3.14 to the audit package, or document root npm ci prerequisite. No root package file was changed.

Existing exploratory runs are preserved. The browser refuses to overwrite an existing evidence/results.json; the normal engine creates fresh timestamped directories.
