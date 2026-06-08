// ============================================================
// Content access layer — the ONE place that knows whether content
// comes from Sanity or the bundled seed. Pages/components only ever
// call the exported helpers below.
// ============================================================
import { hasSanity, sanityClient } from './sanity';
import { TRIPS_QUERY, ENTRIES_QUERY, SITE_SETTINGS_QUERY } from './queries';
import { seedTrips, seedEntries } from './seed';
import type {
  Trip,
  Entry,
  TripColor,
  SlotTint,
  GalleryImage,
  PortableBlock,
  TravelImage,
  VisitedCountry,
  SiteStats,
} from './types';

const REGION_COLOR: Record<string, TripColor> = {
  malaysia: 'magenta',
  singapore: 'teal',
  canada: 'coral',
};

/** region (lowercased) → ISO 3166-1 numeric code (as string; matches world-atlas feature ids). */
const REGION_ISO: Record<string, string> = {
  malaysia: '458',
  singapore: '702',
  canada: '124',
};

/** region (lowercased) → continent, for the homepage "continents" stat. */
const REGION_CONTINENT: Record<string, string> = {
  malaysia: 'Asia',
  singapore: 'Asia',
  canada: 'North America',
};

/**
 * Micro-states whose polygon is missing/invisible at world scale → locator ring at [lng, lat].
 * Only add a region here if it has NO usable polygon at the 110m dataset scale; a region with
 * both a polygon and a marker would render twice (and both would carry the same data-key).
 */
const REGION_MARKER: Record<string, [number, number]> = {
  singapore: [103.82, 1.35],
};

function colorForRegion(region: string | undefined): TripColor {
  return REGION_COLOR[(region ?? '').toLowerCase()] ?? 'coral';
}

function tintForColor(color: TripColor): SlotTint {
  return color === 'gold' ? 'gold' : (color as SlotTint);
}

// ---------- Sanity → typed mappers ----------

function mapImage(raw: any): TravelImage | null {
  if (!raw || !raw.asset) return null;
  return { asset: raw, alt: raw.alt ?? '' };
}

function mapGalleryImage(raw: any): GalleryImage {
  return {
    asset: raw?.asset ? raw : null,
    alt: raw?.alt ?? '',
    label: raw?.label,
    tint: raw?.tint,
    caption: raw?.caption,
    tilt: raw?.tilt,
    tape: raw?.tape,
    pin: raw?.pin,
  };
}

function mapBody(raw: any[]): PortableBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((block) => {
    if (block?._type === 'gallery') {
      return { ...block, images: (block.images ?? []).map(mapGalleryImage) };
    }
    return block;
  });
}

function plainText(body: PortableBlock[]): string {
  const parts: string[] = [];
  for (const block of body) {
    if (block._type === 'block') parts.push(block.children.map((c) => c.text).join(' '));
    else if (block._type === 'pullQuote') parts.push(block.text);
    else if (block._type === 'tip') parts.push(block.text);
  }
  return parts.join(' ');
}

function computeReadMins(body: PortableBlock[], excerpt: string): number {
  const words = (plainText(body) + ' ' + (excerpt ?? '')).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function computeDuration(startDate: string, endDate: string | null): string {
  if (!endDate) return 'ongoing';
  const ms = Date.parse(endDate) - Date.parse(startDate);
  // Inclusive day count: a trip from the 8th to the 14th spans 7 days, not 6 nights.
  const days = Math.max(1, Math.round(ms / 86_400_000) + 1);
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  return `${Math.round(days / 7)} weeks`;
}

function mapSanityTrip(raw: any): Trip {
  const color = colorForRegion(raw.region);
  return {
    _id: raw._id,
    name: raw.name,
    slug: raw.slug,
    region: raw.region,
    startDate: raw.startDate,
    endDate: raw.endDate ?? null,
    summary: raw.summary ?? '',
    coverImage: mapImage(raw.coverImage),
    color,
    duration: computeDuration(raw.startDate, raw.endDate ?? null),
  };
}

function mapSanityEntry(raw: any): Entry {
  const tripColor = colorForRegion(raw.tripRegion);
  const body = mapBody(raw.body ?? []);
  const excerpt = raw.excerpt ?? '';
  return {
    _id: raw._id,
    title: raw.title,
    slug: raw.slug,
    tripSlug: raw.tripSlug ?? '',
    tripName: raw.tripName ?? '',
    tripColor,
    tripKey: (raw.tripRegion ?? raw.tripSlug ?? '').toLowerCase(),
    date: raw.date,
    location:
      raw.location && raw.location.lat != null && raw.location.lng != null
        ? { name: raw.location.name ?? '', lat: raw.location.lat, lng: raw.location.lng }
        : null,
    coverImage: mapImage(raw.coverImage),
    coverTint: tintForColor(tripColor),
    gallery: (raw.gallery ?? []).map(mapGalleryImage),
    body,
    excerpt,
    featured: Boolean(raw.featured),
    readMins: computeReadMins(body, excerpt),
  };
}

// ---------- single, memoised load ----------

let cache: { trips: Trip[]; entries: Entry[] } | null = null;

async function loadAll(): Promise<{ trips: Trip[]; entries: Entry[] }> {
  if (cache) return cache;

  let trips: Trip[];
  let entries: Entry[];

  if (hasSanity && sanityClient) {
    const [rawTrips, rawEntries] = await Promise.all([
      sanityClient.fetch<any[]>(TRIPS_QUERY),
      sanityClient.fetch<any[]>(ENTRIES_QUERY),
    ]);
    trips = rawTrips.map(mapSanityTrip);
    entries = rawEntries.map(mapSanityEntry);

    // Derive a route label per trip from its entry count when not authored.
    for (const trip of trips) {
      if (!trip.routeLabel) {
        const count = entries.filter((e) => e.tripSlug === trip.slug).length;
        trip.routeLabel = `${count} stop${count === 1 ? '' : 's'}`;
      }
    }
  } else {
    // Seed is already in final, typed shape.
    trips = seedTrips;
    entries = seedEntries;
  }

  // Newest first everywhere by default.
  entries = [...entries].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  cache = { trips, entries };
  return cache;
}

// ---------- public API ----------

export async function getTrips(): Promise<Trip[]> {
  const { trips } = await loadAll();
  // Current (ongoing) trip first, then most-recent start date.
  return [...trips].sort((a, b) => {
    if (!a.endDate && b.endDate) return -1;
    if (a.endDate && !b.endDate) return 1;
    return Date.parse(b.startDate) - Date.parse(a.startDate);
  });
}

export async function getEntries(): Promise<Entry[]> {
  return (await loadAll()).entries;
}

export async function getEntryBySlug(slug: string): Promise<Entry | undefined> {
  return (await loadAll()).entries.find((e) => e.slug === slug);
}

/** The trip with an empty endDate drives the homepage hero. */
export async function getCurrentTrip(): Promise<Trip | undefined> {
  const { trips } = await loadAll();
  return (
    trips.find((t) => !t.endDate) ??
    [...trips].sort((a, b) => Date.parse(b.startDate) - Date.parse(a.startDate))[0]
  );
}

export async function getFeaturedEntries(limit = 3): Promise<Entry[]> {
  const entries = await getEntries();
  const featured = entries.filter((e) => e.featured);
  return (featured.length ? featured : entries).slice(0, limit);
}

/** One record per visited country (deduped by region), for the world map. */
export async function getVisitedCountries(): Promise<VisitedCountry[]> {
  const trips = await getTrips(); // current/ongoing trip sorts first
  const byKey = new Map<string, VisitedCountry>();
  for (const trip of trips) {
    const key = trip.region.toLowerCase();
    const iso = REGION_ISO[key];
    if (!iso) continue; // no mapping yet → skip gracefully
    const live = !trip.endDate;
    const existing = byKey.get(key);
    if (existing) {
      existing.live = existing.live || live;
      continue;
    }
    byKey.set(key, { key, region: trip.region, color: trip.color, iso, live, marker: REGION_MARKER[key] });
  }
  return [...byKey.values()];
}

/** Images embedded in an entry body: inline images + every gallery frame. */
function countBodyImages(body: PortableBlock[]): number {
  let n = 0;
  for (const block of body) {
    if (block._type === 'gallery') n += block.images?.length ?? 0;
    else if (block._type === 'image') n += 1;
  }
  return n;
}

/**
 * Headline counts for the homepage stat ribbon — all derived from real content
 * so they stay truthful as trips/entries are published. "photos" counts every
 * image actually shown for an entry: its cover plus the inline images/gallery
 * frames in the body (the entry `gallery` field isn't rendered on the page, so
 * it's intentionally excluded).
 */
export async function getSiteStats(): Promise<SiteStats> {
  const [entries, countries] = await Promise.all([getEntries(), getVisitedCountries()]);
  const continents = new Set(
    countries.map((c) => REGION_CONTINENT[c.key]).filter(Boolean),
  ).size;
  const photos = entries.reduce(
    (n, e) => n + (e.coverImage ? 1 : 0) + countBodyImages(e.body),
    0,
  );
  return { continents, countries: countries.length, stories: entries.length, photos };
}

/** Site "chrome" images — About portrait, Journey hero background, and the two
 *  homepage hero-collage photos — from the `siteSettings` singleton. Any null
 *  field means the page keeps its existing placeholder/teal. */
export interface SiteSettings {
  portrait: TravelImage | null;
  journeyHero: TravelImage | null;
  homeHeroPrimary: TravelImage | null;
  homeHeroSecondary: TravelImage | null;
}

export async function getSiteSettings(): Promise<SiteSettings> {
  if (hasSanity && sanityClient) {
    const raw = await sanityClient.fetch<any>(SITE_SETTINGS_QUERY);
    return {
      portrait: mapImage(raw?.portrait),
      journeyHero: mapImage(raw?.journeyHero),
      homeHeroPrimary: mapImage(raw?.homeHeroPrimary),
      homeHeroSecondary: mapImage(raw?.homeHeroSecondary),
    };
  }
  return { portrait: null, journeyHero: null, homeHeroPrimary: null, homeHeroSecondary: null };
}

export async function getRelatedEntries(entry: Entry, limit = 3): Promise<Entry[]> {
  const entries = await getEntries();
  return entries.filter((e) => e.tripSlug === entry.tripSlug && e.slug !== entry.slug).slice(0, limit);
}

/** Previous (older) / next (newer) entry within the same trip, by date. */
export async function getAdjacentEntries(
  entry: Entry,
): Promise<{ prev?: Entry; next?: Entry }> {
  const entries = await getEntries();
  const inTrip = entries
    .filter((e) => e.tripSlug === entry.tripSlug)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const i = inTrip.findIndex((e) => e.slug === entry.slug);
  return { prev: i > 0 ? inTrip[i - 1] : undefined, next: i < inTrip.length - 1 ? inTrip[i + 1] : undefined };
}

// ---------- presentation helpers ----------

const dateFmt = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

/** Compact count for stat ribbons: 2147 → "2.1k", 980 → "980". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
}

/** Count + pluralized noun for inline prose: countLabel(2, 'country', 'countries') → "2 countries". */
export function countLabel(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "day N on the road" — days since a trip started (>= 1). */
export function dayNumber(startDate: string): number {
  const ms = Date.now() - Date.parse(startDate);
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}
