import { GET } from './route';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import {
  getViewsFollowBreakdown,
  getReelEnhancedInsights,
  getStoriesWithInsights,
  getDailyAccountInsights,
  getOnlineFollowers,
  getEngagedAudienceDemographics,
} from '@/lib/instagram';

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));
jest.mock('@/lib/instagram', () => ({
  getViewsFollowBreakdown: jest.fn(),
  getReelEnhancedInsights: jest.fn(),
  getStoriesWithInsights: jest.fn(),
  getDailyAccountInsights: jest.fn(),
  getOnlineFollowers: jest.fn(),
  getEngagedAudienceDemographics: jest.fn(),
  getTokenExpiryDate: jest.fn(() => '2026-12-01T00:00:00.000Z'),
}));

const originalResponse = global.Response;

beforeAll(() => {
  global.Response = {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  };
});

afterAll(() => {
  global.Response = originalResponse;
});

function chainable(result) {
  const builder = {};
  for (const method of ['select', 'eq', 'limit', 'order', 'not', 'gte', 'in', 'update']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.upsert = jest.fn(async () => ({ error: null }));
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function makeClient({ accounts, recentPosts, metricRows }) {
  const accountQuery = chainable({ data: accounts, error: null });
  const postsQuery = chainable({ data: recentPosts, error: null });
  const metricsQuery = chainable({ data: metricRows, error: null });
  const accountsUpdate = chainable({ data: null, error: null });
  const cacheQuery = chainable({ data: null, error: null });

  return {
    from: jest.fn(table => ({
      instagram_accounts: table === 'instagram_accounts' ? accountQuery : accountsUpdate,
      posts: postsQuery,
      post_metrics: metricsQuery,
      account_insights_cache: cacheQuery,
    })[table]),
  };
}

const VIEWS_SPLIT = {
  totalViews: 3920,
  follower: 1848,
  nonFollower: 2072,
  byProduct: { REELS: { follower: 900, nonFollower: 1800 } },
  newToken: null,
  expiresIn: null,
};

const STORIES = {
  stories: [
    { id: 'story-1', mediaType: 'VIDEO', timestamp: '2026-09-12T21:28:35+0000', insights: { views: 13, reach: 13, replies: 0, navigation: 13, profile_activity: 0, follows: 0 } },
    { id: 'story-2', mediaType: 'VIDEO', timestamp: '2026-09-12T20:37:53+0000', insights: { views: 15, reach: 15, replies: 1, navigation: 14, profile_activity: 1, follows: 0 } },
  ],
  newToken: null,
  expiresIn: null,
};

describe('media-insights cron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getViewsFollowBreakdown.mockResolvedValue(VIEWS_SPLIT);
    getStoriesWithInsights.mockResolvedValue(STORIES);
    getDailyAccountInsights.mockImplementation(async (_tok, _uid, date) => ({ date, follows: 4, unfollows: 3 }));
    getOnlineFollowers.mockResolvedValue({ days: [{ endTime: '2026-11-12T08:00:00+0000', hours: { 0: 1300 } }] });
    getEngagedAudienceDemographics.mockResolvedValue({ age: { '25-34': 343 }, gender: null, country: null, city: null });
  });

  test('returns 400 when no Instagram account is connected', async () => {
    getServerSupabaseClient.mockReturnValue(makeClient({ accounts: [], recentPosts: [], metricRows: [] }));
    const response = await GET({ url: 'http://localhost:3000/api/cron/media-insights' });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toMatch(/no instagram account/i);
    expect(getViewsFollowBreakdown).not.toHaveBeenCalled();
  });

  test('stores daily views split and syncs recent Reels', async () => {
    const client = makeClient({
      accounts: [{ access_token: 'tok', instagram_user_id: 'ig-1' }],
      recentPosts: [
        { id: 1, instagram_media_id: 'reel-1', published_at: '2026-09-10T18:00:00Z' },
        { id: 2, instagram_media_id: 'car-1', published_at: '2026-09-09T18:00:00Z' },
      ],
      metricRows: [
        { instagram_media_id: 'reel-1', media_type: 'VIDEO', media_product_type: 'REELS', fetched_at: '2026-09-10T20:00:00Z' },
        { instagram_media_id: 'car-1', media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', fetched_at: '2026-09-09T20:00:00Z' },
      ],
    });
    getServerSupabaseClient.mockReturnValue(client);
    getReelEnhancedInsights.mockResolvedValue({
      insights: { views: 2407, ig_reels_avg_watch_time: 5168, reels_skip_rate: 0.15 },
      newToken: null,
      expiresIn: null,
    });

    const response = await GET({ url: 'http://localhost:3000/api/cron/media-insights' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reelsSynced).toBe(1);
    expect(body.viewsSplit.follower).toBe(1848);
    expect(getReelEnhancedInsights).toHaveBeenCalledTimes(1);
    expect(getReelEnhancedInsights).toHaveBeenCalledWith('tok', 'reel-1');

    // three upserts: daily split, one reel, two stories
    const upserts = client.from('account_insights_cache').upsert.mock.calls;
    // 4 media rows, then 3 daily account rows + online followers + demographics
    expect(upserts).toHaveLength(9);
    expect(upserts[0][0].insight_type).toMatch(/^views_follow_split:\d{4}-\d{2}-\d{2}$/);
    expect(upserts[1][0].insight_type).toBe('reel_insights:reel-1');
    expect(upserts[2][0].insight_type).toBe('story_insights:story-1');
    expect(upserts[3][0].insight_type).toBe('story_insights:story-2');
    expect(upserts[2][0].data.views).toBe(13);
    expect(body.storiesSynced).toBe(2);
  });

  test('returns 502 when the views split call fails against Meta', async () => {
    getServerSupabaseClient.mockReturnValue(makeClient({
      accounts: [{ access_token: 'tok', instagram_user_id: 'ig-1' }],
      recentPosts: [],
      metricRows: [],
    }));
    getViewsFollowBreakdown.mockRejectedValue(new Error('(api blocked)'));
    const response = await GET({ url: 'http://localhost:3000/api/cron/media-insights' });
    const body = await response.json();
    expect(response.status).toBe(502);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/views split failed/i);
  });

  test('counts failed Reels without aborting the run', async () => {
    const client = makeClient({
      accounts: [{ access_token: 'tok', instagram_user_id: 'ig-1' }],
      recentPosts: [{ id: 1, instagram_media_id: 'reel-1', published_at: '2026-09-10T18:00:00Z' }],
      metricRows: [{ instagram_media_id: 'reel-1', media_type: 'VIDEO', media_product_type: 'REELS', fetched_at: '2026-09-10T20:00:00Z' }],
    });
    getServerSupabaseClient.mockReturnValue(client);
    getReelEnhancedInsights.mockRejectedValue(new Error('boom'));
    const response = await GET({ url: 'http://localhost:3000/api/cron/media-insights' });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.reelsSynced).toBe(0);
    expect(body.reelsFailed).toBe(1);
  });

  test('stories failing does not abort the run', async () => {
    const client = makeClient({ accounts: [{ access_token: 'tok', instagram_user_id: 'ig-1' }], recentPosts: [], metricRows: [] });
    getServerSupabaseClient.mockReturnValue(client);
    getStoriesWithInsights.mockRejectedValue(new Error('stories gone'));
    const response = await GET({ url: 'http://localhost:3000/api/cron/media-insights' });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.storiesError).toMatch(/stories gone/);
    expect(body.viewsSplit.totalViews).toBe(3920);
  });

  test('caps the days parameter at 30', async () => {
    const client = makeClient({ accounts: [{ access_token: 'tok', instagram_user_id: 'ig-1' }], recentPosts: [], metricRows: [] });
    getServerSupabaseClient.mockReturnValue(client);
    const before = Date.now();
    await GET({ url: 'http://localhost:3000/api/cron/media-insights?days=999' });
    const cutoffArg = client.from('posts').gte.mock.calls[0];
    expect(cutoffArg[0]).toBe('published_at');
    const cutoff = new Date(cutoffArg[1]).getTime();
    const daysAgo30 = before - 30 * 24 * 60 * 60 * 1000;
    // cutoff must sit at ~30 days back, not 999
    expect(Math.abs(cutoff - daysAgo30)).toBeLessThan(60 * 1000);
  });

  describe('account follower signals', () => {
    const NOW = new Date('2026-12-02T21:00:00Z').getTime();
    let nowSpy;
    beforeEach(() => { nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW); });
    afterEach(() => nowSpy.mockRestore());

    const accountClient = () => makeClient({ accounts: [{ access_token: 'tok', instagram_user_id: 'ig-1' }], recentPosts: [], metricRows: [] });
    const cacheRows = (client) => client.from('account_insights_cache').upsert.mock.calls.map((c) => c[0]);

    test('re-collects the last 3 complete UTC days by default (Meta lags ~2 days)', async () => {
      const client = accountClient();
      getServerSupabaseClient.mockReturnValue(client);
      const body = await (await GET({ url: 'http://localhost:3000/api/cron/media-insights' })).json();

      expect(getDailyAccountInsights.mock.calls.map((c) => c[2])).toEqual(['2026-12-01', '2026-11-30', '2026-11-29']);
      const daily = cacheRows(client).filter((r) => r.insight_type.startsWith('account_daily:'));
      expect(daily.map((r) => r.insight_type)).toEqual(['account_daily:2026-12-01', 'account_daily:2026-11-30', 'account_daily:2026-11-29']);
      expect(daily[0].data).toMatchObject({ follows: 4, unfollows: 3 });
      expect(body.accountDaysSynced).toBe(3);
    });

    test('stores online followers and this month\'s engaged audience', async () => {
      const client = accountClient();
      getServerSupabaseClient.mockReturnValue(client);
      await GET({ url: 'http://localhost:3000/api/cron/media-insights' });

      const rows = cacheRows(client);
      const online = rows.find((r) => r.insight_type === 'online_followers:latest');
      expect(online.data.days).toHaveLength(1);
      const demo = rows.find((r) => r.insight_type === 'engaged_demographics:2026-12');
      expect(demo.data.age).toEqual({ '25-34': 343 });
    });

    test('accountDays backfills further back but is capped at 28 days', async () => {
      const client = accountClient();
      getServerSupabaseClient.mockReturnValue(client);
      await GET({ url: 'http://localhost:3000/api/cron/media-insights?accountDays=500' });
      expect(getDailyAccountInsights).toHaveBeenCalledTimes(28);
      expect(getDailyAccountInsights.mock.calls[27][2]).toBe('2026-11-04');
    });

    test('account failures are counted but never abort the run', async () => {
      const client = accountClient();
      getServerSupabaseClient.mockReturnValue(client);
      getDailyAccountInsights.mockRejectedValue(new Error('rate limited'));
      getOnlineFollowers.mockRejectedValue(new Error('online down'));
      getEngagedAudienceDemographics.mockRejectedValue(new Error('demo down'));

      const res = await GET({ url: 'http://localhost:3000/api/cron/media-insights' });
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.accountDaysFailed).toBe(3);
      expect(body.accountErrors).toEqual(expect.arrayContaining([expect.stringMatching(/online down/), expect.stringMatching(/demo down/)]));
      expect(body.storiesSynced).toBe(2);
    });
  });
});
