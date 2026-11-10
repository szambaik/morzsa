# Chat-first Morzsa

The chat is now the start screen. Pantry, shopping, recipes and overview remain
available as full screens. Pantry and shopping also open in compact bottom sheets.
Conversation history slides in from the left; new conversations preserve earlier
ones (latest 20, up to 40 messages each).

## Data and compatibility

- Existing morzsa-v1/v2, household records and RPC contracts are unchanged.
- Chats are device-local, keyed by account, household and UI language. They are
  not shared with household members and are not synced across devices.
- A legacy recipe conversation is copied when a scope has no companion history;
  the original recipe chat and favourites remain intact.
- Only the active conversation's last six messages and current household context
  are sent to the AI. Switching accounts/households invalidates pending responses.
- Restored history cannot execute old proposals. New proposals require Save;
  affected-record changes require another review. Unrelated records are preserved.
- Voice keeps the existing recording/permission flow. A chat recording returns its
  answer to the central conversation; audio is not saved in local history.

## Proactive behaviour

Suggestions are deterministic and do not make background AI calls or send push
notifications. Show one suggestion: checked purchases, a recently removed item,
then a product due for a presence check. Review metadata measures confidence, not
expiry. No silent stock deletion. Not now snoozes that suggestion for 24 hours.
After a chat request, unsolicited suggestions pause for ten minutes.

Purchased items can be moved to stock and archived using the existing completion
flow; unchecked items stay on the list. Undo reverses only still-matching records
and the exact archive entry. Stock/list actions retain existing concurrency guards.

## Deployment

The frontend works with the existing voice-command endpoint: older deployments
return text and operations. Structured recipe cards additionally need the updated
function (the companion flag is opt-in; old clients keep the existing schema):

    npx supabase functions deploy voice-command --project-ref cbgcugshwivxpaurzyqq

No SQL migration, new secrets, provider or user configuration is required. The
existing GEMINI_API_KEY, VOICE_MODEL, origins, authentication and quota apply.

    npm test
    python3 -m unittest discover -s tests -p 'test_*.py'
    npm run build:web
    npm run sync:mobile

For isolated manual browser QA without cloud writes or paid AI requests:

    python3 tests/companion-fixture.py

Open http://127.0.0.1:8777/ (test storage is isolated by origin).
