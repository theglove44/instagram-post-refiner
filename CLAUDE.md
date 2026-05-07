# Instagram Post Logger v3.0 - Developer Guide

Last Updated: May 2026

## Project Overview

Instagram Post Logger is a web application for tracking Instagram post edits, creating training data for voice refinement, and analysing Instagram performance metrics. It combines a content editing workflow with full Instagram Graph API integration for performance analytics, a full publishing pipeline, and an engagement hub for comments and mentions.

**Core capabilities:**
- Paste Claude-generated posts, lock the original, edit to match your voice, log both versions as training data
- Connect an Instagram account via OAuth and pull real performance metrics
- Smart matching links logged posts to published Instagram posts
- Performance analytics across 6 focused dashboards (health, posts, timing, content, hashtags, audience)
- Full publishing pipeline: compose, schedule, draft, publish to Instagram with media upload
- Engagement hub: comment inbox, mentions tracker, webhook-driven real-time updates
- Nightly automated sync: snapshots, backfill, metrics refresh, comment/mention sync

## Technology Stack

- **Next.js 16.2.5** - Full-stack React framework (App Router)
- **React 19.2.0** - UI library
- **Supabase 2.86.0** - PostgreSQL database
- **Instagram Graph API v21.0** - Post metrics, account insights, stories
- **Vercel Analytics 2.0.1** - Performance monitoring
- **Self-hosted** on Ubuntu 25.04 VM via Cloudflare Tunnel

## Project Structure

```
app/
├── layout.js                       # Root layout with Analytics
├── page.js                         # Redirect to /edit
├── globals.css                     # Global styling (~3300 lines, dark theme)
├── middleware.js                   # HTTP Basic Auth gate on all routes
├── components/
│   ├── Sidebar.js                  # Collapsible sidebar navigation
│   ├── BestPosts.js                # Best performing posts display
│   ├── MatchReview.js              # Post-to-Instagram matching review UI
│   └── MilestoneMarkers.js         # Follower milestone markers
├── (app)/                          # Route group (sidebar layout)
│   ├── layout.js                   # Sidebar + main content wrapper
│   ├── edit/page.js                # Content editor (paste, lock, edit, save)
│   ├── history/page.js             # Post history browser
│   ├── history/[id]/page.js        # Individual post view with diff
│   ├── gallery/page.js             # Best transformations showcase
│   ├── analysis/page.js            # Voice analysis dashboard
│   ├── compose/page.js             # Post composer with media upload
│   ├── queue/page.js               # Scheduled posts queue
│   ├── calendar/page.js            # Publishing calendar view
│   ├── drafts/page.js              # Draft posts management
│   ├── engagement/page.js          # Comment inbox + badge counts
│   ├── engagement/mentions/page.js # Mentions inbox
│   ├── performance/
│   │   ├── page.js                 # Dashboard (health, rates, growth)
│   │   ├── posts/page.js           # Published posts table
│   │   ├── timing/page.js          # Best times heatmap + cadence
│   │   ├── content/page.js         # Format comparison + correlation
│   │   ├── hashtags/page.js        # Hashtag analytics
│   │   └── audience/page.js        # Account overview + stories
│   └── settings/page.js            # Connection, import, backfill, library
├── api/
│   ├── log/route.js                # POST: Save logged post pair
│   ├── posts/route.js              # GET: Retrieve all posts
│   ├── posts/link/route.js         # POST/DELETE: Link/unlink Instagram media
│   ├── posts/match/route.js        # GET/POST/PUT: Smart matching engine
│   ├── analyse/route.js            # GET: Compute analytics metrics
│   ├── hashtags/route.js           # GET: Hashtag analytics
│   ├── hashtags/library/route.js   # GET/POST/PUT/DELETE: Hashtag library CRUD
│   ├── comments/
│   │   ├── route.js                # GET: List comments
│   │   ├── [commentId]/route.js    # GET/PUT: Get/update single comment
│   │   ├── counts/route.js         # GET: Unreplied comment counts
│   │   ├── hide/route.js           # POST: Hide/unhide a comment
│   │   ├── reply/route.js          # POST: Reply to a comment
│   │   └── sync/route.js           # POST: Sync comments from Instagram API
│   ├── mentions/
│   │   ├── route.js                # GET: List mentions
│   │   ├── [id]/route.js           # GET/PUT: Get/update single mention
│   │   └── sync/route.js           # POST: Sync mentions from Instagram API
│   ├── publish/
│   │   ├── list/route.js           # GET: List scheduled posts
│   │   ├── draft/route.js          # GET/POST/PUT/DELETE: Draft management
│   │   ├── schedule/route.js       # POST: Schedule a post
│   │   ├── now/route.js            # POST: Publish immediately
│   │   ├── cancel/route.js         # POST: Cancel scheduled post
│   │   ├── reschedule/route.js     # POST: Reschedule a post
│   │   ├── status/route.js         # GET: Publishing job status
│   │   ├── calendar/route.js       # GET: Calendar view of scheduled posts
│   │   ├── templates/route.js      # GET/POST/PUT/DELETE: Caption templates
│   │   ├── upload/route.js         # POST: Upload media to Supabase Storage
│   │   ├── upload/reorder/route.js # POST: Reorder media uploads
│   │   ├── limit/route.js          # GET: Check Instagram publishing rate limit
│   │   └── best-times/route.js     # GET: Best posting time recommendations
│   ├── instagram/
│   │   ├── auth/route.js           # GET: Generate OAuth URL (with CSRF state)
│   │   ├── callback/route.js       # GET: OAuth callback handler
│   │   ├── account/route.js        # GET: Connected account info
│   │   ├── recent/route.js         # GET: Recent Instagram posts
│   │   ├── metrics/route.js        # GET/POST: Post metrics fetch/refresh
│   │   ├── metrics/backfill/route.js # GET/POST: Historical backfill
│   │   ├── insights/route.js       # GET: Account-level insights
│   │   ├── stories/route.js        # GET/POST: Story metrics
│   │   ├── health/route.js         # GET: Sync health status
│   │   ├── snapshot/route.js       # GET/POST: Daily follower snapshot
│   │   ├── growth/route.js         # GET: Growth data over time
│   │   ├── derived/route.js        # GET: Derived metrics (rates, percentiles)
│   │   ├── disconnect/route.js     # POST: Disconnect Instagram account
│   │   └── import/route.js         # GET/POST: Bulk import from Instagram
│   ├── webhooks/
│   │   └── instagram/route.js      # GET: Meta verification / POST: Live events (HMAC-verified)
│   └── cron/
│       ├── nightly/route.js        # GET: Snapshot + backfill + metrics + comment/mention sync
│       ├── poll-new-posts/route.js # GET: Poll for new Instagram posts
│       ├── publish/route.js        # GET: Process due scheduled posts
│       └── publish-cleanup/route.js # GET: Clean up stale publishing jobs
lib/
├── supabase.js                     # Supabase anon client (browser-safe)
├── supabase-server.js              # Supabase service role client (server-only)
├── supabase-schema.sql             # Core schema: posts, metrics, accounts (9 tables)
├── supabase-schema-engagement.sql  # Engagement schema: comments, mentions, webhooks (4 tables)
├── supabase-schema-publishing.sql  # Publishing schema: scheduled_posts, uploads, etc. (4 tables)
├── diff.js                         # Diff computation and edit counting
├── instagram.js                    # Instagram Graph API client wrapper
├── hashtags.js                     # Hashtag extraction and analysis
├── matching.js                     # Post matching algorithm (confidence scoring)
├── derived-metrics.js              # Rate calculations + percentiles
├── milestones.js                   # Achievement/milestone calculations
├── publishing.js                   # Full publish pipeline orchestration
├── media.js                        # Supabase Storage upload/delete helpers
├── best-times.js                   # Best posting time calculations
└── utils.js                        # Shared utilities (delay helper)
deploy/
├── setup-vm.sh                     # Initial VM setup script
├── update.sh                       # Pull/build/restart deployment
├── instagram-metrics-sync.service  # Nightly cron systemd service
├── instagram-metrics-sync.timer    # 3am UTC timer
├── instagram-poll-new-posts.service # Poll-new-posts systemd service
├── instagram-poll-new-posts.timer  # 15-min polling timer
├── instagram-publish-scheduler.service # Publish scheduler service
├── instagram-publish-scheduler.timer   # Publish scheduler timer
├── instagram-snapshot.service      # Snapshot systemd service
└── instagram-snapshot.timer        # Snapshot timer
```

## Database Schema (17 tables)

Schema is split across 3 files. All tables use Supabase PostgreSQL with RLS enabled.
All server-side code uses the service role key which bypasses RLS. The permissive `USING(true)` policies were replaced with `USING(false)` on sensitive tables during security hardening.

**Core schema** (`lib/supabase-schema.sql`):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `posts` | Main post storage | `post_id`, `topic`, `ai_version`, `final_version`, `edit_count`, `instagram_media_id`, `instagram_permalink`, `published_at`, `media_type`, `media_product_type` |
| `post_metrics` | Performance snapshots per post | `post_id` (FK), `instagram_media_id`, `reach`, `views`, `likes`, `comments`, `saves`, `shares`, `engagement_rate`, `media_type`, `media_product_type` |
| `instagram_accounts` | OAuth tokens and account data | `instagram_user_id`, `access_token`, `token_expires_at`, `facebook_page_id` |
| `sync_status` | Background sync operation tracking | `sync_type`, `status`, `posts_processed`, `errors_count`, `error_details` |
| `account_insights_cache` | Cached account-level insights | `instagram_user_id`, `insight_type`, `data` (JSONB) |
| `account_snapshots` | Daily follower/reach snapshots | `instagram_user_id`, `followers_count`, `reach_28d`, `snapshot_date` |
| `match_suggestions` | Smart post-to-Instagram linking | `post_id` (FK), `instagram_media_id`, `confidence_score`, `status` |
| `hashtag_library` | Curated hashtags with categories | `hashtag`, `source`, `category`, `notes` |
| `story_metrics` | Instagram Stories performance | `instagram_media_id`, `impressions`, `reach`, `replies`, `taps_forward`, `exits` |

**Engagement schema** (`lib/supabase-schema-engagement.sql`):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `comments` | Instagram comments on posts | `instagram_comment_id`, `instagram_media_id`, `text`, `username`, `reply_status`, `is_hidden` |
| `mentions` | Instagram mentions/tags | `instagram_media_id`, `mention_type`, `username`, `caption`, `reply_status` |
| `webhook_events` | Raw Meta webhook payloads | `event_type`, `instagram_user_id`, `payload` (JSONB), `processed` |
| `engagement_counts` | Denormalised badge counters | `count_type` (unique), `count` — incremented atomically via `increment_engagement_count()` RPC |

**Publishing schema** (`lib/supabase-schema-publishing.sql`):

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `scheduled_posts` | Posts queued for publishing | `id`, `caption`, `media_type`, `scheduled_at`, `status`, `ig_container_id` |
| `media_uploads` | Media files attached to scheduled posts | `scheduled_post_id` (FK), `storage_path`, `public_url`, `media_type`, `sort_order` |
| `caption_templates` | Saved caption templates | `name`, `content`, `category` |
| `publishing_log` | Audit trail of publish pipeline steps | `scheduled_post_id` (FK), `action`, `details` (JSONB) |

## API Endpoints

### Post Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/log` | Save a logged post pair (original + edited) |
| `GET` | `/api/posts` | Retrieve all posts (newest first, limit 5000) |
| `POST` | `/api/posts/link` | Link a post to an Instagram media ID |
| `DELETE` | `/api/posts/link` | Unlink a post from Instagram |
| `GET` | `/api/posts/match` | Get pending match suggestions |
| `POST` | `/api/posts/match` | Run smart matching algorithm |
| `PUT` | `/api/posts/match` | Accept or reject a match suggestion |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analyse` | Compute voice analytics metrics |
| `GET` | `/api/hashtags` | Hashtag performance analytics |
| `GET/POST/PUT/DELETE` | `/api/hashtags/library` | Hashtag library CRUD |

### Engagement Hub
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/comments` | List comments with filters |
| `GET/PUT` | `/api/comments/[commentId]` | Get/update a comment |
| `GET` | `/api/comments/counts` | Unreplied comment badge count |
| `POST` | `/api/comments/hide` | Hide or unhide a comment |
| `POST` | `/api/comments/reply` | Reply to a comment via Instagram API |
| `POST` | `/api/comments/sync` | Sync comments for recent posts |
| `GET` | `/api/mentions` | List mentions |
| `GET/PUT` | `/api/mentions/[id]` | Get/update a mention |
| `POST` | `/api/mentions/sync` | Sync mentions from Instagram API |

### Publishing Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/publish/list` | List scheduled posts |
| `GET/POST/PUT/DELETE` | `/api/publish/draft` | Draft management |
| `POST` | `/api/publish/schedule` | Schedule a post |
| `POST` | `/api/publish/now` | Publish a post immediately |
| `POST` | `/api/publish/cancel` | Cancel a scheduled post |
| `POST` | `/api/publish/reschedule` | Reschedule a post |
| `GET` | `/api/publish/status` | Publishing job status |
| `GET` | `/api/publish/calendar` | Calendar view of scheduled posts |
| `GET/POST/PUT/DELETE` | `/api/publish/templates` | Caption templates CRUD |
| `POST` | `/api/publish/upload` | Upload media to Supabase Storage |
| `POST` | `/api/publish/upload/reorder` | Reorder media uploads |
| `GET` | `/api/publish/limit` | Check Instagram daily publishing rate limit |
| `GET` | `/api/publish/best-times` | Best posting time recommendations |

### Instagram Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/instagram/auth` | Generate OAuth authorization URL (with CSRF state cookie) |
| `GET` | `/api/instagram/callback` | Handle OAuth callback, validate state, exchange code for token |
| `GET` | `/api/instagram/account` | Get connected account info |
| `GET` | `/api/instagram/recent` | Fetch recent Instagram posts |
| `GET/POST` | `/api/instagram/metrics` | Get/refresh post metrics |
| `GET/POST` | `/api/instagram/metrics/backfill` | Historical metrics backfill (50/batch) |
| `GET` | `/api/instagram/insights` | Account-level insights |
| `GET/POST` | `/api/instagram/stories` | Story metrics |
| `GET` | `/api/instagram/health` | Sync health and status polling |
| `GET/POST` | `/api/instagram/snapshot` | Daily account snapshot |
| `GET` | `/api/instagram/growth` | Growth data over time |
| `GET` | `/api/instagram/derived` | Derived metrics (rates, percentiles) |
| `POST` | `/api/instagram/disconnect` | Disconnect Instagram account |
| `GET/POST` | `/api/instagram/import` | Bulk import posts from Instagram |

### Webhooks
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/webhooks/instagram` | Meta webhook verification (hub.verify_token check) |
| `POST` | `/api/webhooks/instagram` | Receive live events — HMAC-SHA256 verified before processing |

### Cron
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cron/nightly` | Nightly: snapshot + backfill + metrics + comment/mention sync |
| `GET` | `/api/cron/poll-new-posts` | Poll Instagram for posts published since last check |
| `GET` | `/api/cron/publish` | Process scheduled posts due for publishing |
| `GET` | `/api/cron/publish-cleanup` | Clean up stale publishing jobs and orphaned media |

## Key Architecture Decisions

### Authentication
All routes are protected by HTTP Basic Auth middleware (`middleware.js`). The `x-cron-secret` header is accepted as an alternative for systemd services and internal cron-to-cron fetch calls. The webhook endpoint (`/api/webhooks/*`) is exempted — Meta calls it server-to-server; POST requests are protected by HMAC-SHA256 signature verification instead.

### Supabase Client Split
Two Supabase clients exist:
- `lib/supabase.js` — anon key, browser-safe, used for any future client-side reads
- `lib/supabase-server.js` — service role key (server-only, never expose to browser), used by all API routes. Bypasses RLS.

### Background Processing Pattern
Long operations (metrics refresh, import, matching) return immediately with a `syncId` and process in the background. The frontend polls `/api/instagram/health` for completion.

```javascript
// API returns immediately
{ success: true, syncId: "123", status: "running" }

// Frontend polls health endpoint until complete
{ sync_type: "metrics", status: "success", posts_processed: 47 }
```

This pattern exists because Cloudflare's free-tier proxy has a 100-second HTTP response timeout.

### Meta API Rate Limiting
The Meta Graph API allows approximately 200 calls per user per hour (~36 seconds between calls). Metrics refresh uses 2 API calls per post with built-in delays. Backfill processes 50 posts per batch. Token auto-refresh happens on 401 responses via `graphFetchWithRefresh` in `lib/instagram.js`.

### Publishing Pipeline
Posts go through: draft → scheduled → publishing → published (or failed/cancelled).
The publish pipeline (`lib/publishing.js`) creates Instagram media containers, polls until ready, then publishes. All steps are logged to `publishing_log`. Cron job runs every few minutes to process due posts.

### Sidebar Navigation
The app uses a collapsible sidebar with Next.js route groups (`(app)/`). The root `page.js` redirects to `/edit`. All pages within the `(app)` group share the sidebar layout.

### Performance Page Architecture
The performance section is split into 6 focused sub-pages instead of a single monolith. Each sub-page fetches only the data it needs.

### Date Handling
`published_at` (actual Instagram post date) is the primary date for all analytics and sorting, with `created_at` as fallback for posts not yet linked to Instagram.

### Post vs Reel Classification
- **Reel**: `media_product_type = 'REELS'` OR `media_type = 'VIDEO'` (without FEED product type)
- **Post**: Everything else (images, carousels)

### Supabase Query Limits
Supabase has a default 1000-row limit on queries. Endpoints that return large result sets use `.limit(5000)`. Any endpoint that may return more than 5000 rows must use explicit pagination.

## Environment Variables

**Required (Supabase):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon public key (safe to expose in browser)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (**server-side only** — never use `NEXT_PUBLIC_` prefix; bypasses RLS)

**Required (Instagram):**
- `INSTAGRAM_APP_ID` - Facebook app ID
- `INSTAGRAM_APP_SECRET` - Facebook app secret
- `INSTAGRAM_REDIRECT_URI` - OAuth callback URL
- `WEBHOOK_VERIFY_TOKEN` - Token set in Meta App Dashboard → Webhooks → Verify Token

**Required (Auth):**
- `ADMIN_USER` - HTTP Basic Auth username for app access
- `ADMIN_PASS` - HTTP Basic Auth password for app access
- `CRON_SECRET` - Secret header value used by systemd services and internal cron calls (`x-cron-secret` header)

Hosting details, SSH credentials, and Facebook app configuration are stored in the Claude auto-memory file, not in committed code.

## Setup and Development

```bash
# Install dependencies
npm install

# Create env file with all required credentials
cp .env.example .env.local

# Start development server
npm run dev
# Open http://localhost:3000

# Production build
npm run build && npm start

# Run tests
npm test
```

## Deployment

The app is self-hosted on a Linux VM behind a Cloudflare Tunnel. Deployment scripts live in `deploy/`.

- `deploy/setup-vm.sh` - Initial VM provisioning (Node.js, systemd services, cloudflared)
- `deploy/update.sh` - Standard deploy: git pull, npm install, npm build, restart service

**Systemd services:**
- `instagram-logger` - The Next.js application
- `cloudflared` - Cloudflare Tunnel proxy
- `instagram-metrics-sync` - Nightly cron (3am UTC)
- `instagram-poll-new-posts` - Poll for new posts (runs on timer)
- `instagram-publish-scheduler` - Process due scheduled posts (runs on timer)

**Nightly cron (3am UTC):**
Triggered by `instagram-metrics-sync.timer`, calls `/api/cron/nightly` which runs:
1. Poll for new Instagram posts
2. Daily account snapshot (followers, reach)
3. 50-post historical metrics backfill
4. 7-day metrics refresh for recent posts
5. Comment sync for last 7 days
6. Mention/tag sync

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.2.5 | Full-stack React framework (App Router) |
| `react` | ^19.2.0 | UI library |
| `react-dom` | ^19.2.0 | React DOM rendering |
| `@supabase/supabase-js` | ^2.86.0 | Supabase PostgreSQL client |
| `@vercel/analytics` | ^2.0.1 | Performance monitoring |

**Dev dependencies:** jest, @testing-library/react, @testing-library/jest-dom, jest-environment-jsdom

## Code Style and Conventions

### General
- **Naming**: camelCase for variables/functions, PascalCase for React components
- **Async**: async/await everywhere, no callbacks
- **Comments**: Only for non-obvious logic
- **Styling**: Inline styles + `app/globals.css` (no UI library)

### React
- Functional components with hooks
- Keep components focused and minimal
- Pass data through props, no deep prop drilling
- Use React keys correctly in lists

### API Routes
- Standard HTTP methods (GET/POST/PUT/DELETE)
- Consistent JSON responses: `{ success: true, ... }` or `{ success: false, error: "message" }`
- Background operations return `{ success: true, syncId, status: "running" }`
- Include meaningful error messages
- Never build "process all records" endpoints without considering Meta API rate limits

### File Organization
- API routes in `app/api/[route]/route.js`
- Shared utilities in `lib/`
- React components in `app/components/`
- Page components in `app/(app)/[route]/page.js`
- Deployment scripts in `deploy/`

### Data Integrity
- `ai_version` (original) is never modified after creation
- `final_version` captures the user's edited version
- Both versions are preserved unmodified for training data
- `edit_count` tracks meaningful edits (add/remove pairs count as 1)

## Utility Libraries

| File | Purpose |
|------|---------|
| `lib/supabase.js` | Supabase anon client — browser-safe initialisation |
| `lib/supabase-server.js` | Supabase service role client — server-only, bypasses RLS |
| `lib/instagram.js` | Instagram Graph API wrapper with token refresh, rate limiting, and error handling |
| `lib/publishing.js` | Full publish pipeline: container creation, polling, publish, logging |
| `lib/matching.js` | Compares logged posts to Instagram posts using text similarity for confidence-scored match suggestions |
| `lib/derived-metrics.js` | Calculates engagement rates, reach rates, percentiles, and period-over-period comparisons |
| `lib/hashtags.js` | Extracts hashtags from captions, groups by frequency, correlates with performance |
| `lib/milestones.js` | Calculates follower milestones and achievement markers |
| `lib/diff.js` | Line-by-line diff computation and edit counting for the content editor |
| `lib/media.js` | Supabase Storage upload and delete helpers for publishing media |
| `lib/best-times.js` | Best posting time calculations based on historical engagement data |
| `lib/utils.js` | Shared utilities — `delay(ms)` helper for rate limiting |

## Styling

- **Dark theme** inspired by Instagram aesthetic
- Color palette: background `#0a0a0a`, cards `#141414`, accent `#e1306c` (Instagram pink), success `#22c55e`, error `#ef4444`
- Responsive: grid converts to single column at 1024px breakpoint
- All styles in `app/globals.css` (~3300 lines) plus inline styles on components
