// Simple diff implementation for comparing AI vs Final versions
export function computeDiff(oldText, newText) {
  const oldLines = oldText.trim().split('\\n');
  const newLines = newText.trim().split('\\n');
  
  const changes = [];
  let oldIndex = 0;
  let newIndex = 0;
  
  // Simple line-by-line comparison
  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex >= oldLines.length) {
      // Remaining lines are additions
      changes.push({ type: 'added', content: newLines[newIndex] });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Remaining lines are removals
      changes.push({ type: 'removed', content: oldLines[oldIndex] });
      oldIndex++;
    } else if (oldLines[oldIndex] === newLines[newIndex]) {
      // Lines match
      changes.push({ type: 'unchanged', content: oldLines[oldIndex] });
      oldIndex++;
      newIndex++;
    } else {
      // Lines differ - check if it's a modification or add/remove
      const oldLineInNew = newLines.indexOf(oldLines[oldIndex], newIndex);
      const newLineInOld = oldLines.indexOf(newLines[newIndex], oldIndex);
      
      if (oldLineInNew === -1 && newLineInOld === -1) {
        // Line was modified
        changes.push({ type: 'removed', content: oldLines[oldIndex] });
        changes.push({ type: 'added', content: newLines[newIndex] });
        oldIndex++;
        newIndex++;
      } else if (oldLineInNew === -1 || (newLineInOld !== -1 && newLineInOld < oldLineInNew)) {
        // Old line was removed
        changes.push({ type: 'removed', content: oldLines[oldIndex] });
        oldIndex++;
      } else {
        // New line was added
        changes.push({ type: 'added', content: newLines[newIndex] });
        newIndex++;
      }
    }
  }
  
  return changes;
}

export function countEdits(oldText, newText) {
  const diff = computeDiff(oldText, newText);
  const edits = diff.filter(d => d.type !== 'unchanged').length;
  return Math.max(1, Math.ceil(edits / 2)); // Pair add/remove as single edit
}

export function calculateSimilarity(a, b) {
  if (!a || !b) return 0;
  
  const aWords = a.toLowerCase().split(/\\s+/);
  const bWords = b.toLowerCase().split(/\\s+/);
  
  const aSet = new Set(aWords);
  const bSet = new Set(bWords);
  
  const intersection = [...aSet].filter(x => bSet.has(x)).length;
  const union = new Set([...aWords, ...bWords]).size;
  
  return union === 0 ? 1 : intersection / union;
}
