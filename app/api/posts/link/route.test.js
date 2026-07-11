/** @jest-environment node */

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));

const { getServerSupabaseClient } = require('@/lib/supabase-server');
const { POST } = require('./route');

describe('POST /api/posts/link publication timestamp', () => {
  it('links by canonical ID and stores supplied Instagram timestamp', async () => {
    const update = jest.fn((payload) => ({
      eq: jest.fn((column, value) => ({
        select: () => ({
          single: async () => ({ data: { id: value, ...payload }, error: null }),
        }),
      })),
    }));
    const from = jest.fn((table) => {
      if (table !== 'posts') throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { id: 73, post_id: '1712345000000' }, error: null }),
          }),
        }),
        update,
      };
    });
    getServerSupabaseClient.mockReturnValue({ from });

    const request = new Request('http://localhost/api/posts/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postId: 73,
        instagramMediaId: 'ig-media-73',
        instagramPermalink: 'https://www.instagram.com/p/example/',
        publishedAt: '2026-07-01T12:34:56+00:00',
      }),
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      instagram_media_id: 'ig-media-73',
      published_at: '2026-07-01T12:34:56.000Z',
    }));
    const updateQuery = update.mock.results[0].value;
    expect(updateQuery.eq).toHaveBeenCalledWith('id', 73);
  });
});
