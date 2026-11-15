/**
 * Which older posts still need their follower signals?
 *
 * Phase 1 added follows, profile_visits, total_views etc. to post_metrics, but
 * only new snapshots fill them in. Posts that already have metrics are never
 * re-measured, so their latest snapshot has total_views NULL. This finds them.
 *
 * - Only posts published since SIGNALS_MEASURED_SINCE: earlier ones return
 *   unmeasured zeros from Meta, so re-fetching them would spend calls for nothing.
 * - Reads each post's latest snapshot with an embedded order + limit(1), then
 *   pages posts 1000 at a time (Supabase's row cap).
 * - A post is "waiting" while its latest snapshot is older than
 *   CATCHUP_SNAPSHOTS_BEFORE and has no total_views. Once re-measured the new
 *   snapshot is newer than the cut-off, so the post drops out even if Meta
 *   still sent no total_views (so nothing is retried for ever). Resumable: a
 *   half-finished run simply leaves the rest still waiting.
 * - Posts with no snapshot at all belong to the backfill, not here.
 * - Newest first, so the posts Chris cares about most are done first.
 */
import { SIGNALS_MEASURED_SINCE } from './post-metrics';

// Snapshots taken before this date predate the follower-signal columns' rollout.
export const CATCHUP_SNAPSHOTS_BEFORE = '2026-11-15T00:00:00.000Z';

const PAGE_SIZE = 1000;

export async function findCatchupCandidates(supabase, { limit = 40, skipPostIds = new Set() } = {}) {
  const waiting = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, instagram_media_id, published_at, post_metrics(total_views, fetched_at)')
      .not('instagram_media_id', 'is', null)
      .gte('published_at', SIGNALS_MEASURED_SINCE)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .order('fetched_at', { referencedTable: 'post_metrics', ascending: false })
      .limit(1, { referencedTable: 'post_metrics' })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to list posts: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const post of data) {
      const latest = post.post_metrics?.[0];
      if (!latest || latest.total_views != null) continue;
      if (!(Date.parse(latest.fetched_at) < Date.parse(CATCHUP_SNAPSHOTS_BEFORE))) continue;
      if (skipPostIds.has(post.id)) continue;
      waiting.push({ id: post.id, instagram_media_id: post.instagram_media_id, published_at: post.published_at });
    }

    if (data.length < PAGE_SIZE) break;
  }

  return { candidates: waiting.slice(0, limit), totalRemaining: waiting.length };
}
