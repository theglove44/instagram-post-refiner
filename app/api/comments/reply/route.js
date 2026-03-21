import { getSupabaseClient } from '@/lib/supabase';
import { replyToComment, getTokenExpiryDate } from '@/lib/instagram';

/**
 * Persist a refreshed access token to the instagram_accounts table.
 */
async function persistRefreshedToken(supabase, accountId, newToken, expiresIn) {
  const updateData = { access_token: newToken };
  if (expiresIn) {
    updateData.token_expires_at = getTokenExpiryDate(expiresIn);
  }
  await supabase
    .from('instagram_accounts')
    .update(updateData)
    .eq('id', accountId);
}

export async function POST(request) {
  try {
    const supabase = getSupabaseClient();
    const body = await request.json();

    const { commentId, message } = body;

    if (!commentId || !message) {
      return Response.json(
        { error: 'commentId and message are required' },
        { status: 400 }
      );
    }

    // Get Instagram account
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (!accounts || accounts.length === 0) {
      return Response.json(
        { error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    const account = accounts[0];

    // Verify the comment exists in DB
    const { data: comment, error: commentError } = await supabase
      .from('comments')
      .select('*')
      .eq('instagram_comment_id', commentId)
      .single();

    if (commentError || !comment) {
      return Response.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    // Call Instagram API to reply
    const { commentId: replyId, newToken, expiresIn } = await replyToComment(
      account.access_token,
      commentId,
      message
    );

    // Persist refreshed token if needed
    if (newToken) {
      await persistRefreshedToken(supabase, account.id, newToken, expiresIn);
    }

    // Insert the reply into the comments table
    const now = new Date().toISOString();
    await supabase
      .from('comments')
      .insert({
        instagram_comment_id: replyId,
        instagram_media_id: comment.instagram_media_id,
        username: account.instagram_username,
        text: message,
        timestamp: now,
        is_reply: true,
        is_own_reply: true,
        parent_comment_id: commentId,
      });

    // Update parent comment's reply status
    await supabase
      .from('comments')
      .update({ reply_status: 'replied' })
      .eq('instagram_comment_id', commentId);

    // Decrement unreplied count (don't go below 0)
    const { data: countRow } = await supabase
      .from('engagement_counts')
      .select('count')
      .eq('count_type', 'unreplied_comments')
      .single();

    if (countRow) {
      const newCount = Math.max(0, (countRow.count || 0) - 1);
      await supabase
        .from('engagement_counts')
        .update({ count: newCount, updated_at: now })
        .eq('count_type', 'unreplied_comments');
    }

    return Response.json({
      success: true,
      reply: {
        id: replyId,
        text: message,
        timestamp: now,
      },
    });
  } catch (error) {
    console.error('Comment reply error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
