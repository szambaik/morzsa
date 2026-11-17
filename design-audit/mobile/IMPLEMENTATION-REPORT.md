# Mobile stabilization implementation report

Baseline: 9fb9924 (main, PR #19), branch codex/mobile-ux-stabilization.

## Plan recorded before implementation

1. Capture the app with synthetic household/conversation data. Measure history DOM size, render time and resize mutations.
2. Consolidate viewport measurement into one frame-batched service. Measure navigation and bottom controls; share content reservation. Preserve native resizing, composer acknowledgment and shopping receipt geometry.
3. Give pantry tools a flowing panel. Keep availability and shopping shortcuts; disclose less frequent actions inside details.
4. Derive history titles locally, distinguish unknown/empty histories, bound rendered rows and retain search plus database pagination. No extra AI/title calls.
5. Define cooking lifecycle once; use additive metadata for reversible pause/resume. Exclude completion and stale sessions from active counts without removing history.
6. Run Chromium/WebKit at all seven requested sizes, pending/error regressions, persistence tests, native adapter suite and release gate. Capture after evidence and verify authorized main release.

## Regression risks

- Native keyboard already resizes the WebView: do not apply its height twice.
- Hidden DOM tab bars have zero height; native navigation inset remains authoritative.
- Existing household saves, legacy fallback and receipts/Undo retain their contracts.
- Unloaded cloud messages do not mean an empty conversation. Do not discard records.
- Repeated recipes may be legitimate sessions. Completion wins concurrent merges; pause preserves steps and timers.
- Another session edits native components. Merge latest main and preserve its fixes.

No database migration or production data modification is planned. Validation results follow after implementation.

## Problems and implemented changes

| Area | Confirmed cause | Change |
| --- | --- | --- |
| Keyboard/footer | Separate chat/recipe viewport listeners, native resize plus offsets, fixed page padding. | One frame-batched viewport owner measures the visual viewport, web/native navigation and active bottom controls. Native resize is not counted twice. The document owns page scrolling; the cooking-question overlay remains a deliberate separate scroll surface. Mobile headers are sticky and clear the top safe area. |
| Navigation | Page-specific padding competed with composer/native insets. | Shared measured bottom reservation includes the floating add button. All five destinations and native acknowledgment fallback remain. |
| Inventory tools | Legacy rules positioned direct buttons at the same absolute coordinates. Open details enlarged the heading row. | A single popup panel lays out buttons/selects in separate rows without moving the heading. Escape and clicks elsewhere in inventory dismiss it. |
| Inventory cards | Details, shopping and an ambiguous X competed on every card. X meant “Elfogyott”, not deletion. | Details remain the main tap target. Shopping/availability shortcuts are disclosed under a 44px action control. Availability, quantities, errors and Undo retain their existing behavior. |
| History titles | Generic/blank metadata was shown despite a locally available user message or recipe title. Unloaded cloud rows contain no messages locally. | Deterministic titles use a recipe or first available user message and preserve custom titles. Unknown cloud rows are not labelled empty. Fallback labels include date/time. No LLM title request or deletion. |
| History rendering | All 101 loaded rows rendered; every resize rebuilt desktop history. Search repeatedly looked up rows in the entire book. | Initially 30 rows, then increments of 30. Search covers all loaded records, with existing 100-record server pagination still available. Only breakpoint changes rebuild the sidebar. |
| Cooking lifecycle | Recipes counted status=active; overview also excluded completion phase. “Resume later” only navigated away. Old cooks stayed active indefinitely. | One definition of preparation, in progress, paused and completed. Explicit pause/resume uses additive metadata. More than 24h without an update is displayed as paused, without writes/deletion. Completion is excluded everywhere; counts deduplicate IDs, not recipe names. |

Pause preserves steps, timers and feedback. Existing active/completed status and RPC schemas remain unchanged. Timers retain elapsed wall-clock time while paused. Old clients can still read these records but do not display the new pause distinction. Opening a paused session resumes it. Legacy phase-completed sessions are not reused for new cooks.

## Files changed

- Viewport/shell: viewport-ui.js, shell-layout.css, index.html, workspace-ui.js, companion-ui.js, recipe-room-ui.js, mobile/bridge.js, mobile/ios-ui.js, mobile/ios.css.
- History/lifecycle: companion-model.js, cooking-session.js and the chat/recipe UI modules above.
- Inventory: pantry-library.js, pantry-review-ui.js and the shell stylesheet.
- Tests: tests/mobile-stability.test.cjs, design-audit/mobile/check-mobile.mjs, existing pantry journeys and native keyboard fixture. Mutation/Undo assertions remain; they now open the secondary actions as a user would.
- CI: .github/workflows/pages.yml installs WebKit and runs both new browser suites inside the existing required Audit regression gate. Production artifact/deployment dependencies remain intact.

## Measurements

Synthetic account with 130 conversations, initially 100 server records plus an unsaved chat. Same machine/fixture, 12 history renders per measurement, middle sample. Local UI measurements, not production AI timings.

| Measurement | Before Chromium | After Chromium |
| --- | ---: | ---: |
| Initial history DOM rows | 101 | 30 |
| History render | 4.0 ms | 1.8 ms |
| Full history replacements across 20 resize events | 20 | 0 |
| History requests during 25 navigations | — | 0 |
| Window/visualViewport listener growth after 25 navigations | — | 0 |
| Used JS heap after forced GC | — | 5,000,480 → 5,104,712 bytes |

The small heap change in this bounded run does not prove long-term leak freedom. WebKit after: 4 ms, 30 rows, zero history replacements. No claim that model inference, cold starts or production networking became faster. Prior recipe-streaming/latency fixes are preserved.

## Validation

Passed locally:

- npm test: 358 JavaScript tests and all 10 SQL suites, including legacy saves, unrelated-data preservation, concurrent progress, RLS, stale writes and household synchronization.
- Six new unit cases: title fallback, 600-record history/search, consistent counts, pause persistence, concurrent pause/resume with completion priority, legacy completed-session reuse.
- Chromium mobile suite: 125 checks. WebKit: 123 checks; CDP heap/listener inspection is Chromium-specific.
- Both engines: 320×640, 375×812, 390×844, 430×932, 768×1024, 1280×800, 1440×900 across all five pages. Active navigation, horizontal overflow and a last-action probe clearing navigation.
- Additional browser cases: menu overlap; 30/60-row history; search beyond initial rows and older server pages; legacy title after hydration; pause/resume at the correct step; completion persisted on existing SQL; matching counts; navigation during AI wait; one dispatch per send; provider error/retry; simulated keyboard composer/send geometry and close restoration.
- Native adapters: 75 controls, 28 composer and 127 mobile viewport checks, including acknowledgment, hidden-tabbar spacing, multiline input, short drawers and narrow layouts.
- node design-audit/check-release.mjs: complete journeys, 32 axe scans, 54 targeted UX checks, native adapters and progressive recipe/cancellation/retry cases passed on unchanged product sources.
- npm run build:web, npm run sync:mobile and git diff --check passed. Python unittest discovery: 9 passed.

A preliminary release gate correctly rejected an edit to companion-model.js during the run; the full gate was rerun with unchanged product sources and passed. An early native fixture still injected the old keyboard class; it now dispatches the same event as the bridge. The shared shell also replaces the obsolete native composer offset, preventing double positioning. No unresolved automated failure remains in the recorded final runs. CI must pass before the authorized main merge.

## Evidence

Synthetic data and loopback services only; no production data or external AI used. Fresh baseline is commit 9fb9924. References supplied by the user informed diagnosis.

| Screen | Before | After |
| --- | --- | --- |
| Chat | [before](evidence/before-chat.png) | [after](evidence/after-chat.png) |
| Keyboard simulation | [before](evidence/before-keyboard-simulation.png) | [after](evidence/after-keyboard-simulation.png) |
| History | [before](evidence/before-history.png) | [after](evidence/after-history.png) |
| Overview | [before](evidence/before-overview.png) | [after](evidence/after-overview.png) |
| Shopping | [before](evidence/before-shopping.png) | [after](evidence/after-shopping.png) |
| Inventory | [before](evidence/before-pantry.png) | [after](evidence/after-pantry.png) |
| Inventory menu | [before](evidence/before-pantry-menu.png) | [after](evidence/after-pantry-menu.png) |
| Recipes | [before](evidence/before-recipes.png) | [after](evidence/after-recipes.png) |
| Long page bottom | [before](evidence/before-long-page-bottom.png) | [after](evidence/after-long-page-bottom.png) |
| Cooking | [before](evidence/before-cooking.png) | [after](evidence/after-cooking.png) |

Raw results: [before Chromium](before-chromium.json), [after Chromium](after-chromium.json), [after WebKit](after-webkit.json), [native adapters](native-adapters.json).

## Limitations and unchanged areas

- No physical iPhone validation is claimed. Playwright WebKit runs on macOS; keyboard geometry tests explicitly simulate visualViewport changes.
- iPhone 17e / iOS 27.2 Simulator Safari was opened on the fixture. [Idle](evidence/ios-safari-idle.png) and [hardware-keyboard focus](evidence/ios-safari-hardware-focus.png) captures show real Safari chrome. This alone is not software-keyboard validation.
- History search covers metadata and messages already loaded. The older-conversations button extends its scope; no server full-text search or eager full message download is introduced.
- No production cleanup, migration, RLS change, AI-model change, hosting move or sync rewrite. “Elfogyott” changes availability rather than destroying product history.
- Protected Pages deployment updates the web app. Native changes require a new native build; existing iOS installations are not updated by a web release.

## Manual iPhone checks

1. Test the new native build and Safari with the software keyboard, portrait/landscape and larger text.
2. On a long chat, scroll to an older message, focus/type multiple lines, scroll with the keyboard and dismiss it. Header/send stay usable; no keyboard-sized blank gap or jump to unrelated content.
3. Send, stop, retry, navigate to inventory while waiting, then return. Verify draft/answer preservation.
4. Search history, load more, switch chats, create an empty chat; repeat in landscape with settings expanded.
5. Scroll every destination to the end. Last cards/actions clear navigation and home indicator. Open/close pantry actions, change availability, edit list quantity, undo, refresh and check a second household device.
6. Start a cook, finish a step, pause, reopen via overview/recipes and finish. Step/timers survive; completed cooks leave resumable counts and remain in history.

From repository root, with root and design-audit dependencies installed:

    npx --prefix design-audit playwright install chromium webkit
    node --test tests/mobile-stability.test.cjs
    node design-audit/mobile/check-mobile.mjs after chromium
    node design-audit/mobile/check-mobile.mjs after webkit
    node design-audit/check-release.mjs
