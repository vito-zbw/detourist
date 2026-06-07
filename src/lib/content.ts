// ============================================================
// Content access layer — the ONE place that knows whether content
// comes from Sanity or the bundled seed. Pages/components only ever
// call the exported helpers below.
// ============================================================
import { hasSanity, sanityClient } from './sanity';
import { TRIPS_QUERY, ENTRIES_QUERY } from './queries';
import { seedTrips, seedEntries } from './seed';
import type {
  Trip,
  Entry,
  TripColor,
  SlotTint,
  GalleryImage,
  PortableBlock,
  TravelImage,
} from './types';

const REGION_COLOR: Record<string, TripColor> = {
  malaysia: 'magenta',
  singapore: 'teal',
  canada: 'coral',
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
  const days = Math.max(1, Math.round(ms / 86_400_000));
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

/** Entries that have a geopoint, oldest-first so the route line draws in order. */
export async function getMapEntries(): Promise<Entry[]> {
  const entries = await getEntries();
  return entries
    .filter((e) => e.location)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
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

/** "day N on the road" — days since a trip started (>= 1). */
export function dayNumber(startDate: string): number {
  const ms = Date.now() - Date.parse(startDate);
  return Math.max(1, Math.floor(ms / 86_400_000) + 1);
}
