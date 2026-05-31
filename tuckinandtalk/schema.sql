-- Tuckin and Talk Analytics — Supabase Schema
-- Apply via: Supabase MCP apply_migration or psql
-- All tables use RLS with deny-all policy for anon role.
-- Server-side code uses the service role key which bypasses RLS.

-- tat_accounts: OAuth token for @tuckinandtalk
CREATE TABLE IF NOT EXISTS tat_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_user_id text NOT NULL,
  username text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  facebook_page_id text,
  followers_count integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tat_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY tat_accounts_deny_anon ON tat_accounts FOR ALL TO anon USING (false);

-- tat_weekly_snapshots: weekly account-level heartbeat
CREATE TABLE IF NOT EXISTS tat_weekly_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  reach_total integer,
  reach_follower integer,
  reach_non_follower integer,
  views_total integer,
  views_feed integer,
  views_reels integer,
  views_story integer,
  saves integer,
  shares integer,
  accounts_engaged integer,
  followers_count integer,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tat_weekly_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tat_weekly_snapshots_deny_anon ON tat_weekly_snapshots FOR ALL TO anon USING (false);

-- tat_post_metrics: per-post insights
CREATE TABLE IF NOT EXISTS tat_post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instagram_media_id text NOT NULL UNIQUE,
  caption text,
  media_type text,
  media_product_type text,
  permalink text,
  published_at timestamptz,
  reach integer,
  reach_follower integer,
  reach_non_follower integer,
  views integer,
  saves integer,
  shares integer,
  reposts integer,
  like_count integer,
  comments_count integer,
  profile_visits integer,
  follows integer,
  reels_skip_rate numeric(5,2),
  reels_avg_watch_time numeric(8,2),
  total_interactions integer,
  fetched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tat_post_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY tat_post_metrics_deny_anon ON tat_post_metrics FOR ALL TO anon USING (false);

-- tat_hashtag_config: user-configured hashtags for monthly audit
CREATE TABLE IF NOT EXISTS tat_hashtag_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag text NOT NULL UNIQUE,
  tier text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tat_hashtag_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY tat_hashtag_config_deny_anon ON tat_hashtag_config FOR ALL TO anon USING (false);

-- tat_hashtag_audits: monthly audit results per hashtag
CREATE TABLE IF NOT EXISTS tat_hashtag_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hashtag text NOT NULL,
  audit_date date NOT NULL,
  top_posts_count integer,
  median_likes numeric,
  median_comments numeric,
  median_engagement numeric,
  tier text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tat_hashtag_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY tat_hashtag_audits_deny_anon ON tat_hashtag_audits FOR ALL TO anon USING (false);

-- tat_competitor_config: competitor handles to track
CREATE TABLE IF NOT EXISTS tat_competitor_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  display_name text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE tat_competitor_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY tat_competitor_config_deny_anon ON tat_competitor_config FOR ALL TO anon USING (false);

-- tat_competitor_snapshots: monthly competitor benchmark snapshots
CREATE TABLE IF NOT EXISTS tat_competitor_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  snapshot_date date NOT NULL,
  followers_count integer,
  media_count integer,
  median_engagement_rate numeric(8,4),
  recent_posts jsonb,
  created_at timestamptz DEFAULT now(),
  -- One row per competitor per day; the snapshot endpoint upserts on this.
  CONSTRAINT tat_competitor_snapshots_username_snapshot_date_key
    UNIQUE (username, snapshot_date)
);

ALTER TABLE tat_competitor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY tat_competitor_snapshots_deny_anon ON tat_competitor_snapshots FOR ALL TO anon USING (false);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tat_weekly_snapshots_week_start
  ON tat_weekly_snapshots(week_start DESC);

CREATE INDEX IF NOT EXISTS idx_tat_post_metrics_published_at
  ON tat_post_metrics(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_tat_post_metrics_media_id
  ON tat_post_metrics(instagram_media_id);

CREATE INDEX IF NOT EXISTS idx_tat_hashtag_audits_hashtag
  ON tat_hashtag_audits(hashtag, audit_date DESC);

CREATE INDEX IF NOT EXISTS idx_tat_competitor_snapshots_username
  ON tat_competitor_snapshots(username, snapshot_date DESC);
