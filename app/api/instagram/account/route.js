import { getSupabaseClient } from '@/lib/supabase';
import { getInstagramAccount, refreshLongLivedToken } from '@/lib/instagram';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    // Get the connected Instagram account
    const { data: accounts, error } = await supabase
      .from('instagram_accounts')
      .select('*')
      .order('connected_at', { ascending: false })
      .limit(1);
    
    if (error) {
      throw new Error(error.message);
    }
    
    if (!accounts || accounts.length === 0) {
      return Response.json({ connected: false });
    }
    
    const account = accounts[0];
    
    // Check if token needs refresh (refresh if less than 7 days until expiry)
    const tokenExpiry = new Date(account.token_expires_at);
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    
    let accessToken = account.access_token;
    
    if (tokenExpiry < sevenDaysFromNow) {
      try {
        const { accessToken: newToken, expiresIn } = await refreshLongLivedToken(account.access_token);
        const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
        
        // Update token in database
        await supabase
          .from('instagram_accounts')
          .update({
            access_token: newToken,
            token_expires_at: newExpiry,
            updated_at: new Date().toISOString(),
          })
          .eq('instagram_user_id', account.instagram_user_id);
        
        accessToken = newToken;
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Continue with existing token, it might still work
      }
    }
    
    // Get current account stats from Instagram
    try {
      const liveData = await getInstagramAccount(accessToken);
      
      return Response.json({
        connected: true,
        account: {
          username: liveData.username,
          profilePicture: liveData.profilePicture,
          followersCount: liveData.followersCount,
          mediaCount: liveData.mediaCount,
          connectedAt: account.connected_at,
          tokenExpiresAt: account.token_expires_at,
        }
      });
    } catch (apiError) {
      // Token might be invalid, return stored data
      return Response.json({
        connected: true,
        account: {
          username: account.instagram_username,
          connectedAt: account.connected_at,
          tokenExpiresAt: account.token_expires_at,
          needsReconnect: true,
        }
      });
    }
    
  } catch (error) {
    console.error('Instagram account error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
