import { describe, it, expect } from 'vitest';
import { step, groupByGallery, counterLabel } from './lightbox';

describe('step', () => {
  it('advances forward', () => {
    expect(step(0, 1, 3)).toBe(1);
  });
  it('wraps past the end', () => {
    expect(step(2, 1, 3)).toBe(0);
  });
  it('wraps before the start', () => {
    expect(step(0, -1, 3)).toBe(2);
  });
  it('is safe for an empty set', () => {
    expect(step(0, 1, 0)).toBe(0);
  });
});

describe('groupByGallery', () => {
  it('groups photos that share a gallery key, in order', () => {
    expect(groupByGallery(['g0', 'g0', 'g0'])).toEqual([[0, 1, 2]]);
  });
  it('gives each standalone photo (null key) its own singleton group', () => {
    expect(groupByGallery([null, null])).toEqual([[0], [1]]);
  });
  it('keeps separate galleries separate and preserves first-seen order', () => {
    expect(groupByGallery(['g0', null, 'g1', 'g1'])).toEqual([[0], [1], [2, 3]]);
  });
});

describe('counterLabel', () => {
  it('returns a 1-based label for multi-photo groups', () => {
    expect(counterLabel(1, 6)).toBe('PHOTO 2 / 6');
  });
  it('returns null for a single-photo group', () => {
    expect(counterLabel(0, 1)).toBeNull();
  });
});
