import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../lib/supabase-server.js';
import { daysUntil } from '../../../lib/utils.js';

/**
 * GET /api/account
 * Return the stored @tuckinandtalk account info and token status.
 */
export async function GET() {
  try {
    const supabase = getServerSupabaseClient();
    const { data, error } = await supabase
      .from('tat_accounts')
      .select('instagram_user_id, username, token_expires_at, followers_count, updated_at, facebook_page_id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) {
      return NextResponse.json(
        { success: false, error: 'not_connected' },
        { status: 401 }
      );
    }

    const daysRemaining = daysUntil(data.token_expires_at);

    return NextResponse.json({
      success: true,
      account: {
        instagramUserId: data.instagram_user_id,
        username: data.username,
        followersCount: data.followers_count,
        tokenExpiresAt: data.token_expires_at,
        daysRemaining,
        lastUpdated: data.updated_at,
        facebookPageId: data.facebook_page_id,
        tokenStatus:
          daysRemaining === null
            ? 'unknown'
            : daysRemaining < 0
            ? 'expired'
            : daysRemaining < 7
            ? 'expiring_soon'
            : 'valid',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/account
 * Disconnect the Instagram account (removes token from DB).
 */
export async function DELETE() {
  try {
    const supabase = getServerSupabaseClient();
    const { error } = await supabase.from('tat_accounts').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
