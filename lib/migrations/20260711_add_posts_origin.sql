-- Classify post rows before voice/training analysis.
-- Safe to run repeatedly. Existing importer rows have a stable `ig_` post_id.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS origin TEXT;

UPDATE posts
SET origin = CASE
  WHEN left(post_id, 3) = 'ig_' THEN 'instagram_import'
  ELSE 'training_pair'
END
WHERE origin IS NULL;

ALTER TABLE posts ALTER COLUMN origin SET DEFAULT 'training_pair';
ALTER TABLE posts ALTER COLUMN origin SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'posts_origin_check'
      AND conrelid = 'posts'::regclass
  ) THEN
    ALTER TABLE posts
      ADD CONSTRAINT posts_origin_check
      CHECK (origin IN ('training_pair', 'instagram_import'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS posts_origin_idx ON posts(origin);
