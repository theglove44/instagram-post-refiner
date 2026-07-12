import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-auth/server';
import { getPublicOrigin } from '@/lib/app-url';

export async function POST() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/login', getPublicOrigin()), { status: 303 });
}
