# Current orchestrator assignments

This is a coordination note from the parent agent for this requested audit. Application files remain read-only.

Canonical run: `design-audit/runs/2026-11-16T17-35-10-569Z-99f951`. It is currently capturing the final evidence; wait for `baseline.json` before finalizing. Read the shared `context.json`, `project-discovery.md`, `screen-inventory.json` in the audit root, current run `evidence/results.json`, and `ENGINE-CONTRACT.md`. Do not read other reviewers' drafts or reports.

Each newly spawned specialist should independently review current screenshots (open actual images with view_image), pertinent DOM/axe/network/test evidence, and relevant product source. Assign the role matching your task name. Write a strict schema-valid review to `design-audit/review-drafts/<role>.json` where role is ux, visual, qa, accessibility, or product. Use method `codex-subagent`, status completed. Do not impose a finding quota. Preserve nuanced hypotheses vs observed defects. Product opportunities are not bugs. Screenshot filenames and evidence paths must refer to canonical run files actually opened.

- UX: Nielsen heuristics, onboarding, inventory search mental model, cognitive load, clarity of sharing/next actions/recovery.
- Visual: UI hierarchy, density, palette/mascot preservation, all six widths; don't flag fallback font appearance as a production typography defect. Refresh the earlier visual draft against canonical evidence.
- QA: independently assess real journey checks, documented startup, persistence, quantity/unit handling, failed-save receipts and true failures vs harness artifacts.
- Accessibility: independently assess axe raw nodes and actual keyboard events, focus visibility/return, contrast, dialog labels and target sizes. Browser chrome at end of native modal Tab cycle is not a demonstrated background-focus escape.
- Product: convenience over precision, feature overlap, household understanding, AI transparency; suggestions must remain source/evidence grounded.

Parent captured additional repeatable evidence in the canonical run via supplemental.mjs: inventory search while the home filter remains selected, focus after keyboard status save, injected localStorage quota rejection, and guest AI sign-in. Findings may refer to these current observations.

Use all fields in `schemas/finding.schema.json`. Add `duplicateKey` only when the underlying issue is clear (for example `shopping-save-toast-overlap`, `cooking-small-text-contrast`, `pantry-search-scope`, `pantry-status-focus`, `documented-python-missing-scripts`). No forced agreement: severity and recommendations are your independent judgment. Evidence links stay run-relative. Cite source file line numbers only after checking them.

The standalone CLI provider smoke returned HTTP 401. This limits future unattended model stages with current CLI auth, not your actual in-session review. Do not try to read or change credentials. The parent will import actual reviews and cross-validate findings.

## Capture is complete

Canonical baseline.json is now complete: 135 passed, 4 failed assertions. A/B/D/E/F/G executed, shopping completed with a receipt overlay failure. There are 91 saved PNGs. To avoid the model's 50-image request limit, review contact sheets under canonical `evidence/contact-sheets/` (8 JPEG sheets), then open only necessary full-size screenshots. A prior visual agent reached the image limit after a valid 25-image preliminary review; a fresh final visual reviewer should complete the canonical evidence review. Do not call that failed turn a completed full visual review.

## Current final review request

The baseline and contact sheets are complete. Fresh `visual_final` role should write `review-drafts/visual.json`; fresh `product_specialist` role should write `review-drafts/product.json`. Do not read other reviewer drafts. Parent independently reproduced the shared-list receipt issue in `reproduction-shared-receipt/` under the canonical run: actual SQL keeps 3 l, the settled UI says Mentve: 2 l, and the save receipt covers Start shopping. Your conclusions should still come from your own evidence inspection. Once your draft is saved and schema checked, finish the turn to free a review slot.
