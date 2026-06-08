// Pure helpers for the entry image lightbox. DOM wiring lives in
// components/Lightbox.astro; this module holds only logic that can be
// unit-tested without a browser (see lightbox.test.ts).

/** Wrap-around index step. step(2, +1, 3) -> 0 ; step(0, -1, 3) -> 2 */
export function step(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (current + delta + length) % length;
}

/**
 * Group photo refs that share a gallery key into ordered navigable sets, in the
 * order each group is first seen. A null/undefined key is a standalone photo:
 * it forms a singleton group of its own and is never merged with others.
 * Returns groups as arrays of indices into the input array.
 */
export function groupByGallery(keys: (string | null | undefined)[]): number[][] {
  const groups: number[][] = [];
  const byKey = new Map<string, number[]>();
  keys.forEach((key, i) => {
    if (key == null) {
      groups.push([i]);
      return;
    }
    let g = byKey.get(key);
    if (!g) {
      g = [];
      byKey.set(key, g);
      groups.push(g);
    }
    g.push(i);
  });
  return groups;
}

/** Counter label for the lightbox; null when the group has a single photo. */
export function counterLabel(indexInGroup: number, groupSize: number): string | null {
  if (groupSize <= 1) return null;
  return `PHOTO ${indexInGroup + 1} / ${groupSize}`;
}
