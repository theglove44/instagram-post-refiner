-- =====================================================
-- Publishing & Scheduling Tables (Phase 1)
-- Run this SQL in the Supabase SQL Editor
-- =====================================================

-- Central table for content publishing pipeline.
-- Every post flows through here: draft -> scheduled -> publishing -> published
CREATE TABLE scheduled_posts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  -- Content
  caption TEXT NOT NULL DEFAULT '',
  media_type TEXT NOT NULL DEFAULT 'IMAGE',  -- IMAGE, CAROUSEL, REELS, STORIES
  alt_text TEXT,
  user_tags JSONB,                           -- [{ username, x, y }]
  cover_url TEXT,                            -- Reel cover image
  -- Scheduling
  status TEXT NOT NULL DEFAULT 'draft',      -- draft, scheduled, publishing, published, failed, cancelled
  scheduled_at TIMESTAMP WITH TIME ZONE,
  timezone TEXT DEFAULT 'Europe/London',
  -- Publishing
  ig_container_id TEXT,                      -- Meta container ID once created
  ig_media_id TEXT,                          -- Final published media ID
  ig_permalink TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  -- Linkage to voice training workflow
  source_post_id BIGINT REFERENCES posts(id),
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  publish_error TEXT,
  retry_count INT DEFAULT 0
);

CREATE INDEX scheduled_posts_status_idx ON scheduled_posts(status);
CREATE INDEX scheduled_posts_scheduled_at_idx ON scheduled_posts(scheduled_at);
CREATE INDEX scheduled_posts_ig_media_id_idx ON scheduled_posts(ig_media_id);

ALTER TABLE scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access scheduled_posts" ON scheduled_posts FOR ALL USING (false);

-- Track uploaded media files and their public URLs
CREATE TABLE media_uploads (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  scheduled_post_id BIGINT REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,                          -- bytes
  mime_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,                -- Supabase Storage path
  public_url TEXT NOT NULL,                  -- Publicly accessible URL for Meta API
  media_type TEXT NOT NULL DEFAULT 'IMAGE',  -- IMAGE, VIDEO
  sort_order INT NOT NULL DEFAULT 0,         -- Carousel ordering
  width INT,
  height INT,
  duration_seconds DECIMAL(6,2),             -- Video only
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX media_uploads_post_idx ON media_uploads(scheduled_post_id);

ALTER TABLE media_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access media_uploads" ON media_uploads FOR ALL USING (false);

-- Audit trail for publish attempts (debugging + history UI)
CREATE TABLE publishing_log (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  scheduled_post_id BIGINT REFERENCES scheduled_posts(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                      -- container_created, status_check, published, failed, retry
  details JSONB,                             -- API responses, error details
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX publishing_log_post_idx ON publishing_log(scheduled_post_id);
CREATE INDEX publishing_log_created_idx ON publishing_log(created_at DESC);

ALTER TABLE publishing_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access publishing_log" ON publishing_log FOR ALL USING (false);

-- Saved caption templates for reuse
CREATE TABLE caption_templates (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name TEXT NOT NULL,
  caption TEXT NOT NULL,
  category TEXT,                             -- e.g. "food review", "reel hook"
  hashtag_categories JSONB,                  -- ["food", "london"] - references hashtag_library categories
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE caption_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Deny anon access caption_templates" ON caption_templates FOR ALL USING (false);

-- =====================================================
-- Migration versions (run these if tables already exist)
-- =====================================================
-- CREATE TABLE IF NOT EXISTS scheduled_posts ( ... );
-- CREATE TABLE IF NOT EXISTS media_uploads ( ... );
-- CREATE TABLE IF NOT EXISTS publishing_log ( ... );
-- CREATE TABLE IF NOT EXISTS caption_templates ( ... );
