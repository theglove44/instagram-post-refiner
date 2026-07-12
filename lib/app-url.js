export function getPublicOrigin() {
  const configuredUrl = process.env.APP_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing APP_URL');
    }
    return 'http://localhost:3000';
  }

  const url = new URL(configuredUrl);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('APP_URL must use http or https');
  }
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('APP_URL must use https in production');
  }

  return url.origin;
}
