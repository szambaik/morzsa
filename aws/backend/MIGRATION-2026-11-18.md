# Verified AWS migration — 2026-11-18

Source: Supabase project `cbgcugshwivxpaurzyqq`. Destination: `morzsa-backend` in
Stockholm, account `805089420194`, with DynamoDB, Cognito and private S3.

- Snapshot: 2026-11-18 19:15:22 UTC (20:15:22 Budapest).
- SHA-256: `605c41e55da8c67e2b8d13d678cca705c6a59a8ef5bd2d63c61d2b07cef25360`.
- 36 public tables, 1,625 public rows, five archived source auth users and six identities.
- 152 storage objects, 49,307,194 bytes, checksummed and verified in S3.
- 4,113 archive/projection/head records verified by readback in DynamoDB.
- Four valid-email accounts mapped to Cognito, retaining application UUIDs;
  one invalid-email non-household account remains archived without a login mapping.
- Import checkpoint COMPLETE; active dataset `605c41e55da8c67e2b8d13d6`,
  application writes armed with `READY_PREVIEW`. Reimport is now refused.
- Source public data, storage metadata and identities were checked unchanged
  at 19:28:20 UTC immediately before enabling writes. Supabase was not disabled.

Both imported household members independently read the original 274 household
records through the deployed data handler. An isolated authenticated synthetic
account received 403 for that household. Synthetic cloud checks covered password
login, public recipes, acknowledged/replayed cart writes, concurrent 200/409
updates, conversation persistence and duplicate message UUID rejection.

Measured from this Mac, with a small sample rather than a load test: household
record read 98 ms; new household 228 ms; acknowledged cart writes 223/234 ms;
concurrent writes 201/279 ms; conversation save/page 220/240 ms. The initial
catalogue implementation took about 2.3 s and was subsequently parallelized.

One real free text request completed in 5.745 s. One fal image completed, persisted
and downloaded as JPEG in 7.130 s. A repeat request reused the same asset with
no new generation. These include API/job polling and are not provider-only
latencies or representative p95 values.

The final v8 stack reached UPDATE_COMPLETE. Its direct image-cache response
returned 200 in 1.337 s on the first request and 0.648 s on the repeat; the
signed image downloaded successfully. Public catalogue read measured 2.809 s
after parallelization, so further catalogue optimization remains possible.

Local cfn-lint and migration/domain sanity passed. The required release gate
passed, including 32 accessibility scans, 54 audit fix regressions, household
recovery, dynamic recipes, discovery and shopping cases. The AWS-configured
native iOS project compiled for generic iOS with signing disabled. Android
assets were synchronized; an Android SDK is not installed on this Mac, so its
native binary is produced by the existing Android CI workflow.

Google login initially failed with `invalid_client`: the imported Google OAuth
secret was a SHA-256 digest rather than the original client secret. On November
18 the correct credential was loaded from the downloaded OAuth client JSON,
validated against Google's token endpoint, and applied to Secrets Manager and
Cognito. The importer now refuses Google secret digests before changing any
provider configuration. The user confirmed the corrected login and existing
household/pantry on web and iOS. Native OAuth callback handling now dismisses
the browser before restoring the session and household.

The first real Plus chat exposed conditional-write conflicts during accounting.
Reservations now use fresh transactions without unrelated conversation snapshots;
accounting, recipe saves and answer caching retry rejected conditional writes
at most four times. Model calls remain outside these retry boundaries.
Targeted checks preserve concurrent data, single provider calls, bounded retries
and immediate native browser dismissal; the required local release gate passed.
A single live OpenAI Plus chat in an isolated synthetic dataset completed with
a valid answer and no recipe or pantry/list operations.
Physical-device microphone/voice flows remain interactive device checks.
No complete separate backend regression or load test was run.
Production publication must use the existing protected workflow.

The two older `ROLLBACK_COMPLETE` stacks are `morzsa-backend-pilot` (API Gateway
rejected a Capacitor CORS origin) and `morzsa-aws` (Cognito Lite rejected refresh
rotation). They do not serve the app. The successful replacement stack fixes
both issues. Retained trial resources have not been deleted.

Private exports, provider configuration, setup proof, JWTs, screenshots and
deployment packages are ignored local artifacts and must never be committed.
