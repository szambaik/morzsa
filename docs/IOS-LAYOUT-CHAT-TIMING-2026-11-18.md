# iOS layout and chat preflight refinement — 2026-11-18

The screenshot fixes compact the recipe library and keep navigation aligned in the native shell. Chat preflight now waits for the active conversation's writes, instead of the entire conversation outbox and its global refresh.

## Chat latency

The supplied production Plus sample was 12,456.7 ms preflight, 5,048 ms from dispatch to first text, 5,904 ms from dispatch to first recipe, and 26,755.8 ms total. First text therefore arrived about 17.5 seconds after Send. Preflight accounts for approximately 47% of total time and occurs before dispatching the assistant request. This aggregate sample does not identify which operation consumed those 12.5 seconds.

Previously beginTurn waited for global flush(). That serially persisted every queued conversation (including recipe documents and photo uploads/signing), refreshed kitchen intelligence, and refreshed the conversation index/active history. An in-flight background flush also made the foreground wait. finishTurn had the same dependency, so unrelated writes could delay releasing the current conversation's turn lease.

The new path:

1. Persist only the current conversation's queued writes before acquiring its lease.
2. Share one in-flight save promise per conversation and account generation. Edits captured during a write remain queued and are flushed before preflight proceeds.
3. Use the existing additive begin_conversation_turn_page RPC to acquire the lease and read fresh history in one round trip. Preserve the older RPC fallback when that function is missing.
4. Keep unrelated saves and full index refreshes in the background. Save the current response before releasing its lease, without waiting for unrelated conversations.

An already synced chat can use one foreground RPC. A new/changed conversation still needs its own save first. This preserves optimistic revisions, private history, fresh cross-device context and turn ownership. Unsaved recipe/media work belonging to that conversation can still take time.

### Console timing fields

morzsa_chat_timing remains local console diagnostics; it does not send telemetry to an analytics service or include message content.

| Field | Meaning |
| --- | --- |
| preflightMs | Send processing through assistant dispatch: first UI paint, current-thread sync, lease/history, local context/render work, optional photo capability check. |
| historySyncMs | Waiting for and saving current-conversation writes. |
| turnLockMs | Total acquisition phase, including a missing combined-RPC probe and fallback when needed. |
| turnPageRpcMs | Combined lease/history RPC, including a missing-function response. |
| turnAcquireRpcMs | Older separate lease RPC; zero when unused. |
| historyLoadMs | Applying the combined history page, or fetching history through the fallback. Historical photo signing is excluded. |
| photoCheckMs | Optional photo capability request; zero without a photo. |
| localPrepareMs | Remaining preflight after subtracting sync, acquisition, history and photo check. Approximate due to millisecond clock resolution. |
| firstTextMs, firstRecipeMs | Dispatch through first non-empty stream callback. Includes transport, edge-service and provider latency; not pure inference timing. |
| totalMs | Send through response handling/error/cancellation; excludes subsequent asynchronous response-save/lease-release. |

Acquisition subfields are included within turnLockMs; do not add them to it. Cancelled preflight can return before an in-flight lease request finishes, so late timings may be absent from that final console line. A late-granted lease is still released.

No post-change production latency has been measured. A new real sample is needed to quantify improvement and distinguish current-thread saving from server/transport latency. The combined-RPC migration is in supabase/migrations/20261117_chat_turn_page.sql; this task did not verify or modify its production deployment.

## Layout changes

- Header history, plus and new-chat actions, cooking Back, and history-drawer actions retain their DOM geometry instead of separately positioned UIKit copies. Native tab navigation and the three chat starters remain native.
- iOS reserves the header's top safe area through padding once; its sticky position no longer adds the visual viewport offset. UIKit preserves the tab bar during root reparenting and reserves the home-indicator area.
- The library begins with Neked / Böngészés / Mentettek. Resume cooking is under Neked. Redundant introductions are removed. Browse filter choices are behind an accessible disclosure beside search.
- Feed images have a 16:9 container with cropped image bounds, preventing WebKit intrinsic image stretching. Feed cards already had no dead ellipsis after updating main; the working recipe-reading export menu is retained.
- Desktop preparation and recipe reading use wider two-column layouts. Guided cooking has a wider shell and task dock.
- Send uses Morzsa terracotta (#BF4E2C). The native editor no longer adds a Done/Kész toolbar; tapping non-interactive content outside the composer dismisses the keyboard. Cooking Back is a 44 × 44 arrow with an accessible label.

## Validation

- npm test: 392 JavaScript tests and all SQL suites passed.
- Persistence runtime: 17 tests passed, covering unrelated blocked saves, shared current-thread writes, captured edits, account changes, fresh history, cancellation and late lease release.
- iOS browser checks: 75 control, 30 composer and 127 viewport checks passed.
- design-audit/ui-refinement.mjs: Chromium and WebKit at 320, 390 and 1366 pixels passed filter, tab order, image ratio, overflow, header alignment, cooking/back, reading layout and Send color checks. Screenshots and geometry: evidence/ios-layout-chat-timing-2026-11-18/.
- Frontend build/native asset sync and iOS Simulator build passed.
- Isolated native XCUITest blocks external HTTP traffic and exercises typing/redraw, submission, retained drafts, drawer close, native tabs, background keyboard dismissal, header inset and cooking Back.
- Full release gate covers 32 accessibility scans, 54 receipt/search/AI regressions, native-browser controls, progressive recipe delivery, dynamic cooking, discovery and shopping behavior.

Changes are local; this task does not publish GitHub Pages or a native release. Real-device and production latency verification remain separate from synthetic browser and simulator checks.
