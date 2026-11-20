# Unified Morzsa workspace design QA

Reference: design/unified-workspace-2026-11-19/reference-board.png and the
accompanying requirements.png. The six composed reference surfaces are adapted
to real 1200x1060 desktop and 390/320 mobile layouts, rather than treated as six
literal browser viewports inside the supplied board.

## Comparison and fixes

Opened comparison-final.png with the source and the six current implementation
captures in the same image. Initial P2 issues were inherited overview grid
placement, overlarge shopping rows/check targets, duplicate cooking resume
blocks, the small-screen shopping heading overflow, and a legacy floating Add
button assumed by the build verifier. These were corrected with scoped styles,
shared layout helpers, and the verifier's equivalent visible Add entry point.

The final visual roles match: common cream/sage/terracotta shell, compact cards,
consistent type hierarchy, clear action buttons, a central chat with executable
recipe/list/week actions, useful overview tasks, categorized shopping with
estimated prices and shopping mode, restrained pantry art/status, full recipe
and focused cooking with ingredient access and notes. The mascot appears in the
overview hero rather than every sidebar, following the written requirements.
The brand uses the existing transparent mark instead of a screenshot background.

Intentional adaptations: pantry remains approximate availability rather than
copying fictional quantity counters; overview actions replace the illustrated
analytics tiles; real recipe steps retain their canonical flat grouping. Source
food crops are opt-in local QA imagery only; production uses RecipeImages cache.

## Functional evidence

Explicit local Chrome sanity passed for: missing ingredients to the list without
duplicating unrelated records; selected recipe in the weekly planner; recipe
variants; portions/checklist/timer preservation; cooking note save; contextual
Morzsa access; confirmed cart receipt and guarded Undo with measured placement;
Add review; shopping mode; pantry filter scope; existing draft preservation;
and no horizontal overflow at 320/390/1200. Mobile recipe tips open the ingredient
sheet. Final six-view and mobile captures have no browser page errors.

Web build and the quick bundled-app sanity passed. Full regression and Xcode/
Gradle builds were not run. Native web assets are synchronized separately.
No SQL migration, user-data reset or new shared record format was introduced.
Existing local saves, shared update guards, image cache and server-confirmed
receipts remain the underlying contracts. Cooking notes use the existing feedback
notes field; preparation checks retain their existing device-scoped store.

P3 follow-up: small icon/raster/antialiasing differences and source-specific
instruction grouping remain. Recipe and stock content is data-driven.

final result: passed
