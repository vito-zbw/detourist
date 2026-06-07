# Design — World choropleth map

- **Date:** 2026-06-07
- **Status:** Approved design (pending implementation plan)
- **Component owner:** Detourist site

## Goal

Replace the current MapLibre + OpenFreeMap marker map with a **static, theme-styled
world choropleth**: a flat Natural-Earth-projection world map where each **visited
country** is filled in its trip's color and the rest of the world is a muted gray.
Selecting a country (via the Journey filter tabs or by clicking the country on the
map) highlights that country; the map and the trip filter are linked in **both
directions**. The new map appears in **both** places the old one did — the homepage
hero teaser and the Journey page.

Visual target: a flat, poster-style choropleth (rounded/oval world outline, faint
graticule, white "globe", gray unvisited countries, colored visited countries, one
selected country emphasized) — the look of the user-provided reference image, adapted
to Detourist's palette.

## Background — current state

- `src/components/JourneyMap.astro` renders an interactive **MapLibre GL JS** vector
  map (OpenFreeMap "liberty" tiles, recolored at runtime) with **one teardrop pin per
  entry geopoint** and a dashed, date-ordered route line. Used as `variant="teaser"`
  (homepage, static) and `variant="full"` (Journey page, interactive).
- Content model: each **trip** has a `region` string (`"Malaysia"`, `"Singapore"`,
  `"Canada"`). The Journey-page filter tabs already key on `region.toLowerCase()`
  (`'malaysia' | 'singapore' | 'canada'`) — so "country" already maps cleanly onto the
  existing trip filter. No new content/schema fields are introduced (respects
  CLAUDE.md "browse by trip only / no tags").
- Trip → color: `Malaysia = magenta`, `Singapore = teal`, `Canada = coral`
  (`REGION_COLOR` in `content.ts`); the Journey legend already shows these.

## Decisions (resolved with the user)

1. **Pure country choropleth**, no city/entry pins. Selecting a country highlights it.
2. **Bidirectional** link: filter tab selection → map highlight, AND map country click
   → filter entries + update the active tab.
3. **Both locations**: homepage teaser (static) + Journey page (interactive).
4. **Per-trip colors**: each visited country wears its trip color as a soft base fill;
   the selected country brightens to full saturation with an outline. (Not the
   reference's monochrome orange — this reinforces the site's existing color system.)
5. **Technical approach A**: build-time SVG generated with `d3-geo` from a
   `world-atlas` TopoJSON. The heavy libs run only at build; the browser downloads only
   SVG markup. Static-site architecture preserved.
6. **Singapore**: rendered as a small trip-colored **locator ring** at its coordinates
   (it is not a polygon at the 110m dataset scale, and would be ~1px even if present).
   Same mechanism handles any future tiny country.
7. **Framing**: keep existing card colors — homepage teal card, Journey paper card. The
   new white-sphere map is dropped into those existing containers.

## Architecture

```
content.ts ── getVisitedCountries() ──► WorldMap.astro  (build-time SVG via d3-geo)
   trips → regions                          │
   [{ key, region, color, iso, live }]      ├─ variant="teaser"  → static; visited
                                            │     countries are SVG <a> links to
                                            │     /journey?trip=<key>#map  (zero JS)
                                            │
                                            └─ variant="full"     → visited paths carry
                                                  data-key; the Journey filter script
                                                  wires tabs ↔ map (both directions)
```

The browser never loads d3/topojson/MapLibre. The only client JS is the Journey page's
existing filter script, extended to drive the map highlight.

## Data layer changes

### `src/lib/types.ts`
Add:

```ts
export interface VisitedCountry {
  /** lowercased region key, matches the filter tab data-trip: malaysia | singapore | canada */
  key: string;
  region: string;          // "Canada"
  color: TripColor;        // 'coral'
  iso: string;             // ISO 3166-1 numeric, as a string ("124") — matches world-atlas feature ids
  live: boolean;           // region's trip has empty endDate
  /** Optional [lng, lat] for a locator ring when the polygon is missing/too small (e.g. Singapore). */
  marker?: [number, number];
}
```

### `src/lib/content.ts`
- Add a `REGION_ISO` map: `{ malaysia: '458', singapore: '702', canada: '124' }`.
- Add an optional `REGION_MARKER` map for micro-states: `{ singapore: [103.82, 1.35] }`.
- Add `getVisitedCountries(): Promise<VisitedCountry[]>`:
  - From `getTrips()`, build one record per region (dedupe by region; if two trips share
    a region, merge — `live` is true if any of them is ongoing).
  - Resolve `iso` from `REGION_ISO`; skip regions with no mapping (graceful — never throws).
  - Attach `marker` from `REGION_MARKER` when present.
- This is the only new public content helper. `getMapEntries()` is no longer used by the
  map and can be removed once both pages stop calling it (verify no other callers first).

Extensibility: adding a future country = one entry in `REGION_ISO` (+ `REGION_MARKER` if
it's a tiny state).

## Component — `src/components/WorldMap.astro`

### Props
```ts
interface Props {
  countries: VisitedCountry[];
  variant?: 'full' | 'teaser';   // default 'full'
}
```

### Build-time render (frontmatter, Node)
1. Import `{ feature }` from `topojson-client`, `{ geoNaturalEarth1, geoPath, geoGraticule10 }`
   from `d3-geo`, and the `world-atlas/countries-110m.json` TopoJSON.
2. `const projection = geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' })` for a chosen
   viewBox (≈ 2:1; exact dimensions tuned in implementation). `const path = geoPath(projection)`.
3. Compute path strings:
   - **Sphere**: `path({ type: 'Sphere' })` → white fill (the "globe" area).
   - **Graticule**: `path(geoGraticule10())` → faint stroke.
   - **Countries**: `feature(topo, topo.objects.countries).features`; for each, `path(f)`.
     A country is "visited" when `String(f.id)` is in the set of visited ISO codes.
4. Trim Antarctica by cropping the viewBox bottom (cleaner frame, matches reference).
5. Emit `<svg viewBox=...>` containing: sphere rect/path, graticule path, then one
   `<path>` per country. Visited paths get `style="--fill:<hex>"`, `data-country`,
   `data-key`, and (per variant) interactivity. Locator rings (`<circle>` / ring) are
   emitted for any visited country with a `marker`.

### Colors / styling (`.wm-*`, scoped or in a stylesheet)
- Unvisited country: warm gray fill (`~#dcd7cf`), white hairline border.
- Visited base: `fill: var(--fill)` at `fill-opacity ~0.55` (the "light shade").
- Selected (`.is-selected`): `fill-opacity: 1` + bold outline (`--plum` or white ~1.5px)
  so it pops like USA in the reference.
- Locator ring: a small ring in the trip color; gets the same `.is-selected` emphasis.
- The `<svg>` is `width:100%; height:auto` (aspect from viewBox); replaces the old
  fixed-height containers (`.jmap-teaser` 330px, `.jbig__field`) which switch to
  aspect-ratio-based sizing. Map sits in the existing **teal** (homepage) / **paper**
  (Journey) cards.

### Variant behavior
- **`teaser`** (homepage): each visited country path/ring is wrapped in an SVG anchor
  `<a href="/journey?trip=<key>#map">`. Fully static, no JS. Unvisited paths are inert.
- **`full`** (Journey): visited paths/rings carry `data-key`, `role="button"`,
  `tabindex="0"`. No behavior lives in the component — the Journey filter script (below)
  owns it.

### Accessibility
- `<svg role="img" aria-label="World map highlighting countries visited: Malaysia, Singapore, Canada.">`.
- Visited elements: `full` → `role="button"` + `tabindex=0` + Enter/Space; `teaser` →
  focusable `<a>` with `aria-label="Stories from <region>"`.
- Unvisited countries + graticule: `aria-hidden="true"`, `pointer-events:none`.

## Interaction — Journey filter ↔ map (both directions)

Extend the existing `<script>` in `src/pages/journey.astro` (it already owns the
selection state and the `?trip=` deep-link sync). One controller, no duplicate state:

- Derive the valid key list from the rendered tabs (`[data-trip]`) instead of the
  hardcoded `valid = ['malaysia','singapore','canada']`.
- Extend `apply(key)` to also:
  - toggle `.is-selected` on the map element `[data-key="<key>"]` (clear it for `all`).
- Add a click/keydown handler on map `[data-key]` elements → `apply(key)` + smooth-scroll
  to `#entries`.
- Deep-link `?trip=<key>` already calls `apply()` on load, so the map highlights on
  arrival from a teaser link automatically.

Homepage teaser needs no script — it uses static `<a>` deep-links into the above.

## Files touched

**New**
- `src/components/WorldMap.astro`
- `getVisitedCountries()` + `REGION_ISO`/`REGION_MARKER` in `src/lib/content.ts`
- `VisitedCountry` type in `src/lib/types.ts`

**Edit**
- `src/pages/index.astro` — swap teaser `<JourneyMap entries=…>` → `<WorldMap countries=… variant="teaser">`; update teaser copy ("Tap any pin" → "Tap a country", stop/pin language).
- `src/pages/journey.astro` — swap `<JourneyMap>` → `<WorldMap variant="full">`; extend filter script (map sync + map-click→filter, derive valid keys); update copy ("Tap a pin" → "Tap a country"; "{n} stops pinned" → countries language); legend stays (already per-country).
- CSS (`home.css` / `pages.css`) — add `.wm-*` styles; convert `.jmap-teaser` / `.jbig__field` from fixed height to aspect-ratio; remove dead `.map-pin` / `.detourist-map` rules that lived in the deleted component.

**Delete**
- `src/components/JourneyMap.astro`

**Dependencies**
- Remove: `maplibre-gl`.
- Add (dev): `d3-geo`, `topojson-client`, `world-atlas`, `@types/d3-geo`, `@types/topojson-client`.

**Docs**
- `CLAUDE.md` — rewrite the "Map" section: it currently mandates MapLibre + OpenFreeMap
  vector tiles and per-entry pins. Update it to describe the static d3-geo choropleth
  (build-time SVG, per-trip country fills, select-to-highlight, both-directions filter
  link), so the documented architecture matches the implementation.

## Non-goals / out of scope

- No city/entry pins, no route line (intentionally dropped).
- No new content schema fields; browsing stays by trip/region only.
- No SSR — remains fully static (build-time SVG).
- No pan/zoom/globe interaction; the map is a flat poster, not a slippy map.
- No change to the homepage stat ribbon copy beyond pin/stop wording if needed.

## Verification plan

No test runner exists in the repo, so verification mirrors the established pattern
(build + rendered-HTML assertions + manual interaction):

1. `npm run build` succeeds and statically generates all pages.
2. Rendered `dist/journey/index.html` and `dist/index.html` contain `data-country` /
   `data-key` for `malaysia`, `singapore`, `canada`, and a Singapore locator ring.
3. Unvisited countries render gray; visited render with their `--fill` color.
4. `npm run dev` manual checks:
   - Journey: click a tab → its country highlights; click a country → entries filter +
     tab updates + scroll; `?trip=canada` deep-link highlights on load.
   - Homepage teaser: clicking a country navigates to `/journey?trip=<key>#map` with that
     country pre-selected.
5. Responsive: map scales to width on mobile and desktop (aspect-ratio container).

## Risks / notes

- **SVG markup size**: a full-world inline SVG is a chunk of static HTML. Mitigated by
  the low-res 110m dataset and trimming Antarctica; it gzips well and is cacheable. If
  it proves heavy, geometry can be simplified further (`topojson-simplify`) — not planned
  initially.
- **Git**: the working directory is not a git repository, so this design doc is written
  but not committed (the brainstorming "commit the spec" step is skipped — no repo).
- **ISO source of truth**: `world-atlas` uses ISO 3166-1 **numeric** ids; `REGION_ISO`
  must use numeric codes (as strings), not alpha-2/alpha-3.
