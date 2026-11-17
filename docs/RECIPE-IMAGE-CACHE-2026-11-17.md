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

Verified after merging origin/main at 5f342a8:

- 326 JavaScript tests and all SQL suites passed; nine Python tests and 26 audit-engine tests passed.
- Release gate: full audit, 32 axe scans, 54 targeted regressions and 68 iOS control checks passed.
- Performance regressions, web build and bundled-web browser checks passed.

- Backend tests cover covers/steps without browser polling, forged/tampered/stale callbacks, early delivery, duplicate delivery, concurrent polling, storage and settlement recovery, terminal failure, stale leases, old-model handles and cache reuse. The SQL suite reapplies the additive migration and checks one image job across users.
- tests/recipe-image-cache.browser.mjs uses the local SQL fixture with a mocked image endpoint and an existing fixture photo. It checks an old chat's missing cover, all three ordinary steps in Free mode, cache reuse after reload, and automatic catalogue card images without extra image buttons.
- Browser evidence: [results](../design/recipe-image-cache-2026-11-17/results.json) and [mobile catalogue](../design/recipe-image-cache-2026-11-17/library-auto-images.png).
- These deterministic checks do not measure live fal latency, generated food-image quality or production webhook delivery. Production deployment is separate from this source change.

The first CI run exposed a startup race in the inherited iOS-control test: history sync could replace the composer between locator resolution and style measurement. A local 15-reload probe reproduced an empty computed style on a detached element. The assertion now resolves and measures the current form in one browser task; the same 15-reload probe passed, and the flex/grid expectations and release requirements remain unchanged.

## Follow-up: existing iOS cards stayed on ingredient illustrations

The user's updated iOS build still showed the Sonkás-gombás palacsintabatyu placeholder. Its published cover was already ready in production; the asset returned HTTP 200 with image/jpeg and the image endpoint returned ready with the correct capacitor://localhost CORS response. The issue was therefore not explained by an ungenerated cover or an old binary alone.

Reproduced and fixed:

- Navigation removed the last image mount, so polling stopped. Remounting a pending entry only repainted its placeholder and never restarted the cache lookup. Returning to a card now checks the existing asset again.
- Native resume, browser visibility restoration and connection recovery now recheck visible pending/failed cards. Cancelled polling callbacks cannot duplicate a resumed polling cycle.
- Quiet cards suppressed all failure and pending information. They now show a compact loading label and a 44px retry control on failure. Transient lookup/decode failures get at most two automatic cache reads; manual retry remains available. Detached image callbacks cannot overwrite a recovered view.
- Automatic cards previously entered the serial generation queue even for already-cached covers. They now read the cache first through the independent, bounded read queue; only a confirmed miss enters generation.

No recipe, image object, provider or quota data is reset. Automatic recovery reads existing jobs; it does not regenerate completed images. Offscreen cards are excluded from resume recovery.

Validation: 332 JavaScript tests plus all SQL suites passed. The release gate passed 32 accessibility scans, 54 targeted regressions and 90 native-control/composer checks. The new browser regression passed in Chromium and WebKit at 320, 390 and 430px, including real image decoding, returning after navigation, native-resume events, visible retry controls and no page overflow. These browser tests use isolated fixture data and a fixture photo, with external calls blocked. Physical iPhone verification remains a separate device check.

Regression files: tests/recipe-image-recovery.test.cjs and tests/recipe-image-recovery.browser.mjs. Run the latter against tests/persistence-fixture.mjs on port 8942, with MORZSA_QA_PROACTIVE=1; MORZSA_IMAGE_BROWSER selects webkit or chromium.
