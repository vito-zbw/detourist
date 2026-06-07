import fs from 'node:fs';
import path from 'node:path';
import { parseEntryHtml } from './parseEntry';
import { tripIdForDate, locationForDate } from './locations';
import type { Manifest, ManifestEntry, ManifestPhoto } from './types';

const ROOT = path.resolve('AppleJournalEntries');
const ENTRIES_DIR = path.join(ROOT, 'Entries');
const OUT = path.resolve('scripts/import/manifest.json');

function uuidOf(resourceFile: string): string {
  return resourceFile.replace(/\.[^.]+$/, '');
}

function buildEntry(file: string): ManifestEntry {
  const date = path.basename(file, '.html'); // "2024-05-10"
  const html = fs.readFileSync(path.join(ENTRIES_DIR, file), 'utf-8');
  const { photoFiles, paragraphs } = parseEntryHtml(html);

  const photos: ManifestPhoto[] = photoFiles.map((resourceFile) => {
    const uuid = uuidOf(resourceFile);
    return { uuid, resourceFile, jpg: `scripts/import/.cache/jpg/${uuid}.jpg`, alt: '' };
  });

  return {
    _id: `entry.${date}`,
    tripId: tripIdForDate(date),
    date: `${date}T12:00:00Z`,
    title: '',
    slug: '',
    excerpt: '',
    featured: false,
    location: locationForDate(date),
    body: paragraphs,
    photos,
  };
}

function main(): void {
  const files = fs
    .readdirSync(ENTRIES_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.html$/.test(f))
    .sort();

  const entries = files.map(buildEntry);

  const manifest: Manifest = {
    trips: [
      {
        _id: 'trip.malaysia', name: 'Malaysia', region: 'Malaysia',
        startDate: '2024-05-10', endDate: '2024-05-16',
        summary: '', coverPhoto: '', coverAlt: '',
      },
      {
        _id: 'trip.singapore', name: 'Singapore', region: 'Singapore',
        startDate: '2024-05-17', endDate: '2024-05-27',
        summary: '', coverPhoto: '', coverAlt: '',
      },
    ],
    entries,
  };

  fs.writeFileSync(OUT, JSON.stringify(manifest, null, 2));
  const photoCount = entries.reduce((n, e) => n + e.photos.length, 0);
  console.log(`Wrote ${OUT}: ${entries.length} entries, ${photoCount} photos.`);
}

main();
