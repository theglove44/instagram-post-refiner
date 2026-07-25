# Voice Workshop (Tuck In and Talk)

Personal **tone-of-voice workshop** for Instagram captions.

**Daily loop:** photos in Google Keep → notes + AI draft in this app → edit to Chris's voice → **Copy final for Keep** → Michelle posts in the Instagram app.

The product is voice tracking (AI draft + final pair), not analytics or publishing. Publish/metrics code still exists in the repo but is **cold** (hidden from nav).

Built with Next.js 16, React 19, and Supabase. Instagram Graph API pieces remain for cold features only.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Quick Start](#quick-start)
- [Instagram Integration](#instagram-integration)
- [Self-Hosting](#self-hosting)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Database Schema](#database-schema)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Content Editor

Paste AI-generated Instagram posts, lock the original, and edit freely to match your voice. Both versions are saved side-by-side with a real-time diff view, creating authentic training data that captures exactly how you transform AI output into your writing style. Edit counts track refinement intensity per post.

### Full Account Import

Import your entire Instagram post history into the tool. Supports bulk import of 1,700+ posts with progress tracking and rate-limit awareness.

### Smart Post Matching

Automatically matches logged posts to live Instagram posts using text similarity with confidence scoring. High-confidence matches are linked automatically; borderline matches surface for manual review.

### Performance Dashboards

Six dedicated analytics views, each focused on a different dimension of your content performance:

| Dashboard | What it shows |
|-----------|---------------|
| **Dashboard** | Data health status, 28-day rate summary (medians), follower growth chart with milestone markers |
| **Post Metrics** | Published posts table with percentile rankings, performance scores, best-performing posts |
| **Timing & Cadence** | 7x24 best-times heatmap, posting cadence analysis, "Post Now?" indicator |
| **Content Analysis** | Post vs. Reel format comparison, edits-vs-performance correlation, caption length analysis |
| **Hashtags** | Per-hashtag analytics, recommended sets, star performers, combination analysis, negative lift detection |
| **Audience** | Account overview, demographics breakdown, Stories insights |

### Hashtag Library

Manually curated hashtag database with categories, sources, notes, and bulk copy. Organized by niche for quick selection when composing posts.

### Voice Analysis

Analyzes your editing patterns across all logged posts. Tracks how your voice differs from AI output, identifies common edit types, and scores voice consistency over time.

### Nightly Automation

Systemd-driven cron jobs handle daily account snapshots, metrics backfill (50 posts per night), and a rolling 7-day metric refresh window. Fully automated once configured.

---

## How It Works

```
1. PASTE              2. EDIT               3. LOG                4. ANALYZE

Paste AI-generated    Lock original and     Save both versions    Link to Instagram
post from any         edit to match your    to Supabase with      and track real
AI tool               authentic voice       diff and edit count   engagement metrics
```

Every logged post pair becomes training data. Over time, the analytics dashboards reveal which editing patterns correlate with better engagement, which hashtags drive reach, and when your audience is most active.

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.2.10 | Full-stack React framework (App Router) |
| React | 19.2.7 | UI components |
| Supabase JS | 2.86.0 | PostgreSQL, Auth, Storage, and Row Level Security |
| Supabase SSR | 0.8.0 | Cookie-based server authentication |
| Instagram Graph API | v21.0 | Post metrics, account insights, Stories data |
| Vercel Analytics | 2.0.1 | Performance monitoring and Web Vitals |
| Jest | 30.2.0 | Unit testing |

---

## Quick Start

### Prerequisites

- Node.js 20.9+
- A [Supabase](https://supabase.com) project (free tier works)
- (Optional) Instagram Business or Creator account for performance tracking

### 1. Clone and install

```bash
git clone https://github.com/theglove44/instagram-post-refiner.git
cd instagram-post-refiner
npm install
```

### 2. Set up the database

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the three `lib/supabase-schema*.sql` files in the SQL Editor.
3. For existing installations, apply migrations in `lib/migrations/` using their runbooks.
4. Copy project URL, anon key, and server-only service-role key from **Settings > API**.
5. Create initial operator in Supabase Auth. Keep public signup disabled until tenant route authorization is complete.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

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

# Optional: Instagram integration
INSTAGRAM_APP_ID=your-facebook-app-id
INSTAGRAM_APP_SECRET=your-facebook-app-secret
INSTAGRAM_REDIRECT_URI=https://your-domain.com/api/instagram/callback
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Supabase Auth or temporary Basic Auth fallback. Instagram features require optional Meta credentials above.

### 5. Build for production

```bash
npm run build
npm start
```

### Training-data integrity migration

Existing installations must classify historical rows before deploying code that
writes explicit origins:

1. Back up the `posts` table.
2. Run `lib/migrations/20260711_add_posts_origin.sql` in the Supabase SQL Editor.
   It classifies stable `ig_` importer IDs as `instagram_import` and all other
   existing rows as `training_pair`.
3. Deploy application code. New logs and imports now set `origin` explicitly;
   voice analysis excludes Instagram imports. Pre-migration rows remain readable
   through the same stable-ID fallback.
4. Dry-run historical edit-count recalculation with service-role credentials:

   ```bash
   npm run recalculate:edit-counts
   ```

5. Review the report and, during a maintenance window, opt into writes:

   ```bash
   npm run recalculate:edit-counts -- --apply --confirm=RECALCULATE_EDIT_COUNTS
   ```

The recalculation command never writes by default. It only considers rows marked
`training_pair`; imported Instagram history remains untouched.

### Tenant/workspace foundation migration

Existing installations can apply
`lib/migrations/2026-07-12-tenant-workspace-foundation.sql` before auth-aware
route work. Migration adds `profiles`, `workspaces`, `workspace_members`, nullable
tenant keys, indexes, tenant-aligned foreign keys, and membership RLS. It does not
guess an owner or rewrite existing rows. Follow the reviewed bootstrap/backfill
procedure in `lib/migrations/README.md`; keep tenant columns nullable until every
route and cron write supplies them.

---

## Instagram Integration

Connecting an Instagram Business or Creator account unlocks all performance dashboards, post metrics, and audience insights.

### Facebook App Setup

1. Create an app at [developers.facebook.com](https://developers.facebook.com)
2. Add the **Instagram Graph API** product
3. Add **instagram_basic**, **instagram_manage_insights**, and **pages_show_list** permissions
4. Set the Valid OAuth Redirect URI to `https://your-domain.com/api/instagram/callback`
5. Add `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, and `INSTAGRAM_REDIRECT_URI` to your environment
6. Open **Settings** in the app and click "Connect Instagram"

### Rate Limits

The Meta Graph API allows approximately 200 calls per user per hour. The application handles this with:

- Background processing for bulk operations (fire-and-forget pattern)
- Nightly backfill limited to 50 posts per run
- 7-day rolling refresh window for recent metrics
- All long-running operations return immediately and process asynchronously

---

## Self-Hosting

The application is designed to run on a self-hosted VM behind a reverse proxy. This avoids serverless function timeouts that affect platforms like Vercel (10s limit) and Cloudflare (100s limit).

### Systemd Service

Create `/etc/systemd/system/instagram-logger.service`:

```ini
[Unit]
Description=Instagram Post Logger
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
sudo systemctl enable instagram-logger
sudo systemctl start instagram-logger
```

### Cloudflare Tunnel

Expose the application without opening ports:

```bash
cloudflared tunnel create instagram-logger
cloudflared tunnel route dns instagram-logger your-domain.com
```

Configure `/etc/cloudflared/config.yml`:

```yaml
tunnel: your-tunnel-id
credentials-file: /etc/cloudflared/your-tunnel-id.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:3000
  - service: http_status:404
```

### Nightly Cron Jobs

Systemd timer units in the `deploy/` directory automate daily data collection:

- **Account snapshots** — Daily follower counts, reach, and engagement for growth tracking
- **Metrics backfill** — Fetches performance data for up to 50 posts per night
- **7-day refresh** — Re-fetches metrics for recent posts to capture late engagement

Install the timers:

```bash
sudo cp deploy/instagram-snapshot.service /etc/systemd/system/
sudo cp deploy/instagram-snapshot.timer /etc/systemd/system/
sudo cp deploy/instagram-metrics-sync.service /etc/systemd/system/
sudo cp deploy/instagram-metrics-sync.timer /etc/systemd/system/
sudo systemctl enable --now instagram-snapshot.timer
sudo systemctl enable --now instagram-metrics-sync.timer
```

### Deploy Script

Pull updates and restart:

```bash
bash deploy/update.sh
```

---

## Project Structure

```
instagram-post-refiner/
├── app/
│   ├── (app)/                        # Route group with sidebar layout
│   │   ├── layout.js                 # Sidebar navigation wrapper
│   │   ├── edit/page.js              # Content editor (paste, lock, edit, log)
│   │   ├── history/page.js           # Post history with search and filters
│   │   ├── history/[id]/page.js      # Individual post view with diff
│   │   ├── gallery/page.js           # Best transformations gallery
│   │   ├── analysis/page.js          # Voice analysis dashboard
│   │   ├── settings/page.js          # Instagram connection, import, hashtag library
│   │   └── performance/
│   │       ├── page.js               # Main dashboard (health, rates, growth)
│   │       ├── posts/page.js         # Published posts table with rankings
│   │       ├── timing/page.js        # Best-times heatmap and cadence
│   │       ├── content/page.js       # Format comparison and correlation
│   │       ├── hashtags/page.js      # Hashtag analytics and recommendations
│   │       └── audience/page.js      # Account overview and demographics
│   ├── api/
│   │   ├── log/route.js              # POST: Save logged post pair
│   │   ├── posts/route.js            # GET: Retrieve post history
│   │   ├── posts/link/route.js       # POST: Link post to Instagram media
│   │   ├── posts/match/route.js      # POST: Run smart matching algorithm
│   │   ├── analyse/route.js          # GET: Compute editing analytics
│   │   ├── hashtags/route.js         # GET/POST: Hashtag analytics
│   │   ├── hashtags/library/route.js # CRUD: Hashtag library management
│   │   ├── cron/nightly/route.js     # POST: Nightly automation endpoint
│   │   └── instagram/
│   │       ├── auth/route.js         # GET: Initiate OAuth flow
│   │       ├── callback/route.js     # GET: OAuth callback handler
│   │       ├── account/route.js      # GET: Account info
│   │       ├── recent/route.js       # GET: Recent Instagram posts
│   │       ├── metrics/route.js      # GET: Post performance metrics
│   │       ├── metrics/backfill/route.js  # POST: Backfill historical metrics
│   │       ├── insights/route.js     # GET: Account-level insights
│   │       ├── stories/route.js      # GET: Stories metrics
│   │       ├── health/route.js       # GET: Data sync health status
│   │       ├── snapshot/route.js     # POST: Daily account snapshot
│   │       ├── growth/route.js       # GET: Follower growth data
│   │       ├── derived/route.js      # GET: Derived/calculated metrics
│   │       ├── disconnect/route.js   # POST: Disconnect Instagram account
│   │       └── import/route.js       # POST: Bulk import post history
│   ├── components/
│   │   ├── Sidebar.js                # Collapsible sidebar navigation
│   │   ├── BestPosts.js              # Top-performing posts component
│   │   ├── MatchReview.js            # Smart match review interface
│   │   └── MilestoneMarkers.js       # Growth chart milestone markers
│   ├── layout.js                     # Root layout with Analytics
│   ├── page.js                       # Root redirect
│   └── globals.css                   # Dark theme styling
├── proxy.js                          # Supabase Auth, cron, and webhook request gate
├── lib/
│   ├── supabase.js                   # Browser-safe anon client
│   ├── supabase-server.js            # Server-only service-role client
│   ├── supabase-auth/                # Request-scoped SSR Auth clients
│   ├── supabase-schema*.sql          # Application schema (17 tables)
│   ├── migrations/                   # Staged data/schema migrations and runbooks
│   ├── instagram.js                  # Instagram Graph API client
│   ├── diff.js                       # Diff computation and edit counting
│   ├── matching.js                   # Text similarity matching algorithm
│   ├── hashtags.js                   # Hashtag extraction utilities
│   ├── milestones.js                 # Growth milestone definitions
│   ├── derived-metrics.js            # Calculated metric functions
│   └── system-prompt.js              # Voice guidelines (archived reference)
├── deploy/
│   ├── setup-vm.sh                   # Initial VM setup script
│   ├── update.sh                     # Pull, build, restart deploy script
│   ├── backfill-metrics.sh           # Manual metrics backfill
│   ├── instagram-snapshot.service    # Systemd service for daily snapshots
│   ├── instagram-snapshot.timer      # Systemd timer for daily snapshots
│   ├── instagram-metrics-sync.service # Systemd service for metrics sync
│   └── instagram-metrics-sync.timer  # Systemd timer for metrics sync
├── __mocks__/                        # Jest test mocks
├── jest.config.js                    # Jest configuration
├── next.config.mjs                   # Next.js configuration
└── package.json                      # Dependencies and scripts
```

---

## API Reference

### Core

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/log` | Save a logged post pair (original + edited version) |
| `GET` | `/api/posts` | Retrieve all logged posts, newest first |
| `GET` | `/api/analyse` | Compute editing analytics (totals, averages, distributions) |

### Post Linking

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/posts/link` | Link a logged post to an Instagram media ID |
| `POST` | `/api/posts/match` | Run smart matching against Instagram posts |

### Hashtags

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/hashtags` | Hashtag usage analytics from logged posts |
| `GET/POST/PUT/DELETE` | `/api/hashtags/library` | CRUD operations for the curated hashtag library |

### Instagram

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/instagram/auth` | Initiate Instagram OAuth flow |
| `GET` | `/api/instagram/callback` | Handle OAuth callback, exchange code for token |
| `GET` | `/api/instagram/account` | Fetch connected account info |
| `GET` | `/api/instagram/recent` | Fetch recent Instagram posts |
| `GET` | `/api/instagram/metrics` | Fetch post performance metrics |
| `POST` | `/api/instagram/metrics/backfill` | Backfill metrics for historical posts |
| `GET` | `/api/instagram/insights` | Fetch account-level insights (reach, demographics) |
| `GET` | `/api/instagram/stories` | Fetch Stories metrics |
| `GET` | `/api/instagram/health` | Data sync health and last-sync timestamps |
| `POST` | `/api/instagram/snapshot` | Take a daily account snapshot |
| `GET` | `/api/instagram/growth` | Follower growth data from snapshots |
| `GET` | `/api/instagram/derived` | Calculated metrics (percentiles, scores) |
| `POST` | `/api/instagram/disconnect` | Disconnect Instagram account |
| `POST` | `/api/instagram/import` | Bulk import Instagram post history |

### Automation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/cron/nightly` | Run nightly jobs (snapshot + metrics backfill + refresh) |

---

## Database Schema

Seventeen application tables live across the three `lib/supabase-schema*.sql`
files. The tenant foundation migration adds three auth/workspace tables.

| Table | Purpose |
|-------|---------|
| `posts` | Logged post pairs (original AI output + edited version) with optional Instagram link |
| `post_metrics` | Per-post engagement data (impressions, reach, likes, comments, saves, shares) |
| `instagram_accounts` | Connected Instagram account credentials and token management |
| `sync_status` | Tracks sync job runs, status, and error details for data health monitoring |
| `account_insights_cache` | Cached account-level insights to reduce API calls |
| `account_snapshots` | Daily snapshots of follower count, reach, and engagement for growth charts |
| `match_suggestions` | Smart matching results with confidence scores and review status |
| `hashtag_library` | Manually curated hashtags with categories, sources, and notes |
| `story_metrics` | Instagram Stories performance data (impressions, reach, taps, exits) |

---

## Architecture

### Design Decisions

**Self-hosted over serverless.** The Meta Graph API rate limit (~200 calls/user/hour) and bulk operations like full account imports require long-running processes. Serverless platforms impose response timeouts (Vercel: 10s, Cloudflare: 100s) that make this impractical. A self-hosted VM with systemd services provides unlimited execution time.

**Fire-and-forget background processing.** Long-running API operations (metrics backfill, bulk import) return an immediate HTTP response and continue processing in the background. The `sync_status` table tracks job progress, and the frontend polls for completion.

**Nightly automation over real-time sync.** Instead of fetching metrics on every page load, a nightly cron job backfills historical data and refreshes recent posts. This stays well within rate limits while keeping dashboards current.

**Route groups with sidebar layout.** The `(app)` route group in Next.js wraps all pages in a collapsible sidebar layout without affecting URL paths. The root `page.js` redirects to `/edit`.

**Client-side diff computation.** The diff algorithm runs entirely in the browser. No server round-trip is needed when editing, which keeps the editing experience responsive.

**Tenant migration is staged.** Current server routes and cron jobs still use the
service role. The additive workspace schema and membership RLS are ready, but
existing rows require an explicit owner/workspace backfill and routes still need
tenant-aware reads and writes before browser-authenticated multi-tenant use.

### Key Patterns

- **22 API routes** organized by domain (core, Instagram, hashtags, cron)
- **14 page routes** via Next.js App Router with `(app)` route group
- **9 database tables** with Row Level Security enabled on all tables
- **Rate-limit-aware** API integration with background processing
- **Incremental metrics collection** via nightly backfill (50 posts) + 7-day refresh

---

## Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Run tests before submitting:

```bash
npm test
```

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
