/**
 * Pulse data — read-only aggregation for the phone briefing and daily digest.
 * Everything comes from Supabase; zero Meta API calls.
 * Analysis window: posts published since 1 Jan of the current data era (2026),
 * matching the point where repeated metric collection began.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const isoDaysAgo = (days) => new Date(Date.now() - days * DAY_MS).toISOString();

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const formatLabel = (row) => {
  if (row.media_product_type === 'REELS' || row.media_type === 'VIDEO') return 'Reels';
  if (row.media_type === 'CAROUSEL_ALBUM') return 'Carousels';
  if (row.media_type === 'IMAGE') return 'Images';
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

function mondayOf(dateStr) {
  const d = new Date(dateStr);
  const utc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(utc - d.getUTCDay() * DAY_MS).toISOString().slice(0, 10);
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
 * Format league: per format, per 1,000 reached economics.
 * rows: [{format, er, reach, saves, shares, comments}]
 */
export function calculateFormatLeague(rows) {
  const groups = {};
  for (const row of rows) {
    if (row.format === 'Unknown') continue;
    (groups[row.format] = groups[row.format] || []).push(row);
  }
  return Object.entries(groups)
    .map(([format, items]) => {
      const reach = items.reduce((a, r) => a + r.reach, 0) || 1;
      return {
        format,
        posts: items.length,
        medianEr: median(items.map((r) => r.er)),
        avgReach: reach / items.length,
        talkPer1k: (items.reduce((a, r) => a + r.comments, 0) / reach) * 1000,
        savesPer1k: (items.reduce((a, r) => a + r.saves, 0) / reach) * 1000,
        sharesPer1k: (items.reduce((a, r) => a + r.shares, 0) / reach) * 1000,
      };
    })
    .sort((a, b) => b.medianEr - a.medianEr);
}

/**
 * Weekly form: median ER per ISO week, oldest first.
 */
export function calculateWeeklyForm(rows, { weeks = 10 } = {}) {
  const byWeek = {};
  for (const row of rows) {
    if (!row.date) continue;
    const key = mondayOf(row.date);
    (byWeek[key] = byWeek[key] || []).push(row.er);
  }
  const all = Object.entries(byWeek)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([week, ers]) => ({ week, posts: ers.length, medianEr: median(ers) }));
  const seasonBest = all.length ? Math.max(...all.map((w) => w.medianEr)) : null;
  return {
    weeks: all.slice(-weeks),
    seasonBest,
    thisWeek: all.length ? all[all.length - 1] : null,
    prevWeek: all.length > 1 ? all[all.length - 2] : null,
  };
}

/**
 * Caption signals: length buckets and question effect.
 */
export function calculateCaptionSignals(rows) {
  const bucket = (name, items) => ({ name, posts: items.length, medianEr: median(items.map((r) => r.er)) });
  return {
    length: [
      bucket('short', rows.filter((r) => r.length != null && r.length < 200)),
      bucket('middle', rows.filter((r) => r.length != null && r.length >= 200 && r.length <= 500)),
      bucket('long', rows.filter((r) => r.length != null && r.length > 500)),
    ],
    question: bucket('with question', rows.filter((r) => r.hasQuestion)),
    noQuestion: bucket('no question', rows.filter((r) => r.hasQuestion === false)),
  };
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

  // --- stories (most recent 40 captures) ---
  const { data: storyRows } = await supabase
    .from('account_insights_cache')
    .select('insight_type,data,fetched_at')
    .like('insight_type', 'story_insights:%')
    .order('fetched_at', { ascending: false })
    .limit(40);
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

  // --- all posts since 1 Jan with their latest metrics (one query set) ---
  const { data: yearPosts } = await supabase
    .from('posts')
    .select('id,instagram_media_id,published_at,final_version')
    .not('instagram_media_id', 'is', null)
    .gte('published_at', '2026-01-01');
  const yearIds = (yearPosts || []).map((p) => p.instagram_media_id);
  const { data: yearMetricRows } = yearIds.length
    ? await supabase
        .from('post_metrics')
        .select('instagram_media_id,reach,likes,comments,saves,shares,total_interactions,media_type,media_product_type,fetched_at')
        .in('instagram_media_id', yearIds)
        .order('fetched_at', { ascending: true })
    : { data: [] };
  const metricsByMedia = latestMetricsPerMedia(yearMetricRows || []);

  // normalised analysis rows
  const analysisRows = (yearPosts || [])
    .map((post) => {
      const metric = metricsByMedia[post.instagram_media_id];
      if (!metric || !metric.reach || metric.total_interactions == null) return null;
      const caption = post.final_version || '';
      return {
        mediaId: post.instagram_media_id,
        publishedAt: post.published_at,
        date: (post.published_at || '').slice(0, 10),
        format: formatLabel(metric),
        er: metric.total_interactions / metric.reach,
        reach: metric.reach,
        likes: metric.likes || 0,
        comments: metric.comments || 0,
        saves: metric.saves || 0,
        shares: metric.shares || 0,
        interactions: metric.total_interactions,
        length: caption.length,
        hasQuestion: /\?/.test(caption),
        excerpt: caption.slice(0, 90),
      };
    })
    .filter(Boolean);

  const ranked = [...analysisRows].sort((a, b) => b.er - a.er);
  const cutoff30 = isoDaysAgo(30);
  const cutoff90 = isoDaysAgo(90);
  const formatLeague = calculateFormatLeague(analysisRows);
  const weeklyForm = calculateWeeklyForm(analysisRows, { weeks: 10 });
  const captionSignals = calculateCaptionSignals(analysisRows);
  const bestSlots = calculateBestSlots(
    (yearPosts || []).filter((p) => p.published_at >= cutoff90),
    metricsByMedia
  );

  return {
    account,
    viewsSplit,
    stories: stories.slice(0, 10),
    storyTotals,
    growth,
    rankedPosts: ranked.filter((r) => r.publishedAt >= cutoff30).slice(0, 10),
    postCount: analysisRows.filter((r) => r.publishedAt >= cutoff30).length,
    medianEr: median(analysisRows.filter((r) => r.publishedAt >= cutoff30).map((r) => r.er)),
    formatLeague,
    weeklyForm,
    captionSignals,
    bestSlots,
    analysisRowCount: analysisRows.length,
  };
}
