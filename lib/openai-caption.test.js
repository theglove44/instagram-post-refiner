import { cleanCaption, generateCaptionWithOpenAI } from './openai-caption';

describe('openai-caption', () => {
  it('strips fences and caption labels', () => {
    expect(cleanCaption('```\nHello\n```')).toBe('Hello');
    expect(cleanCaption('Caption: Hello there')).toBe('Hello there');
  });

  it('throws when API key missing', async () => {
    await expect(
      generateCaptionWithOpenAI({
        systemPrompt: 'sys',
        userPrompt: 'user',
        apiKey: '',
      })
    ).rejects.toThrow('OPENAI_API_KEY is not configured');

    try {
      await generateCaptionWithOpenAI({
        systemPrompt: 'sys',
        userPrompt: 'user',
        apiKey: '   ',
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error.code).toBe('MISSING_API_KEY');
    }
  });

  it('returns cleaned caption from OpenAI response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '```\nDraft caption here\n```' } }],
      }),
    });

    const caption = await generateCaptionWithOpenAI({
      systemPrompt: 'sys',
      userPrompt: 'user',
      apiKey: 'sk-test',
      fetchImpl,
    });

    expect(caption).toBe('Draft caption here');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('surfaces OpenAI errors', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    await expect(
      generateCaptionWithOpenAI({
        systemPrompt: 'sys',
        userPrompt: 'user',
        apiKey: 'sk-bad',
        fetchImpl,
      })
    ).rejects.toMatchObject({ message: 'Invalid API key', code: 'OPENAI_ERROR' });
  });
});
