# Recipe-page mockup adoption — 2026-11-19

## Visual truth and implementation

- Source: design/recipe-page-2026-11-19/reference.png, 1531 × 1023 pixels.
- Implementation: http://127.0.0.1:8083/?actor=a .
- Final screenshot: design/recipe-page-2026-11-19/implementation-final.png.
- CSS viewport: 1531 × 1023, deviceScaleFactor 1. Source and implementation use the same pixel dimensions; no scaling or browser chrome in the comparison.
- State: Hungarian, For you, six fixture recipes, full hero coverage, one active cooking session, three fixture household members.
- Full comparison: design/recipe-page-2026-11-19/comparison-final.png.
- Focused hero comparison: design/recipe-page-2026-11-19/focused-final.png.
- Responsive evidence: responsive-320.png, responsive-390.png, responsive-768.png, responsive-1024.png and responsive-1531.png in the same directory. Mobile is a responsive adaptation of the desktop source.
- Earlier root QA is preserved in previous-design-qa.md beside the source.

## Findings and comparison history

1. First comparison: the major layout aligned, but display text was too heavy,
   sidebar icons did not match, and the mascot had a visible rectangular source
   background. Fixed with lighter Nunito Sans heading weights, Phosphor regular
   outline icons, source-color adjustments and background removal. Evidence:
   comparison-01.png and comparison-02.png.
2. Mobile comparison: embedded heart controls in photo crops could appear beside
   live favourite buttons after resizing. Removed only those source-photo UI
   regions, retaining the real controls and the food subjects.
3. Compatibility class inspection: the preserved recipe-resume class inherited
   an old 720px maximum. Restored the full 802px source column width.
4. Release accessibility scan: household subtitle contrast was 4.38:1. Darkened
   the secondary text slightly and retained a readable build-version label.
5. Web/native packaging inspection: moved the web font import to the beginning
   of the shared stylesheet. Native bundling removes the entire remote import
   and maps recipe display text to the existing local system-font stack.

Final comparison identifies no remaining actionable P0/P1/P2 differences.

## Required fidelity surfaces

- Fonts/typography: Nunito Sans headings and Inter body text, matched heading and
  card scales, normal-weight body copy, source-like wrapping and line heights.
  Actual Nunito Sans Latin and extended-Latin 800 faces loaded in Chrome.
- Spacing/layout: 234px sidebar; page x=269px; tabs y=103px and h=57px; hero
  x=269px, y=258px, w=802.39px, h=321px; right column w=413.61px with 24px gap;
  cooking section y=595px; lower section y=745px and four columns. Geometry is
  aligned with the supplied reference. Responsive layouts retain usable controls.
- Colors/tokens: warm cream, sage and terracotta, source-like borders and radii.
  Secondary text is minimally darker where required by accessible contrast.
- Imagery/assets: source photo subjects, source brand and illustrations, cleaned
  transparent artwork, real icon assets and real interactive hearts. Production
  uses household recipe data and the existing backend/device image cache. The
  fictional mockup records and source food crops are confined to the local fixture.
- Copy/content: source app labels and static copy are reproduced. Recipe names,
  coverage, household name/member count and cooking status are data-driven in
  production, without invented household inventory or cooking sessions.

## Functional verification

Chrome on the isolated SQL fixture passed: another idea, save and unsave,
Saved tab, weekly planning dialog, search, recipe reading and return, cooking
resume and responsive widths 320/390/768/1024/1531. No page errors or horizontal
overflow. Existing saved records, favourite actions and cooking IDs remain the
underlying contracts. Multiple cooking sessions remain accessible in a disclosure.

Web and native bundle checks passed. The web font import is at the beginning
of the compiled CSS; the native CSS contains no Google font URL or unresolved
Nunito Sans family. The mandatory release gate remains the production publisher.

## Follow-up polish

- P3: small icon-shape/antialiasing differences remain because the source is a
  raster mockup while the live controls use a consistent open-source icon family.
- P3: source paper-lighting nuance is approximated with the established warm
  page surface; layout and color roles are preserved.

final result: passed
