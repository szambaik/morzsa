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
