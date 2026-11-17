# Automatic backend recipe-image cache

Recipe covers and every cooking step use the existing persistent image cache. When a signed-in user sees an image without a cached asset, the app requests it automatically. This includes old chat cards, saved/resume cards, catalogue discovery/browse cards, the recipe reader and the cooking view, in Free and Plus modes. The viewport observer and generation queue defer unused/offscreen images. There is no bulk generation of unopened recipes.

A stable recipe ID and step index identify an asset (-1 means the cover). The backend reuses the stored object before reserving quota or calling a provider. Personal/shared assets stay in private recipe-images storage; published catalogue images use recipe-catalog. Expiring signed URLs are refreshed from the same object and do not expire the stored image. Existing legacy cached images and in-flight Schnell requests remain reusable. Authentication, shared-household access, daily allowances and provider routing are unchanged.

## Completion after the app closes

New fal requests register recipe-image-webhook. Its Ed25519 verification checks the raw-body hash, request ID, user ID and timestamp against fal's JWKS. The callback looks up an existing request handle and fetches the result from its validated queue URL; it never accepts a callback-supplied image URL or creates a new generation. Missing handles, storage errors and accounting failures return a retryable status. A short EdgeRuntime.waitUntil worker also completes requests in the background, including older handles when accessed.

Polling and callbacks share one storage writer. A lease-fenced database update and deterministic object path make duplicate/concurrent completion converge on the same object. Paid settlement can retry after the image is already stored. Provider terminal failures keep the existing cooldown/retry behavior; transient failures retain the handle instead of submitting another billable request.

Reference: [fal webhook delivery and signature protocol](https://fal.ai/docs/model-apis/model-endpoints/webhooks). Delivery retries and result retention are provider-bounded; generation still requires a configured provider and available quota.

## Rollout

1. Apply supabase/migrations/20261117_recipe_image_webhooks.sql. It adds only a request-ID lookup index and is safe to reapply. No existing data, grants or RPC contracts change.
2. Deploy recipe-image-webhook **before** deploying the updated recipe-image function. supabase/config.toml disables gateway JWT verification only for this callback; the function verifies fal signatures itself. It uses the existing server-side FAL_KEY and Supabase service credentials.
3. Deploy recipe-image, which registers the callback URL from SUPABASE_URL. Other providers continue through the same backend storage writer.
4. Publish the frontend only through the successful Audit regression gate. Updating the frontend alone does not enable backend callback completion.

## Verification

- Backend tests cover covers/steps without browser polling, forged/tampered/stale callbacks, early delivery, duplicate delivery, concurrent polling, storage and settlement recovery, terminal failure, stale leases, old-model handles and cache reuse. The SQL suite reapplies the additive migration and checks one image job across users.
- tests/recipe-image-cache.browser.mjs uses the local SQL fixture with a mocked image endpoint and an existing fixture photo. It checks an old chat's missing cover, all three ordinary steps in Free mode, cache reuse after reload, and automatic catalogue card images without extra image buttons.
- Browser evidence: [results](../design/recipe-image-cache-2026-11-17/results.json) and [mobile catalogue](../design/recipe-image-cache-2026-11-17/library-auto-images.png).
- These deterministic checks do not measure live fal latency, generated food-image quality or production webhook delivery. Production deployment is separate from this source change.
