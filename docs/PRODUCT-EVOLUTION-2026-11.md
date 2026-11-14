# Morzsa product evolution: assessment and delivery sequence

Assessment and implementation snapshot: 14 November 2026. Based on actual source inspection, isolated frontend trials and database tests. The fixture uses canned AI/images; these results do not establish live model quality, a real supermarket trial or long-term retention.

## Current foundation

| Experience | Existing implementation | Assessment |
|---|---|---|
| Shared stock/list | household.js, HouseholdModel, household_records and revision-checked apply_household_changes | One shared source of truth, field-level cart outbox and member isolation. Preserve these contracts. |
| Approximate inventory | WorkspaceEntry.availability, PantryReview and confirmation revisions | Home/low/out/unknown already exist. Age should prompt checking, never automatically remove food. |
| Chat/actions | CompanionModel, companion-ui.js, VoiceModel | Streamed chat, scoped local history, reviewed proposals, save receipt and undo. AI suggestions are not saved actions. |
| Recipes/cooking | RecipeRoomModel, RecipeRoom, recipe threads/progress, RecipeShopping | Library, favourites, full method, focus view, ingredient controls, recipe links on list, download/share. Cooking history/progress largely device-local. |
| Shared kitchen memory | KitchenModel, KitchenIntelligence, household_kitchen_preferences/events | Servings/time/diet/avoided ingredients, recent cooked recipes and recurring purchase patterns already exist. Do not rebuild them. |
| Proactivity | deterministic review/refill suggestions with snooze | Grounded in actual confirmations and purchase history, no LLM call per stock event. Keep it bounded and explain why each suggestion appears. |
| Voice/images | Gemini recorded audio/photos, Groq text, Cloudflare image service | Useful current Free pilot. Needs real latency/quota monitoring and a separately controlled paid route. |
| Native | Capacitor bridge and iOS/Android CI builds | Shared UI/data paths. A web fixture does not replace native microphone/keyboard/offline validation. |

## Verified core weaknesses

The recipe-library baseline showed that Főzzünk együtt immediately created a recipe thread just to inspect the recipe. Titles were not clickable, old step labels repeated long method text, and the full composer/dock took reading space. Stock-only recipe counts treated stale pantry entries as confirmed and absent entries as known missing.

The ordinary list already has quantity editing, categories, checked-state feedback, completion history and shared pending writes. It lacked a distinct store context, persistent purchased quick-add and shared store-route/session state. Its quantity editor already had a remove path, but that path needed a more discoverable labelled action and immediate undo.

The app always opened the chat destination, even though the active conversation was saved. It did not remember the last destination, scroll or a deliberate inactivity boundary.

## Implemented core iteration

- Inline recipe reading in the existing Recipes destination; clickable titles, full ingredients/method, explicit Start cooking. Inspection does not create a cooking thread.
- A compact Ingredients / Ask Morzsa dock while reading the full cooking method. Focus mode and an opened conversation retain the full chat controls. Busy/error/proposal states remain visible.
- Confirmed-at-home, to-check and to-buy summaries; unknown/stale ingredients are excluded from bulk missing actions until checked.
- Short named steps on curated recipes. Existing method text remains intact. Useful technique steps generate illustrations lazily by default, at most two per recipe, reusing the existing image cache.
- Scoped device-local resume state: destination, conversation, scroll, draft and cooking view. General use starts a fresh chat after 25 minutes; history is retained. Active recipes, drafts/protected work and Shopping Mode survive longer breaks.
- Shopping Mode uses the same cart: progress, remaining-first rows, expandable purchased section, persistent purchased quick-add, search/highlighting, category jumps, optional show-all and household route ordering.
- Local and shared session lifecycle; explicit exit keeps progress, completion keeps unchecked items and updates stock/history. Shared completion is an atomic, retry-safe RPC. Purchase attribution is set on the server.
- Normal-list remove action with undo; repeated simple adds do not duplicate or silently increment existing products.

## Shopping component model

```text
Exit / Shopping / Route settings
Purchased / total · remaining + progress bar
Sticky search + remaining/all toggle
Sticky category chips with remaining counters
Remaining category groups
  [check] Product / recipe reference [amount · details]
Expandable Purchased section, with uncheck correction
Persistent: I also bought… [+] / Finish
```

Starting a shared session is online. A cached active session and cart outbox support continuing through poor connectivity; completion waits for synchronization. Exiting is not completion. Quick-add in Shopping Mode marks purchased; ordinary entry creates unpurchased items. Checking alone does not mutate inventory. Completion reconciles exactly the accepted purchased rows and creates one archive per session id.

The additive shopping migration introduces household_shopping_sessions and household_shopping_routes with RLS. The old stock/cart/custom/history record shapes and old RPC stay valid. Server-side cart attribution supplements older clients. Existing kitchen events provide the shared removal history during an active session. No second stock/list store exists.

## Priorities and proposals

| Priority | User problem / next change | Complexity | Acceptance gate |
|---|---|---|---|
| Now | Verify these core flows with real shoppers and native clients | Small validation iteration | One-tap purchase, two-action removal, fast reconnect, no lost/duplicate purchases |
| Next | Inspectable recipe feedback memory, separated from temporary meal/event context | Medium; additive shared records and revision checks | Both members can correct/delete a note; no sensitive inference; feedback improves a measured follow-up |
| Next | Better activity attribution and useful undo discoverability | Small/medium | User vs assistant provenance and time are understandable; undo does not overwrite later partner edits |
| Next | Contextual dinner suggestions using low/uncertain items, preferences and diversity | Medium, reuse KitchenModel | Reasons cite real data, stale is uncertain, dismissal/snooze respected, no repeated nagging |
| Later | Shared recipe progress across devices/members | Medium | Concurrent step updates merge safely; browsing never marks a step complete |
| Later | Receipt/photo extraction with review and reconciliation | Large | Purchased vs mentioned/planned separated; duplicates and unit ambiguity handled before save |
| Later | Natural two-way voice and spending controls | Medium/large | See PAID-MODE-PLAN.md; Free is preserved and usage is capped |
| Do not build yet | Vector database, multi-agent framework, automatic expiry deletion, store mapping, always-on listening | Unjustified | Require a concrete measured user problem before adding infrastructure |

Implementation order: core iteration → real household validation → editable feedback/temporary memory → recommendation relevance → shared recipe progress → receipt/voice pilots. These later substantial changes need a concrete approved design; this document does not claim they are built.

## AI and cost architecture

Use deterministic event/confirmation logic for routine suggestions. Retrieve only the active recipe, relevant pantry/list rows and bounded household preference/history context on demand. Schedule background evaluation only after on-open suggestions demonstrate value. Keep permanent preferences distinct from planned meals and current sessions. Do not infer sensitive traits or store unnecessary conversation/audio.

Free/Plus share answer/action schemas and save tools. Add server-side entitlements and an atomic spend ledger before a paid rollout. Cache recipe/step images and keep one in-flight generation per cache key. Details and current rate assumptions are in [PAID-MODE-PLAN.md](PAID-MODE-PLAN.md).

## Validation and analytics

Automated checks cover old saves, 25-minute boundary/protected work, repeated add/check/complete, route conflicts, atomic failure, custom reminders, partner quantities, server attribution and non-member isolation. Browser checks use the actual frontend with synthetic data. Native voice/keyboard and a poor-connectivity supermarket trial remain separate checks.

Use the existing simulation harness for task/failure replays. Add scenarios for short/long reopen, forgotten purchased quick-add, partner correction while shopping, offline outbox replay, repeated completion and unknown ingredients. Report task success separately from AI accuracy; canned replies cannot validate recommendation quality.

Run five real couples for 30 days without requiring perfect inventory. Measure whether both use Morzsa, whether it replaces messages/notes, whether suggestions become cooked meals and where usage stops. A brief weekly question about coordination effort is more useful than total AI messages. No automatic enrolment or messages to users.

Proposed privacy-preserving event definitions: household active week, member active day, list/session completed, recipe opened/started/completed, proposal saved/dismissed/undone, suggestion accepted/dismissed, request failed and modality cost. Record identifiers/time/action category, never raw conversation/receipt/audio by default. Define consent and retention before adding telemetry.

Success gates: both-member weekly engagement, four-week household retention, recipe-open to cooking conversion, saved-action success, suggestion acceptance, time to finish shopping, fewer reported coordination mistakes and cost per active household. Keep paired-household evidence distinct from simulated benchmark scores.
