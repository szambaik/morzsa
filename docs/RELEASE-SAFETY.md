# Release safety for concurrent Morzsa work

Production is released through .github/workflows/pages.yml. The workflow runs
unit/SQL/Python tests, a full isolated browser audit, 32 accessibility scans and
54 targeted audit regressions before uploading the built web artifact. Deployment
requires that gate. Main is protected against force pushes and requires the
Audit regression gate check on an up-to-date branch.

The audit fix release is prepared in the codex/audit-fixes-release worktree.
It includes the reviewed cooking/onboarding baseline and seven confirmed audit
fixes. The unfinished proactive feature was removed only from this isolated
release candidate; the original checkout and its in-progress work remain intact.
No Supabase deployment is required for the seven audit fixes.

For the parallel feature sessions:

1. Save your work on a branch; do not discard the shared uncommitted checkout.
2. Fetch the current origin/main and merge it into that branch.
3. Resolve shared-file conflicts, retaining both feature work and the audit fixes.
4. Run the release regression gate and open a pull request.
5. Merge after the required check passes; Pages publishes the tested artifact.

A stale direct push is rejected. Do not bypass this with a force push, disable
the required check, or restore whole files from an older snapshot. Tests protect
behavior, not an immutable file hash: refactors can keep the confirmed audit
scenarios passing.
