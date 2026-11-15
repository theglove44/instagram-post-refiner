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

/**
 * Where Meta's numbers become real.
 *
 * Posts older than this come back from the insights API with reach and likes
 * but views, total_views and every follower signal as 0 — "not measured then",
 * not "nobody looked". Checked on 2026-11-15:
 *  - live Graph calls: a 2023-06 carousel and a 2024-03 image returned views 0,
 *    total_views 0, follows 0 (reach 77 and 2); a 2024-09 carousel returned
 *    views 4123, follows 0, profile_visits 1; 2025-03 onward all real.
 *  - stored snapshots: `views` is 0 on ~95% of posts through 2024-05 and
 *    positive on 99% of posts from 2024-07 onward.
 * So 2024-07-01 is the start of the measured window.
 */
export const SIGNALS_MEASURED_SINCE = '2024-07-01';

/**
 * True when a post predates the measured window AND reported no views at all.
 * An old post that did report views (a few from 2022-24 do) keeps its numbers.
 * With no usable publish date we cannot tell, so we keep the numbers.
 */
export function isUnmeasuredPeriod(publishedAt, { views, total_views: totalViews } = {}) {
  const published = Date.parse(publishedAt);
  if (Number.isNaN(published)) return false;
  if (published >= Date.parse(SIGNALS_MEASURED_SINCE)) return false;
  return !(views > 0) && !(totalViews > 0);
}

/**
 * Follower-signal columns for a new snapshot. Unmeasured zeros are stored as
 * NULL so they are never mistaken for real zeros ("this post won 0 followers").
 */
export function followerSignalFields(insights, publishedAt = null) {
  const unmeasured = isUnmeasuredPeriod(publishedAt, insights || {});
  const fields = {};
  for (const column of FOLLOWER_SIGNAL_COLUMNS) fields[column] = unmeasured ? null : insights?.[column] ?? null;
  return fields;
}

const orNull = (value) => (value !== undefined && value !== null ? value : null);

/**
 * A complete post_metrics row from one insights + details fetch. Missing values
 * stay null (never 0); engagement rate needs reach and at least one signal.
 */
export function buildSnapshotRow(post, insights, details) {
  const likes = orNull(details?.likes ?? details?.like_count);
  const comments = orNull(details?.comments ?? details?.comments_count);
  const saves = orNull(insights?.saved);
  const shares = orNull(insights?.shares);
  const reach = orNull(insights?.reach);

  let engagementRate = null;
  if (reach && [likes, comments, saves, shares].some((v) => v !== null)) {
    const total = (likes ?? 0) + (comments ?? 0) + (saves ?? 0) + (shares ?? 0);
    engagementRate = ((total / reach) * 100).toFixed(2);
  }

  return {
    post_id: post.id,
    instagram_media_id: post.instagram_media_id,
    reach,
    views: orNull(insights?.views),
    likes,
    comments,
    saves,
    shares,
    total_interactions: orNull(insights?.total_interactions),
    media_type: details?.mediaType || null,
    media_product_type: details?.mediaProductType || null,
    ...followerSignalFields(insights, post.published_at),
    engagement_rate: engagementRate,
  };
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
