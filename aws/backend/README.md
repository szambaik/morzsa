# Morzsa AWS backend

The web, Android and iOS build scripts select AWS by default. The independent
Supabase implementation remains available with `--supabase`; failed requests
never switch databases. Native clients must receive a newly built app.

## Runtime

All application infrastructure is in `eu-north-1`, stack `morzsa-backend`.
There is no SQL database, RDS, Aurora, VPC, NAT gateway or provisioned concurrency.
Node 22 / arm64 functions are separately bundled at 256 MB.

| Function | Responsibility |
| --- | --- |
| `morzsa-backend-data` | Household/RPC/table contracts, membership, pantry/list, conversations, recipes, signed media |
| `morzsa-backend-auth` | Cognito password/recovery/confirmation, Google PKCE, trusted application UUID mapping |
| `morzsa-backend-ai` | Authenticated AI ingress, entitlement checks, cached images, private job status |
| `morzsa-backend-worker` | Gemini/Groq/OpenAI requests, recipe persistence, fal.ai/OpenAI images, voice setup |
| `morzsa-backend-voice-monitor` | Server sideband, 110-second voice bound, usage and session safeguards |
| `morzsa-backend-import` | IAM-only verified source import and provider configuration; refuses overwriting active application data |

Provider/prompt/validation helpers are reused from `supabase/functions`, but their
Supabase service handlers are not invoked. Credentials stay in Secrets Manager.

## Data and media

`ARCHIVE#dataset#table` preserves source rows. `APP#dataset#scope / STATE` is a
revision head for household, user, conversation, recipe, message identity or
global settings. Small states are inline; larger states point to immutable,
checksummed private S3 objects. DynamoDB conditional transactions cover writes
and membership dependencies. Conflicts are returned as 409. The transaction
fails safely if it exceeds 100 entities; it never splits an atomic save.

Pantry/cart tombstones, per-record revisions, acknowledged cart receipts,
shopping attribution, private conversation context, per-user archive state,
recipe ownership/sharing and original user UUIDs are preserved. Message UUIDs
have a global uniqueness head. Local saves and outboxes are separately scoped
for AWS; joining a household does not import a device pantry.

Recipe, step and chat images persist in a private encrypted versioned S3 bucket.
Registered published recipe assets have a public API redirect; private links
wrap short-lived S3 signatures. Cache hits do not call a model. Known fal handles
are resumed, and pending image work is requeued even after the client closes.
Unknown expired generation leases become uncertain rather than silently charging
for another submission. User images have no TTL. AI job heads expire after a day.

AI replies use SQS and private jobs. Bounded progress snapshots carry partial
answers/recipe previews; the client exposes the existing NDJSON protocol and
only accepts a validated final result for saving. Provider generation does not
run inside the HTTP API request timeout. Cancelling the UI does not guarantee
cancelling an already submitted provider request.
Active chat progress polls every 350 ms; provider updates are coalesced every
250 ms rather than written for each token. This is incremental job progress,
not a direct HTTP token relay. Accounting and result persistence retry rejected
revision writes and DynamoDB transaction conflicts without repeating generation.

Household and conversation notifications currently use a 20-second foreground
poll. This has the same application refresh hooks, but is not instant push.

## Authentication

Cognito has a public client, authorization-code PKCE, 15-minute access tokens,
7-day refresh tokens and token revocation. Refresh rotation is disabled because
the selected Lite tier rejects it. Imported Google subjects are prelinked to
their original accounts. Password hashes were not exported: password users
perform one Cognito password reset. Migration sends no account emails.

Callbacks: production `https://szambaik.github.io/morzsa/`, native
`io.github.szambaik.morzsa://auth-callback`, local `http://localhost:8080/`.
Google's authorized redirect is the Cognito domain's `/oauth2/idpresponse`.
The actual user's Google browser/device flow still needs interactive verification.

## Deployment and verification

`npm run build` in this directory creates six ZIPs and the generated template.
Replace each function Code property with its verified S3 package reference,
validate the packaged template with cfn-lint, then update the existing stack.
Deployments used the official AWS MCP, preserving stateful Retain policies.

`sanity.mjs` and `engine-sanity.mjs` use an ignored private migration snapshot.
`cloud-sanity.mjs` and `cloud-ai-sanity.mjs` require an explicitly provisioned
synthetic Cognito account in ignored `build/sanity-account.json`; never point
them at an imported account. Cloud tests do not change an imported household.

Production Pages is published only by the existing successful Audit regression
gate artifact. Before publication merge the latest origin/main and run
`node design-audit/check-release.mjs`. Mobile builds also use the AWS default.

## Telemetry and costs

Request logs include route, method, status, request ID and handler duration;
provider/job timing uses bounded structured records. Request bodies, photos,
prompts, credentials and tokens are not logged. UUIDs in request paths are
redacted. Lambda logs retain seven days. CloudWatch has worker error and SQS DLQ
alarms; they currently have no external notification destination. Expected
provider/input failures are visible as job status and logs, rather than Lambda
execution errors. There is no complete client-error collector or distributed
trace pipeline yet.

The migration used 100 read/write request-unit throughput caps. These caps and
Lambda/API concurrency limits protect throughput; they are not a monthly cost
ceiling. The 15 EUR/month infrastructure target still needs billing observation.
AI provider charges are additional. Cognito/Secrets/PITR/S3/log costs remain
usage dependent, independently of the account's starting credit.

## Source boundary and recovery

See `MIGRATION-2026-11-18.md`. Import requires checksum verification and
COMPLETE state before activation, and refuses overwriting `READY_PREVIEW`.
Retained Supabase data is a source snapshot, not a live mirror of subsequent AWS
writes. Older installed clients still use Supabase until updated. Switching back
requires reconciliation of new AWS writes first; it is not a transparent failover.
