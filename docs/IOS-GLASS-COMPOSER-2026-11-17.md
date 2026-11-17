# iOS glass composer and simpler pantry/list actions

The iOS composer now follows the supplied rounded glass reference: a full-width
text field above a compact toolbar, with the outlined voice icon on the left,
photo attachment next to it, and Send on the right. Cream, forest green and
terracotta keep it consistent with Morzsa.

## Implementation

- mobile/bridge.js marks the iOS platform separately from Android.
- mobile/ios.css styles only the iOS composer. It keeps 44px control targets,
  an expanding multiline field, a solid reduced-transparency fallback, and the
  existing cooking/crafting visibility rules. When the keyboard opens, the
  composer no longer reserves space for the hidden native tab bar.
- companion-ui.js adds assets/ui/voice-conversation.svg to the existing voice
  button. workspace.css hides this alternate icon outside iOS. The text,
  photo, voice, send, cancellation and draft handlers are unchanged.
- workspace-ui.js removes the redundant Ask Morzsa action from pantry and
  shopping on every platform. Pantry has no empty action row; shopping retains
  the in-store mode entry. The floating new-chat button remains on both pages.

The strict native-button allowlist introduced in PR #6 is unchanged. The
composer is one CSS glass surface around the existing web controls; it does
not add duplicate UIKit buttons or replace audio infrastructure.

## Verification

The isolated iOS browser suite covers the reference icon, original web layout,
real file-picker activation, 320/360/390/1366px geometry, multiline input,
keyboard inset, pantry/list actions, native control fallback, immediate sending
and preservation of the next draft. Tests use synthetic data and block external
browser traffic.

Run the required release gate with node design-audit/check-release.mjs before
publishing. Native simulator screenshots and signed device builds are recorded
outside the source tree. Physical-phone microphone permission and live voice
calls need device testing; no provider request or production data change is
needed for this UI change.

Verified on 2026-11-17: npm test; 9 Python tests; native and web bundles; web
bundle browser smoke test; full release gate with 32 accessibility scans,
54 targeted regressions and 68 iOS checks; iOS Simulator and signed iPhone
Debug builds. Chat, pantry and shopping screenshots were visually inspected
in the isolated iPhone 17e simulator with external traffic blocked.
