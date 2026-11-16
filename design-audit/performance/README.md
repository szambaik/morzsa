# Morzsa performance and reliability audit

This package is separate from application source. All browser data and backend records are synthetic. The loopback fixture runs actual local SQL migrations in PGlite; no production database, auth policy, provider account or .env is used. External HTTPS and WebSocket traffic is blocked and Chromium uses an isolated profile. The image lifecycle probes deliberately inject local responses.

The reviewed audit concerns the frozen working-tree snapshot captured at 2026-11-16 18:26:53 UTC / 19:26:53 Budapest, including uncommitted work. HEAD cf2b788 alone is insufficient to reproduce it. See snapshot.json and source-verification.json. The snapshot is preserved in a detached Git worktree; no application fixes, commit, push or deployment were performed.

## Read the result

latest-report.json points to the complete reviewed report directory. The numbered Markdown files at this level are append-only indexes. Actual reports, findings.json and validation.json live in reports/<timestamp>/. Raw evidence is never overwritten.

- runs/<timestamp>-full: 60 startup measurements, primary journeys, 125 navigation cycles, large-data stress.
- runs/<timestamp>-supplement: six responsive viewports, CPU profiles, ordered image queue and DOM-retention probes.
- runs/<timestamp>-faults: long AI message, confirmed shared action, interrupted stream and actual 60-second timeout.
- runs/<timestamp>-soak: approximately six-minute shared session with polling, Realtime protocol, four AI turns and repeated dialogs.
- database-runs/: real EXPLAIN ANALYZE and index data from synthetic PostgreSQL/WASM.
- provider-runs/: actual Edge Function modules with injected fetch, including an 8-second header stall and cancellation.
- documented-startup/: actual Python Handler startup, with external API traffic blocked.

The first soak run failed because its fixture setup raced with shared-state refresh. It is retained; the successful repeat uses direct pre-browser SQL seeding. The first image-queue probe did not enforce request order and was inconclusive; the ordered repeat confirmed blocking. The 2000-item click timeout and the image lifecycle threshold failures are real recorded findings, not hidden test failures.

## Run again

From this frozen worktree root:

~~~sh
npm --prefix design-audit/performance ci
npm --prefix design-audit/performance exec -- playwright install chromium
npm --prefix design-audit/performance run audit:performance:smoke
npm --prefix design-audit/performance run audit:performance:journeys
npm --prefix design-audit/performance run audit:performance
npm --prefix design-audit/performance run audit:performance:report
python3 design-audit/performance/validate.py
~~~

Browser installation is optional when the pinned Chromium is already present. The runner falls back to an installed Chrome in a fresh headless profile. It never attaches to a personal session. During this audit, existing root/audit dependencies were referenced read-only; the performance package has its own lockfile for future isolated installation.

The full command runs browser, responsive/profile, fault, soak, SQL and provider stages sequentially, then writes a measurement report. Allow roughly 10–15 minutes. Each child stage writes a fresh timestamp. The coordinator retains stage logs even when another stage fails. Application threshold failures are recorded in checks; a zero process exit does not imply a clean application audit.

Individual commands:

~~~sh
node design-audit/performance/runner.mjs full
node design-audit/performance/runner.mjs supplement
node design-audit/performance/runner.mjs faults
npm --prefix design-audit/performance run audit:performance:soak
npm --prefix design-audit/performance run audit:performance:database
npm --prefix design-audit/performance run audit:performance:providers
~~~

The reviewed findings are deliberately tied to review-baseline.json. A new run does not inherit their confirmed status. The report command produces an unreviewed measurement summary when inputs change; inspect traces and code before updating the reviewed baseline. Regenerating the original reviewed report uses the exact original evidence. This prevents stale findings being presented as confirmed after another agent fixes the app.

For another source snapshot, use a separate Git worktree and copy this performance package into that checkout. Browser runs also accept MORZSA_PERF_SOURCE as an absolute source root, but SQL/provider scripts expect this package to sit under that source's design-audit/performance directory. New browser runs record source-before/source-after hashes and flag drift. Never benchmark a moving checkout as one consistent revision.

Existing verification used in this audit:

~~~sh
npm test
python3 -m unittest discover -s tests -v
npm run build:web
~~~

These checks were run only inside the snapshot. The native iOS/Android trees were excluded from the initial snapshot because no native build was part of this diagnostic run.

Open a trace with the installed Playwright Trace Viewer; import .cpuprofile files into Chrome DevTools. PNGs and DOM snapshots have the same numbered stem. The raw results include HTTP method/path/status/timing/sizes, browser long tasks and Event Timing, SQL plans, memory samples and explicit failure details. These are lab results, not production SLO or real-user INP claims.

Evidence validation checks PNG checksums, trace archives, CPU profiles, JSON schema fields and evidence links. It also rechecks the frozen source hashes and confirms that recorded browser responses came from loopback origins. This integrity check does not turn failed application performance checks into passes.
