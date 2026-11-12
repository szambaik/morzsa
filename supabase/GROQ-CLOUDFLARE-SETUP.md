# Groq + Cloudflare integration

Implemented 2026-11-12. Set the following in Supabase Edge Functions → Secrets:
GROQ_API_KEY, GROQ_MODEL (openai/gpt-oss-120b), CLOUDFLARE_ACCOUNT_ID,
CLOUDFLARE_API_TOKEN, CLOUDFLARE_IMAGE_MODEL (@cf/black-forest-labs/flux-1-schnell).
Keep GEMINI_API_KEY for fallback and existing audio/photo inputs.

Deploy voice-command and recipe-image after applying
migrations/20261112_recipe_images.sql. The migration is repeatable and creates
only service-accessible image job/quota tables and a private recipe-images bucket.
It does not alter household records or existing chat saves.

Text-only voice-command requests use Groq when its key is present. The existing
answer/transcript/operations/recipes contract is unchanged. JSON-object streaming
is used with the existing server validator (not Groq strict schema + streaming,
which are not supported together). Recent history is bounded to six messages of
1500 characters. A failed preview is cleared before one Gemini fallback attempt;
there are at most two provider calls and one app quota claim. User cancellation
stops fallback. Groq is given 12 seconds, within a 35-second overall budget.
Image/audio input and legacy recipe-ideas requests still use Gemini.

Recipe cover illustrations generate asynchronously for new chat recipes. Older
recipes offer a generate button; cooking method steps offer individual buttons.
The service validates the recipe, authenticates the caller, atomically reserves
a per-user job and quota, generates via FLUX Schnell, and uploads PNG/JPEG to
private Storage. Two-hour signed URLs are returned only after owner-specific
lookup. The browser does not persist signed URLs in chat history.

Daily generation attempts: 50 per app, 20 per user (UTC). Failures count toward
these limits. Cache hits do not. Concurrent duplicate requests share a pending
job; a two-minute lease enables recovery after a crashed invocation. A failed job
waits one minute before retry. Only FLUX Schnell is allowed; there is no paid-model
fallback. Workers Free must remain selected on Cloudflare to enforce its free
allocation. Storage/traffic count against Supabase quotas separately.

Current limits: image cache is per user, not shared across household accounts;
Cloudflare illustration consistency across steps is not guaranteed. Browser
pending jobs can be refreshed with the image button. Shared provider cooldown,
large-scale queueing, voice migration and a full 30-case quality benchmark from
the proposal are later work. Existing voice app quota remains 30/user/day and
300/app/day; provider limits are separate and were not raised.

Verification: 128 Node tests plus SQL compatibility suites; web bundle and mobile
sync. Synthetic live Groq recipe ~969ms, mutation ~507ms, Cloudflare image ~1506ms.
Complete image generation/store/sign/cache retrieval passed: two requests made one
Cloudflare call, signed asset HTTP 200. These timings are individual observations.

Recipe-image prompt correction: recipe-image also reads GROQ_API_KEY / GROQ_MODEL.
After a cache miss and quota reservation, Groq translates the title, ingredients
and cooking method into a specific English dish/scene description for FLUX.
This adds one short text request per generated image, not per cache lookup.
If translation fails, image generation stops instead of substituting a generic
meal. Prompt cache version 2 prevents earlier mismatched images from being
reused; old assets are preserved. Images are still illustrations, not verified
photographs of the exact recipe.
