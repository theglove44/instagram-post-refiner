import { config, proxy } from './proxy';

jest.mock('next/server', () => {
  class MockNextResponse {
    constructor(body, options = {}) {
      this.body = body;
      this.status = options.status ?? 200;
      this.headers = new Headers(options.headers);
    }

    static next() {
      return { allowed: true };
    }
  }

  return { NextResponse: MockNextResponse };
});

function request(pathname, headers = {}) {
  const normalizedHeaders = new Headers(headers);
  return {
    nextUrl: { pathname },
    headers: { get: (name) => normalizedHeaders.get(name) },
  };
}

function basicAuth(user, pass) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

describe('proxy authentication gate', () => {
  const originalEnv = {
    ADMIN_USER: process.env.ADMIN_USER,
    ADMIN_PASS: process.env.ADMIN_PASS,
    CRON_SECRET: process.env.CRON_SECRET,
  };

  beforeEach(() => {
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASS = 'secret:with:colons';
    process.env.CRON_SECRET = 'cron-secret';
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('keeps Instagram webhook routes public', () => {
    expect(proxy(request('/api/webhooks/instagram'))).toEqual({ allowed: true });
  });

  it('accepts the cron secret header', () => {
    expect(proxy(request('/api/cron/nightly', {
      'x-cron-secret': 'cron-secret',
    }))).toEqual({ allowed: true });
  });

  it('accepts valid Basic Auth, including colons in the password', () => {
    expect(proxy(request('/settings', {
      authorization: basicAuth('admin', 'secret:with:colons'),
    }))).toEqual({ allowed: true });
  });

  it.each([
    ['missing credentials', {}],
    ['wrong cron secret', { 'x-cron-secret': 'wrong' }],
    ['wrong Basic Auth', { authorization: basicAuth('admin', 'wrong') }],
    ['malformed Basic Auth', { authorization: `Basic ${Buffer.from('missing-colon').toString('base64')}` }],
  ])('returns a Basic Auth challenge for %s', (_label, headers) => {
    const response = proxy(request('/settings', headers));

    expect(response.status).toBe(401);
    expect(response.body).toBe('Unauthorized');
    expect(response.headers.get('www-authenticate')).toBe('Basic realm="Instagram Logger"');
  });

  it('preserves the static asset exclusions', () => {
    expect(config.matcher).toEqual(['/((?!_next/static|_next/image|favicon.ico).*)']);
  });
});
