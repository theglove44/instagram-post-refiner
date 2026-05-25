import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../../lib/supabase-server.js';
import { getBusinessDiscovery, getTokenExpiryDate, refreshLongLivedToken } from '../../../../lib/instagram.js';
import { median, delay, daysUntil } from '../../../../lib/utils.js';

/**
 * POST /api/competitors/snapshot
 * Run Business Discovery for all active competitors and store monthly snapshots.
 *
 * Meta allows Business Discovery for public Business/Creator accounts.
 * The requesting IG account (tat_accounts) must have business_management permission.
 */
export async function POST() {
  try {
    const supabase = getServerSupabaseClient();

    // Load account
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

    // Auto-refresh token if expiring soon
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
        // Continue with existing token
      }
    }

    // Load active competitors
    const { data: competitors, error: compError } = await supabase
      .from('tat_competitor_config')
      .select('username, display_name')
      .eq('active', true)
      .order('username');

    if (compError) throw new Error(compError.message);
    if (!competitors?.length) {
      return NextResponse.json({
        success: true,
        message: 'No active competitors to snapshot.',
        processed: 0,
      });
    }

    const snapshotDate = new Date().toISOString().split('T')[0];
    const results = [];
    const errors = [];

    for (const comp of competitors) {
      try {
        const discovery = await getBusinessDiscovery(
          accessToken,
          account.instagram_user_id,
          comp.username
        );

        if (discovery.newToken) {
          accessToken = discovery.newToken;
          await supabase
            .from('tat_accounts')
            .update({
              access_token: accessToken,
              token_expires_at: getTokenExpiryDate(discovery.expiresIn),
              updated_at: new Date().toISOString(),
            })
            .eq('id', account.id);
        }

        // Compute median engagement rate from recent posts
        const engagementRates = discovery.recentPosts.map((p) => {
          if (!discovery.followersCount || discovery.followersCount === 0) return 0;
          return ((p.like_count || 0) + (p.comments_count || 0)) / discovery.followersCount;
        });
        const medianEngagementRate = median(engagementRates);

        const row = {
          username: comp.username,
          snapshot_date: snapshotDate,
          followers_count: discovery.followersCount,
          media_count: discovery.mediaCount,
          median_engagement_rate: medianEngagementRate,
          recent_posts: discovery.recentPosts,
        };

        const { error: insertError } = await supabase
          .from('tat_competitor_snapshots')
          .insert(row);

        if (insertError) throw new Error(insertError.message);

        results.push({
          username: comp.username,
          followersCount: discovery.followersCount,
          medianEngagementRate,
        });
      } catch (err) {
        console.error(`Competitor snapshot error for @${comp.username}: ${err.message}`);
        errors.push({ username: comp.username, error: err.message });
      }

      // Respect rate limits
      await delay(600);
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      errors: errors.length,
      results,
      errorDetails: errors,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
