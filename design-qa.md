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

final result: passed
