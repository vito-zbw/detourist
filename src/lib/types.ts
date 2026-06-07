// ============================================================
// Content types — shared shape for BOTH the Sanity source and the
// bundled seed fallback. Mirrors the CLAUDE.md content model (trip /
// entry) plus a few presentation-only fields the design needs.
// ============================================================

/** Palette accent assigned per trip (drives chips, pins, bars). */
export type TripColor = 'magenta' | 'teal' | 'coral' | 'gold';

/** Placeholder slot tints (used only while an image has no real asset). */
export type SlotTint = 'coral' | 'teal' | 'gold' | 'magenta' | 'sky';

export type TapeColor = 'gold' | 'teal' | 'coral' | 'magenta';
export type PinColor = 'gold' | 'teal' | 'coral' | 'magenta';

/**
 * A Sanity image asset reference (what `urlFor` consumes). Kept loose so the
 * seed can pass `null` for "no image yet → render the labeled placeholder".
 */
export type SanityImageSource =
  | { _type?: string; asset?: { _ref?: string; _id?: string }; hotspot?: unknown; crop?: unknown }
  | string;

/**
 * A travel photo. In production `asset` comes from Sanity; in the seed it is
 * `null` and the design's labeled "drop-in" placeholder slot is rendered.
 * `alt` is always required (CLAUDE.md: every image must have alt text).
 */
export interface TravelImage {
  asset: SanityImageSource | null;
  alt: string;
  /** Caption shown inside the placeholder slot while `asset` is null. */
  label?: string;
  /** Placeholder tint while `asset` is null. */
  tint?: SlotTint;
}

/** One frame in an inline photo gallery (a tilted, taped/pinned polaroid). */
export interface GalleryImage extends TravelImage {
  /** Optional handwritten caption under the polaroid. */
  caption?: string;
  /** Scrapbook accents — auto-assigned by index when omitted. */
  tilt?: 'l' | 'r' | 'l2' | 'r2';
  tape?: TapeColor;
  pin?: PinColor;
}

// ---------- Portable Text (entry body) ----------

export interface Span {
  _type: 'span';
  text: string;
  marks?: string[];
}

export interface LinkMark {
  _key: string;
  _type: 'link';
  href: string;
}

export type PortableBlock =
  | {
      _type: 'block';
      style?: 'normal' | 'h2' | 'blockquote';
      listItem?: 'bullet';
      children: Span[];
      markDefs?: LinkMark[];
    }
  | { _type: 'pullQuote'; text: string }
  | { _type: 'tip'; heading: string; text: string }
  | { _type: 'gallery'; heading?: string; note?: string; images: GalleryImage[] }
  | { _type: 'image'; asset: SanityImageSource | null; alt: string; label?: string; tint?: SlotTint };

// ---------- Documents ----------

export interface Trip {
  _id: string;
  name: string;
  slug: string;
  region: string;
  startDate: string; // ISO date
  endDate: string | null; // null => ongoing (the "current" trip)
  coverImage: TravelImage | null;
  summary: string;
  color: TripColor;
  /** "3 weeks", "5 days", "ongoing" — short flavour for cards. */
  duration?: string;
  /** "9 stops · Penang → Cameron Highlands" — card meta line. */
  routeLabel?: string;
}

export interface Entry {
  _id: string;
  title: string;
  slug: string;
  tripSlug: string;
  tripName: string;
  tripColor: TripColor;
  /** lowercased trip key for the journey filter: malaysia | singapore | canada */
  tripKey: string;
  date: string; // ISO datetime
  location: { name: string; lat: number; lng: number } | null;
  coverImage: TravelImage | null;
  /** Tint for the card/cover placeholder slot. */
  coverTint: SlotTint;
  gallery: GalleryImage[];
  body: PortableBlock[];
  excerpt: string;
  featured: boolean;
  readMins: number;
}

/** Headline counts for the homepage stat ribbon, all derived from real content. */
export interface SiteStats {
  /** Distinct continents visited. */
  continents: number;
  /** Distinct visited countries. */
  countries: number;
  /** Total entries written. */
  stories: number;
  /** Total images shown across all entries (cover + body galleries/images). */
  photos: number;
}

/**
 * One visited country, derived from a trip's `region` — drives the world map.
 * `iso` is the ISO 3166-1 *numeric* code as a string (matches world-atlas ids).
 */
export interface VisitedCountry {
  /** lowercased region, matches the filter tab data-trip + map data-key: malaysia | singapore | canada */
  key: string;
  region: string; // "Canada"
  color: TripColor; // 'coral'
  iso: string; // "124"
  live: boolean; // region's trip has an empty endDate
  /** [lng, lat] for a locator ring when the polygon is missing/too small (e.g. Singapore). */
  marker?: [number, number];
}
