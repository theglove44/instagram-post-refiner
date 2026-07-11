import { isTrainingPair, POST_ORIGINS } from './post-origin';

describe('isTrainingPair', () => {
  it('uses explicit origin when present', () => {
    expect(isTrainingPair({ origin: POST_ORIGINS.TRAINING_PAIR, post_id: 'ig_1' })).toBe(true);
    expect(isTrainingPair({ origin: POST_ORIGINS.INSTAGRAM_IMPORT, post_id: 'logged_1' })).toBe(false);
  });

  it('keeps legacy logged rows as training pairs', () => {
    expect(isTrainingPair({ origin: null, post_id: '1720000000000' })).toBe(true);
  });

  it('excludes legacy importer rows by their stable post ID prefix', () => {
    expect(isTrainingPair({ post_id: 'ig_12345' })).toBe(false);
  });

  it('does not reject linked legacy training rows', () => {
    expect(isTrainingPair({
      post_id: '1720000000000',
      instagram_media_id: '12345',
    })).toBe(true);
  });
});
