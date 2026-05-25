import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../../lib/supabase-server.js';
import { refreshLongLivedToken, getTokenExpiryDate } from '../../../../lib/instagram.js';

/**
 * POST /api/token/refresh
 * Refresh the stored access token for @tuckinandtalk.
 * Safe to call proactively when daysRemaining < 7.
 */
export async function POST() {
  try {
    const supabase = getServerSupabaseClient();

    // Load current token
    const { data: account, error: fetchError } = await supabase
      .from('tat_accounts')
      .select('id, access_token')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'not_connected' },
        { status: 401 }
      );
    }

    const { accessToken: newToken, expiresIn } = await refreshLongLivedToken(
      account.access_token
    );
    const tokenExpiresAt = getTokenExpiryDate(expiresIn);

    const { error: updateError } = await supabase
      .from('tat_accounts')
      .update({
        access_token: newToken,
        token_expires_at: tokenExpiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id);

    if (updateError) throw new Error(updateError.message);

    return NextResponse.json({
      success: true,
      tokenExpiresAt,
      expiresIn,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
