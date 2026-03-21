import { getSupabaseClient } from '@/lib/supabase';
import { checkPublishingLimit, getTokenExpiryDate } from '@/lib/instagram';

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Get Instagram account
    const { data: accounts, error: accountError } = await supabase
      .from('instagram_accounts')
      .select('*')
      .limit(1);

    if (accountError || !accounts || accounts.length === 0) {
      return Response.json(
        { success: false, error: 'No Instagram account connected' },
        { status: 400 }
      );
    }

    const account = accounts[0];

    const result = await checkPublishingLimit(account.access_token, account.instagram_user_id);

    // If a refreshed token was returned, persist it
    if (result.newToken) {
      const updateData = { access_token: result.newToken };
      if (result.expiresIn) {
        updateData.token_expires_at = getTokenExpiryDate(result.expiresIn);
      }
      await supabase
        .from('instagram_accounts')
        .update(updateData)
        .eq('id', account.id);
    }

    return Response.json({
      success: true,
      quotaUsage: result.quotaUsage,
      quotaTotal: result.quotaTotal,
      remaining: result.quotaTotal - result.quotaUsage,
    });
  } catch (error) {
    console.error('Limit API error:', error);
    return Response.json(
      { success: false, error: error.message || 'Failed to check publishing limit' },
      { status: 500 }
    );
  }
}
