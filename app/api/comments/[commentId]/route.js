import { getSupabaseClient } from '@/lib/supabase';
import { deleteComment, getTokenExpiryDate } from '@/lib/instagram';

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

export async function DELETE(request, { params }) {
  try {
    const supabase = getSupabaseClient();
    const { commentId } = await params;

    if (!commentId) {
      return Response.json(
        { error: 'commentId is required' },
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

    // Call Instagram API to delete the comment
    const { newToken, expiresIn } = await deleteComment(
      account.access_token,
      commentId
    );

    // Persist refreshed token if needed
    if (newToken) {
      await persistRefreshedToken(supabase, account.id, newToken, expiresIn);
    }

    // Delete replies from DB first (children before parent)
    await supabase
      .from('comments')
      .delete()
      .eq('parent_comment_id', commentId);

    // Delete the comment itself
    await supabase
      .from('comments')
      .delete()
      .eq('instagram_comment_id', commentId);

    // Refresh unreplied count
    const { count: unrepliedCount } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('is_reply', false)
      .eq('reply_status', 'unreplied')
      .eq('is_hidden', false);

    await supabase
      .from('engagement_counts')
      .upsert({
        count_type: 'unreplied_comments',
        count: unrepliedCount || 0,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'count_type' });

    return Response.json({ success: true });
  } catch (error) {
    console.error('Comment delete error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
