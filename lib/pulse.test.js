import { latestMetricsPerMedia, calculateBestSlots, calculateFormatLeague, calculateWeeklyForm, calculateCaptionSignals, getPulseData } from './pulse';

function chainable(result, likeFilter) {
  const builder = {};
  for (const method of ['select', 'eq', 'limit', 'order', 'not', 'gte', 'in', 'update']) {
    builder[method] = jest.fn(() => builder);
  }
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

// fixed "now" so date-window tests are deterministic
const realDate = Date;
const NOW = new realDate('2026-09-13T12:00:00Z').getTime();
const daysAgo = (n) => new realDate(NOW - n * 24 * 60 * 60 * 1000).toISOString();
let nowSpy;
beforeAll(() => { nowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW); });
afterAll(() => nowSpy.mockRestore());

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
      m1: { reach: 100, total_interactions: 60 },
      m2: { reach: 100, total_interactions: 40 },
      m3: { reach: 100, total_interactions: 20 },
      m4: { reach: 100, total_interactions: 10 },
    };
    const posts = [
      { instagram_media_id: 'm1', published_at: '2026-05-05T09:00:00Z' },
      { instagram_media_id: 'm2', published_at: '2026-05-12T09:00:00Z' },
      { instagram_media_id: 'm3', published_at: '2026-05-19T09:00:00Z' },
      { instagram_media_id: 'm4', published_at: '2026-05-09T07:00:00Z' },
    ];
    const slots = calculateBestSlots(posts, metrics, { minPosts: 3, top: 5 });
    expect(slots).toHaveLength(1);
    expect(slots[0].slot).toBe('Tue 10:00');
    expect(slots[0].posts).toBe(3);
    expect(slots[0].avgEr).toBeCloseTo(0.4);
  });
});

describe('calculateFormatLeague', () => {
  test('computes per-1k economics and sorts by median ER', () => {
    const league = calculateFormatLeague([
      { format: 'Images', er: 0.45, reach: 500, saves: 1, shares: 0, comments: 80 },
      { format: 'Carousels', er: 0.42, reach: 800, saves: 1, shares: 2, comments: 90 },
      { format: 'Reels', er: 0.27, reach: 3000, saves: 18, shares: 30, comments: 75 },
    ]);
    expect(league.map((l) => l.format)).toEqual(['Images', 'Carousels', 'Reels']);
    const reels = league[2];
    expect(reels.savesPer1k).toBeCloseTo(6, 0);
    expect(reels.talkPer1k).toBeCloseTo(25, 0);
    expect(reels.posts).toBe(1);
  });
});

describe('calculateWeeklyForm', () => {
  test('buckets by week and flags season best', () => {
    const form = calculateWeeklyForm([
      { date: '2026-09-07', er: 0.55 },
      { date: '2026-09-09', er: 0.55 },
      { date: '2026-08-31', er: 0.42 },
      { date: '2026-06-01', er: 0.26 },
    ]);
    expect(form.weeks).toHaveLength(3);
    expect(form.thisWeek.medianEr).toBeCloseTo(0.55);
    expect(form.thisWeek).toBe(form.weeks[form.weeks.length - 1]);
    expect(form.seasonBest).toBeCloseTo(0.55);
  });
});

describe('calculateCaptionSignals', () => {
  test('splits length buckets and question effect', () => {
    const signals = calculateCaptionSignals([
      { length: 100, hasQuestion: true, er: 0.55 },
      { length: 300, hasQuestion: false, er: 0.27 },
      { length: 700, hasQuestion: true, er: 0.45 },
    ]);
    expect(signals.length.find((b) => b.name === 'short').posts).toBe(1);
    expect(signals.length.find((b) => b.name === 'long').medianEr).toBeCloseTo(0.45);
    expect(signals.question.medianEr).toBeCloseTo(0.5);
    expect(signals.noQuestion.medianEr).toBeCloseTo(0.27);
  });
});

describe('getPulseData', () => {
  function makeFullClient() {
    const cacheRows = [
      { insight_type: 'views_follow_split:2026-09-12', data: { follower: 100, nonFollower: 200, byProduct: { STORY: { follower: 40, nonFollower: 60 } } }, fetched_at: 'x' },
      { insight_type: 'story_insights:story-1', data: { views: 15, reach: 15, replies: 1, postedAt: daysAgo(1) }, fetched_at: 'x' },
    ];
    return makeClient({
      instagram_accounts: chainable({ data: [{ instagram_user_id: 'ig-1', username: 'tuckinandtalk' }], error: null }),
      account_insights_cache: chainable({ data: cacheRows, error: null }),
      account_snapshots: chainable({
        data: [
          { snapshot_date: '2026-09-01', followers_count: 6000 },
          { snapshot_date: '2026-09-12', followers_count: 6100 },
        ],
        error: null,
      }),
      posts: chainable({
        data: [
          { id: 1, instagram_media_id: 'm1', published_at: daysAgo(3), final_version: 'Great lunch spot in town?' },
          { id: 2, instagram_media_id: 'm2', published_at: daysAgo(80), final_version: 'Older long caption post' },
        ],
        error: null,
      }),
      post_metrics: chainable({
        data: [
          { instagram_media_id: 'm1', reach: 500, total_interactions: 250, saves: 2, shares: 1, comments: 50, likes: 197, media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', fetched_at: daysAgo(2) },
          { instagram_media_id: 'm2', reach: 400, total_interactions: 100, saves: 0, shares: 0, comments: 20, likes: 80, media_type: 'IMAGE', media_product_type: 'FEED', fetched_at: daysAgo(79) },
        ],
        error: null,
      }),
    });
  }

  test('aggregates all sections from one query set', async () => {
    const pulse = await getPulseData(makeFullClient());

    expect(pulse.account.username).toBe('tuckinandtalk');
    expect(pulse.viewsSplit).toHaveLength(1);
    expect(pulse.storyTotals.views).toBe(15);
    expect(pulse.growth).toHaveLength(2);
    // 30-day window only includes m1
    expect(pulse.postCount).toBe(1);
    expect(pulse.rankedPosts[0].er).toBeCloseTo(0.5);
    expect(pulse.rankedPosts[0].excerpt).toMatch(/\?$/);
    // league covers both posts (year window)
    expect(pulse.formatLeague.map((l) => l.format)).toEqual(['Carousels', 'Images']);
    // form has two weeks
    expect(pulse.weeklyForm.weeks).toHaveLength(2);
    // caption signals computed over the year
    expect(pulse.captionSignals.question.posts).toBe(1);
  });

  test('survives empty tables', async () => {
    const pulse = await getPulseData(makeClient({}));
    expect(pulse.account).toBeNull();
    expect(pulse.viewsSplit).toEqual([]);
    expect(pulse.rankedPosts).toEqual([]);
    expect(pulse.bestSlots).toEqual([]);
    expect(pulse.formatLeague).toEqual([]);
    expect(pulse.weeklyForm.weeks).toEqual([]);
  });
});
