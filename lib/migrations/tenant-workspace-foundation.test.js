const fs = require('fs');
const path = require('path');

const migration = fs.readFileSync(
  path.join(__dirname, '2026-07-12-tenant-workspace-foundation.sql'),
  'utf8'
);

const legacyTables = [
  'posts', 'instagram_accounts', 'post_metrics', 'sync_status',
  'account_insights_cache', 'account_snapshots', 'match_suggestions',
  'hashtag_library', 'story_metrics', 'comments', 'mentions',
  'webhook_events', 'engagement_counts', 'scheduled_posts', 'media_uploads',
  'publishing_log', 'caption_templates',
];

describe('tenant/workspace migration SQL contract', () => {
  test('creates auth-backed tenant tables with RLS', () => {
    for (const table of ['profiles', 'workspaces', 'workspace_members']) {
      expect(migration).toMatch(new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`));
      expect(migration).toMatch(new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`));
    }
    expect(migration).toContain('REFERENCES auth.users(id)');
  });

  test('inventories every legacy table for workspace discrimination', () => {
    for (const table of legacyTables) {
      expect(migration).toContain(`'${table}'`);
    }
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS workspace_id UUID');
  });

  test('uses authenticated membership predicates and safe update checks', () => {
    expect(migration).toContain('TO authenticated');
    expect(migration).toContain('FROM public.workspace_members');
    expect(migration).toMatch(/FOR UPDATE TO authenticated[\s\S]+USING[\s\S]+WITH CHECK/);
    expect(migration).not.toMatch(/auth\.role\s*\(/);
    expect(migration).not.toMatch(/TO anon/);
  });

  test('does not guess a bootstrap user or mutate historical tenant values', () => {
    expect(migration).not.toMatch(/FROM auth\.users/);
    expect(migration).not.toMatch(/UPDATE public\.(posts|instagram_accounts|post_metrics)/);
    expect(migration).not.toMatch(/ADD COLUMN IF NOT EXISTS workspace_id UUID NOT NULL/);
  });

  test('keeps secret tables unavailable to browser roles', () => {
    expect(migration).toContain(
      'REVOKE ALL ON public.instagram_accounts, public.webhook_events FROM anon, authenticated'
    );
  });

  test('adds composite account integrity without security-definer helpers', () => {
    expect(migration).toContain('FOREIGN KEY (workspace_id, instagram_account_id)');
    expect(migration).toContain('REFERENCES public.instagram_accounts(workspace_id, id)');
    expect(migration).not.toMatch(/SECURITY DEFINER/i);
  });

  test('preserves tenant alignment across all five existing parent relations', () => {
    for (const constraint of [
      'post_metrics_workspace_post_fkey',
      'match_suggestions_workspace_post_fkey',
      'scheduled_posts_workspace_source_post_fkey',
      'media_uploads_workspace_scheduled_post_fkey',
      'publishing_log_workspace_scheduled_post_fkey',
    ]) {
      expect(migration).toContain(`'${constraint}'`);
    }
    expect(migration).toContain('FOREIGN KEY (workspace_id, %I)');
  });
});
