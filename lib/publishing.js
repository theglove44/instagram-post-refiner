/**
 * Publishing orchestration — handles the full publish lifecycle.
 * Creates containers, polls for readiness, publishes, and logs everything.
 * Supports dryRun mode (stops before final media_publish call).
 */

import { getSupabaseClient } from './supabase';
import {
  createImageContainer,
  createCarouselContainer,
  createReelContainer,
  createStoryContainer,
  checkContainerStatus,
  publishMedia,
  getMediaDetails,
  checkPublishingLimit,
  getTokenExpiryDate,
} from './instagram';

/**
 * Log a publishing action to the publishing_log table.
 */
async function logAction(scheduledPostId, action, details = {}) {
  const supabase = getSupabaseClient();
  await supabase.from('publishing_log').insert({
    scheduled_post_id: scheduledPostId,
    action,
    details,
  });
}

/**
 * Update the instagram_accounts table if a token was refreshed.
 */
async function updateTokenIfRefreshed(newToken, expiresIn) {
  if (!newToken) return;
  const supabase = getSupabaseClient();
  const expiryDate = getTokenExpiryDate(expiresIn || 60 * 24 * 60 * 60);
  await supabase
    .from('instagram_accounts')
    .update({
      access_token: newToken,
      token_expires_at: expiryDate,
      updated_at: new Date().toISOString(),
    })
    .not('instagram_user_id', 'is', null);
}

/**
 * Poll a container until it reaches FINISHED status or times out.
 * Returns { statusCode, newToken, expiresIn }.
 */
export async function pollContainerUntilReady(accessToken, containerId, { maxWaitMs = 30000, intervalMs = 5000 } = {}) {
  const startTime = Date.now();
  let currentToken = accessToken;
  let latestNewToken = null;
  let latestExpiresIn = null;

  while (Date.now() - startTime < maxWaitMs) {
    const { statusCode, newToken, expiresIn } = await checkContainerStatus(currentToken, containerId);

    if (newToken) {
      currentToken = newToken;
      latestNewToken = newToken;
      latestExpiresIn = expiresIn;
    }

    if (statusCode === 'FINISHED') {
      return { statusCode, newToken: latestNewToken, expiresIn: latestExpiresIn };
    }

    if (statusCode === 'ERROR' || statusCode === 'EXPIRED') {
      throw new Error(`Container ${containerId} reached status: ${statusCode}`);
    }

    // IN_PROGRESS — wait and retry
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Container ${containerId} did not reach FINISHED within ${maxWaitMs / 1000}s (still IN_PROGRESS)`);
}

/**
 * Create the appropriate container based on media type.
 * Returns { containerId, newToken, expiresIn }.
 */
async function createContainer(accessToken, igUserId, scheduledPost, mediaUploads) {
  const { caption, media_type, alt_text, user_tags, cover_url } = scheduledPost;
  const userTags = user_tags || [];

  switch (media_type) {
    case 'CAROUSEL': {
      const children = mediaUploads
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(m => ({ url: m.public_url, mediaType: m.media_type }));
      return createCarouselContainer(accessToken, igUserId, { children, caption, userTags });
    }

    case 'REELS': {
      const video = mediaUploads.find(m => m.media_type === 'VIDEO');
      if (!video) throw new Error('No video file found for Reel');
      return createReelContainer(accessToken, igUserId, {
        videoUrl: video.public_url,
        caption,
        coverUrl: cover_url || null,
        userTags,
      });
    }

    case 'STORIES': {
      const media = mediaUploads[0];
      if (!media) throw new Error('No media file found for Story');
      return createStoryContainer(accessToken, igUserId, {
        mediaUrl: media.public_url,
        mediaType: media.media_type,
      });
    }

    case 'IMAGE':
    default: {
      const image = mediaUploads[0];
      if (!image) throw new Error('No image file found for post');
      return createImageContainer(accessToken, igUserId, {
        imageUrl: image.public_url,
        caption,
        altText: alt_text || null,
        userTags,
      });
    }
  }
}

/**
 * Execute the full publish pipeline for a scheduled post.
 *
 * Steps:
 * 1. Check rate limit
 * 2. Create container (type-appropriate)
 * 3. Poll container status until FINISHED
 * 4. Publish container (skipped in dryRun mode)
 * 5. Fetch published post details (permalink)
 *
 * Returns { success, mediaId, permalink, dryRun, containerId }
 */
export async function executePublish(accessToken, igUserId, scheduledPost, mediaUploads, { dryRun = false } = {}) {
  const supabase = getSupabaseClient();
  const postId = scheduledPost.id;
  let currentToken = accessToken;

  // 1. Check rate limit
  try {
    const limit = await checkPublishingLimit(currentToken, igUserId);
    if (limit.newToken) {
      currentToken = limit.newToken;
      await updateTokenIfRefreshed(limit.newToken, limit.expiresIn);
    }
    if (limit.quotaUsage >= limit.quotaTotal) {
      throw new Error(`Publishing rate limit reached (${limit.quotaUsage}/${limit.quotaTotal} in 24h)`);
    }
    await logAction(postId, 'rate_limit_check', { quotaUsage: limit.quotaUsage, quotaTotal: limit.quotaTotal });
  } catch (err) {
    await logAction(postId, 'rate_limit_error', { error: err.message });
    throw err;
  }

  // 2. Create container
  let containerId;
  try {
    const result = await createContainer(currentToken, igUserId, scheduledPost, mediaUploads);
    containerId = result.containerId;
    if (result.newToken) {
      currentToken = result.newToken;
      await updateTokenIfRefreshed(result.newToken, result.expiresIn);
    }

    // Store container ID on the scheduled post
    await supabase
      .from('scheduled_posts')
      .update({ ig_container_id: containerId, updated_at: new Date().toISOString() })
      .eq('id', postId);

    await logAction(postId, 'container_created', { containerId, mediaType: scheduledPost.media_type });
  } catch (err) {
    await logAction(postId, 'container_error', { error: err.message });
    throw err;
  }

  // 3. Poll container until ready
  try {
    const pollResult = await pollContainerUntilReady(currentToken, containerId, {
      // Videos/reels need more time to process
      maxWaitMs: scheduledPost.media_type === 'REELS' ? 120000 : 30000,
      intervalMs: 5000,
    });
    if (pollResult.newToken) {
      currentToken = pollResult.newToken;
      await updateTokenIfRefreshed(pollResult.newToken, pollResult.expiresIn);
    }
    await logAction(postId, 'container_ready', { containerId, statusCode: 'FINISHED' });
  } catch (err) {
    await logAction(postId, 'container_poll_error', { error: err.message, containerId });
    throw err;
  }

  // 4. Publish (skip in dryRun mode)
  if (dryRun) {
    await logAction(postId, 'dry_run_complete', { containerId, message: 'Stopped before media_publish' });
    return { success: true, mediaId: null, permalink: null, dryRun: true, containerId };
  }

  let mediaId;
  try {
    mediaId = await publishMedia(currentToken, igUserId, containerId);
    await logAction(postId, 'published', { containerId, mediaId });
  } catch (err) {
    await logAction(postId, 'publish_error', { error: err.message, containerId });
    throw err;
  }

  // 5. Fetch permalink
  let permalink = null;
  try {
    const { details, newToken } = await getMediaDetails(currentToken, mediaId);
    permalink = details.permalink;
    if (newToken) {
      await updateTokenIfRefreshed(newToken);
    }
  } catch {
    // Non-fatal: we have the mediaId, permalink is optional
    await logAction(postId, 'permalink_fetch_failed', { mediaId });
  }

  // 6. Update scheduled_posts record
  await supabase
    .from('scheduled_posts')
    .update({
      status: 'published',
      ig_media_id: mediaId,
      ig_permalink: permalink,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      publish_error: null,
    })
    .eq('id', postId);

  // 7. Link to source post if this came from the Edit flow
  if (scheduledPost.source_post_id) {
    await supabase
      .from('posts')
      .update({
        instagram_media_id: mediaId,
        instagram_permalink: permalink,
        published_at: new Date().toISOString(),
      })
      .eq('id', scheduledPost.source_post_id);
  }

  return { success: true, mediaId, permalink, dryRun: false, containerId };
}
