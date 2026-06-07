// Applies per-entry AI enrichment (scripts/import/.cache/enrich/*.json) onto the
// manifest, then sets cross-cutting fields: featured picks (~2/trip), trip
// summaries, and trip cover photos. Deterministic and re-runnable.
import fs from 'node:fs';
import path from 'node:path';
import { slugify } from './text';
import type { Manifest } from './types';

const MANIFEST = path.resolve('scripts/import/manifest.json');
// Durable AI enrichment outputs (tracked in git; the manifest + jpg cache are
// reproducible from these + the source export).
const ENRICH_DIR = path.resolve('scripts/import/enrichment');

interface EnrichFile {
  _id: string;
  title: string;
  excerpt: string;
  photos: { uuid: string; alt: string }[];
}

// ~2 standout days per trip → featured on the homepage.
const FEATURED = new Set([
  'entry.2024-05-11', // Twin Towers
  'entry.2024-05-15', // Langkawi cable cars + waterfalls
  'entry.2024-05-17', // Gardens by the Bay / Supertrees
  'entry.2024-05-26', // Universal Studios / Sentosa
]);

// Hero entry whose first photo becomes the trip cover.
const TRIP_COVER_ENTRY: Record<string, string> = {
  'trip.malaysia': 'entry.2024-05-11',
  'trip.singapore': 'entry.2024-05-17',
};

const TRIP_SUMMARY: Record<string, string> = {
  'trip.malaysia':
    "A week of firsts in Malaysia — Kuala Lumpur's twin towers, mosques and chaotic night markets, then Langkawi's beaches, cable cars and island-hopping. My first solo trip abroad, and the start of a lot of conversations with strangers.",
  'trip.singapore':
    'Eleven days eating my way across Singapore — Gardens by the Bay and the glowing Supertrees, the Mandai zoos, university campuses, Sentosa theme parks, and a teary goodbye on the tarmac at Changi.',
};

function main(): void {
  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  const byId = new Map(manifest.entries.map((e) => [e._id, e]));

  // 1. Apply per-entry enrichment.
  for (const file of fs.readdirSync(ENRICH_DIR).filter((f) => f.endsWith('.json'))) {
    const enrich: EnrichFile = JSON.parse(fs.readFileSync(path.join(ENRICH_DIR, file), 'utf-8'));
    const entry = byId.get(enrich._id);
    if (!entry) throw new Error(`Enrich file ${file} references unknown entry ${enrich._id}`);

    entry.title = enrich.title.trim();
    entry.excerpt = enrich.excerpt.trim();
    entry.slug = slugify(entry.title);
    entry.featured = FEATURED.has(entry._id);

    const altByUuid = new Map(enrich.photos.map((p) => [p.uuid, p.alt.trim()]));
    for (const photo of entry.photos) {
      const alt = altByUuid.get(photo.uuid);
      if (!alt) throw new Error(`Missing alt for photo ${photo.uuid} in ${enrich._id}`);
      photo.alt = alt;
    }
  }

  // 2. Trip-level fields.
  for (const trip of manifest.trips) {
    trip.summary = TRIP_SUMMARY[trip._id] ?? trip.summary;
    const heroId = TRIP_COVER_ENTRY[trip._id];
    const hero = byId.get(heroId);
    if (!hero || !hero.photos.length) throw new Error(`No cover hero for ${trip._id}`);
    trip.coverPhoto = hero.photos[0].uuid;
    trip.coverAlt = hero.photos[0].alt;
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  const featured = manifest.entries.filter((e) => e.featured).map((e) => e._id);
  console.log(`Applied enrichment to ${manifest.entries.length} entries.`);
  console.log(`Featured (${featured.length}): ${featured.join(', ')}`);
}

main();
