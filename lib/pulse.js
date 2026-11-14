/**
 * Pulse data — read-only aggregation for the phone briefing and daily digest.
 * Everything comes from Supabase; zero Meta API calls.
 * Analysis window: posts published since 1 Jan of the current data era (2026),
 * matching the point where repeated metric collection began.
 */

import { isMissingColumnError } from './post-metrics';

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
 * What wins followers: posts ranked by follows gained, and by profile visits
 * per 1,000 views. Only FEED posts carry these signals (Meta gives Reels no
 * follows/profile_visits), and only snapshots taken since the 2026-11-14
 * migration have them — rows with null follows are skipped, not counted as 0.
 */
export function calculateFollowerWinners(rows, { top = 5, minViews = 300 } = {}) {
  const withSignals = rows.filter((r) => r.follows != null);
  const byFollows = withSignals
    .filter((r) => r.follows > 0)
    .sort((a, b) => b.follows - a.follows || (b.profileVisits || 0) - (a.profileVisits || 0))
    .slice(0, top);
  const byVisitsPer1k = withSignals
    .filter((r) => r.profileVisits != null && r.views >= minViews)
    .map((r) => ({ ...r, visitsPer1k: (r.profileVisits / r.views) * 1000 }))
    .sort((a, b) => b.visitsPer1k - a.visitsPer1k)
    .slice(0, top);
  return { byFollows, byVisitsPer1k, postsWithSignals: withSignals.length };
}

/**
 * Daily follows vs unfollows, oldest first. Days Meta hasn't settled yet
 * (null) stay in the series as gaps but are left out of the totals.
 */
export function calculateFollowFlow(dailyRows, { days = 28 } = {}) {
  const series = [...(dailyRows || [])]
    .filter((d) => d?.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days)
    .map((d) => ({
      date: d.date,
      follows: d.follows ?? null,
      unfollows: d.unfollows ?? null,
      net: d.follows != null && d.unfollows != null ? d.follows - d.unfollows : null,
    }));
  const known = series.filter((d) => d.net != null);
  const follows = known.reduce((a, d) => a + d.follows, 0);
  const unfollows = known.reduce((a, d) => a + d.unfollows, 0);
  return { days: series, totals: { follows, unfollows, net: follows - unfollows }, daysWithData: known.length };
}

const ukHour = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: 'numeric', hourCycle: 'h23' });

/**
 * When followers are online, by UK hour. Meta keys each day's hours 0-23 in
 * Pacific time, for the day ending at `endTime` (Pacific midnight), so each
 * key becomes a real instant before converting — DST on both sides is handled
 * per day. Median per hour so one glitchy day (Meta has sent 4 instead of
 * ~1,300 on a clock-change day) can't drag an hour down.
 */
export function calculateOnlineHours(onlineDays, { peaks = 3 } = {}) {
  const usable = (onlineDays || []).filter((d) => d?.endTime && d.hours && Object.keys(d.hours).length);
  if (!usable.length) return null;
  const buckets = Array.from({ length: 24 }, () => []);
  for (const day of usable) {
    const dayStart = Date.parse(day.endTime) - DAY_MS;
    for (const [key, followers] of Object.entries(day.hours)) {
      if (typeof followers !== 'number') continue;
      const hour = Number(ukHour.format(new Date(dayStart + Number(key) * 3600 * 1000)));
      buckets[hour].push(followers);
    }
  }
  const hours = buckets.map((values, hour) => ({ hour, followers: values.length ? median(values) : null }));
  const peak = hours
    .filter((h) => h.followers != null)
    .sort((a, b) => b.followers - a.followers)
    .slice(0, peaks);
  return { hours, peak, daysUsed: usable.length };
}

const BASE_METRIC_COLUMNS = 'reach,likes,comments,saves,shares,views,total_interactions,media_type,media_product_type,fetched_at';
const FOLLOWER_METRIC_COLUMNS = 'follows,profile_visits,profile_activity,reposts,total_views';

/**
 * Posts since `since` with only their latest post_metrics snapshot embedded.
 * post_metrics holds a snapshot per fetch (11k+ rows), so fetching the rows and
 * picking the latest in JS hits Supabase's 1000-row cap and silently returns
 * stale snapshots. Letting PostgREST order+limit the embed avoids that.
 * Falls back to the base columns if the follower-signal migration isn't applied.
 */
async function fetchPostsWithLatestMetrics(supabase, since) {
  const query = (columns) => supabase
    .from('posts')
    .select(`id,instagram_media_id,published_at,final_version,instagram_permalink,post_metrics(${columns})`)
    .not('instagram_media_id', 'is', null)
    .gte('published_at', since)
    .order('fetched_at', { referencedTable: 'post_metrics', ascending: false })
    .limit(1, { referencedTable: 'post_metrics' })
    .limit(5000);

  let result = await query(`${BASE_METRIC_COLUMNS},${FOLLOWER_METRIC_COLUMNS}`);
  if (result.error && isMissingColumnError(result.error)) {
    result = await query(BASE_METRIC_COLUMNS);
  }
  if (result.error) throw new Error(`Failed to load posts: ${result.error.message}`);
  return result.data || [];
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

  // --- stories (recent captures; 400 rows covers ~200 stories incl. 2 captures each) ---
  const { data: storyRows } = await supabase
    .from('account_insights_cache')
    .select('insight_type,data,fetched_at')
    .like('insight_type', 'story_insights:%')
    .order('fetched_at', { ascending: false })
    .limit(400);
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

  // --- all posts since 1 Jan with their latest metrics (one query) ---
  const yearPosts = await fetchPostsWithLatestMetrics(supabase, '2026-01-01');
  const metricsByMedia = {};
  for (const post of yearPosts) {
    if (post.post_metrics?.[0]) metricsByMedia[post.instagram_media_id] = post.post_metrics[0];
  }

  // --- account follower signals (written by the evening media-insights cron) ---
  const { data: dailyRows } = await supabase
    .from('account_insights_cache')
    .select('insight_type,data')
    .like('insight_type', 'account_daily:%')
    .order('insight_type', { ascending: false })
    .limit(60);
  const { data: onlineRows } = await supabase
    .from('account_insights_cache')
    .select('insight_type,data')
    .like('insight_type', 'online_followers:latest')
    .limit(1);

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
        views: metric.views ?? null,
        follows: metric.follows ?? null,
        profileVisits: metric.profile_visits ?? null,
        permalink: post.instagram_permalink || null,
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
    followerWins: calculateFollowerWinners(analysisRows.filter((r) => r.publishedAt >= cutoff90)),
    followFlow: calculateFollowFlow((dailyRows || []).map((row) => row.data)),
    onlineHours: calculateOnlineHours(onlineRows?.[0]?.data?.days),
  };
}
