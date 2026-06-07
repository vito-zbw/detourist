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

/** An inline Portable Text photo gallery — the only gallery surface the entry
 *  template renders (via PortableText → Gallery → Polaroid). The top-level
 *  `gallery` field is NOT rendered, so the day's photos live here instead. */
export function buildGalleryBlock(
  photos: { uuid: string; alt: string }[],
  keyPrefix: string,
  ref: (uuid: string) => string,
) {
  return {
    _type: 'gallery' as const,
    _key: `${keyPrefix}-gallery`,
    images: photos.map((p, i) => ({
      _key: `${keyPrefix}-gi${i}`,
      _type: 'image' as const,
      asset: { _type: 'reference' as const, _ref: ref(p.uuid) },
      alt: p.alt,
    })),
  };
}

export function buildEntryDoc(entry: ManifestEntry, assetIdByUuid: Record<string, string>) {
  const ref = (uuid: string) => {
    const id = assetIdByUuid[uuid];
    if (!id) throw new Error(`No uploaded asset for photo ${uuid} (entry ${entry._id})`);
    return id;
  };
  const [cover, ...rest] = entry.photos;

  // Narrative text, then an inline gallery of the day's remaining photos.
  const body: any[] = buildPortableText(entry.body, entry._id);
  if (rest.length) body.push(buildGalleryBlock(rest, entry._id, ref));

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
    gallery: [] as ImageMember[], // top-level field is not rendered by the template
    body,
    excerpt: entry.excerpt,
    featured: entry.featured,
  };
}
