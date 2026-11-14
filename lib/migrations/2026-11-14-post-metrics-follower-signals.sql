-- Phase 1 richer metrics: per-post follower signals from Graph API v24.
-- Apply in Supabase SQL Editor. Safe and additive: nullable columns, no
-- backfill, no rewrite of existing rows. NULL means "Meta sent no value"
-- (not requested for that media type, or not available), never zero.
--
-- The app copes with these columns being absent (lib/post-metrics.js retries
-- inserts without them; lib/pulse.js reads without them), so this can be
-- applied before or after the code deploys. Apply it first to start
-- collecting from the next metrics sync.

ALTER TABLE public.post_metrics
  ADD COLUMN IF NOT EXISTS follows INTEGER,
  ADD COLUMN IF NOT EXISTS profile_visits INTEGER,
  ADD COLUMN IF NOT EXISTS profile_activity INTEGER,
  ADD COLUMN IF NOT EXISTS profile_activity_breakdown JSONB,
  ADD COLUMN IF NOT EXISTS reposts INTEGER,
  ADD COLUMN IF NOT EXISTS total_views INTEGER;

COMMENT ON COLUMN public.post_metrics.follows IS
  'Accounts that followed from this post (FEED images and carousels only; NULL for Reels).';
COMMENT ON COLUMN public.post_metrics.profile_visits IS
  'Profile visits from this post (FEED images and carousels only).';
COMMENT ON COLUMN public.post_metrics.profile_activity IS
  'Sum of profile actions (bio link, call, email, directions...) from this post.';
COMMENT ON COLUMN public.post_metrics.profile_activity_breakdown IS
  'profile_activity split by action_type, e.g. {"BIO_LINK_CLICKED": 2}. NULL when Meta sent none.';
COMMENT ON COLUMN public.post_metrics.reposts IS
  'Times this post was reposted (FEED and REELS).';
COMMENT ON COLUMN public.post_metrics.total_views IS
  'Views across all surfaces incl. Facebook crossposts and boosted views (FEED and REELS).';

-- Rollback (drops collected data in these columns only):
-- ALTER TABLE public.post_metrics
--   DROP COLUMN IF EXISTS follows, DROP COLUMN IF EXISTS profile_visits,
--   DROP COLUMN IF EXISTS profile_activity, DROP COLUMN IF EXISTS profile_activity_breakdown,
--   DROP COLUMN IF EXISTS reposts, DROP COLUMN IF EXISTS total_views;
