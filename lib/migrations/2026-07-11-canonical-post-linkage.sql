-- Workstream 2: canonical post identity and cross-flow linkage.
-- Additive/idempotent only. No posts.id or posts.post_id values are rewritten.

ALTER TABLE match_suggestions
  ADD COLUMN IF NOT EXISTS instagram_published_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE scheduled_posts
  ADD COLUMN IF NOT EXISTS source_post_id BIGINT REFERENCES posts(id);

CREATE INDEX IF NOT EXISTS scheduled_posts_source_post_id_idx
  ON scheduled_posts(source_post_id);
