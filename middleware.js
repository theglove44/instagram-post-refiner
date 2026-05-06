import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Webhook endpoint must stay public — Meta calls it server-to-server and
  // cannot send our credentials. POST is protected by HMAC signature verification.
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next();
  }

  // Accept CRON_SECRET header — used by systemd services and internal cron fetch calls
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    return NextResponse.next();
  }

  // Accept HTTP Basic Auth — browser is prompted once and stores credentials in the session
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const colonIndex = decoded.indexOf(':');
    if (colonIndex !== -1) {
      const user = decoded.slice(0, colonIndex);
      const pass = decoded.slice(colonIndex + 1);
      if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Instagram Logger"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
