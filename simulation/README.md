# Morzsa household simulation

Purpose: discover UX/UI friction and useful product opportunities, while checking that shared data remains safe. A green data test is **not** proof of good usability or correct AI interpretation.

The original brief is preserved unchanged in ../../simulation.md. This first pilot is deliberately smaller than its 120–180 interaction, seven-day target.

## Architecture assessment

- Vanilla/classic JavaScript frontend; index.html loads the production components. No separate simulation UI is built.
- Stock is approximate availability (0/1/2); shopping items, custom products and purchase archives retain their existing formats. VoiceModel plans changes; HouseholdModel encodes and diffs revisioned records; ShoppingModel completes purchases; PantryReviewModel ranks reminders.
- Authenticated Supabase RPCs and RLS protect shared households. Shared writes use revisions and atomic batches. Conversation history, recipe progress and saved recipe favourites are largely device-local: they are not a complete shared conversational memory.
- AI text uses the production voice-command handler and Groq adapter; photos/audio and images use separate providers. Changes remain proposals until saved. The browser fixture returns canned AI and a canned image. It cannot establish model quality, image relevance, provider latency or live realtime behaviour.
- Existing test SQL can run in PGlite. The pilot reuses supabase/schema.sql and real RPCs with two authenticated identities per synthetic household, all in memory. This checks the base shared-record contract, not every newer migration, realtime transport or production deployment.
- UI actors use isolated local origins. They see the actual frontend through a 390 × 844 iframe, without source-code or button-level instructions. The parent's engineering checks are recorded separately from their independent sessions.

## What is implemented

1. **Offline replay runner:** six household definitions, two independent auth identities and personal histories each, eight scenario events per household. A seed controls household ordering. Input utterances and interpreted operations are scripted, so it does not measure AI intent accuracy or realistic autonomous behaviour. The pilot covers two scenario days; the seven-day scheduler and personality-driven decisions are future work.
2. **Isolated UI fixture:** actual frontend, synthetic inventory, canned AI and stock photo, no production writes. Two independent goal-driven Codex actor sessions were attempted, with 18 actions / 15 browser calls maximum each.
3. **Evidence and comparison:** JSONL events, before/after shared records, RPC changes/conflicts, measured local RPC time, numerical invariant results and a comparison command. UI findings retain screenshot/session evidence and infrastructure interruptions.

Run from the repository root:

~~~sh
node simulation/run.mjs simulation/runs/my-baseline
node simulation/run.mjs simulation/runs/my-candidate
node simulation/compare.mjs simulation/runs/my-baseline simulation/runs/my-candidate
python3 simulation/fixture.py 8811
~~~

Use a fresh unused localhost port for each UI session: local storage is scoped by origin. Open /simulation-preview for the fixed mobile frame or / for desktop. Stop the server after the run. Restarting the same port does not reset storage. The fixture requires running from the repository root. /simulation-preview?intro starts the empty first-use introduction.

Do not use the fixture's canned reply correctness as an AI score. Do not use its mocked household object as a shared sync test. Do not put real users, provider keys, household data or auth tokens in logs.

## Proposed next harness

Keep Node + PGlite + the browser adapter; no LangGraph or hosted evaluation framework is necessary. Add these stages separately:

| Stage | Components | Completion gate |
|---|---|---|
| Behaviour with real AI | Isolated development-provider key; production normalizeInput/bodyFor/groqBody/validOutput; bounded request history; replayable provider output; actual proposal → confirm → RPC | Purchases, consumption, uncertainty and recipe follow-ups tested with real inference; token/call ledger recorded |
| Complete UI pilot | Stable per-actor browser adapter; fresh origins; independent goals; action and screenshot capture after each outcome; external network allowlist | Every actor finishes or explicitly abandons; tool failures counted separately; mobile frame bottom captured |
| Two-person longitudinal | Seeded seven-day events; 12 private actor contexts; isolated real household state; injected stale reads/delays; all relevant migrations | Both actors see saved changes, conflict recovery and daily reminders over 120–180 interactions |
| Independent evaluation | Task-specific checks + judge that sees only goals, logs, screenshots and expected safeguards; actor/evaluator contexts separate | Findings cite evidence; judge calibrated against a few real people; stable repeated baseline |

The next behaviour integration is a small adapter (roughly 1–2 focused engineering days). Completing browser recording/recovery and independent judging is a separate 1–2 day task. These are estimates, not a delivery promise. A development API key and a stable browser-control surface are the current blockers; production secrets must not be extracted to work around them.

## Models and cost control

Use Morzsa's current **Groq openai/gpt-oss-120b** as the app being tested. Changing the product model during the same UX comparison would confound results. Keep canned images in the UX pilot; test generated-image relevance separately with a small matched sample.

For a future API-driven actor, **gpt-6-luna** is a cheap candidate for short goals and image/DOM observations; use **gpt-6.1-sol** only as a judge on selected difficult sessions. Do not let the actor see the app source, expected button sequence or evaluator rubric. The current Codex actor pilot used inherited model settings, not a verified Luna override.

Official model pricing consulted for this proposal: Luna $0.10/M input and $0.50/M output; Sol $2/M input and $10/M output. A hypothetical 180 actor calls × 6,000 input / 300 output tokens is $0.135; 180 judge calls × 4,000 input / 500 output is $2.34. These are text-token estimates only, not the cost of this run; repeated history, reasoning, screenshots, retries and the app's providers can change the total. Use a $3 hard estimated-budget cap, 180 actor calls maximum, 20 judge samples initially and zero image generation. Reserve the budget before a call and reconcile actual usage afterward; refuse the next call when the cap cannot be respected.

Sources: [Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol), [pricing](https://developers.openai.com/api/docs/pricing), [evaluation guidance](https://developers.openai.com/api/docs/guides/evaluation-best-practices). Recheck before paid execution. A seed repeats the scenario order; deterministic API replay requires recording outputs, because model calls are stochastic.

**This pilot made zero external provider API calls.** The Codex conversation and two actor sessions consume the user's existing model quota/billing; this environment does not provide their actual dollar cost. They must not be described as free or $0 total.
