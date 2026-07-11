export const POST_ORIGINS = Object.freeze({
  TRAINING_PAIR: 'training_pair',
  INSTAGRAM_IMPORT: 'instagram_import',
});

export function isTrainingPair(post) {
  if (post.origin) {
    return post.origin === POST_ORIGINS.TRAINING_PAIR;
  }

  // Before the origin migration, importer-created rows used this stable ID
  // prefix. Logged rows may still have Instagram IDs after being linked.
  return !String(post.post_id || '').startsWith('ig_');
}
