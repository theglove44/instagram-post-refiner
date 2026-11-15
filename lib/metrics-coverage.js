/**
 * Which linked posts have never had a metrics snapshot?
 *
 * Supabase returns at most 1000 rows per request, and post_metrics holds many
 * snapshots per post, so "fetch all posts, then fetch their metric rows" silently
 * truncates both lists. Instead, page through posts and let Postgres count each
 * post's snapshots via the embedded `post_metrics(count)` relation.
 *
 * Returns { total, missing } where `missing` is newest-first
 * [{ id, instagram_media_id, published_at }].
 */
const PAGE_SIZE = 1000;

export async function findPostsWithoutMetrics(supabase) {
  const missing = [];
  let total = 0;

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, instagram_media_id, published_at, post_metrics(count)')
      .not('instagram_media_id', 'is', null)
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Failed to list posts: ${error.message}`);
    if (!data || data.length === 0) break;

    total += data.length;
    for (const post of data) {
      if ((post.post_metrics?.[0]?.count ?? 0) === 0) {
        missing.push({ id: post.id, instagram_media_id: post.instagram_media_id, published_at: post.published_at });
      }
    }

    if (data.length < PAGE_SIZE) break;
  }

  return { total, missing };
}
