import { getSupabaseClient } from '@/lib/supabase';
import { getRecentMedia } from '@/lib/instagram';

/**
 * Extract a short topic string from an Instagram caption.
 * Takes the first line, strips hashtags and emojis, truncates to 60 chars.
 */
function extractTopic(caption) {
  if (!caption) return 'Untitled';
  const firstLine = caption.split('\n')[0].trim();
  const noHashtags = firstLine.replace(/#\w+/g, '').trim();
  const noEmojis = noHashtags.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}]/gu, '').trim();
  const truncated = noEmojis.length > 60 ? noEmojis.substring(0, 57) + '...' : noEmojis;
  return truncated || 'Untitled';
}

/**
 * GET /api/cron/poll-new-posts
 * Lightweight poll that checks for new Instagram posts and imports them.
 * Designed to run every 15 minutes via systemd timer.
 *
 * - Fetches the 10 most recent posts from Instagram (1 API call)
 * - Compares against known media IDs in the database
 * - Inserts any new posts it finds
 *
 * Cost: 1 API call per run = ~96/day out of ~4,800/day budget
 */
export async function GET() {
  const supabase = getSupabaseClient();

  try {
    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (!accounts || accounts.length === 0) {
      return Response.json({ success: false, error: 'No Instagram account connected' }, { status: 400 });
    }

    const account = accounts[0];
    const accessToken = account.access_token;

    // Fetch 10 most recent posts (single API call)
    const recentMedia = await getRecentMedia(accessToken, account.instagram_user_id, 10);

    if (!recentMedia || recentMedia.length === 0) {
      return Response.json({ success: true, checked: 0, imported: 0 });
    }

    // Check which ones already exist
    const mediaIds = recentMedia.map(m => m.id);
    const { data: existingPosts } = await supabase
      .from('posts')
      .select('instagram_media_id')
      .in('instagram_media_id', mediaIds);

    const existingIds = new Set((existingPosts || []).map(p => p.instagram_media_id));
    const newMedia = recentMedia.filter(m => !existingIds.has(m.id));

    if (newMedia.length === 0) {
      return Response.json({ success: true, checked: recentMedia.length, imported: 0 });
    }

    // Insert new posts
    const rows = newMedia.map(media => ({
      post_id: `ig_${media.id}`,
      topic: extractTopic(media.caption),
      ai_version: media.caption || '',
      final_version: media.caption || '',
      edit_count: 0,
      instagram_media_id: media.id,
      instagram_permalink: media.permalink,
      published_at: media.timestamp,
      media_type: media.media_type || null,
      media_product_type: media.media_product_type || null,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('posts')
      .insert(rows)
      .select();

    if (insertError) {
      console.error('Poll new posts insert error:', insertError.message);
      return Response.json({ success: false, error: insertError.message }, { status: 500 });
    }

    const count = (inserted || []).length;
    console.log(`Poll new posts: imported ${count} new post(s)`);

    return Response.json({ success: true, checked: recentMedia.length, imported: count });
  } catch (error) {
    console.error('Poll new posts error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
