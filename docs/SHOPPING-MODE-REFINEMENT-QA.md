# Shopping Mode refinement — 14 November 2026

The existing mode and household data contracts are retained. Purchased rows stay hidden by default. The update adds immediate undo for purchases/quick-add, highlighted and shorter category pills, completed categories at the end of the route, a sticky progress/search/navigation area, and a name/quantity editor with category, notes, purchase correction and removal. The complete finishing label remains reachable in the bottom dock. Screen wake lock is optional on supporting browsers.

Shared-list undo records only the affected fields. A later partner quantity survives undoing a purchase. An edited/newly changed row is not deleted by an old quick-add undo. Conditional intents survive the existing offline outbox and revision-check/retry path; rejected conditions explain that the latest shared value was retained. Shopping check and entry controls can enqueue rapid changes while the previous cart save is pending.

## Verification

- Full suite: 198 JavaScript tests and all eight SQL suites passed. Twelve focused shopping/sync tests passed after the final intent changes.
- Actual frontend in the isolated fixture: purchase disappearance, immediate undo, quick-add/Enter/undo, quantity/category/note edit, completed-category reopening, delete/undo, partial completion and restart/resume passed.
- At 320 × 568 and 390 × 844: no horizontal overflow; final products can scroll above the dock. Controls retain 44 px minimum purchase/edit/undo targets.
- Browser console: no errors. Wake-lock option visibility was verified; physical-device screen sleep was not tested.
- The local web bundle hit an operating-system ETIMEDOUT while copying an existing plus.svg asset. The release CI builds a fresh checkout and is the final bundle gate.

Screenshots and side-by-side reference comparison are under design/product-evolution-2026-11-13/qa/10–12. The fixture uses canned AI and simulated/local data: it does not establish live AI accuracy, two-phone realtime latency or supermarket network behavior. Independent agent-user sessions follow in a separate simulation report.
