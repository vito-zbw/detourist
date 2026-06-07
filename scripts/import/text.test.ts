import { describe, it, expect } from 'vitest';
import { cleanText, slugify } from './text';

describe('cleanText', () => {
  it('collapses whitespace and trims', () => {
    expect(cleanText('  hello   world\n\n ')).toBe('hello world');
  });
  it('decodes common HTML entities', () => {
    expect(cleanText('Marks &amp; Spencer &#39;food&#39;')).toBe("Marks & Spencer 'food'");
  });
  it('normalizes non-breaking spaces', () => {
    expect(cleanText('a  b')).toBe('a b');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Day 1 · Kuala Lumpur Arrival')).toBe('day-1-kuala-lumpur-arrival');
  });
  it('strips punctuation and collapses dashes', () => {
    expect(slugify('Twin Towers & a Lesson!!')).toBe('twin-towers-a-lesson');
  });
});
