# Recipe page: supplied mockup, 2026-11-19

The selected visual target is reference.png. The source-aligned page is
implemented in recipe-discovery-page.js/css, consuming the existing recipe,
favourite, cooking-session and household models. Final visual QA is recorded
in the root design-qa.md; the earlier QA is preserved here.

The isolated reference preview intentionally shows the source's sample dishes
and photos. These records are never imported into the production backend.
Production uses the household's own recipes and existing persistent image cache.

From the repository root, start the local SQL reference fixture:

    MORZSA_QA_PORT=8083 MORZSA_QA_COLLABORATION=1 MORZSA_QA_RECIPE_REFERENCE=1 node tests/persistence-fixture.mjs

Then open http://127.0.0.1:8083/?actor=a . To replay the checked primary paths:

    node design/recipe-page-2026-11-19/verify-interactions.mjs

The checker refuses non-local origins. Screenshot comparisons use a 1531 × 1023
CSS viewport and device scale factor 1. Smaller widths preserve the same hierarchy
with stacked hero/promo content and a two-column recipe grid.

Overview remains available through the desktop brand link and in the mobile
navigation. The existing personal/shared save contracts and serving preferences
remain the source of truth. Weekly planning opens the existing settings form in
a dialog. Multiple cooking sessions remain selectable through a disclosure.
