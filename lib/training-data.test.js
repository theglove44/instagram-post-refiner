import {
  buildTrainingExport,
  classifyPosts,
  fetchTrainingPosts,
  inferAuthorVoice,
  isEditedPair,
} from './training-data';

const base = {
  post_id: '1',
  topic: 'Test',
  ai_version: 'AI draft',
  final_version: 'Chris final',
  edit_count: 3,
  created_at: '2026-07-01T00:00:00Z',
  published_at: '2026-07-01T00:00:00Z',
};

describe('training data classification', () => {
  test('paginates beyond Supabase default row cap', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => ({ post_id: String(index) }));
    const range = jest.fn()
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [{ post_id: '1000' }], error: null });
    const query = { select: jest.fn(), order: jest.fn(), range };
    query.select.mockReturnValue(query);
    query.order.mockReturnValue(query);
    const supabase = { from: jest.fn(() => query) };

    const rows = await fetchTrainingPosts(supabase);

    expect(rows).toHaveLength(1001);
    expect(range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(range).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  test('detects genuine edited pairs', () => {
    expect(isEditedPair(base)).toBe(true);
    expect(isEditedPair({ ...base, final_version: base.ai_version, edit_count: 0 })).toBe(false);
  });

  test('flags likely Tommo-authored captions', () => {
    expect(inferAuthorVoice({ final_version: 'Me and Taylor bought a real tree' })).toBe('likely-tommo');
    expect(inferAuthorVoice({ final_version: 'Me and Tommo went for tea' })).toBe('likely-chris');
  });

  test('separates transformations from final-only references', () => {
    const rows = classifyPosts([
      base,
      {
        ...base,
        post_id: '2',
        ai_version: 'Old final',
        final_version: 'Old final',
        edit_count: 0,
        published_at: '2021-01-01T00:00:00Z',
      },
    ]);

    expect(rows[0].training).toMatchObject({ recordType: 'edited-pair', quality: 'gold' });
    expect(rows[1].training).toMatchObject({ recordType: 'final-only', era: 'legacy', quality: 'reference-only' });
  });

  test('exports explicit usage guidance and labels', () => {
    const result = buildTrainingExport([base]);
    expect(result.schemaVersion).toBe(1);
    expect(result.summary.editedPairs).toBe(1);
    expect(result.records[0]).toMatchObject({ recordType: 'edited-pair', authorVoice: 'likely-chris' });
  });
});
