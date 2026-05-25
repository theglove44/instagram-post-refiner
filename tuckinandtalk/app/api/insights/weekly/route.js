import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../../lib/supabase-server.js';
import {
  fetchWeeklyInsights,
  getFollowerCount,
  getTokenExpiryDate,
  refreshLongLivedToken,
} from '../../../../lib/instagram.js';
import {
  getMostRecentMonday,
  unixDaysAgo,
  unixNow,
  daysUntil,
} from '../../../../lib/utils.js';

/**
 * GET /api/insights/weekly
 * Fetch and store one week of account-level insights.
 * Callable from dashboard UI or via x-cron-secret header.
 *
 * The weekly snapshot captures:
 *   - reach, views, saves, shares, accounts_engaged
 *   - broken down by media_product_type (FEED/REELS/STORY) and follow_type (FOLLOWER/NON_FOLLOWER)
 */
export async function GET() {
  try {
    const supabase = getServerSupabaseClient();

    // Load stored account
    const { data: account, error: accountError } = await supabase
      .from('tat_accounts')
      .select('id, instagram_user_id, access_token, token_expires_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError) throw new Error(accountError.message);
    if (!account) {
      return NextResponse.json(
        { success: false, error: 'not_connected' },
        { status: 401 }
      );
    }

    let accessToken = account.access_token;

    // Auto-refresh if token is expiring soon
    if (daysUntil(account.token_expires_at) < 7) {
      try {
        const refreshed = await refreshLongLivedToken(accessToken);
        accessToken = refreshed.accessToken;
        await supabase
          .from('tat_accounts')
          .update({
            access_token: accessToken,
            token_expires_at: getTokenExpiryDate(refreshed.expiresIn),
            updated_at: new Date().toISOString(),
          })
          .eq('id', account.id);
      } catch {
        // Continue with existing token if refresh fails
      }
    }

    const weekStart = getMostRecentMonday();
    const sinceUnix = unixDaysAgo(7);
    const untilUnix = unixNow();

    const { totals, followBreakdown, viewsBreakdown, newToken, expiresIn } =
      await fetchWeeklyInsights(
        accessToken,
        account.instagram_user_id,
        sinceUnix,
        untilUnix
      );

    // Persist refreshed token if one was returned
    if (newToken) {
      await supabase
        .from('tat_accounts')
        .update({
          access_token: newToken,
          token_expires_at: getTokenExpiryDate(expiresIn),
          updated_at: new Date().toISOString(),
        })
        .eq('id', account.id);
      accessToken = newToken;
    }

    // Fetch current follower count
    const { followersCount } = await getFollowerCount(accessToken, account.instagram_user_id);

    const snapshot = {
      week_start: weekStart,
      reach_total: 0,
      reach_follower: 0,
      reach_non_follower: 0,
      views_total: 0,
      views_feed: 0,
      views_reels: 0,
      views_story: 0,
      saves: 0,
      shares: 0,
      accounts_engaged: 0,
      followers_count: followersCount,
    };

    // Parse totals (reach, views, accounts_engaged)
    for (const m of totals) {
      const val = m.total_value?.value || 0;
      if (m.name === 'reach') snapshot.reach_total = val;
      if (m.name === 'views') snapshot.views_total = val;
      if (m.name === 'accounts_engaged') snapshot.accounts_engaged = val;
    }

    // Parse reach by follow_type
    for (const m of followBreakdown) {
      if (m.name !== 'reach') continue;
      for (const bd of m.total_value?.breakdowns || []) {
        const dimIdx = (bd.dimension_keys || []).indexOf('follow_type');
        for (const r of bd.results || []) {
          const ft = r.dimension_values?.[dimIdx];
          if (ft === 'FOLLOWER') snapshot.reach_follower = r.value || 0;
          if (ft === 'NON_FOLLOWER') snapshot.reach_non_follower = r.value || 0;
        }
      }
    }

    // Parse views by media_product_type
    for (const m of viewsBreakdown) {
      if (m.name !== 'views') continue;
      for (const bd of m.total_value?.breakdowns || []) {
        const dimIdx = (bd.dimension_keys || []).indexOf('media_product_type');
        for (const r of bd.results || []) {
          const mpt = r.dimension_values?.[dimIdx];
          if (mpt === 'POST' || mpt === 'FEED') snapshot.views_feed += r.value || 0;
          if (mpt === 'REELS') snapshot.views_reels += r.value || 0;
          if (mpt === 'STORY') snapshot.views_story += r.value || 0;
        }
      }
    }

    // Upsert weekly snapshot (idempotent on week_start)
    const { error: upsertError } = await supabase
      .from('tat_weekly_snapshots')
      .upsert(snapshot, { onConflict: 'week_start' });

    if (upsertError) throw new Error(upsertError.message);

    return NextResponse.json({ success: true, snapshot });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
