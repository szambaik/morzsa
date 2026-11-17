# Native iOS chat editing

The iOS chat editor uses `MorzsaTextInput`, a real UIKit `UITextView`. It provides
system selection, autocorrection, multiline Return, Dynamic Type, and a
localized Done keyboard action. The surrounding glass card and photo, voice,
and send toolbar remain web controls. In particular, photo and voice keep
their trusted browser activation and existing permission flow.

`mobile/ios-composer.js` reserves the web textarea's measured rectangle, then
hides that textarea from sight and accessibility only after UIKit acknowledges
the replacement. The native view is a sibling of WKWebView, so web rendering
does not replace the native cursor or move the editor's internal content.
Unavailable native plugins or bridge errors restore the web editor. Web and
Android continue to use their existing textarea.

Native edits carry a kitchen/chat context and an increasing sequence number.
They enter the existing input handler and draft state; no parallel chat store
or AI send pipeline is introduced. Sending atomically captures the native text
and starts a new draft, then calls the current web form handler. Delayed edit
events, repeated taps, replacement form nodes, and text typed during the bridge
round trip are covered by the browser regression suite. Dialogs and voice mode
hide the editor and resign the keyboard.

The Plus/Free preference is under sidebar Settings, alongside language. It uses
the existing preference and cannot change during an active AI operation or
voice session. The default remains Plus.

## Verification

- `node tests/check-ios-controls.mjs /tmp/morzsa-ios-evidence` exercises the
  native bridge with an isolated synthetic account, including web fallback,
  mobile geometry, drafts, send races, and independent photo/voice controls.
- Build the Simulator app, then run
  `python3 tests/native-composer-ui.py --app /path/to/App.app --output /tmp/native-evidence`.
  The harness installs a separate QA bundle with external service traffic
  blocked. XCTest types into the real UITextView, forces a background chat
  redraw, sends through the toolbar, dismisses the keyboard, and verifies
  navigation and history. Results and screenshots are in the xcresult bundle.
- `node design-audit/check-release.mjs` remains the required publication gate.

The native harness does not test a physical iPhone, the live AI service, or
speech/photo permissions; those paths retain their existing implementation.
