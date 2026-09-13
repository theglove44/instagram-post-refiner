import { latestMetricsPerMedia, calculateBestSlots, getPulseData } from './pulse';

function chainable(result) {
  const builder = {};
  for (const method of ['select', 'eq', 'limit', 'order', 'not', 'gte', 'in']) {
    builder[method] = jest.fn(() => builder);
  }
  // Filter result rows by the like() pattern, so a shared table mock can serve
  // multiple query shapes (e.g. views_follow_split vs story_insights).
  builder.like = jest.fn((column, pattern) => {
    const prefix = pattern.replace('%', '');
    builder.then = (resolve, reject) =>
      Promise.resolve({ ...result, data: (result.data || []).filter((row) => (row[column] || '').startsWith(prefix)) }).then(resolve, reject);
    return builder;
  });
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

function makeClient(tables) {
  return {
    from: jest.fn((table) => tables[table] || chainable({ data: [], error: null })),
  };
}

describe('latestMetricsPerMedia', () => {
  test('keeps the last row per media id', () => {
    const latest = latestMetricsPerMedia([
      { instagram_media_id: 'a', reach: 100, fetched_at: '2026-01-01' },
      { instagram_media_id: 'a', reach: 200, fetched_at: '2026-01-02' },
      { instagram_media_id: 'b', reach: 50, fetched_at: '2026-01-01' },
    ]);
    expect(latest.a.reach).toBe(200);
    expect(latest.b.reach).toBe(50);
  });
});

describe('calculateBestSlots', () => {
  test('ranks slots by mean ER and enforces the minimum sample', () => {
    const metrics = {
      m1: { reach: 100, total_interactions: 60, media_type: 'IMAGE' },
      m2: { reach: 100, total_interactions: 40, media_type: 'IMAGE' },
      m3: { reach: 100, total_interactions: 20, media_type: 'IMAGE' },
      m4: { reach: 100, total_interactions: 10, media_type: 'IMAGE' },
    };
    const posts = [
      // Tue 10:00 — three posts, mean ER 0.4
      { instagram_media_id: 'm1', published_at: '2026-05-05T09:00:00Z' },
      { instagram_media_id: 'm2', published_at: '2026-05-12T09:00:00Z' },
      { instagram_media_id: 'm3', published_at: '2026-05-19T09:00:00Z' },
      // Sat 08:00 — single post, higher ER but below minPosts
      { instagram_media_id: 'm4', published_at: '2026-05-09T07:00:00Z' },
    ];
    const slots = calculateBestSlots(posts, metrics, { minPosts: 3, top: 5 });
    expect(slots).toHaveLength(1);
    expect(slots[0].slot).toBe('Tue 10:00');
    expect(slots[0].posts).toBe(3);
    expect(slots[0].avgEr).toBeCloseTo(0.4);
  });
});

describe('getPulseData', () => {
  test('aggregates splits, stories, growth and ranked posts', async () => {
    const client = makeClient({
      instagram_accounts: chainable({ data: [{ instagram_user_id: 'ig-1', username: 'tuckinandtalk' }], error: null }),
      account_insights_cache: chainable({
        data: [
          { insight_type: 'views_follow_split:2026-09-12', data: { follower: 100, nonFollower: 200, byProduct: {} }, fetched_at: 'x' },
          { insight_type: 'story_insights:story-1', data: { views: 15, reach: 15, replies: 1, postedAt: '2026-09-12T20:00:00Z' }, fetched_at: 'x' },
        ],
        error: null,
      }), // one shared builder — like() filters by prefix
      account_snapshots: chainable({
        data: [
          { snapshot_date: '2026-09-01', followers_count: 6000 },
          { snapshot_date: '2026-09-12', followers_count: 6100 },
        ],
        error: null,
      }),
      posts: chainable({
        data: [
          { id: 1, instagram_media_id: 'm1', published_at: '2026-09-10T18:00:00Z', final_version: 'Great lunch spot' },
        ],
        error: null,
      }),
      post_metrics: chainable({
        data: [
          { instagram_media_id: 'm1', reach: 500, total_interactions: 250, media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', fetched_at: '2026-09-11T03:00:00Z' },
        ],
        error: null,
      }),
    });

    const pulse = await getPulseData(client);

    expect(pulse.account.username).toBe('tuckinandtalk');
    expect(pulse.viewsSplit).toHaveLength(1);
    expect(pulse.storyTotals.count).toBe(1);
    expect(pulse.storyTotals.views).toBe(15);
    expect(pulse.growth).toHaveLength(2);
    expect(pulse.rankedPosts).toHaveLength(1);
    expect(pulse.rankedPosts[0].er).toBeCloseTo(0.5);
    expect(pulse.rankedPosts[0].type).toBe('Carousel');
  });

  test('survives empty tables', async () => {
    const client = makeClient({});
    const pulse = await getPulseData(client);
    expect(pulse.account).toBeNull();
    expect(pulse.viewsSplit).toEqual([]);
    expect(pulse.rankedPosts).toEqual([]);
    expect(pulse.bestSlots).toEqual([]);
  });
});
