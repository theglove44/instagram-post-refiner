import {
  calculateBestSlots,
  calculateFormatLeague,
  calculateWeeklyForm,
  calculateCaptionSignals,
  calculateFollowerWinners,
  calculateFollowFlow,
  calculateOnlineHours,
  getPulseData,
} from './pulse';

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
          { id: 1, instagram_media_id: 'm1', published_at: daysAgo(3), final_version: 'Great lunch spot in town?', post_metrics: [
            { reach: 500, total_interactions: 250, saves: 2, shares: 1, comments: 50, likes: 197, views: 900, follows: 4, profile_visits: 12, media_type: 'CAROUSEL_ALBUM', media_product_type: 'FEED', fetched_at: daysAgo(2) },
          ] },
          { id: 2, instagram_media_id: 'm2', published_at: daysAgo(80), final_version: 'Older long caption post', post_metrics: [
            { reach: 400, total_interactions: 100, saves: 0, shares: 0, comments: 20, likes: 80, media_type: 'IMAGE', media_product_type: 'FEED', fetched_at: daysAgo(79) },
          ] },
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
    // follower signals come through from the embedded latest snapshot
    expect(pulse.followerWins.byFollows[0]).toMatchObject({ mediaId: 'm1', follows: 4 });
  });

  test('reads only the latest snapshot per post, in one capped-safe query', async () => {
    const client = makeFullClient();
    await getPulseData(client);
    const posts = client.from.mock.results.find((r, i) => client.from.mock.calls[i][0] === 'posts').value;
    expect(posts.select.mock.calls[0][0]).toMatch(/post_metrics\(/);
    expect(posts.limit).toHaveBeenCalledWith(1, { referencedTable: 'post_metrics' });
    expect(posts.order).toHaveBeenCalledWith('fetched_at', { referencedTable: 'post_metrics', ascending: false });
    expect(client.from).not.toHaveBeenCalledWith('post_metrics');
  });

  test('still works before the follower-signal migration is applied', async () => {
    const posts = chainable({ data: [], error: null });
    const results = [
      { data: null, error: { code: '42703', message: 'column post_metrics_1.follows does not exist' } },
      { data: [{ id: 1, instagram_media_id: 'm1', published_at: daysAgo(3), final_version: 'Hi', post_metrics: [{ reach: 100, total_interactions: 10, media_type: 'IMAGE', media_product_type: 'FEED' }] }], error: null },
    ];
    posts.then = (resolve, reject) => Promise.resolve(results.shift()).then(resolve, reject);
    const pulse = await getPulseData(makeClient({ posts }));
    expect(posts.select).toHaveBeenCalledTimes(2);
    expect(posts.select.mock.calls[1][0]).not.toMatch(/follows/);
    expect(pulse.postCount).toBe(1);
    expect(pulse.followerWins.byFollows).toEqual([]);
  });

  test('builds the follow flow and online hours from the cache', async () => {
    const cacheRows = [
      { insight_type: 'account_daily:2026-09-11', data: { date: '2026-09-11', follows: 5, unfollows: 2 } },
      { insight_type: 'account_daily:2026-09-12', data: { date: '2026-09-12', follows: 3, unfollows: 4 } },
      { insight_type: 'online_followers:latest', data: { days: [{ endTime: '2026-09-12T07:00:00+0000', hours: { 0: 100, 1: 900 } }] } },
    ];
    const pulse = await getPulseData(makeClient({ account_insights_cache: chainable({ data: cacheRows, error: null }) }));
    expect(pulse.followFlow.totals).toEqual({ follows: 8, unfollows: 6, net: 2 });
    expect(pulse.onlineHours.peak[0].hour).toBe(9); // PT 01:00 on 11 Sep (PDT) = 09:00 BST
  });

  test('survives empty tables', async () => {
    const pulse = await getPulseData(makeClient({}));
    expect(pulse.followerWins).toEqual({ byFollows: [], byVisitsPer1k: [], postsWithSignals: 0 });
    expect(pulse.followFlow.days).toEqual([]);
    expect(pulse.onlineHours).toBeNull();
    expect(pulse.account).toBeNull();
    expect(pulse.viewsSplit).toEqual([]);
    expect(pulse.rankedPosts).toEqual([]);
    expect(pulse.bestSlots).toEqual([]);
    expect(pulse.formatLeague).toEqual([]);
    expect(pulse.weeklyForm.weeks).toEqual([]);
  });
});

describe('calculateFollowerWinners', () => {
  const row = (mediaId, follows, profileVisits, views, extra = {}) => ({ mediaId, follows, profileVisits, views, excerpt: mediaId, format: 'Images', publishedAt: daysAgo(5), ...extra });

  test('ranks by follows gained, ignoring posts with no follow data or zero follows', () => {
    const wins = calculateFollowerWinners([
      row('a', 2, 5, 1000),
      row('b', 9, 30, 4000),
      row('c', null, null, 5000), // Reel: Meta has no follows
      row('d', 0, 1, 800),
    ]);
    expect(wins.byFollows.map((r) => r.mediaId)).toEqual(['b', 'a']);
    expect(wins.postsWithSignals).toBe(3);
  });

  test('ranks profile visits per 1k views, needing enough views to be fair', () => {
    const wins = calculateFollowerWinners([
      row('small', 1, 10, 50), // 200 per 1k but tiny sample
      row('x', 1, 12, 1000), // 12 per 1k
      row('y', 1, 30, 1500), // 20 per 1k
    ], { minViews: 300 });
    expect(wins.byVisitsPer1k.map((r) => r.mediaId)).toEqual(['y', 'x']);
    expect(wins.byVisitsPer1k[0].visitsPer1k).toBeCloseTo(20);
  });

  test('respects the top limit', () => {
    const rows = Array.from({ length: 8 }, (_, i) => row(`p${i}`, i + 1, 10, 1000));
    expect(calculateFollowerWinners(rows, { top: 3 }).byFollows).toHaveLength(3);
  });
});

describe('calculateFollowFlow', () => {
  test('orders days, computes net and keeps unknown days as gaps', () => {
    const flow = calculateFollowFlow([
      { date: '2026-09-12', follows: 3, unfollows: 4 },
      { date: '2026-09-10', follows: null, unfollows: null },
      { date: '2026-09-11', follows: 5, unfollows: 2 },
    ]);
    expect(flow.days.map((d) => d.date)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
    expect(flow.days[0].net).toBeNull();
    expect(flow.days[2].net).toBe(-1);
    expect(flow.totals).toEqual({ follows: 8, unfollows: 6, net: 2 });
    expect(flow.daysWithData).toBe(2);
  });

  test('keeps only the most recent window', () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({ date: `2026-08-${String(i + 1).padStart(2, '0')}`, follows: 1, unfollows: 0 }));
    expect(calculateFollowFlow(rows, { days: 28 }).days).toHaveLength(28);
  });
});

describe('calculateOnlineHours', () => {
  test('converts Pacific hour keys to UK hours using each day\'s own offsets', () => {
    // Winter: PST (UTC-8), GMT (UTC+0) — PT midnight is 08:00 UK
    const winter = calculateOnlineHours([{ endTime: '2026-11-12T08:00:00+0000', hours: { 0: 10, 13: 99 } }]);
    expect(winter.hours.find((h) => h.hour === 8).followers).toBe(10);
    expect(winter.hours.find((h) => h.hour === 21).followers).toBe(99);
    expect(winter.peak[0]).toEqual({ hour: 21, followers: 99 });
  });

  test('uses the median across days so one glitchy day cannot skew an hour', () => {
    const days = [1000, 1010, 4].map((v, i) => ({ endTime: `2026-11-1${i}T08:00:00+0000`, hours: { 0: v } }));
    const result = calculateOnlineHours(days);
    expect(result.hours.find((h) => h.hour === 8).followers).toBe(1000);
    expect(result.daysUsed).toBe(3);
  });

  test('returns null with no usable days', () => {
    expect(calculateOnlineHours([])).toBeNull();
    expect(calculateOnlineHours(undefined)).toBeNull();
  });
});
