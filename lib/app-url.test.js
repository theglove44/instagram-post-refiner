import { getPublicOrigin } from './app-url';

describe('getPublicOrigin', () => {
  const originalEnv = {
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
  };

  afterEach(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test('returns only configured origin', () => {
    process.env.APP_URL = 'https://app.example.com/some/path';
    process.env.NODE_ENV = 'production';
    expect(getPublicOrigin()).toBe('https://app.example.com');
  });

  test('rejects insecure production origins', () => {
    process.env.APP_URL = 'http://app.example.com';
    process.env.NODE_ENV = 'production';
    expect(() => getPublicOrigin()).toThrow('APP_URL must use https in production');
  });

  test('requires explicit production origin', () => {
    delete process.env.APP_URL;
    process.env.NODE_ENV = 'production';
    expect(() => getPublicOrigin()).toThrow('Missing APP_URL');
  });

  test('uses localhost only outside production', () => {
    delete process.env.APP_URL;
    process.env.NODE_ENV = 'test';
    expect(getPublicOrigin()).toBe('http://localhost:3000');
  });
});
