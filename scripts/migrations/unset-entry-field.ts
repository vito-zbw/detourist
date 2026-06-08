import 'dotenv/config';
import { createClient } from '@sanity/client';

// Removing a field from the entry schema does NOT remove it from stored
// documents — the Studio then flags "Unknown field found". This migration
// unsets an orphaned field path on every entry that still carries it.
// Idempotent: re-running once the path is gone is a no-op.
//
//   npx tsx scripts/migrations/unset-entry-field.ts <path> --dry-run   # preview
//   npx tsx scripts/migrations/unset-entry-field.ts <path>             # apply
//
// Examples (paths we've cleaned up): `location.geopoint`, `gallery`.
// The path targets the document root, so e.g. `gallery` unsets only the
// top-level field — never the inline `body[]` blocks that share the name.

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const field = args.find((a) => !a.startsWith('--'));

if (!field) {
  console.error('Usage: unset-entry-field.ts <field-path> [--dry-run]');
  process.exit(1);
}
// Guard the value we interpolate into GROQ to a plain dotted path.
if (!/^[a-zA-Z_][\w.]*$/.test(field)) {
  console.error(`Refusing unsafe field path: ${field}`);
  process.exit(1);
}

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

  const ids = await client.fetch<string[]>(`*[_type == "entry" && defined(${field})]._id`);

  if (ids.length === 0) {
    console.log(`No entries carry ${field} — nothing to do.`);
    return;
  }

  console.log(`${ids.length} document(s) still carry ${field}:`);
  for (const id of ids) console.log(`  ${id}`);

  if (DRY) {
    console.log(`\nDRY RUN: would unset ${field} on the above. Re-run without --dry-run to apply.`);
    return;
  }

  let tx = client.transaction();
  for (const id of ids) tx = tx.patch(id, { unset: [field] });
  await tx.commit();

  console.log(`\nDone: unset ${field} on ${ids.length} document(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
