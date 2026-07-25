import {
  extractNotesContent,
  notesHaveContent,
  buildCaptionUserPrompt,
  buildCaptionSystemPrompt,
} from './voice-pack';

describe('voice-pack', () => {
  it('treats empty template as no content', () => {
    const template = `VENUE:
WHERE:
TYPE: Feed post / Reel
GIFTED: Yes / No
HAD:
LEAD ON:
HONEST NOTE:
MEDIA NOTES:
HANDLES:
DON'T MENTION:
NOTES/BRAIN DUMP:
`;
    expect(notesHaveContent(template)).toBe(false);
    expect(extractNotesContent(template)).toBe('');
  });

  it('detects real notes content', () => {
    const notes = `VENUE: Berry and Rye
WHERE: Liverpool
TYPE: Feed post
GIFTED: No
HAD: Cornballer cocktail
NOTES/BRAIN DUMP: tiny bar, jazz piano, knocked twice
`;
    expect(notesHaveContent(notes)).toBe(true);
    expect(extractNotesContent(notes)).toMatch(/Berry and Rye/);
  });

  it('builds user prompt with topic and notes', () => {
    const prompt = buildCaptionUserPrompt({
      topic: 'Test',
      notes: 'VENUE: Somewhere',
    });
    expect(prompt).toContain('Topic: Test');
    expect(prompt).toContain('VENUE: Somewhere');
  });

  it('builds system prompt from pack pieces', () => {
    const prompt = buildCaptionSystemPrompt({
      skill: 'SKILL BODY',
      gold: 'GOLD BODY',
      archive: 'ARCHIVE BODY',
      transformations: 'TRANS BODY',
      postTypes: 'TYPES BODY',
    });
    expect(prompt).toContain('SKILL BODY');
    expect(prompt).toContain('GOLD BODY');
    expect(prompt).toContain('Return ONLY the finished caption');
  });
});
