import { GET, POST } from './route';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { getMediaInsights, getMediaDetails } from '@/lib/instagram';

jest.mock('@/lib/supabase-server', () => ({ getServerSupabaseClient: jest.fn() }));
jest.mock('@/lib/instagram', () => ({
  getMediaInsights: jest.fn(),
  getMediaDetails: jest.fn(),
  getTokenExpiryDate: jest.fn(),
}));
jest.mock('@/lib/utils', () => ({ delay: jest.fn(() => Promise.resolve()) }));

const originalResponse = global.Response;
beforeAll(() => {
  global.Response = {
    json: (body, init = {}) => ({ status: init.status || 200, json: async () => body }),
  };
});
afterAll(() => {
  global.Response = originalResponse;
});

function builder(result) {
  const b = {};
  for (const m of ['select', 'eq', 'limit', 'order', 'not', 'gte', 'update']) b[m] = jest.fn(() => b);
  b.insert = jest.fn(() => b);
  b.single = jest.fn(async () => result);
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}

function makeClient({ metricsInsertResults = [{ error: null }] } = {}) {
  const postMetrics = builder({ data: null, error: null });
  postMetrics.insert = jest.fn();
  for (const r of metricsInsertResults) postMetrics.insert.mockResolvedValueOnce(r);
  postMetrics.insert.mockResolvedValue({ error: null });

  const tables = {
    instagram_accounts: builder({ data: [{ id: 1, access_token: 'token' }], error: null }),
    posts: builder({ data: { id: 'p1', instagram_media_id: 'm1' }, error: null }),
    sync_status: builder({ data: { id: 'sync-1' }, error: null }),
    post_metrics: postMetrics,
  };
  return { from: jest.fn(t => tables[t]), tables };
}

const FEED_INSIGHTS = { reach: 1093, saved: 1, shares: 3, total_interactions: 226, views: 2087, follows: 2, profile_visits: 4, profile_activity: 0, reposts: 2, total_views: 2110, profile_activity_breakdown: null };

beforeEach(() => {
  jest.clearAllMocks();
  getMediaInsights.mockResolvedValue({ insights: FEED_INSIGHTS });
  getMediaDetails.mockResolvedValue({ details: { likes: 220, comments: 2, mediaType: 'IMAGE', mediaProductType: 'FEED' } });
});

describe('GET /api/instagram/metrics?postId=', () => {
  it('stores the follower signals alongside the core snapshot', async () => {
    const client = makeClient();
    getServerSupabaseClient.mockReturnValue(client);

    const body = await (await GET({ url: 'http://localhost/api/instagram/metrics?postId=p1' })).json();

    expect(body.success).toBe(true);
    const row = client.tables.post_metrics.insert.mock.calls[0][0];
    expect(row).toMatchObject({ reach: 1093, likes: 220, follows: 2, profile_visits: 4, reposts: 2, total_views: 2110, profile_activity: 0 });
    expect(row).not.toHaveProperty('impressions');
  });

  it('still saves the core snapshot when the migration has not been applied', async () => {
    const client = makeClient({
      metricsInsertResults: [{ error: { code: 'PGRST204', message: "Could not find the 'follows' column of 'post_metrics' in the schema cache" } }],
    });
    getServerSupabaseClient.mockReturnValue(client);

    await GET({ url: 'http://localhost/api/instagram/metrics?postId=p1' });

    const calls = client.tables.post_metrics.insert.mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls[1][0]).toMatchObject({ reach: 1093, likes: 220 });
    expect(calls[1][0]).not.toHaveProperty('follows');
  });
});

describe('POST /api/instagram/metrics (background refresh)', () => {
  it('writes follower signals for every refreshed post', async () => {
    const client = makeClient();
    client.tables.posts = builder({ data: [{ id: 'p1', instagram_media_id: 'm1' }, { id: 'p2', instagram_media_id: 'm2' }], error: null, count: 2 });
    getServerSupabaseClient.mockReturnValue(client);

    const body = await (await POST({ json: async () => ({ days: 7 }) })).json();
    expect(body).toMatchObject({ success: true, status: 'running' });

    await new Promise(r => setTimeout(r, 0));
    const rows = client.tables.post_metrics.insert.mock.calls.map(c => c[0]);
    expect(rows).toHaveLength(2);
    expect(rows.every(r => r.follows === 2 && !('impressions' in r))).toBe(true);
  });

  it('stores NULL, not zeros, for a pre-2024-07 post that Meta never measured', async () => {
    const client = makeClient();
    client.tables.posts = builder({ data: [{ id: 'old', instagram_media_id: 'm-old', published_at: '2023-06-15T10:00:00Z' }], error: null, count: 1 });
    getServerSupabaseClient.mockReturnValue(client);
    getMediaInsights.mockResolvedValue({ insights: { reach: 77, views: 0, total_views: 0, follows: 0, profile_visits: 0, reposts: 0 } });

    await POST({ json: async () => ({ days: 365 }) });
    await new Promise(r => setTimeout(r, 0));

    const row = client.tables.post_metrics.insert.mock.calls[0][0];
    expect(row).toMatchObject({ reach: 77, follows: null, profile_visits: null, total_views: null, reposts: null });
  });
});
