# Supabase Auth transition boundary

Supabase Auth now supplies cookie-based SSR sessions and verified JWT claims for the root app shell. `proxy.js` refreshes sessions, accepts verified claims, preserves `x-cron-secret` automation, and leaves Meta webhooks public for their route-level HMAC verification.

This is authentication, not complete tenant authorization:

- Root data API routes still use `SUPABASE_SERVICE_ROLE_KEY` and bypass RLS.
- Those handlers do not yet re-check the authenticated subject or scope rows to an owner/team.
- Proxy is a coarse gate, not the final authorization layer for sensitive handlers.
- Existing HTTP Basic Auth remains a temporary fallback during operator migration.
- Signup is server-denied unless `SUPABASE_AUTH_SIGNUP_ENABLED=true`; enabling it intentionally permits self-registration when Supabase email signup is also enabled.

Before multi-user or tenant use: apply and backfill the staged ownership migration, validate `getClaims()` in each sensitive Route Handler/Server Action, authorize through database membership, add workspace/account filters to every service-role query, then remove Basic Auth fallback. Never authorize from `user_metadata`.
