# Instagram Post Logger v3.0 - Developer Guide

Last Updated: March 2026

## Project Overview

Instagram Post Logger is a web application for tracking Instagram post edits, creating training data for voice refinement, and analysing Instagram performance metrics. It combines a content editing workflow with full Instagram Graph API integration for performance analytics.

**Core capabilities:**
- Paste Claude-generated posts, lock the original, edit to match your voice, log both versions as training data
- Connect an Instagram account via OAuth and pull real performance metrics
- Smart matching links logged posts to published Instagram posts
- Performance analytics across 6 focused dashboards (health, posts, timing, content, hashtags, audience)
- Nightly automated sync: snapshots, backfill, and metrics refresh

## Technology Stack

- **Next.js 16.0.10** - Full-stack React framework (App Router)
- **React 19.2.0** - UI library
- **Supabase 2.44.0** - PostgreSQL database
- **Instagram Graph API v21.0** - Post metrics, account insights, stories
- **Vercel Analytics 1.5.0** - Performance monitoring
- **Self-hosted** on Ubuntu 25.04 VM via Cloudflare Tunnel

## Project Structure

```
app/
├── layout.js                       # Root layout with Analytics
├── page.js                         # Redirect to /edit
├── globals.css                     # Global styling (~3300 lines, dark theme)
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
│   ├── instagram/
│   │   ├── auth/route.js           # GET: Generate OAuth URL
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
│   └── cron/nightly/route.js       # GET: Nightly cron job
lib/
├── supabase.js                     # Supabase client initialization
├── supabase-schema.sql             # Full database schema + migrations
├── diff.js                         # Diff computation and edit counting
├── instagram.js                    # Instagram Graph API client wrapper
├── hashtags.js                     # Hashtag extraction and analysis
├── matching.js                     # Post matching algorithm (confidence scoring)
├── derived-metrics.js              # Rate calculations + percentiles
├── milestones.js                   # Achievement/milestone calculations
└── system-prompt.js                # Archived voice guidelines (unused)
deploy/
├── setup-vm.sh                     # Initial VM setup script
├── update.sh                       # Pull/build/restart deployment
├── instagram-metrics-sync.service  # Nightly cron systemd service
├── instagram-metrics-sync.timer    # 3am UTC timer
├── instagram-snapshot.service      # Snapshot systemd service
└── instagram-snapshot.timer        # 4am timer (deprecated, unified into nightly)
```

## Database Schema (9 tables)

All tables use Supabase PostgreSQL with RLS enabled. Schema lives in `lib/supabase-schema.sql`.

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

## API Endpoints

### Post Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/log` | Save a logged post pair (original + edited) |
| `GET` | `/api/posts` | Retrieve all posts (newest first) |
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

### Instagram Integration
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/instagram/auth` | Generate OAuth authorization URL |
| `GET` | `/api/instagram/callback` | Handle OAuth callback, exchange code for token |
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

### Cron
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/cron/nightly` | Nightly job: snapshot + 50-post backfill + 7-day metrics refresh |

## Key Architecture Decisions

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
Supabase has a default 1000-row limit on queries. Any endpoint that may return more than 1000 rows must use explicit pagination or limits.

## Environment Variables

**Required (Supabase):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon public key

**Required (Instagram):**
- `INSTAGRAM_APP_ID` - Facebook app ID
- `INSTAGRAM_APP_SECRET` - Facebook app secret
- `INSTAGRAM_REDIRECT_URI` - OAuth callback URL

Hosting details, SSH credentials, and Facebook app configuration are stored in the Claude auto-memory file, not in committed code.

## Setup and Development

```bash
# Install dependencies
npm install

# Create env file with Supabase + Instagram credentials
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

**Nightly cron (3am UTC):**
Triggered by `instagram-metrics-sync.timer`, calls `/api/cron/nightly` which runs:
1. Daily account snapshot (followers, reach)
2. 50-post historical metrics backfill
3. 7-day metrics refresh for recent posts

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.0.10 | Full-stack React framework (App Router) |
| `react` | ^19.2.0 | UI library |
| `react-dom` | ^19.2.0 | React DOM rendering |
| `@supabase/supabase-js` | ^2.44.0 | Supabase PostgreSQL client |
| `@vercel/analytics` | ^1.5.0 | Performance monitoring |

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
| `lib/instagram.js` | Instagram Graph API wrapper with token refresh, rate limiting, and error handling |
| `lib/matching.js` | Compares logged posts to Instagram posts using text similarity for confidence-scored match suggestions |
| `lib/derived-metrics.js` | Calculates engagement rates, reach rates, percentiles, and period-over-period comparisons |
| `lib/hashtags.js` | Extracts hashtags from captions, groups by frequency, correlates with performance |
| `lib/milestones.js` | Calculates follower milestones and achievement markers |
| `lib/diff.js` | Line-by-line diff computation and edit counting for the content editor |
| `lib/supabase.js` | Supabase client initialization |

## Styling

- **Dark theme** inspired by Instagram aesthetic
- Color palette: background `#0a0a0a`, cards `#141414`, accent `#e1306c` (Instagram pink), success `#22c55e`, error `#ef4444`
- Responsive: grid converts to single column at 1024px breakpoint
- All styles in `app/globals.css` (~3300 lines) plus inline styles on components
