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
