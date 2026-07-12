import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-auth/server';
import { getPublicOrigin } from '@/lib/app-url';

function safeNext(value) {
  return value?.startsWith('/') && !value.startsWith('//') ? value : '/edit';
}

export async function GET(request) {
  const url = new URL(request.url);
  const publicOrigin = getPublicOrigin();
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, publicOrigin));
  }

  const loginUrl = new URL('/login', publicOrigin);
  loginUrl.searchParams.set('error', 'callback');
  loginUrl.searchParams.set('next', next);
  return NextResponse.redirect(loginUrl);
}
