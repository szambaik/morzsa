# Compatibility

Prefer backward-compatible changes. Preserve existing local saves (including
the morzsa-v1 fallback), shared record formats, and existing RPC contracts.
Use additive features and migrations where possible so previously deployed
clients can continue to use the same household. Do not reset user data or
silently import a local pantry when joining a shared household.

For data changes, verify old-save loading, preservation of unrelated data,
repeat actions, and concurrent shared updates. If a breaking change is truly
necessary, explain the migration and recovery path before introducing it.

# Product direction

Use PRODUCT-DESIGN-PRINCIPLES.md as the product decision guide. Prefer convenience
and approximate availability over exact inventory bookkeeping. Keep frequent
pantry/list actions quick, explain AI changes, and preserve shared-state safety.
The visual source and adoption notes are in design/README.md.

# Audit fixes and release safety

The seven confirmed UX audit fixes are recorded in
docs/UX-FIRST-AUDIT-FIX-LOG-2026-11-16.md. Preserve their behaviors when editing
shared files: server-confirmed cart receipts and guarded Undo; explicit pantry
search scope; keyboard focus and return position; retryable empty AI responses;
measured shopping receipt placement; accessible secondary-text contrast.

Before publishing, merge the latest origin/main into the work branch and run
`node design-audit/check-release.mjs` with the audit dependencies installed.
Never copy an older complete version of a shared file over newer fixes or
force-push a stale checkout. Resolve changes as a merge and keep the regression
cases. Use a separate Git worktree when another session is editing this repo.

Production Pages deploys only the artifact from the successful Audit regression
gate. Keep that required check and the workflow deployment gate. Build success
alone is not deployment approval. Preserve the production-data boundaries used
by the synthetic audit fixture.
