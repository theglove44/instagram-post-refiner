import { NextResponse } from 'next/server';
import {
  authenticateSupabaseRequest,
  unauthenticatedResponse,
} from '@/lib/supabase-auth/middleware';

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Webhook endpoint must stay public — Meta calls it server-to-server and
  // cannot send our credentials. POST is protected by HMAC signature verification.
  if (pathname.startsWith('/api/webhooks')) {
    return NextResponse.next({ request });
  }

  // Accept CRON_SECRET header — used by systemd services and internal cron fetch calls
  const cronSecret = request.headers.get('x-cron-secret');
  if (cronSecret && cronSecret === process.env.CRON_SECRET) {
    return NextResponse.next({ request });
  }

  // Sign-in and PKCE callback must be reachable before a session exists.
  if (pathname === '/login' || pathname === '/auth/callback') {
    return NextResponse.next({ request });
  }

  // Primary production gate. getClaims verifies the JWT; getSession is not trusted.
  let supabaseAuth;
  try {
    supabaseAuth = await authenticateSupabaseRequest(request);
    if (supabaseAuth.authenticated) {
      return supabaseAuth.response;
    }
  } catch (error) {
    console.error('Supabase Auth request validation failed:', error);
  }

  // Transitional fallback. Remove after all operators have Supabase Auth accounts.
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Basic ')) {
    const decoded = Buffer.from(auth.slice(6), 'base64').toString();
    const colonIndex = decoded.indexOf(':');
    if (colonIndex !== -1) {
      const user = decoded.slice(0, colonIndex);
      const pass = decoded.slice(colonIndex + 1);
      if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
        return supabaseAuth?.response || NextResponse.next({ request });
      }
    }
  }

  return unauthenticatedResponse(
    request,
    supabaseAuth?.response || NextResponse.next({ request })
  );
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
