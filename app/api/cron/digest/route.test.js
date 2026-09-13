import { GET, buildDigestText } from './route';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { getPulseData } from '@/lib/pulse';

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));
jest.mock('@/lib/pulse', () => ({
  getPulseData: jest.fn(),
}));

const originalResponse = global.Response;
const originalEnv = process.env;

beforeAll(() => {
  global.Response = {
    json: (body, init = {}) => ({
      status: init.status || 200,
      json: async () => body,
    }),
  };
});

afterEach(() => {
  process.env = originalEnv;
});

afterAll(() => {
  global.Response = originalResponse;
});

const PULSE = {
  viewsSplit: [
    { key: 'views_follow_split:2026-09-12', follower: 1000, nonFollower: 1500, byProduct: { STORY: { follower: 400, nonFollower: 200 }, REEL: { follower: 10, nonFollower: 500 } } },
  ],
  storyTotals: { count: 5, views: 200, replies: 3, follows: 0 },
  growth: [
    { date: '2026-08-14', followers: 6700 },
    { date: '2026-09-13', followers: 6890 },
  ],
  postCount: 12,
  medianEr: 0.41,
  rankedPosts: [
    { er: 0.72, reach: 524, interactions: 377, type: 'Carousel', publishedAt: '2026-09-01T18:00:00Z', excerpt: 'Copenhagen summer trip' },
  ],
  bestSlots: [{ slot: 'Wed 19:00', posts: 6, avgEr: 0.513 }],
};

describe('buildDigestText', () => {
  test('renders the key numbers', () => {
    const text = buildDigestText(PULSE, { now: new Date('2026-09-13T08:00:00Z') });
    expect(text).toMatch(/Views yesterday: 2,500 \(60% from non-followers\)/);
    expect(text).toMatch(/Stories \(7d\): 5 posted, 200 views, 3 replies/);
    expect(text).toMatch(/Followers: 6,890 \(\+190 in 30d\)/);
    expect(text).toMatch(/median ER 41%/);
    expect(text).toMatch(/Best: 72% ER/);
    expect(text).toMatch(/Next best slot: Wed 19:00 UK/);
  });

  test('handles empty data without crashing', () => {
    const text = buildDigestText({ viewsSplit: [], storyTotals: { count: 0 }, growth: [], postCount: 0, medianEr: null, rankedPosts: [], bestSlots: [] });
    expect(text).toMatch(/no data yet/i);
  });
});

describe('GET /api/cron/digest', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the digest without pushing when NTFY_TOPIC is unset', async () => {
    process.env = { ...originalEnv, NTFY_TOPIC: '' };
    getServerSupabaseClient.mockReturnValue({});
    getPulseData.mockResolvedValue(PULSE);
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.pushed).toBe(false);
    expect(body.digest).toMatch(/Views yesterday: 2,500/);
  });

  test('pushes to ntfy when NTFY_TOPIC is set', async () => {
    process.env = { ...originalEnv, NTFY_TOPIC: 'test-topic' };
    getServerSupabaseClient.mockReturnValue({});
    getPulseData.mockResolvedValue(PULSE);
    const fetchMock = global.fetch = jest.fn().mockResolvedValue({ ok: true });
    const response = await GET();
    const body = await response.json();
    expect(body.pushed).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://ntfy.sh/test-topic',
      expect.objectContaining({ method: 'POST' })
    );
    delete global.fetch;
  });

  test('still returns the digest when the push fails', async () => {
    process.env = { ...originalEnv, NTFY_TOPIC: 'test-topic' };
    getServerSupabaseClient.mockReturnValue({});
    getPulseData.mockResolvedValue(PULSE);
    const fetchMock = global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.pushed).toBe(false);
    expect(body.digest).toBeTruthy();
    delete global.fetch;
    fetchMock.mockRestore?.();
  });
});
