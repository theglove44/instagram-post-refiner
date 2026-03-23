/**
 * GET /api/cron/nightly
 * Nightly cron job that runs:
 * 1. Daily account snapshot
 * 2. Metrics backfill (50 posts per run)
 * 3. Metrics refresh for last 7 days
 *
 * Called via: curl http://localhost:3000/api/cron/nightly
 * Designed to be triggered by system crontab.
 * Returns immediately; processing continues in the background.
 */
export async function GET(request) {
  const origin = new URL(request.url).origin;
  const results = {};

  try {
    // 0. Check for new posts
    try {
      const pollRes = await fetch(`${origin}/api/cron/poll-new-posts`);
      const pollData = await pollRes.json();
      results.newPosts = pollData.success
        ? { imported: pollData.imported, checked: pollData.checked }
        : pollData.error;
    } catch (err) {
      results.newPosts = err.message;
    }

    // 1. Daily snapshot
    try {
      const snapshotRes = await fetch(`${origin}/api/instagram/snapshot`, { method: 'POST' });
      const snapshotData = await snapshotRes.json();
      results.snapshot = snapshotData.success ? 'ok' : snapshotData.error;
    } catch (err) {
      results.snapshot = err.message;
    }

    // 2. Metrics backfill (50 posts without metrics)
    try {
      const backfillRes = await fetch(`${origin}/api/instagram/metrics/backfill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 50 }),
      });
      const backfillData = await backfillRes.json();
      results.backfill = backfillData.success
        ? { status: 'running', batch: backfillData.batchSize, remaining: backfillData.totalRemaining }
        : backfillData.error;
    } catch (err) {
      results.backfill = err.message;
    }

    // 3. Refresh recent metrics (last 7 days)
    try {
      const metricsRes = await fetch(`${origin}/api/instagram/metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const metricsData = await metricsRes.json();
      results.recentMetrics = metricsData.success ? 'running' : metricsData.error;
    } catch (err) {
      results.recentMetrics = err.message;
    }

    // 4. Comment sync for recent posts (last 7 days)
    try {
      const commentRes = await fetch(`${origin}/api/comments/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 7 }),
      });
      const commentData = await commentRes.json();
      results.commentSync = commentData.success ? 'running' : commentData.error;
    } catch (err) {
      results.commentSync = err.message;
    }

    // 5. Mention/tag sync
    try {
      const mentionRes = await fetch(`${origin}/api/mentions/sync`, { method: 'POST' });
      const mentionData = await mentionRes.json();
      results.mentionSync = mentionData.success ? 'syncing' : mentionData.error;
    } catch (err) {
      results.mentionSync = err.message;
    }

    console.log('Nightly cron completed:', JSON.stringify(results));
    return Response.json({ success: true, results });
  } catch (error) {
    console.error('Nightly cron error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
