/**
 * Facebook Page insights and Instagram→Facebook crossposted views.
 *
 * Answers "does Facebook add anything?" for a small Page, cheaply:
 *   - Page trend: page_media_view (views), page_total_media_view_unique
 *     (unique viewers), page_follows (lifetime follower count) and the daily
 *     follow/unfollow counts. These replace page_impressions/page_fans and the
 *     reach metrics Meta removed in Nov 2025 and June 2026.
 *   - Per post: facebook_views from Instagram media insights.
 *
 * Cost per evening run: 4 Graph calls (Page token, 2 Page insights, 1 media
 * list), against the ~200/hour budget shared with Instagram calls.
 *
 * The Page token is derived from the stored user token on every run, not
 * stored: it costs one call, needs no migration or second secret at rest, and
 * automatically follows a re-auth or revocation of the user token.
 */
import { GRAPH_API_BASE, graphFetch, graphFetchWithRefresh } from './instagram';

const DAY_MS = 24 * 60 * 60 * 1000;
const PAGE_CORE_METRICS = ['page_media_view', 'page_total_media_view_unique', 'page_follows'];
const PAGE_FLOW_METRICS = ['page_daily_follows_unique', 'page_daily_unfollows_unique'];
const MAX_MEDIA = 100; // one page of /media; no pagination, so one call

/**
 * Page insights are keyed by the end of the day (Pacific midnight, e.g.
 * 08:00 UTC), so a value belongs to the day before its end_time.
 */
export const pageDayKey = (endTime) => new Date(Date.parse(endTime) - DAY_MS).toISOString().slice(0, 10);

/** One call: the Page token plus name and follower count. */
export async function getPageAccessToken(userToken, pageId) {
  const data = await graphFetch(`${GRAPH_API_BASE}/${pageId}?fields=access_token,name,followers_count`, userToken);
  if (data.error || !data.access_token) {
    throw new Error(data.error?.message || 'Meta returned no Page access token');
  }
  return { pageToken: data.access_token, name: data.name ?? null, followersCount: data.followers_count ?? null };
}

async function pageSeries(pageToken, pageId, metrics, since, until) {
  const data = await graphFetch(
    `${GRAPH_API_BASE}/${pageId}/insights?metric=${metrics.join(',')}&period=day&since=${since}&until=${until}`,
    pageToken
  );
  if (data.error) throw new Error(data.error.message);
  // { metricName: { 'YYYY-MM-DD': value } }
  const byMetric = {};
  for (const metric of data.data || []) {
    byMetric[metric.name] = {};
    for (const v of metric.values || []) {
      if (v.end_time) byMetric[metric.name][v.end_time] = v.value ?? null;
    }
  }
  return byMetric;
}

/**
 * The last `days` complete Pacific days of Page totals — 2 calls. The
 * follow/unfollow call is separate so an error there can't lose the views.
 * Days still in progress (end_time in the future) are dropped.
 */
export async function getPageDailyInsights(pageToken, pageId, { days = 3, now = Date.now() } = {}) {
  const until = Math.floor(now / 1000);
  const since = until - (days + 1) * 86400;
  const core = await pageSeries(pageToken, pageId, PAGE_CORE_METRICS, since, until);
  let flow = {};
  try {
    flow = await pageSeries(pageToken, pageId, PAGE_FLOW_METRICS, since, until);
  } catch (err) {
    console.warn('Page follow/unfollow insights failed:', err.message);
  }

  const endTimes = Object.keys(core.page_media_view || {})
    .filter((end) => Date.parse(end) <= now)
    .sort()
    .slice(-days);
  const pick = (source, metric, end) => source[metric]?.[end] ?? null;
  return endTimes.map((end) => ({
    date: pageDayKey(end),
    views: pick(core, 'page_media_view', end),
    viewers: pick(core, 'page_total_media_view_unique', end),
    followers: pick(core, 'page_follows', end),
    follows: pick(flow, 'page_daily_follows_unique', end),
    unfollows: pick(flow, 'page_daily_unfollows_unique', end),
  }));
}

/**
 * Facebook views for the most recent Instagram posts — 1 call.
 * facebook_views errors for media not shared to Facebook, so it is requested
 * as its own aliased nested field: Meta then omits it for those posts instead
 * of failing the request (verified live 2026-11-15). total_views sits in a
 * second alias so the share is computed from one moment in time.
 */
export async function getCrosspostedViews(userToken, instagramUserId, { limit = 25 } = {}) {
  const count = Math.max(1, Math.min(limit, MAX_MEDIA));
  const url =
    `${GRAPH_API_BASE}/${instagramUserId}/media?fields=id,timestamp,media_type,media_product_type,` +
    `insights.metric(facebook_views).as(fb),insights.metric(total_views).as(tv)&limit=${count}`;
  const { data, newToken, expiresIn } = await graphFetchWithRefresh(url, userToken);
  if (data.error) throw new Error(data.error.message);

  const first = (alias) => alias?.data?.[0]?.values?.[0]?.value ?? null;
  const posts = (data.data || []).map((m) => {
    const facebookViews = first(m.fb);
    return {
      mediaId: m.id,
      publishedAt: m.timestamp ?? null,
      mediaType: m.media_type ?? null,
      mediaProductType: m.media_product_type ?? null,
      crossposted: facebookViews != null,
      facebookViews,
      totalViews: first(m.tv),
    };
  });
  return { posts, newToken, expiresIn };
}

/**
 * Evening sweep: Page days → `fb_page_daily:<date>`, posts →
 * `fb_post_views:<media_id>`. `save(insightType, data)` writes one cache row.
 * Each half fails on its own; errors are collected, never thrown.
 */
export async function syncFacebookInsights({ userToken, pageId, instagramUserId, save, days = 3, mediaLimit = 25, now = Date.now() }) {
  const summary = { pageDaysSynced: 0, postsChecked: 0, postsCrossposted: 0, errors: [], newToken: null, expiresIn: null };

  if (!pageId) {
    summary.pageSkipped = 'no facebook_page_id on the account';
  } else {
    try {
      const { pageToken } = await getPageAccessToken(userToken, pageId);
      for (const day of await getPageDailyInsights(pageToken, pageId, { days, now })) {
        await save(`fb_page_daily:${day.date}`, day);
        summary.pageDaysSynced++;
      }
    } catch (err) {
      console.warn('Facebook Page insights failed:', err.message);
      summary.errors.push(`fb_page: ${err.message}`);
    }
  }

  try {
    const { posts, newToken, expiresIn } = await getCrosspostedViews(userToken, instagramUserId, { limit: mediaLimit });
    summary.newToken = newToken || null;
    summary.expiresIn = expiresIn || null;
    for (const post of posts) {
      await save(`fb_post_views:${post.mediaId}`, post);
      summary.postsChecked++;
      if (post.crossposted) summary.postsCrossposted++;
    }
  } catch (err) {
    console.warn('Crossposted views failed:', err.message);
    summary.errors.push(`fb_post_views: ${err.message}`);
  }

  return summary;
}
