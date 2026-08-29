# Technical Reference

Setup, hosting, schema and architecture for Voice Workshop. `README.md` is the user
guide; `CLAUDE.md` holds the rules an agent needs every session. This file is the
detail neither of those should carry.

Counts here were verified against the repo on 2026-08-14: **50 API routes, 20 pages,
17 application tables** (plus 3 more from the tenant migration). If you change the
shape of the app, recount rather than editing these numbers to look right.

---

## Contents

- [Stack](#stack)
- [Local setup](#local-setup)
- [Environment variables](#environment-variables)
- [Authentication](#authentication)
- [Instagram integration](#instagram-integration)
- [Self-hosting](#self-hosting)
- [Migrations](#migrations)
- [API surface](#api-surface)
- [Database schema](#database-schema)
- [Architecture decisions](#architecture-decisions)
- [Testing](#testing)

---

## Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.2.10 | Full-stack React framework (App Router) |
| React | 19.2.7 | UI components |
| Supabase JS | 2.86.0 | PostgreSQL, Auth, Storage, Row Level Security |
| Supabase SSR | 0.8.0 | Cookie-based server authentication |
| Instagram Graph API | v21.0 | Post metrics, account insights, Stories |
| Vercel Analytics | 2.0.1 | Web Vitals |
| Jest | 30.2.0 | Unit tests |

Node.js 20.9 or newer.

---

## Local setup

```bash
git clone https://github.com/theglove44/instagram-post-refiner.git
cd instagram-post-refiner
npm install
```

**Database.** Create a project at [supabase.com](https://supabase.com), run the three
`lib/supabase-schema*.sql` files in the SQL Editor, then copy the project URL, anon key
and service-role key from **Settings → API**. Create the first operator account in
Supabase Auth and leave public signup disabled.

**Environment.** `cp .env.example .env.local` and fill it in — see below.

**Run.**

```bash
npm run dev     # http://localhost:3000
npm run build && npm start   # production
```

---

## Environment variables

```env
# Required
APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-long-random-cron-secret

# Authentication
SUPABASE_AUTH_SIGNUP_ENABLED=false
ADMIN_USER=admin
ADMIN_PASS=temporary-basic-auth-fallback

# Optional — only needed for the cold Instagram features
INSTAGRAM_APP_ID=your-facebook-app-id
INSTAGRAM_APP_SECRET=your-facebook-app-secret
INSTAGRAM_REDIRECT_URI=https://your-domain.com/api/instagram/callback
WEBHOOK_VERIFY_TOKEN=token-set-in-the-meta-dashboard
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never give it a `NEXT_PUBLIC_` prefix — it
bypasses Row Level Security entirely.

Hosting details, SSH credentials and Facebook app configuration are not in the repo.

---

## Authentication

`proxy.js` gates every request. The order matters:

1. `/api/webhooks/*` — public. Meta calls it server-to-server and cannot send our
   credentials; POST bodies are verified by HMAC-SHA256 instead.
2. `x-cron-secret` matching `CRON_SECRET` — used by systemd timers and internal
   cron-to-cron calls.
3. `/login` and `/auth/callback` — open, so signing in is possible without a session.
4. Supabase Auth session, verified with `getClaims`. `getSession` is deliberately not
   trusted because it does not verify the JWT.
5. HTTP Basic against `ADMIN_USER` / `ADMIN_PASS` — a transitional fallback to be
   deleted once every operator has a Supabase Auth account.

Session plumbing lives in `lib/supabase-auth/` (`browser.js`, `server.js`,
`middleware.js`). There is no Next.js `middleware.js` at the project root.

---

## Instagram integration

Only needed for the cold analytics and publishing features. The daily editing workflow
does not touch Instagram at all.

1. Create an app at [developers.facebook.com](https://developers.facebook.com).
2. Add the **Instagram Graph API** product.
3. Request `instagram_basic`, `instagram_manage_insights` and `pages_show_list`.
4. Set the Valid OAuth Redirect URI to
   `https://your-domain.com/api/instagram/callback`.
5. Put the app ID, secret and redirect URI in the environment.
6. Open **Settings** in the app and connect the account.

Requires an Instagram Business or Creator account connected to a Facebook Page.

**Rate limits.** The Graph API allows roughly 200 calls per user per hour. A metrics
refresh costs 2 calls per post. The app stays inside that with background processing,
a nightly backfill capped at 50 posts, and a rolling 7-day refresh window. Token
refresh happens automatically on a 401 via `graphFetchWithRefresh` in
`lib/instagram.js`.

---

## Self-hosting

Runs on a self-hosted VM behind a Cloudflare Tunnel. Serverless was ruled out by
response timeouts — Vercel caps at 10 seconds, Cloudflare at 100 — which bulk imports
and metrics refreshes exceed.

**Service** — `/etc/systemd/system/instagram-logger.service`:

```ini
[Unit]
Description=Voice Workshop
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/instagram-post-refiner
ExecStart=/usr/bin/npm start
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now instagram-logger
```

**Tunnel:**

```bash
cloudflared tunnel create instagram-logger
cloudflared tunnel route dns instagram-logger your-domain.com
```

`/etc/cloudflared/config.yml`:

```yaml
tunnel: your-tunnel-id
credentials-file: /etc/cloudflared/your-tunnel-id.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

**Timers.** Unit files live in `deploy/`: nightly metrics sync (3am UTC), account
snapshot, new-post polling (15 min), and the publish scheduler. Install the ones you
need:

```bash
sudo cp deploy/instagram-*.service deploy/instagram-*.timer /etc/systemd/system/
sudo systemctl enable --now instagram-metrics-sync.timer
```

The publish scheduler timer processes scheduled posts and will post to the live
account. Leave it disabled unless publishing is deliberately switched back on.

**Deploy:** `bash deploy/update.sh` — pull, install, build, restart.

---

## Migrations

Staged migrations and their runbooks are in `lib/migrations/`. Two matter:

**Training-data origin** (`20260711_add_posts_origin.sql`). Classifies historical rows
before any code writes explicit origins. Back up `posts`, run the SQL, deploy, then
dry-run the edit-count recalculation:

```bash
npm run recalculate:edit-counts
```

Review the report, then during a maintenance window:

```bash
npm run recalculate:edit-counts -- --apply --confirm=RECALCULATE_EDIT_COUNTS
```

It never writes by default, and only touches rows marked `training_pair` —
imported Instagram history is left alone.

**Tenant/workspace foundation** (`2026-07-12-tenant-workspace-foundation.sql`). Adds
`profiles`, `workspaces`, `workspace_members`, nullable tenant keys, indexes and
membership RLS. It does not guess owners or rewrite rows. Keep tenant columns nullable
until every route and cron write supplies them. Follow the bootstrap procedure in
`lib/migrations/README.md`.

---

## API surface

50 routes under `app/api/**/route.js`, grouped by domain. Read the directory for the
authoritative list — an exhaustive table here goes stale within weeks.

| Group | Path prefix | What it covers |
|---|---|---|
| Logging | `/api/log`, `/api/posts` | Save and retrieve post pairs; link and match to Instagram |
| Captions | `/api/caption/generate` | AI draft generation using the voice pack |
| Analysis | `/api/analyse` | Editing analytics and training-data export |
| Hashtags | `/api/hashtags` | Usage analytics and the curated library |
| Instagram | `/api/instagram/*` | OAuth, metrics, insights, snapshots, growth, import |
| Publishing | `/api/publish/*` | Drafts, scheduling, immediate publish, media upload |
| Engagement | `/api/comments/*`, `/api/mentions/*` | Comment inbox, replies, mentions |
| Webhooks | `/api/webhooks/instagram` | Meta verification and live events |
| Cron | `/api/cron/*` | Nightly sync, new-post polling, publish scheduler, cleanup |

Responses are `{ success: true, ... }` or `{ success: false, error: "message" }`.
Long operations return `{ success: true, syncId, status: "running" }` and are polled
via `/api/instagram/health`.

---

## Database schema

17 tables across three files, all with Row Level Security enabled. Server code uses
the service-role key and bypasses RLS, so the auth gate — not RLS — is what protects
the data.

**Core** (`lib/supabase-schema.sql`) — 9 tables:

| Table | Purpose |
|---|---|
| `posts` | Logged pairs: AI draft, final version, edit count, optional Instagram link |
| `post_metrics` | Per-post engagement: reach, views, likes, comments, saves, shares |
| `instagram_accounts` | OAuth tokens, expiry, connected Facebook Page |
| `sync_status` | Background job progress and error detail |
| `account_insights_cache` | Cached account-level insights (JSONB) |
| `account_snapshots` | Daily follower count and 28-day reach |
| `match_suggestions` | Post-to-Instagram matches with confidence scores |
| `hashtag_library` | Curated hashtags with categories and notes |
| `story_metrics` | Stories performance |

**Engagement** (`lib/supabase-schema-engagement.sql`) — 4 tables: `comments`,
`mentions`, `webhook_events`, `engagement_counts` (badge counters incremented via the
`increment_engagement_count()` RPC).

**Publishing** (`lib/supabase-schema-publishing.sql`) — 4 tables: `scheduled_posts`,
`media_uploads`, `caption_templates`, `publishing_log`.

**Tenant migration** adds 3 more: `profiles`, `workspaces`, `workspace_members`.

---

## Architecture decisions

**Self-hosted over serverless.** Bulk imports and rate-limited Graph API work need
long-running processes; serverless response timeouts make them impractical.

**Fire-and-forget background processing.** Long operations return immediately and
continue in the background, tracked in `sync_status` and polled by the frontend. This
exists because of Cloudflare's 100-second ceiling, not as a general preference.

**Nightly automation over real-time sync.** Metrics are refreshed by cron rather than
on page load, which keeps the app well inside the rate limit.

**Route groups with sidebar layout.** The `(app)` group wraps pages in the sidebar
without affecting URLs. The root `page.js` redirects to `/edit`.

**Client-side diff.** The diff runs in the browser, so editing stays responsive with
no server round-trip.

**Tenant migration is staged.** Routes and cron jobs still run as the service role.
The workspace schema and membership RLS exist but existing rows have no owner
backfill, so nothing should assume a tenant context yet.

**Reel vs Post.** A Reel is `media_product_type = 'REELS'` or `media_type = 'VIDEO'`
without a FEED product type. Everything else is a Post.

**Dates.** `published_at` is primary for analytics and sorting; `created_at` is the
fallback for posts not linked to Instagram.

**Query limits.** Supabase caps results at 1000 rows by default. Endpoints returning
large sets use `.limit(5000)`; anything larger needs explicit pagination.

---

## Testing

```bash
npm test          # jest
npm run test:watch
npm run build     # catches what jsdom tests miss
```

23 test files. The house patterns — chainable Supabase mocks, the `global.Response`
stub jsdom requires, and the rule that no test may reach a live service — are
documented in `CLAUDE.md`. Read that before writing a new one.
