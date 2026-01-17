import { getSupabaseClient } from '@/lib/supabase';

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    
    // Get last sync for each type
    const syncTypes = ['metrics', 'recent', 'insights', 'account'];
    const syncPromises = syncTypes.map(type => 
      supabase
        .from('sync_status')
        .select('*')
        .eq('sync_type', type)
        .order('completed_at', { ascending: false })
        .limit(1)
    );
    
    const syncResults = await Promise.all(syncPromises);
    const lastSyncs = {};
    syncTypes.forEach((type, i) => {
      lastSyncs[type] = syncResults[i].data?.[0] || null;
    });
    
    // Get overall metrics health (count NULLs in recent metrics)
    const { data: recentMetrics } = await supabase
      .from('post_metrics')
      .select('impressions, reach, views, likes, comments, saves, shares')
      .order('fetched_at', { ascending: false })
      .limit(50);
    
    let totalFields = 0;
    let nullFields = 0;
    const fieldNulls = {
      impressions: 0,
      reach: 0,
      views: 0,
      likes: 0,
      comments: 0,
      saves: 0,
      shares: 0,
    };
    
    (recentMetrics || []).forEach(m => {
      Object.keys(fieldNulls).forEach(field => {
        totalFields++;
        if (m[field] === null) {
          nullFields++;
          fieldNulls[field]++;
        }
      });
    });
    
    // Find the most recent successful sync
    const allSyncs = Object.values(lastSyncs).filter(s => s !== null);
    const latestSync = allSyncs.sort((a, b) => 
      new Date(b.completed_at || 0) - new Date(a.completed_at || 0)
    )[0];
    
    // Calculate total errors from recent syncs
    const totalErrors = allSyncs.reduce((sum, s) => sum + (s.errors_count || 0), 0);
    
    return Response.json({
      success: true,
      health: {
        lastSyncAt: latestSync?.completed_at || null,
        lastSyncStatus: latestSync?.status || 'never',
        totalMetricsRecords: recentMetrics?.length || 0,
        nullMetricsCount: nullFields,
        nullMetricsPercent: totalFields > 0 ? Math.round((nullFields / totalFields) * 100) : 0,
        fieldHealth: Object.entries(fieldNulls).map(([field, nullCount]) => ({
          field,
          available: (recentMetrics?.length || 0) - nullCount,
          missing: nullCount,
          availablePercent: recentMetrics?.length > 0 
            ? Math.round(((recentMetrics.length - nullCount) / recentMetrics.length) * 100) 
            : 0,
        })),
        recentErrors: totalErrors,
        syncHistory: lastSyncs,
      }
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
