import { GET } from './route';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { executePublish } from '@/lib/publishing';

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));
jest.mock('@/lib/publishing', () => ({
  executePublish: jest.fn(),
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

function queryBuilder(result) {
  const builder = {};
  for (const method of ['select', 'eq', 'lte', 'order', 'limit']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function makeClient(rpcResult) {
  const dueQuery = queryBuilder({
    data: [{ id: 9, status: 'scheduled', retry_count: 0 }],
    error: null,
  });
  const accountQuery = queryBuilder({
    data: [{ access_token: 'token', instagram_user_id: 'ig-user' }],
    error: null,
  });

  return {
    from: jest.fn(table => ({
      scheduled_posts: dueQuery,
      instagram_accounts: accountQuery,
    })[table]),
    rpc: jest.fn().mockResolvedValue(rpcResult),
  };
}

describe('cron publishing claim handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('skips stale due-list entry when another worker owns claim', async () => {
    const client = makeClient({ data: [], error: null });
    getServerSupabaseClient.mockReturnValue(client);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results).toEqual([{
      id: 9,
      status: 'skipped',
      reason: 'Post already claimed or state changed',
    }]);
    expect(client.rpc).toHaveBeenCalledWith(
      'claim_scheduled_post_for_publishing',
      expect.objectContaining({ p_require_due: true })
    );
    expect(executePublish).not.toHaveBeenCalled();
  });

  test('reports RPC errors as claim failures without publishing', async () => {
    const client = makeClient({ data: null, error: { message: 'RPC unavailable' } });
    getServerSupabaseClient.mockReturnValue(client);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await GET();
    const body = await response.json();

    expect(body.results[0]).toEqual({
      id: 9,
      status: 'claim_failed',
      error: 'Could not claim post for publishing: RPC unavailable',
    });
    expect(executePublish).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
