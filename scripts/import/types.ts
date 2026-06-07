export type TripId = 'trip.malaysia' | 'trip.singapore';

export interface GeoLocation {
  name: string;   // city name, e.g. "Kuala Lumpur"
  lat: number;
  lng: number;
}

export interface ManifestPhoto {
  uuid: string;          // resource filename without extension
  resourceFile: string;  // e.g. "41F686B2-….HEIC" (basename under Resources/)
  jpg: string;           // relative path to converted JPEG (filled by convert.ts)
  alt: string;           // AI-filled during enrichment
}

export interface ManifestEntry {
  _id: string;           // e.g. "entry.2024-05-10"
  tripId: TripId;
  date: string;          // ISO datetime, e.g. "2024-05-10T12:00:00Z"
  title: string;         // AI-filled
  slug: string;          // AI-filled (or derived from title at build time)
  excerpt: string;       // AI-filled
  featured: boolean;
  location: GeoLocation;
  body: string[];        // cleaned paragraphs (DAY N marker already dropped)
  photos: ManifestPhoto[]; // photos[0] → coverImage, rest → gallery
}

export interface ManifestTrip {
  _id: TripId;
  name: string;
  region: string;
  startDate: string;     // ISO date
  endDate: string;       // ISO date
  summary: string;       // AI-filled
  coverPhoto: string;    // AI-filled: a photo uuid belonging to this trip
  coverAlt: string;      // AI-filled
}

export interface Manifest {
  trips: ManifestTrip[];
  entries: ManifestEntry[];
}
