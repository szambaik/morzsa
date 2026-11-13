# Household recommendations and focused cooking

Implemented 13 November 2026.

- Recommendations receive up to twelve food products purchased on at least two distinct trips in the last sixty days, six explicitly saved favourite recipe titles, current availability, cooking preferences and recent completed recipes. Duplicate trip archives do not increase frequency. Purchase history stays within the active household store; saved recipe favourites stay within the signed-in account.
- Familiar and exploratory chat starters use this context without inventing preferences. The exploratory prompt asks for mostly existing ingredients and at most two clearly missing additions. This is model guidance rather than a hard recipe validator. Suggestions still require user review before household changes.
- Proactive replenishment prioritizes frequently purchased low/out items, excludes existing list entries and respects the existing snooze. Unknown availability never implies absence.
- A new conversation is available beside the main composer. Unsent drafts and photos remain attached to their original conversation.
- Cooking shows one active step, explicit completion progress, a dominant done/next action and an expandable named step outline. Navigation alone does not complete steps. Completion is saved locally per cooking session using an optional field; old saves remain readable. Finishing a step never changes household stock.
- Recipe ingredients distinguish available, low, missing and unconfirmed/stale availability. Missing ingredients can be listed; uncertain items can be confirmed without accidentally removing them. Existing shopping quantities and recipe links use the original shared save paths.
- During cooking the composer names the active step, the desktop history is collapsed behind an entry, and the method/ingredients use a wider desktop layout.
- Generated illustrations are lazy and limited to the current useful step, with at most two selected steps per recipe. The bilingual technique heuristic is intentionally conservative. Existing cache, authentication, quota and manual retry behavior remain. Illustration generation never blocks text. Re-rendering does not automatically retry a missing generation.

Source: Morzsa_Cooking_Experience_UX_Feedback.pdf, supplied by the user. The PDF's proposed first-use tasks are covered by model/save-path tests and local browser walkthroughs; no external agent study or real-household study is claimed.
