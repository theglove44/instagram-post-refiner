import {
  buildCaptionSystemPrompt,
  buildCaptionUserPrompt,
  loadVoicePack,
  notesHaveContent,
} from '@/lib/voice-pack';
import { generateCaptionWithOpenAI } from '@/lib/openai-caption';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const topic = typeof body.topic === 'string' ? body.topic : '';
    const notes = typeof body.notes === 'string' ? body.notes : '';

    if (!notesHaveContent(notes)) {
      return Response.json(
        {
          error:
            'Add some real detail to the notes (venue, what you had, brain dump) before generating.',
        },
        { status: 400 }
      );
    }

    const pack = await loadVoicePack();
    const systemPrompt = buildCaptionSystemPrompt(pack);
    const userPrompt = buildCaptionUserPrompt({ topic, notes });

    const caption = await generateCaptionWithOpenAI({
      systemPrompt,
      userPrompt,
    });

    return Response.json({
      caption,
      model: process.env.OPENAI_CAPTION_MODEL || 'gpt-4o',
    });
  } catch (error) {
    console.error('Caption generate error:', error);

    if (error.code === 'MISSING_API_KEY') {
      return Response.json(
        { error: 'OPENAI_API_KEY is not set on the server.' },
        { status: 503 }
      );
    }

    return Response.json(
      { error: error.message || 'Failed to generate caption' },
      { status: error.status && error.status >= 400 && error.status < 600 ? error.status : 500 }
    );
  }
}
