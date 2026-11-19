# Release safety for concurrent Morzsa work

Production uses .github/workflows/pages.yml. Ordinary pushes and pull requests
run a web build and one isolated browser sanity pass (navigation, overflow,
script errors and local-save persistence). Main requires Build and sanity.
The exact successful artifact deploys to Pages and can be published to CloudFront.
Its version.json records verification: build-sanity, sanity: passed, audit: not-run.

Full regression runs only when explicitly requested: GitHub Actions > Full
regression > Run workflow, or GH_HOST=github.com gh workflow run regression.yml
--ref main. It retains the unit/SQL/Python, accessibility, native-adapter,
recipe, shopping and performance suites. Mobile builds also run only through
Actions > Mobile builds > Run workflow. Do not repeat the full suite locally,
on PR and on main for routine edits.

The audit fix release was merged in PR #1. It includes the reviewed
cooking/onboarding baseline and seven confirmed audit fixes. The follow-up
codex/completed-web-proactive branch adds the completed proactive feature, its
tests, and the finished performance audit reports and harness. Changes are
applied to the current origin/main with a three-way patch; the original
checkout and the separate native worktree remain intact.

The in-progress codex/ios-native-performance work is not part of this release.
That branch must merge the current origin/main before its later release and
retain the completed web changes and audit regressions.

No Supabase deployment is required for the seven audit fixes. The proactive
feature uses its per-device fallback until 20261116_proactive_suggestions.sql
is deployed. Committing that migration does not apply it to production.
The performance audit is diagnostic evidence from its recorded snapshot;
including its reports does not mean the reported issues have been fixed.

For the parallel feature sessions:

1. Save your work on a branch; do not discard the shared uncommitted checkout.
2. Fetch the current origin/main and merge it into that branch.
3. Resolve shared-file conflicts, retaining both feature work and the audit fixes.
4. Run a targeted sanity check and open a pull request.
5. Merge after the required check passes; Pages publishes the build-and-sanity artifact.

A stale direct push is rejected. Do not bypass this with a force push, disable
the required check, or restore whole files from an older snapshot. Tests protect
behavior, not an immutable file hash: refactors can keep the confirmed audit
scenarios passing.
