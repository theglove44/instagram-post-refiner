/** @jest-environment node */

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));

const { getServerSupabaseClient } = require('@/lib/supabase-server');
const { GET } = require('./route');

describe('GET /api/posts identity contract', () => {
  it('uses posts.id for logged and imported rows while retaining legacy post_id', async () => {
    const rows = [
      {
        id: 12,
        post_id: '1712345678901',
        topic: 'Logged',
        ai_version: 'AI',
        final_version: 'Final',
        edit_count: 2,
        created_at: '2026-07-10T10:00:00.000Z',
        published_at: null,
      },
      {
        id: 44,
        post_id: 'ig_987654321',
        topic: 'Imported',
        ai_version: 'Imported caption',
        final_version: 'Imported caption',
        edit_count: 0,
        created_at: '2026-07-09T10:00:00.000Z',
        published_at: '2026-07-11T08:30:00.000Z',
      },
    ];
    const limit = jest.fn().mockResolvedValue({ data: rows, error: null });
    const order = jest.fn().mockReturnValue({ limit });
    const select = jest.fn().mockReturnValue({ order });
    getServerSupabaseClient.mockReturnValue({
      from: jest.fn().mockReturnValue({ select }),
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.posts).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 12, postId: '1712345678901', post_id: '1712345678901' }),
      expect.objectContaining({ id: 44, postId: 'ig_987654321', post_id: 'ig_987654321' }),
    ]));
  });
});
