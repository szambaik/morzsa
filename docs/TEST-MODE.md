# Morzsa test mode

The server-owned flag is `public.morzsa_runtime_settings.usage_limits_enabled`.
Migration `20261117_plus_reservations.sql` defaults it to **true**. Production was
explicitly set to **false** on 2026-11-17 at the owner's request.

When false:

- Morzsa skips its monthly Plus budget and chat/image/voice request-count limits.
- Free chat, recipe suggestions and image jobs do not advance daily counters.
- Realtime skips its per-call estimated-cost cutoff. Its existing session
  duration, cleanup, authentication and provider restrictions still apply.
- Plus request IDs, image leases and voice call IDs remain for deduplication
  and cleanup. Rows have `usage_counted=false` and never consume a later
  allowance. Provider token metadata is diagnostic.
- Entitlements, global enable/disable, membership checks and the single-active-
  voice-session guard remain. Browsers cannot set this flag.

OpenAI, Groq and Cloudflare billing/limits are independent of this setting.
This switch does not make paid provider calls free.

Use the Supabase SQL editor or an authorized admin connection:

```sql
-- Test mode: pause Morzsa counters and allowance enforcement.
update public.morzsa_runtime_settings
set usage_limits_enabled = false where singleton;

-- Resume counting and existing limits, without migration/redeploy.
update public.morzsa_runtime_settings
set usage_limits_enabled = true where singleton;
```

Old rows are preserved. Failed requests with no recorded charge release their
reservation; known recorded costs still count. Historical voice/image reserves
are conservative estimates, not an OpenAI invoice. New voice calls settle
observed response usage when available, even if hangup cleanup fails.

Validation: `node --test tests/usage-limits.test.cjs tests/plus-assistant.test.cjs`.
The SQL test covers off/on, request and budget caps, all four Free quota paths,
private admin settings, missing grants, duplicate calls and image leases.
