# Selective iOS Liquid Glass controls

The blanket button adapter replaced pantry artwork, shopping checkboxes,
quantities, settings and actions inside closed menus with UIKit capsules.
Element geometry alone did not reliably exclude closed disclosure content in
WebKit, so hidden actions appeared above unrelated screens.

The adapter now explicitly allows only history/menu navigation, new conversation
buttons, page-back controls and the three chat starters: Surprise me, Mix &
discover and A familiar favourite. The existing native main tab bar stays.
Pantry, shopping, recipe, settings, sharing, archive and Send controls use their
original web presentation and handlers. Native action sheets and haptics remain.

Closed details, closed dialogs and hidden ancestors cannot produce native
buttons. Geometry refreshes after drawer animations and transitions. The history
drawer clears the iPhone status area. Compact native chat starters put the icon
above a wrapping label, matching the available layout width.

## Verification

- The isolated iOS adapter suite covers 320, 360, 390 and 1366px, all main
  destinations, closed disclosures, modal isolation, bridge failure/recovery,
  stale callbacks and existing immediate-send behavior.
- Running node tests/check-ios-controls.mjs starts a fresh local SQL-backed
  fixture, blocks external browser traffic and runs that suite. It is also part
  of the required design-audit/check-release.mjs gate.
- Full JavaScript/SQL tests and the release audit passed. Simulator and signed
  iPhone builds use the same production code; simulator visual checks use a
  separate QA app identifier, synthetic pantry/list data and blocked external
  fetches. They do not test a user's account, voice, or physical-device behavior.

This supersedes the broad button-replacement scope in
[the earlier iOS integration notes](IOS-GLASS-AND-CHAT-2026-11-17.md).
