# Guided cooking and persistent images

## Audit and implementation

The existing recipe model, Supabase recipe documents, shared pantry/list RPCs,
conversation outbox, portion controls and OpenAI Realtime audio pipeline are reused.

- companion-model.js already stored current/completed steps. New recipe sessions
  start in preparation; legacy active conversations resume without forced onboarding.
- companion-ui.js separates preparation, one active step, and completion. The full
  recipe remains readable. Preparation reuses availability and shopping actions.
- cooking-session.js validates phases, deadlines, feedback and explicit speech.
  cooking-ui.js renders the new phases.
- recipe-room-model.js parses explicitly numbered actions and separate tips only
  for presentation. New recipe prompts request named chapters, numbered practical
  actions and a useful Fontos/Important tip. Historical recipe text is preserved.
  Both reading and guided views put the compact step image before its instructions.
- panel-gestures.js excludes native details summaries from pointer capture so
  preparation previews and the approved-consumption section work by touch/mouse.
- persistence-model.js stores metadata through the existing conversation outbox.
  Timers merge by ID; going backwards does not erase completed progress.
- voice-command/handler.mjs validates session context. Realtime refreshes through
  read_kitchen; validated tools repeat, advance, navigate and start timers.
- recipe-image/persistent.mjs caches assets per immutable recipe ID and step.
  Catalogue assets are shared; personal recipe files remain private.

Timers use absolute deadlines. Refresh/backgrounding preserves remaining time.
They never advance steps automatically. Browsers cannot guarantee an audible alarm
while suspended; returning shows expiry. OS notification delivery needs a separate
native notification integration.

Total recipe time is shown when known. Prep/cook time splits and technique cues
are not invented for historical recipes. Timer suggestions come only from explicit
minute values; ranges start at the lower bound for checking, not guaranteed doneness.

Rating/notes and explicitly remembered favourites belong to the existing private
conversation. Sharing follows existing household controls; remembering a favourite
does not silently alter other members' preferences. Completion never consumes stock.

## Image strategy

1. Read the cached recipe/step asset before calling any generator.
2. Preserve canonical recipes and serving-independent image identity.
3. Generate visible steps; Plus automatically requests step images.
4. For fal, save the queue handle before returning pending.
5. After navigation/timeouts, poll the same handle. Never blindly resubmit a paid
   request. Unknown completion stays fenced for reconciliation.
6. Copy the JPEG to Morzsa Storage and serve the immutable file. Renewing a private
   signed URL never regenerates its image.
7. Cache hits survive provider changes. Adopt legacy prompt-v2 objects. No existing
   image is deleted by this rollout.
8. Owners can explicitly replace personal recipe images after an inline allowance
   confirmation. Keep the prior file. Readers cannot replace catalogue/others' images.

Only the active instruction enters a step-image prompt. Other actions are omitted,
so preparing a pan does not ask for batter mixing. This reduces ambiguity without
guaranteeing generated image correctness or providing food-safety evidence.

## fal.ai FLUX.1 Schnell

Checked 2026-11-15 against the official endpoint:
https://fal.ai/models/fal-ai/flux/schnell
https://fal.ai/models/fal-ai/flux/schnell/api

Published price: **$0.003 per megapixel, rounded up per image**. Our request uses
768 x 512 JPEG, four inference steps, one image and enabled safety checking: one
billable megapixel. Estimates exclude prompt translation, Storage/egress and taxes.

| Newly generated assets | Estimated image cost |
|---|---:|
| 1 cover | $0.003 |
| 1 cover + 5 steps | $0.018 |
| 1,000 recipes with 6 images each | $18 |
| Viewing an already cached recipe | $0 generation |

Schnell favours latency/cost. It already powers the Cloudflare free image path.
Moving to fal changes hosting and queue behaviour, not necessarily image quality.
Without a fal key there is no measured latency/quality benchmark. OpenAI remains
selectable. Text and Realtime providers are independent of the image provider.

### Configuration

Create a key at https://fal.ai/dashboard/keys and add Supabase Edge Function secrets.
Never put a secret in the frontend or Git.

- FAL_KEY: fal secret key.
- PLUS_IMAGE_PROVIDER=fal: new personal Plus recipe images.
- CATALOGUE_IMAGE_PROVIDER=fal: new catalogue images, optional.
- Keep GROQ_API_KEY for short English image-prompt translation.
- PLUS_IMAGE_PROVIDER=openai retains OpenAI images.
- CATALOGUE_IMAGE_PROVIDER=cloudflare retains the existing free catalogue path.

With FAL_KEY and no override, new Plus images choose fal. Without it, existing
OpenAI/Cloudflare defaults continue. Image caps remain. Personal Plus fal images
reserve one USD cent in the existing Plus ledger (endpoint cost ~0.3 cents),
instead of OpenAI's 25-cent reservation.

Apply 20261115_cooking_image_jobs.sql and deploy recipe-image, voice-command,
plus-assistant with the frontend. The migration is additive/repeatable. Publishing
is a separate rollout step. No seed replacement, recipe rewrite or bulk regeneration.

## Validation

Model tests cover phases, backwards navigation, independent timers, reload,
concurrent cancellation, feedback, contextual prompts and speech gating.
Image tests cover queued recovery, no duplicate submission, cache/provider changes,
unsafe URL rejection, focused step prompts and legacy caches.
SQL checks repeatable migration, owner-only refresh and preservation of prior files.
Browser tests cover preparation, portions, missing ingredients, guided navigation,
timers, resume, completion, cross-device notes and approved inventory removal at
mobile/desktop widths. Mocked images and speech do not establish real image quality
or actual Realtime recognition/latency.
# Recipe library and quick activities

The recipe library has three tabs: **Neked**, **Böngészés**, and **Mentettek**.
Active recipe conversations appear in a separate compact resume section on every
tab. Saved/favourite and completed recipes form one deduplicated collection.
Cards show the cover, title, duration, confirmed pantry coverage and one opening
action. Favourites remain on the cover; sharing and download are in the reading
view. Existing catalogue documents, immutable image cache and conversations are
reused without generating images just because a card is browsed.

The persistent **Hozzávalók** shortcut opens a separate ingredient panel from both
the reading view and cooking chat. It locks the underlying page, scrolls its own
contents and restores the exact scroll position and focus when dismissed. Pantry
and shopping actions reuse the existing guarded save paths. Preparation still
shows ingredients inline because checking them is the purpose of that stage.

The activity bar appears during cooking and shopping, where it exposes useful
switches between active tasks. Ordinary chat and the recipe library use the main
navigation, with a persistent new-chat shortcut in the header. Switching
activities retains cooking progress and shopping checks. Recipe chat is available
by default, with recipe, portions and current step in the assistant context.

Weekly planning uses a private conversation with persisted planning metadata.
It plans one main meal per day for 1–6 people, in two or three cooking batches,
including leftovers and freezing guidance. A single assistant request asks for
the complete plan. Shopping additions require explicit review, aggregate
compatible quantities for newly added items, preserve existing manually entered
quantities/checks, and attach recipe references. Unknown/stale pantry items are
not preselected. Budget is a preference, not a live grocery price estimate.

Browser checks: tests/recipe-library.browser.js, tests/activities.browser.js and
tests/guided-cooking.browser.js use the isolated SQL fixture and mocked AI/images.
They exercise actual controls without paid provider calls or production data.

Discovery refinement keeps quick actions and recipe filters wrapped at narrow
widths, without horizontal scrollers. Each card has one keyboard-accessible
opening button stretched across the card, plus an independent favourite control.
Known missing and uncertain ingredients are labelled separately. Weekly planning
has a compact explained entry. Personal sections require confirmed pantry data,
real saved favourites, explicit preferences or matching recipe durations; absent
household data is never fabricated. tests/discovery-polish.browser.js covers
320/360/390/1440 widths, fixed controls, favourites, opening and loading/empty
recovery; tests/discovery-sections.test.cjs checks data eligibility.
