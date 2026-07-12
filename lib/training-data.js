const TOMMO_AUTHOR_PATTERNS = [
  /\bme and taylor\b/i,
  /\bmy tommo top\b/i,
  /\bhere['’]s my tommo\b/i,
];

export async function fetchTrainingPosts(supabase, maxRows = 5000) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = Math.min(from + pageSize - 1, maxRows - 1);
    const { data, error } = await supabase
      .from('posts')
      .select('post_id, topic, ai_version, final_version, edit_count, origin, created_at, published_at')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

export function getPostDate(post) {
  return new Date(post.published_at || post.created_at);
}

export function isEditedPair(post) {
  return Boolean(
    post?.ai_version &&
    post?.final_version &&
    isTrainingPair(post) &&
    post.ai_version !== post.final_version &&
    Number(post.edit_count) > 0
  );
}

export function inferAuthorVoice(post) {
  const text = post?.final_version || '';
  return TOMMO_AUTHOR_PATTERNS.some(pattern => pattern.test(text))
    ? 'likely-tommo'
    : 'likely-chris';
}

export function classifyEra(post, latestDate) {
  const date = getPostDate(post);
  const ageDays = (latestDate - date) / 86_400_000;
  if (ageDays <= 365) return 'current';
  if (ageDays <= 1095) return 'transitional';
  return 'legacy';
}

export function classifyPosts(posts) {
  const validDates = posts.map(getPostDate).filter(date => !Number.isNaN(date.valueOf()));
  const latestDate = validDates.length
    ? new Date(Math.max(...validDates.map(date => date.valueOf())))
    : new Date();

  return posts.map(post => {
    const recordType = isEditedPair(post) ? 'edited-pair' : 'final-only';
    const authorVoice = inferAuthorVoice(post);
    const era = classifyEra(post, latestDate);
    const quality = recordType === 'edited-pair'
      ? 'gold'
      : authorVoice === 'likely-tommo'
        ? 'exclude-from-chris-voice'
        : era === 'current'
          ? 'usable'
          : 'reference-only';

    return { ...post, training: { recordType, authorVoice, era, quality } };
  });
}

export function summarizeTrainingData(classifiedPosts) {
  const count = predicate => classifiedPosts.filter(predicate).length;
  return {
    totalRecords: classifiedPosts.length,
    editedPairs: count(post => post.training.recordType === 'edited-pair'),
    finalOnly: count(post => post.training.recordType === 'final-only'),
    currentVoiceExamples: count(post => post.training.quality === 'usable'),
    likelyTommoAuthored: count(post => post.training.authorVoice === 'likely-tommo'),
    legacyReferences: count(post => post.training.era === 'legacy'),
  };
}

export function buildTrainingExport(posts) {
  const classified = classifyPosts(posts);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    summary: summarizeTrainingData(classified),
    guidance: {
      editedPairs: 'Use for AI-to-Chris transformation learning.',
      finalOnly: 'Use as voice examples only. Never treat as zero-edit AI successes.',
      authorVoice: 'Review likely-tommo labels before using records for Chris voice.',
      era: 'Prefer current examples; use transitional and legacy posts as reference only.',
    },
    records: classified.map(post => ({
      id: post.post_id,
      topic: post.topic,
      aiVersion: post.ai_version,
      finalVersion: post.final_version,
      editCount: post.edit_count,
      publishedAt: post.published_at,
      createdAt: post.created_at,
      ...post.training,
    })),
  };
}
import { isTrainingPair } from './post-origin.js';
