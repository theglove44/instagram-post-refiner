# Voice Workshop — Roadmap

Last Updated: July 2026

## Vision

A personal **tone-of-voice workshop** for Tuck In and Talk.

One job: turn messy notes into a final caption in Chris's voice, remember how he edits, and hand the final to Google Keep so Michelle can post in the Instagram app.

Photos stay in Keep. Instagram publish, metrics, inbox, and SaaS multi-tenant work are **cold** (code kept, not product).

---

## Phase 0: Simplified shell ✅ DONE

**Status:** Complete (2026-07-24)

### Done
- Sidebar cut to Workshop + History + Settings
- Workshop screen: notes → AI draft → final → save pair → **Copy final for Keep**
- History: final-first, Copy for Keep on list and detail
- Metrics / publish / engagement nav removed (routes still exist, cold)

### Explicit non-goals
- No in-app LLM yet
- No photo upload
- No Instagram publish UI
- No performance dashboards in nav

---

## Phase 1: AI inside the app ✅ DONE

**Status:** Complete (2026-07-25)

### Done
- `POST /api/caption/generate` — OpenAI + on-disk voice pack (skill + gold + archive lessons)
- Workshop **Generate caption** button fills AI draft; paste path still works
- Nullable `notes` column on `posts` (migration `2026-07-25-posts-notes.sql`) logged with each pair
- Env: `OPENAI_API_KEY`, optional `OPENAI_CAPTION_MODEL` (default `gpt-4o`)

### Success
- Notes + Generate produces a draft without leaving the app
- Pair still saves as notes + AI + final for training

---

## Phase 2: Parked

Only if still needed after Phase 1:

- Photo attach in app (optional Keep replacement for media)
- Shared read-only link for Michelle
- Re-enable publish/schedule
- Fine-tuning a custom model (unlikely to beat skill + examples)

---

## Cold surfaces (not product)

These remain in the repo for recovery, not in the main nav:

- Compose, Calendar, Drafts, Queue
- Performance dashboards, Hashtags, Audience, Timing
- Engagement inbox / mentions
- Gallery, full Voice Analysis page (URL still works if needed)

Do not expand SaaS/monetisation work until the daily voice loop is solid.
