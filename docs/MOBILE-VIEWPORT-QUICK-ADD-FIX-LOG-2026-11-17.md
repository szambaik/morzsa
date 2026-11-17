# Mobile viewport and quick addition — 2026-11-17

| Customer problem | Cause and fix | Verification |
| --- | --- | --- |
| History drawer extends beyond the screen | The drawer used layout viewport height while iOS can reduce or pan the visible viewport for the keyboard. It now follows `visualViewport` height and offsets while open, cleans up listeners on close, and keeps the conversation list and expanded management sections scrollable. The empty search result belongs inside the scrolling list. | Long history, empty search, expanded settings/actions, footer reachability and scroll restoration, including 390×400 and 430×320. |
| Focusing a field can magnify the iPhone app and feel stuck | History search used 14px text. iOS focus zoom affects small HTML fields while Capacitor already disables pinch zoom by default. Native editable controls now use at least 16px; iOS `zoomEnabled: false` is explicit. Browser pinch zoom remains available. | Computed font sizes, viewport geometry, Chrome and WebKit checks. Actual iPhone keyboard focus/zoom needs a device check. |
| Addition occupies too much of the pantry/list screen | Reuse the existing native quick-add control as a 52px bottom-right + on these two screens. The native adapter supplies Liquid Glass; browser fallback is a compact cream circle. Removed the pantry setup block/search + and the list inline editor. | 320/360/390/430px and desktop layout, native callback, no overflow or overlap with the shopping mode control. |
| Keep addition features discoverable | The + opens the existing shared quick-entry dialog, already targeted to pantry or shopping. Pantry search carries over. Dictation and starter packs move into the pantry side of this dialog. Voice/onboarding/quick-panel shortcuts use the dialog too. | Pantry and list saves, batch addition, destination controls, setup entry, in-store add preserved. |

## Compatibility

No database, saved-state format, API contract, native UITextView, voice pipeline or shopping outbox changes. Shared additions continue through the existing quick-entry save path; quantities, notes and recipe links are preserved when an item already exists. Shopping mode keeps its existing add control. The new + hides behind dialogs and the native keyboard and clears the native navigation bar.

## Regression coverage

`tests/mobile-viewport.browser.js` is included in `tests/check-ios-controls.mjs`, so the existing required release gate covers this fix. The new viewport journey passes 86 checks in Chrome and WebKit. Existing native control and composer regressions pass 75 and 22 checks. Audit, onboarding and shopping/performance journeys now use the relocated entry dialog. Browser evidence uses isolated fixture accounts and blocks external services; it does not modify customer data or spend AI credits.

## Device acceptance

On the new iPhone build: open history, search, show/hide the keyboard and rotate; confirm that Close, Settings and New chat remain accessible without a stuck scale. On pantry/list, tap the floating +, save an item, reopen it and verify that it clears the tab bar. Browser-native bridge tests validate the adapter contract; they do not replace this physical-device check.

## Release-harness follow-up

The main release run `44097845544` exposed the same timing failure twice: the pantry test clicked while the initial realtime refresh was busy, received the existing “Still syncing” response, and waited for a save status that never began. The unclosed dialog then caused unrelated realtime checks to fail. The trace confirms this; no browser runtime errors occurred. The PR and local runs had previously passed.

`design-audit/performance/regressions.mjs` now waits for initial synchronization after opening the first pantry dialog, holds the actual write request until the second dialog opens, and waits for the resulting success feedback instead of relying on 450/3500ms sleeps. Cleanup releases the request and closes the dialog even after a failed assertion. All original persistence, pending-save and dialog identity assertions remain. This changes only the test harness; the signed iPhone build remains current.
