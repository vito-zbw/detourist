import fs from 'node:fs';
import path from 'node:path';
import type { Manifest } from './types';

export function assertManifestComplete(m: Manifest): void {
  const errs: string[] = [];

  for (const t of m.trips) {
    for (const f of ['name', 'region', 'startDate', 'endDate', 'summary', 'coverPhoto', 'coverAlt'] as const) {
      if (!String(t[f] ?? '').trim()) errs.push(`trip ${t._id}: empty ${f}`);
    }
  }

  const slugs = new Set<string>();
  for (const e of m.entries) {
    if (!e.title.trim()) errs.push(`entry ${e._id}: empty title`);
    if (!e.slug.trim()) errs.push(`entry ${e._id}: empty slug`);
    if (slugs.has(e.slug)) errs.push(`entry ${e._id}: duplicate slug "${e.slug}"`);
    slugs.add(e.slug);
    if (!e.excerpt.trim()) errs.push(`entry ${e._id}: empty excerpt`);
    if (!e.body.length) errs.push(`entry ${e._id}: empty body`);
    if (!e.photos.length) errs.push(`entry ${e._id}: no photos`);
    for (const p of e.photos) {
      if (!p.alt.trim()) errs.push(`entry ${e._id}: photo ${p.uuid} has empty alt`);
    }
  }

  // every trip must have at least one featured entry (pre-feature ~2/trip)
  for (const t of m.trips) {
    const featured = m.entries.filter((e) => e.tripId === t._id && e.featured).length;
    if (featured < 1) errs.push(`trip ${t._id}: no featured entry`);
  }

  // every trip coverPhoto must be a photo uuid that exists within that trip
  for (const t of m.trips) {
    const uuids = new Set(m.entries.filter((e) => e.tripId === t._id).flatMap((e) => e.photos.map((p) => p.uuid)));
    if (t.coverPhoto && !uuids.has(t.coverPhoto)) errs.push(`trip ${t._id}: coverPhoto ${t.coverPhoto} not found in its entries`);
  }

  if (errs.length) throw new Error(`Manifest incomplete:\n - ${errs.join('\n - ')}`);
}

// CLI entry: `npm run import:validate`
if (process.argv[1] && process.argv[1].endsWith('validate.ts')) {
  const file = path.resolve('scripts/import/manifest.json');
  const m: Manifest = JSON.parse(fs.readFileSync(file, 'utf-8'));
  assertManifestComplete(m);
  console.log(`Manifest OK: ${m.trips.length} trips, ${m.entries.length} entries.`);
}
