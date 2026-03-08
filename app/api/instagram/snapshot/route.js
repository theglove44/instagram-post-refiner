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
 * Backfill ~30 days of historical follower counts using Meta's daily
 * follower_count insight. Works backwards from the current count.
 * Upserts so it won't overwrite existing snapshots.
 */
async function backfillHistory(supabase, userId, accessToken, currentFollowers) {
  const baseUrl = `${GRAPH_API_BASE}/${userId}`;

  // Fetch daily follower deltas for the last 30 days
  const response = await graphFetch(
    `${baseUrl}/insights?metric=follower_count&period=day`,
    accessToken
  );

  if (response.error || !response.data?.[0]?.values) {
    console.log('Backfill: follower_count insight not available:', response.error?.message);
    return { backfilled: 0 };
  }

  // Values are ordered oldest-first, each has { end_time, value } where value is the delta
  const dailyDeltas = response.data[0].values;
  if (!dailyDeltas || dailyDeltas.length === 0) {
    return { backfilled: 0 };
  }

  // Work backwards from current count to reconstruct absolute counts
  // dailyDeltas[last] is the most recent day's change
  const rows = [];
  let runningCount = currentFollowers;

  // Process from newest to oldest
  for (let i = dailyDeltas.length - 1; i >= 0; i--) {
    const delta = dailyDeltas[i];
    const date = delta.end_time.split('T')[0]; // "2026-03-07T08:00:00+0000" -> "2026-03-07"

    rows.push({
      instagram_user_id: userId,
      followers_count: runningCount,
      snapshot_date: date,
    });

    // Subtract this day's gain to get the previous day's count
    runningCount -= (delta.value || 0);
  }

  // Upsert all rows (won't overwrite existing snapshots)
  const { error } = await supabase
    .from('account_snapshots')
    .upsert(rows, { onConflict: 'instagram_user_id,snapshot_date', ignoreDuplicates: true });

  if (error) {
    console.error('Backfill upsert error:', error.message);
    return { backfilled: 0, error: error.message };
  }

  console.log(`Backfilled ${rows.length} days of follower history for ${userId}`);
  return { backfilled: rows.length };
}

/**
 * POST /api/instagram/snapshot
 * Takes a point-in-time snapshot of account stats and 28-day insights,
 * then upserts into account_snapshots (one row per user per day).
 *
 * On first run (empty table) or with ?backfill=true, also backfills
 * ~30 days of historical follower counts from Meta's daily insights.
 */
export async function POST(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const forceBackfill = searchParams.get('backfill') === 'true';

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

    // Upsert today's snapshot (one per user per day)
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

    // Backfill historical data if table was empty or manually requested
    let backfillResult = null;
    if (forceBackfill) {
      backfillResult = await backfillHistory(supabase, userId, accessToken, accountData.followers_count);
    } else {
      // Auto-backfill on first run: check if this is the only snapshot
      const { count } = await supabase
        .from('account_snapshots')
        .select('id', { count: 'exact', head: true })
        .eq('instagram_user_id', userId);

      if (count <= 1) {
        console.log('First snapshot detected — running automatic backfill');
        backfillResult = await backfillHistory(supabase, userId, accessToken, accountData.followers_count);
      }
    }

    return Response.json({
      success: true,
      snapshot,
      ...(backfillResult && { backfill: backfillResult }),
    });
  } catch (error) {
    console.error('Snapshot POST error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
