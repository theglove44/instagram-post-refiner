import { NextResponse } from 'next/server';
import { exchangeCodeForToken, getInstagramAccount } from '@/lib/instagram';
import { getSupabaseClient } from '@/lib/supabase';

/**
 * Build a redirect URL using the public origin.
 * Behind a reverse proxy (Cloudflare Tunnel), request.url points to
 * localhost, so we derive the origin from headers or INSTAGRAM_REDIRECT_URI.
 */
function buildRedirect(request, path) {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https';

  if (forwardedHost) {
    return new URL(path, `${forwardedProto}://${forwardedHost}`);
  }

  // Fallback: derive from the configured redirect URI
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI;
  if (redirectUri) {
    const base = new URL(redirectUri);
    return new URL(path, base.origin);
  }

  return new URL(path, request.url);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Authorization failed';
    return NextResponse.redirect(
      buildRedirect(request, `/?instagram_error=${encodeURIComponent(errorDescription)}`)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      buildRedirect(request, '/?instagram_error=No authorization code received')
    );
  }

  try {
    // Exchange code for token
    const { accessToken, expiresIn } = await exchangeCodeForToken(code);

    // Get Instagram account details
    const account = await getInstagramAccount(accessToken);

    // Calculate token expiry date (default to 60 days if expiresIn missing)
    const expirySeconds = expiresIn || 60 * 24 * 60 * 60;
    const tokenExpiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    // Store in Supabase
    const supabase = getSupabaseClient();

    const { error: dbError } = await supabase
      .from('instagram_accounts')
      .upsert({
        instagram_user_id: account.instagramUserId,
        instagram_username: account.username,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
        facebook_page_id: account.facebookPageId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'instagram_user_id'
      });

    if (dbError) {
      throw new Error(dbError.message);
    }

    // Redirect back to app with success
    return NextResponse.redirect(
      buildRedirect(request, `/?instagram_connected=${encodeURIComponent(account.username)}`)
    );

  } catch (error) {
    console.error('Instagram OAuth error:', error);
    return NextResponse.redirect(
      buildRedirect(request, `/?instagram_error=${encodeURIComponent(error.message)}`)
    );
  }
}
