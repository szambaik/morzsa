# Compatibility

Prefer backward-compatible changes. Preserve existing local saves (including
the morzsa-v1 fallback), shared record formats, and existing RPC contracts.
Use additive features and migrations where possible so previously deployed
clients can continue to use the same household. Do not reset user data or
silently import a local pantry when joining a shared household.

For data changes, verify old-save loading, preservation of unrelated data,
repeat actions, and concurrent shared updates. If a breaking change is truly
necessary, explain the migration and recovery path before introducing it.

# Product direction

Use PRODUCT-DESIGN-PRINCIPLES.md as the product decision guide. Prefer convenience
and approximate availability over exact inventory bookkeeping. Keep frequent
pantry/list actions quick, explain AI changes, and preserve shared-state safety.
The visual source and adoption notes are in design/README.md.
