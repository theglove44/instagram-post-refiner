import { NextResponse } from 'next/server';

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // OAuth endpoints must stay public — the callback comes from Facebook's servers
  // and the auth URL generator needs to be reachable before the user logs in.
  if (pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Accept cron secret header — used by systemd/cron callers
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret && cronSecret === process.env.TAT_CRON_SECRET) {
    return NextResponse.next();
  }

  // HTTP Basic Auth — browser caches credentials for the session
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const colonIndex = decoded.indexOf(':');
    if (colonIndex !== -1) {
      const user = decoded.slice(0, colonIndex);
      const pass = decoded.slice(colonIndex + 1);
      if (
        user === process.env.TAT_ADMIN_USER &&
        pass === process.env.TAT_ADMIN_PASS
      ) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Tuckin and Talk Analytics"' },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
