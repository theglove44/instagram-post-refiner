import { getSupabaseClient } from '@/lib/supabase';

/**
 * GET /api/webhooks/instagram
 * Meta webhook verification. Echoes back the challenge as plain text.
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token');

  if (mode === 'subscribe' && verifyToken === process.env.WEBHOOK_VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('Webhook verification failed:', { mode, verifyToken });
  return new Response('Forbidden', { status: 403 });
}

/**
 * POST /api/webhooks/instagram
 * Receives webhook events from Meta. Stores raw payload and processes async.
 */
export async function POST(request) {
  const supabase = getSupabaseClient();
  let body;

  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Store raw event and kick off async processing before returning
  const entries = body.entry || [];
  for (const entry of entries) {
    const igUserId = entry.id || null;
    const changes = entry.changes || [];

    for (const change of changes) {
      const eventType = change.field || 'unknown';

      // Insert raw webhook event
      const { data: eventRow, error: insertError } = await supabase
        .from('webhook_events')
        .insert({
          event_type: eventType,
          instagram_user_id: igUserId,
          payload: change.value || {},
          processed: false,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Failed to store webhook event:', insertError.message);
        continue;
      }

      // Fire-and-forget async processing
      processWebhookEvent(supabase, eventType, change.value || {}, igUserId, eventRow.id).catch(err => {
        console.error(`Webhook processing error (${eventType}):`, err);
      });
    }
  }

  return new Response('EVENT_RECEIVED', { status: 200 });
}

async function processWebhookEvent(supabase, eventType, value, igUserId, webhookEventId) {
  try {
    switch (eventType) {
      case 'comments':
        await processComment(supabase, value, igUserId);
        break;
      case 'mentions':
        await processMention(supabase, value, igUserId);
        break;
      default:
        // Unknown event type, just mark as processed for future reference
        break;
    }

    await supabase
      .from('webhook_events')
      .update({ processed: true })
      .eq('id', webhookEventId);
  } catch (error) {
    console.error(`Failed to process webhook event ${webhookEventId}:`, error);
    // Leave processed = false so it can be retried later
  }
}

async function processComment(supabase, value, igUserId) {
  const commentId = value.id;
  const mediaId = value.media?.id;
  const text = value.text || '';
  const fromUser = value.from || {};

  if (!commentId) return;

  // Upsert the comment
  await supabase
    .from('comments')
    .upsert({
      instagram_comment_id: commentId,
      instagram_media_id: mediaId || null,
      text,
      username: fromUser.username || null,
      instagram_user_id: fromUser.id || null,
      timestamp: new Date().toISOString(),
      reply_status: 'unreplied',
      is_reply: false,
      is_hidden: false,
    }, {
      onConflict: 'instagram_comment_id',
      ignoreDuplicates: false,
    });

  // If the comment is not from our own account, increment unreplied count
  if (fromUser.id && fromUser.id !== igUserId) {
    const { data: countRow } = await supabase
      .from('engagement_counts')
      .select('count')
      .eq('count_type', 'unreplied_comments')
      .single();

    const currentCount = countRow?.count || 0;

    await supabase
      .from('engagement_counts')
      .upsert({
        count_type: 'unreplied_comments',
        count: currentCount + 1,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'count_type',
      });
  }
}

async function processMention(supabase, value, igUserId) {
  const mediaId = value.media_id || value.media?.id;

  if (!mediaId) return;

  await supabase
    .from('mentions')
    .upsert({
      instagram_media_id: mediaId,
      mention_type: 'caption',
      username: value.from?.username || null,
      caption: value.text || value.caption || null,
      permalink: value.permalink || null,
      timestamp: new Date().toISOString(),
      reply_status: 'unseen',
      synced_at: new Date().toISOString(),
    }, {
      onConflict: 'instagram_media_id,mention_type',
      ignoreDuplicates: false,
    });

  // Increment unseen mentions count
  const { data: countRow } = await supabase
    .from('engagement_counts')
    .select('count')
    .eq('count_type', 'unseen_mentions')
    .single();

  const currentCount = countRow?.count || 0;

  await supabase
    .from('engagement_counts')
    .upsert({
      count_type: 'unseen_mentions',
      count: currentCount + 1,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'count_type',
    });
}
