import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  exchangeCodeForToken,
  getInstagramAccount,
  getTokenExpiryDate,
} from '../../../../lib/instagram.js';
import { getServerSupabaseClient } from '../../../../lib/supabase-server.js';

/**
 * GET /api/auth/callback
 * Handle the OAuth callback from Meta. Validates CSRF state, exchanges the
 * code for a long-lived token, discovers the IG Business Account, and stores
 * the token in tat_accounts.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Facebook-side denial
  if (error) {
    const url = new URL('/settings', request.url);
    url.searchParams.set('auth_error', errorDescription || error);
    return NextResponse.redirect(url.toString());
  }

  if (!code) {
    const url = new URL('/settings', request.url);
    url.searchParams.set('auth_error', 'No authorization code returned.');
    return NextResponse.redirect(url.toString());
  }

  // Validate CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('tat_oauth_state')?.value;
  if (!storedState || storedState !== state) {
    const url = new URL('/settings', request.url);
    url.searchParams.set('auth_error', 'CSRF state mismatch. Please try again.');
    return NextResponse.redirect(url.toString());
  }

  try {
    // Exchange code → long-lived token
    const { accessToken, expiresIn } = await exchangeCodeForToken(code);
    const tokenExpiresAt = getTokenExpiryDate(expiresIn);

    // Discover connected IG Business Account
    const account = await getInstagramAccount(accessToken);

    const supabase = getServerSupabaseClient();

    // Upsert into tat_accounts (one row per IG user)
    const { error: dbError } = await supabase
      .from('tat_accounts')
      .upsert(
        {
          instagram_user_id: account.instagramUserId,
          username: account.username,
          access_token: accessToken,
          token_expires_at: tokenExpiresAt,
          facebook_page_id: account.facebookPageId,
          followers_count: account.followersCount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'instagram_user_id' }
      );

    if (dbError) throw new Error(dbError.message);

    // Clear the CSRF cookie
    const response = NextResponse.redirect(new URL('/settings?auth_success=1', request.url));
    response.cookies.set('tat_oauth_state', '', { maxAge: 0, path: '/' });
    return response;
  } catch (err) {
    const url = new URL('/settings', request.url);
    url.searchParams.set('auth_error', err.message);
    return NextResponse.redirect(url.toString());
  }
}
