import { GET, POST } from './route';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { findCatchupCandidates } from '@/lib/signal-catchup';
import { getMediaInsights, getMediaDetails } from '@/lib/instagram';
import { delay } from '@/lib/utils';

// Nothing here reaches Instagram, Supabase or the clock: all four are mocked.
jest.mock('@/lib/supabase-server', () => ({ getServerSupabaseClient: jest.fn() }));
jest.mock('@/lib/signal-catchup', () => ({ findCatchupCandidates: jest.fn() }));
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
  for (const m of ['select', 'eq', 'in', 'gte', 'limit', 'order', 'insert', 'update']) b[m] = jest.fn(() => b);
  b.single = jest.fn(async () => ({ data: { id: 'sync-1' }, error: null }));
  b.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return b;
}

function makeClient({ runningSyncs = [], recentCatchups = [], insertResult = { data: null, error: null } } = {}) {
  const syncReads = [{ data: runningSyncs, error: null }, { data: recentCatchups, error: null }];
  const syncStatus = builder({ data: [], error: null });
  // First awaited read = "anything running?", second = "recent catch-up errors".
  let reads = 0;
  syncStatus.then = (resolve, reject) => Promise.resolve(syncReads[Math.min(reads++, 1)]).then(resolve, reject);
  const tables = {
    instagram_accounts: builder({ data: [{ id: 1, access_token: 'token' }], error: null }),
    sync_status: syncStatus,
    post_metrics: builder(insertResult),
  };
  return { from: jest.fn((t) => tables[t]), tables };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const candidate = (i, published = '2025-05-01T00:00:00Z') => ({ id: `p${i}`, instagram_media_id: `m${i}`, published_at: published });

beforeEach(() => {
  jest.clearAllMocks();
  getMediaInsights.mockResolvedValue({ insights: { reach: 100, views: 900, total_views: 950, follows: 2, profile_visits: 5 } });
  getMediaDetails.mockResolvedValue({ details: { likes: 10, comments: 1, mediaType: 'CAROUSEL_ALBUM', mediaProductType: 'FEED' } });
});

describe('POST /api/instagram/metrics/catchup', () => {
  it('returns immediately with a syncId and processes in the background', async () => {
    const client = makeClient();
    getServerSupabaseClient.mockReturnValue(client);
    findCatchupCandidates.mockResolvedValue({ candidates: [candidate(1), candidate(2)], totalRemaining: 30 });

    const body = await (await POST({ json: async () => ({}) })).json();

    expect(body).toMatchObject({ success: true, syncId: 'sync-1', status: 'running', batchSize: 2, totalRemaining: 30 });
    await flush();
    expect(getMediaInsights).toHaveBeenCalledTimes(2);
    expect(client.tables.post_metrics.insert).toHaveBeenCalledTimes(2);
  });

  it('caps the batch at 50 and defaults to 40, however much is asked for', async () => {
    getServerSupabaseClient.mockReturnValue(makeClient());
    findCatchupCandidates.mockResolvedValue({ candidates: [], totalRemaining: 0 });

    await POST({ json: async () => ({ batchSize: 500 }) });
    expect(findCatchupCandidates).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ limit: 50 }));

    await POST({ json: async () => ({}) });
    expect(findCatchupCandidates).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ limit: 40 }));
  });

  it('writes a full new snapshot including the follower signals', async () => {
    const client = makeClient();
    getServerSupabaseClient.mockReturnValue(client);
    findCatchupCandidates.mockResolvedValue({ candidates: [candidate(1)], totalRemaining: 1 });

    await POST({ json: async () => ({}) });
    await flush();

    expect(client.tables.post_metrics.insert.mock.calls[0][0]).toMatchObject({
      post_id: 'p1',
      instagram_media_id: 'm1',
      reach: 100,
      views: 900,
      likes: 10,
      comments: 1,
      follows: 2,
      profile_visits: 5,
      total_views: 950,
      media_type: 'CAROUSEL_ALBUM',
      media_product_type: 'FEED',
    });
  });

  it('pauses between posts so the hourly Graph budget holds', async () => {
    getServerSupabaseClient.mockReturnValue(makeClient());
    findCatchupCandidates.mockResolvedValue({ candidates: [candidate(1), candidate(2), candidate(3)], totalRemaining: 3 });

    await POST({ json: async () => ({}) });
    await flush();

    // Three Graph calls per post; 200 calls/hour means at least 54s per post.
    expect(delay).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(54000);
  });

  it('does not store a snapshot when Meta returns no insights, and reports the failure', async () => {
    const client = makeClient();
    getServerSupabaseClient.mockReturnValue(client);
    findCatchupCandidates.mockResolvedValue({ candidates: [candidate(1)], totalRemaining: 1 });
    getMediaInsights.mockResolvedValue({ insights: null });

    await POST({ json: async () => ({}) });
    await flush();

    expect(client.tables.post_metrics.insert).not.toHaveBeenCalled();
    const update = client.tables.sync_status.update.mock.calls.at(-1)[0];
    expect(update).toMatchObject({ status: 'error', errors_count: 1 });
    expect(update.error_details.errors[0]).toMatchObject({ postId: 'p1' });
  });

  it('keeps going when one post fails', async () => {
    const client = makeClient();
    getServerSupabaseClient.mockReturnValue(client);
    findCatchupCandidates.mockResolvedValue({ candidates: [candidate(1), candidate(2)], totalRemaining: 2 });
    getMediaDetails.mockRejectedValueOnce(new Error('media deleted'));

    await POST({ json: async () => ({}) });
    await flush();

    expect(client.tables.post_metrics.insert).toHaveBeenCalledTimes(1);
    expect(client.tables.sync_status.update.mock.calls.at(-1)[0]).toMatchObject({ status: 'success', posts_processed: 1, errors_count: 1 });
  });

  it('does not start while the backfill or a refresh is still running', async () => {
    getServerSupabaseClient.mockReturnValue(makeClient({ runningSyncs: [{ id: 9, sync_type: 'metrics_backfill' }] }));

    const body = await (await POST({ json: async () => ({}) })).json();

    expect(body).toMatchObject({ success: true, skipped: true });
    expect(findCatchupCandidates).not.toHaveBeenCalled();
    expect(getMediaInsights).not.toHaveBeenCalled();
  });

  it('skips posts that failed in recent catch-up runs', async () => {
    getServerSupabaseClient.mockReturnValue(
      makeClient({ recentCatchups: [{ error_details: { errors: [{ postId: 'dead-1', error: 'x' }] } }] })
    );
    findCatchupCandidates.mockResolvedValue({ candidates: [], totalRemaining: 0 });

    await POST({ json: async () => ({}) });

    const { skipPostIds } = findCatchupCandidates.mock.calls[0][1];
    expect([...skipPostIds]).toEqual(['dead-1']);
  });

  it('does nothing when no posts are waiting', async () => {
    const client = makeClient();
    getServerSupabaseClient.mockReturnValue(client);
    findCatchupCandidates.mockResolvedValue({ candidates: [], totalRemaining: 0 });

    const body = await (await POST({ json: async () => ({}) })).json();

    expect(body).toMatchObject({ success: true, processed: 0, remaining: 0 });
    expect(getMediaInsights).not.toHaveBeenCalled();
  });

  it('answers with an error when no account is connected', async () => {
    const client = makeClient();
    client.tables.instagram_accounts = builder({ data: [], error: null });
    getServerSupabaseClient.mockReturnValue(client);

    const res = await POST({ json: async () => ({}) });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/instagram/metrics/catchup', () => {
  it('reports how many posts are still waiting, without calling Instagram', async () => {
    getServerSupabaseClient.mockReturnValue(makeClient());
    findCatchupCandidates.mockResolvedValue({ candidates: [], totalRemaining: 612 });

    const body = await (await GET()).json();

    expect(body).toMatchObject({ success: true, remaining: 612 });
    expect(getMediaInsights).not.toHaveBeenCalled();
  });
});
