import { GET, POST } from './route';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { findPostsWithoutMetrics } from '@/lib/metrics-coverage';
import { getMediaInsights, getMediaDetails } from '@/lib/instagram';

jest.mock('@/lib/supabase-server', () => ({ getServerSupabaseClient: jest.fn() }));
jest.mock('@/lib/metrics-coverage', () => ({ findPostsWithoutMetrics: jest.fn() }));
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
  for (const m of ['select', 'eq', 'limit', 'order', 'insert', 'update']) b[m] = jest.fn(() => b);
  b.single = jest.fn(async () => result);
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}

function makeClient() {
  const tables = {
    instagram_accounts: builder({ data: [{ id: 1, access_token: 'token' }], error: null }),
    sync_status: builder({ data: { id: 'sync-1' }, error: null }),
    post_metrics: builder({ data: null, error: null }),
  };
  return { from: jest.fn(t => tables[t]), tables };
}

beforeEach(() => {
  jest.clearAllMocks();
  getMediaInsights.mockResolvedValue({ insights: { reach: 10 } });
  getMediaDetails.mockResolvedValue({ details: { likes: 1, comments: 0 } });
});

describe('GET /api/instagram/metrics/backfill', () => {
  it('reports coverage from the uncapped lookup', async () => {
    getServerSupabaseClient.mockReturnValue(makeClient());
    findPostsWithoutMetrics.mockResolvedValue({
      total: 1947,
      missing: Array.from({ length: 783 }, (_, i) => ({ id: i, instagram_media_id: `m${i}` })),
    });

    const body = await (await GET()).json();

    expect(body).toMatchObject({ success: true, total: 1947, withMetrics: 1164, remaining: 783 });
  });
});

describe('POST /api/instagram/metrics/backfill', () => {
  it('batches only posts that truly have no metrics', async () => {
    const client = makeClient();
    getServerSupabaseClient.mockReturnValue(client);
    findPostsWithoutMetrics.mockResolvedValue({
      total: 3,
      missing: [{ id: 'old', instagram_media_id: 'm-old' }],
    });

    const res = await POST({ json: async () => ({}) });
    const body = await res.json();

    expect(body).toMatchObject({ success: true, status: 'running', batchSize: 1, totalRemaining: 1 });
    await new Promise(r => setTimeout(r, 0));
    expect(getMediaInsights).toHaveBeenCalledWith('token', 'm-old');
    expect(getMediaInsights).toHaveBeenCalledTimes(1);
  });

  it('stores the follower signals with each snapshot and drops the stale impressions field', async () => {
    const client = makeClient();
    getServerSupabaseClient.mockReturnValue(client);
    findPostsWithoutMetrics.mockResolvedValue({ total: 1, missing: [{ id: 'p1', instagram_media_id: 'm1' }] });
    getMediaInsights.mockResolvedValue({
      insights: { reach: 100, follows: 3, profile_visits: 7, total_views: 250, profile_activity_breakdown: { BIO_LINK_CLICKED: 1 } },
    });

    await POST({ json: async () => ({}) });
    await new Promise(r => setTimeout(r, 0));

    const row = client.tables.post_metrics.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      post_id: 'p1',
      reach: 100,
      follows: 3,
      profile_visits: 7,
      total_views: 250,
      reposts: null,
      profile_activity_breakdown: { BIO_LINK_CLICKED: 1 },
    });
    expect(row).not.toHaveProperty('impressions');
  });

  it('does nothing when every post already has metrics', async () => {
    getServerSupabaseClient.mockReturnValue(makeClient());
    findPostsWithoutMetrics.mockResolvedValue({ total: 3, missing: [] });

    const body = await (await POST({ json: async () => ({}) })).json();

    expect(body).toMatchObject({ success: true, processed: 0, remaining: 0 });
    expect(getMediaInsights).not.toHaveBeenCalled();
  });
});
