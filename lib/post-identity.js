const CANONICAL_ID_PATTERN = /^\d+$/;

export function isCanonicalPostId(value) {
  return CANONICAL_ID_PATTERN.test(String(value ?? '').trim());
}

/**
 * Resolve an API/UI post identifier to the canonical posts.id.
 *
 * Canonical numeric IDs win. Legacy posts.post_id remains accepted so saved
 * links and older clients keep working during the identity transition.
 */
export async function resolvePostIdentity(supabase, identifier) {
  const value = String(identifier ?? '').trim();
  if (!value) return null;

  if (isCanonicalPostId(value)) {
    const { data, error } = await supabase
      .from('posts')
      .select('id, post_id')
      .eq('id', value)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (data) return data;
  }

  const { data, error } = await supabase
    .from('posts')
    .select('id, post_id')
    .eq('post_id', value)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data || null;
}
