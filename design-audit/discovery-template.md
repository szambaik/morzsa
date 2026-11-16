# Morzsa discovery — current repository

Inspected on 16 November 2026, Europe/Budapest. This document records source discovery. A feature being implemented does not establish that it works. Runtime evidence, execution status and environment limitations belong to each timestamped audit run.

## Revision and change control

- Repository: `/Users/I769428/Documents/ChatGPT/Főzés/konyha-app`.
- Branch: `main`. HEAD: `cf2b7887ffa1777e7dbb7699103c6ec90cb07d5b`.
- Commit: 15 November 2026, 08:14:07 +0100, “Make recipes readable, scale portions and preserve cooking context”.
- Inspected files contain later 16 November cache labels and tests. HEAD alone therefore does not identify the audited source. The orchestrator must retain a working-tree content manifest/hash and initial/final change inventory. Full Git status was slow in initial discovery; revision, branch and latest-commit reads succeeded.
- Product source, root package, production configuration, authentication/security policies, databases and user data are out of scope for edits. Audit infrastructure/evidence belong under `design-audit/`. No commit, push or deployment.
- `AGENTS.md` requires preserving v1/v2 saves, shared records, RPC contracts and separate local/shared data. `PRODUCT-DESIGN-PRINCIPLES.md` establishes convenience over precision.

## Current architecture

Morzsa is a browser-first vanilla JavaScript application whose HTML/CSS/JS are copied into Capacitor iOS/Android builds. It is not React or a SPA with URL routes. `index.html` loads ordered classic scripts exposing globals and IIFEs. `app.js` owns `state`, `page`, `#main`, navigation, initial rendering, core shopping actions and local persistence. Later scripts replace or extend earlier renderers: `pantry-library.js` replaces `renderPantry`; `recipe-room-ui.js` and `recipe-library.js` implement current discovery and reading; `workspace-ui.js` moves navigation/settings between mobile and desktop and supplies contextual controls. Follow the final runtime implementation when inspecting behavior.

The five destinations are `overview`, `pantry`, `chat`, `shopping` and `recipes`. Initial `page` is `chat`, with onboarding when there is no introduction marker or v1/v2 save. Mobile order is Overview, Pantry, Morzsa, List, Recipes; desktop starts with Morzsa. Page switches do not change the URL. Cooking, ingredient crafting, weekly plans and recipe discussions live within conversations. Native HTML dialogs implement ingredient, quantity, account, history and other contextual surfaces.

### State and persistence

`app.js` loads `morzsa-v2`, falling back to `morzsa-v1`, preserving stock/custom/cart/likes/skips/chats/history. Availability is approximate: stock 2 = at home, 1 = low, explicit 0 = used up; an absent key means unknown. `workspace-entry.js` and `pantry-library.js` preserve this distinction. Shopping quantities are independent cart fields: quantity/unit/done, with optional recipe requirements, category, note and purchaser metadata. `QuantityModel` validates shopping values; `RecipeShopping`, portion and measure models separate recipe need from purchase amount.

`commitState` writes local storage before replacing in-memory state and can reject failed persistence. Shared cart changes first persist an intent in a scoped local outbox. The UI can therefore represent locally saved changes before server confirmation. `household.js` retries revision conflicts and exposes pending/error states. These persistence levels must remain distinct in findings and AI receipts. Shared stock writes use revision-checked RPC changes. Own-kitchen storage and household caches remain separate; joining a household does not silently import the local pantry. Explicit pantry-copy UI now exists.

Conversation and cooking structures live in `companion-model.js`, `session-model.js`, `cooking-session.js` and `recipe-room-model.js`. `persistence.js`/`persistence-model.js` manage account conversations, recipe documents/library, queues, turn claims, historical pages and sharing. Conversations are private until explicitly shared; shared conversations are read-only and can be copied. Source support alone does not establish deployed privacy/RLS behavior.

### Backend, authentication and household synchronization

`household-config.js` is public frontend configuration. Before browser navigation, intercept production-origin traffic or replace the config only in the test server’s in-memory response. Never reuse a browser profile, existing tokens or real household data. `household.js` calls Supabase Auth, REST, Storage and Edge Functions through a request wrapper. Email/password, registration/recovery and OAuth are implemented. `auth-link.js` handles return links and sensitive parameters. Native `mobile/bridge.js`/`mobile/vault.mjs` adapt secure storage, lifecycle, browser/deep links and device APIs.

`supabase/schema.sql` and migrations define household records/revision writes, invitations, pantry reviews, kitchen preferences/events, shopping sessions/routes, conversations, recipe library/documents, images and Plus access. `household-live.js` treats WebSocket events as wake-up signals: authenticated reads and revision writes remain authoritative, with polling fallback. Mocked synchronization establishes client behavior only within that fixture’s assumptions; it cannot prove production RLS, delivered invitations or production consistency.

### AI, voice and media

`AIMode` defaults to Plus unless the per-account preference is Free. Selecting a route does not grant access. The current frontend routes chat/voice/image requests to Supabase Edge Functions. Free and Plus differ: `voice-command` supports Groq/Gemini routing and fallbacks; `plus-assistant` handles OpenAI text/realtime and images. `recipe-image` supports configured OpenAI, fal and Cloudflare paths, with Groq prompt work. Environment variable names were inspected in source; no secret file was read, and provider availability was not inferred.

`chat-stream.js`, provider stream handlers and `companion-ui.js` support incremental answers. Structured proposals are parsed separately from conversational output. Browser tests must distinguish conversation, suggestion, clarification, applied and failed actions by checking persisted state, not receipt text alone. Real voice uses microphone/audio APIs. Permission-denied and text-fallback testing are feasible without microphone access. Model intent accuracy, transcription quality, live latency, entitlement and generated-image quality require separately authorized services.

### Styling and identity

The cascade is `styles.css` → `desktop.css` → `workspace.css`. Final workspace variables match cream `#F8F3E9`, sage `#E8EDDE`, forest `#344638` and terracotta `#BF4E2C`, with warm wheat/soft-orange surfaces. Headings/brand use Sora and UI Inter, imported from Google Fonts by `styles.css`. A network-isolated run may render fallback fonts unless provided separately; record this and limit typography conclusions accordingly. Preserve `assets/brands/morzsa.svg`, `assets/illustrations/morzsa-mascot.webp` and existing food/category artwork. `BRAND.md` includes earlier token values, so final CSS and observed UI take precedence.

Layout rules change around 350/360 px, 700/760 px, desktop sidebar at 1000 px, contextual list rail at 1340 px and three-column recipe feed at 1440 px. Fixed composers, cooking/shopping docks, dialogs, inner scroll areas, reduced motion and visualViewport behavior need browser checks. CSS intent is not a responsive pass.

## Screen inventory

`screen-inventory.json` contains 23 source-inspected surfaces. Each entry includes purpose, main action, secondary actions, important states, components, responsive behavior, dependencies and journey mappings. Runtime verification is recorded per run.

| Surface | Main action | High-value states to inspect |
|---|---|---|
| First-time tour and pantry setup | Select actual ingredients then explicitly save | Tour, skipped, staged-not-saved, success, failed save |
| Morzsa conversation | Send a question or action request | Empty, thinking/streaming, proposal, clarification, receipt, failure |
| Overview | Follow next pantry/list/recipe action | Empty pantry, stock, shortages, pending shopping |
| Pantry library | Add ingredient or change availability | Home, low, used up, unknown, search, undo |
| Ingredient details | Choose one availability state | Existing/unknown, already listed, saving |
| Quick add | Select then save a batch | Input/options, staged chips, destinations, failure |
| Pantry presence check | Confirm present or mark used up | Suggested, skipped, shared save/error |
| Shopping planning | Add or check purchase | Empty, grouped, partly/all purchased, outbox |
| Shopping editor | Save quantity/unit | Invalid input, concurrent edit, removal, failure |
| In-store mode | Check next item | Remaining/purchased, category, search, resume |
| Finish shopping and archive | Finish checked purchases | Mixed/none/all checked, error, reuse |
| Recipe discovery/library | Open recipe | For you/Browse/Saved, loading, empty, error |
| Recipe reader | Start cooking | Scaled portions, missing/unknown, image states |
| Ingredients and shopping preview | Preview then confirm missing items | Need vs purchase quantity, availability, already listed |
| Cooking preparation | Begin cooking | Servings, missing items, method |
| Guided cooking | Complete step | Timer, question, full method, interrupt/resume |
| Cooking completion | Finish/return | Optional feedback, no implicit deduction |
| Ingredient crafting | Select up to six and discover | Empty/max, no matches, loading/error, unsuitable result |
| Weekly plan | Create/edit plan | Skip days, servings, generated recipes, saved edits |
| Kitchen/account management | Select kitchen/sign in | Own/shared, pending/error, invite inspection |
| History/settings | Open earlier conversation | Private, shared read-only, archive, sync retry |
| Cooking preferences | Save scoped defaults | Personal/shared, advanced fields, failure |
| Voice | Speak or use text fallback | Permission denial, listening/thinking, unavailable/error |

## Existing testing and development environment

- npm is the package manager; root `package-lock.json` exists. Root dependencies include PGlite 0.3.14, esbuild and Capacitor 8. Record installed tool/browser versions in each audit run.
- Discovery counted 55 `*.test.cjs`, 25 `*.browser.js`, eight `*-sql.test.mjs` plus `email-invites.test.mjs`, and `tests/test_server.py`. These are file counts, not tests or pass results.
- `npm test` executes CJS and explicitly listed household/invitation/recipe-AI/voice/realtime/pantry-review/kitchen/shopping/persistence SQL checks. The documented Python command is `python3 -m unittest discover -s tests -v`. Preserve exit codes and output separately from browser results.
- Existing browser files are standalone async Playwright functions, not an installed Playwright Test suite. They often assume hard-coded ports, use direct application calls to seed state and write into older design folders. Do not run blindly and overwrite prior evidence; reuse current contracts/selectors in audit-owned fresh contexts and paths.
- `tests/persistence-fixture.mjs` serves in-memory PGlite with schema, persistent-library/detail/portion/image migrations and catalog seed. Synthetic actors a/b/c receive a local origin and deterministic AI hooks. It is useful for recipe/conversation persistence but not every household RPC: some generic paths return placeholders. It cannot establish complete collaboration behavior.
- Python assistant/companion fixtures replace substantial runtime methods with fake AI. They are useful harness examples but cannot establish provider behavior or full frontend/backend contracts.
- Useful selector/contract examples include `ux-audit-2026-11-16.browser.js`, `mobile-e2e.browser.js`, `shopping-shared.browser.js`, `shopping-speed.browser.js`, `pantry-start.browser.js`, `guided-cooking.browser.js`, `recipe-portions.browser.js`, `persistence.browser.js` and `auth-session.browser.js`. Old screenshots and reports are not current audit evidence.
- `python3 server.py` is documented startup, defaulting to `0.0.0.0:8765`. Manual loopback startup would use `MORZSA_HOST=127.0.0.1 MORZSA_PORT=<unused-port>`. However, legacy `/api` handlers read `.env`; prefer an audit-owned loopback static/fixture server, with API requests denied/fixture-routed and no secret access.
- `build:web` writes `web-dist`, `build:mobile` writes `dist`, and sync modifies native assets. Those mutations are unnecessary for this audit. Serve current runtime files unchanged.

## Proposed safe execution plan

1. Record branch, revision, runtime-file content manifest and tool versions. Create a unique timestamped run directory; preserve earlier reports.
2. Start an audit-owned loopback server exposing only runtime allowlisted scripts, styles, artwork and explicit fixtures. Use a fresh browser context. Block external HTTP and WebSocket traffic before navigation, including auth, Supabase, provider images and external assistants. Classify blocked and mocked requests separately.
3. Capture first-time flow, all destinations, critical dialogs, empty/error/loading states. Use visible controls for journey actions. Direct runtime reads may verify persistence; writes are only for declared fixture setup/error injection. Capture screenshot, DOM, console/page errors, network metadata and resulting synthetic state.
4. Execute feasible A–G. If a faithful shared fixture is provided, use two independent contexts, delayed/failed writes and a revision conflict. Distinguish client-fixture behavior from untested deployed auth/RLS/realtime. Inspect invitation UI without triggering real delivery.
5. At 320×640, 375×812, 390×844, 768×1024, 1280×800 and 1440×900 measure overflow/control bounds and capture screens plus high-risk dialogs/docks. Include a touch-enabled mobile context, and representative narrow English checks.
6. Run axe-core on stable screens and preserve full results. Add keyboard traversal/activation, Escape, focus containment/return, visible-focus captures and invalid-form announcements. Screen-reader behavior remains unverified without an actual assistive-technology session.
7. Independent UX, visual, QA, accessibility and product agents review the same manifest. Require schema-compliant evidence-linked findings. Merge demonstrated duplicates only; reproduce high-priority issues and inspect owning source. Hypotheses stay hypotheses.
8. Generate reports/backlog/implementation briefs and actual pass/fail/skipped totals. Test runner startup, evidence creation, schema rejection, deduplication, missing-evidence detection, report generation and non-destructive reruns. Do not implement product fixes.

## Journey mapping and limits

| Journey | Feasible local/fixture work | Separate evidence required |
|---|---|---|
| A — First time | Fresh context; complete/skip; staged pantry; explicit save; next action; kitchen scope | Real first-use comprehension/user research |
| B — Inventory | Add/search/detail; 2/1/0; list action; remove/undo; reload; storage failure | Shared server success unless backed by faithful RPC fixture |
| C — Shopping | Add/edit quantities; check/remove/undo; store session; finish; reload; invalid input | Live concurrent household delivery |
| D — Recipes | Fixture catalog/feed; open; portions; unknown/low/out; preview then save | Live ranking and model recipe quality |
| E — Cooking | Prepare; portions; steps; timers; interrupt/resume; feedback; mocked contextual AI | Physical-device audio/background behavior |
| F — AI | Deterministic normal/inventory/recipe/action/ambiguous/invalid/error/empty/loading/stream cases; state verification | Real intent accuracy, provider latency/cost/entitlement, transcription |
| G — Household | Own/shared UI; synthetic accounts; invitation inspection; two-context conflict if supported | Real messages/invitations, deployed auth/OAuth/RLS and production sync |

## Environment limitations

No production credentials, private household data or real accounts are authorized. No secret file was read. Production configuration may reference a working backend: this requires isolation, not probing. Browser results establish behavior only within the recorded fixture contract. Real AI, microphone/audio quality, native iOS/Android, deployed database policies and actual multi-user adoption require separate testing. Blocked font/image conditions must be stated beside affected visual evidence. A fixture failure is a harness/environment issue until independent evidence shows a product defect.

## Documentation drift

Early chronological sections of `README.md` say no cloud/auth/sync, no low state, three navigation destinations and legacy Python AI. Current source has cloud authentication, 2/1/0 states, five destinations, Supabase AI routing and account recipe/conversation persistence. Prefer owning runtime code and fresh browser evidence. Do not transfer earlier test-pass claims without rerunning. This drift is discovery context, not a confirmed user-facing UX defect.
