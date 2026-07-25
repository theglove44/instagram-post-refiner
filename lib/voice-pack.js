import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SKILL_ROOT = path.join(process.cwd(), '.codex/skills/instagram-posts');

const FIELD_LINE =
  /^(VENUE|WHERE|TYPE|GIFTED|HAD|LEAD ON|HONEST NOTE|MEDIA NOTES|HANDLES|DON['’]T MENTION|NOTES\/BRAIN DUMP):\s*(.*)$/i;

const PLACEHOLDER_VALUES = [
  /^feed post\s*\/\s*reel$/i,
  /^yes\s*\/\s*no$/i,
];

const MAX_REFERENCE_CHARS = 12_000;

export function extractNotesContent(notes = '') {
  const values = [];
  for (const rawLine of String(notes).split(/\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(FIELD_LINE);
    let value = match ? match[2].trim() : line;
    if (!value) continue;
    if (PLACEHOLDER_VALUES.some((pattern) => pattern.test(value))) continue;
    values.push(value);
  }
  return values.join(' ').trim();
}

export function notesHaveContent(notes, minChars = 12) {
  return extractNotesContent(notes).length >= minChars;
}

async function readSkillFile(relativePath) {
  const fullPath = path.join(SKILL_ROOT, relativePath);
  return readFile(fullPath, 'utf8');
}

function clip(text, max = MAX_REFERENCE_CHARS) {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[…truncated for prompt size…]`;
}

export async function loadVoicePack() {
  const [skill, gold, archive, transformations, postTypes] = await Promise.all([
    readSkillFile('SKILL.md'),
    readSkillFile('references/gold-captions.md'),
    readSkillFile('references/archive-lessons.md'),
    readSkillFile('references/transformations.md'),
    readSkillFile('references/post-types.md'),
  ]);

  return {
    skill,
    gold: clip(gold),
    archive: clip(archive, 6_000),
    transformations: clip(transformations, 4_000),
    postTypes: clip(postTypes, 6_000),
  };
}

export function buildCaptionSystemPrompt(pack) {
  return [
    'You write Instagram captions for Chris (Tuck In and Talk) in his current voice.',
    'Follow the skill rules and references below exactly.',
    'Return ONLY the finished caption text — no preamble, no analysis, no markdown fences.',
    'Use only facts from the user notes. Never invent dishes, prices, handles, reactions, or events.',
    'If a detail is missing, omit it rather than guessing.',
    'Never use em dashes.',
    'Exactly five hashtags, with #tuckinandtalk first, at the end.',
    '',
    '## Skill',
    pack.skill,
    '',
    '## Gold captions (style examples — do not copy wording or facts)',
    pack.gold,
    '',
    '## Archive lessons',
    pack.archive,
    '',
    '## Transformations',
    pack.transformations,
    '',
    '## Post types',
    pack.postTypes,
  ].join('\n');
}

export function buildCaptionUserPrompt({ topic, notes }) {
  return [
    `Topic: ${topic?.trim() || 'Untitled'}`,
    '',
    'Structured notes and brain dump (sole factual source):',
    notes.trim(),
    '',
    'Write one Instagram caption ready for Chris to edit. Caption only.',
  ].join('\n');
}
