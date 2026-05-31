# tuckinandtalk — Developer Guide

Standalone Instagram analytics app for **@tuckinandtalk**. Sibling of the parent
`instagram-post-refiner` (one level up); runs on **port 3001**, shares its
Supabase project and Facebook app. User-facing docs are in `README.md` — this
file is for working in the code.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · Supabase (PostgreSQL) ·
Instagram Graph API v25.0 (`graph.facebook.com`). No test suite. No lint config
beyond `eslint-config-next`. Verify changes with `npm run build`.

```bash
npm run dev     # port 3001
npm run build   # use this to validate — there are no tests
```

## Layout

```
app/
  (app)/            route group, shares Sidebar layout
    dashboard|posts|hashtags|competitors|settings/page.js
  api/
    account, dashboard/snapshots, posts/list      # reads
    insights/posts, insights/weekly               # daily sync (GET)
    token/refresh                                 # POST
    competitors[, /snapshot], hashtags[, /audit]  # config + monthly sync
    auth[, /callback]                             # OAuth (public)
    cron/nightly, cron/monthly                    # scheduler fan-out (GET)
  components/        Sidebar, MetricCard, SkipRateBadge
lib/
  instagram.js       Graph API wrapper (all Bearer-header, auto token refresh)
  supabase-server.js service-role client (server-only, bypasses RLS)
  utils.js           delay, median, date helpers, hashtag tier
middleware.js        Basic Auth gate (+ x-cron-secret / /api/auth bypass)
schema.sql           full tat_ schema
deploy/              systemd units + timers + update.sh (see deploy/README.md)
```

## Conventions

- **JS, ES modules, no TypeScript.** Relative imports with `.js` extensions
  (`../../../lib/utils.js`) — App Router server files require the extension.
- **API responses:** `{ success: true, ... }` or `{ success: false, error }`
  with an appropriate HTTP status. Keep this shape; the UI checks `data.success`.
- **camelCase** vars/functions, **PascalCase** components. Inline styles +
  `globals.css` (CSS vars, warm terra/mustard theme). No UI library.
- Comments only for non-obvious logic.

## Auth model

`middleware.js` gates every route with HTTP Basic Auth
(`TAT_ADMIN_USER`/`TAT_ADMIN_PASS`). Two bypasses:
1. `/api/auth/*` — public (OAuth must be reachable pre-login).
2. `x-cron-secret: $TAT_CRON_SECRET` header — used by the schedulers and by every
   internal fan-out fetch from the cron routes.

Sync endpoints are intentionally usable from both the UI (browser carries Basic
Auth) and cron (carries the secret) — don't add a separate auth layer inside them.

## Data layer

- Service-role client only (`lib/supabase-server.js`). It **bypasses RLS** — never
  expose it or the service-role key to the browser; never add `NEXT_PUBLIC_` to it.
- All 7 tables are `tat_`-prefixed with RLS on + deny-all anon policy. Schema in
  `schema.sql`; changes are applied to Supabase as migrations (MCP
  `apply_migration`) **and** mirrored into `schema.sql` for fresh deploys.
- Idempotency keys (don't break these — sync reruns rely on them):
  - `tat_weekly_snapshots` upsert on `week_start`
  - `tat_post_metrics` upsert on `instagram_media_id`
  - `tat_competitor_snapshots` upsert on `(username, snapshot_date)`
  - `tat_hashtag_audits` / `tat_accounts` have their own unique constraints

## Instagram client (`lib/instagram.js`)

- Single `GRAPH_BASE` (`graph.facebook.com/v25.0`). Uses Business-Login tokens
  (EAA), Authorization Bearer header — not query-param tokens.
- `graphFetchWithRefresh` auto-renews the long-lived token on 401 / OAuthException
  and returns `{ data, newToken, expiresIn }`. Callers **must** persist `newToken`
  back to `tat_accounts` when non-null (every sync route already does this).
- Tokens last ~60 days; routes refresh proactively when `daysUntil < 7`, and
  `cron/nightly` refreshes unconditionally as a backstop.

## Scheduling

`cron/nightly` (03:30 UTC) → insights/posts, insights/weekly, token/refresh.
`cron/monthly` (1st, 04:00 UTC) → competitors/snapshot, hashtags/audit.
Both gated by `x-cron-secret`, fan out via internal `fetch` to the real endpoints,
and summarize per-task results. Monthly tasks INSERT/upsert dated rows, so they
stay monthly — moving them to nightly would burn the Meta hashtag-search budget.

## Meta API gotchas

- **Business Discovery** query must pass the handle inline:
  `business_discovery.username(HANDLE){fields}`. The `.fields(...)` form fails
  with `(#100) The parameter username is required` (fixed once already).
- **Hashtag search:** 30 unique tags / IG user / rolling 7 days. `hashtags/audit`
  tracks usage and refuses past the cap (429) — keep that guard.
- **Rate limit:** ~200 calls/user/hour. Sync loops use `delay()` between calls;
  keep the delays when adding work to a loop.
- Some media-level metrics (follows, profile_visits, per-post follow_type) are
  unavailable under Standard/Dev access — code degrades to null, don't treat
  missing metrics as errors.

## Environment

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`,
`TAT_INSTAGRAM_REDIRECT_URI`, `TAT_ADMIN_USER`, `TAT_ADMIN_PASS`,
`TAT_CRON_SECRET`. Template in `.env.example`; real values in `.env.local`
(gitignored).
