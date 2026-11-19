# Cooking and full recipe workspace QA — 2026-11-19

Source: design/cooking-page-2026-11-19/reference-wide.png (1522 x 1019),
reference-compact.png (two illustrative cooking/reading layouts), and the
user's accompanying description of shared state and the mobile bottom sheet.

## Visual comparison

Opened the combined source/implementation comparison-wide-01.png. Initial
P2 issues: the previous cooking shell hid the sidebar and retained its fixed
bottom dock; profile copy order was wrong, the checklist lacked visible check
marks, and cover/step positions differed. Fixed these in the new scoped CSS
and markup. The final combined comparison-wide-final.png was inspected after
recapture at the same 1522 x 1019 viewport and the cooking step shown by the source.

The warm cream/sage/terracotta palette, narrow sidebar, photo-led recipe
profile, segmented cooking/full recipe controls, stage progress, central cooking
photo/instruction, next/previous actions, ingredient/tips/timer panels and
compact header are present. The 1100-pixel full view shows all ingredient amounts
and canonical method steps. Mobile captures at 390 pixels show readable controls
and a bottom ingredient sheet; 320 pixels has no horizontal overflow.

## Content and behavior

The supplied wide and compact illustrations use different grouping of method
instructions. The implementation follows the selected canonical cooking step,
as in the compact reference, and shows all canonical steps in Full recipe.
It does not invent substeps, a breakfast category, equipment or tips for real recipes.
The reference dishes and source photo crops are local fixture data only.

Targeted sanity passed: mode switch, current step and checklist preservation,
serving conversion, persistent live timer through mode switch and reload,
checklist and portions through reload, mobile sheet editing/closing, and layouts
at 320/390/1100/1522. No page errors or horizontal overflow. Web build and the
quick isolated bundled-app sanity passed. Full regression was not run, as requested.

No SQL, RPC or shared record format was changed. Existing session steps, timer
IDs/deadlines and portions remain canonical. Prepared-ingredient checks are
local device state scoped by user, household and recipe/session; they do not
change pantry availability. The original guarded pantry/shopping actions remain
accessible through the sheet's collapsed Pantry and shopping list section.

P3 follow-ups: small icon/antialiasing differences, raster source lighting and
source-specific instruction grouping remain. Source illustrations are reused;
real recipe images use the existing persistent backend and device cache.

final result: passed
