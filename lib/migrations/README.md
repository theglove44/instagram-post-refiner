# Database migrations

Apply migrations in filename order through Supabase SQL Editor or the project's
normal migration runner. Back up production first.

## Tenant/workspace foundation bootstrap

`2026-07-12-tenant-workspace-foundation.sql` intentionally does not infer an
owner from `auth.users`. It adds nullable tenant keys, so existing service-role
routes and cron jobs keep working before auth-aware route cutover.

After applying it, choose the existing Supabase Auth user and workspace UUID
explicitly. Run this transaction with reviewed literal values:

```sql
BEGIN;

INSERT INTO public.profiles (user_id, display_name)
VALUES ('<AUTH_USER_UUID>'::uuid, '<DISPLAY_NAME>')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.workspaces (id, name, slug, created_by)
VALUES (
  '<WORKSPACE_UUID>'::uuid,
  '<WORKSPACE_NAME>',
  '<WORKSPACE_SLUG>',
  '<AUTH_USER_UUID>'::uuid
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspace_members (workspace_id, user_id, role)
VALUES ('<WORKSPACE_UUID>'::uuid, '<AUTH_USER_UUID>'::uuid, 'owner')
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner';

UPDATE public.instagram_accounts
SET workspace_id = '<WORKSPACE_UUID>'::uuid
WHERE workspace_id IS NULL;

-- Backfill direct account references where legacy instagram_user_id exists.
UPDATE public.account_insights_cache row
SET workspace_id = account.workspace_id, instagram_account_id = account.id
FROM public.instagram_accounts account
WHERE row.workspace_id IS NULL
  AND row.instagram_user_id = account.instagram_user_id;
UPDATE public.account_snapshots row
SET workspace_id = account.workspace_id, instagram_account_id = account.id
FROM public.instagram_accounts account
WHERE row.workspace_id IS NULL
  AND row.instagram_user_id = account.instagram_user_id;
UPDATE public.story_metrics row
SET workspace_id = account.workspace_id, instagram_account_id = account.id
FROM public.instagram_accounts account
WHERE row.workspace_id IS NULL
  AND row.instagram_user_id = account.instagram_user_id;
UPDATE public.webhook_events row
SET workspace_id = account.workspace_id, instagram_account_id = account.id
FROM public.instagram_accounts account
WHERE row.workspace_id IS NULL
  AND row.instagram_user_id = account.instagram_user_id;

-- Current production is single-workspace. Scope remaining historical rows to
-- the reviewed workspace; route work must assign these columns on every write.
DO $backfill$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'posts', 'post_metrics', 'sync_status', 'match_suggestions',
    'hashtag_library', 'comments', 'mentions', 'engagement_counts',
    'scheduled_posts', 'media_uploads', 'publishing_log', 'caption_templates'
  ] LOOP
    EXECUTE format(
      'UPDATE public.%I SET workspace_id = $1 WHERE workspace_id IS NULL',
      table_name
    ) USING '<WORKSPACE_UUID>'::uuid;
  END LOOP;
END
$backfill$;

-- Account association needs human review when more than one account exists.
-- This block refuses to run unless the reviewed workspace has exactly one.
DO $account_backfill$
DECLARE
  account_id bigint;
  account_count integer;
  table_name text;
BEGIN
  SELECT count(*), min(id)
  INTO account_count, account_id
  FROM public.instagram_accounts
  WHERE workspace_id = '<WORKSPACE_UUID>'::uuid;

  IF account_count <> 1 THEN
    RAISE EXCEPTION 'Expected one Instagram account; found %', account_count;
  END IF;

  FOREACH table_name IN ARRAY ARRAY[
    'posts', 'post_metrics', 'sync_status', 'account_insights_cache',
    'account_snapshots', 'match_suggestions', 'story_metrics', 'comments',
    'mentions', 'webhook_events', 'engagement_counts', 'scheduled_posts'
  ] LOOP
    EXECUTE format(
      'UPDATE public.%I SET instagram_account_id = $1 WHERE workspace_id = $2 AND instagram_account_id IS NULL',
      table_name
    ) USING account_id, '<WORKSPACE_UUID>'::uuid;
  END LOOP;
END
$account_backfill$;

COMMIT;
```

Verify before any NOT NULL/finalization migration:

```sql
SELECT 'posts' AS table_name, count(*) FROM public.posts WHERE workspace_id IS NULL
UNION ALL SELECT 'instagram_accounts', count(*) FROM public.instagram_accounts WHERE workspace_id IS NULL
UNION ALL SELECT 'post_metrics', count(*) FROM public.post_metrics WHERE workspace_id IS NULL
UNION ALL SELECT 'sync_status', count(*) FROM public.sync_status WHERE workspace_id IS NULL
UNION ALL SELECT 'account_insights_cache', count(*) FROM public.account_insights_cache WHERE workspace_id IS NULL
UNION ALL SELECT 'account_snapshots', count(*) FROM public.account_snapshots WHERE workspace_id IS NULL
UNION ALL SELECT 'match_suggestions', count(*) FROM public.match_suggestions WHERE workspace_id IS NULL
UNION ALL SELECT 'hashtag_library', count(*) FROM public.hashtag_library WHERE workspace_id IS NULL
UNION ALL SELECT 'story_metrics', count(*) FROM public.story_metrics WHERE workspace_id IS NULL
UNION ALL SELECT 'comments', count(*) FROM public.comments WHERE workspace_id IS NULL
UNION ALL SELECT 'mentions', count(*) FROM public.mentions WHERE workspace_id IS NULL
UNION ALL SELECT 'webhook_events', count(*) FROM public.webhook_events WHERE workspace_id IS NULL
UNION ALL SELECT 'engagement_counts', count(*) FROM public.engagement_counts WHERE workspace_id IS NULL
UNION ALL SELECT 'scheduled_posts', count(*) FROM public.scheduled_posts WHERE workspace_id IS NULL
UNION ALL SELECT 'media_uploads', count(*) FROM public.media_uploads WHERE workspace_id IS NULL
UNION ALL SELECT 'publishing_log', count(*) FROM public.publishing_log WHERE workspace_id IS NULL
UNION ALL SELECT 'caption_templates', count(*) FROM public.caption_templates WHERE workspace_id IS NULL;
```

Do not add NOT NULL constraints until this query returns zero for every table and
all API/cron writes populate `workspace_id` plus applicable
`instagram_account_id`.
