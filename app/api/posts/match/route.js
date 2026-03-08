import { getSupabaseClient } from '@/lib/supabase';
import { getRecentMedia } from '@/lib/instagram';
import { findBestMatches } from '@/lib/matching';

/**
 * GET /api/posts/match
 * Returns pending match suggestions, optionally filtered by postId.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');

    const supabase = getSupabaseClient();

    let query = supabase
      .from('match_suggestions')
      .select(`
        *,
        posts (
          id,
          topic,
          final_version
        )
      `)
      .eq('status', 'pending')
      .order('confidence_score', { ascending: false });

    if (postId) {
      query = query.eq('post_id', postId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    const suggestions = (data || []).map(s => ({
      id: s.id,
      postId: s.post_id,
      instagramMediaId: s.instagram_media_id,
      instagramPermalink: s.instagram_permalink,
      instagramCaption: s.instagram_caption,
      confidenceScore: parseFloat(s.confidence_score),
      status: s.status,
      createdAt: s.created_at,
      post: s.posts ? {
        id: s.posts.id,
        topic: s.posts.topic,
        snippet: s.posts.final_version?.substring(0, 120) || '',
      } : null,
    }));

    return Response.json({ success: true, suggestions });
  } catch (error) {
    console.error('Match suggestions error:', error);
    return Response.json(
      { error: error.message || 'Failed to load match suggestions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/posts/match
 * Triggers auto-matching for unlinked posts.
 * Returns immediately with a syncId; processing continues in the background.
 */
export async function POST(request) {
  const supabase = getSupabaseClient();

  try {
    // Parse optional body
    let mode = 'recent';
    let limit = 100;
    let dryRun = false;

    try {
      const body = await request.json();
      if (body.mode) mode = body.mode;
      if (body.limit) limit = Math.max(1, Math.min(500, body.limit));
      if (body.dryRun) dryRun = true;
    } catch {
      // No body or invalid JSON — use defaults
    }

    // Create sync status record
    const { data: syncRecord } = await supabase
      .from('sync_status')
      .insert({
        sync_type: 'auto_linking',
        status: 'running',
      })
      .select()
      .single();

    const syncId = syncRecord?.id;

    // Fire and forget — processing continues after response is sent
    processMatchingInBackground(syncId, { mode, limit, dryRun });

    return Response.json({ success: true, syncId, status: 'running' });
  } catch (error) {
    console.error('Auto-matching error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/posts/match
 * Resolve a match suggestion (accept or reject).
 */
export async function PUT(request) {
  try {
    const { suggestionId, action } = await request.json();

    if (!suggestionId) {
      return Response.json({ error: 'suggestionId is required' }, { status: 400 });
    }

    if (action !== 'accept' && action !== 'reject') {
      return Response.json({ error: 'action must be "accept" or "reject"' }, { status: 400 });
    }

    const supabase = getSupabaseClient();

    // Fetch the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from('match_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .single();

    if (fetchError || !suggestion) {
      return Response.json(
        { error: 'Suggestion not found' },
        { status: 404 }
      );
    }

    if (suggestion.status !== 'pending') {
      return Response.json(
        { error: `Suggestion already ${suggestion.status}` },
        { status: 400 }
      );
    }

    if (action === 'accept') {
      // Link the post with Instagram data
      const { error: linkError } = await supabase
        .from('posts')
        .update({
          instagram_media_id: suggestion.instagram_media_id,
          instagram_permalink: suggestion.instagram_permalink,
          published_at: suggestion.created_at, // Use suggestion creation as fallback
          updated_at: new Date().toISOString(),
        })
        .eq('id', suggestion.post_id);

      if (linkError) {
        console.error('Failed to link post:', linkError);
        return Response.json(
          { error: `Failed to link post: ${linkError.message}` },
          { status: 500 }
        );
      }

      // Update suggestion status
      await supabase
        .from('match_suggestions')
        .update({
          status: 'accepted',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      console.log(`Accepted match suggestion ${suggestionId}: post ${suggestion.post_id} -> ${suggestion.instagram_media_id}`);
    } else {
      // Reject — just update status
      await supabase
        .from('match_suggestions')
        .update({
          status: 'rejected',
          resolved_at: new Date().toISOString(),
        })
        .eq('id', suggestionId);

      console.log(`Rejected match suggestion ${suggestionId}`);
    }

    return Response.json({ success: true, action });
  } catch (error) {
    console.error('Resolve suggestion error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Background matching process. Runs after the HTTP response is sent.
 * Fetches Instagram posts, compares with unlinked logged posts,
 * and either auto-links or creates suggestions based on confidence.
 */
async function processMatchingInBackground(syncId, { mode, limit, dryRun }) {
  const supabase = getSupabaseClient();

  try {
    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (!accounts || accounts.length === 0) {
      await updateSyncStatus(supabase, syncId, 'error', 0, 0, 1, {
        errors: [{ message: 'No Instagram account connected' }],
      });
      return;
    }

    const account = accounts[0];
    const accessToken = account.access_token;
    const userId = account.instagram_user_id;

    // Fetch Instagram posts
    console.log(`Auto-linking: Fetching ${limit} Instagram posts (mode: ${mode})`);
    const igPosts = await getRecentMedia(accessToken, userId, limit, mode === 'bulk');

    if (!igPosts || igPosts.length === 0) {
      await updateSyncStatus(supabase, syncId, 'success', 0, 0, 0);
      console.log('Auto-linking: No Instagram posts found');
      return;
    }

    console.log(`Auto-linking: Fetched ${igPosts.length} Instagram posts`);

    // Load unlinked posts from database
    const { data: unlinkedPosts, error: postsError } = await supabase
      .from('posts')
      .select('*')
      .is('instagram_media_id', null)
      .order('created_at', { ascending: false });

    if (postsError) {
      throw new Error(`Failed to load unlinked posts: ${postsError.message}`);
    }

    if (!unlinkedPosts || unlinkedPosts.length === 0) {
      await updateSyncStatus(supabase, syncId, 'success', 0, 0, 0);
      console.log('Auto-linking: No unlinked posts to match');
      return;
    }

    console.log(`Auto-linking: Found ${unlinkedPosts.length} unlinked posts to match against`);

    // Run matching algorithm
    const matches = findBestMatches(unlinkedPosts, igPosts);

    let autoLinked = 0;
    let suggestionsCreated = 0;
    const errors = [];

    for (const match of matches) {
      try {
        if (match.tier === 'auto_link' && !dryRun) {
          // High confidence — auto-link directly
          const { error: updateError } = await supabase
            .from('posts')
            .update({
              instagram_media_id: match.igPost.id,
              instagram_permalink: match.igPost.permalink,
              published_at: match.igPost.timestamp,
              updated_at: new Date().toISOString(),
            })
            .eq('id', match.loggedPost.id);

          if (updateError) {
            errors.push({
              postId: match.loggedPost.id,
              error: `Auto-link failed: ${updateError.message}`,
            });
          } else {
            autoLinked++;
            console.log(`Auto-linked post ${match.loggedPost.id} -> ${match.igPost.id} (score: ${match.score})`);
          }
        } else if (match.tier === 'suggested' || (match.tier === 'auto_link' && dryRun)) {
          // Lower confidence or dry run — create suggestion
          const { error: insertError } = await supabase
            .from('match_suggestions')
            .upsert({
              post_id: match.loggedPost.id,
              instagram_media_id: match.igPost.id,
              instagram_permalink: match.igPost.permalink || null,
              instagram_caption: match.igPost.caption?.substring(0, 500) || null,
              confidence_score: match.score,
              status: 'pending',
            }, {
              onConflict: 'post_id,instagram_media_id',
            });

          if (insertError) {
            errors.push({
              postId: match.loggedPost.id,
              error: `Suggestion insert failed: ${insertError.message}`,
            });
          } else {
            suggestionsCreated++;
          }
        }
      } catch (err) {
        errors.push({
          postId: match.loggedPost.id,
          error: err.message,
        });
      }
    }

    const totalProcessed = autoLinked + suggestionsCreated;
    console.log(`Auto-linking complete: ${autoLinked} auto-linked, ${suggestionsCreated} suggestions, ${errors.length} errors`);

    await updateSyncStatus(
      supabase,
      syncId,
      errors.length > 0 && totalProcessed === 0 ? 'error' : 'success',
      totalProcessed,
      0,
      errors.length,
      errors.length > 0 ? { errors } : {
        autoLinked,
        suggestionsCreated,
        totalIgPosts: igPosts.length,
        totalUnlinked: unlinkedPosts.length,
        dryRun,
      }
    );
  } catch (error) {
    console.error('Background auto-linking error:', error);
    await updateSyncStatus(supabase, syncId, 'error', 0, 0, 1, {
      errors: [{ message: error.message }],
    });
  }
}

async function updateSyncStatus(supabase, syncId, status, postsProcessed, metricsMissing, errorsCount, errorDetails = null) {
  if (!syncId) return;

  await supabase
    .from('sync_status')
    .update({
      status,
      completed_at: new Date().toISOString(),
      posts_processed: postsProcessed,
      metrics_missing: metricsMissing,
      errors_count: errorsCount,
      error_details: errorDetails,
    })
    .eq('id', syncId);
}
