-- Additive tenant/workspace foundation.
--
-- Safe first stage for existing production data:
--   * all legacy tenant columns remain nullable;
--   * no auth user or workspace is guessed;
--   * service_role continues to bypass RLS for existing server routes/jobs.
--
-- Complete the explicit bootstrap/backfill in lib/migrations/README.md before
-- making workspace_id NOT NULL or switching application routes to user clients.

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS workspace_members_user_workspace_idx
  ON public.workspace_members(user_id, workspace_id);

-- Every legacy application row gets a direct workspace discriminator. Direct
-- keys keep RLS predicates indexable and avoid trusting joins through mutable
-- child rows.
DO $migration$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'posts', 'instagram_accounts', 'post_metrics', 'sync_status',
    'account_insights_cache', 'account_snapshots', 'match_suggestions',
    'hashtag_library', 'story_metrics', 'comments', 'mentions',
    'webhook_events', 'engagement_counts', 'scheduled_posts', 'media_uploads',
    'publishing_log', 'caption_templates'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE RESTRICT',
      table_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(workspace_id)',
      table_name || '_workspace_id_idx', table_name
    );
  END LOOP;
END
$migration$;

-- Rows tied to a Meta account also receive a stable internal account FK.
-- Historical instagram_user_id text is retained for compatibility/backfill.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'instagram_accounts_workspace_id_id_key'
      AND conrelid = 'public.instagram_accounts'::regclass
  ) THEN
    ALTER TABLE public.instagram_accounts
      ADD CONSTRAINT instagram_accounts_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;
END
$migration$;

DO $migration$
DECLARE
  table_name TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'posts', 'post_metrics', 'sync_status', 'account_insights_cache',
    'account_snapshots', 'match_suggestions', 'story_metrics', 'comments',
    'mentions', 'webhook_events', 'engagement_counts', 'scheduled_posts'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS instagram_account_id BIGINT',
      table_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(instagram_account_id)',
      table_name || '_instagram_account_id_idx', table_name
    );

    constraint_name := table_name || '_workspace_instagram_account_fkey';
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = constraint_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (workspace_id, instagram_account_id) REFERENCES public.instagram_accounts(workspace_id, id) ON DELETE RESTRICT NOT VALID',
        table_name, constraint_name
      );
    END IF;
  END LOOP;
END
$migration$;

-- Existing parent FKs remain for compatibility. Composite FKs add tenant
-- alignment so authenticated callers cannot link their row to another
-- workspace's parent. NOT VALID avoids a full historical scan during stage 1.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'posts_workspace_id_id_key'
      AND conrelid = 'public.posts'::regclass
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'scheduled_posts_workspace_id_id_key'
      AND conrelid = 'public.scheduled_posts'::regclass
  ) THEN
    ALTER TABLE public.scheduled_posts
      ADD CONSTRAINT scheduled_posts_workspace_id_id_key UNIQUE (workspace_id, id);
  END IF;
END
$migration$;

DO $migration$
DECLARE
  relation RECORD;
BEGIN
  FOR relation IN
    SELECT * FROM (VALUES
      ('post_metrics', 'post_id', 'posts', 'post_metrics_workspace_post_fkey', 'CASCADE'),
      ('match_suggestions', 'post_id', 'posts', 'match_suggestions_workspace_post_fkey', 'CASCADE'),
      ('scheduled_posts', 'source_post_id', 'posts', 'scheduled_posts_workspace_source_post_fkey', 'NO ACTION'),
      ('media_uploads', 'scheduled_post_id', 'scheduled_posts', 'media_uploads_workspace_scheduled_post_fkey', 'CASCADE'),
      ('publishing_log', 'scheduled_post_id', 'scheduled_posts', 'publishing_log_workspace_scheduled_post_fkey', 'SET NULL (scheduled_post_id)')
    ) AS links(child_table, child_column, parent_table, constraint_name, delete_action)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = relation.constraint_name
        AND conrelid = format('public.%I', relation.child_table)::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (workspace_id, %I) REFERENCES public.%I(workspace_id, id) ON DELETE %s NOT VALID',
        relation.child_table, relation.constraint_name, relation.child_column,
        relation.parent_table, relation.delete_action
      );
    END IF;
  END LOOP;
END
$migration$;

-- Tenant-aware candidate keys. Existing global constraints remain in place in
-- this additive stage; later migrations may replace them after route cutover.
CREATE UNIQUE INDEX IF NOT EXISTS instagram_accounts_workspace_user_uidx
  ON public.instagram_accounts(workspace_id, instagram_user_id)
  WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS posts_workspace_post_id_uidx
  ON public.posts(workspace_id, post_id) WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS post_metrics_workspace_post_fetched_uidx
  ON public.post_metrics(workspace_id, post_id, fetched_at)
  WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS account_insights_workspace_type_uidx
  ON public.account_insights_cache(workspace_id, instagram_user_id, insight_type)
  WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS account_snapshots_workspace_date_uidx
  ON public.account_snapshots(workspace_id, instagram_user_id, snapshot_date)
  WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS match_suggestions_workspace_media_uidx
  ON public.match_suggestions(workspace_id, post_id, instagram_media_id)
  WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS hashtag_library_workspace_hashtag_uidx
  ON public.hashtag_library(workspace_id, hashtag) WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS story_metrics_workspace_media_uidx
  ON public.story_metrics(workspace_id, instagram_media_id) WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS comments_workspace_comment_uidx
  ON public.comments(workspace_id, instagram_comment_id) WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS mentions_workspace_media_type_uidx
  ON public.mentions(workspace_id, instagram_media_id, mention_type)
  WHERE workspace_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS engagement_counts_workspace_type_uidx
  ON public.engagement_counts(workspace_id, count_type) WHERE workspace_id IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- New tables are not assumed to be Data API-exposed. Grants are explicit and
-- narrow. Membership provisioning remains service_role-only for this stage.
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;
GRANT ALL ON public.profiles, public.workspaces, public.workspace_members TO service_role;

DROP POLICY IF EXISTS "profiles_select_self" ON public.profiles;
CREATE POLICY "profiles_select_self" ON public.profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "profiles_insert_self" ON public.profiles;
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "workspaces_select_member" ON public.workspaces;
CREATE POLICY "workspaces_select_member" ON public.workspaces FOR SELECT TO authenticated
  USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = (SELECT auth.uid())
    )
  );

-- Self-only membership SELECT avoids recursive workspace_members RLS. Owner/admin
-- membership management stays behind service_role until a reviewed RPC exists.
DROP POLICY IF EXISTS "workspace_members_select_self" ON public.workspace_members;
CREATE POLICY "workspace_members_select_self" ON public.workspace_members FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

-- Ensure legacy permissive policy names cannot defeat tenant policies if an old
-- environment missed the earlier security-hardening tail of the base schemas.
DROP POLICY IF EXISTS "Allow public read instagram_accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Allow public insert instagram_accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Allow public update instagram_accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Allow public delete instagram_accounts" ON public.instagram_accounts;
DROP POLICY IF EXISTS "Allow public read engagement_counts" ON public.engagement_counts;
DROP POLICY IF EXISTS "Allow public insert engagement_counts" ON public.engagement_counts;
DROP POLICY IF EXISTS "Allow public update engagement_counts" ON public.engagement_counts;

-- Instagram tokens and raw webhook payloads remain service_role-only. All other
-- legacy tables get membership-scoped CRUD policies. Existing deny(false)
-- policies are harmless because permissive policies combine with OR.
DO $migration$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'posts', 'post_metrics', 'sync_status', 'account_insights_cache',
    'account_snapshots', 'match_suggestions', 'hashtag_library', 'story_metrics',
    'comments', 'mentions', 'engagement_counts', 'scheduled_posts',
    'media_uploads', 'publishing_log', 'caption_templates'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_select_member', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))',
      table_name || '_select_member', table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_insert_member', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))',
      table_name || '_insert_member', table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_update_member', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid()))) WITH CHECK (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))',
      table_name || '_update_member', table_name
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_delete_member', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = (SELECT auth.uid())))',
      table_name || '_delete_member', table_name
    );
  END LOOP;
END
$migration$;

-- Explicitly preserve server-only behavior for secret/raw-event tables.
ALTER TABLE public.instagram_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instagram_accounts, public.webhook_events FROM anon, authenticated;
