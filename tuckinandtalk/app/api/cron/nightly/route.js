import { NextResponse } from 'next/server';

// Daily tasks. Weekly snapshot upserts by week_start and post metrics upsert
// by media id, so running these nightly is idempotent within a period.
// Token refresh extends the long-lived token well before its 60-day expiry.
const TASKS = [
  { name: 'post-insights', path: '/api/insights/posts', method: 'GET' },
  { name: 'weekly-insights', path: '/api/insights/weekly', method: 'GET' },
  { name: 'token-refresh', path: '/api/token/refresh', method: 'POST' },
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
      results.push({ task: task.name, status: res.status, success: data.success ?? res.ok, ...summarize(data) });
    } catch (err) {
      results.push({ task: task.name, status: 0, success: false, error: err.message });
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`[cron/nightly] completed in ${elapsed}ms`, JSON.stringify(results));
  return NextResponse.json({ success: true, elapsed, results });
}

function summarize(data) {
  const out = {};
  for (const k of ['processed', 'errors', 'total', 'count']) {
    if (typeof data[k] === 'number') out[k] = data[k];
  }
  return out;
}
