# Recipe room and daily overview

Four destinations: Overview, Pantry, List, Recipes. The List remains the launch
screen. Overview offers one next action, pantry review when due, the existing
household assistant, the last real shopping trip, and one recipe suggestion.
It does not invent household member activity.

Recipes is a conversation with illustrated recipe cards. The quick prompts are
ordinary editable conversation requests; subsequent messages carry a bounded
recent conversation and recipe context. Cards offer favourites, full recipes and
an explicit action to add missing ingredients. Ingredient illustrations are
bundled Morzsa artwork, not generated photographs of the finished meal.

## Compatibility and storage

- Existing stock/cart/history/likes/chats and morzsa-v1 fallback are unchanged.
- Curated recipe favourites continue to use existing likes.
- Generated favourites use morzsa-recipe-favourites-v1 per account on this device.
  Up to 100 recipes can be stored; reaching the limit does not remove favourites.
- The last 20 conversation messages use morzsa-recipe-room-v1 scoped by account,
  household and language on this device. New chat explicitly confirms replacement.
- These new device-local records are not synced between household members.
- AI output never mutates household data. Adding missing ingredients is explicit,
  uses default shopping units, skips items at home or already on the list, and
  preserves a partner's concurrent additions through an optional onlyIfMissing
  cart intent. Older intents retain their behavior.

## Backend

The existing authenticated recipe-ideas function supports an additive
conversation:true mode: text, bounded history (user/model), names, uncertain,
language, preferences. It returns answer plus zero to three structured recipes.
Legacy requests retain the three-recipe response contract. Existing quota, RLS,
private cache and server-held Gemini key remain in force. No schema migration or
new API key is required on an already configured installation.

## Validation

npm test covers schema limits, conversation history, legacy requests, cache
separation, account/household keys, idempotent list additions and concurrent cart
edits. Browser journeys in tests/recipe-ai.browser.js use a mocked provider;
they are separate from npm test. No image-generation provider is connected.
