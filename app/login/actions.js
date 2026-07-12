'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase-auth/server';

function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/edit';
}

async function requestOrigin() {
  const requestHeaders = await headers();
  const origin = requestHeaders.get('origin');
  if (origin) return origin;
  const protocol = requestHeaders.get('x-forwarded-proto') || 'http';
  return `${protocol}://${requestHeaders.get('host')}`;
}

export async function authenticate(_previousState, formData) {
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  const intent = formData.get('intent');
  const next = safeNext(formData.get('next'));

  if (!email || !password) return { error: 'Email and password required.' };

  const supabase = await createServerSupabaseClient();
  if (intent === 'signup') {
    if (process.env.SUPABASE_AUTH_SIGNUP_ENABLED !== 'true') {
      return { error: 'Account creation disabled. Ask administrator for access.' };
    }

    const origin = await requestOrigin();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) return { error: error.message };
    if (!data.session) return { message: 'Check email to confirm account.' };
  } else {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
  }

  redirect(next);
}
