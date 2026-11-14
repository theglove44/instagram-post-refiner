import { findPostsWithoutMetrics } from './metrics-coverage';

function fakeSupabase(rows) {
  const ranges = [];
  const builder = {
    select: () => builder,
    not: () => builder,
    order: () => builder,
    range: (from, to) => {
      ranges.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
  return { client: { from: () => builder }, ranges };
}

const post = (i, count) => ({
  id: `p${i}`,
  instagram_media_id: `m${i}`,
  post_metrics: [{ count }],
});

describe('findPostsWithoutMetrics', () => {
  it('pages past the 1000-row cap and finds old posts with no snapshots', async () => {
    // 2500 posts: every post has metrics except the 3 oldest.
    const rows = Array.from({ length: 2500 }, (_, i) => post(i, i >= 2497 ? 0 : 7));
    const { client, ranges } = fakeSupabase(rows);

    const result = await findPostsWithoutMetrics(client);

    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(result.total).toBe(2500);
    expect(result.missing.map(p => p.id)).toEqual(['p2497', 'p2498', 'p2499']);
  });

  it('does not treat posts with many snapshots as missing', async () => {
    const rows = [post(1, 119), post(2, 0), post(3, 1)];
    const { client } = fakeSupabase(rows);

    const result = await findPostsWithoutMetrics(client);

    expect(result.missing).toEqual([{ id: 'p2', instagram_media_id: 'm2' }]);
  });

  it('throws when Supabase reports an error', async () => {
    const builder = {
      select: () => builder, not: () => builder, order: () => builder,
      range: () => Promise.resolve({ data: null, error: { message: 'boom' } }),
    };
    await expect(findPostsWithoutMetrics({ from: () => builder })).rejects.toThrow('boom');
  });
});
