# AI performance diagnostics

Open Settings → Operations and response times. The last 150 measurements live
in memory in the running app. Export JSON on the web or share the diagnostics
through the native iOS/Android share sheet. Reloading clears this buffer.
No prompts, message text, photos, household names, user IDs or credentials are
collected. Request/job IDs correlate the UI timings with existing CloudWatch
structured logs. This does not add an external analytics collector.

Chat total time starts at Send. Preflight includes history synchronization,
turn acquisition and history loading. First text, first recipe preview and
complete recipe arrival start at AI dispatch; they are milestones, not separate
durations to add together. Backend measurements distinguish queue waiting,
setup, provider work, recipe/cache persistence, result persistence and cold/warm
container reuse. Provider fallback is recorded. Image requests distinguish
local device metadata hits, backend cache reads and generation requests.
Backend request IDs and Server-Timing are exposed through CORS.

Providers stream JSON. A bounded parser reads only the top-level answer and
safe recipe scalar fields, independently of JSON field order. OpenAI, Groq and
Gemini send previews. Groq fallback clears its previous previews. Final output
still requires the existing complete response validation before persistence,
shopping changes or cooking. Old callers without a recipe-preview callback can
ignore the additive preview events.

AWS delivers coalesced snapshots (250 ms) through authenticated job polling
(350 ms) and a client NDJSON reader. It is progressive display, not a direct
provider-to-browser SSE connection. API authorization and tenant membership
checks still apply. The backend does not write one DynamoDB record per token.
Private AI responses are not cached in CloudFront. If measurements show queue
contention, separating chat and image workers is a subsequent infrastructure
change; this release retains the current queue and concurrency limits.

The chat shows up to six restocking suggestions using the existing suggestion
lifecycle and revision/fingerprint guards: explicitly used up, running low,
then estimated recurring purchases. Items already on the shopping list and
snoozed items remain excluded. Suggestions require approval. The put-away
prompt names the checked items and uses the existing shopping completion path.
