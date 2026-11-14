import { getAuthUrl } from './instagram';

describe('getAuthUrl', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.INSTAGRAM_APP_ID = 'app-123';
    process.env.INSTAGRAM_REDIRECT_URI = 'https://example.test/api/instagram/callback';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('requests read_insights so Facebook Page insights can be read', () => {
    const url = new URL(getAuthUrl('state-1'));
    const scopes = url.searchParams.get('scope').split(',');
    expect(scopes).toEqual(expect.arrayContaining([
      'instagram_manage_insights',
      'pages_read_engagement',
      'read_insights',
    ]));
    expect(url.searchParams.get('state')).toBe('state-1');
  });
});
