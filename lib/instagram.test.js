/**
 * Graph API helpers. fetch is always mocked: no test reaches Meta.
 * Response shapes below are copied from real v24 responses (2026-11-14 probes).
 */
import {
  getMediaInsights,
  getStoriesWithInsights,
  getDailyAccountInsights,
  getOnlineFollowers,
  getEngagedAudienceDemographics,
  mediaInsightMetrics,
} from './instagram';

const metric = (name, value) => ({ name, period: 'lifetime', values: [{ value }] });

function mockGraph(handler) {
  global.fetch = jest.fn(async (url) => {
    const body = handler(String(url));
    return { status: 200, text: async () => JSON.stringify(body) };
  });
}

const urls = () => global.fetch.mock.calls.map(([url]) => decodeURIComponent(String(url)));

afterEach(() => {
  delete global.fetch;
});

describe('mediaInsightMetrics', () => {
  test('feed images and carousels get the follower signals', () => {
    for (const type of ['IMAGE', 'CAROUSEL_ALBUM']) {
      const list = mediaInsightMetrics(type, 'FEED');
      expect(list).toEqual(expect.arrayContaining(['follows', 'profile_visits', 'profile_activity', 'reposts', 'total_views', 'reach']));
    }
  });

  test('Reels get reposts and total_views but never follows or profile_visits', () => {
    const list = mediaInsightMetrics('VIDEO', 'REELS');
    expect(list).toEqual(expect.arrayContaining(['reposts', 'total_views', 'reach']));
    expect(list).not.toContain('follows');
    expect(list).not.toContain('profile_visits');
    expect(list).not.toContain('profile_activity');
  });

  test('unknown types fall back to the original base set', () => {
    expect(mediaInsightMetrics('VIDEO', null)).toEqual(['reach', 'saved', 'shares', 'total_interactions', 'views']);
  });
});

describe('getMediaInsights', () => {
  test('feed post: asks for follower signals in the same request and parses the profile activity breakdown', async () => {
    mockGraph((url) => {
      if (url.includes('/insights?')) {
        return { data: [metric('reach', 1093), metric('follows', 2), metric('profile_visits', 4), metric('profile_activity', 3), metric('reposts', 2), metric('total_views', 2100), metric('views', 2087)] };
      }
      return {
        id: 'm1',
        media_type: 'IMAGE',
        media_product_type: 'FEED',
        insights: { data: [{ name: 'profile_activity', values: [{ value: 3 }], total_value: { value: 3, breakdowns: [{ dimension_keys: ['action_type'], results: [{ dimension_values: ['bio_link_clicked'], value: 2 }, { dimension_values: ['DIRECTION'], value: 1 }] }] } }] },
      };
    });

    const { insights } = await getMediaInsights('tok', 'm1');

    expect(global.fetch).toHaveBeenCalledTimes(2); // no extra call for the breakdown
    const [typeUrl, insightsUrl] = urls();
    expect(typeUrl).toContain('insights.metric(profile_activity).breakdown(action_type)');
    expect(insightsUrl).toContain('follows');
    expect(insightsUrl).not.toContain('breakdown');
    expect(insights.follows).toBe(2);
    expect(insights.profile_visits).toBe(4);
    expect(insights.total_views).toBe(2100);
    expect(insights.profile_activity_breakdown).toEqual({ BIO_LINK_CLICKED: 2, DIRECTION: 1 });
  });

  test('Reel: requests only Reel-compatible metrics', async () => {
    mockGraph((url) => (url.includes('/insights?')
      ? { data: [metric('reach', 1626), metric('reposts', 2), metric('total_views', 2345)] }
      : { id: 'r1', media_type: 'VIDEO', media_product_type: 'REELS' }));

    const { insights } = await getMediaInsights('tok', 'r1');
    const insightsUrl = urls()[1];
    expect(insightsUrl).not.toContain('follows');
    expect(insightsUrl).toContain('total_views');
    expect(insights.reposts).toBe(2);
    expect(insights.profile_activity_breakdown).toBeNull();
  });

  test('missing values become null, real zeros stay zero', async () => {
    mockGraph((url) => (url.includes('/insights?')
      ? { data: [metric('reach', 0), { name: 'saved', values: [] }] }
      : { id: 'm1', media_type: 'IMAGE', media_product_type: 'FEED' }));

    const { insights } = await getMediaInsights('tok', 'm1');
    expect(insights.reach).toBe(0);
    expect(insights.saved).toBeNull();
    expect(insights.follows).toBeUndefined();
  });

  test('falls back to the base metric set if Meta rejects the extended one', async () => {
    mockGraph((url) => {
      if (!url.includes('/insights?')) return { id: 'm1', media_type: 'IMAGE', media_product_type: 'FEED' };
      if (url.includes('follows')) return { error: { message: '(#100) metric not supported', code: 100 } };
      return { data: [metric('reach', 50)] };
    });

    const { insights } = await getMediaInsights('tok', 'm1');
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(insights.reach).toBe(50);
  });

  test('falls back to a plain type lookup if the nested breakdown errors', async () => {
    mockGraph((url) => {
      if (url.includes('/insights?')) return { data: [metric('reach', 9)] };
      if (url.includes('insights.metric')) return { error: { message: 'nested failed', code: 100 } };
      return { id: 'm1', media_type: 'IMAGE', media_product_type: 'FEED' };
    });

    const { insights } = await getMediaInsights('tok', 'm1');
    expect(insights.reach).toBe(9);
    expect(urls()[2]).toContain('follows');
  });
});

describe('getStoriesWithInsights', () => {
  test('one call returns core metrics, link clicks and the navigation breakdown', async () => {
    mockGraph(() => ({
      data: [{
        id: 's1',
        media_type: 'IMAGE',
        timestamp: '2026-11-14T10:00:00+0000',
        core: { data: [metric('views', 41), metric('link_clicks', 2), metric('follows', 1)] },
        nav: { data: [{ name: 'navigation', values: [{ value: 40 }], total_value: { value: 40, breakdowns: [{ dimension_keys: ['story_navigation_action_type'], results: [{ dimension_values: ['tap_forward'], value: 38 }, { dimension_values: ['tap_exit'], value: 1 }, { dimension_values: ['tap_back'], value: 1 }] }] } }] },
      }],
    }));

    const { stories } = await getStoriesWithInsights('tok', 'ig-1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(urls()[0]).toContain('link_clicks');
    expect(urls()[0]).toContain('.breakdown(story_navigation_action_type).as(nav)');
    expect(stories[0].insights).toMatchObject({ views: 41, link_clicks: 2, follows: 1, navigation: 40 });
    expect(stories[0].insights.navigation_breakdown).toEqual({ TAP_FORWARD: 38, TAP_EXIT: 1, TAP_BACK: 1 });
  });

  test('a story with no navigation yet has a null breakdown', async () => {
    mockGraph(() => ({ data: [{ id: 's1', core: { data: [metric('views', 0)] }, nav: { data: [{ name: 'navigation', values: [{ value: 0 }] }] } }] }));
    const { stories } = await getStoriesWithInsights('tok', 'ig-1');
    expect(stories[0].insights.navigation).toBe(0);
    expect(stories[0].insights.navigation_breakdown).toBeNull();
  });

  test('falls back to the previous request if the aliased one is rejected', async () => {
    mockGraph((url) => (url.includes('.as(')
      ? { error: { message: 'alias unsupported' } }
      : { data: [{ id: 's1', insights: { data: [metric('views', 5)] } }] }));
    const { stories } = await getStoriesWithInsights('tok', 'ig-1');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(stories[0].insights.views).toBe(5);
  });

  test('throws when both requests fail', async () => {
    mockGraph(() => ({ error: { message: 'down' } }));
    await expect(getStoriesWithInsights('tok', 'ig-1')).rejects.toThrow('down');
  });
});

describe('getDailyAccountInsights', () => {
  test('two calls for one UTC day: reach + follows split, then link taps', async () => {
    mockGraph((url) => {
      if (url.includes('profile_links_taps')) {
        return { data: [{ name: 'profile_links_taps', total_value: { value: 2, breakdowns: [{ dimension_keys: ['contact_button_type'], results: [{ dimension_values: ['EMAIL'], value: 2 }] }] } }] };
      }
      return { data: [
        { name: 'reach', total_value: { value: 866, breakdowns: [{ dimension_keys: ['follow_type'], results: [{ dimension_values: ['NON_FOLLOWER'], value: 557 }, { dimension_values: ['FOLLOWER'], value: 300 }] }] } },
        { name: 'follows_and_unfollows', total_value: { breakdowns: [{ dimension_keys: ['follow_type'], results: [{ dimension_values: ['FOLLOWER'], value: 4 }, { dimension_values: ['NON_FOLLOWER'], value: 3 }] }] } },
      ] };
    });

    const day = await getDailyAccountInsights('tok', 'ig-1', '2026-11-12');
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const since = Date.UTC(2026, 10, 12) / 1000;
    expect(urls()[0]).toContain(`since=${since}&until=${since + 86400}`);
    expect(day).toMatchObject({
      date: '2026-11-12',
      follows: 4,
      unfollows: 3,
      reach: 866,
      reachFollower: 300,
      reachNonFollower: 557,
      profileLinkTaps: 2,
      profileLinkTapsByType: { EMAIL: 2 },
    });
  });

  test('an empty breakdown is stored as null, not zero', async () => {
    mockGraph((url) => (url.includes('profile_links_taps')
      ? { data: [{ name: 'profile_links_taps', total_value: { value: 0, breakdowns: [{ dimension_keys: ['contact_button_type'] }] } }] }
      : { data: [{ name: 'follows_and_unfollows', total_value: { breakdowns: [{ dimension_keys: ['follow_type'] }] } }] }));
    const day = await getDailyAccountInsights('tok', 'ig-1', '2026-11-13');
    expect(day.follows).toBeNull();
    expect(day.unfollows).toBeNull();
    expect(day.reach).toBeNull();
    expect(day.profileLinkTaps).toBe(0);
  });

  test('throws on a Graph error', async () => {
    mockGraph(() => ({ error: { message: 'rate limited' } }));
    await expect(getDailyAccountInsights('tok', 'ig-1', '2026-11-12')).rejects.toThrow('rate limited');
  });
});

describe('getOnlineFollowers', () => {
  test('one call; drops the empty recent days', async () => {
    mockGraph(() => ({ data: [{ name: 'online_followers', values: [
      { value: { 0: 1300, 1: 1440 }, end_time: '2026-11-12T08:00:00+0000' },
      { value: {}, end_time: '2026-11-13T08:00:00+0000' },
    ] }] }));
    const { days } = await getOnlineFollowers('tok', 'ig-1');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(urls()[0]).toContain('metric=online_followers&period=lifetime&since=');
    expect(days).toEqual([{ endTime: '2026-11-12T08:00:00+0000', hours: { 0: 1300, 1: 1440 } }]);
  });
});

describe('getEngagedAudienceDemographics', () => {
  test('one call per breakdown, this_month timeframe', async () => {
    mockGraph((url) => {
      const breakdown = new URL(url).searchParams.get('breakdown');
      return { data: [{ name: 'engaged_audience_demographics', total_value: { breakdowns: [{ dimension_keys: [breakdown], results: [{ dimension_values: [`${breakdown}-a`], value: 7 }] }] } }] };
    });
    const demo = await getEngagedAudienceDemographics('tok', 'ig-1');
    expect(global.fetch).toHaveBeenCalledTimes(4);
    expect(urls().every((u) => u.includes('timeframe=this_month'))).toBe(true);
    expect(demo.age).toEqual({ 'age-a': 7 });
    expect(demo.city).toEqual({ 'city-a': 7 });
  });
});
