import { findCatchupCandidates, CATCHUP_SNAPSHOTS_BEFORE } from './signal-catchup';
import { SIGNALS_MEASURED_SINCE } from './post-metrics';

// Minimal PostgREST stand-in: records the calls so we can check the query shape.
function fakeSupabase(rows) {
  const calls = { gte: [], order: [], limit: [], range: [] };
  const builder = {
    select: () => builder,
    not: () => builder,
    gte: (...a) => { calls.gte.push(a); return builder; },
    order: (...a) => { calls.order.push(a); return builder; },
    limit: (...a) => { calls.limit.push(a); return builder; },
    range: (from, to) => {
      calls.range.push([from, to]);
      return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
    },
  };
  return { client: { from: () => builder }, calls };
}

const OLD = '2026-11-10T03:00:00Z';
const NEW = '2026-11-16T03:00:00Z';
const post = (i, snapshot, published = '2025-05-01T00:00:00Z') => ({
  id: `p${i}`,
  instagram_media_id: `m${i}`,
  published_at: published,
  post_metrics: snapshot ? [snapshot] : [],
});

describe('findCatchupCandidates', () => {
  it('picks posts whose latest snapshot predates the signals, newest first, up to the limit', async () => {
    const rows = [
      post(1, { total_views: null, fetched_at: OLD }),
      post(2, { total_views: 500, fetched_at: OLD }),   // already has signals
      post(3, { total_views: null, fetched_at: NEW }),  // re-measured since (type with no signals)
      post(4, null),                                     // no snapshot: backfill's job
      post(5, { total_views: null, fetched_at: OLD }),
      post(6, { total_views: null, fetched_at: OLD }),
    ];
    const { client } = fakeSupabase(rows);

    const result = await findCatchupCandidates(client, { limit: 2 });

    expect(result.candidates.map((p) => p.id)).toEqual(['p1', 'p5']);
    expect(result.totalRemaining).toBe(3);
  });

  it('only looks at posts from the measured window and reads the latest snapshot via an embedded order + limit', async () => {
    const { client, calls } = fakeSupabase([]);

    await findCatchupCandidates(client, { limit: 10 });

    expect(calls.gte).toContainEqual(['published_at', SIGNALS_MEASURED_SINCE]);
    expect(calls.order).toContainEqual(['fetched_at', { referencedTable: 'post_metrics', ascending: false }]);
    expect(calls.limit).toContainEqual([1, { referencedTable: 'post_metrics' }]);
    expect(calls.order).toContainEqual(['published_at', { ascending: false, nullsFirst: false }]);
  });

  it('pages past the 1000-row cap', async () => {
    const rows = Array.from({ length: 2300 }, (_, i) => post(i, { total_views: i >= 2290 ? null : 5, fetched_at: OLD }));
    const { client, calls } = fakeSupabase(rows);

    const result = await findCatchupCandidates(client, { limit: 50 });

    expect(calls.range).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(result.totalRemaining).toBe(10);
    expect(result.candidates).toHaveLength(10);
  });

  it('skips posts that failed recently so dead posts cannot starve the queue', async () => {
    const rows = [
      post(1, { total_views: null, fetched_at: OLD }),
      post(2, { total_views: null, fetched_at: OLD }),
    ];
    const { client } = fakeSupabase(rows);

    const result = await findCatchupCandidates(client, { limit: 10, skipPostIds: new Set(['p1']) });

    expect(result.candidates.map((p) => p.id)).toEqual(['p2']);
    expect(result.totalRemaining).toBe(1);
  });

  it('uses a fixed cut-off so a post that stays null after re-measuring is not picked forever', () => {
    expect(CATCHUP_SNAPSHOTS_BEFORE).toBe('2026-11-15T00:00:00.000Z');
  });

  it('throws when Supabase reports an error', async () => {
    const b = { select: () => b, not: () => b, gte: () => b, order: () => b, limit: () => b, range: () => Promise.resolve({ data: null, error: { message: 'boom' } }) };
    await expect(findCatchupCandidates({ from: () => b }, { limit: 5 })).rejects.toThrow('boom');
  });
});
