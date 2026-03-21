-- =====================================================
-- Engagement Hub Tables (Phase 2)
-- Run this SQL in the Supabase SQL Editor
-- =====================================================

-- Cache of all comments across posts, with reply threads and moderation status
CREATE TABLE comments (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  instagram_comment_id TEXT NOT NULL UNIQUE,
  instagram_media_id TEXT NOT NULL,       -- Which post this comment is on
  parent_comment_id TEXT,                 -- NULL for top-level, parent's instagram_comment_id for replies
  username TEXT NOT NULL,
  text TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  is_reply BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  is_own_reply BOOLEAN NOT NULL DEFAULT false,  -- True if reply was from our account
  reply_status TEXT NOT NULL DEFAULT 'unreplied',  -- unreplied, replied, ignored (meaningful on top-level only)
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX comments_media_id_idx ON comments(instagram_media_id);
CREATE INDEX comments_parent_idx ON comments(parent_comment_id);
CREATE INDEX comments_reply_status_idx ON comments(reply_status);
CREATE INDEX comments_timestamp_idx ON comments(timestamp DESC);
CREATE INDEX comments_username_idx ON comments(username);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read comments" ON comments
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert comments" ON comments
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update comments" ON comments
  FOR UPDATE USING (true);
CREATE POLICY "Allow public delete comments" ON comments
  FOR DELETE USING (true);

-- Mentions and tags from other accounts
CREATE TABLE mentions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  mention_type TEXT NOT NULL,             -- 'tag' (photo tag) or 'caption' (@mention in caption)
  instagram_media_id TEXT NOT NULL,
  media_url TEXT,                         -- Thumbnail URL if available
  media_type TEXT,                        -- IMAGE, VIDEO, CAROUSEL_ALBUM
  permalink TEXT,
  mentioned_by TEXT,                      -- Username who tagged/mentioned us
  caption TEXT,                           -- Caption of the mentioning post
  timestamp TIMESTAMP WITH TIME ZONE,
  reply_status TEXT NOT NULL DEFAULT 'unseen',  -- unseen, seen, replied
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(instagram_media_id, mention_type)
);

CREATE INDEX mentions_type_idx ON mentions(mention_type);
CREATE INDEX mentions_timestamp_idx ON mentions(timestamp DESC);
CREATE INDEX mentions_reply_status_idx ON mentions(reply_status);

ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read mentions" ON mentions
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert mentions" ON mentions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update mentions" ON mentions
  FOR UPDATE USING (true);
CREATE POLICY "Allow public delete mentions" ON mentions
  FOR DELETE USING (true);

-- Raw webhook event log for debugging and reprocessing
CREATE TABLE webhook_events (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  event_type TEXT NOT NULL,               -- comment, mention, message
  instagram_user_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX webhook_events_type_idx ON webhook_events(event_type);
CREATE INDEX webhook_events_processed_idx ON webhook_events(processed);
CREATE INDEX webhook_events_received_idx ON webhook_events(received_at DESC);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read webhook_events" ON webhook_events
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert webhook_events" ON webhook_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update webhook_events" ON webhook_events
  FOR UPDATE USING (true);

-- Denormalized counters for sidebar badge (avoids COUNT queries on every page nav)
CREATE TABLE engagement_counts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  count_type TEXT NOT NULL UNIQUE,        -- unreplied_comments, unseen_mentions
  count INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE engagement_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read engagement_counts" ON engagement_counts
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert engagement_counts" ON engagement_counts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update engagement_counts" ON engagement_counts
  FOR UPDATE USING (true);

-- Seed initial counter rows
INSERT INTO engagement_counts (count_type, count) VALUES ('unreplied_comments', 0);
INSERT INTO engagement_counts (count_type, count) VALUES ('unseen_mentions', 0);
