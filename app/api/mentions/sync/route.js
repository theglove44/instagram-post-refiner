import { getSupabaseClient } from '@/lib/supabase';
import { getTaggedMedia, getMentionedMedia } from '@/lib/instagram';

export async function POST() {
  try {
    const supabase = getSupabaseClient();

    const { data: accounts, error: accountError } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1)
      .single();

    if (accountError || !accounts) {
      return Response.json(
        { success: false, error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    const { access_token: accessToken, instagram_user_id: igUserId } = accounts;

    // Fire-and-forget background sync
    syncMentions(supabase, accessToken, igUserId).catch(err => {
      console.error('Mentions sync background error:', err);
    });

    return Response.json({ success: true, status: 'syncing' });
  } catch (error) {
    console.error('Mentions sync error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

async function syncMentions(supabase, accessToken, igUserId) {
  // Sync tagged media
  const taggedResult = await getTaggedMedia(accessToken, igUserId);
  for (const media of (taggedResult?.media || [])) {
    await supabase
      .from('mentions')
      .upsert({
        instagram_media_id: media.id,
        mention_type: 'tag',
        username: media.username || null,
        media_url: media.media_url || null,
        caption: media.caption || null,
        permalink: media.permalink || null,
        timestamp: media.timestamp || new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'instagram_media_id,mention_type',
        ignoreDuplicates: false,
      });
  }

  // Sync caption mentions
  const mentionedResult = await getMentionedMedia(accessToken, igUserId);
  for (const media of (mentionedResult?.media || [])) {
    await supabase
      .from('mentions')
      .upsert({
        instagram_media_id: media.id,
        mention_type: 'caption',
        username: media.username || null,
        media_url: media.media_url || null,
        caption: media.caption || null,
        permalink: media.permalink || null,
        timestamp: media.timestamp || new Date().toISOString(),
        synced_at: new Date().toISOString(),
      }, {
        onConflict: 'instagram_media_id,mention_type',
        ignoreDuplicates: false,
      });
  }

  // Count unseen mentions and update engagement_counts
  const { count: unseenCount } = await supabase
    .from('mentions')
    .select('*', { count: 'exact', head: true })
    .eq('reply_status', 'unseen');

  await supabase
    .from('engagement_counts')
    .upsert({
      count_type: 'unseen_mentions',
      count: unseenCount || 0,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'count_type',
    });
}
