/**
 * Best posting times calculator.
 * Queries historical post performance data to find optimal
 * day-of-week/hour combinations for scheduling.
 */

import { getSupabaseClient } from './supabase';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Calculate the best posting times based on historical engagement data.
 * Groups posts by day-of-week and hour, averages engagement rate and reach.
 * Returns top time slots ranked by engagement.
 *
 * @param {Object} options
 * @param {number} options.minPosts - Minimum posts in a time slot to include (default: 2)
 * @param {number} options.limit - Max time slots to return (default: 10)
 * @param {string} options.timezone - IANA timezone for grouping (default: 'Europe/London')
 * @returns {Promise<{ bestTimes: Array, totalPostsAnalysed: number }>}
 */
export async function calculateBestTimes({ minPosts = 2, limit = 10, timezone = 'Europe/London' } = {}) {
  const supabase = getSupabaseClient();

  // Fetch posts with metrics and a published date
  const { data: posts, error: postsError } = await supabase
    .from('posts')
    .select('id, published_at')
    .not('published_at', 'is', null)
    .not('instagram_media_id', 'is', null);

  if (postsError) throw new Error(`Failed to fetch posts: ${postsError.message}`);
  if (!posts || posts.length === 0) return { bestTimes: [], totalPostsAnalysed: 0 };

  // Fetch latest metrics per post
  const postIds = posts.map(p => p.id);
  const { data: metrics, error: metricsError } = await supabase
    .from('post_metrics')
    .select('post_id, engagement_rate, reach')
    .in('post_id', postIds)
    .not('engagement_rate', 'is', null)
    .order('fetched_at', { ascending: false });

  if (metricsError) throw new Error(`Failed to fetch metrics: ${metricsError.message}`);
  if (!metrics || metrics.length === 0) return { bestTimes: [], totalPostsAnalysed: 0 };

  // Deduplicate to latest metric per post
  const latestByPost = new Map();
  for (const m of metrics) {
    if (!latestByPost.has(m.post_id)) {
      latestByPost.set(m.post_id, m);
    }
  }

  // Group by day-of-week + hour
  const slots = {};
  let totalAnalysed = 0;

  for (const post of posts) {
    const metric = latestByPost.get(post.id);
    if (!metric) continue;

    const publishDate = new Date(post.published_at);
    // Convert to user's timezone
    const localStr = publishDate.toLocaleString('en-US', { timeZone: timezone });
    const localDate = new Date(localStr);
    const day = localDate.getDay();
    const hour = localDate.getHours();
    const key = `${day}-${hour}`;

    if (!slots[key]) {
      slots[key] = {
        day,
        dayName: DAY_NAMES[day],
        hour,
        engagementRates: [],
        reaches: [],
      };
    }

    slots[key].engagementRates.push(parseFloat(metric.engagement_rate));
    if (metric.reach) slots[key].reaches.push(metric.reach);
    totalAnalysed++;
  }

  // Calculate averages and filter by minimum post count
  const results = Object.values(slots)
    .filter(s => s.engagementRates.length >= minPosts)
    .map(s => ({
      day: s.day,
      dayName: s.dayName,
      hour: s.hour,
      hourLabel: formatHour(s.hour),
      avgEngagement: average(s.engagementRates),
      avgReach: s.reaches.length > 0 ? Math.round(average(s.reaches)) : null,
      postCount: s.engagementRates.length,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, limit);

  return { bestTimes: results, totalPostsAnalysed: totalAnalysed };
}

function average(arr) {
  if (arr.length === 0) return 0;
  return Math.round((arr.reduce((sum, v) => sum + v, 0) / arr.length) * 100) / 100;
}

function formatHour(hour) {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}
