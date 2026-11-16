# Pantry setup and shopping usability — 2026-11-16

Implemented the current feedback without changing backend contracts.

- Replayable four-card HU/EN introduction: chat/history, pantry, recipes/cooking, planning/shopping and shared kitchens. Existing users are not forced through it again.
- Pantry → Quick setup opens the setup directly. Three optional packs (spices, cupboard, breakfast), search and dictation feed one editable draft. Explicit save only; up to 60 selections. Existing stock amounts, cart quantities and recipe associations survive.
- One-shot dictation reuses MediaRecorder and voice-command. Setup bypasses Plus realtime routing; retry and text fallback preserve its context. Only stock operations edit the draft. List operations never modify the list from setup.
- Up to three shopping suggestions use real low/out stock and repeat purchases over 60 days. Pending and checked cart items are excluded; plentiful stock is not suggested. Repeat purchases need two distinct trips and three days since the latest. Existing diet/avoid preferences filter candidates. No extra AI requests.
- Normal list: bottom “Boltban vagyok” button. Shopping mode: bottom “Lista” button, keeping the session and checkmarks. Finishing remains a separate confirmed transaction.
- Every pantry card supports direct cart addition, including reopening an earlier checked item without duplicates or metadata loss.

## Validation

- npm test: 275 unit tests and 9 SQL suites passed.
- tests/pantry-start.browser.js: 101 checks passed. HU/EN tour/setup and shopping layouts at 320, 360, 390, 430 and 1440 px; microphone denial/retry/cleanup, text fallback, draft-only voice changes, failed-save recovery, pack exceptions, recommendation reasons and repeated additions.
- tests/audit-actions.browser.js: 35 checks passed, including purchase completion and retained custom reminders.
- Screenshots: design/pantry-start-2026-11-16/.
- Web and native frontend assets rebuilt. No production deployment or new native binary.

Browser checks use the isolated local SQL fixture at port 8850, a personal test actor, mocked microphone/audio and mocked provider responses. No paid AI calls. Real recognition quality and iPhone microphone behavior require a device check. Existing SQL suites verify shared-state compatibility; the fixture does not prove complete cross-device pantry synchronization.
