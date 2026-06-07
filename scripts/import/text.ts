const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/** Decode common HTML entities, normalize all whitespace to single spaces, trim. */
export function cleanText(raw: string): string {
  let s = raw;
  for (const [ent, ch] of Object.entries(ENTITIES)) s = s.split(ent).join(ch);
  return s.replace(/\s+/g, ' ').trim();
}

/** URL-safe slug: lowercase, non-alphanumerics → hyphens, collapse/trim hyphens. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
