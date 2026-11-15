import { followerSignalFields, insertPostMetrics, FOLLOWER_SIGNAL_COLUMNS, isMissingColumnError } from './post-metrics';

function clientWithInsertResults(...results) {
  const insert = jest.fn();
  for (const result of results) insert.mockResolvedValueOnce(result);
  return { client: { from: jest.fn(() => ({ insert })) }, insert };
}

const MISSING_COLUMN = { code: 'PGRST204', message: "Could not find the 'follows' column of 'post_metrics' in the schema cache" };

describe('followerSignalFields', () => {
  test('maps insights to the new columns, keeping null for missing values', () => {
    expect(followerSignalFields({ follows: 3, profile_visits: 0, total_views: 900, profile_activity_breakdown: { BIO_LINK_CLICKED: 1 } })).toEqual({
      follows: 3,
      profile_visits: 0,
      profile_activity: null,
      profile_activity_breakdown: { BIO_LINK_CLICKED: 1 },
      reposts: null,
      total_views: 900,
    });
  });

  test('null insights give all-null fields', () => {
    const fields = followerSignalFields(null);
    expect(Object.keys(fields)).toEqual(FOLLOWER_SIGNAL_COLUMNS);
    expect(Object.values(fields).every((v) => v === null)).toBe(true);
  });
});

describe('isMissingColumnError', () => {
  test('recognises PostgREST and Postgres missing-column errors only', () => {
    expect(isMissingColumnError(MISSING_COLUMN)).toBe(true);
    expect(isMissingColumnError({ code: '42703', message: 'column post_metrics.follows does not exist' })).toBe(true);
    expect(isMissingColumnError({ code: '23505', message: 'duplicate key' })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
  });
});

describe('insertPostMetrics', () => {
  const row = { post_id: 1, reach: 10, follows: 2, total_views: 50, profile_activity_breakdown: null };

  test('inserts the full row when the migration is applied', async () => {
    const { client, insert } = clientWithInsertResults({ error: null });
    const { error } = await insertPostMetrics(client, row);
    expect(error).toBeNull();
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toEqual(row);
    expect(client.from).toHaveBeenCalledWith('post_metrics');
  });

  test('retries without the new columns when they do not exist yet', async () => {
    const { client, insert } = clientWithInsertResults({ error: MISSING_COLUMN }, { error: null });
    const { error } = await insertPostMetrics(client, row);
    expect(error).toBeNull();
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert.mock.calls[1][0]).toEqual({ post_id: 1, reach: 10 });
  });

  test('passes other errors straight through without retrying', async () => {
    const { client, insert } = clientWithInsertResults({ error: { code: '23503', message: 'fk violation' } });
    const { error } = await insertPostMetrics(client, row);
    expect(error.message).toBe('fk violation');
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe('unmeasured-period rule', () => {
  const { SIGNALS_MEASURED_SINCE, isUnmeasuredPeriod } = require('./post-metrics');

  test('cutoff is 2024-07-01, where Meta started returning real views', () => {
    expect(SIGNALS_MEASURED_SINCE).toBe('2024-07-01');
  });

  test('an old post whose views and total_views are both zero was not measured', () => {
    expect(isUnmeasuredPeriod('2023-06-15T10:00:00Z', { views: 0, total_views: 0 })).toBe(true);
    expect(isUnmeasuredPeriod('2024-03-15T10:00:00Z', { views: 0, total_views: null })).toBe(true);
    expect(isUnmeasuredPeriod('2022-09-01T00:00:00Z', {})).toBe(true);
  });

  test('an old post that did report views keeps its numbers', () => {
    expect(isUnmeasuredPeriod('2022-09-20T00:00:00Z', { views: 41, total_views: 0 })).toBe(false);
    expect(isUnmeasuredPeriod('2024-05-01T00:00:00Z', { views: 0, total_views: 12 })).toBe(false);
  });

  test('from the cutoff onward zeros are real zeros', () => {
    expect(isUnmeasuredPeriod('2024-07-01T00:00:00Z', { views: 0, total_views: 0 })).toBe(false);
    expect(isUnmeasuredPeriod('2025-03-16T00:00:00Z', { views: 0, total_views: 0 })).toBe(false);
  });

  test('without a publish date we cannot tell, so the numbers are kept', () => {
    expect(isUnmeasuredPeriod(null, { views: 0, total_views: 0 })).toBe(false);
    expect(isUnmeasuredPeriod('not a date', { views: 0, total_views: 0 })).toBe(false);
  });

  test('followerSignalFields stores nulls, not zeros, for an unmeasured post', () => {
    const insights = { views: 0, total_views: 0, follows: 0, profile_visits: 0, reposts: 0, profile_activity: 0 };
    const fields = followerSignalFields(insights, '2023-06-15T10:00:00Z');
    expect(Object.keys(fields)).toEqual(FOLLOWER_SIGNAL_COLUMNS);
    expect(Object.values(fields).every((v) => v === null)).toBe(true);
  });

  test('followerSignalFields keeps real zeros on a measured post', () => {
    const fields = followerSignalFields({ views: 900, total_views: 950, follows: 0, profile_visits: 0 }, '2025-10-15T10:00:00Z');
    expect(fields).toMatchObject({ follows: 0, profile_visits: 0, total_views: 950 });
  });
});
