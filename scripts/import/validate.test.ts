import { describe, it, expect } from 'vitest';
import { assertManifestComplete } from './validate';
import type { Manifest } from './types';

function completeManifest(): Manifest {
  return {
    trips: [
      { _id: 'trip.malaysia', name: 'Malaysia', region: 'Malaysia', startDate: '2024-05-10', endDate: '2024-05-16', summary: 's', coverPhoto: 'AAA', coverAlt: 'a' },
      { _id: 'trip.singapore', name: 'Singapore', region: 'Singapore', startDate: '2024-05-17', endDate: '2024-05-27', summary: 's', coverPhoto: 'BBB', coverAlt: 'a' },
    ],
    entries: [
      { _id: 'entry.2024-05-10', tripId: 'trip.malaysia', date: '2024-05-10T12:00:00Z', title: 'T1', slug: 't1', excerpt: 'e', featured: true, location: { name: 'Kuala Lumpur', lat: 3.1, lng: 101.7 }, body: ['p'], photos: [{ uuid: 'AAA', resourceFile: 'AAA.HEIC', jpg: 'x.jpg', alt: 'alt' }] },
      { _id: 'entry.2024-05-17', tripId: 'trip.singapore', date: '2024-05-17T12:00:00Z', title: 'T2', slug: 't2', excerpt: 'e', featured: true, location: { name: 'Singapore', lat: 1.3, lng: 103.8 }, body: ['p'], photos: [{ uuid: 'BBB', resourceFile: 'BBB.HEIC', jpg: 'y.jpg', alt: 'alt' }] },
    ],
  };
}

describe('assertManifestComplete', () => {
  it('passes on a complete manifest', () => {
    expect(() => assertManifestComplete(completeManifest())).not.toThrow();
  });
  it('throws when a photo has empty alt', () => {
    const m = completeManifest();
    m.entries[0].photos[0].alt = '';
    expect(() => assertManifestComplete(m)).toThrow(/alt/i);
  });
  it('throws when an entry title is empty', () => {
    const m = completeManifest();
    m.entries[0].title = '';
    expect(() => assertManifestComplete(m)).toThrow(/title/i);
  });
  it('throws when a trip has no featured entry', () => {
    const m = completeManifest();
    m.entries[0].featured = false; // malaysia now has zero featured
    expect(() => assertManifestComplete(m)).toThrow(/featured/i);
  });
  it('throws on duplicate slugs', () => {
    const m = completeManifest();
    m.entries[1].slug = 't1';
    expect(() => assertManifestComplete(m)).toThrow(/slug/i);
  });
});
