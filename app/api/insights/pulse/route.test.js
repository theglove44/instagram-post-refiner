import { GET } from './route';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { getPulseData } from '@/lib/pulse';

jest.mock('@/lib/supabase-server', () => ({
  getServerSupabaseClient: jest.fn(),
}));
jest.mock('@/lib/pulse', () => ({
  getPulseData: jest.fn(),
}));

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

describe('GET /api/insights/pulse', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns the pulse payload', async () => {
    getPulseData.mockResolvedValue({ account: { username: 'x' }, viewsSplit: [] });
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.account.username).toBe('x');
  });

  test('returns 500 when aggregation fails', async () => {
    getPulseData.mockRejectedValue(new Error('db down'));
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toMatch(/db down/);
  });
});
