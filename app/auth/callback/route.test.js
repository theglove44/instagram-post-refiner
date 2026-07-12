/** @jest-environment node */

import { GET } from './route';
import { createServerSupabaseClient } from '@/lib/supabase-auth/server';

jest.mock('@/lib/supabase-auth/server', () => ({ createServerSupabaseClient: jest.fn() }));

describe('Supabase Auth callback', () => {
  const exchangeCodeForSession = jest.fn();
  const originalAppUrl = process.env.APP_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.APP_URL = 'https://example.com';
    createServerSupabaseClient.mockResolvedValue({ auth: { exchangeCodeForSession } });
  });

  afterAll(() => {
    if (originalAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalAppUrl;
  });

  test('exchanges PKCE code and redirects to safe next path', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(new Request('https://example.com/auth/callback?code=abc&next=%2Fhistory'));
    expect(exchangeCodeForSession).toHaveBeenCalledWith('abc');
    expect(response.headers.get('location')).toBe('https://example.com/history');
  });

  test('rejects protocol-relative next path', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(new Request('https://example.com/auth/callback?code=abc&next=%2F%2Fevil.test'));
    expect(response.headers.get('location')).toBe('https://example.com/edit');
  });

  test('returns to login when exchange fails', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error('invalid code') });
    const response = await GET(new Request('https://example.com/auth/callback?code=bad'));
    expect(response.headers.get('location')).toContain('/login?error=callback');
  });
});
