import { NextResponse } from 'next/server';
import { exchangeCodeForToken, getInstagramAccount } from '@/lib/instagram';
import { getSupabaseClient } from '@/lib/supabase';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  
  // Handle OAuth errors
  if (error) {
    const errorDescription = searchParams.get('error_description') || 'Authorization failed';
    return NextResponse.redirect(
      new URL(`/?instagram_error=${encodeURIComponent(errorDescription)}`, request.url)
    );
  }
  
  if (!code) {
    return NextResponse.redirect(
      new URL('/?instagram_error=No authorization code received', request.url)
    );
  }
  
  try {
    // Exchange code for token
    const { accessToken, expiresIn } = await exchangeCodeForToken(code);
    
    // Get Instagram account details
    const account = await getInstagramAccount(accessToken);
    
    // Calculate token expiry date
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    
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
      new URL(`/?instagram_connected=${encodeURIComponent(account.username)}`, request.url)
    );
    
  } catch (error) {
    console.error('Instagram OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/?instagram_error=${encodeURIComponent(error.message)}`, request.url)
    );
  }
}
