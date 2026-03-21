# Instagram Content Management Platform — Development Roadmap

Last Updated: March 2026

## Vision

Evolve the Instagram Post Logger from a voice-training tool into a full content management platform that can be monetised as a SaaS product. The unique differentiator is the AI voice refinement pipeline — no competitor learns how you edit AI-generated content.

---

## Phase 1: Content Publishing & Scheduling ✅ COMPLETE

**Status:** Live and working

The core feature that makes this a product people pay for.

### What was built
- **Content Composer** — Caption editor with character counter, hashtag library integration, caption templates, Instagram post preview
- **Media Upload** — Drag-and-drop image/video upload to Supabase Storage, carousel support (up to 10 images), reordering
- **Publishing Engine** — Container-based Instagram Graph API publishing for images, carousels, reels, and stories. Dry-run mode for safe testing.
- **Scheduling** — Schedule posts for future publishing with best-time suggestions from historical analytics. 1-minute systemd timer processes the queue.
- **Draft Management** — Auto-save drafts, drafts page, edit existing drafts
- **Calendar View** — Month/week views showing scheduled, published, and failed posts
- **Queue View** — Upcoming posts timeline, failed posts with retry, rate limit display
- **Edit-to-Publish Flow** — "Compose & Publish" button on post history pages pre-fills caption from voice-refined content

### Technical Details
- 31 new files, 2 modified
- 4 new DB tables: `scheduled_posts`, `media_uploads`, `publishing_log`, `caption_templates`
- 17 new API routes under `/api/publish/`
- 9 new React components
- Systemd timer for scheduled publishing
- Zero new npm dependencies

---

## Phase 2: Engagement Hub ✅ COMPLETE

**Status:** Live and working

Turns the app from "publish and track" into "publish, track, and engage."

### What was built
- **Comment Inbox** — Unified view of all comments across posts with reply/hide/delete actions. Filter by All/Unreplied/Replied/Hidden. Search by text or username. Bulk actions.
- **Reply from Inbox** — Type and send replies directly from the app via Instagram API
- **Comment Moderation** — Hide/unhide and delete comments
- **Mentions & Tags Dashboard** — See when other accounts tag or @mention you
- **Webhook Infrastructure** — Endpoint for real-time Meta webhook notifications (comments, mentions). Verification and event processing.
- **Sidebar Badge** — Unreplied comment count badge on the Inbox nav item
- **Comment Sync** — Initial full sync of all historical comments, then nightly 7-day sweep. Hybrid approach with webhook real-time updates.
- **Nightly Cron Integration** — Comment and mention sync added to existing nightly job

### Technical Details
- 22 new files, 3 modified
- 4 new DB tables: `comments`, `mentions`, `webhook_events`, `engagement_counts`
- 11 new API routes under `/api/comments/`, `/api/mentions/`, `/api/webhooks/`
- 7 new React components
- New OAuth scope: `instagram_manage_comments`
- New env var: `WEBHOOK_VERIFY_TOKEN`

### Webhook Setup (pending)
1. Add `WEBHOOK_VERIFY_TOKEN=<random-string>` to `.env.local` on VM
2. Meta App Dashboard > Webhooks > set callback URL `https://insta.mjoln1r.com/api/webhooks/instagram`
3. Subscribe to `comments` and `mentions` fields

---

## Phase 3: Content Planning & Research 🔜 NEXT

**Status:** Not started

### Planned Features

#### Hashtag Research Tool
- Search Instagram API for hashtags, see top/recent media
- Cross-reference with your own performance data
- "These hashtags actually work for your account" insights
- Competitor hashtag analysis

#### AI Caption Generation ("Write Like Me")
- Use existing ai_version → final_version training pairs as fine-tuning data
- AI generates captions that match your editing patterns and voice
- Voice consistency scoring before publishing
- A/B style testing (which voice patterns get better engagement)
- **This is the unique moat** — no competitor has this

#### Content Calendar Enhancements
- Drag-and-drop rescheduling on calendar
- Recurring post templates
- Content series planning
- Content gaps detection

#### DM Inbox
- Read and respond to DMs (webhook infrastructure from Phase 2 already supports this)
- The messaging API is webhook-only with no history, so only sees messages from enablement forward

### Permissions Needed
- `instagram_manage_messages` (for DMs)

---

## Phase 4: Multi-Account & Monetisation 💰

**Status:** Not started

### Planned Features

#### User Authentication
- Add login system (Supabase Auth or NextAuth)
- Currently single-user with no auth layer
- Session management, password reset, etc.

#### Multi-Account Support
- One user manages multiple Instagram accounts
- All tables scoped by account
- Account switcher in UI

#### Tiered Pricing
- **Free tier:** 1 account, analytics only (current Phase 0 features)
- **Pro tier:** Publishing, scheduling, comment inbox, AI captions
- **Business tier:** Multiple accounts, team members, priority support

#### Billing Integration
- Stripe for payment processing
- Subscription management
- Usage tracking

### Technical Requirements
- Facebook App Review (required for serving accounts beyond the developer's own)
- Privacy policy and terms of service
- Demo video for App Review submission
- Production-grade error handling and monitoring

---

## Architecture Notes

### Rate Limits
- Meta Graph API: ~200 calls/user/hour
- Publishing: 100 posts per 24h per account
- Comment sync uses 1 API call per post (with field expansion for replies)
- All API calls use 2-second delays for rate limiting

### Background Processing Pattern
Long operations return immediately with `{ syncId, status: "running" }` and process in the background. Frontend polls status endpoint. Required due to Cloudflare 100-second timeout.

### Infrastructure
- Self-hosted on Ubuntu VM via Cloudflare Tunnel
- Supabase PostgreSQL + Storage
- Systemd timers for cron jobs (nightly sync at 3am UTC, publish scheduler every minute)
- No external dependencies beyond Next.js, React, Supabase client

### Key Differentiator
The voice refinement loop (ai_version → final_version training pairs) is unique. Buffer doesn't learn your voice. Later doesn't track how you edit AI drafts. This training data powers Phase 3's "Write Like Me" AI caption generation — the feature that makes this platform worth paying for.
