# Chat photos

The authenticated voice-command function accepts one JPEG image (mimeType and
base64 data) alongside text. GET advertises supportsImages: true. Old audio/text
requests and household records are unchanged. New clients check this capability
before sending. No new key or migration is needed: Gemini and the voice quota
are reused. The configured model must support image understanding.

The client accepts JPG, PNG and WebP up to 12 MB, re-encodes to JPEG, removes
embedded metadata, and limits the longest side to 1280 pixels. Only pressing
Send transmits the photo through the Edge Function to Google. The app does not
store original photos in Supabase. Provider data handling depends on the Google
API plan.

Local history retains small thumbnails, at most 30 per account/household/language
scope. Original photos are not re-sent in follow-up history. A failed send keeps
the prepared photo in memory for Retry; switching conversation, account or home
clears it. A photo without a written command asks for identification. Proposed
changes still require explicit review/save and support the existing undo flow.

Recipe cards match five curated dish families. Others retain ingredient artwork.
Photos are labelled illustrations, not images of the exact AI recipe. Each
photo includes attribution; full credits are in assets/food/README.md.

Deploy with: supabase functions deploy voice-command --project-ref
cbgcugshwivxpaurzyqq --use-api

Verification: npm test, Python server tests, npm run build:web and npm run
sync:mobile. tests/companion-fixture.py tests photo selection, preview, send and
history without Google requests or shared-household writes. A signed-in live
photo request is a separate smoke test.

## Generated recipe images: proposed integration (not enabled)

Use a separate authenticated image job, independent of voice-command/text
streaming. Recommended model as of 2026-11-11: gemini-nano-banana-2.1 at 1K.
Google lists $0.0336 per 1K output image, plus input and text/thinking tokens;
there is no free API tier for this model. Cover plus four steps costs about
$0.168 in image output. Billing must be configured by the project owner.

Generate the cover after the text recipe arrives. Generate useful visual steps
only when guided cooking is requested, prefetching the next step. Derive prompts
from the canonical recipe quantities and steps; reuse prior reference images
for consistent ingredients, cookware and presentation. Label generated images
as illustrations. Save assets in household-isolated Supabase Storage and cache
by recipe version, step and style. Keep an image failure separate from chat.

Before enabling: implement authenticated jobs, Storage policies, atomic quota
reservation and idempotency, concurrency limits, retry limits and a hard daily
app spending cap. Do not expose the Google key to the frontend. Cloud billing
alerts alone are not a spending cap. Existing chat/photo APIs remain compatible.

Sources: https://aistudio.google.com/docs/image-generation and
https://aistudio.google.com/docs/pricing

## Chat latency and inline recipes

voice-command now gives the primary model eight seconds to return headers
before trying its fallback, within a shared thirty-second deadline. Gemini 3
models use minimal thinking. Logs contain timing/model/status, not prompts.
Once streaming starts, partial output is never replayed through another model.
The UI retains an interrupted answer for review without applying partial changes.

Recipe ingredients, availability, shopping-list actions and method expand inside
the conversation. Cooking threads show the same controls inline, with a collapse
button. The legacy recipe dialog remains a fallback for clients without the
companion interface. No household schema or saved-history migration is required.

### Provider overload after streaming headers

Google can return HTTP 200, start SSE output and then emit an error event with
code 503/UNAVAILABLE. This is overload, not request rejection or quota exhaustion.
Stream errors now retain the busy/limit distinction and log only the numeric
code plus an allowlisted status. Provider error messages are never logged.

The second model attempt uses generateContent, then adapts the buffered result
to the existing stream protocol. The primary still streams. The two-attempt,
thirty-second bound and final output validation remain unchanged; clients need
no migration. Fallback output arrives at once, rather than token by token.

Production diagnostic on 2026-11-11 reproduced a Gemini 3.5 Flash Lite streaming
503. The updated buffered fallback completed two synthetic recipe requests with
valid output in 2.0s and 2.8s. This does not guarantee provider availability;
buffered requests can also encounter overload.
