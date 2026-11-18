# Household loading and header recovery

When the initial shared-household request failed, the app kept showing its
separate device-local pantry/list. Being signed in did not mean that a shared
kitchen had loaded. Subsequent network/resume events refreshed only an already
active household, so an unsuccessful initial connection could remain local.
The conversation-history sync indicator is separate from household loading.

The client now retries initial household selection on connectivity, focus and
foreground changes. Loading and failure messages explain which data is visible;
failed shared reads have an explicit Retry action. Successful recovery removes
the failure indicator. An explicit device-local kitchen selection still persists.
Malformed preferences can recover through the accessible household list. A late
household response is rejected if the signed-in account changed.

PostgREST JWT rejection codes PGRST301/PGRST303 trigger one shared token refresh
and one retry. This also covers a server rejecting a token before the device's
cached expiry time. The refresh saves to the existing native vault and preserves
the sign-out/account-change guard. Provider requests are not replayed. Error
status/code metadata remains available to callers. Expired-token recovery is a
tested failure case; the original phone's precise network/auth error was not
captured, so this does not establish that its token had expired.

Live checks subsequently reproduced timeouts for both anonymous and privileged
empty reads through the production data API while Auth and database management
queries responded. A project restart was accepted through the official
Management API. No table or record was changed by the recovery operation.

The mobile header is transparent at the top of each screen so the page's warm
gradient continues behind the brand. After scrolling, a translucent blurred
surface protects header readability. Safe-area spacing and native geometry stay
in their existing owners.

No storage/RPC format changes, database migrations or pantry/list writes are
required. Existing morzsa-v1/v2 saves, household caches, preferences and outboxes
remain intact. A read-only investigation verified that the reported household
and its records still existed in production and in the phone's cache.

Validation: 392 JavaScript tests and existing SQL suites passed; the new isolated
Chromium/WebKit recovery suite passed 86 checks. It covers failed household and
record reads, automatic and manual retries, repeated resume, explicit local
selection, legacy saves, malformed preferences, concurrent token refresh,
bounded rejection, native secure saves, sign-out races and header states across
all five destinations at 320/390 pixels. It asserts that recovery performs no
pantry/list writes. The suite is included in the required release gate. The
signed Debug iOS device build succeeded.
