# UX review implementation — 2026-11-12

Source: user-provided Morzsa_UX_Product_Design_Review.pdf. The PDF is a hierarchy and interaction brief, not a pixel specification.

- Five destinations, existing artwork and cream/sage/forest/terracotta tokens retained.
- Global quick-add buttons consolidated. Pantry and shopping use their own primary add control; the other destination is reachable from their options menu. Other sections retain one quick-add button with a destination selector. A compact contextual Morzsa launcher replaces an extra composer on supporting screens.
- Pantry cards show an explicit availability selector. Existing numeric stock saves are retained: positive values above one = at home, one = low, zero = used up; absent keys stay unmarked. Details/list operations are available by tapping an ingredient. Review confirmation timestamps and shared save/undo paths are reused.
- Shopping rows expose checking and a quiet quantity/edit entry point. Quantity adjustment and deletion live in the edit sheet. Per-field optimistic cart intents and category completion are retained.
- Recipe recommendations have a distinct label and ingredient availability. Mutation proposals explicitly say they are not saved. Successful saves show the affected items/actions in a compact receipt. No unsupported assistant action is invented.
- Overview presents pantry/list status first, then an actual pantry-ranked recipe. Review and shopping history are secondary. No fabricated activity or stock safety assumptions.
- Offline indication explains shared/AI availability. Shared actor attribution remains a later P2 enhancement: existing records contain no actor identity, so it requires an additive backend contract and privacy decision.

## Reliability fixes shipped with the review

- Image cache lookups and signed-URL requests retry once on transient network/429/502/503/504 errors; generation and uploads are never automatically repeated.
- Image cooldown, provider rate limits, app daily quota, auth, timeout, setup and image-load failures are differentiated. Server diagnostics contain only stage/code/status, never recipe data, credentials or signed URLs.
- A deployment-backed synthetic recipe image test returned HTTP 200, and its private signed image downloaded successfully in about 3.6 seconds. The earlier production failure was transient; old logs did not retain its exact stage.
- Browser answer presentation buffers bursty text and continues from the visible prefix at response completion. Saved history stays complete; old messages are never reanimated. Reduced-motion settings are respected.

## Validation

167 JavaScript tests, six SQL suites and eight Python server tests passed. Regression coverage includes old numeric saves, unrelated state preservation, cached image retries, full image handler flow, cooldown, broken-link recovery, burst delivery, buffered replies, emoji boundaries and reduced motion.

Browser QA used an isolated fixture, with no production household writes. At 390 px, changing availability, adding a pantry item to the shopping list, editing its quantity and completing a category all worked. The overview reflected the actual fixture state. AI proposals stayed unsaved until confirmation, then showed the exact affected items. A burst response visibly progressed from a short prefix to the final formatted answer, and its recipe image loaded. At 320 px the pantry used two columns with no horizontal overflow; at 1366 px it used five columns and the persistent history sidebar, also with no horizontal overflow. Screenshots in `qa/` contain synthetic test data.

Web and native asset builds succeeded, and Capacitor synchronized the result into both iOS and Android projects. This verifies the shared UI bundles; no new native binary or store release was made for this refinement. The recipe-image function was deployed with the final retry handling.
