-- Create posts table for Instagram Post Logger
-- Run this SQL in the Supabase SQL Editor to set up your database

CREATE TABLE posts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  post_id TEXT NOT NULL UNIQUE DEFAULT (
    (EXTRACT(EPOCH FROM now()) * 1000)::bigint::text
  ),
  topic TEXT NOT NULL DEFAULT 'Untitled',
  ai_version TEXT NOT NULL,
  final_version TEXT NOT NULL,
  edit_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- Instagram integration fields
  instagram_media_id TEXT,
  instagram_permalink TEXT,
  published_at TIMESTAMP WITH TIME ZONE
);

-- Create index on created_at for efficient ordering
CREATE INDEX posts_created_at_idx ON posts(created_at DESC);

-- Create index on post_id for quick lookups
CREATE INDEX posts_post_id_idx ON posts(post_id);

-- Create index on instagram_media_id for metrics lookups
CREATE INDEX posts_instagram_media_id_idx ON posts(instagram_media_id);

-- Enable Row Level Security
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read/write (adjust as needed for your use case)
CREATE POLICY "Allow public read" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON posts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON posts
  FOR UPDATE USING (true);

-- =====================================================
-- Instagram Integration Tables (v2.0)
-- =====================================================

-- Store Instagram account connection
CREATE TABLE instagram_accounts (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  instagram_user_id TEXT NOT NULL UNIQUE,
  instagram_username TEXT,
  access_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  facebook_page_id TEXT,
  connected_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on instagram_accounts
ALTER TABLE instagram_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read instagram_accounts" ON instagram_accounts
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert instagram_accounts" ON instagram_accounts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update instagram_accounts" ON instagram_accounts
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete instagram_accounts" ON instagram_accounts
  FOR DELETE USING (true);

-- Store post performance metrics (NULL = metric not available, not 0)
CREATE TABLE post_metrics (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
  instagram_media_id TEXT NOT NULL,
  -- Engagement metrics (NULL means not available from API)
  impressions INT,
  reach INT,
  views INT,
  likes INT,
  comments INT,
  saves INT,
  shares INT,
  total_interactions INT,
  media_type TEXT,
  -- Calculated metrics
  engagement_rate DECIMAL(5,2),
  -- Tracking
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(post_id, fetched_at)
);

-- Sync status tracking for Data Health
CREATE TABLE sync_status (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sync_type TEXT NOT NULL, -- 'metrics', 'recent', 'insights', 'account'
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'success', 'error'
  posts_processed INT DEFAULT 0,
  metrics_missing INT DEFAULT 0,
  errors_count INT DEFAULT 0,
  error_details JSONB,
  raw_response JSONB -- Store raw API response for debugging
);

CREATE INDEX sync_status_type_idx ON sync_status(sync_type);
CREATE INDEX sync_status_completed_idx ON sync_status(completed_at DESC);

ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read sync_status" ON sync_status
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert sync_status" ON sync_status
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update sync_status" ON sync_status
  FOR UPDATE USING (true);

-- Create index for metrics lookups
CREATE INDEX post_metrics_post_id_idx ON post_metrics(post_id);
CREATE INDEX post_metrics_fetched_at_idx ON post_metrics(fetched_at DESC);

-- Enable RLS on post_metrics
ALTER TABLE post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read post_metrics" ON post_metrics
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert post_metrics" ON post_metrics
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- Migration for existing posts table (run if upgrading)
-- =====================================================
-- ALTER TABLE posts ADD COLUMN IF NOT EXISTS instagram_media_id TEXT;
-- ALTER TABLE posts ADD COLUMN IF NOT EXISTS instagram_permalink TEXT;
-- ALTER TABLE posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE;
-- CREATE INDEX IF NOT EXISTS posts_instagram_media_id_idx ON posts(instagram_media_id);

-- =====================================================
-- Migration: add total_interactions to post_metrics
-- =====================================================
-- ALTER TABLE post_metrics ADD COLUMN IF NOT EXISTS total_interactions INT;

-- =====================================================
-- Migration: add media_type to post_metrics
-- =====================================================
-- ALTER TABLE post_metrics ADD COLUMN IF NOT EXISTS media_type TEXT;

-- =====================================================
-- Account insights cache (reduces Meta API calls)
-- =====================================================

CREATE TABLE account_insights_cache (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  instagram_user_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  data JSONB NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(instagram_user_id, insight_type)
);

ALTER TABLE account_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read account_insights_cache" ON account_insights_cache
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert account_insights_cache" ON account_insights_cache
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update account_insights_cache" ON account_insights_cache
  FOR UPDATE USING (true);

-- =====================================================
-- Migration: add account_insights_cache table
-- =====================================================
-- CREATE TABLE IF NOT EXISTS account_insights_cache (
--   id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
--   instagram_user_id TEXT NOT NULL,
--   insight_type TEXT NOT NULL,
--   data JSONB NOT NULL,
--   fetched_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   UNIQUE(instagram_user_id, insight_type)
-- );
-- ALTER TABLE account_insights_cache ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read account_insights_cache" ON account_insights_cache FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert account_insights_cache" ON account_insights_cache FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public update account_insights_cache" ON account_insights_cache FOR UPDATE USING (true);

-- =====================================================
-- Daily account snapshots for follower/reach tracking
-- =====================================================

CREATE TABLE account_snapshots (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  instagram_user_id TEXT NOT NULL,
  followers_count INT,
  following_count INT,
  media_count INT,
  reach_28d INT,
  accounts_engaged_28d INT,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(instagram_user_id, snapshot_date)
);

CREATE INDEX account_snapshots_date_idx ON account_snapshots(snapshot_date DESC);

ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read account_snapshots" ON account_snapshots
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert account_snapshots" ON account_snapshots
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update account_snapshots" ON account_snapshots
  FOR UPDATE USING (true);

-- =====================================================
-- Migration: add account_snapshots table
-- =====================================================
-- CREATE TABLE IF NOT EXISTS account_snapshots (
--   id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
--   instagram_user_id TEXT NOT NULL,
--   followers_count INT,
--   following_count INT,
--   media_count INT,
--   reach_28d INT,
--   accounts_engaged_28d INT,
--   snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   UNIQUE(instagram_user_id, snapshot_date)
-- );
-- CREATE INDEX IF NOT EXISTS account_snapshots_date_idx ON account_snapshots(snapshot_date DESC);
-- ALTER TABLE account_snapshots ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read account_snapshots" ON account_snapshots FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert account_snapshots" ON account_snapshots FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public update account_snapshots" ON account_snapshots FOR UPDATE USING (true);

-- =====================================================
-- Match suggestions for smart post linking
-- =====================================================

CREATE TABLE match_suggestions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  instagram_media_id TEXT NOT NULL,
  instagram_permalink TEXT,
  instagram_caption TEXT,
  confidence_score DECIMAL(4,3) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(post_id, instagram_media_id)
);

CREATE INDEX match_suggestions_status_idx ON match_suggestions(status);
CREATE INDEX match_suggestions_post_id_idx ON match_suggestions(post_id);

ALTER TABLE match_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read match_suggestions" ON match_suggestions
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert match_suggestions" ON match_suggestions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update match_suggestions" ON match_suggestions
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete match_suggestions" ON match_suggestions
  FOR DELETE USING (true);

-- =====================================================
-- Migration: add match_suggestions table
-- =====================================================
-- CREATE TABLE IF NOT EXISTS match_suggestions (
--   id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
--   post_id BIGINT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
--   instagram_media_id TEXT NOT NULL,
--   instagram_permalink TEXT,
--   instagram_caption TEXT,
--   confidence_score DECIMAL(4,3) NOT NULL,
--   status TEXT NOT NULL DEFAULT 'pending',
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
--   resolved_at TIMESTAMP WITH TIME ZONE,
--   UNIQUE(post_id, instagram_media_id)
-- );
-- CREATE INDEX IF NOT EXISTS match_suggestions_status_idx ON match_suggestions(status);
-- CREATE INDEX IF NOT EXISTS match_suggestions_post_id_idx ON match_suggestions(post_id);
-- ALTER TABLE match_suggestions ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read match_suggestions" ON match_suggestions FOR SELECT USING (true);
-- CREATE POLICY "Allow public insert match_suggestions" ON match_suggestions FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow public update match_suggestions" ON match_suggestions FOR UPDATE USING (true);
-- CREATE POLICY "Allow public delete match_suggestions" ON match_suggestions FOR DELETE USING (true);
