#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const path = process.argv[2];
if (!path) {
  console.error('Usage: node scripts/check-caption.mjs <caption-file>');
  process.exit(2);
}

let text;
try {
  text = await readFile(path, 'utf8');
} catch (error) {
  console.error(`Unable to read caption file: ${error.message}`);
  process.exit(2);
}
const errors = [];
const warnings = [];
const firstLine = text.split('\n')[0].trim();
const hashtags = text.match(/#\w+/g) || [];
const caps = text.match(/\b[A-Z]{2,}\b/g) || [];

if (/^\p{Extended_Pictographic}/u.test(firstLine)) errors.push('Caption opens with emoji.');
if (hashtags.length > 5) errors.push(`Hashtag count ${hashtags.length}; current maximum is 5.`);
if (hashtags.length && !hashtags.map(tag => tag.toLowerCase()).includes('#tuckinandtalk')) {
  warnings.push('Hashtags present without #tuckinandtalk.');
}
if (/\bproper(?:ly)?\b/i.test(text)) warnings.push('Uses proper/properly; repeated edit data says Chris usually removes it.');
if (/\bbang on\b|\bclass\b|\bvibes\b/i.test(text)) warnings.push('Uses recurring AI-like wording: bang on/class/vibes.');
if ((text.match(/\bhonestly\b/gi) || []).length > 1) warnings.push('Uses honestly more than once.');
if (caps.length > 8) warnings.push(`High CAPS count: ${caps.length}.`);
if (!/\n\s*\n/.test(text)) warnings.push('No blank-line paragraph spacing.');
if (firstLine.length > 140) warnings.push(`Long first line: ${firstLine.length} characters.`);

for (const error of errors) console.error(`ERROR: ${error}`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
console.log(`Checked ${text.length} characters, ${hashtags.length} hashtags, ${caps.length} CAPS words.`);
process.exit(errors.length ? 1 : 0);
