# Calm chat and history — 2026-11-17

| Request | Implementation | Verification |
| --- | --- | --- |
| Less crowded sidebar | One-line recent conversations; search opens from its icon; conversation management and settings are collapsed. Existing sorting, archive, privacy and cloud sync remain. | Search/redraw, archive/Undo, two-user share/revoke and read-only controls in the local fixture. |
| Cleaner chat | Shorter welcome, compact starter pills, one primary action per proactive suggestion, simple cooking-resume row and a flat cream chat background. | Paired screenshot review, 320–1366px layouts, suggestions disappear after sending. |
| One-row composer | Photo → text → microphone → Send. Long drafts grow vertically, with actions aligned at the bottom. Existing native UITextView remains. | Chrome/WebKit geometry, keyboard/native-adapter regression suite. |
| New chat top right | Move the existing functional button to the header; preserve recipe quick-add beside it. | Header geometry and navigation across chat, pantry, shopping and recipes. |
| Preserve other sessions | Merge main including PR #14. Keep its shopping autocomplete, compact suggestions and weekly planning. Resolve only the conflicting chat suggestion markup. | Full release gate rerun on merged code. |
| Readable labels | Use the existing darker terracotta text token for the cooking preparation label. | 32 accessibility scans without violations. |

Implementation: companion-ui.js, workspace-ui.js, workspace.css, mobile/ios.css, proactive-ui.js, proactive.css.

Regression entry points: tests/calm-chat-layout.browser.mjs, tests/check-ios-controls.mjs, design-audit/check-release.mjs; existing history/crafting/sharing tests now open the relevant disclosures.

Local private QA captures: ~/.codex/artifacts/morzsa-calm-chat/qa/. Source screenshots are intentionally excluded from the public repository. Tests use synthetic data and do not call paid AI providers. Physical iPhone behavior is not claimed as tested.

## Compact welcome and blue Send — follow-up

- Removed the repeated mascot and explanatory sentence from an empty chat; reduced title size and spacing above the three existing starter actions.
- Centered the mobile header wordmark independently of the menu/new-chat controls. The recipe header uses a smaller wordmark on narrow screens so its extra action still fits. The logo keeps a 44px-tall tap target and its existing dashboard action.
- Send is blue (#007AFF) with a white arrow when available, neutral gray when disabled. A non-whitespace character is required; deleting the draft disables it again. Input events from UITextView update this immediately. Keyboard submission follows the same rule; Stop remains available while responding.
- Kept the latest merged chat/recipe latency improvements. Native editing, audio, drafts and the existing send pipeline remain intact.
- Validation: 75 native-control checks, 28 native-composer checks, 127 mobile viewport/entry checks, WebKit verification and mobile/desktop screenshot review. The complete release gate passed; the final arrow contrast was also visually checked. Physical iPhone confirmation remains a device check.
