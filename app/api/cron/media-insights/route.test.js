import { GET } from './route';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { getViewsFollowBreakdown, getReelEnhancedInsights } from '@/lib/instagram';

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));
jest.mock('@/lib/instagram', () => ({
  getViewsFollowBreakdown: jest.fn(),
  getReelEnhancedInsights: jest.fn(),
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

describe('media-insights cron', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getViewsFollowBreakdown.mockResolvedValue(VIEWS_SPLIT);
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

    // two upserts: one daily split, one reel
    const upserts = client.from('account_insights_cache').upsert.mock.calls;
    expect(upserts).toHaveLength(2);
    expect(upserts[0][0].insight_type).toMatch(/^views_follow_split:\d{4}-\d{2}-\d{2}$/);
    expect(upserts[1][0].insight_type).toBe('reel_insights:reel-1');
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
});
