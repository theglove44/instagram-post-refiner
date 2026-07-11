import { cookies } from 'next/headers';
import { exchangeCodeForToken, getInstagramAccount } from '@/lib/instagram';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { GET } from './route';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (url) => ({
      headers: { get: (name) => name.toLowerCase() === 'location' ? String(url) : null },
    }),
  },
}));
jest.mock('@/lib/instagram', () => ({
  exchangeCodeForToken: jest.fn(),
  getInstagramAccount: jest.fn(),
}));
jest.mock('@/lib/supabase-server', () => ({ getServerSupabaseClient: jest.fn() }));

describe('Instagram OAuth callback feedback', () => {
  const originalRedirectUri = process.env.INSTAGRAM_REDIRECT_URI;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INSTAGRAM_REDIRECT_URI = 'https://app.example.com/api/instagram/callback';
  });

  afterAll(() => {
    process.env.INSTAGRAM_REDIRECT_URI = originalRedirectUri;
  });

  it('returns provider failures to Settings with durable feedback', async () => {
    const response = await GET({
      url: 'https://app.example.com/api/instagram/callback?error=access_denied&error_description=Permission%20denied',
    });
    const location = new URL(response.headers.get('location'));

    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('instagram_error')).toBe('Permission denied');
  });

  it('returns successful connections to Settings with the username', async () => {
    cookies.mockResolvedValue({
      get: jest.fn(() => ({ value: 'valid-state' })),
      delete: jest.fn(),
    });
    exchangeCodeForToken.mockResolvedValue({ accessToken: 'token', expiresIn: 3600 });
    getInstagramAccount.mockResolvedValue({
      instagramUserId: '123',
      username: 'creator',
      facebookPageId: '456',
    });
    getServerSupabaseClient.mockReturnValue({
      from: jest.fn(() => ({
        upsert: jest.fn().mockResolvedValue({ error: null }),
      })),
    });

    const response = await GET({
      url: 'https://app.example.com/api/instagram/callback?code=abc&state=valid-state',
    });
    const location = new URL(response.headers.get('location'));

    expect(location.pathname).toBe('/settings');
    expect(location.searchParams.get('instagram_connected')).toBe('creator');
  });
});
