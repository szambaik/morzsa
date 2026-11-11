# Morzsa conversations

The main conversation is a stable kitchen companion scoped to the user,
household and language. Cook together opens a focused recipe conversation.
Opening the same recipe resumes its active session. Finishing it places it
under past cooking sessions and records a note in the main conversation.
This never removes pantry ingredients automatically. Cooking it again can
start a new session. Pending proposals must be resolved before switching.

The history drawer groups the main conversation, active cooking sessions,
completed sessions and migrated earlier conversations. Pantry and shopping
shortcuts still operate on the current household. General proactive reminders
are hidden in cooking sessions.

## Persistence and compatibility

The morzsa-companion-v2 local-storage namespace copies v1 conversations on
first use and leaves the original saves untouched. No shared database migration
or pantry import occurs. The app opens the main conversation at startup.
Histories remain private and device-local; household synchronization is unchanged.

Each conversation retains its latest 40 messages. Recipe snapshots are stored
separately and supplied on every cooking request, including voice requests.
There can be 60 secondary conversations plus the main thread. At capacity,
starting a new session fails visibly without deleting existing sessions.
Returning to an active recipe remains possible at capacity.

The optional context.cookingRecipe is validated for companion requests only.
Explicit intent and review are still required for household mutations.
The legacy read-only context.recipe contract is unchanged.

## Next stages

Long-term preference memory, onboarding, a dedicated shopping assistant mode,
guided cooking controls, seasonal tips and live nearby-store search are not
implemented here. Completion notes are history, not learned preferences.
