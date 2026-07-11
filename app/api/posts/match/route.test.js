/** @jest-environment node */

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));
jest.mock('@/lib/instagram', () => ({ getRecentMedia: jest.fn() }));
jest.mock('@/lib/matching', () => ({ findBestMatches: jest.fn() }));

const { getServerSupabaseClient } = require('@/lib/supabase-server');
const { GET } = require('./route');

describe('GET /api/posts/match per-post filter', () => {
  it('resolves legacy post ID and filters suggestions by canonical posts.id', async () => {
    const filterByPost = jest.fn().mockResolvedValue({
      data: [{
        id: 5,
        post_id: 31,
        instagram_media_id: 'ig-media-1',
        confidence_score: '0.910',
        status: 'pending',
        created_at: '2026-07-11T09:00:00.000Z',
      }],
      error: null,
    });
    const from = jest.fn((table) => {
      if (table === 'posts') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 31, post_id: 'legacy-31' }, error: null }),
            }),
          }),
        };
      }
      if (table === 'match_suggestions') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({ eq: filterByPost }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });
    getServerSupabaseClient.mockReturnValue({ from });

    const response = await GET(new Request('http://localhost/api/posts/match?postId=legacy-31'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(filterByPost).toHaveBeenCalledWith('post_id', 31);
    expect(body.suggestions).toEqual([
      expect.objectContaining({ postId: 31, instagramMediaId: 'ig-media-1' }),
    ]);
  });
});
