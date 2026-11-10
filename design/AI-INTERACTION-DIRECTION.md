# AI interaction direction — discussion draft, not implemented

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
This release adds crafting only; navigation and the List launch screen remain.
