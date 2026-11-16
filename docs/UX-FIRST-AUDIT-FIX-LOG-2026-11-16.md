# Morzsa — First UX/UI audit fix log

Date: 16 November 2026. Scope: all **seven confirmed findings** from audit run `2026-11-16T17-35-10-569Z-99f951`, originally captured at Git revision `cf2b7887ffa1777e7dbb7699103c6ec90cb07d5b`.

These changes are local. Existing uncommitted work was preserved. This log is separate from [the previous customer-audit log](CUSTOMER-AUDIT-FIXES-2026-11-16.md), which covers eleven different tickets. This task did not commit, push, deploy, change live household data, send invitations or make paid AI calls.

## Fix register

| Audit ID | Priority | Fix | Verification |
|---|---|---|---|
| QA-STARTUP-001 | P1 | Derive permitted startup scripts/styles from the entry point | Actual Python handler, private-file tests, browser startup |
| UX-004 | P1 | Reconcile shared receipts and Undo with outbox acknowledgment | Two-account SQL/browser conflict and recovery tests |
| PRODUCT-003 | P2 | Treat truly empty AI output as a retryable service failure | Canned HTTP/browser output and Retry tests |
| UX-001 | P2 | Make catalog-wide search explicit; restore the filter on clear | All four scopes in Hungarian and English |
| UX-002 | P2 | Position receipts above the measured active dock | Geometry and hit tests at 320, 360, 390 and 1280 px |
| UX-003 | P2 | Preserve focus after pantry save and on close | Real Enter/Space/Escape, failure and timing tests |
| VISUAL-002 | P2 | Increase small-label contrast on tinted surfaces | Repeated axe scans and representative screenshot review |

## QA-STARTUP-001 — Local startup refuses required scripts

**Root cause.** The handwritten allowlist in `server.py` omitted twelve newer modules. The entry page loaded but required scripts returned 404. The audit fixture served those files, so fixture-only testing missed the startup problem.

**Change.** `EntryAssets` parses `index.html` to allow its root-level JS/CSS assets, including versioned URLs. The manifest and curated images remain public. Arbitrary repository files, traversal paths and public-looking symlinks remain denied. The AI bridge and RPC contracts are unchanged.

**Files:** `server.py`, `tests/test_server.py`.

**Verification.** Every entry script loads through the actual Python HTTP handler. Nine Python tests cover startup, private paths, symlinks, empty upstream output, cross-origin rejection, missing configuration and key-safe status. The full audit independently starts the real handler with external traffic blocked. See [Python results](../design/audit-fixes-2026-11-16/python.log).

## UX-004 — A rejected shared edit falsely claims Saved

**Root cause.** `editCart()` returned true when the intent was durably queued on the device. The editor treated enqueue acceptance as server acknowledgment. Later conflict recovery preserved the partner's 3 l but left a receipt claiming that the rejected 2 l was saved.

**Change.** Preserve the boolean enqueue API and stored intent format. Add an optional in-memory `onStatus` observer per intent, held in a WeakMap rather than storage or RPC payloads. Rebase reports which intent was rejected. The shopping receipt follows the current action and household:

- Queued/pending: Mentésre vár; no confirmed Undo.
- Failed: explain that the edit is retained on the device and offer Retry of the existing queue.
- Saved: show the authoritative amount after acknowledgment and row refresh.
- Conflict: identify the item, show the retained amount or removal, offer Megnézem and remove Undo for the rejected edit.
- Undo: retain field-level guards, preserve unrelated partner edits and confirm only after its own acknowledgment.

Newer actions own newer receipts. Navigation retires visible feedback without discarding the queue. Account/household validity is checked across asynchronous flushes. A device-cache failure after acknowledgment cannot strand the receipt or turn a committed shared write into an unconfirmed one.

**Files:** `household-model.js`, `household.js`, `shopping-mode-ui.js`.

**Verification.** [Independent conflict evidence](../design/audit-fixes-2026-11-16/shared-conflict/results.json) uses two identities and real isolated SQL: B saves 3 l; A's stale 2 l is rejected; SQL and UI retain 3 l; the receipt says `Tej közben módosult. Megtartva: 3 l`. [Targeted probes](../design/audit-fixes-2026-11-16/targeted/results.json) cover pending/success, injected HTTP failure and Retry, Undo after a partner note edit, multiple queued actions, navigation and post-acknowledgment cache failure. Existing shared-state SQL suites also pass.

## PRODUCT-003 — Empty AI output appears to be user ambiguity

**Root cause.** A structurally valid but empty output fell through to Pontosítanád egy kicsit, blaming ambiguity and exposing no retry.

**Change.** Normalize text, resolve operations and validate recipes before rendering. If answer, clarification, valid recipes and resolved operations are all empty, raise `VOICE_EMPTY_RESPONSE` through the existing error/retry path. Explain that no answer was returned, the original question is retained and no change was saved. Genuine clarification, recipe-only and operation-only responses remain supported. Whitespace is neither content nor a clarification request.

**Files:** `companion-ui.js`, `voice-ui.js`.

**Verification.** [Empty-output reproduction](../design/audit-fixes-2026-11-16/empty-answer/results.json) and targeted browser tests cover empty/whitespace outputs, Retry with the exact prompt, no duplicate user message, unchanged pantry/list, genuine clarification, recipe-only output and unsaved operation-only proposals. These are synthetic HTTP responses, not live-model quality measurements.

## UX-001 — Pantry search contradicts its selected scope

**Root cause.** Typing broadened results to the catalog while Van otthon remained selected. Unknown catalog options appeared under a household-stock filter.

**Change.** During search, visibly and accessibly select Mind / All and display a status caption explaining the broader search. Keep any category restriction visible. Do not mutate the remembered availability filter; clearing the search restores that filter, its result count and its results. Unknown ingredients remain unmarked and easy to add.

**Files:** `pantry-library.js`, `workspace.css`.

**Verification.** Browser tests cover home/low/out/all in HU and EN, typing/clearing, matching counts and no stock writes. The supplemental harness previously failed every unknown search result; its assertion now checks scope consistency, because the supplied acceptance criteria explicitly allow a visible switch to All. The actual search/add workflow remains tested; previous evidence was not edited.

## UX-002 — Save receipt covers Boltban vagyok

**Root cause.** Fixed CSS offsets did not reflect different dock heights in planning and shopping modes or changes caused by viewport width and quick-add.

**Change.** Measure the active `#workspace-assistant` or `.shopping-mode-dock`. Position the receipt above it with an 8 px gap, within viewport bounds and centered on the content. Update on dock resize, viewport/visual viewport changes and workspace mounting. Disconnect observers when dismissed. Remove conflicting fixed-offset overrides and retain the ten-second settled receipt/Undo window.

**Files:** `shopping-mode-ui.js`, `workspace-ui.js`, `workspace.css`.

**Verification.** Browser geometry and actual center hit tests pass at 320, 360, 390 and 1280 px in planning and shopping modes, including an expanded quick-add dock. The conflict reproduction also tests starting shopping while feedback is visible. See [expanded-dock screenshot](../design/audit-fixes-2026-11-16/targeted/receipt-expanded-dock.png).

## UX-003 — Pantry save loses keyboard focus

**Root cause.** Saving replaced dialog controls and pantry cards. The focused status button disappeared and the original opener reference became detached.

**Change.** After save or failure, focus the replacement availability control. On close, resolve the current ingredient card by name; if filtering removed it, focus search. Preserve the original page position when the card survives. Check household and dialog invocation before asynchronous updates. Avoid focusing inactive windows, closing a newer dialog or stealing focus after the user has already moved to another control.

**Files:** `pantry-library.js`; updated DOM fixtures in `tests/pantry-details.test.cjs` and `tests/pantry-start.test.cjs`.

**Verification.** Actual Enter/Space/Escape tests cover all availability states, opener restoration, filtered-out opener fallback and injected quota failure. An interim full run exposed a delayed close event stealing focus from search; this was corrected and a regression added. The supplemental test now waits for the actual close/focus event. See [failure-path focus screenshot](../design/audit-fixes-2026-11-16/targeted/pantry-focus-failed-save.png).

## VISUAL-002 — Small secondary labels fail contrast

**Root cause.** The muted token and some isolated text colors fell slightly below 4.5:1 on their tinted backgrounds.

**Change.** Darken the secondary token from `#687063` to `#5e695a`. Use the darker orange ink for cooking titles and the muted token for maintenance/nudge text and timer labels. Preserve the cream, sage, forest and terracotta surface palette and imagery.

**File:** `workspace.css`.

**Verification.** Repeated axe WCAG A/AA scans report no violations on the captured screens. The audit includes dashboard counts, history labels, cooking headings, nudges, purchased summaries, timer labels and kitchen choices. Representative narrow dashboard, pantry dialog, conflict, expanded-dock and desktop screenshots were reviewed. Incomplete axe findings remain manual follow-ups; this is not a full accessibility certification.

## Repeatable verification

**Final status: all seven confirmed findings implemented and locally verified.**

| Verification | Result | Evidence |
|---|---|---|
| Full deterministic audit on fixed snapshot | 143 passed; zero failed, blocked or errored | [Audit results](../design/audit-fixes-2026-11-16/evidence-snapshots.tar.gz) |
| Additional targeted regressions | 54 passed | [Assertions and requests](../design/audit-fixes-2026-11-16/targeted/results.json) |
| Automated accessibility | 32 axe scans; zero violations | [Full report and screenshot index](../design/audit-fixes-2026-11-16/evidence-snapshots.tar.gz) |
| Application tests | 279 unit tests and 9 SQL suites passed | [Test log](../design/audit-fixes-2026-11-16/app-tests.log) |
| Python handler | 9 tests passed | [Python log](../design/audit-fixes-2026-11-16/python.log) |
| Audit infrastructure | 26 tests passed | [Harness log](../design/audit-fixes-2026-11-16/harness-tests.log) |
| Web build | Passed; 64 runtime files | [Build log](../design/audit-fixes-2026-11-16/web-build.log) |
| Native frontend sync | Passed; iOS and Android web assets updated | [Sync log](../design/audit-fixes-2026-11-16/native-build-final.log) |
| Syntax, diff and bundle integrity | JS syntax and git diff checks passed; all nine fix files match the audited snapshot, and bundled JS/CSS match source | [Verification summary](../design/audit-fixes-2026-11-16/verification-summary.json) |

The [same-profile comparison](../design/audit-fixes-2026-11-16/comparison.json) reports no check regressions. Finding absence in this deterministic rerun is not a new specialist review: the fix decisions are supported by the specific reproductions, root-cause changes and tests recorded above.

The new targeted runner reuses the existing isolated fixture and installed Chrome; no framework or dependency was added. Use a new output directory to preserve previous results:

```sh
node design-audit/verify-fixes.mjs /absolute/new-evidence-directory
npm --prefix design-audit run audit:ux -- --profile full
npm test
python3 -m unittest discover -s tests -p 'test*.py'
npm --prefix design-audit test
npm run build:web
npm run sync:frontend
```

The changed runtime/style URL versions in `index.html` were bumped to `first-audit-20261116`; concurrent proactive-feature integration subsequently advanced some shared module URLs to `proactive1`. Web output and native frontend assets were rebuilt; this does not deploy production or compile a native binary.

### Evidence integrity and interim runs

Other work was occurring in this checkout during verification. A frozen copy was therefore made at `tmp/first-audit-snapshot` for a consistent final full capture; [its source manifest](../design/audit-fixes-2026-11-16/snapshot-manifest.json) records the exact content. This copy contains application source/assets and synthetic fixture inputs, not the user's local saves or API secrets.

After capture, `proactive-ui.js` changed in the parallel work. That subsequent version is outside the passing snapshot's coverage. All nine files implementing this audit fix set still matched the frozen snapshot at final verification, and their rebuilt web/native copies matched the live source. The parallel feature changes were preserved.

Preserved interim full runs:

- `2026-11-16T18-11-45-339Z-30f8f7`: 142 passed; integrity failure when an unrelated `proactive-model.js` appeared during capture.
- `2026-11-16T18-15-51-915Z-990d08`: 140 passed; keyboard journey blocked by the delayed-close focus issue, subsequently fixed.
- `2026-11-16T18-17-47-657Z-1b4d5e`: all 142 product checks passed; integrity guard detected concurrent changes to several source files.

None of these is presented as a fully passing stable final run. Earlier targeted attempts are also preserved in `tmp/`; two incomplete journeys came from probe selectors for normal/in-store checkmarks and a collapsed purchased subgroup. Those selectors were corrected before the passing targeted run.

### Limits

All test identities and household data are synthetic. SQL behavior is exercised locally with polling; external WebSockets, OAuth/email, fonts and paid AI are blocked. AI replies are explicit HTTP fixtures. Live provider quality, production latency, real speech, physical iOS/Android devices and screen-reader output were not tested. Screenshots use fallback fonts. No new independent specialist-agent review or complete WCAG-compliance claim is made.


## Deployment preparation — 16 November 2026

The user subsequently authorized deployment and asked to preserve these fixes
against concurrent changes. A separate codex/audit-fixes-release checkout was
created from origin/main; the reviewed baseline and fixes were imported there.
The unfinished proactive feature and its hooks were omitted only from that
candidate. The original checkout was not reset or overwritten.

Release candidate validation passed again: 143 full-audit checks, 32 axe scans
with no violations, 54 targeted regressions, 279 unit tests, nine SQL suites,
nine Python tests and the web build. Candidate evidence is retained in audit run
2026-11-16T18-31-03-848Z-5a8d0e. Production now has a dedicated Pages workflow
whose deployment depends on the Audit regression gate. Main branch protection
requires that check and rejects force pushes. See RELEASE-SAFETY.md for the
merge instructions that parallel work must follow. No Supabase deployment is
needed for these seven fixes. The GitHub workflow and version.json expose the
actual published commit; a successful local build alone is not a deployment.

Complete frozen and release-candidate browser evidence is preserved in [the compressed evidence archive](../design/audit-fixes-2026-11-16/evidence-snapshots.tar.gz). Extract it under design-audit/runs to browse individual JSON reports and screenshots. CI uploads each new run as an artifact instead of committing generated run directories.
