# MORZSA — INDEPENDENT, BROWSER-BASED CUSTOMER EXPERIENCE AUDIT

Act as an independent senior UX researcher and usability tester. Audit Morzsa by actually using its interface, primarily on mobile. Produce evidence and a developer-ready improvement backlog. Do not implement product changes.

This is an agent-based usability inspection using customer scenarios, not research with recruited human participants. Do not present simulated personas as real customer interviews or statistically representative evidence.

## Authorization and boundaries

- You may use Playwright MCP or a local Playwright test browser, start an isolated local test server, and create screenshots, recordings, scripts and reports. This is explicit authorization; do not ask again.
- You may create, edit and delete synthetic data in your own isolated test environment through the UI.
- Do not modify application source, deploy, commit, push, touch production data, send invitations or external messages, make purchases, or use paid AI APIs.
- Do not ask for passwords, API keys, access tokens or login codes in chat. Never copy secrets into your report.
- Follow applicable system/developer instructions and AGENTS.md. The request to avoid product documentation does not override mandatory agent instructions.
- Do not inspect product source, prior audits, implementation plans, tests that reveal expected UI flows, or internal product documentation until the initial customer exploration is complete and its notes are saved. Reading only the test harness for setup is allowed. Keep those technical observations separate from customer findings.
- Do not create other Codex tasks or message other sessions. Work autonomously within these boundaries.

## Verified project and test access

Project directory:
`/Users/I769428/Documents/ChatGPT/Főzés/konyha-app`

Public reference, read-only:
`https://szambaik.github.io/morzsa/`

The public deployment may lag behind the working tree. The primary target is a frozen copy of the current local application. Do not mix findings from different versions.

An existing local harness is available:
`tests/persistence-fixture.mjs`

It runs the actual frontend with an in-memory PGlite database, real recipe/conversation migrations and RLS, synthetic authenticated users, and mocked AI/image responses. It requires no real login, email verification, API key or paid service.

Use a separate port such as **8861**. Another development session may be using 8850. Do not reuse or stop another session’s server or browser contexts.

### First freeze your test version

The development session may still be editing this checkout. Create an isolated snapshot outside the repository, and serve that snapshot. Do not change the original checkout. Record the source HEAD, capture time and SHA-256 hashes of copied application files. HEAD alone does not identify uncommitted changes.

You may copy files without reading their contents for product knowledge. A minimal snapshot should contain:

- Top-level frontend `.html`, `.js`, `.css` files and `package.json`.
- `assets/`.
- `supabase/schema.sql`, `supabase/migrations/`, `supabase/seeds/`.
- `tests/persistence-fixture.mjs`.
- A symlink to the original `node_modules`, if it exists.

Do not copy `.git`, secrets, `.env` files, native projects, previous audit reports or generated output. If the browser reports a missing local runtime asset, copy only that required asset and update the manifest.

From the snapshot directory, run:

```sh
MORZSA_QA_PORT=8861 node tests/persistence-fixture.mjs
```

Wait for the server-ready message and a successful page load. If the port is occupied, choose another free port and consistently update all URLs below. Do not kill the other process.

### Synthetic identities

Open each identity in a **separate browser context**, not just a separate tab:

- `http://127.0.0.1:8861/?actor=c` — a synthetic authenticated user in their personal kitchen.
- `http://127.0.0.1:8861/?actor=a` — a synthetic user in the pre-created shared “QA kitchen”.
- `http://127.0.0.1:8861/?actor=b` — the other member of that same shared kitchen.

These links automatically establish local test sessions. This is test authentication; it does **not** validate production signup, login, OAuth or email verification. Do not mistake auto-login for a completed customer login task.

The server’s database lives only while that process is running. Separate browser contexts for the same actor represent the same account. Clearing browser storage does not reset that account’s server-side conversations. Use a separate harness process/port for journeys requiring completely independent account data.

### Onboarding caveat

The harness normally marks the introduction as completed. For the first-use journey, before the first navigation, use a narrowly scoped browser response interception on the local root HTML to replace the exact harness initializer:

```js
localStorage.setItem("morzsa-introduction-v1","done");
```

with:

```js
localStorage.removeItem("morzsa-introduction-v1");
```

Apply this only to that context’s first document response. Preserve the rest of the response and authentication. This is an explicitly disclosed test setup operation, not a customer interaction. Do not edit application files. Confirm that the intro actually appears. If it does not, record the limitation; after the initial exploration, use the visible intro replay entry if you can discover it.

### What this harness can and cannot prove

- The actual UI, interactions and supported recipe/conversation persistence can be exercised without production access. Verify both the visible result and persistence where relevant.
- The default chat returns a simple test answer. It is not a real cooking model and does not generally generate normal recipe suggestions. The default image service reuses a pancake photograph. Do not report these fixtures as poor AI intelligence or image diversity.
- Some household/pantry/list server routes are stubbed or incomplete. A successful HTTP response or local UI update is not proof of cross-user synchronization.
- Production authentication, invitation delivery, real AI quality/latency, real image generation, live audio and physical-device behavior are not established by this environment.

If a scenario is blocked by a harness limitation, label it **fixture-limited**, explain exactly what could still be observed, and continue. Do not turn this audit into a backend implementation task.

After the first unbiased exploration, you may create an isolated browser-only fixture adapter for controlled success/error states. For example, replace the test AI callback with deterministic valid recipes or an intentional timeout to inspect the interface. Never modify production code or send a request to a live provider. Clearly label every such scenario as **mocked**, and do not count injected results as customer-generated AI results.

## 1. Capture the first customer experience

Start with a fresh mobile browser context at **390 × 844**, touch/mobile enabled. Use the isolated personal account with first-use introduction enabled as described above. Use Hungarian UI first.

Take and open a screenshot of the entry screen before acting. Explore for about 10–15 minutes as someone who has not seen Morzsa before. Do not use source-derived routes or global JavaScript functions to find features.

Record, in order:

- What you think the product does and who it is for.
- What you expect each main destination and prominent control to do.
- What is clear or unclear about the personal/shared kitchen.
- How you discover ingredients, recipes, shopping, cooking and the AI assistant.
- Every hesitation, wrong turn, misleading expectation and recovery.

Save these first-impression notes before inspecting any product implementation. Do not retrospectively rewrite them to match the developer’s intent.

## 2. Use five customer scenarios

Run separate journeys. Each needs a concrete goal and recorded starting state; role-play alone is not sufficient.

1. **First-time, nontechnical user:** understand the product, choose a language, add three ingredients and find something to cook.
2. **Partner household:** distinguish personal and shared kitchens, discover invitations without sending one, and observe supported sharing between actors A and B. Check privacy defaults and confirm what the other member can actually see.
3. **Busy professional:** find a meal for two in about 20 minutes, use existing ingredients, list missing items and enter shopping mode.
4. **Inexperienced cook:** inspect a whole recipe, change servings, understand quantities without a scale, follow steps, use a timer, ask a contextual question, go back, pause and resume.
5. **Returning user:** find an older conversation, resume a recipe, start a fresh chat, retrieve a favorite/discovery and complete a shopping trip. Reopen the app and check what state returns.

Do not assume users know AI terminology or recognize unlabeled icons.

## 3. Complete tasks using the visible interface

Use ordinary clicks/taps, typing, scrolling, dialogs, keyboard and genuine swipe gestures. Prefer role/name locators derived from the visible page. DOM inspection is allowed for accessibility and layout evidence, but not to bypass the customer journey.

Do not call app globals such as `dashboardGo`, `MorzsaCompanion.openThread`, `commitState` or internal RPCs to make a task pass. Do not seed state after a failure and call that a successful journey. Clearly separated test setup and read-only verification are allowed.

### Onboarding and household

- Understand the purpose, choose a language and complete or skip the introduction.
- Add initial ingredients.
- Find the intro again.
- Discover personal/shared kitchen management and how to invite a partner. Stop before sending any invitation.
- Distinguish genuine first-use behavior from replayed intro behavior.

### Inventory

- Add an ingredient, search for it and change availability.
- Mark something used up and recover using undo if offered.
- Distinguish “at home”, “running low”, “used up”, “unknown” and “on list”.
- Check whether quantities are optional and where quantity editing belongs. Do not treat approximate stock as a defect merely because it is not exact inventory bookkeeping.
- Add an item directly to the shopping list.

### Shopping

- Create a list, add/remove items and adjust a quantity.
- Enter shopping mode; assess how obvious and reachable it is.
- Check off a purchase, add an unplanned product and finish the trip.
- Verify what happens to checked/unchecked custom items, stock and remaining list items.
- Reopen the list. For shared behavior, check the other actor’s browser, not only the initiating screen.

### Recipe discovery

- Browse the existing feed, search and open a card.
- Check ingredients and distinguish real shortages from unknown availability.
- Change servings and verify updated quantities.
- Open/close ingredients while partway through a recipe and check whether reading position is retained.
- Add missing ingredients to the list; verify quantity and recipe attribution.
- Favorite/unfavorite a recipe and find it again.
- Discover the weekly planning entry point without using internal routes.

### Cooking

- Read the whole recipe before starting.
- Enter cooking mode, identify the active step and navigate forward/backward.
- Start/stop a timer if available.
- Find contextual chat, ask a question and return to the same cooking step.
- Pause, navigate elsewhere, reload and resume.
- Finish and understand whether pantry changes require a separate confirmation.

### Kotyvasszunk

- Discover it naturally from a new conversation.
- Try an empty bowl, one ingredient and six ingredients; attempt a seventh.
- Add/remove by tap, search and filter by category and actual availability.
- Check that touch scrolling works over ingredient illustrations.
- Generate suggestions if the environment supports them; otherwise use a clearly marked deterministic response scenario after the initial exploration.
- Inspect shortages, open a result, save a favorite/discovery and find it again.
- Try no suitable recipe, retry and editing the selection.
- Verify that choosing ingredients alone does not alter pantry/list state.

### Voice

- Find the voice entry, inspect available state labels and end/retry controls.
- If no real microphone/WebRTC/live service is available, explicitly mark real listening, speech, interruption and latency **untested**. A simulated audio file or mocked event is not evidence of live conversational quality.
- You may inspect permission denial, unavailable service and other controlled error states without paid calls. Verify that a customer can recover or return to text.

## 4. Responsive and accessibility checks

Exercise the core journey at 390 px. Recheck relevant screens at **320, 360, 430 and 1440 px**, plus a short mobile viewport to expose dock/keyboard problems. Test English on the highest-risk screens.

Check:

- Horizontal overflow, clipped controls and unexpected horizontal scrolling.
- Reachable actions and approximately 44 × 44 px primary touch targets.
- Bottom navigation/composer/task-dock collisions and safe-area spacing.
- History swipe open/close versus normal vertical scrolling.
- Long recipe/ingredient names and realistic list lengths.
- Focus visibility/order, accessible names, dialogs and keyboard dismissal.
- Reduced-motion behavior and legible contrast where measurable.
- Empty/loading/error states and clear next actions.

Browser emulation does not prove physical iPhone keyboard, Safari, Dynamic Island, microphone or screen-reader behavior. State those limits. Do not claim accessibility compliance from screenshots alone.

## 5. Evidence and findings

For each task record:

- Persona, goal, environment/version, viewport/language and starting state.
- Status: **completed / completed with friction / failed / not discovered / fixture-limited / untested**.
- Exact visible navigation path.
- Expected versus observed result.
- Meaningful interaction count where measured; separate attempts and recovery. Do not equate tool runtime with human task time.
- Relevant console/network errors, with secrets redacted.
- Screenshot references and a concrete customer impact.

Capture screenshots at the decisive states and open them for visual inspection. Reject blank, stale or wrong-state captures. Annotate copies, keeping originals. Screenshots alone do not prove that a control works.

Classify every finding as **observed bug**, **observed usability friction**, **design hypothesis**, or **test-environment limitation**. Assign confidence. Do not infer a technical root cause from appearance alone.

After initial notes are complete, you may inspect relevant source read-only to verify a suspected cause or identify implementation files. Mark this as developer analysis; do not rewrite the customer observations.

## 6. Prioritized implementation backlog

Use stable IDs, e.g. `MORZSA-UX-001`. For each recommendation include:

1. Priority: **P0** critical data/privacy failure or unusable core product; **P1** core task blocked or repeatedly misleading; **P2** meaningful recoverable friction; **P3** polish.
2. Evidence and reproduction steps.
3. What is wrong and why it matters.
4. Exact proposed behavior/copy/layout change.
5. Acceptance criteria, including relevant mobile widths and error/empty states.
6. Relative effort (S/M/L), confidence, dependencies and quick-win status.
7. Relevant files only if inspected after initial exploration; otherwise mark implementation location unknown.

Preserve Morzsa’s warm cream, sage, forest-green and terracotta identity. Favor understandable tasks and fewer competing actions over aesthetic novelty. Do not recommend a redesign solely because you prefer another style.

## Deliverables and completion

Create a unique folder under:
`/Users/I769428/Documents/ChatGPT/Főzés/konyha-app/output/customer-audit/`

Include:

- `README.md`: environment, snapshot manifest, setup, scope, limitations and evidence links.
- `first-impressions.md`: chronological, unbiased first-use observations.
- `journeys.md`: five executed customer scenarios and task outcomes.
- `audit.md`: executive summary and screen-by-screen findings, covering navigation, hierarchy, interaction, mobile/desktop, accessibility, onboarding, AI trust and collaboration.
- `backlog.md`: prioritized, implementable tickets with acceptance criteria.
- `screenshots/`: numbered originals and optional annotated copies/contact sheet.
- Reusable browser scripts or traces when useful, containing no secrets.

Report in Hungarian; preserve exact UI labels in their tested language. Finish with a concise summary: top five issues, what genuinely worked, completed versus blocked/untested coverage, and clickable artifact links.

Do not stop at a plan or a screenshot-only critique. Execute the journeys. Keep progress updates concise. If one feature is blocked, record why and continue with independent tasks. End only after the audit and backlog are saved, or after clearly documenting an unavoidable environment blocker. Close only browser contexts and servers you created; preserve the snapshot, report and evidence.
