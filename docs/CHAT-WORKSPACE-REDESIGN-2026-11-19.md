# Morzsa conversational workspace redesign

Implemented the supplied Chat UI / UX Redesign & Information Architecture brief
in the existing frontend. The AWS backend, Cognito sign-in, API contracts,
DynamoDB state, asynchronous AI workflow and private image storage are preserved.

## Components and behavior

- Assistant text and structured recipe results have separate layout containers.
  Each recipe has a consistent 16:9 cover, attribution, recommendation label,
  title, time/servings, description and one prominent Open recipe action.
- Availability comes from KitchenModel.recipeChoice. Explicitly missing items
  and low/uncertain items are distinguished; no quantities or availability are
  invented. Ingredient management uses the existing panel and acknowledged cart.
- Favourite actions retain existing account/member persistence. Recipe navigation
  opens the existing reading/cooking experience.
- A single follow-up control group belongs to the latest completed recipe turn.
  New idea and refinement use the existing AI workflow, preserving the original
  request, later corrections, refinements and excluded dishes. Recipe variations
  remain available through a smaller secondary disclosure. Background refreshes
  preserve the open refinement editor, unsubmitted checkbox changes and focus;
  a new AI request resets the editor to its submitted constraints.
- What I took into account presents the actual retained request/corrections and
  selected refinements. Bare follow-ups such as Again or Give me a recipe do not
  appear as meaningful constraints. All user text is escaped.
- Shopping/pantry prompts require a relevant current conversation. Their source
  is stated explicitly. Existing shopping-prompt snoozes remain; contextual
  proactive prompts also have a scoped, 24-hour dismissal keyed to their state.
- The household panel shows the current outstanding list, at most three preview
  items, stock count, low/uncertain items and existing full-view links. It reads
  existing state, never starts extra household requests. Updates retain focus and
  expose pending/offline state without claiming a successful write.
- At 1280 px and above it is a compact right panel. Below that it opens from a
  header shortcut in a keyboard-aware dialog with Escape/close and focus return.
- New conversation precedes the independently scrollable history. Account,
  cooking preferences, AI settings, language, introduction and diagnostics stay
  grouped under Account & settings. Search, archives and sharing remain intact.
- Text, photo, voice, Send/Stop and the existing mobile keyboard handling are
  preserved. The header new-chat action remains at the right viewport edge even
  with the household panel. Existing iOS header controls remain web controls;
  the new shortcut follows the same policy and hides background native controls
  while its dialog is open.

## Files

New presentation files: chat-workspace-model.js and chat-workspace.css.
Updated frontend files: companion-ui.js, recipe-discovery-ui.js,
proactive-ui.js, workspace-ui.js and index.html.

New tests: tests/chat-workspace-model.test.cjs and
 tests/chat-workspace.browser.mjs. Updated the existing recipe-discovery test's
refinement selector, the mobile AI-settings disclosure path, and extended the existing iOS control regression. The AWS
chat regression is included in design-audit/check-release.mjs.

## Verification

- All 418 unit tests and 12 SQL suites passed.
- Chromium and WebKit passed the interaction suite at 320, 375, 390, 768, 1024
  and 1440 px, including aspect ratio, touch targets, no horizontal overflow,
  drawer focus/offline updates and last-result clearance above the composer.
- The actual AWS client, backend selection and storage namespaces also passed
  against an isolated contract fixture. All external requests were blocked;
  the fixture uses persisted synthetic SQL data, not production household data.
- Confirmed favourite persistence/reload, existing recipe navigation, ingredient
  addition through server-confirmed cart writes, alternatives/refinements,
  contextual prompt dismissal/reload, history/search, AI mode and language.
- Full release gate passed: 32 axe scans, 54 targeted regressions, 77 iOS control
  checks, 34 native-composer checks, 127 viewport checks, household recovery,
  progressive recipes/cancellation, dynamic cooking, recipe discovery, shopping
  and the new AWS chat regression. The mobile Chromium suite also passed 134
  checks, including denied Plus, mode switching, late status, keyboard and
  navigation/request stability.
- Evidence is in design/chat-workspace-2026-11-19 and the local audit run's
  chat-workspace directory. Screenshots show synthetic test households.

## Limits and next checks

Real microphone/realtime calls and manual testing on a physical iPhone were not
performed. Existing voice/attachment paths and native adapter tests passed.
The fixture blocks third-party network access, including external font requests;
font families and brand styles are preserved in the production CSS.

No backend infrastructure or resource configuration was changed. The existing
CloudFront/S3 publisher consumes the exact successful main Build and sanity
artifact under the current release policy. Its revision marker records
sanity: passed and audit: not-run. The local verification results above are
separate from this publication marker; no artifact is rebuilt during upload.
