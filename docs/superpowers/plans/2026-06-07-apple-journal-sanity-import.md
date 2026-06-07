# Apple Journal → Sanity Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import the author's Apple Journal export (Malaysia + Singapore, May 2024) into Sanity as `trip` + `entry` documents with uploaded image assets, so the existing Astro site renders real content.

**Architecture:** Two-stage "enrich → load" pipeline. A deterministic `parse` step scrapes the 18 HTML files into a `manifest.json` and converts HEIC→JPEG; Claude then enriches the manifest (AI titles, excerpts, vision alt text, featured picks); a deterministic `load` step uploads assets and `createOrReplace`s documents via `@sanity/client`. Pure functions are TDD'd with vitest; the upload path is verified via a `--dry-run` and a real run.

**Tech Stack:** TypeScript, `tsx` (run TS scripts), `node-html-parser` (HTML scraping), `vitest` (tests), `dotenv` (env), `@sanity/client` (already a dep), macOS `sips` (HEIC→JPEG).

**Spec:** `docs/superpowers/specs/2026-06-07-apple-journal-sanity-import-design.md`

---

## File Structure

All new code lives under `scripts/import/`. **Nothing in `src/` changes** — `src/lib/content.ts` already reads Sanity when `SANITY_PROJECT_ID` is set.

| File | Responsibility |
|---|---|
| `scripts/import/types.ts` | Manifest TypeScript interfaces (shared across all scripts) |
| `scripts/import/text.ts` | `cleanText`, `slugify` — pure string utilities |
| `scripts/import/locations.ts` | Date → trip id and date → city geopoint lookups |
| `scripts/import/parseEntry.ts` | `parseEntryHtml` — one HTML file → photos + paragraphs |
| `scripts/import/parse.ts` | Orchestrator: walk `Entries/`, build skeleton `manifest.json` |
| `scripts/import/convert.ts` | HEIC→JPEG via `sips` into `.cache/jpg/`; fills `photo.jpg` |
| `scripts/import/validate.ts` | `assertManifestComplete` — deterministic enrichment gate |
| `scripts/import/buildDocs.ts` | `buildImage`, `buildPortableText`, `buildTripDoc`, `buildEntryDoc` (pure) |
| `scripts/import/load.ts` | Upload assets + `createOrReplace` docs; `--dry-run` |
| `scripts/import/*.test.ts` | Vitest unit tests for the pure modules |
| `scripts/import/manifest.json` | Intermediate artifact (gitignored) |
| `scripts/import/.cache/jpg/` | Converted JPEGs (gitignored) |

---

### Task 0: Scaffolding & version control

**Files:**
- Modify: `package.json` (devDeps + scripts)
- Modify: `.gitignore`
- Create: `scripts/import/` (dir)

- [ ] **Step 1: Initialize git (the project is not yet a repo)**

Run:
```bash
cd /Users/baiweizhong/detourist
git rev-parse --is-inside-work-tree 2>/dev/null || git init
```
Expected: `Initialized empty Git repository …` (or, if already a repo, no-op).

- [ ] **Step 2: Install dev dependencies**

Run:
```bash
npm install -D tsx node-html-parser vitest dotenv
```
Expected: the four packages appear under `devDependencies` in `package.json`.

- [ ] **Step 3: Add npm scripts**

Edit `package.json` `"scripts"` to add (keep existing entries):
```json
    "test": "vitest run",
    "import:parse": "tsx scripts/import/parse.ts",
    "import:convert": "tsx scripts/import/convert.ts",
    "import:validate": "tsx scripts/import/validate.ts",
    "import:load:dry": "tsx scripts/import/load.ts --dry-run",
    "import:load": "tsx scripts/import/load.ts"
```

- [ ] **Step 4: Update `.gitignore`**

Append:
```gitignore

# personal journal source data — not deployed (site reads from Sanity)
AppleJournalEntries/

# import pipeline artifacts
scripts/import/.cache/
scripts/import/manifest.json
```

- [ ] **Step 5: Create the import directory**

Run:
```bash
mkdir -p scripts/import/.cache/jpg
```

- [ ] **Step 6: Verify vitest runs (no tests yet)**

Run: `npm test`
Expected: vitest reports "No test files found" (exit non-zero is fine here) — confirms the runner is installed.

- [ ] **Step 7: Initial commit**

```bash
git add -A
git commit -m "chore: scaffold journal→sanity import (deps, scripts, gitignore)"
```

---

### Task 1: Text utilities (TDD)

**Files:**
- Create: `scripts/import/text.ts`
- Test: `scripts/import/text.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/import/text.test.ts
import { describe, it, expect } from 'vitest';
import { cleanText, slugify } from './text';

describe('cleanText', () => {
  it('collapses whitespace and trims', () => {
    expect(cleanText('  hello   world\n\n ')).toBe('hello world');
  });
  it('decodes common HTML entities', () => {
    expect(cleanText('Marks &amp; Spencer &#39;food&#39;')).toBe("Marks & Spencer 'food'");
  });
  it('normalizes non-breaking spaces', () => {
    expect(cleanText('a  b')).toBe('a b');
  });
});

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Day 1 · Kuala Lumpur Arrival')).toBe('day-1-kuala-lumpur-arrival');
  });
  it('strips punctuation and collapses dashes', () => {
    expect(slugify('Twin Towers & a Lesson!!')).toBe('twin-towers-a-lesson');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/import/text.test.ts`
Expected: FAIL — `Cannot find module './text'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/import/text.ts
const ENTITIES: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&nbsp;': ' ',
};

/** Decode common HTML entities, normalize all whitespace to single spaces, trim. */
export function cleanText(raw: string): string {
  let s = raw;
  for (const [ent, ch] of Object.entries(ENTITIES)) s = s.split(ent).join(ch);
  return s.replace(/\s+/g, ' ').trim();
}

/** URL-safe slug: lowercase, non-alphanumerics → hyphens, collapse/trim hyphens. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/import/text.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add scripts/import/text.ts scripts/import/text.test.ts
git commit -m "feat(import): text cleanText + slugify utilities"
```

---

### Task 2: Manifest types

**Files:**
- Create: `scripts/import/types.ts`

No test (type-only module). It is imported by later tasks.

- [ ] **Step 1: Write the types**

```typescript
// scripts/import/types.ts
export type TripId = 'trip.malaysia' | 'trip.singapore';

export interface GeoLocation {
  name: string;   // city name, e.g. "Kuala Lumpur"
  lat: number;
  lng: number;
}

export interface ManifestPhoto {
  uuid: string;          // resource filename without extension
  resourceFile: string;  // e.g. "41F686B2-….HEIC" (basename under Resources/)
  jpg: string;           // relative path to converted JPEG (filled by convert.ts)
  alt: string;           // AI-filled during enrichment
}

export interface ManifestEntry {
  _id: string;           // e.g. "entry.2024-05-10"
  tripId: TripId;
  date: string;          // ISO datetime, e.g. "2024-05-10T12:00:00Z"
  title: string;         // AI-filled
  slug: string;          // AI-filled (or derived from title at build time)
  excerpt: string;       // AI-filled
  featured: boolean;
  location: GeoLocation;
  body: string[];        // cleaned paragraphs (DAY N marker already dropped)
  photos: ManifestPhoto[]; // photos[0] → coverImage, rest → gallery
}

export interface ManifestTrip {
  _id: TripId;
  name: string;
  region: string;
  startDate: string;     // ISO date
  endDate: string;       // ISO date
  summary: string;       // AI-filled
  coverPhoto: string;    // AI-filled: a photo uuid belonging to this trip
  coverAlt: string;      // AI-filled
}

export interface Manifest {
  trips: ManifestTrip[];
  entries: ManifestEntry[];
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/import/types.ts
git commit -m "feat(import): manifest types"
```

---

### Task 3: Date → trip + location lookups (TDD)

**Files:**
- Create: `scripts/import/locations.ts`
- Test: `scripts/import/locations.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/import/locations.test.ts
import { describe, it, expect } from 'vitest';
import { tripIdForDate, locationForDate } from './locations';

describe('tripIdForDate', () => {
  it('maps May 10–16 to Malaysia', () => {
    expect(tripIdForDate('2024-05-10')).toBe('trip.malaysia');
    expect(tripIdForDate('2024-05-16')).toBe('trip.malaysia');
  });
  it('maps May 17–27 to Singapore', () => {
    expect(tripIdForDate('2024-05-17')).toBe('trip.singapore');
    expect(tripIdForDate('2024-05-27')).toBe('trip.singapore');
  });
});

describe('locationForDate', () => {
  it('KL for days 1–4', () => {
    expect(locationForDate('2024-05-13').name).toBe('Kuala Lumpur');
  });
  it('Langkawi for days 5–7', () => {
    expect(locationForDate('2024-05-14').name).toBe('Langkawi');
  });
  it('Singapore from day 8', () => {
    expect(locationForDate('2024-05-17').name).toBe('Singapore');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/import/locations.test.ts`
Expected: FAIL — `Cannot find module './locations'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/import/locations.ts
import type { TripId, GeoLocation } from './types';

const KUALA_LUMPUR: GeoLocation = { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 };
const LANGKAWI: GeoLocation = { name: 'Langkawi', lat: 6.35, lng: 99.8 };
const SINGAPORE: GeoLocation = { name: 'Singapore', lat: 1.3521, lng: 103.8198 };

/** Trip boundary: May 10–16 Malaysia, May 17–27 Singapore. */
export function tripIdForDate(date: string): TripId {
  return date <= '2024-05-16' ? 'trip.malaysia' : 'trip.singapore';
}

/** City-level location: KL (days 1–4), Langkawi (5–7), Singapore (8–18). */
export function locationForDate(date: string): GeoLocation {
  if (date <= '2024-05-13') return { ...KUALA_LUMPUR };
  if (date <= '2024-05-16') return { ...LANGKAWI };
  return { ...SINGAPORE };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/import/locations.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add scripts/import/locations.ts scripts/import/locations.test.ts
git commit -m "feat(import): date→trip and date→city-location lookups"
```

---

### Task 4: HTML entry parser (TDD)

**Files:**
- Create: `scripts/import/parseEntry.ts`
- Test: `scripts/import/parseEntry.test.ts`

`parseEntryHtml` returns the ordered photo resource filenames and the cleaned body paragraphs (with the leading `DAY N` marker removed).

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/import/parseEntry.test.ts
import { describe, it, expect } from 'vitest';
import { parseEntryHtml } from './parseEntry';

const FIXTURE = `
<html><body>
<p class="p1"><span class="s1"><div class='pageContainer'>
  <div class="pageHeader">Friday, May 10, 2024</div>
  <div class="assetGrid">
    <div id="A" class="gridItem assetType_livePhoto"><img src="../Resources/AAA.HEIC" class="asset_image"/></div>
    <div id="B" class="gridItem assetType_photo"><img src="../Resources/BBB.jpeg" class="asset_image"/></div>
  </div><div class='title'></div><div class='bodyText'></span></p>
<p class="p2"><span class="s2">DAY 1</span></p>
<p class="p2"><span class="s2">First paragraph with Marks &amp; Spencer.</span></p>
<p class="p3"><span class="s2"></span><br></p>
<p class="p2"><span class="s2">Second paragraph.</span></p>
<p class="p1"><span class="s1"></div></div></span></p>
</body></html>`;

describe('parseEntryHtml', () => {
  const r = parseEntryHtml(FIXTURE);
  it('extracts photo resource filenames in order', () => {
    expect(r.photoFiles).toEqual(['AAA.HEIC', 'BBB.jpeg']);
  });
  it('drops the DAY N marker and keeps cleaned paragraphs', () => {
    expect(r.paragraphs).toEqual([
      'First paragraph with Marks & Spencer.',
      'Second paragraph.',
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/import/parseEntry.test.ts`
Expected: FAIL — `Cannot find module './parseEntry'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/import/parseEntry.ts
import { parse } from 'node-html-parser';
import { cleanText } from './text';

export interface ParsedEntry {
  photoFiles: string[];  // resource basenames in document order
  paragraphs: string[];  // cleaned narrative paragraphs, DAY N marker removed
}

const DAY_MARKER = /^day\s*\d+$/i;

export function parseEntryHtml(html: string): ParsedEntry {
  const root = parse(html);

  const photoFiles = root
    .querySelectorAll('.asset_image')
    .map((el) => el.getAttribute('src') ?? '')
    .filter(Boolean)
    .map((src) => src.split('/').pop() as string); // basename

  const paragraphs = root
    .querySelectorAll('.p2')
    .map((el) => cleanText(el.text))
    .filter((t) => t.length > 0)
    .filter((t, i) => !(i === 0 && DAY_MARKER.test(t)));

  return { photoFiles, paragraphs };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/import/parseEntry.test.ts`
Expected: PASS (2 assertions).

- [ ] **Step 5: Commit**

```bash
git add scripts/import/parseEntry.ts scripts/import/parseEntry.test.ts
git commit -m "feat(import): HTML entry parser (photos + cleaned paragraphs)"
```

---

### Task 5: Parse orchestrator → skeleton manifest

**Files:**
- Create: `scripts/import/parse.ts`

This walks `AppleJournalEntries/Entries/*.html`, builds the skeleton manifest (AI fields left empty), and writes `manifest.json`. Verified by running it on the real data (18 entries, 127 photos).

- [ ] **Step 1: Write the orchestrator**

```typescript
// scripts/import/parse.ts
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
```

- [ ] **Step 2: Run on the real data**

Run: `npm run import:parse`
Expected: `Wrote …/manifest.json: 18 entries, 127 photos.`

- [ ] **Step 3: Spot-check the manifest**

Run: `node -e "const m=require('./scripts/import/manifest.json'); console.log(m.entries[0]._id, m.entries[0].tripId, m.entries[0].photos.length, '|', m.entries[7]._id, m.entries[7].tripId)"`
Expected: `entry.2024-05-10 trip.malaysia 5 | entry.2024-05-17 trip.singapore` (day 8 is the first Singapore entry).

- [ ] **Step 4: Commit**

```bash
git add scripts/import/parse.ts
git commit -m "feat(import): parse orchestrator → skeleton manifest.json"
```

---

### Task 6: HEIC → JPEG conversion

**Files:**
- Create: `scripts/import/convert.ts`

Converts every photo referenced by the manifest to a web-safe JPEG via `sips`, capped at 2500px long edge. Idempotent: skips files already converted.

- [ ] **Step 1: Write the converter**

```typescript
// scripts/import/convert.ts
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
```

- [ ] **Step 2: Run conversion on the real data**

Run: `npm run import:convert`
Expected: `Converted 127, skipped 0 … Total 127.` (a second run reports `Converted 0, skipped 127`).

- [ ] **Step 3: Verify a JPEG opens and has sane dimensions**

Run: `sips -g pixelWidth -g pixelHeight "$(ls scripts/import/.cache/jpg/*.jpg | head -1)"`
Expected: prints `pixelWidth`/`pixelHeight`, neither exceeding 2500.

- [ ] **Step 4: Commit**

```bash
git add scripts/import/convert.ts
git commit -m "feat(import): HEIC→JPEG conversion via sips"
```

---

### Task 7: Manifest completeness gate (TDD)

**Files:**
- Create: `scripts/import/validate.ts`
- Test: `scripts/import/validate.test.ts`

`assertManifestComplete` throws on any missing required field. It is the deterministic gate that makes the AI enrichment (Task 8) reviewable, and it runs again inside `load.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/import/validate.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/import/validate.test.ts`
Expected: FAIL — `Cannot find module './validate'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/import/validate.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/import/validate.test.ts`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add scripts/import/validate.ts scripts/import/validate.test.ts
git commit -m "feat(import): manifest completeness validator"
```

---

### Task 8: AI enrichment (Claude) — fill the manifest

**Files:**
- Modify: `scripts/import/manifest.json` (content only — no code)

This task is performed by Claude, not by code. Claude reads each entry's `body` and views each converted JPEG (`scripts/import/.cache/jpg/<uuid>.jpg`) and fills every empty field. The deterministic gate (Task 7) verifies completeness.

- [ ] **Step 1: Fill per-entry fields**

For each of the 18 entries in `manifest.json`:
- `title`: a short, evocative, blog-style title derived from that day's narrative (e.g. `"Day 1 · Touchdown in Kuala Lumpur"`, `"Twin Towers & a Lesson in Courage"`). Keep day order legible.
- `slug`: `slugify(title)` (lowercase-hyphenated). Must be unique across all entries.
- `excerpt`: 1–2 sentence card blurb summarizing the day, first person, matching the blog's voice.
- `featured`: set `true` for ~2 standout days per trip (e.g. Malaysia: Petronas Towers day + a Langkawi day; Singapore: Gardens by the Bay day + Universal Studios/Sentosa day), `false` otherwise.

- [ ] **Step 2: Fill per-photo alt text (vision)**

For every photo, open `scripts/import/.cache/jpg/<uuid>.jpg`, look at it, and write a concise, factual `alt` describing what's visible (subject + setting). No "image of"; ≤ ~125 chars.

- [ ] **Step 3: Fill per-trip fields**

For each trip set `summary` (1–2 sentences capturing the trip), `coverPhoto` (the uuid of a strong representative photo from that trip's entries), and `coverAlt` (alt text for that cover photo).

- [ ] **Step 4: Validate completeness**

Run: `npm run import:validate`
Expected: `Manifest OK: 2 trips, 18 entries.` Fix any reported gaps and re-run until clean.

- [ ] **Step 5: Commit the enriched manifest snapshot**

`manifest.json` is gitignored (it references local cache paths), so instead commit a checkpoint note. Skip if you prefer; the manifest is reproducible. (No code change to commit here.)

---

### Task 9: Sanity document builders (TDD)

**Files:**
- Create: `scripts/import/buildDocs.ts`
- Test: `scripts/import/buildDocs.test.ts`

Pure functions that turn manifest records + uploaded asset ids into Sanity documents. No network.

- [ ] **Step 1: Write the failing test**

```typescript
// scripts/import/buildDocs.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/import/buildDocs.test.ts`
Expected: FAIL — `Cannot find module './buildDocs'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// scripts/import/buildDocs.ts
import { slugify } from './text';
import type { ManifestEntry, ManifestTrip } from './types';

export interface ImageField {
  _type: 'image';
  asset: { _type: 'reference'; _ref: string };
  alt: string;
}
export interface ImageMember extends ImageField { _key: string; }

export function buildImage(assetId: string, alt: string): ImageField {
  return { _type: 'image', asset: { _type: 'reference', _ref: assetId }, alt };
}

export function buildPortableText(paragraphs: string[], keyPrefix: string) {
  return paragraphs.map((text, i) => ({
    _type: 'block' as const,
    _key: `${keyPrefix}-b${i}`,
    style: 'normal' as const,
    markDefs: [],
    children: [{ _type: 'span' as const, _key: `${keyPrefix}-b${i}-s0`, text, marks: [] }],
  }));
}

export function buildTripDoc(trip: ManifestTrip, coverAssetId: string) {
  return {
    _id: trip._id,
    _type: 'trip' as const,
    name: trip.name,
    slug: { _type: 'slug' as const, current: slugify(trip.name) },
    region: trip.region,
    startDate: trip.startDate,
    endDate: trip.endDate,
    summary: trip.summary,
    coverImage: buildImage(coverAssetId, trip.coverAlt),
  };
}

export function buildEntryDoc(entry: ManifestEntry, assetIdByUuid: Record<string, string>) {
  const ref = (uuid: string) => {
    const id = assetIdByUuid[uuid];
    if (!id) throw new Error(`No uploaded asset for photo ${uuid} (entry ${entry._id})`);
    return id;
  };
  const [cover, ...rest] = entry.photos;
  const gallery: ImageMember[] = rest.map((p, i) => ({
    _key: `${entry._id}-g${i}`,
    ...buildImage(ref(p.uuid), p.alt),
  }));

  return {
    _id: entry._id,
    _type: 'entry' as const,
    title: entry.title,
    slug: { _type: 'slug' as const, current: entry.slug.trim() || slugify(entry.title) },
    trip: { _type: 'reference' as const, _ref: entry.tripId },
    date: entry.date,
    location: {
      name: entry.location.name,
      geopoint: { _type: 'geopoint' as const, lat: entry.location.lat, lng: entry.location.lng },
    },
    coverImage: buildImage(ref(cover.uuid), cover.alt),
    gallery,
    body: buildPortableText(entry.body, entry._id),
    excerpt: entry.excerpt,
    featured: entry.featured,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/import/buildDocs.test.ts`
Expected: PASS (all assertions).

- [ ] **Step 5: Run the full test suite + astro check**

Run: `npm test && npm run check`
Expected: all vitest files pass; `astro check` reports no errors (the new scripts are typed).

- [ ] **Step 6: Commit**

```bash
git add scripts/import/buildDocs.ts scripts/import/buildDocs.test.ts
git commit -m "feat(import): pure Sanity document builders"
```

---

### Task 10: Loader (upload + createOrReplace) + dry run

**Files:**
- Create: `scripts/import/load.ts`

Integration glue (not unit-tested): loads env, builds the client, uploads each unique JPEG, builds docs, and (unless `--dry-run`) writes them in one transaction. Validates the manifest first.

- [ ] **Step 1: Write the loader**

```typescript
// scripts/import/load.ts
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
  console.log(`Connected to Sanity (existing documents: ${count}). Uploading assets…`);

  let n = 0;
  for (const [uuid, photo] of uniqueByUuid) {
    const jpg = path.resolve(photo.jpg);
    const asset = await client.assets.upload('image', fs.createReadStream(jpg), {
      filename: `${uuid}.jpg`,
    });
    assetIdByUuid[uuid] = asset._id;
    if (++n % 10 === 0) console.log(`  uploaded ${n}/${uniqueByUuid.size}`);
  }
  console.log(`Uploaded ${n} assets. Writing documents…`);

  const tx = client.transaction();
  for (const t of manifest.trips) tx.createOrReplace(buildTripDoc(t, assetIdByUuid[t.coverPhoto]));
  for (const e of manifest.entries) tx.createOrReplace(buildEntryDoc(e, assetIdByUuid));
  await tx.commit();

  console.log(`Done: ${manifest.trips.length} trips + ${manifest.entries.length} entries written.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Dry run (no Sanity credentials needed)**

Run: `npm run import:load:dry`
Expected: `DRY RUN: would upload 127 assets, create 2 trips + 18 entries.` followed by a well-formed sample entry document (cover image, gallery, geopoint, portable-text body). If validation fails here, return to Task 8.

- [ ] **Step 3: Commit**

```bash
git add scripts/import/load.ts
git commit -m "feat(import): Sanity loader with --dry-run"
```

---

### Task 11: Sanity project setup (user-driven)

**Files:**
- Create: `.env` (gitignored)

This requires the user's browser/login and cannot be done by the agent. Provide the checklist; the agent verifies connectivity afterward.

- [ ] **Step 1: Create the project + dataset**

User runs:
```bash
npx sanity@latest login      # opens browser; pick Google/GitHub/email
npx sanity@latest init        # "Create new project"; name "Detourist"; dataset "production"; reuse existing config
```
This prints/creates a **projectId**.

- [ ] **Step 2: Create a write token**

User goes to https://www.sanity.io/manage → the project → **API → Tokens → Add API token** → name "import", permission **Editor** (write). Copy the token (shown once).

- [ ] **Step 3: Write `.env`**

Create `/Users/baiweizhong/detourist/.env`:
```
SANITY_PROJECT_ID=<projectId from step 1>
SANITY_DATASET=production
SANITY_WRITE_TOKEN=<token from step 2>
SANITY_API_READ_TOKEN=
```

- [ ] **Step 4: Verify connectivity**

Run: `node -e "require('dotenv').config(); const {createClient}=require('@sanity/client'); const c=createClient({projectId:process.env.SANITY_PROJECT_ID,dataset:process.env.SANITY_DATASET,apiVersion:'2024-02-01',token:process.env.SANITY_WRITE_TOKEN,useCdn:false}); c.fetch('count(*)').then(n=>console.log('OK, documents:',n)).catch(e=>{console.error('FAILED:',e.message);process.exit(1)})"`
Expected: `OK, documents: 0`.

---

### Task 12: Real load + site verification

- [ ] **Step 1: Run the real import**

Run: `npm run import:load`
Expected: `Connected to Sanity …` → `Uploaded 127 assets.` → `Done: 2 trips + 18 entries written.`

- [ ] **Step 2: Confirm in Sanity**

Run: `node -e "require('dotenv').config(); const {createClient}=require('@sanity/client'); const c=createClient({projectId:process.env.SANITY_PROJECT_ID,dataset:process.env.SANITY_DATASET,apiVersion:'2024-02-01',token:process.env.SANITY_WRITE_TOKEN,useCdn:false}); c.fetch('{\"trips\":count(*[_type==\"trip\"]),\"entries\":count(*[_type==\"entry\"])}').then(r=>console.log(r))"`
Expected: `{ trips: 2, entries: 18 }`.

- [ ] **Step 3: Build + preview the site against live content**

Run: `npm run build && npm run preview`
Expected: build succeeds reading from Sanity (not seed). In the browser: entries list under both trips, covers + galleries render, the journey map plots KL → Langkawi → Singapore, and the homepage shows the featured entries.

- [ ] **Step 4: Idempotency check**

Run: `npm run import:load` again.
Expected: still `{ trips: 2, entries: 18 }` (no duplicates) — `createOrReplace` + asset content-hashing.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(import): complete Apple Journal → Sanity import pipeline"
```

---

## Self-Review

**Spec coverage:**
- Create-from-scratch Sanity setup → Task 11. ✓
- Two-trip split at May 17 → Task 3 (`tripIdForDate`) + Task 5 (trip docs). ✓
- AI vision alt text → Task 8 step 2; enforced by Task 7. ✓
- AI descriptive titles + excerpts → Task 8 steps 1; enforced by Task 7. ✓
- City-level geopoints → Task 3 (`locationForDate`) + Task 9 (`buildEntryDoc` geopoint). ✓
- Pre-feature ~2/trip → Task 8 step 1; enforced by Task 7 (`featured` gate). ✓
- Cover = first photo, rest = gallery → Task 9 (`buildEntryDoc`). ✓
- Body paragraphs → Portable Text, DAY N dropped, cleaned → Task 4 (`parseEntryHtml`) + Task 9 (`buildPortableText`). ✓
- HEIC→JPEG via sips, ≤2500px → Task 6. ✓
- Idempotency (stable ids, createOrReplace, asset hashing) → Task 10 + Task 12 step 4. ✓
- Verification (dry-run, real run, build/preview) → Tasks 10/12. ✓
- Out of scope (Canada, Studio webhook, inline images) → not implemented. ✓

**Placeholder scan:** No "TBD"/"add error handling"-style placeholders. Task 8 is intentionally a content task (no code) with a deterministic gate; its outputs are concrete fields. ✓

**Type consistency:** `Manifest`/`ManifestTrip`/`ManifestEntry`/`ManifestPhoto`/`GeoLocation`/`TripId` defined in Task 2 are used identically in Tasks 3–10. `parseEntryHtml` returns `{photoFiles, paragraphs}` (Task 4) consumed in Task 5. `buildImage`/`buildPortableText`/`buildTripDoc`/`buildEntryDoc` signatures match between Task 9 definition, its tests, and Task 10's loader. `assertManifestComplete` defined in Task 7, called in Task 10. `assetIdByUuid` keyed by `uuid` throughout. ✓
