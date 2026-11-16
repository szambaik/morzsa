# Morzsa autonomous UX/UI audit

The audit runner serves the current Morzsa source in an isolated local fixture, drives real browser interactions, captures evidence, validates a shared finding schema, and generates a prioritized backlog and implementation briefs. Application source, production configuration and household data are outside its write scope. Nothing is committed, pushed or deployed.

## Start and rerun

From the repository root:

```sh
npm --prefix design-audit ci
npm --prefix design-audit run browser:install
npm --prefix design-audit run audit:ux -- --profile full
```

The command starts and stops its own loopback fixture. A fresh browser context and synthetic household records are created per journey. Existing browser sessions are not reused. The documented product startup is `python3 server.py` at localhost:8765; full, QA and regression profiles also probe the actual Python Handler on an ephemeral loopback port, blocking all AI/network side effects. Any discrepancy between that server and the fixture is reported separately. You do not need to start the product manually for the audit.

Requirements: Node.js 20.19+ (Node 22+ recommended), npm, Python 3, Chromium or an installed Chrome fallback, the dependencies in this isolated package (including its own pinned PGlite). No API key, real test account, production database or email is needed for the deterministic audit.

The browser download command installs Playwright's Chromium in its normal user cache. The main browser harness falls back to an isolated installed Chrome when the bundled Chromium is unavailable. It never attaches to your personal browser profile. Supplemental probes use installed Chrome by default; `MORZSA_AUDIT_BROWSER_CHANNEL=chromium` selects the bundled browser where supported.

## Profiles

```sh
npm --prefix design-audit run audit:ux -- --profile full
npm --prefix design-audit run audit:ux -- --profile ux
npm --prefix design-audit run audit:ux -- --profile visual
npm --prefix design-audit run audit:ux -- --profile qa
npm --prefix design-audit run audit:ux -- --profile accessibility
npm --prefix design-audit run audit:ux -- --profile regression
```

Profiles select specialist lenses. All profiles currently capture the same complete A–G browser and responsive suite, which preserves shared context; full, QA and regression additionally test documented Python startup. Full selects all five reviewers; UX selects UX and product strategy; visual selects visual design; QA selects QA; accessibility selects accessibility; regression selects QA and accessibility. This intentional common baseline makes lens comparisons reproducible; profiles are not a faster subset of navigation tests. This does not mean unselected specialist reviews ran.

## Actual autonomous specialist agents

The default deterministic command does not pretend to run AI reviewers. It creates explicit unavailable specialist reports, retains browser evidence and generates a manually reviewable report. To run actual specialist model sessions and an independent validator:

```sh
npm --prefix design-audit run audit:ux -- --profile full --agents codex
```

This explicitly opts into the locally installed, authenticated Codex CLI. Each specialist gets the same revision, project context, browser evidence and schema, then reviews independently. Their prompts prohibit reading each other's reviews. A separate orchestrator validator reconciles the reports afterward. Important P0/P1 claims trigger a second isolated browser pass; automated confirmation requires evidence from that reproduction pass. Hypotheses remain hypotheses. If provider execution, authentication or a schema check fails, that stage is marked unavailable or incomplete. This adapter has no embedded keys; it uses existing Codex authentication. It may consume the configured provider's usage allowance.

The runner calls `codex exec --ignore-user-config --ephemeral --sandbox read-only` with approval policy `never` and a strict output schema. It deliberately omits user-configured MCP integrations and does not choose a model override. Filesystem sandboxing applies to the child; no product edits are requested. `MORZSA_AUDIT_CODEX_BIN` can point to the installed CLI executable. Do not put credentials in this variable or the repository. The adapter does not require configuring Morzsa's real AI service.

The browser's canned AI responses test rendering, loading, streaming, empty/error responses and persisted action receipts. They do not validate the quality or safety of a live model. Shared-household tests use synthetic identities and an isolated in-memory SQL backend. They do not validate live OAuth/email, production Realtime infrastructure or physical devices.

## In-session specialist review workflow

An actual Codex subagent or human specialist can review the same evidence without the optional CLI adapter. The orchestrator can prepare a run first:

```sh
node design-audit/engine.mjs --prepare --profile full
```

Preparation only creates context and prompts; it is not an executed audit. Normally run the complete deterministic command first, use the printed `AUDIT_RUN_DIR`, and have the independent reviewers read its evidence. Reviewers produce JSON according to `schemas/review.schema.json` and `ENGINE-CONTRACT.md`. Record the actual method (`codex-subagent`, `codex-cli` or `manual`) and only paths actually reviewed. Importing preserves any previous review version:

```sh
node design-audit/engine.mjs --import-review /absolute/path/qa-review.json --run /absolute/path/run
node design-audit/engine.mjs --finalize /absolute/path/run
```

`--finalize` regenerates reports in a new immutable snapshot. It does not rerun the browser or imply new reproduction. For cross-validation, write `validation.json` in the run folder using the contract's finding ID, status, evidence and notes. P0/P1 findings need this separate validation. Conflicting duplicates require an explicit `resolvesConflicts: true` with the rationale. Missing evidence is rejected.

## Shared state and storage

- `engine.mjs` is the central coordinator; `lib/` contains the schema validator, evidence store, duplicate merger, agent adapter, validator and report generator.
- `browser.mjs`, `fixture.mjs`, `documented-startup.mjs` and `supplemental.mjs` produce deterministic current-run evidence.
- `agents/` contains the five specialist instruction templates; each run also records the exact generated prompts.
- `runs/<UTC-timestamp-random>/context.json` captures revision, branch, environment and root application SHA-256 fingerprints. `state.json` tracks completed/pending stages.
- `runs/<id>/evidence/` stores screenshots, DOM trees, console/network logs, accessibility results and `results.json`. `design-audit/evidence/<id>` is a convenience symlink to this preserved evidence.
- `runs/<id>/reviews/` holds original independent JSON reviews and prompt files; imported older versions are archived in `reviews/history/`.
- `runs/<id>/validation.json` records orchestrator decisions. `reproduction/` contains a second browser run when requested by the autonomous adapter.
- `runs/<id>/reports/<timestamp-random>/` contains the five specialist reports, cross-validation, `FINAL-REPORT.md`, `IMPLEMENTATION-PLAN.md`, `SCREENSHOT-INDEX.md` and machine-readable `findings.json`.
- Top-level report files are append-only indexes to all report versions. `latest-report.json` is a mutable pointer, not an earlier audit report.

Never edit an earlier evidence directory to make a check pass. Rerun the audit into a new folder. Source fingerprints detect changes during execution; the browser network allowlist blocks non-fixture HTTP and WebSocket traffic. Recorded blocked network requests are expected safety behavior, distinct from genuine app failures.

## Classification and evidence rules

Every finding includes ID, title, category, severity, priority, confidence, screen/component, reproduction steps, expected/actual behavior, impact, evidence, screenshots, known sources, solution, acceptance criteria and validation status. Optional regression tests and duplicate keys support handoff.

Severity is Critical/High/Medium/Low, priority P0/P1/P2/P3, and confidence High/Medium/Low. P0 is reserved for Critical issues. Category distinguishes confirmed bugs, reproducible usability issues, visual inconsistencies, accessibility issues, product opportunities, hypotheses and environment limitations. High confidence requires verified/reproduced evidence. Product opportunities are not counted as confirmed bugs. Screenshots cannot establish full accessibility conformance.

Evidence paths must resolve to files inside the current run; traversal, missing paths and symlinks outside it are rejected. Duplicate findings merge all evidence, source references, reproduction/acceptance criteria and reviewer IDs. Differing severity, interpretation or proposed remedy is exposed for reconciliation. Important claims cannot become confirmed just because multiple reviewers repeat them.

## Compare releases and regression checks

```sh
node design-audit/engine.mjs --compare /absolute/old-run /absolute/new-run
npm --prefix design-audit run audit:ux -- --profile regression --baseline /absolute/old-run
```

Comparison reports added, persisting and not-observed-again finding identities, plus passing checks that regressed and failing checks that now pass. Absent findings are not called fixed. Different profiles produce an explicit comparability warning. Use the same profile, synthetic data and browser version for the strongest comparison. Screenshot assessment remains a real reviewer responsibility; there is no arbitrary pixel-difference threshold that automatically becomes a UX defect.

## Test the audit system

```sh
npm --prefix design-audit test
```

The system tests cover schema enforcement, unsupported confidence, missing/escaping evidence, duplicate merging, disagreement handling, high-priority confirmation gates, unavailable providers, report generation, import history, preservation across repeated runs, comparison, browser failure recording and orchestrator execution. These tests validate infrastructure only. Product browser findings are in the actual run's results and can legitimately fail.

Exit status 0 means selected deterministic checks completed without a failed assertion. Status 2 means observed checks failed; reports are still written. Status 1 means infrastructure/provider/evidence errors. Missing optional AI review alone is clearly reported but does not prevent deterministic testing. A passing command does not imply all specialists ran, all journeys were feasible or production behavior was verified.

## Verified execution on 16 November 2026

The initial unattended Codex CLI provider smoke returned HTTP 401. Its actual authentication failure is recorded; no successful unattended LLM execution is claimed. Five in-session specialist subagents reviewed the shared canonical run instead, and their JSON reviews were imported and cross-validated. Future `--agents codex` runs require valid existing CLI authentication. The deterministic command needs none.

The complete audit used an isolated installed Chrome because bundled Chromium was unavailable. Current fonts were blocked by the outbound allowlist; brand layout was reviewed but Sora/Inter font fidelity was not certified. Two full browser captures and a narrow independent conflict reproduction preserve the known failures. The narrow script can be rerun with a new output directory:

```sh
node design-audit/reproduce-conflict.mjs /absolute/new-output-directory
```

Additional validation checks and evidence can be saved in a run's `validation-results.json`. Finalization combines this additive layer with the original baseline; it does not rewrite the original capture. `evidence-review.json` records rejected/limited screenshots so unstable captures are not shown as accepted visual evidence.
