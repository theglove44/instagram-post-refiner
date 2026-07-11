import {
  CRON_CLAIMABLE_STATUSES,
  PUBLISH_NOW_CLAIMABLE_STATUSES,
  canCancel,
  canHardDelete,
  claimPostForPublishing,
} from './publish-state';

describe('publishing state transitions', () => {
  const statuses = ['draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'];

  test.each(statuses)('hard-delete rule for %s', status => {
    expect(canHardDelete(status)).toBe(['draft', 'failed'].includes(status));
  });

  test.each(statuses)('cancel rule for %s', status => {
    expect(canCancel(status)).toBe(status === 'scheduled');
  });

  test('publish-now and cron expose explicit claim transitions', () => {
    expect(PUBLISH_NOW_CLAIMABLE_STATUSES).toEqual(['draft', 'scheduled', 'failed']);
    expect(CRON_CLAIMABLE_STATUSES).toEqual(['scheduled']);
  });
});

describe('atomic publishing claim contract', () => {
  test('only one concurrent caller receives the claimed post', async () => {
    let status = 'scheduled';
    const rpc = jest.fn(async (_name, { p_post_id, p_allowed_statuses }) => {
      if (!p_allowed_statuses.includes(status)) {
        return { data: [], error: null };
      }

      status = 'publishing';
      return { data: [{ id: p_post_id, status }], error: null };
    });
    const supabase = { rpc };

    const claims = await Promise.all([
      claimPostForPublishing(supabase, 42, CRON_CLAIMABLE_STATUSES),
      claimPostForPublishing(supabase, 42, CRON_CLAIMABLE_STATUSES),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(claims.filter(Boolean)[0]).toEqual({ id: 42, status: 'publishing' });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  test('cron claim requires post to remain due at atomic update time', async () => {
    const supabase = { rpc: jest.fn().mockResolvedValue({ data: [], error: null }) };

    await claimPostForPublishing(supabase, 42, CRON_CLAIMABLE_STATUSES, {
      requireDue: true,
    });

    expect(supabase.rpc).toHaveBeenCalledWith(
      'claim_scheduled_post_for_publishing',
      expect.objectContaining({ p_require_due: true })
    );
  });

  test('returns null when another worker already owns claim', async () => {
    const supabase = { rpc: jest.fn().mockResolvedValue({ data: [], error: null }) };

    await expect(
      claimPostForPublishing(supabase, 42, PUBLISH_NOW_CLAIMABLE_STATUSES)
    ).resolves.toBeNull();
  });

  test('surfaces RPC failure as claim-specific error', async () => {
    const supabase = {
      rpc: jest.fn().mockResolvedValue({ data: null, error: { message: 'function missing' } }),
    };

    await expect(
      claimPostForPublishing(supabase, 42, CRON_CLAIMABLE_STATUSES)
    ).rejects.toThrow('Could not claim post for publishing: function missing');
  });
});
