# Responsive shopping edits

The shopping screen is the default on launch. Checkbox, +/- quantity, removal and quick-entry changes update local UI immediately. Checkbox/quantity edits update existing row nodes instead of replacing the list or input. Administrative options live under the title's overflow menu; rows are 46px high with 44px controls.

Shared edits are represented as ordered, field-level intentions in a device-local outbox, keyed by account and household. A 120ms window collects rapid changes; only one existing apply_household_changes RPC runs at a time. New edits remain usable while the request or a background read is in flight. Completion and unrelated destructive operations wait until the shopping outbox has drained.

The server still enforces membership, RLS, per-record revisions and atomic transactions. On revision conflict the client fetches the latest values and retries up to three times, applying only the intended fields. A check therefore preserves a partner's quantity change. Two edits to the same field follow server application order. Updating an item remotely removed does not recreate it; explicit additions can create items.

After a network error, pending intentions remain in localStorage and on screen, with a Retry action. Reloading the same account/household restores and retries them. Going online retries as well. Leaving a household or signing out when no request is in flight keeps its pending outbox scoped to that account/household for a later return. Pending data is not shown as synchronized. This is not a general offline-first implementation for pantry or archive operations.

Background reads overlay in-flight intentions; they cannot roll back newly checked rows. Checkbox focus no longer indefinitely delays Realtime refreshes. Text entry and open dialogs still defer passive updates. Localization now visits changed DOM regions rather than traversing every hidden dialog and the whole document after each edit.

No schema/RPC changes or data migrations. Existing local saves and older shared clients remain supported.
