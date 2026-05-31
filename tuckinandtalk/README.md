# Tuckin and Talk Analytics

A standalone Instagram analytics dashboard for the **@tuckinandtalk** account. It
pulls performance data from the Instagram Graph API into Supabase and presents it
across five focused pages: account health, per-post metrics, hashtag tiering, and
competitor benchmarking.

It is a sibling of the parent `instagram-post-refiner` app and runs on **port
3001** alongside it (parent is on 3000), sharing the same Supabase project and
Facebook app. All of its database tables are namespaced with a `tat_` prefix so
the two apps coexist cleanly.

## What it does

| Page | What it shows |
|------|---------------|
| **Dashboard** | Weekly account snapshot — reach, views, accounts engaged, followers, with week-over-week deltas; reach split by follower/non-follower; views split by feed/reels/stories |
| **Posts** | Per-post metrics table — reach, views, saves, shares, interactions, plus Reels skip rate and average watch time |
| **Hashtags** | Configured hashtags with their tier (LOCAL/…); monthly audit medians (likes, comments, engagement) per hashtag |
| **Competitors** | Tracked competitor handles benchmarked via Instagram Business Discovery — follower count, media count, median engagement rate |
| **Settings** | Connected account + token status; add/remove hashtags and competitors; manual sync triggers |

Data is collected by scheduled jobs (see [Scheduled sync](#scheduled-sync)) and
can also be triggered manually from Settings.

## Tech stack

- **Next.js 16** (App Router, Turbopack) / **React 19**
- **Supabase** (PostgreSQL, RLS-locked, service-role access server-side)
- **Instagram Graph API v25.0** (`graph.facebook.com`) — Business Login token
- Self-hosted on a Linux VM behind a Cloudflare Tunnel (same VM as the parent app)

## Architecture

- **Auth.** Every route is gated by HTTP Basic Auth in `middleware.js`
  (`TAT_ADMIN_USER` / `TAT_ADMIN_PASS`). Two exceptions: `/api/auth/*` (the OAuth
  flow, which must be publicly reachable) and any request carrying a valid
  `x-cron-secret: $TAT_CRON_SECRET` header (used by the schedulers).
- **Supabase.** Server code uses the service-role key (`lib/supabase-server.js`),
  which bypasses RLS. All `tat_*` tables have RLS enabled with a deny-all policy
  for the anon role, so the anon key can never read them.
- **Instagram client.** `lib/instagram.js` wraps the Graph API with a Bearer-token
  fetch helper that auto-refreshes the long-lived token on 401 / OAuthException
  and hands the new token back so callers can persist it to `tat_accounts`.
- **Token lifecycle.** Long-lived tokens last ~60 days. Sync endpoints refresh
  proactively when fewer than 7 days remain, and the nightly job refreshes
  unconditionally as a backstop.

## Database

Seven tables, all `tat_`-prefixed, RLS-locked (schema in `schema.sql`):

| Table | Purpose |
|-------|---------|
| `tat_accounts` | OAuth token + account info for @tuckinandtalk |
| `tat_weekly_snapshots` | Weekly account-level metrics (unique on `week_start`) |
| `tat_post_metrics` | Per-post insights (unique on `instagram_media_id`) |
| `tat_hashtag_config` | Hashtags to audit, with tier |
| `tat_hashtag_audits` | Monthly audit results per hashtag |
| `tat_competitor_config` | Competitor handles to track |
| `tat_competitor_snapshots` | Monthly competitor benchmarks (unique on `username, snapshot_date`) |

## API routes

All under `app/api/`. UI-facing reads and cron-facing writes share the same
endpoints; writes are also reachable with the `x-cron-secret` header.

**Reads:** `GET /api/account`, `GET /api/dashboard/snapshots`,
`GET /api/posts/list`, `GET /api/hashtags`, `GET /api/competitors`,
`GET /api/insights/weekly`.

**Sync / writes:**
- `GET /api/insights/posts` — fetch & upsert per-post metrics (posts older than 48h)
- `GET /api/insights/weekly` — fetch & upsert this week's account snapshot
- `POST /api/token/refresh` — refresh the stored long-lived token
- `POST /api/competitors/snapshot` — Business Discovery for each active competitor (upsert per day)
- `POST /api/hashtags/audit` — hashtag top-media audit (≤30 unique tags / 7-day window, Meta limit)

**OAuth (public):** `GET /api/auth` (start), `GET /api/auth/callback`.

**Cron fan-out:** `GET /api/cron/nightly`, `GET /api/cron/monthly` — see below.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3001
```

### Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — **server-only**, bypasses RLS |
| `INSTAGRAM_APP_ID` | Facebook app ID (shared with parent) |
| `INSTAGRAM_APP_SECRET` | Facebook app secret (shared with parent) |
| `TAT_INSTAGRAM_REDIRECT_URI` | OAuth callback URL for this app |
| `TAT_ADMIN_USER` / `TAT_ADMIN_PASS` | HTTP Basic Auth credentials |
| `TAT_CRON_SECRET` | Shared secret for the `x-cron-secret` header used by schedulers |

### First-time setup

1. Apply `schema.sql` to Supabase (MCP `apply_migration` or `psql`).
2. Start the app, open Settings, and connect the @tuckinandtalk Instagram account
   via the OAuth flow.
3. Add hashtags and competitor handles in Settings.
4. Trigger a manual sync, or wait for the scheduled jobs.

## Scheduled sync

Two cron endpoints fan out to the sync routes via internal fetch, each gated by
`x-cron-secret`:

- **`GET /api/cron/nightly`** → post-insights, weekly-insights, token-refresh.
  Idempotent (upsert by media id / week_start). Runs **03:30 UTC** — 30 min after
  the parent logger's 03:00 sync, to avoid Meta API contention.
- **`GET /api/cron/monthly`** → competitor-snapshot, hashtag-audit. These insert
  dated rows, so they run **monthly** (1st, 04:00 UTC) to respect Meta's hashtag
  search limit (30 unique tags / 7 days) and keep the audit tables tidy.

Manual trigger:

```bash
source .env.local
curl -fsS -H "x-cron-secret: $TAT_CRON_SECRET" http://localhost:3001/api/cron/nightly
curl -fsS -H "x-cron-secret: $TAT_CRON_SECRET" http://localhost:3001/api/cron/monthly
```

## Deployment

Systemd units, timers, and a deploy script live in `deploy/`. See
[`deploy/README.md`](deploy/README.md) for the full VM setup and routine-deploy
steps.

```bash
npm run build && npm start   # production, port 3001
```

## Meta API notes

- **Business Discovery** (competitor benchmarking) requires the target to be a
  public Business or Creator account, and the query must pass the handle via
  `business_discovery.username(HANDLE){…}` — the `.fields(…)` form fails with
  `(#100) The parameter username is required`.
- **Hashtag search** is capped at 30 unique hashtags per IG user per rolling
  7-day window; the audit endpoint tracks usage and refuses to exceed it.
- **Rate limits.** ~200 Graph API calls per user per hour. Sync loops insert
  deliberate delays between calls.
