# Keeping the pantry useful

Presence is an approximation. A stale confirmation triggers a visible check, not
an expiry claim or silent deletion. Existing numeric presence values and local
save fallback remain unchanged.

- At-home product cards have an explicit Used up action with record-aware undo.
- Pantry and Overview surface pending checks and a What ran out? batch action.
- Batch removal can also put items on the list. Existing quantities are retained;
  already absent products are skipped and repeat actions are idempotent.
- Review starts with shorter-lived categories. Windows retain the established
  values: 5 days for produce/bakery, 7 for dairy/meat/fish/plant-based, 30 for
  frozen, 60 for other foods. These are confidence reminders, not safety dates.
- The guided check offers Used up, Used up and list, and Still have it. A removal
  can be undone within the guided flow as well as from the normal toast.
- Batch selections and review actions are checked against the current stock and
  revision/confirmation snapshot. A changed selection requires a fresh review.
- Shared writes reuse existing RPC revision checks and rollback on conflicts;
  pending shopping sync prevents a pantry write from replacing the pending edit.

No new database migration or backend function deployment is required.
