# iOS actions and chat response feedback

Integrated the completed native shell into current main with a three-way merge;
retained the performance session's web bundle and existing audit regressions.

- Household switching stays in sidebar settings, removing the duplicate header
  control. New chat floats above Send, sharing its horizontal center.
- Sending immediately displays a presentation-only user bubble and clears the
  composer. The cross-device turn lock still precedes persistence and the model
  request. Preparation can be canceled, has a 15-second timeout, and restores
  unsent text/photo on failure. Rapid taps within 400 ms do not accidentally
  turn Send into Stop. Typing the next draft during history sync preserves it.
- Existing UIKit tabs and action sheets remain. MorzsaViewController renders
  simple action buttons as actual UIButton controls using glass/prominentGlass
  on iOS 26+, with a native tinted/filled fallback. SF Symbols, Dynamic Type,
  accessibility and selected/disabled states follow existing JS handlers.
  Content cards and rich rows keep their web layout. File pickers, microphone-
  start and sign-in controls retain browser activation to preserve permissions.
- mobile/ios-controls.js hides DOM buttons only after native acknowledgment,
  removes duplicate accessibility targets, rejects stale callbacks and restores
  web controls on failure. It coalesces changed button geometry and avoids
  bridge calls for streamed answer text. UIScrollView owns panning; fixed native
  controls track its offset. Nested scrolling temporarily uses web buttons.

Browser validation: tests/ios-controls.browser.js (29 checks),
tests/ios-native.browser.js (36 checks), using the synthetic persistence
fixture on port 8899. Widths: 320, 360, 390 and 1366px. These tests issue no
external AI requests and do not write to production households. Native build
and simulator results are recorded separately below.

Validation on 2026-11-17: all JavaScript/SQL suites and 9 Python tests passed;
74 proactive browser checks and 5 performance regressions passed; full release
gate passed with 32 axe scans and 54 targeted checks. Web build validation and
Xcode 27.2 iOS Simulator compilation passed. Fresh simulator startup required
OS migration; no physical iPhone voice/permission test is claimed.
