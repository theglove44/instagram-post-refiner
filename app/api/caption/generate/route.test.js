/**
 * @jest-environment node
 */

jest.mock('@/lib/voice-pack', () => ({
  notesHaveContent: jest.fn(),
  loadVoicePack: jest.fn(),
  buildCaptionSystemPrompt: jest.fn(() => 'SYSTEM'),
  buildCaptionUserPrompt: jest.fn(() => 'USER'),
}));

jest.mock('@/lib/openai-caption', () => ({
  generateCaptionWithOpenAI: jest.fn(),
}));

import { notesHaveContent, loadVoicePack } from '@/lib/voice-pack';
import { generateCaptionWithOpenAI } from '@/lib/openai-caption';
import { POST } from './route';

function jsonRequest(body) {
  return new Request('http://localhost/api/caption/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/caption/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects empty notes', async () => {
    notesHaveContent.mockReturnValue(false);
    const res = await POST(jsonRequest({ topic: 'x', notes: 'VENUE:' }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/real detail/i);
  });

  it('returns caption on success', async () => {
    notesHaveContent.mockReturnValue(true);
    loadVoicePack.mockResolvedValue({
      skill: 's',
      gold: 'g',
      archive: 'a',
      transformations: 't',
      postTypes: 'p',
    });
    generateCaptionWithOpenAI.mockResolvedValue('A cracking little caption\n\n#tuckinandtalk #a #b #c #d');

    const res = await POST(jsonRequest({ topic: 'Wings', notes: 'VENUE: home\nHAD: wings' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.caption).toContain('cracking');
  });

  it('maps missing API key to 503', async () => {
    notesHaveContent.mockReturnValue(true);
    loadVoicePack.mockResolvedValue({});
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'MISSING_API_KEY';
    generateCaptionWithOpenAI.mockRejectedValue(err);

    const res = await POST(jsonRequest({ topic: 'x', notes: 'plenty of content here' }));
    expect(res.status).toBe(503);
  });
});
