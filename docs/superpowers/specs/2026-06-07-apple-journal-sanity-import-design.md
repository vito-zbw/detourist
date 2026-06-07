# Apple Journal → Sanity import — design

**Date:** 2026-06-07
**Status:** Approved pending user review
**Goal:** Import the author's Apple Journal export (Malaysia + Singapore, May 2024)
into Sanity as `trip` and `entry` documents with uploaded image assets, so the
existing Astro site renders real content instead of seed data.

## Source data (verified)

Location: `AppleJournalEntries/` (copied from iCloud into the repo root).

- **18 daily entries**, `Entries/2024-05-10.html` … `2024-05-27.html`. This is
  Apple Journal's HTML export (Cocoa HTML Writer), not a structured format.
- **`Resources/`**: 127 photos (`UUID.HEIC`, a few `.heic`/`.jpeg`) plus a
  `UUID.json` sidecar per photo. **Each sidecar contains only `{ "date": <Apple
  epoch seconds> }`** — no GPS, no caption.
- **`index.html`**: a date-ordered link list (ignored by the importer).

Per-entry HTML structure (consistent, machine-generated):
- `<div class="pageHeader">Friday, May 10, 2024</div>` — the date (also in the
  filename, which is the canonical source).
- `<div class="assetGrid">` → one or more
  `<div class="gridItem assetType_livePhoto|photo" id="UUID">` →
  `<img src="../Resources/UUID.HEIC" class="asset_image"/>`. **Photo order in
  the grid is the order to preserve.** Photo counts range 2–13 per entry.
- `<div class='title'></div>` — **always empty.**
- `<div class='bodyText'>` followed by `<p class="p2"><span class="s2">…</span></p>`
  paragraphs (the journal text) interleaved with empty `<p class="p3"><br></p>`
  spacers. The first body paragraph is a `DAY N` marker.

Confirmed absent: the workout / health / contact / music / state-of-mind /
map "suggestion" asset types appear **only in the boilerplate CSS** of each
file, never as real content. The content is purely text + travel photos.

### Geography (drives the trip split + locations)

- Days 1–4 (May 10–13): **Kuala Lumpur**
- Days 5–7 (May 14–16): **Langkawi**
- Day 8 (May 17): flew Langkawi → **Singapore**
- Days 8–18 (May 17–27): **Singapore**

## Decisions

| Decision | Choice |
|---|---|
| Sanity project | **Create from scratch** — guided setup (Stage 0) |
| Trip split | **Two trips, boundary at May 17.** Malaysia = 7 entries (May 10–16); Singapore = 11 entries (May 17–27) |
| Image alt text | **AI vision-generated** — Claude views each converted JPEG and writes alt text (127 images) |
| Entry titles | **AI-generated descriptive** — Claude writes one per entry from the narrative |
| Excerpts | AI-generated, 1–2 sentences per entry |
| Geopoints | **City-level only**: Kuala Lumpur, Langkawi, Singapore |
| Featured | **Pre-feature ~2 entries per trip** (final picks chosen during enrichment) |
| Cover vs gallery | First photo = `coverImage`; remaining photos = `gallery` |
| Body | Paragraphs → Portable Text `block`s (normal); drop the `DAY N` line; clean entities/curly quotes/`Apple-converted-space` |
| Images | HEIC → JPEG via macOS `sips`, long edge capped ~2500px |
| Idempotency | Stable `_id`s + `createOrReplace`; Sanity content-hashes assets |

City coordinates (lat, lng): KL `3.1390, 101.6869`; Langkawi `6.3500, 99.8000`;
Singapore `1.3521, 103.8198`.

## Architecture — two-stage "enrich → load" pipeline

```
HTML + HEIC ──parse/convert──▶ manifest.json (+ JPEGs) ──enrich (Claude)──▶ manifest.json (complete) ──load──▶ Sanity
```

Rationale: AI output (titles, alt, excerpts, summaries) is written to a flat,
human-reviewable JSON file **before** anything is written to Sanity. The load
step is idempotent; a failed upload never discards enrichment work.

New files (all under `scripts/import/`; **no changes to `src/`**):

| File | Responsibility | Depends on |
|---|---|---|
| `scripts/import/parse.ts` | Parse the 18 HTML files → per-entry `{ date, trip, photos[], bodyParagraphs[] }`; trigger HEIC→JPEG conversion; write `manifest.json` | `node-html-parser`, `sips` |
| `scripts/import/convert.ts` (or inline) | `sips -s format jpeg` each photo into `scripts/import/.cache/jpg/`, capped ~2500px long edge | `sips` (macOS) |
| `scripts/import/load.ts` | Read completed `manifest.json`; upload JPEGs as assets; build + `createOrReplace` `trip`/`entry` docs; `--dry-run` flag | `@sanity/client` (already a dep) |
| `scripts/import/manifest.json` | Intermediate artifact (parsed + enriched). Gitignored. | — |

Tooling: run TS scripts with `tsx` (new devDep). Add `node-html-parser` (new
devDep). `@sanity/client` is already a dependency. The `.cache/` dir and
`manifest.json` are gitignored.

### `manifest.json` shape

```jsonc
{
  "trips": [
    {
      "_id": "trip.malaysia",
      "name": "Malaysia", "region": "Malaysia",
      "startDate": "2024-05-10", "endDate": "2024-05-16",
      "summary": "<AI>", "coverPhoto": "<UUID>", "coverAlt": "<AI>"
    },
    { "_id": "trip.singapore", "...": "..." }
  ],
  "entries": [
    {
      "_id": "entry.2024-05-10",
      "tripId": "trip.malaysia",
      "date": "2024-05-10T12:00:00Z",       // noon UTC — avoids date-shift in UTC-formatted display
      "title": "<AI>",                        // -> slug
      "slug": "<from title>",
      "excerpt": "<AI>",
      "featured": false,
      "location": { "name": "Kuala Lumpur", "lat": 3.1390, "lng": 101.6869 },
      "body": ["paragraph 1", "paragraph 2"], // DAY N line dropped, cleaned
      "photos": [
        { "uuid": "41F686B2-…", "jpg": ".cache/jpg/41F686B2-….jpg", "alt": "<AI>" }
      ]                                        // [0] becomes coverImage; rest -> gallery
    }
  ]
}
```

### Document construction (load.ts)

- **Asset upload:** `client.assets.upload('image', fs.createReadStream(jpg))` →
  returns `{ _id }`; reference as `{ _type: 'image', asset: { _type: 'reference', _ref }, alt }`.
- **Trip doc:** `{ _id, _type: 'trip', name, slug:{_type:'slug',current}, region,
  startDate, endDate, summary, coverImage }`.
- **Entry doc:** `{ _id, _type: 'entry', title, slug, trip:{_type:'reference',_ref:tripId},
  date, location:{name, geopoint:{_type:'geopoint', lat, lng}}, coverImage,
  gallery:[…], body:[…portable text…], excerpt, featured }`.
- **Portable Text:** each cleaned paragraph → `{ _type:'block', _key, style:'normal',
  markDefs:[], children:[{ _type:'span', _key, text, marks:[] }] }`. Stable
  `_key`s from `entryId + index`.
- Use a single transaction or sequential `createOrReplace`; log a summary.

## Sanity setup (Stage 0 — user-driven, then verified)

1. `npx sanity login`, then `npx sanity init` in the repo (creates the project,
   reuses the existing schema in `sanity/`). Yields **projectId** + dataset
   (`production`).
2. Create a **write token** with Editor permissions at sanity.io/manage.
3. Add to `.env` (gitignored): `SANITY_PROJECT_ID`, `SANITY_DATASET=production`,
   `SANITY_WRITE_TOKEN`. The write token is import-only and distinct from the
   build's `SANITY_API_READ_TOKEN`.
4. Claude verifies connectivity (read a trivial query) before the real load.

## Verification

1. `load.ts --dry-run`: build all docs, print a summary (counts, titles, asset
   list), write nothing.
2. Real load; confirm 2 trips + 18 entries + 127 assets created.
3. `npm run build` && `npm run preview`: entries render, covers/galleries show,
   journey map plots KL → Langkawi → Singapore, homepage features the chosen
   entries.

## Idempotency & safety

- Stable `_id`s + `createOrReplace` → re-runs update in place, never duplicate.
- Sanity content-hashes uploaded assets → re-runs don't pile up duplicate images.
- `.env` / write token never committed; `manifest.json` + `.cache/` gitignored.

## Out of scope

- The ongoing **Canada** trip (added later/manually).
- Sanity **Studio deployment** + publish **webhook** / Cloudflare deploy hook
  (separate task).
- **Inline** body images (the export gives one flat photo grid with no inline
  positions, so cover+gallery is the faithful mapping).
- Theme/category/tag fields (intentionally out of scope per CLAUDE.md).
