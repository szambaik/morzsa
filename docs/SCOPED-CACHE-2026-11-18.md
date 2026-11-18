# Scoped device and backend cache

The shared pantry, cart, recipe feed, favourite metadata and previously opened
recipes can now render from this device while authoritative reads run in the
background. Cloudflare configuration is intentionally deferred.

## Device cache

The new MorzsaCache module uses IndexedDB with an in-memory fallback. Opening the
database has a 500 ms soft deadline; disk reads retrieve the requested record
rather than hydrating every stored image at startup. Reads of the same key
coalesce, returned data is cloned, and storage is limited to 256 records / 48 MiB,
with at most 4 MiB per record.

Every key includes account and household. Logout purges the previous account's
cache; generation tokens reject late reads/writes after logout or revocation.
An explicit household permission denial removes its cache and restores the
existing device pantry. Temporary network failures retain the cached view and
the existing Retry control. Cache state is a read snapshot: existing local saves,
cart outboxes, revision checks, receipts and guarded Undo remain authoritative.

Household rows and favourite snapshots are fresh for 30 seconds; recipe feed and
documents for 5 minutes. Their previous snapshot may be displayed for up to one
day while revalidation runs. Images use a seven-day Blob cache and bounded
metadata cache. Renewed signed URLs reuse the same asset path; replacement image
paths remain distinct. Public catalogue images are loaded through this cache
when visible. Permission denial removes the associated cached image state.
A device offline cannot discover a newly revoked server permission until it
reconnects; no server read bypasses membership checks.

## Supabase cache

The additive migration creates private result and household-version tables.
Authenticated and anonymous clients cannot read the result table or invoke its
service RPCs. The service key remains exclusively in Edge Functions. HTTP
responses still use Cache-Control: no-store.

Keys include user, household, request type, SHA-256 of normalized input and prompt,
model identity, and the current household data version. Raw image/input data is
not stored as a cache key. Pantry/cart, preferences, events, membership/names,
shopping state, recipe-library entries, profile names, conversation metadata and
sharing changes invalidate the household version. A result produced against an
older version cannot be inserted as a current result.

| Result | Lifetime |
| --- | --- |
| Recipe recommendations | 24 hours |
| Assistant text | 5 minutes |
| Ingredient recognition | 1 hour |
| Household dashboard | 30 seconds |

Only complete validated outputs are cached. Provider errors, invalid output and
cancelled streams never cache partial results. Recipe recommendation hits retain
the existing no-provider/no-quota behavior. Free commands retain their quota
check. Plus hits still pass the atomic entitlement/membership/quota reservation
and settle with zero provider cost. Image-generation backend artifacts already
have their own persistent cache; this change adds device reuse.

Cache lookup/write failure falls back without discarding a paid valid answer.
Each cache RPC has a 1.5-second timeout; RESULT_CACHE_ENABLED=false disables AI
result caching. SQL bounds payloads to 512 KiB and keeps at most 128 entries per
user, pruning that user's expired results on insertion. Prompt/model changes
alter cache identity. Exact repeated input benefits; a new chat turn with changed
history or pantry is deliberately a different key.

## Validation and deployment

- Full application suite: 402 tests plus all SQL suites passed. The additional
  aborted-cache-stream regression also passed.
- Cache browser test: Chromium, 390 px, actual IndexedDB across reloads, isolated
  SQL fixture; no production user data or provider calls.
- With household reads delayed by 1.6 seconds, the final cached kitchen painted in
  30 ms; an opened recipe returned in 4.5 ms. These are fixture measurements,
  not production latency estimates.
- Verified offline Blob reuse, renewed signatures, cached feed/favourites,
  background refresh, account isolation, permission denial and late-write guards.
- Full release gate: 32 axe scans, 54 targeted checks, iOS controls/composer/viewport,
  86 household-recovery checks, progressive recipes/cancellation, dynamic cooking,
  recipe discovery and shopping regressions passed.
- Web build and native asset sync passed. The local Xcode and Android projects
  contain the new frontend bundle.
- The migration and recipe-ideas, voice-command and plus-assistant functions were
  deployed to cbgcugshwivxpaurzyqq. Live schema/permission checks are recorded in
  scoped-cache-2026-11-18/backend-deployment.json.

Device hit/miss/coalescing counters are available through MorzsaCache.stats().
Backend logs emit morzsa_result_cache with type, hit, lookupMs and availability;
no prompt, image, account identifier, signed URL or credentials are logged.
A new production chat timing sample is still required to quantify end-to-end
improvement. Cold/new inference still incurs provider latency.
