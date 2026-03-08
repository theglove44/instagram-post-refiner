import { getSupabaseClient } from '@/lib/supabase';
import { detectMilestones, getNextMilestone } from '@/lib/milestones';

export async function GET(request) {
  try {
    const supabase = getSupabaseClient();
    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '30';

    // Get the connected Instagram account
    const { data: accounts, error: accountError } = await supabase
      .from('instagram_accounts')
      .select('instagram_user_id')
      .order('connected_at', { ascending: false })
      .limit(1);

    if (accountError) {
      throw new Error(accountError.message);
    }

    if (!accounts || accounts.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'No Instagram account connected' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    const instagramUserId = accounts[0].instagram_user_id;

    // Build query with timeframe filter
    let query = supabase
      .from('account_snapshots')
      .select('snapshot_date, followers_count, following_count, media_count')
      .eq('instagram_user_id', instagramUserId)
      .order('snapshot_date', { ascending: true });

    if (days !== 'all') {
      const daysNum = parseInt(days, 10);
      if (![7, 30, 90].includes(daysNum)) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid days parameter. Use 7, 30, 90, or all.' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }
      const since = new Date();
      since.setDate(since.getDate() - daysNum);
      query = query.gte('snapshot_date', since.toISOString().split('T')[0]);
    }

    const { data: snapshots, error: snapshotError } = await query;

    if (snapshotError) {
      throw new Error(snapshotError.message);
    }

    // Graceful handling when < 2 snapshots
    if (!snapshots || snapshots.length < 2) {
      return new Response(JSON.stringify({
        success: true,
        snapshots: snapshots || [],
        growth: null,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      });
    }

    // Calculate daily changes (diff between consecutive days)
    const dailyChanges = [];
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      if (prev.followers_count !== null && curr.followers_count !== null) {
        dailyChanges.push({
          date: curr.snapshot_date,
          change: curr.followers_count - prev.followers_count,
          followers: curr.followers_count,
        });
      }
    }

    // 7-day rolling average growth rate
    const calcRollingAvg = (window) => {
      if (dailyChanges.length < window) return null;
      const recent = dailyChanges.slice(-window);
      const totalChange = recent.reduce((sum, d) => sum + d.change, 0);
      return parseFloat((totalChange / window).toFixed(1));
    };

    const daily7dAvg = calcRollingAvg(7);
    const daily30dAvg = calcRollingAvg(30);

    // Total growth over the period
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const totalGrowth = (last.followers_count ?? 0) - (first.followers_count ?? 0);
    const growthPercent = first.followers_count > 0
      ? parseFloat(((totalGrowth / first.followers_count) * 100).toFixed(2))
      : 0;

    // Period in days
    const periodStart = new Date(first.snapshot_date);
    const periodEnd = new Date(last.snapshot_date);
    const periodDays = Math.round((periodEnd - periodStart) / (1000 * 60 * 60 * 24));

    // Milestone detection (always uses all-time snapshots)
    let allSnapshots = snapshots;
    if (days !== 'all') {
      const { data: allData } = await supabase
        .from('account_snapshots')
        .select('snapshot_date, followers_count')
        .eq('instagram_user_id', instagramUserId)
        .order('snapshot_date', { ascending: true });
      allSnapshots = allData || snapshots;
    }
    const milestones = detectMilestones(allSnapshots);
    const currentFollowers = last.followers_count ?? 0;
    const nextMilestone = getNextMilestone(currentFollowers);

    return new Response(JSON.stringify({
      success: true,
      snapshots,
      growth: {
        daily7dAvg,
        daily30dAvg,
        totalGrowth,
        growthPercent,
        periodDays,
      },
      milestones,
      nextMilestone,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });

  } catch (error) {
    console.error('Growth data error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
