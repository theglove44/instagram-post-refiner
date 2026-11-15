/**
 * Facebook Page + crossposted-views helpers. fetch is always mocked: no test
 * reaches Meta. Response shapes are copied from real v24 responses
 * (2026-11-15 probes against the Tuck In and Talk Page).
 */
import {
  pageDayKey,
  getPageAccessToken,
  getPageDailyInsights,
  getCrosspostedViews,
  syncFacebookInsights,
} from './facebook-page';

function mockGraph(handler) {
  global.fetch = jest.fn(async (url, options) => {
    const body = handler(decodeURIComponent(String(url)), options);
    return { status: 200, text: async () => JSON.stringify(body) };
  });
}

const urls = () => global.fetch.mock.calls.map(([url]) => decodeURIComponent(String(url)));
const bearer = (i) => global.fetch.mock.calls[i][1].headers.Authorization;

const NOW = Date.parse('2026-11-15T10:00:00Z');
const series = (name, values) => ({
  name,
  period: 'day',
  values: values.map(([value, end]) => ({ value, end_time: `${end}T08:00:00+0000` })),
});

const CORE = {
  data: [
    series('page_media_view', [[39, '2026-11-12'], [727, '2026-11-13'], [4903, '2026-11-14'], [541, '2026-11-15']]),
    series('page_total_media_view_unique', [[29, '2026-11-12'], [605, '2026-11-13'], [4132, '2026-11-14'], [449, '2026-11-15']]),
    series('page_follows', [[225, '2026-11-12'], [224, '2026-11-13'], [224, '2026-11-14'], [224, '2026-11-15']]),
  ],
};
const FLOW = {
  data: [
    series('page_daily_follows_unique', [[0, '2026-11-12'], [0, '2026-11-13'], [1, '2026-11-14'], [0, '2026-11-15']]),
    series('page_daily_unfollows_unique', [[0, '2026-11-12'], [1, '2026-11-13'], [1, '2026-11-14'], [0, '2026-11-15']]),
  ],
};

afterEach(() => {
  delete global.fetch;
});

describe('pageDayKey', () => {
  test('a value ending at Pacific midnight belongs to the day before', () => {
    expect(pageDayKey('2026-11-15T08:00:00+0000')).toBe('2026-11-14');
    expect(pageDayKey('2026-11-02T07:00:00+0000')).toBe('2026-11-01'); // after the clocks change
  });
});

describe('getPageAccessToken', () => {
  test('swaps the user token for the Page token in one call', async () => {
    mockGraph(() => ({ access_token: 'page-tok', name: 'Tuck in and Talk', followers_count: 224, id: 'p1' }));
    const page = await getPageAccessToken('user-tok', 'p1');
    expect(page).toEqual({ pageToken: 'page-tok', name: 'Tuck in and Talk', followersCount: 224 });
    expect(urls()[0]).toMatch(/\/p1\?fields=access_token,name,followers_count$/);
    expect(bearer(0)).toBe('Bearer user-tok');
  });

  test('throws when Meta gives no Page token', async () => {
    mockGraph(() => ({ error: { message: 'missing permission pages_read_engagement' } }));
    await expect(getPageAccessToken('user-tok', 'p1')).rejects.toThrow(/pages_read_engagement/);
  });
});

describe('getPageDailyInsights', () => {
  test('returns one row per complete Pacific day, newest days only', async () => {
    mockGraph((url) => (url.includes('page_daily_follows_unique') ? FLOW : CORE));
    const days = await getPageDailyInsights('page-tok', 'p1', { days: 3, now: NOW });

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(bearer(0)).toBe('Bearer page-tok');
    expect(urls()[0]).toMatch(/metric=page_media_view,page_total_media_view_unique,page_follows&period=day/);
    expect(days).toEqual([
      { date: '2026-11-12', views: 727, viewers: 605, followers: 224, follows: 0, unfollows: 1 },
      { date: '2026-11-13', views: 4903, viewers: 4132, followers: 224, follows: 1, unfollows: 1 },
      { date: '2026-11-14', views: 541, viewers: 449, followers: 224, follows: 0, unfollows: 0 },
    ]);
  });

  test('drops a day that has not finished yet', async () => {
    mockGraph((url) => (url.includes('page_daily_follows_unique') ? FLOW : CORE));
    const days = await getPageDailyInsights('page-tok', 'p1', { days: 5, now: Date.parse('2026-11-15T07:00:00Z') });
    expect(days.map((d) => d.date)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
  });

  test('keeps views when the follow/unfollow request fails', async () => {
    mockGraph((url) => (url.includes('page_daily_follows_unique') ? { error: { message: 'invalid metric' } } : CORE));
    const days = await getPageDailyInsights('page-tok', 'p1', { days: 1, now: NOW });
    expect(days).toEqual([{ date: '2026-11-14', views: 541, viewers: 449, followers: 224, follows: null, unfollows: null }]);
  });

  test('throws when the core metrics are rejected', async () => {
    mockGraph(() => ({ error: { message: '(#100) The value must be a valid insights metric' } }));
    await expect(getPageDailyInsights('page-tok', 'p1', { now: NOW })).rejects.toThrow(/valid insights metric/);
  });
});

describe('getCrosspostedViews', () => {
  const MEDIA = {
    data: [
      { id: 'm1', timestamp: '2026-11-10T18:00:00+0000', media_type: 'IMAGE', media_product_type: 'FEED',
        fb: { data: [{ name: 'facebook_views', period: 'lifetime', values: [{ value: 37 }] }] },
        tv: { data: [{ name: 'total_views', period: 'lifetime', values: [{ value: 1318 }] }] } },
      // not shared to Facebook: Meta leaves the fb alias out entirely
      { id: 'm2', timestamp: '2026-11-07T18:00:00+0000', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED',
        tv: { data: [{ name: 'total_views', period: 'lifetime', values: [{ value: 4284 }] }] } },
      { id: 'm3', timestamp: '2026-11-05T18:00:00+0000', media_type: 'VIDEO', media_product_type: 'REELS',
        fb: { data: [{ name: 'facebook_views', period: 'lifetime', values: [{ value: 0 }] }] },
        tv: { data: [{ name: 'total_views', period: 'lifetime', values: [{ value: 913 }] }] } },
    ],
  };

  test('reads Facebook views for the recent posts in a single call', async () => {
    mockGraph(() => MEDIA);
    const { posts } = await getCrosspostedViews('user-tok', 'ig-1', { limit: 25 });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(urls()[0]).toContain('/ig-1/media?fields=id,timestamp,media_type,media_product_type,');
    expect(urls()[0]).toContain('insights.metric(facebook_views).as(fb)');
    expect(urls()[0]).toContain('insights.metric(total_views).as(tv)');
    expect(urls()[0]).toMatch(/limit=25$/);
    expect(posts).toEqual([
      { mediaId: 'm1', publishedAt: '2026-11-10T18:00:00+0000', mediaType: 'IMAGE', mediaProductType: 'FEED', crossposted: true, facebookViews: 37, totalViews: 1318 },
      { mediaId: 'm2', publishedAt: '2026-11-07T18:00:00+0000', mediaType: 'CAROUSEL_ALBUM', mediaProductType: 'FEED', crossposted: false, facebookViews: null, totalViews: 4284 },
      { mediaId: 'm3', publishedAt: '2026-11-05T18:00:00+0000', mediaType: 'VIDEO', mediaProductType: 'REELS', crossposted: true, facebookViews: 0, totalViews: 913 },
    ]);
  });

  test('caps the batch at 100, one page of results', async () => {
    mockGraph(() => ({ data: [] }));
    await getCrosspostedViews('user-tok', 'ig-1', { limit: 500 });
    expect(urls()[0]).toMatch(/limit=100$/);
  });

  test('throws when the media list itself fails', async () => {
    mockGraph(() => ({ error: { message: 'Unsupported get request' } }));
    await expect(getCrosspostedViews('user-tok', 'ig-1')).rejects.toThrow(/Unsupported get request/);
  });
});

describe('syncFacebookInsights', () => {
  const route = (url) => {
    if (url.includes('fields=access_token')) return { access_token: 'page-tok', name: 'Tuck in and Talk', followers_count: 224 };
    if (url.includes('page_daily_follows_unique')) return FLOW;
    if (url.includes('/insights?')) return CORE;
    return { data: [{ id: 'm1', timestamp: '2026-11-10T18:00:00+0000', media_type: 'IMAGE', media_product_type: 'FEED',
      fb: { data: [{ values: [{ value: 37 }] }] }, tv: { data: [{ values: [{ value: 1318 }] }] } }] };
  };

  test('stores each Page day and each recent post, for 4 Graph calls', async () => {
    mockGraph(route);
    const save = jest.fn(async () => ({ error: null }));
    const summary = await syncFacebookInsights({ userToken: 'user-tok', pageId: 'p1', instagramUserId: 'ig-1', save, days: 3, now: NOW });

    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(save.mock.calls.map(([type]) => type)).toEqual([
      'fb_page_daily:2026-11-12', 'fb_page_daily:2026-11-13', 'fb_page_daily:2026-11-14', 'fb_post_views:m1',
    ]);
    expect(save.mock.calls[1][1]).toEqual({ date: '2026-11-13', views: 4903, viewers: 4132, followers: 224, follows: 1, unfollows: 1 });
    expect(save.mock.calls[3][1]).toMatchObject({ crossposted: true, facebookViews: 37, totalViews: 1318 });
    expect(summary).toMatchObject({ pageDaysSynced: 3, postsChecked: 1, postsCrossposted: 1, errors: [] });
  });

  test('a Page failure still records crossposted views, and vice versa', async () => {
    mockGraph((url) => (url.includes('fields=access_token') ? { error: { message: 'page token denied' } } : route(url)));
    const save = jest.fn(async () => ({ error: null }));
    const summary = await syncFacebookInsights({ userToken: 'user-tok', pageId: 'p1', instagramUserId: 'ig-1', save, now: NOW });
    expect(summary.pageDaysSynced).toBe(0);
    expect(summary.postsChecked).toBe(1);
    expect(summary.errors).toEqual(['fb_page: page token denied']);

    mockGraph((url) => (url.includes('/media?') ? { error: { message: 'media gone' } } : route(url)));
    const second = await syncFacebookInsights({ userToken: 'user-tok', pageId: 'p1', instagramUserId: 'ig-1', save, days: 1, now: NOW });
    expect(second.pageDaysSynced).toBe(1);
    expect(second.errors).toEqual(['fb_post_views: media gone']);
  });

  test('skips the Page step when no Page is linked', async () => {
    mockGraph(route);
    const save = jest.fn(async () => ({ error: null }));
    const summary = await syncFacebookInsights({ userToken: 'user-tok', pageId: null, instagramUserId: 'ig-1', save, now: NOW });
    expect(urls().some((u) => u.includes('fields=access_token'))).toBe(false);
    expect(summary.pageSkipped).toBe('no facebook_page_id on the account');
    expect(summary.postsChecked).toBe(1);
  });
});
