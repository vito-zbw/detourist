import { slugify } from './text';
import type { ManifestEntry, ManifestTrip } from './types';

export interface ImageField {
  _type: 'image';
  asset: { _type: 'reference'; _ref: string };
  alt: string;
}
export interface ImageMember extends ImageField { _key: string; }

export function buildImage(assetId: string, alt: string): ImageField {
  return { _type: 'image', asset: { _type: 'reference', _ref: assetId }, alt };
}

export function buildPortableText(paragraphs: string[], keyPrefix: string) {
  return paragraphs.map((text, i) => ({
    _type: 'block' as const,
    _key: `${keyPrefix}-b${i}`,
    style: 'normal' as const,
    markDefs: [],
    children: [{ _type: 'span' as const, _key: `${keyPrefix}-b${i}-s0`, text, marks: [] }],
  }));
}

export function buildTripDoc(trip: ManifestTrip, coverAssetId: string) {
  return {
    _id: trip._id,
    _type: 'trip' as const,
    name: trip.name,
    slug: { _type: 'slug' as const, current: slugify(trip.name) },
    region: trip.region,
    startDate: trip.startDate,
    endDate: trip.endDate,
    summary: trip.summary,
    coverImage: buildImage(coverAssetId, trip.coverAlt),
  };
}

export function buildEntryDoc(entry: ManifestEntry, assetIdByUuid: Record<string, string>) {
  const ref = (uuid: string) => {
    const id = assetIdByUuid[uuid];
    if (!id) throw new Error(`No uploaded asset for photo ${uuid} (entry ${entry._id})`);
    return id;
  };
  const [cover, ...rest] = entry.photos;
  const gallery: ImageMember[] = rest.map((p, i) => ({
    _key: `${entry._id}-g${i}`,
    ...buildImage(ref(p.uuid), p.alt),
  }));

  return {
    _id: entry._id,
    _type: 'entry' as const,
    title: entry.title,
    slug: { _type: 'slug' as const, current: entry.slug.trim() || slugify(entry.title) },
    trip: { _type: 'reference' as const, _ref: entry.tripId },
    date: entry.date,
    location: {
      name: entry.location.name,
      geopoint: { _type: 'geopoint' as const, lat: entry.location.lat, lng: entry.location.lng },
    },
    coverImage: buildImage(ref(cover.uuid), cover.alt),
    gallery,
    body: buildPortableText(entry.body, entry._id),
    excerpt: entry.excerpt,
    featured: entry.featured,
  };
}
