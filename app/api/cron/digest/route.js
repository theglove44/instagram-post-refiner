/**
 * GET /api/cron/digest
 * Renders yesterday's numbers into a short text digest and pushes it to
 * ntfy (https://ntfy.sh) when NTFY_TOPIC is configured. Read-only.
 *
 * Called via: curl -H "x-cron-secret: ..." http://localhost:3000/api/cron/digest
 */
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { getPulseData } from '@/lib/pulse';

const pct = (n) => (n == null ? '—' : (n * 100).toFixed(0) + '%');
const int = (n) => (n == null ? '—' : Math.round(n).toLocaleString('en-GB'));

/**
 * Build the digest text from pulse data. Exported for testing.
 */
export function buildDigestText(pulse, { now = new Date() } = {}) {
  const lines = [];

  // Views split — most recent day available
  const latestSplit = pulse.viewsSplit[pulse.viewsSplit.length - 1] || null;
  if (latestSplit) {
    const total = latestSplit.follower + latestSplit.nonFollower;
    const strangerShare = total ? latestSplit.nonFollower / total : null;
    lines.push(`👀 Views yesterday: ${int(total)} (${pct(strangerShare)} from non-followers)`);
    const story = latestSplit.byProduct?.STORY;
    if (story) {
      lines.push(`   Stories: ${int(story.follower + story.nonFollower)} views`);
    }
    const reel = latestSplit.byProduct?.REEL;
    if (reel) {
      lines.push(`   Reels: ${int(reel.follower + reel.nonFollower)} views`);
    }
  } else {
    lines.push('👀 Views: no data yet');
  }

  // Stories, last 7 days
  if (pulse.storyTotals.count) {
    lines.push(`📱 Stories (7d): ${pulse.storyTotals.count} posted, ${int(pulse.storyTotals.views)} views, ${pulse.storyTotals.replies} replies`);
  }

  // Growth
  if (pulse.growth.length >= 2) {
    const first = pulse.growth[0];
    const last = pulse.growth[pulse.growth.length - 1];
    const delta = last.followers - first.followers;
    lines.push(`📈 Followers: ${int(last.followers)} (${delta >= 0 ? '+' : ''}${delta} in 30d)`);
  }

  // Posts
  if (pulse.postCount) {
    lines.push(`📝 Posts (30d): ${pulse.postCount}, median ER ${pct(pulse.medianEr)}`);
    const top = pulse.rankedPosts[0];
    if (top) {
      lines.push(`   Best: ${pct(top.er)} ER, ${int(top.reach)} reach — ${top.excerpt.slice(0, 50)}…`);
    }
  }

  // Best slot
  if (pulse.bestSlots.length) {
    lines.push(`⏰ Next best slot: ${pulse.bestSlots[0].slot} UK`);
  }

  lines.push('');
  lines.push(`— Tuck In and Talk, ${now.toISOString().slice(0, 10)}`);
  return lines.join('\n');
}

async function pushToNtfy(topic, text) {
  const response = await fetch(`https://ntfy.sh/${topic}`, {
    method: 'POST',
    headers: {
      Title: 'Tuck In and Talk — daily pulse',
      Tags: 'chart_with_upwards_trend',
      Priority: 'default',
    },
    body: text,
  });
  if (!response.ok) {
    throw new Error(`ntfy push failed: HTTP ${response.status}`);
  }
}

export async function GET() {
  try {
    const supabase = getServerSupabaseClient();
    const pulse = await getPulseData(supabase);
    const digest = buildDigestText(pulse);

    let pushed = false;
    if (process.env.NTFY_TOPIC) {
      try {
        await pushToNtfy(process.env.NTFY_TOPIC, digest);
        pushed = true;
      } catch (err) {
        console.warn('ntfy push failed:', err.message);
      }
    }

    return Response.json({ success: true, pushed, digest });
  } catch (error) {
    console.error('Digest error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
