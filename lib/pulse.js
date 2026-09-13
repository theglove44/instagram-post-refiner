/**
 * Pulse data — read-only aggregation for the phone dashboard and daily digest.
 * Everything comes from Supabase; zero Meta API calls.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDaysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString();

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const mediaTypeLabel = (row) => {
  if (row.media_product_type === 'REELS' || row.media_type === 'VIDEO') return 'Reel';
  if (row.media_type === 'CAROUSEL_ALBUM') return 'Carousel';
  if (row.media_type === 'IMAGE') return 'Image';
  return 'Unknown';
};

/**
 * Latest post_metrics row per media id (rows are appended per fetch).
 */
export function latestMetricsPerMedia(metricRows) {
  const latest = {};
  for (const row of metricRows) latest[row.instagram_media_id] = row;
  return latest;
}

/**
 * Best posting slots (UK time) from published posts with metrics.
 * Slots with >= minPosts posts, ranked by mean engagement rate.
 */
export function calculateBestSlots(posts, metricsByMedia, { minPosts = 3, top = 5 } = {}) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  });
  const buckets = {};
  for (const post of posts) {
    if (!post.published_at || !post.instagram_media_id) continue;
    const metric = metricsByMedia[post.instagram_media_id];
    if (!metric || !metric.reach || metric.total_interactions == null) continue;
    const parts = {};
    formatter.formatToParts(new Date(post.published_at)).forEach((p) => { parts[p.type] = p.value; });
    const slot = `${parts.weekday} ${String(parts.hour).padStart(2, '0')}:00`;
    (buckets[slot] = buckets[slot] || []).push(metric.total_interactions / metric.reach);
  }
  return Object.entries(buckets)
    .filter(([, ers]) => ers.length >= minPosts)
    .map(([slot, ers]) => ({ slot, posts: ers.length, avgEr: ers.reduce((a, b) => a + b, 0) / ers.length }))
    .sort((a, b) => b.avgEr - a.avgEr)
    .slice(0, top);
}

/**
 * Aggregate everything the Pulse view needs.
 */
export async function getPulseData(supabase) {
  // --- account ---
  const { data: accounts } = await supabase
    .from('instagram_accounts')
    .select('instagram_user_id,username')
    .limit(1);
  const account = accounts?.[0] || null;

  // --- daily views split (last 14 rows) ---
  const { data: splitRows } = await supabase
    .from('account_insights_cache')
    .select('insight_type,data,fetched_at')
    .like('insight_type', 'views_follow_split:%')
    .order('insight_type', { ascending: false })
    .limit(14);
  const viewsSplit = (splitRows || [])
    .map((row) => ({ ...row.data, key: row.insight_type }))
    .sort((a, b) => a.key.localeCompare(b.key));

  // --- stories (most recent 20 captures) ---
  const { data: storyRows } = await supabase
    .from('account_insights_cache')
    .select('insight_type,data,fetched_at')
    .like('insight_type', 'story_insights:%')
    .order('fetched_at', { ascending: false })
    .limit(20);
  const stories = (storyRows || [])
    .map((row) => ({ id: row.insight_type.replace('story_insights:', ''), ...row.data }))
    .sort((a, b) => (b.postedAt || '').localeCompare(a.postedAt || ''));
  const weekAgo = isoDaysAgo(7);
  const recentStories = stories.filter((s) => (s.postedAt || '') >= weekAgo);
  const storyTotals = {
    count: recentStories.length,
    views: recentStories.reduce((a, s) => a + (s.views || 0), 0),
    replies: recentStories.reduce((a, s) => a + (s.replies || 0), 0),
    follows: recentStories.reduce((a, s) => a + (s.follows || 0), 0),
  };

  // --- follower growth (last 30 snapshots) ---
  const { data: snapshotRows } = await supabase
    .from('account_snapshots')
    .select('snapshot_date,followers_count')
    .order('snapshot_date', { ascending: false })
    .limit(30);
  const growth = (snapshotRows || [])
    .map((row) => ({ date: row.snapshot_date, followers: row.followers_count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // --- recent posts ranked by ER (last 30 days) ---
  const { data: recentPosts } = await supabase
    .from('posts')
    .select('id,instagram_media_id,published_at,final_version')
    .not('instagram_media_id', 'is', null)
    .gte('published_at', isoDaysAgo(30));
  const recentIds = (recentPosts || []).map((p) => p.instagram_media_id);
  const { data: recentMetricRows } = recentIds.length
    ? await supabase
        .from('post_metrics')
        .select('instagram_media_id,reach,likes,comments,saves,shares,total_interactions,media_type,media_product_type,fetched_at')
        .in('instagram_media_id', recentIds)
        .order('fetched_at', { ascending: true })
    : { data: [] };
  const metricsByMedia = latestMetricsPerMedia(recentMetricRows || []);
  const rankedPosts = (recentPosts || [])
    .map((post) => {
      const metric = metricsByMedia[post.instagram_media_id];
      if (!metric || !metric.reach || metric.total_interactions == null) return null;
      return {
        publishedAt: post.published_at,
        type: mediaTypeLabel(metric),
        reach: metric.reach,
        interactions: metric.total_interactions,
        er: metric.total_interactions / metric.reach,
        excerpt: (post.final_version || '').slice(0, 90),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.er - a.er);

  // --- best slots (posts from last 90 days) ---
  const { data: slotPosts } = await supabase
    .from('posts')
    .select('instagram_media_id,published_at')
    .not('instagram_media_id', 'is', null)
    .gte('published_at', isoDaysAgo(90));
  const slotIds = (slotPosts || []).map((p) => p.instagram_media_id);
  const { data: slotMetricRows } = slotIds.length
    ? await supabase
        .from('post_metrics')
        .select('instagram_media_id,reach,total_interactions,fetched_at')
        .in('instagram_media_id', slotIds)
        .order('fetched_at', { ascending: true })
    : { data: [] };
  const bestSlots = calculateBestSlots(slotPosts || [], latestMetricsPerMedia(slotMetricRows || []));

  return {
    account,
    viewsSplit,
    stories: stories.slice(0, 10),
    storyTotals,
    growth,
    rankedPosts: rankedPosts.slice(0, 10),
    postCount: rankedPosts.length,
    medianEr: median(rankedPosts.map((p) => p.er)),
    bestSlots,
  };
}
