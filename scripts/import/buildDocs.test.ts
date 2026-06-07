import { describe, it, expect } from 'vitest';
import { buildImage, buildPortableText, buildTripDoc, buildEntryDoc } from './buildDocs';
import type { ManifestEntry, ManifestTrip } from './types';

describe('buildImage', () => {
  it('builds an image field with asset reference + alt', () => {
    expect(buildImage('image-abc', 'a cat')).toEqual({
      _type: 'image',
      asset: { _type: 'reference', _ref: 'image-abc' },
      alt: 'a cat',
    });
  });
});

describe('buildPortableText', () => {
  it('builds one normal block per paragraph with stable keys', () => {
    const blocks = buildPortableText(['hello', 'world'], 'entry.x');
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ _type: 'block', style: 'normal', _key: 'entry.x-b0' });
    expect(blocks[0].children[0]).toMatchObject({ _type: 'span', text: 'hello', _key: 'entry.x-b0-s0' });
  });
});

const entry: ManifestEntry = {
  _id: 'entry.2024-05-10', tripId: 'trip.malaysia', date: '2024-05-10T12:00:00Z',
  title: 'Day 1 · Arrival', slug: 'day-1-arrival', excerpt: 'Landed.', featured: true,
  location: { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 },
  body: ['First.'],
  photos: [
    { uuid: 'AAA', resourceFile: 'AAA.HEIC', jpg: 'a.jpg', alt: 'cover alt' },
    { uuid: 'BBB', resourceFile: 'BBB.HEIC', jpg: 'b.jpg', alt: 'gallery alt' },
  ],
};

describe('buildEntryDoc', () => {
  const doc = buildEntryDoc(entry, { AAA: 'image-aaa', BBB: 'image-bbb' });
  it('sets id, type, slug, trip reference, datetime', () => {
    expect(doc._id).toBe('entry.2024-05-10');
    expect(doc._type).toBe('entry');
    expect(doc.slug).toEqual({ _type: 'slug', current: 'day-1-arrival' });
    expect(doc.trip).toEqual({ _type: 'reference', _ref: 'trip.malaysia' });
    expect(doc.date).toBe('2024-05-10T12:00:00Z');
  });
  it('uses photo[0] as cover and the rest as gallery (with _key)', () => {
    expect(doc.coverImage.asset._ref).toBe('image-aaa');
    expect(doc.gallery).toHaveLength(1);
    expect(doc.gallery[0].asset._ref).toBe('image-bbb');
    expect(doc.gallery[0]._key).toBeTruthy();
  });
  it('builds a geopoint location', () => {
    expect(doc.location).toEqual({
      name: 'Kuala Lumpur',
      geopoint: { _type: 'geopoint', lat: 3.139, lng: 101.6869 },
    });
  });
});

describe('buildTripDoc', () => {
  const trip: ManifestTrip = {
    _id: 'trip.malaysia', name: 'Malaysia', region: 'Malaysia',
    startDate: '2024-05-10', endDate: '2024-05-16', summary: 'Sum.',
    coverPhoto: 'AAA', coverAlt: 'cover alt',
  };
  it('builds trip with slug + cover image', () => {
    const doc = buildTripDoc(trip, 'image-aaa');
    expect(doc._id).toBe('trip.malaysia');
    expect(doc.slug).toEqual({ _type: 'slug', current: 'malaysia' });
    expect(doc.coverImage.asset._ref).toBe('image-aaa');
    expect(doc.coverImage.alt).toBe('cover alt');
  });
});
