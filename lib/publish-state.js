export const PUBLISH_NOW_CLAIMABLE_STATUSES = ['draft', 'scheduled', 'failed'];
export const CRON_CLAIMABLE_STATUSES = ['scheduled'];
export const HARD_DELETABLE_STATUSES = ['draft', 'failed'];
export const CANCELLABLE_STATUSES = ['scheduled'];

export function canHardDelete(status) {
  return HARD_DELETABLE_STATUSES.includes(status);
}

export function canCancel(status) {
  return CANCELLABLE_STATUSES.includes(status);
}

/**
 * Atomically move one post into publishing. The database RPC performs the
 * status predicate and update in one statement, so concurrent callers cannot
 * both claim the same post.
 */
export async function claimPostForPublishing(
  supabase,
  id,
  allowedStatuses,
  { requireDue = false } = {}
) {
  const { data, error } = await supabase.rpc('claim_scheduled_post_for_publishing', {
    p_post_id: id,
    p_allowed_statuses: allowedStatuses,
    p_require_due: requireDue,
  });

  if (error) {
    throw new Error(`Could not claim post for publishing: ${error.message}`);
  }

  return Array.isArray(data) ? data[0] || null : data || null;
}
