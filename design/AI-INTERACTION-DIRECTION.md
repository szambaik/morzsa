# AI interaction direction — first integration

Morzsa can make the assistant the shared entry point for household intentions:
“I bought these”, “we ran out”, “what can we cook?”, and ingredient crafting.
The assistant should return useful interactive cards: a proposed pantry change,
a list addition, or a recipe. Those cards open the same underlying pantry, list
and recipe views. All changes still use the existing safe shared-state actions.

Keep shopping checkboxes and product toggles directly usable, fast and offline.
A shopper should never have to compose a message or wait for an LLM to check off
milk. AI is particularly useful for ambiguous, multi-item or exploratory tasks.

A possible next experiment is one consistent text/microphone entry point on
Overview, Pantry and List. It should understand the current household and screen,
show exactly what it proposes to change, and offer a compact undo. Recipe
crafting already provides a visual way to express an intention to that assistant.

Before changing the launch screen or navigation, test with the two household
members: time to check off an item; time to enter a spoken batch; clarity of
which household and records changed; ability to recover a mistaken change.
Navigation and the List launch screen remain.


## Implemented first step

Overview, Pantry and List share a bottom text/microphone entry point. Pantry also
keeps a direct manual search/add shortcut. Existing direct list checkboxes and
quantity controls remain independent of AI, and the List remains the launch view.

The assistant displays the current household scope and lets the user choose the
default pantry/list destination for bare product names. Explicit spoken or typed
instructions override that default. It offers short input starters and direct
pantry-review/recipe shortcuts; answers can open the matching operational view.
The existing model returns bounded proposed product operations that still require
review and Save. Context and in-dialog follow-up history stay within the current
household; the existing close/sign-out guards discard stale responses.

The recipe room remains the dedicated structured recipe conversation. This first
integration does not merge its saved chat into the transient household assistant,
add a cross-device chat history, or let AI make unconfirmed household changes.
