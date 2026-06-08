import 'dotenv/config';
import { createClient } from '@sanity/client';

// One-off migration: `entry.location.geopoint` was removed from the schema
// (entries only carry a place name now), but the field still lives in stored
// documents — so the Studio shows "Unknown field found". This unsets that
// orphaned path on every entry that still has it. Idempotent: re-running once
// the field is gone is a no-op.
//
//   npx tsx scripts/migrations/drop-entry-geopoint.ts --dry-run   # preview
//   npx tsx scripts/migrations/drop-entry-geopoint.ts             # apply

const DRY = process.argv.includes('--dry-run');

function getClient() {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET ?? 'production';
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!projectId || !token) {
    throw new Error('Set SANITY_PROJECT_ID and SANITY_WRITE_TOKEN in .env');
  }
  // perspective:'raw' so unpublished drafts (drafts.* ids) are included — they
  // carry their own copy of the orphaned field and would otherwise be missed.
  return createClient({ projectId, dataset, apiVersion: '2024-02-01', token, useCdn: false, perspective: 'raw' });
}

async function main() {
  const client = getClient();

  const ids = await client.fetch<string[]>('*[_type == "entry" && defined(location.geopoint)]._id');

  if (ids.length === 0) {
    console.log('No entries carry location.geopoint — nothing to do.');
    return;
  }

  console.log(`${ids.length} document(s) still carry location.geopoint:`);
  for (const id of ids) console.log(`  ${id}`);

  if (DRY) {
    console.log('\nDRY RUN: would unset location.geopoint on the above. Re-run without --dry-run to apply.');
    return;
  }

  let tx = client.transaction();
  for (const id of ids) tx = tx.patch(id, { unset: ['location.geopoint'] });
  await tx.commit();

  console.log(`\nDone: unset location.geopoint on ${ids.length} document(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
