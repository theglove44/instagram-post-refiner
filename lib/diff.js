// Line-based diff for comparing AI and final versions.
function splitLines(text) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n');
  return normalized === '' ? [] : normalized.split('\n');
}

export function computeDiff(oldText, newText) {
  const oldLines = splitLines(oldText);
  const newLines = splitLines(newText);

  // Build a longest-common-subsequence table. This keeps inserted/deleted
  // lines aligned and preserves meaningful blank or whitespace-only lines.
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

  const changes = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length && newIndex < newLines.length) {
    if (oldLines[oldIndex] === newLines[newIndex]) {
      changes.push({ type: 'unchanged', content: oldLines[oldIndex] });
      oldIndex++;
      newIndex++;
    } else if (lcs[oldIndex + 1][newIndex] >= lcs[oldIndex][newIndex + 1]) {
      changes.push({ type: 'removed', content: oldLines[oldIndex] });
      oldIndex++;
    } else {
      changes.push({ type: 'added', content: newLines[newIndex] });
      newIndex++;
    }
  }

  while (oldIndex < oldLines.length) {
    changes.push({ type: 'removed', content: oldLines[oldIndex++] });
  }

  while (newIndex < newLines.length) {
    changes.push({ type: 'added', content: newLines[newIndex++] });
  }

  return changes;
}

export function countEdits(oldText, newText) {
  const diff = computeDiff(oldText, newText);
  const additions = diff.filter(change => change.type === 'added').length;
  const removals = diff.filter(change => change.type === 'removed').length;

  // A replacement is one removal paired with one addition. Unpaired lines
  // remain individual edits.
  return Math.max(additions, removals);
}

export function calculateSimilarity(a, b) {
  if (!a || !b) return 0;

  const aWords = a.toLowerCase().split(/\s+/).filter(Boolean);
  const bWords = b.toLowerCase().split(/\s+/).filter(Boolean);

  const aSet = new Set(aWords);
  const bSet = new Set(bWords);

  const intersection = [...aSet].filter(x => bSet.has(x)).length;
  const union = new Set([...aWords, ...bWords]).size;

  return union === 0 ? 1 : intersection / union;
}
