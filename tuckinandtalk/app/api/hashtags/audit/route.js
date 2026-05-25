import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '../../../../lib/supabase-server.js';
import {
  resolveHashtagId,
  getHashtagTopMedia,
} from '../../../../lib/instagram.js';
import { median, classifyHashtagTier, delay } from '../../../../lib/utils.js';

/**
 * POST /api/hashtags/audit
 * Run a hashtag audit for all active hashtags.
 *
 * Rate limit constraint: Meta allows 30 unique hashtag searches per IG user
 * per 7-day rolling window. This endpoint tracks usage and refuses to exceed it.
 *
 * Body: {} (no body needed — audits all active hashtags)
 * Or: { hashtags: ["manchesterfood", "foodie"] } to audit a subset.
 */
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = getServerSupabaseClient();

    // Load account
    const { data: account, error: accountError } = await supabase
      .from('tat_accounts')
      .select('id, instagram_user_id, access_token')
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

    const accessToken = account.access_token;
    const igUserId = account.instagram_user_id;

    // Determine which hashtags to audit
    let hashtagsToAudit;
    if (body.hashtags?.length) {
      hashtagsToAudit = body.hashtags.map((h) => h.replace(/^#/, '').toLowerCase());
    } else {
      const { data: configs, error: cfgError } = await supabase
        .from('tat_hashtag_config')
        .select('hashtag')
        .eq('active', true)
        .order('hashtag');
      if (cfgError) throw new Error(cfgError.message);
      hashtagsToAudit = (configs || []).map((c) => c.hashtag);
    }

    if (hashtagsToAudit.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active hashtags to audit.',
        processed: 0,
      });
    }

    // Check 7-day rolling usage window (30 unique hashtag searches max)
    const windowStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentAudits } = await supabase
      .from('tat_hashtag_audits')
      .select('hashtag')
      .gte('created_at', windowStart);

    const recentHashtags = new Set((recentAudits || []).map((a) => a.hashtag));
    const newHashtags = hashtagsToAudit.filter((h) => !recentHashtags.has(h));
    const remainingBudget = 30 - recentHashtags.size;

    if (remainingBudget <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Rate limit: already searched ${recentHashtags.size} unique hashtags in the last 7 days (max 30). Try again next week.`,
          usedThisWeek: recentHashtags.size,
        },
        { status: 429 }
      );
    }

    // Cap to budget
    const toProcess = newHashtags.slice(0, remainingBudget);
    const auditDate = new Date().toISOString().split('T')[0];

    const results = [];
    const errors = [];

    for (const hashtag of toProcess) {
      try {
        // Resolve hashtag ID
        const hashtagId = await resolveHashtagId(accessToken, igUserId, hashtag);
        await delay(500);

        // Fetch top media
        const topMedia = await getHashtagTopMedia(accessToken, hashtagId, igUserId);
        await delay(500);

        const likes = topMedia.map((p) => p.like_count || 0);
        const comments = topMedia.map((p) => p.comments_count || 0);

        const medianLikes = median(likes);
        const medianComments = median(comments);
        const medianEngagement =
          medianLikes !== null && medianComments !== null
            ? medianLikes + medianComments
            : null;

        const tier = classifyHashtagTier(medianLikes);

        const auditRow = {
          hashtag,
          audit_date: auditDate,
          top_posts_count: topMedia.length,
          median_likes: medianLikes,
          median_comments: medianComments,
          median_engagement: medianEngagement,
          tier,
        };

        const { error: insertError } = await supabase
          .from('tat_hashtag_audits')
          .insert(auditRow);

        if (insertError) throw new Error(insertError.message);

        // Update tier in config
        await supabase
          .from('tat_hashtag_config')
          .update({ tier })
          .eq('hashtag', hashtag);

        results.push({ hashtag, tier, medianLikes, medianComments, topPostsCount: topMedia.length });
      } catch (err) {
        console.error(`Hashtag audit error for #${hashtag}: ${err.message}`);
        errors.push({ hashtag, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      errors: errors.length,
      skippedDuplicates: hashtagsToAudit.length - newHashtags.length,
      results,
      errorDetails: errors,
      remainingBudget: remainingBudget - results.length,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
