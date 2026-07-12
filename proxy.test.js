/** @jest-environment node */

import { NextRequest, NextResponse } from 'next/server';
import { config, proxy } from './proxy';
import {
  authenticateSupabaseRequest,
  unauthenticatedResponse,
} from '@/lib/supabase-auth/middleware';

jest.mock('@/lib/supabase-auth/middleware', () => ({
  authenticateSupabaseRequest: jest.fn(),
  unauthenticatedResponse: jest.fn(),
}));

function request(path, headers = {}) {
  return new NextRequest(`https://example.com${path}`, { headers });
}

function basicAuth(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

describe('proxy authentication gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = 'cron-secret';
    process.env.ADMIN_USER = 'legacy';
    process.env.ADMIN_PASS = 'password:with:colons';
    authenticateSupabaseRequest.mockResolvedValue({
      authenticated: false,
      response: NextResponse.next(),
    });
    unauthenticatedResponse.mockReturnValue(new Response(null, { status: 401 }));
  });

  test('keeps webhook, login, and PKCE callback routes public', async () => {
    expect((await proxy(request('/api/webhooks/instagram'))).status).toBe(200);
    expect((await proxy(request('/login'))).status).toBe(200);
    expect((await proxy(request('/auth/callback?code=test'))).status).toBe(200);
    expect(authenticateSupabaseRequest).not.toHaveBeenCalled();
  });

  test('protects logout route', async () => {
    expect((await proxy(request('/auth/logout'))).status).toBe(401);
    expect(authenticateSupabaseRequest).toHaveBeenCalled();
  });

  test('preserves cron-secret access', async () => {
    const response = await proxy(request('/api/cron/nightly', {
      'x-cron-secret': 'cron-secret',
    }));
    expect(response.status).toBe(200);
    expect(authenticateSupabaseRequest).not.toHaveBeenCalled();
  });

  test('accepts verified Supabase claims', async () => {
    authenticateSupabaseRequest.mockResolvedValue({
      authenticated: true,
      response: NextResponse.next(),
    });
    expect((await proxy(request('/edit'))).status).toBe(200);
    expect(unauthenticatedResponse).not.toHaveBeenCalled();
  });

  test('retains Basic Auth as transitional fallback', async () => {
    const response = await proxy(request('/edit', {
      authorization: basicAuth('legacy', 'password:with:colons'),
    }));
    expect(response.status).toBe(200);
  });

  test.each([
    ['missing credentials', {}],
    ['wrong cron secret', { 'x-cron-secret': 'wrong' }],
    ['wrong Basic Auth', { authorization: basicAuth('legacy', 'wrong') }],
    ['malformed Basic Auth', { authorization: `Basic ${Buffer.from('missing-colon').toString('base64')}` }],
  ])('rejects %s', async (_label, headers) => {
    expect((await proxy(request('/api/posts', headers))).status).toBe(401);
    expect(unauthenticatedResponse).toHaveBeenCalled();
  });

  test('preserves static asset exclusions', () => {
    expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico).*)']);
  });
});
