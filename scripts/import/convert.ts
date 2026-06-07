import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import type { Manifest } from './types';

const MANIFEST = path.resolve('scripts/import/manifest.json');
const RESOURCES = path.resolve('AppleJournalEntries/Resources');
const OUT_DIR = path.resolve('scripts/import/.cache/jpg');

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));

  const photos = manifest.entries.flatMap((e) => e.photos);
  let converted = 0;
  let skipped = 0;

  for (const photo of photos) {
    const src = path.join(RESOURCES, photo.resourceFile);
    const out = path.join(OUT_DIR, `${photo.uuid}.jpg`);
    if (!fs.existsSync(src)) {
      throw new Error(`Missing resource file: ${src}`);
    }
    if (fs.existsSync(out)) { skipped++; continue; }
    // sips: transcode to jpeg, downscale longest edge to <=2500px
    execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '2500', src, '--out', out], {
      stdio: 'ignore',
    });
    converted++;
  }

  console.log(`Converted ${converted}, skipped ${skipped} (already present). Total ${photos.length}.`);
}

main();
