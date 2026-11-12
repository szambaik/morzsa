# Kitchen Companion QA — 2026-11-12

## Findings and fixes

- P1, local preview: new runtime files initially returned 404 because the local
  server uses an explicit allowlist. Added the three workspace entry files to
  that list; the existing HTTP test now verifies that every entry script loads.
- P2, pantry check-in: inherited 20px grid columns overlapped the enlarged
  ingredient illustrations. Changed the first column to 32px and the gap to
  8px; the check and remove actions keep 44px targets.
- P2, empty chat: the existing conversation heading and Today divider pushed
  the welcome and check-in down. Hide them only on a welcome state. Dated
  message groups remain available once a conversation has content.
- P2, sidebar localization: moving navigation below a non-translated history
  container would bypass the legacy localization observer. Navigation labels
  are now explicitly selected from the current language on mount.

## Visual comparison

Evidence: [source and production together](qa/comparison-mobile.png),
[production phone](qa/mobile.png), [desktop](qa/desktop.png),
[quick add on a narrow phone](qa/quick-add-320.png).

The comparison uses two 390 × 676 CSS-pixel iframe viewports, captured at the
same pixel scale. Cropped output is 800 × 676, including a 20px gap. Additional
phone inspection used 320 × 676 and the existing 390 × 844 fixture. The latter
extends beyond the desktop screenshot viewport, so the compact comparison is
the basis for visual judgment. The source has three fictional review items;
production uses the real existing review priority model and may show more.

- Typography: retained Sora headings/brand and Inter body text from both the
  app and selected source. Welcome headings are 28px on phone and 35px on
  desktop; entry/composer inputs are 16px. Source starter cards and production
  cards retain readable wrapping. The 90px mascot respects its source resolution.
- Spacing: compact welcome, three starter cards, one-row ingredient checks,
  and a unified desktop rail. Removed the extra empty-chat heading. The two
  new 44px quick actions intentionally add a row above the composer. Content
  has bottom clearance for the composer and all five navigation tabs.
- Colors: original cream #F8F3E9, forest #344638, sage #E8EDDE and terracotta
  #BF4E2C, with static peach and sage background gradients. This warmer
  background is the user's selected deviation from the first concept.
- Assets: original brand mark, mascot and catalog artwork; upstream Lucide
  interface icons with their ISC notice. No replacement raster artwork was
  fabricated, and the existing AI image/recipe paths are retained.
- Copy: production welcome and starter prompts retain their actual behavior,
  rather than the prototype's sample responses. Technical provider names were
  replaced by a short explanation that changes can be reviewed before saving.
  Navigation order differs deliberately per the latest user instruction.

## Functional evidence

- 152 JavaScript tests and all six SQL suites passed. The six new tests cover
  alias matching, duplicates, approximate pantry availability, existing list
  quantities, recipe metadata, custom products and intervening changes.
- Eight Python server tests passed, including script loading and private-file
  protection. JavaScript syntax and whitespace checks passed.
- Native browser interaction at 320px: comma/Enter staged Tej, Tojás and a
  custom item; saving kept the chat and produced confirmation. Pantry showed
  the custom item under Saját tételek and nine present ingredients.
- Quick-add from the pantry then staged Tej, Alma, Tej as two distinct entries.
  Saving kept the pantry section, displayed Tej on both pantry/list, and changed
  the shopping badge from one to two. Existing Alma was retained.
- Web and native bundles built; Capacitor synchronized the iOS and Android
  projects. The notices are included in both distributions.

## Limits

Browser QA uses isolated local fixture storage and simulated AI, with no writes
to the live household. A real microphone, hardware keyboard/safe-area behavior,
cross-device Supabase session and signed store builds were not re-tested in
this UI pass. The existing implementations remain in use. Native compilation
is also covered by the repository's normal CI workflow after publication.

## Acceptance

The selected composition, palette, real assets and mobile navigation are
implemented. Recorded visual deviations are deliberate adaptations to real
data and the requested global quick actions. Remaining validation limits are
listed above rather than being presented as completed live tests.
