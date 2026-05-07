import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { getServerSupabaseClient } from '@/lib/supabase-server';

function verifyWebhookSignature(rawBody, signature) {
  if (!signature) return false;
  const expected = 'sha256=' + crypto
    .createHmac('sha256', process.env.INSTAGRAM_APP_SECRET)
    .update(rawBody)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

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
 * Receives webhook events from Meta. Verifies HMAC signature, stores raw
 * payload and processes async.
 */
export async function POST(request) {
  const rawBody = await request.text();

  const sig = request.headers.get('x-hub-signature-256');
  if (!verifyWebhookSignature(rawBody, sig)) {
    console.warn('Webhook signature verification failed');
    return new Response('Forbidden', { status: 403 });
  }

  let body;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const supabase = getServerSupabaseClient();

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

      await processWebhookEvent(supabase, eventType, change.value || {}, igUserId, eventRow.id);
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

  if (fromUser.id && fromUser.id !== igUserId) {
    await supabase.rpc('increment_engagement_count', {
      p_count_type: 'unreplied_comments',
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

  await supabase.rpc('increment_engagement_count', {
    p_count_type: 'unseen_mentions',
  });
}
