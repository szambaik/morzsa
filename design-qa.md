# Morzsa design-board adoption QA — 2026-10-30

**Scope**
Introduce the supplied design language into the existing production app while retaining the user's presence-only inventory, three-column mobile grid, household/account dropdown, grouped overview and thumb-reachable search/voice controls. This is an adaptation of a multi-variant board, not a pixel clone of its fictional data or a new quantity/expiry feature.

**Visual sources and evidence**
- Source: design/morzsa-design-board.png, 1536 × 1024 supplied by the user.
- Content-only source crop: design/reference-mobile.png, (548,88)-(941,970), 393 × 882. Device frame/status bar excluded.
- Implementation: http://localhost:8771/ captured in the Codex in-app browser, in a local fixed-size iframe solely for viewport QA.
- CSS viewport: 393 × 882; screenshot crop design/implementation-mobile-final.png, 393 × 882. Same pixel density, no screenshot stretching.
- HU populated local test inventory: 14 product types, 6 categories. The board uses illustrative 24/5 counts, quantities and expiry. Those are intentionally not copied as data.
- Full-view, same-input comparisons: design/comparison.png (first pass) and design/comparison-final.png (final).
- Focused comparison: design/comparison-details.png (title, mascot, summary and product cards).
- Narrow view: design/mobile-320-en-frame.png, 320 × 740 iframe within browser capture. English title, summary, category strip, cards and all navigation/search/voice controls fit. HU narrow view was also inspected.

**Findings and iteration history**
- [P2, fixed] Product illustrations were too small (36 px) compared with the source's prominent food imagery. Changed to 46 px, 40 px at narrow widths, without increasing card height. Final full/focused comparison confirms stronger recognition and no control overlap.
- [P2, fixed] The overview's All category lacked the house symbol used throughout the supplied design. Reused the existing house icon and aligned it with category artwork. Final comparison shows consistent icon/text rhythm.
- No remaining actionable P0/P1/P2 findings within the adopted scope.

**Required fidelity surfaces**
- Fonts/typography: Sora headings/brand and Inter body replace the previous Manrope/DM Sans; compact 27 px main heading and 12 px card names. Text is readable and no longer clipped at 320 px. Existing untranslated English pantry action labels were corrected.
- Spacing/layout: 18 px main side padding, 14 px card radii, compact 140 px welcome block, illustrated horizontal filters and grouped grids. Three columns at phone widths intentionally retain earlier usability requirements; four at wider widths. The bottom navigation identifies the actual active page.
- Color/tokens: exact board values for cream, sage, forest, terracotta and wheat. Sage consistently means a product is present. The shopping control remains softly distinguished when inactive and solid terracotta when active.
- Image quality: existing user-generated food assets retained. Mascot is the actual supplied spoon-holding board character, cleanly extracted and inspected composited on cream. It is not code-drawn. Source resolution limits display to roughly 90 px; no large blurred illustration introduced.
- Copy/content: real product/category counts, no invented stock quantities or expiry warnings. Hungarian/English labels and clear empty-state CTA. The household name/sign-in label retains existing behavior.

**Interaction verification**
- In-app browser: populated local pantry through the real text collection form, category filter, language switch, navigation and screenshots. No captured console errors on the final local page.
- Before the visual pass: automated browser tests verified microphone start/stop release, review, uncertain-name confirmation, editing, applying, undo with later edits, cancellation, stale response discard and unavailable fallback. Microphone and AI responses were simulated.
- Existing household switching browser regression passed; Node and PostgreSQL suites cover old formats, untouched data, idempotence, atomic conflicts and authorization.
- Real device microphone recognition/accuracy remains a field-test gap, not a claimed successful live voice call. Deployed function readiness and rejection of unauthenticated requests were checked separately.

**Follow-up polish**
- [P3] A standalone high-resolution mascot export would allow larger illustrations later. Current source crop is suitable for this compact slot.

**Implementation checklist**
- [x] Adopt tokens, typography, cards, illustrated overview and active navigation.
- [x] Preserve current persistence and household contracts.
- [x] Compare source/render side by side and fix identified visual drift.
- [x] Verify populated and narrow layouts and primary interactions.



## Product-principles follow-up

The user subsequently supplied PRODUCT-DESIGN-PRINCIPLES.md and requested its implementation. The companion is now an interactive, labeled entry to text/voice management; the recipe flow is directly accessible there. Shared event-driven updates preserve in-progress edits and explain changed product states.

- New evidence: design/principles-mobile-final.png, 393 × 882; side-by-side source comparison design/principles-comparison.png. The same populated 14-product test state and CSS viewport were used.
- [P2, fixed] The companion's hint/click target initially overlapped the Full catalog link. Kept the hint inside the companion, increased summary clearance, then recaptured. Browser bounding rectangles confirm separate hit areas, and the new comparison was opened and visually checked.
- Typography, palette, source artwork, three-column grid, grouped overview and navigation remain consistent with the accepted adoption. The new assistant dialog uses the same type, border and corner tokens.
- Text request → editable review → apply was exercised in the isolated manual fixture tests/assistant-fixture.py through the in-app browser. Screenshot: design/assistant-text-applied.png (pre-clearance-fix historical evidence). No real household or AI-provider data was used in this fixture.
- Automated follow-up browser tests passed for voice flow, household switching, event-driven refresh, deferred updates during typing, and subscription cleanup on disconnect.
- 46 Node tests and household, invitation, recipe quota, voice quota and realtime-publication SQL tests pass. Realtime publication and service-only voice quota permissions were checked on the deployed project.
- Remaining field-test gap: actual microphone recognition and two physical devices using the live provider together. No claim of a successful real voice-provider call or live two-person session is made.

final result: passed

## Voice and navigation refinement — 2026-10-30

- Removed the shopping tab's permanent emphasis; all destinations share the same active treatment.
- Microphone entry starts recording immediately after browser permission, without an availability round trip or a second start button. Text assistant entry keeps its existing chooser.
- Bottom sheet keeps send/save actions below a separately scrolling body. Compact editable product/action rows retain uncertain-name confirmation, exclusion and list quantity controls. Transcript is expandable.
- Browser regression passed at 390 × 844 and 320 × 740: immediate start, compact rows, navigation states, 24-operation overflow, visible save/send, permission denial, edit/apply/undo, newer edits, cancellation and stale responses. Microphone/provider simulated.
- Screenshots: design/voice-review-compact.png and design/voice-recording-sheet.png. Visually checked. All 46 Node tests and 5 SQL suites passed.

## Conversational answers and lighter review — 2026-10-30

- Review rows show product, action and effective list quantity. Editor fields are collapsed; unrecognized names remain expanded for explicit confirmation. Original transcript stays optional.
- Missing amounts use 1/product unit for new list items, preserve existing list totals, and remain irrelevant for pantry presence.
- Assistant supports text/voice answers plus follow-up exchanges with bounded current-household context; questions have no save button or state mutations. Mixed requests show answers above proposed changes.
- Validation: 49 Node tests plus 5 SQL suites; voice and assistant browser regressions include defaults, repeat actions, answer rendering, no-mutation questions, mixed requests, follow-up context and compatibility. Provider responses are simulated.
- Visual evidence: design/voice-review-compact.png, design/assistant-answer.png, design/assistant-default-review.png.

## Shopping responsiveness — 2026-11-09

- Shopping is the launch screen. List options moved into overflow; rows measured at 46px with 44px controls, and category gaps reduced. HU 390px and EN 320px screenshots: design/shopping-compact.png, design/shopping-compact-320.png.
- Injected stalled server response: several checks, an uncheck and quantity change completed before releasing the response; existing row nodes stayed intact.
- Concurrent partner quantity change generated a revision conflict; rebase preserved it and saved the latest checks. Background-read overlap, pending reload/retry, and queued quick entry passed.
- Existing local/shared checkout, category collapse/reopen, account and household switching, and Realtime regression suites passed. 52 Node tests and five SQL suites passed. Server/network behavior is simulated in browser tests; physical two-phone testing remains user validation.

## Kitchen library and interactive introduction — 2026-11-12

This review supersedes earlier launch-screen/navigation descriptions above.
The current launch destination is Morzsa. Navigation order is Overview, Pantry,
Morzsa, Shopping, Recipes. Existing stores and RPC contracts are preserved.

### Visual sources and evidence

- Selected interactive source: design/navigation-exploration-2026-11-12/companion.html,
  served at http://127.0.0.1:8793/companion.html. Source recipe capture:
  design/library-refinement-2026-11-12/qa/recipes-source-card-full.png.
- User-selected pantry reference: codex-clipboard-8a24b9ea-702c-48f8-952b-046006f1fba6.png
  in the user attachment temporary directory. Original size 378 × 679 pixels.
- Implementation: isolated companion fixture at http://127.0.0.1:8796/;
  actual application at http://127.0.0.1:8797/.
- Phone CSS viewports: 390 × 676 and 320 × 676. Fixture screenshots originally
  1280 × 720 with an unscaled iframe at the upper left; evidence copies crop
  the phone area, without reproducing device chrome.
- The source's viewport override produced a 375 × 650 capture, normalized to
  390 × 676 for comparison. Pantry comparison removes the implementation's
  76px app header and compares corresponding content regions at 378px width.
  This is a content comparison, not a pixel-exact comparison of browser chrome.
- Full-view paired evidence, opened together and reviewed:
  qa/pantry-comparison.png, qa/recipe-comparison.png, qa/intro-comparison.png
  under design/library-refinement-2026-11-12/.
- Focused card comparison: qa/recipe-card-comparison.png. Source and implemented
  cards use different recipe text, so height differences from wrapping are expected.
- Final implementation captures: qa/pantry-current-final.png,
  qa/recipes-current-final.png, qa/pantry-current-320.png,
  qa/recipes-current-320.png, qa/kitchens-final-320.png,
  qa/history-final.png, qa/chat-focused-final.png.
- Actual application introduction: qa/onboarding-live-1.png and
  qa/onboarding-live-2.png. Fixture evidence also covers all three screens,
  final quick-entry action, and 320px introduction.
- Evidence files and original user references remain local; no user screenshots
  are included in the public commit.

### Findings and comparison history

- [P2, fixed] Product illustrations were constrained by legacy CSS. Specific
  image rules now show the original catalog artwork at the intended size.
- [P2, fixed] Generated covers inherited rotation and width limits from ingredient
  art; image mounting also stripped the layout class. Preserve host classes and
  override the generated image crop. Final card comparison shows a straight,
  full-width cover with a readable caption.
- [P2, fixed] Hiding an empty image host prevented its IntersectionObserver from
  checking the server cache. Keep the host over the fallback artwork with no
  interactive contents. Fresh library loads now display cached covers; library
  requests use create:false and never spend an image generation allowance.
- [P2, fixed] Recipe buttons diverged from the selected source. The primary action
  now uses terracotta, a white source arrow and a compact width; the heart is
  separately aligned on the right. Confirmed in the paired final card capture.
- [P2, fixed] The introduction's second screen placed Next below the fold. Shorten
  the copy, remove the repeated mascot on steps two/three, and pin the footer.
  Hide mobile navigation during the tutorial. All actions remain visible at 320px.
- [P2, fixed] A full composer and quick actions obscured too much library content.
  Non-chat screens retain the two quick-add actions; the full composer stays in
  chat. The new pantry comparison shows the first row unobstructed.
- [P2, fixed] Repeated kitchen headings added clutter. One title now introduces
  own/shared kitchen tiles; administration lives in expandable sections.
- No remaining actionable P0/P1/P2 issues in this scope.

### Required fidelity surfaces

- Typography: existing Sora headings and Inter body; compact 21px recipe titles,
  readable 13–15px instructional copy, and short Hungarian/English labels.
- Spacing: three pantry columns, 44px minimum action targets, 18px phone gutters,
  compact primary recipe action, fixed tutorial footer, independently scrolling
  longer library content. Production's app header and five-tab navigation are
  intentionally retained, although the pantry reference crops them out.
- Colors: cream, sage and forest from Kitchen Companion plus the selected warm
  orange background treatment. Terracotta primary recipe/tutorial actions.
  At-home state and shopping-list state are independent and explicitly labeled.
- Assets: real Morzsa mascot, existing food artwork and sourced outline SVG icons.
  Cached recipe image replaces the labeled ingredient artwork when available.
  No new placeholder photos or code-drawn illustrations.
- Content: library includes all started recipe conversations in the current
  user/household/language scope, including completed ones; favorites remain separate.
  Review timing indicates presence confidence, not a claimed food expiry date.
  Tutorial demos do not enter real household data.

### Interaction and compatibility verification

- In the in-app browser: tutorial next/back/skip, pantry demo toggle, shopping demo
  check, final opening of real pantry entry, replay from kitchen menu, 320px layout.
- Actual application first-use introduction and demo toggle verified separately
  from the mock fixture. Normal fixture reload after completion does not force
  introduction on an existing save; old morzsa-v1 remains supported.
- Right swipe starting on plain assistant text opens history; left swipe dismisses
  it. New chat is at the bottom on mobile, with source icons in history.
- Own/shared kitchen switching verified using real household UI and local mock
  REST responses, with no live household mutations. Invite form expands correctly.
- Bulk comma/Enter pantry addition, independent home/list states, recipe favorite
  saving and reopening the existing cooking thread verified in the fixture.
- Browser error logs on final fixture views were empty.
- 155 JavaScript tests, six SQL suites and eight Python server tests passed.
  They cover legacy formats, unchanged data, repeated completion, shared conflicts,
  milk's exact 24-hour review boundary and repeated confirmation timestamp reset.
- Web build and Capacitor sync are validated after final changes. No claim of a
  physical-device test, a live AI-provider response, or live email delivery is made.
- Chat/recipe history remains scoped local browser data; this change does not add
  cloud history synchronization. Existing membership/owner-only rules are retained.

### Follow-up polish

- [P3] A larger mascot master export would allow higher-density hero illustrations.
- [P3] Observe a first-time nontechnical tester completing pantry setup to assess
  understanding, beyond the verified control behavior.

final result: passed
