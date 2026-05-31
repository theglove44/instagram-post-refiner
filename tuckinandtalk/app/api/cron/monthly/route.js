import { NextResponse } from 'next/server';

// Monthly benchmark tasks. Both endpoints INSERT a dated row per run
// (one per active competitor / hashtag), so they must run on a monthly
// cadence — not nightly — to avoid flooding the audit tables.
const TASKS = [
  { name: 'competitor-snapshot', path: '/api/competitors/snapshot', method: 'POST' },
  { name: 'hashtag-audit', path: '/api/hashtags/audit', method: 'POST' },
];

export async function GET(request) {
  const cronSecret = process.env.TAT_CRON_SECRET;
  const providedSecret = request.headers.get('x-cron-secret');

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;
  const results = [];
  const startTime = Date.now();

  for (const task of TASKS) {
    try {
      const res = await fetch(`${baseUrl}${task.path}`, {
        method: task.method || 'GET',
        headers: {
          'x-cron-secret': cronSecret,
          'Content-Type': 'application/json',
        },
        body: task.body ? JSON.stringify(task.body) : undefined,
        signal: AbortSignal.timeout(90000),
      });
      const data = await res.json();
      results.push({
        task: task.name,
        status: res.status,
        success: data.success ?? res.ok,
        processed: typeof data.processed === 'number' ? data.processed : undefined,
        errors: typeof data.errors === 'number' ? data.errors : undefined,
      });
    } catch (err) {
      results.push({ task: task.name, status: 0, success: false, error: err.message });
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[cron/monthly] completed in ${elapsed}ms`, JSON.stringify(results));
  return NextResponse.json({ success: true, elapsed, results });
}
