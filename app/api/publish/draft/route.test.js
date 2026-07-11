/** @jest-environment node */

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));
jest.mock('@/lib/media', () => ({
  deleteAllPostMedia: jest.fn(),
}));

const { getServerSupabaseClient } = require('@/lib/supabase-server');
const { deleteAllPostMedia } = require('@/lib/media');
const { POST, DELETE } = require('./route');

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

describe('POST /api/publish/draft source linkage', () => {
  it('resolves legacy sourcePostId and stores canonical posts.id', async () => {
    const insert = jest.fn((payload) => ({
      select: () => ({
        single: async () => ({ data: { id: 90, ...payload }, error: null }),
      }),
    }));
    const from = jest.fn((table) => {
      if (table === 'posts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 27, post_id: 'legacy-logged-post' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'scheduled_posts') return { insert };
      throw new Error(`Unexpected table: ${table}`);
    });
    getServerSupabaseClient.mockReturnValue({ from });

    const request = new Request('http://localhost/api/publish/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: 'Ready to publish', sourcePostId: 'legacy-logged-post' }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      caption: 'Ready to publish',
      source_post_id: 27,
      status: 'draft',
    }));
  });
});

function scheduledPostClient() {
  const query = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.single = jest.fn(async () => ({
    data: { id: 7, status: 'scheduled' },
    error: null,
  }));

  return {
    client: { from: jest.fn(() => query) },
    query,
  };
}

describe('draft hard-delete state guard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('preserves scheduled posts and media', async () => {
    const { client, query } = scheduledPostClient();
    getServerSupabaseClient.mockReturnValue(client);

    const response = await DELETE({ url: 'http://localhost/api/publish/draft?id=7' });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/Cannot delete.*scheduled/);
    expect(query.delete).toBeUndefined();
    expect(deleteAllPostMedia).not.toHaveBeenCalled();
  });
});
