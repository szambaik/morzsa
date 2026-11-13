# Morzsa — vision assessment and execution plan

Reviewed 2026-11-13 against the user's `../vision.md`, the actual a28c36b runtime, SQL/RPC contracts and AI handlers. The user explicitly requested implementation in this conversation; the review below is the first deliverable and governs the scoped implementation. The source vision stays unchanged.

## Independent assessment

1. **Product fit:** pantry, shopping, recipe-to-list links, Google/email login, shared revision-checked writes, realtime signals, voice, recipe threads and reviewed AI operations already implement much of the vision. The missing connection is persistent household-level cooking context.
2. **Differentiation:** using one household's approximate stock to recommend a meal, list missing ingredients, discuss its preparation and reconcile purchases is the differentiator. A generic chat or another navigation destination adds little.
3. **UX friction:** unfamiliar users need clear availability, visible save status and easy recovery. Eight unsolicited pantry checks can dominate the chat. Keep a small preview and an explicit way to review more.
4. **Prioritization:** fix shared availability first, then shared preferences, recent cooking context and verifiable activity. Preserve manual controls, five destinations and current artwork. Defer new stores, price comparison, calorie tracking and complex planning.
5. **Agent opportunities:** offer to list explicitly low items, or repeatedly purchased items that are explicitly marked out. Never infer absence from an unknown item or silently remove food. Snooze a declined suggestion and make a batch action idempotent.
6. **Architecture:** revisions, permissions, activity, suggestion eligibility, quantities and missing-item calculation remain deterministic. AI reasons about meals, substitutions and natural language; it produces proposals, never proof of a saved operation. Pass only bounded relevant preferences/recent recipe names, not an unbounded chat memory.
7. **Retention:** each partner should see purchases and pantry corrections immediately, get varied practical meals using what is home and finish shopping without bookkeeping. Test whether this actually replaces messages over four weeks.
8. **Monetization:** a future paid tier could fund consistently fast AI, generated step illustrations and useful shared long-term memory. Basic reliable pantry/list coordination should remain usable. No payment implementation is justified yet.
9. **Risks:** latency/provider failures, incorrect implied freshness, repetitive meals, unsolicited reminders, unshared preferences and silent saves undermine trust. The current SQL accepts only stock 0/2, while the new frontend's low state uses 1: that is a concrete shared-household compatibility gap, not merely visual polish.
10. **Roadmap:** the next three iterations are below. Population-level retention and two-person engagement cannot be inferred from screenshots or tests.

## Prioritized recommendations

| Change | User problem and solution | Expected impact | Complexity / dependencies | Why now |
|---|---|---|---|---|
| Shared low state | A low selection can fail on the shared RPC. Add 1 to its existing validation and preserve confirmation timestamps for positive states. | Reliable fundamentals | Small; additive migration, SQL regression | P0 correctness |
| Shared cooking preferences | The AI does not carry the couple's usual servings, time or avoided ingredients into the main chat. Add optional settings with per-field revisions and bounded AI context. | More useful meals, less repetition of constraints | Medium; new RLS-protected table/RPC and UI | Makes the existing AI household-aware |
| Recent cooking memory | Previous recipe completions are local and absent from today's AI request. Share recipe titles at explicit start/finish, retain a small recent list and ask for variety. | Better continuity without replaying old chats | Medium; idempotent event writes, local fallback | Uses existing cooking workflow |
| Verified activity | A partner sees a transient toast but cannot revisit what changed. Record accepted changes server-side, show a compact secondary activity list. | Trust and coordination | Medium; trigger, RLS, realtime/polling | Supports couples and action traceability |
| Quiet proactive replenishment | Removal memory vanishes on reload; low items have no refill offer. Derive offers from explicit states and real purchase archives, never predictions alone. | Fewer forgotten staples | Small; pure logic, snooze, existing cart writes | Useful action with low AI cost |
| Coordination metric | Message counts do not show whether household coordination improved. Derive weekly accepted pantry/list/purchase/cooking events from the private journal. | Enables the four-week pilot | Small after activity exists; SQL query | Measure outcomes before expansion |

## Three iterations

1. **Implement now:** shared low-state fix; optional shared cooking settings; bounded cooking-title memory; transaction-backed household activity; quiet replenishment proposals; coordination-event query and pilot protocol. Old local saves and old clients keep working.
2. **Pilot with about ten couples for four weeks:** observe both partners, shopping completion, meal-to-cooking conversion, stale-stock correction and provider errors. Improve the top observed friction; do not add a new screen just to increase engagement.
3. **Learn conservatively:** evaluate recurring purchase suggestions and remembered favourites using the pilot. Add explicit approve/edit/forget controls before broader inferred preferences or planning. Consider paid AI only if usage and cost evidence justify it.

## Current-run screen evidence

1. Main chat (01-chat-before.png): working composer and direct destinations; the eight-item review block competes with the conversation. No logged-in live AI request was made in this capture.
2. Recipes (02-recipes-before.png): understandable started-recipe empty state and existing discovery actions; no persistent household preference entry point.

Captured current public UI, with existing local state, not mocked household data. Screenshots verify layout, not full accessibility or two-person reliability. Implementation QA uses isolated test data and database tests; no production household stock is modified for testing. Keyboard labels, narrow-screen reflow, stale writes, repeat requests and cross-household isolation require separate validation.

## Four-week validation

Use meaningful accepted coordination events: pantry changes, list changes, completed purchases and explicit recipe starts/completions. Count each server-accepted changed record once; batch size is recorded, so bulk imports must be separated when analysing engagement. Do not count chat text, retries or no-op writes. Weekly active household = at least one meaningful event; two-active-member share = at least two distinct actors with meaningful events. Four-week retention requires comparing the same household cohort across weeks. Recipe-to-cooking conversion uses explicit start/finish events, not guessed intent.

Use only aggregated pilot results externally. The private activity journal is visible only to existing members; no external analytics SDK or chat-content logging is introduced. Ask pilot couples what they stopped doing elsewhere, and observe task completion and failures rather than relying on positive feedback.

## Implementation and verification

Implemented optional preferences scoped separately to account and kitchen; shared per-field revisions; explicit recent recipe completions; member-only accepted activity; quiet low/recurring-item list suggestions; a three-item review preview; and an aggregate coordination query. Existing records and RPC argument formats remain compatible. The stock-1 fix and new server tables/RPCs were deployed on 2026-11-13.

Verified 175 JavaScript tests, seven database suites and eight Python tests. Browser checks covered local preference save/reopen at 390px, web shopping at 1366px without horizontal overflow, and identical cooking-dock/composer coordinates (x=365.5, width=880). Current screenshots 03–05 use isolated test data and a fake image endpoint; they do not establish live AI response quality or real two-person retention. Shared concurrency, isolation and retries are covered by database/model tests. A fresh two-user production exercise remains a pilot task.

User-requested desktop polish: the shopping list now uses a centered single column, and cooking controls match the composer width. The established manual and AI proposal/save paths remain intact. New saved preferences apply to the main Morzsa chat and curated suggestions; the older external/legacy recipe prompt retains its existing controls. The roadmap is staged, not a claim that every future vision capability is complete.
