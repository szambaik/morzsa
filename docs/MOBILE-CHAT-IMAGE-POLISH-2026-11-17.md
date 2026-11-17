# Mobile chat, history and recipe image fixes — 2026-11-17

## User-visible fixes

| Reported issue | Cause and change | Verification |
| --- | --- | --- |
| Voice icon is hard to recognize | Removed the iOS-only abstract voice illustration; both composer variants use the existing microphone SVG. The native UITextView and audio implementation are unchanged. | iOS adapter and composer browser suites. |
| Morzsa recommendations have no recipe photo | Proactive cards rendered ingredient art without mounting RecipeImages. They now request the persistent recipe's existing cover, with visible-only creation if missing. | Actual recommendation-to-reader navigation in Chrome and WebKit using isolated local image responses. |
| An image works only after tapping Retry | Transient recovery was restricted to quiet feed cards. Chat/cooking mounts and failed image downloads now also perform up to two automatic cache reads, without resubmitting generation. | Unit cases for initial failure, decode failure, navigation, resume, detached callbacks and exhausted retries; browser recovery checks. |
| Loading text replaces the image | Added a full-frame cream placeholder with an image glyph and small animated dots. It covers both generation/polling and the actual download. Reduced motion disables animation. After bounded recovery fails, the existing retry remains available. | WebKit screenshot inspection and loading/status/reduced-motion assertions. |
| Recipe back button became Liquid Glass | Removed the recipe reader back action from the native-control allowlist. | Reader back stays visible, works, and is not mirrored natively. |
| Recipes has redundant Ask/Add controls | Removed its index-page action row; a 44px icon-only plus now sits beside floating New chat. It opens the existing stock/list quick-add flow and uses the same native iOS bridge. Contextual reader ingredient/chat shortcuts remain. | Native action/quick-add tests and 320, 360, 390 and 1366px geometry checks. |
| Redundant save explanation below chat | Removed signed-in composer disclosure text and its empty spacing. Guest sign-in remains. | Composer assertions. |
| History has too many separate groups | General, recipe and shared conversations now appear in one chronological list, keeping recipe/chat icons. Only manually archived conversations are under Archive. Search, privacy, read-only sharing, pagination and navigation remain. | Mixed history saved through the fixture's actual RPC, sorted and opened through the UI. |

## Cache and persistence compatibility

Images of one immutable recipe ID now share frontend cache identity even when a recommendation carries a different summary or serving display. Legacy recipes without an ID retain the content-derived key. Backend storage, provider selection and quota handling are unchanged; no bulk generation was run.

An additive lastMessageAt metadata field keeps the last message timestamp through partial history hydration and concurrent metadata merges. Loaded messages are considered too, so renaming/archiving does not reorder a conversation above a newer message. Legacy records without timestamps retain their existing updated fallback until message data is available. No database migration, account reset or production-data modification is required.

## Validation

- npm test: 344 tests passed, plus all SQL suites.
- Native UI adapter: 75 checks; native UITextView composer: 22 checks.
- Chrome and WebKit: image generation/polling return, app resume, bounded cache recovery, retry touch target, accessible placeholder, recommendation cover, reader back action and mixed history navigation.
- Image recovery layout: 320, 390 and 430px. General UI/control layout: 320, 360, 390 and 1366px.
- Required release gate passed: full audit, 32 axe scans, 54 targeted regressions, native adapter/composer suite. Local run: 2026-11-17T11-55-58-811Z-162b97.
- Latest origin/main was already included (3728ad2); Plus latency changes were preserved.

Browser validation uses synthetic local accounts and a fixture photo. It does not establish production image-provider quality or latency. Physical iPhone testing is still a user-device check; the signed build is verified separately in its BUILD-INFO file.

## Reproduction

Start the isolated fixture with MORZSA_QA_PORT=8942 MORZSA_QA_PROACTIVE=1 node tests/persistence-fixture.mjs. Run tests/recipe-image-recovery.browser.mjs and tests/mobile-chat-image-polish.browser.mjs with MORZSA_IMAGE_BROWSER=chromium or webkit. Chrome uses MORZSA_AUDIT_BROWSER_CHANNEL=chrome; WebKit requires an installed Playwright runtime. Both scripts block external requests and generate JSON evidence plus screenshots under /tmp.
