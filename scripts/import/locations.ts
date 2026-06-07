import type { TripId, GeoLocation } from './types';

const KUALA_LUMPUR: GeoLocation = { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 };
const LANGKAWI: GeoLocation = { name: 'Langkawi', lat: 6.35, lng: 99.8 };
const SINGAPORE: GeoLocation = { name: 'Singapore', lat: 1.3521, lng: 103.8198 };

/** Trip boundary: May 10–16 Malaysia, May 17–27 Singapore. */
export function tripIdForDate(date: string): TripId {
  return date <= '2024-05-16' ? 'trip.malaysia' : 'trip.singapore';
}

/** City-level location: KL (days 1–4), Langkawi (5–7), Singapore (8–18). */
export function locationForDate(date: string): GeoLocation {
  if (date <= '2024-05-13') return { ...KUALA_LUMPUR };
  if (date <= '2024-05-16') return { ...LANGKAWI };
  return { ...SINGAPORE };
}
