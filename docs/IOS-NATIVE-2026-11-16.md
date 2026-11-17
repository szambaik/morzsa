# Morzsa: native iOS controls and startup performance

The Capacitor application now uses UIKit for its five main tabs and the feedback
action sheets on proactive suggestions. The existing web screens, household
stores, local save formats, authentication and recipe flows remain in use.
This is an incremental native shell, not a SwiftUI rewrite.

## Implementation

- `ios/App/App/MorzsaViewController.swift` owns a system `UITabBar`, SF Symbols,
  localized labels, the shopping badge, selection haptics and `UIAlertController`
  action sheets. Both the scene entry point and storyboard use this controller.
- `mobile/ios-ui.js` installs only when the iOS plugin is available. It sends
  coalesced state updates and hides the web navigation after acknowledgment.
  Native tab events enter the same navigation handler, preserving drafts, scroll
  position and recipe context. Keyboard, dialogs, onboarding, focused cooking,
  shopping mode and voice overlays hide the native bar. A rejected bridge call
  restores the web navigation and suspends retries until resume or refresh.
- `mobile/ios.css` positions the web controls above the measured native tab bar.
  UIKit's fitted height already contains its safe area; it must not be added twice.
- `scripts/native-bundle.mjs` creates two classic application scripts plus the
  native bridge, and one stylesheet. It preserves globals and source order.
  There is a deliberate microtask checkpoint before proactive startup: combining
  all scripts into one caused repeated recipe ranking during async initialization.
  The native package uses local system fonts and has no Google Fonts dependency.
  Original runtime files are not copied alongside their bundled equivalents.
- `proactive-ui.js` reuses ingredient-name matches, invalidating them when custom
  products change. Recipe rankings still use current stock, preferences and
  feedback. Views without recipe recommendations skip that calculation.

## Verification

- Unsigned iOS Simulator build: **BUILD SUCCEEDED**, Xcode 27.2, iOS 27.2 SDK.
- Fresh iPhone 17e simulator: application launch, onboarding exit, UIKit tabs,
  pantry/chat navigation, keyboard hiding the tabs, composer positioning, saved
  draft restoration and final safe-area layout inspected.
- 36 native-adapter/browser checks: acknowledgment, rejection/invalid-height
  fallback, retry suppression, batching, keyboard and overlay state, language,
  active recipe/draft preservation, action-sheet cancel/snooze/stale callback,
  cache invalidation, old `morzsa-v1` saves and every bundled destination.
- 74 existing proactive browser regressions passed, including two-user SQL-backed
  suggestion feedback and approval. The fixture uses synthetic data.
- Unit/SQL suites and 9 Python tests passed; native/web builds and diff checks
  passed. The bundle has a regression test for the async startup boundary.

The UI tests for sheet callbacks use a mocked native plugin. Actual iPad popover
interaction, VoiceOver, haptic feel and physical-device startup still need device QA.
The controller anchors sheets on iPad; compilation alone is not that QA.

## Local startup measurement

`design/ios-native-2026-11-16/startup-benchmark.json` contains all 24 samples and
input hashes. Chrome 157 ran 12 fresh contexts per variant, alternating order,
with identical synthetic pantry data, a 390×844 viewport, no CPU throttling,
and all external traffic blocked. The baseline is the source snapshot before
this task, including its native bridge; the optimized variant includes the
ingredient resolver optimization as well as packaging changes.

| Measurement | Before | Optimized |
| --- | ---: | ---: |
| Median DOMContentLoaded | 202.7 ms | 116.5 ms |
| Median window load | 203.2 ms | 117.3 ms |
| Script and stylesheet requests, including attempted remote font CSS | 66 | 4 |

This is about a 43% reduction in this local browser startup measurement. It is
not an iPhone latency benchmark or a guarantee for AI/backend response times.
The original app has 60 external application scripts plus inline startup; the
native build now loads 3 scripts including the bridge. It uses 1 CSS file.

To reproduce after building both variants, run:

```sh
node scripts/measure-native-startup.mjs
```

The script uses `design-audit/node_modules/playwright`. `PLAYWRIGHT_MODULE` and
`CHROME_EXECUTABLE` can point to another installed Playwright/Chrome. Set
`NATIVE_BASELINE_DIST` to a pre-change web build to compare the complete change;
the default `web-dist` compares packaging with the current source. The archived
pre-change build is `tmp/ios-before-dist` in the managed implementation worktree.

## Building and integration

```sh
npm run build:mobile
npx cap sync ios
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild \
  -project ios/App/App.xcodeproj -scheme App \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath .mobile-builds/ios-native CODE_SIGNING_ALLOWED=NO build
```

The work was developed in the managed `morzsa-ios-native` worktree on
`codex/ios-native-performance`, from a copy of the existing uncommitted source.
Its whole Git diff therefore includes earlier work and is not an iOS-only patch.
The implementation was then integrated into the original checkout using only
task-specific hunks and new files. Every touched existing source file matched
the recorded starting hash; the patch passed `git apply --check`. The earlier
work and parallel-session files were preserved. Baselines remain in
`tmp/ios-baseline.json` and `tmp/ios-baseline/` in the managed worktree.
No production backend migration, release, push or physical-device installation
is part of this change. Follow the repository's release gate before publishing.
