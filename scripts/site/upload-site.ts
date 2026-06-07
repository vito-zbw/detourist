import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClient } from '@sanity/client';

// Uploads the site-chrome images listed in scripts/site/site-images.json to
// Sanity and sets them on the `siteSettings` singleton. HEIC inputs are
// transcoded to JPEG via macOS `sips`. Fields not listed are left untouched
// (merged onto the existing doc), so partial updates are safe.
const CONFIG = path.resolve('scripts/site/site-images.json');
const CACHE = path.resolve('scripts/site/.cache');

interface ImgSpec {
  src: string;
  alt: string;
}
type Config = Record<string, ImgSpec>;

function getClient() {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET ?? 'production';
  const token = process.env.SANITY_WRITE_TOKEN;
  if (!projectId || !token) throw new Error('Set SANITY_PROJECT_ID and SANITY_WRITE_TOKEN in .env');
  return createClient({ projectId, dataset, apiVersion: '2024-02-01', token, useCdn: false });
}

/** Resolve ~ and produce a web-safe JPEG (transcoding HEIC/PNG via sips). */
function toJpeg(src: string, key: string): string {
  const resolved = src.startsWith('~') ? path.join(process.env.HOME ?? '', src.slice(1)) : path.resolve(src);
  if (!fs.existsSync(resolved)) throw new Error(`File not found: ${resolved}`);
  if (/\.jpe?g$/i.test(resolved)) return resolved;
  fs.mkdirSync(CACHE, { recursive: true });
  const out = path.join(CACHE, `${key}.jpg`);
  execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', '2600', resolved, '--out', out], { stdio: 'ignore' });
  return out;
}

async function main() {
  const config: Config = JSON.parse(fs.readFileSync(CONFIG, 'utf-8'));
  const client = getClient();

  const existing = (await client.fetch<any>('*[_id=="siteSettings"][0]')) ?? {};
  const { _rev, _createdAt, _updatedAt, ...rest } = existing;
  const doc: any = { ...rest, _id: 'siteSettings', _type: 'siteSettings' };

  for (const [field, spec] of Object.entries(config)) {
    const jpg = toJpeg(spec.src, field);
    const asset = await client.assets.upload('image', fs.createReadStream(jpg), { filename: `${field}.jpg` });
    doc[field] = { _type: 'image', asset: { _type: 'reference', _ref: asset._id }, alt: spec.alt };
    console.log(`  ${field}: ${path.basename(jpg)} → ${asset._id}`);
  }

  await client.createOrReplace(doc);
  console.log(`siteSettings updated: ${Object.keys(config).join(', ')}.`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
