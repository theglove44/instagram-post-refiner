#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const APPLY_CONFIRMATION = 'RECALCULATE_EDIT_COUNTS';

function splitLines(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
  return normalized === '' ? [] : normalized.split('\n');
}

// Mirrors lib/diff.js. Kept dependency-free so this operational script works
// under the repository's CommonJS package configuration.
function countEdits(oldText, newText) {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);
  const lcs = Array.from(
    { length: oldLines.length + 1 },
    () => new Array(newLines.length + 1).fill(0)
  );

  for (let oldIndex = oldLines.length - 1; oldIndex >= 0; oldIndex--) {
    for (let newIndex = newLines.length - 1; newIndex >= 0; newIndex--) {
      lcs[oldIndex][newIndex] = oldLines[oldIndex] === newLines[newIndex]
        ? lcs[oldIndex + 1][newIndex + 1] + 1
        : Math.max(lcs[oldIndex + 1][newIndex], lcs[oldIndex][newIndex + 1]);
    }
  }

  let oldIndex = 0;
  let newIndex = 0;
  let additions = 0;
  let removals = 0;

  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      oldIndex++;
      newIndex++;
    } else if (lcs[oldIndex + 1][newIndex] >= lcs[oldIndex][newIndex + 1]) {
      removals++;
      oldIndex++;
    } else {
      additions++;
      newIndex++;
    }
  }

  removals += oldLines.length - oldIndex;
  additions += newLines.length - newIndex;
  return Math.max(additions, removals);
}

async function loadTrainingPairs(supabase) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('posts')
      .select('id,post_id,ai_version,final_version,edit_count,origin')
      .eq('origin', 'training_pair')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const confirmation = process.argv.find(arg => arg.startsWith('--confirm='))?.split('=')[1];
  if (apply && confirmation !== APPLY_CONFIRMATION) {
    throw new Error(`Refusing writes. Add --confirm=${APPLY_CONFIRMATION} with --apply.`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const rows = await loadTrainingPairs(supabase);
  const changes = rows
    .map(row => ({ ...row, recalculated: countEdits(row.ai_version, row.final_version) }))
    .filter(row => row.recalculated !== row.edit_count);

  console.log(`${apply ? 'APPLY' : 'DRY RUN'}: ${rows.length} training pairs checked; ${changes.length} changes.`);
  console.table(changes.slice(0, 50).map(row => ({
    id: row.id,
    post_id: row.post_id,
    current: row.edit_count,
    recalculated: row.recalculated,
  })));

  if (!apply) {
    console.log(`No rows changed. Re-run with --apply --confirm=${APPLY_CONFIRMATION} after reviewing output.`);
    return;
  }

  for (const row of changes) {
    const { error } = await supabase
      .from('posts')
      .update({ edit_count: row.recalculated })
      .eq('id', row.id)
      .eq('origin', 'training_pair');
    if (error) throw error;
  }

  console.log(`${changes.length} training-pair rows updated.`);
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message || error);
    process.exit(1);
  });
}

module.exports = { countEdits };
