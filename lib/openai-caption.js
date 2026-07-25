const DEFAULT_MODEL = 'gpt-4o';

export function getCaptionModel() {
  return process.env.OPENAI_CAPTION_MODEL || DEFAULT_MODEL;
}

/**
 * Call OpenAI chat completions. fetchImpl is injectable for tests.
 */
export async function generateCaptionWithOpenAI({
  systemPrompt,
  userPrompt,
  apiKey = process.env.OPENAI_API_KEY,
  model = getCaptionModel(),
  fetchImpl,
}) {
  if (!apiKey || !String(apiKey).trim()) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.code = 'MISSING_API_KEY';
    throw err;
  }

  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') {
    const err = new Error('fetch is not available in this environment');
    err.code = 'NO_FETCH';
    throw err;
  }

  const response = await doFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message =
      data?.error?.message ||
      `OpenAI request failed (${response.status})`;
    const error = new Error(message);
    error.code = 'OPENAI_ERROR';
    error.status = response.status;
    throw error;
  }

  const raw = data?.choices?.[0]?.message?.content;
  if (!raw || typeof raw !== 'string') {
    const error = new Error('OpenAI returned an empty caption');
    error.code = 'EMPTY_CAPTION';
    throw error;
  }

  return cleanCaption(raw);
}

export function cleanCaption(text) {
  let caption = String(text).trim();
  if (caption.startsWith('```')) {
    caption = caption.replace(/^```(?:\w+)?\n?/, '').replace(/\n?```$/, '').trim();
  }
  // Drop a leading "Caption:" label if the model adds one
  caption = caption.replace(/^caption\s*:\s*/i, '').trim();
  return caption;
}
