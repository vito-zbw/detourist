import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@sanity/client';
import type { Manifest, ManifestPhoto } from './types';
import { assertManifestComplete } from './validate';
import { buildTripDoc, buildEntryDoc } from './buildDocs';

const DRY = process.argv.includes('--dry-run');
const MANIFEST = path.resolve('scripts/import/manifest.json');

function getClient() {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET ?? 'production';
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!projectId || !token) {
    throw new Error('Set SANITY_PROJECT_ID and SANITY_WRITE_TOKEN in .env');
  }
  return createClient({ projectId, dataset, apiVersion: '2024-02-01', token, useCdn: false });
}

async function main() {
  const manifest: Manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf-8'));
  assertManifestComplete(manifest);

  const allPhotos: ManifestPhoto[] = manifest.entries.flatMap((e) => e.photos);
  const uniqueByUuid = new Map(allPhotos.map((p) => [p.uuid, p]));

  const assetIdByUuid: Record<string, string> = {};

  if (DRY) {
    for (const uuid of uniqueByUuid.keys()) assetIdByUuid[uuid] = `image-DRYRUN-${uuid}`;
    const tripDocs = manifest.trips.map((t) => buildTripDoc(t, assetIdByUuid[t.coverPhoto]));
    const entryDocs = manifest.entries.map((e) => buildEntryDoc(e, assetIdByUuid));
    console.log(`DRY RUN: would upload ${uniqueByUuid.size} assets, create ${tripDocs.length} trips + ${entryDocs.length} entries.`);
    console.log('Sample entry:', JSON.stringify(entryDocs[0], null, 2));
    return;
  }

  const client = getClient();
  const count = await client.fetch<number>('count(*)');
  console.log(`Connected to Sanity (existing documents: ${count}). Resolving assets…`);

  // Reuse assets already uploaded (Sanity stores our `${uuid}.jpg` as
  // originalFilename) so re-runs don't re-transfer 127 files.
  const existing = await client.fetch<{ _id: string; originalFilename: string | null }[]>(
    '*[_type=="sanity.imageAsset"]{_id, originalFilename}',
  );
  const idByFilename = new Map(existing.filter((a) => a.originalFilename).map((a) => [a.originalFilename as string, a._id]));

  let uploaded = 0;
  let reused = 0;
  for (const [uuid, photo] of uniqueByUuid) {
    const filename = `${uuid}.jpg`;
    const known = idByFilename.get(filename);
    if (known) {
      assetIdByUuid[uuid] = known;
      reused++;
      continue;
    }
    const asset = await client.assets.upload('image', fs.createReadStream(path.resolve(photo.jpg)), { filename });
    assetIdByUuid[uuid] = asset._id;
    if (++uploaded % 10 === 0) console.log(`  uploaded ${uploaded}…`);
  }
  console.log(`Assets: ${reused} reused, ${uploaded} uploaded. Writing documents…`);

  const tx = client.transaction();
  for (const t of manifest.trips) tx.createOrReplace(buildTripDoc(t, assetIdByUuid[t.coverPhoto]));
  for (const e of manifest.entries) tx.createOrReplace(buildEntryDoc(e, assetIdByUuid));
  await tx.commit();

  console.log(`Done: ${manifest.trips.length} trips + ${manifest.entries.length} entries written.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
