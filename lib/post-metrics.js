/**
 * Writing post_metrics snapshots.
 *
 * The follower-signal columns arrive with
 * lib/migrations/2026-11-14-post-metrics-follower-signals.sql. Until that is
 * applied, inserting them fails the whole row — which would lose the core
 * reach/likes snapshot too. insertPostMetrics retries without them, so the
 * code can deploy before or after the migration.
 */

export const FOLLOWER_SIGNAL_COLUMNS = [
  'follows',
  'profile_visits',
  'profile_activity',
  'profile_activity_breakdown',
  'reposts',
  'total_views',
];

export function followerSignalFields(insights) {
  const fields = {};
  for (const column of FOLLOWER_SIGNAL_COLUMNS) fields[column] = insights?.[column] ?? null;
  return fields;
}

// PGRST204: PostgREST schema cache has no such column (insert/update).
// 42703: Postgres undefined_column (select).
export function isMissingColumnError(error) {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  return /column .*(does not exist|in the schema cache)/i.test(error.message || '');
}

export async function insertPostMetrics(supabase, row) {
  const { error } = await supabase.from('post_metrics').insert(row);
  if (!isMissingColumnError(error)) return { error: error || null };

  const legacyRow = { ...row };
  for (const column of FOLLOWER_SIGNAL_COLUMNS) delete legacyRow[column];
  const retry = await supabase.from('post_metrics').insert(legacyRow);
  return { error: retry.error || null };
}
