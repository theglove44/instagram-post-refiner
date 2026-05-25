import { createClient } from '@supabase/supabase-js';

let serverClient = null;

/**
 * Returns a Supabase client using the service role key.
 * Server-side only — never expose this client or its key to the browser.
 * Bypasses Row Level Security — use with care.
 */
export function getServerSupabaseClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Missing Supabase server environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  if (!serverClient) {
    serverClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );
  }

  return serverClient;
}
