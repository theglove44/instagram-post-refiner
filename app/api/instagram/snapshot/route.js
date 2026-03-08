import { getSupabaseClient } from '@/lib/supabase';
import { graphFetch, GRAPH_API_BASE } from '@/lib/instagram';

/**
 * GET /api/instagram/snapshot
 * Returns the latest account snapshot for quick health checks.
 */
export async function GET() {
  try {
    const supabase = getSupabaseClient();

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

    const { data: snapshot, error } = await supabase
      .from('account_snapshots')
      .select('*')
      .eq('instagram_user_id', account.instagram_user_id)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .single();

    if (error || !snapshot) {
      return Response.json(
        { success: true, snapshot: null, message: 'No snapshots recorded yet' }
      );
    }

    return Response.json({ success: true, snapshot });
  } catch (error) {
    console.error('Snapshot GET error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/instagram/snapshot
 * Takes a point-in-time snapshot of account stats and 28-day insights,
 * then upserts into account_snapshots (one row per user per day).
 */
export async function POST() {
  try {
    const supabase = getSupabaseClient();

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
    const accessToken = account.access_token;
    const userId = account.instagram_user_id;
    const baseUrl = `${GRAPH_API_BASE}/${userId}`;

    // Fetch account info and 28-day insights in parallel
    const [accountResponse, reachResponse, engagedResponse] = await Promise.allSettled([
      graphFetch(
        `${baseUrl}?fields=followers_count,follows_count,media_count`,
        accessToken
      ),
      graphFetch(
        `${baseUrl}/insights?metric=reach&period=days_28`,
        accessToken
      ),
      graphFetch(
        `${baseUrl}/insights?metric=accounts_engaged&period=days_28`,
        accessToken
      ),
    ]);

    // Account info is required
    if (accountResponse.status !== 'fulfilled') {
      throw new Error('Failed to fetch account info from Meta API');
    }
    const accountData = accountResponse.value;
    if (accountData.error) {
      throw new Error(accountData.error.message);
    }

    // Parse 28-day insights (optional — degrade gracefully)
    let reach28d = null;
    let accountsEngaged28d = null;

    try {
      if (reachResponse.status === 'fulfilled') {
        const reachData = reachResponse.value;
        if (reachData.data?.[0]?.values?.[0]?.value !== undefined) {
          reach28d = reachData.data[0].values[0].value;
        }
      }
    } catch (err) {
      console.log('Reach insight not available for snapshot:', err.message);
    }

    try {
      if (engagedResponse.status === 'fulfilled') {
        const engagedData = engagedResponse.value;
        if (engagedData.data?.[0]?.values?.[0]?.value !== undefined) {
          accountsEngaged28d = engagedData.data[0].values[0].value;
        }
      }
    } catch (err) {
      console.log('Accounts engaged insight not available for snapshot:', err.message);
    }

    // Upsert snapshot (one per user per day)
    const snapshotRow = {
      instagram_user_id: userId,
      followers_count: accountData.followers_count ?? null,
      following_count: accountData.follows_count ?? null,
      media_count: accountData.media_count ?? null,
      reach_28d: reach28d,
      accounts_engaged_28d: accountsEngaged28d,
    };

    const { data: snapshot, error: upsertError } = await supabase
      .from('account_snapshots')
      .upsert(snapshotRow, { onConflict: 'instagram_user_id,snapshot_date' })
      .select()
      .single();

    if (upsertError) {
      throw new Error(`Failed to upsert snapshot: ${upsertError.message}`);
    }

    console.log(`Account snapshot saved for ${userId} on ${snapshot.snapshot_date}`);

    return Response.json({ success: true, snapshot });
  } catch (error) {
    console.error('Snapshot POST error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
