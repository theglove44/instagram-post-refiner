import { calculateSimilarity, computeDiff, countEdits } from './diff';

const { countEdits: countHistoricalEdits } = require('../scripts/recalculate-edit-counts.cjs');

describe('computeDiff', () => {
  it('returns unchanged lines for identical multiline text', () => {
    expect(computeDiff('first\nsecond', 'first\nsecond')).toEqual([
      { type: 'unchanged', content: 'first' },
      { type: 'unchanged', content: 'second' },
    ]);
  });

  it('aligns inserted lines without replacing following unchanged lines', () => {
    expect(computeDiff('first\nthird', 'first\nsecond\nthird')).toEqual([
      { type: 'unchanged', content: 'first' },
      { type: 'added', content: 'second' },
      { type: 'unchanged', content: 'third' },
    ]);
  });

  it('normalizes CRLF and CR line endings', () => {
    expect(computeDiff('first\r\nsecond\rthird', 'first\nsecond\nthird'))
      .toEqual([
        { type: 'unchanged', content: 'first' },
        { type: 'unchanged', content: 'second' },
        { type: 'unchanged', content: 'third' },
      ]);
  });

  it('preserves blank and whitespace-only lines', () => {
    expect(computeDiff('first\n\nthird', 'first\n  \nthird')).toEqual([
      { type: 'unchanged', content: 'first' },
      { type: 'removed', content: '' },
      { type: 'added', content: '  ' },
      { type: 'unchanged', content: 'third' },
    ]);
  });

  it('treats leading and trailing whitespace as content', () => {
    expect(computeDiff(' caption ', 'caption')).toEqual([
      { type: 'removed', content: ' caption ' },
      { type: 'added', content: 'caption' },
    ]);
  });

  it('handles empty input without phantom lines', () => {
    expect(computeDiff('', '')).toEqual([]);
    expect(computeDiff('', 'caption')).toEqual([
      { type: 'added', content: 'caption' },
    ]);
  });
});

describe('countEdits', () => {
  it('returns zero for identical content and normalized line endings', () => {
    expect(countEdits('same', 'same')).toBe(0);
    expect(countEdits('first\r\nsecond', 'first\nsecond')).toBe(0);
    expect(countEdits('', '')).toBe(0);
  });

  it('counts a replaced line as one edit', () => {
    expect(countEdits('first\nold\nlast', 'first\nnew\nlast')).toBe(1);
  });

  it('counts every unpaired addition or removal', () => {
    expect(countEdits('first', 'first\na\nb\nc')).toBe(3);
    expect(countEdits('first\na\nb\nc', 'first')).toBe(3);
  });

  it('pairs replacements and counts remaining additions', () => {
    expect(countEdits('old', 'new\nextra')).toBe(2);
  });

  it('counts whitespace-only changes', () => {
    expect(countEdits('caption', 'caption ')).toBe(1);
    expect(countEdits('first\n\nthird', 'first\nthird')).toBe(1);
  });
});

describe('calculateSimilarity', () => {
  it('tokenizes all whitespace rather than literal backslash sequences', () => {
    expect(calculateSimilarity('one\ntwo', 'one two')).toBe(1);
  });
});

describe('historical recalculation parity', () => {
  it.each([
    ['same', 'same'],
    ['first\r\nsecond', 'first\nsecond'],
    ['first', 'first\na\nb\nc'],
    ['first\nold\nlast', 'first\nnew\nlast'],
    ['first\n\nthird', 'first\nthird'],
  ])('matches live edit counting for %j -> %j', (oldText, newText) => {
    expect(countHistoricalEdits(oldText, newText)).toBe(countEdits(oldText, newText));
  });
});
