# Phase 1: in-app caption generate

## What shipped

- `POST /api/caption/generate` builds a system prompt from `.codex/skills/instagram-posts/**` and calls OpenAI.
- Workshop **Generate caption** fills AI Draft; paste fallback remains.
- `posts.notes` column (nullable) saved via `/api/log` when notes are non-empty.

## Config

```bash
OPENAI_API_KEY=sk-...
OPENAI_CAPTION_MODEL=gpt-4o   # optional
```

## Migration

Run in Supabase SQL Editor:

`lib/migrations/2026-07-25-posts-notes.sql`

## Deploy checklist

1. Apply migration
2. Set `OPENAI_API_KEY` on `tuckinandtalk` `.env.local`
3. Pull, build, restart `instagram-logger`
