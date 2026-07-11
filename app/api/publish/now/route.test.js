import { POST } from './route';
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

function resolvedBuilder(result, terminal = 'then') {
  const builder = {};
  for (const method of ['select', 'eq', 'limit', 'order']) {
    builder[method] = jest.fn(() => builder);
  }
  builder.single = jest.fn(async () => result);
  if (terminal === 'then') {
    builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  }
  return builder;
}

function makeClient(rpcResult) {
  const postQuery = resolvedBuilder({
    data: { id: 7, status: 'scheduled', retry_count: 0 },
    error: null,
  }, 'single');
  const mediaQuery = resolvedBuilder({
    data: [{ id: 1, scheduled_post_id: 7 }],
    error: null,
  });
  const accountQuery = resolvedBuilder({
    data: [{ access_token: 'token', instagram_user_id: 'ig-user' }],
    error: null,
  });

  return {
    from: jest.fn(table => ({
      scheduled_posts: postQuery,
      media_uploads: mediaQuery,
      instagram_accounts: accountQuery,
    })[table]),
    rpc: jest.fn().mockResolvedValue(rpcResult),
  };
}

describe('publish-now claim handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns conflict and does not publish when another worker wins claim', async () => {
    const client = makeClient({ data: [], error: null });
    getServerSupabaseClient.mockReturnValue(client);

    const response = await POST({ json: async () => ({ id: 7 }) });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toMatch(/another publisher/i);
    expect(executePublish).not.toHaveBeenCalled();
  });

  test('returns clear server error when claim RPC is unavailable', async () => {
    const client = makeClient({ data: null, error: { message: 'RPC missing' } });
    getServerSupabaseClient.mockReturnValue(client);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST({ json: async () => ({ id: 7 }) });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Could not claim post for publishing: RPC missing');
    expect(executePublish).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
