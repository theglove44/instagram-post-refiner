-- Publishing state safety migration (2026-07-11)
-- Run once in Supabase before deploying application code that calls the RPC.

CREATE OR REPLACE FUNCTION claim_scheduled_post_for_publishing(
  p_post_id BIGINT,
  p_allowed_statuses TEXT[],
  p_require_due BOOLEAN DEFAULT FALSE
)
RETURNS SETOF scheduled_posts
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE scheduled_posts
  SET status = 'publishing', updated_at = now()
  WHERE id = p_post_id
    AND status = ANY(p_allowed_statuses)
    AND (NOT p_require_due OR scheduled_at <= now())
  RETURNING *;
$$;

REVOKE ALL ON FUNCTION claim_scheduled_post_for_publishing(BIGINT, TEXT[], BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_scheduled_post_for_publishing(BIGINT, TEXT[], BOOLEAN) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_scheduled_post_for_publishing(BIGINT, TEXT[], BOOLEAN) TO service_role;

ALTER TABLE publishing_log
  DROP CONSTRAINT IF EXISTS publishing_log_scheduled_post_id_fkey;
ALTER TABLE publishing_log
  ADD CONSTRAINT publishing_log_scheduled_post_id_fkey
  FOREIGN KEY (scheduled_post_id) REFERENCES scheduled_posts(id) ON DELETE SET NULL;
