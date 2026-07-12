import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

function copyCookies(source, target) {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  target.headers.set('Cache-Control', 'private, no-store');
  return target;
}

export async function authenticateSupabaseRequest(request) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
          response.headers.set('Cache-Control', 'private, no-store');
        },
      },
    }
  );

  const { data, error } = await supabase.auth.getClaims();
  return {
    authenticated: !error && Boolean(data?.claims?.sub),
    response,
  };
}

export function unauthenticatedResponse(request, refreshedResponse) {
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return copyCookies(
      refreshedResponse,
      NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return copyCookies(refreshedResponse, NextResponse.redirect(loginUrl));
}
