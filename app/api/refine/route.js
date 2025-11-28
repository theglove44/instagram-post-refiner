import Anthropic from '@anthropic-ai/sdk';
import { INSTAGRAM_SYSTEM_PROMPT } from '../../../lib/system-prompt';

const anthropic = new Anthropic();

export async function POST(request) {
  try {
    const { draft, topic } = await request.json();

    if (!draft) {
      return Response.json({ error: 'Draft is required' }, { status: 400 });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: INSTAGRAM_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Please refine this Instagram post draft to better match Chris's voice and style:

Topic: ${topic || 'General'}

Draft:
${draft}`
        }
      ]
    });

    const refinedPost = message.content[0].text;

    return Response.json({ 
      refined: refinedPost,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens
      }
    });
  } catch (error) {
    console.error('Refine API error:', error);
    return Response.json(
      { error: error.message || 'Failed to refine post' },
      { status: 500 }
    );
  }
}
