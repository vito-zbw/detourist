# World Choropleth Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the MapLibre marker map with a static, theme-styled world choropleth where each visited country is filled in its trip color and selecting a country (via the Journey filter or by clicking the map) highlights it — linked both directions.

**Architecture:** A new `WorldMap.astro` component projects a `world-atlas` TopoJSON through `d3-geo` into an inline SVG **at build time** (the libraries never reach the browser). The homepage teaser variant uses static SVG `<a>` deep-links; the Journey variant is driven by the page's existing filter script, extended to sync map highlight ↔ tab selection both ways.

**Tech Stack:** Astro (static), TypeScript, `d3-geo` + `topojson-client` + `world-atlas` (build-time only). Removes `maplibre-gl`.

---

## Conventions for this plan

- **No git:** this working directory is **not** a git repository, so there are no commit steps. Each task's done-criterion is a clean `npm run build` plus the stated assertions. Do not run `git`.
- **No test runner:** per the approved spec, this repo has no unit-test framework and none is added (YAGNI). Verification = `npm run build` succeeds + `grep` assertions against the rendered `dist/` HTML + manual dev-server checks. Build commands run from `/Users/baiweizhong/detourist`.
- **Region → country mapping** already exists in the data: `trip.region` (`"Malaysia"|"Singapore"|"Canada"`) lowercased is the filter key and the map `data-key`.

---

## Task 1: Add build-time map dependencies

**Files:**
- Modify: `package.json` (dependencies / devDependencies)

- [ ] **Step 1: Install the projection libraries (keep `maplibre-gl` for now)**

Run from the project root:
```bash
npm install d3-geo topojson-client world-atlas
npm install -D @types/d3-geo @types/topojson-client
```

- [ ] **Step 2: Verify they resolved**

Run: `npm ls d3-geo topojson-client world-atlas`
Expected: each package listed with a version, no "missing" / "UNMET DEPENDENCY".

- [ ] **Step 3: Verify the build still passes (nothing uses the new libs yet)**

Run: `npm run build`
Expected: ends with `[build] Complete!` and 15 pages built (the old MapLibre map is untouched).

---

## Task 2: Add `VisitedCountry` type + `getVisitedCountries()`

**Files:**
- Modify: `src/lib/types.ts` (append new interface)
- Modify: `src/lib/content.ts` (add `REGION_ISO`, `REGION_MARKER`, import + `getVisitedCountries`)

- [ ] **Step 1: Add the `VisitedCountry` type**

In `src/lib/types.ts`, append at the end of the file (after the `Entry` interface):

```ts
/**
 * One visited country, derived from a trip's `region` — drives the world map.
 * `iso` is the ISO 3166-1 *numeric* code as a string (matches world-atlas ids).
 */
export interface VisitedCountry {
  /** lowercased region, matches the filter tab data-trip + map data-key: malaysia | singapore | canada */
  key: string;
  region: string; // "Canada"
  color: TripColor; // 'coral'
  iso: string; // "124"
  live: boolean; // region's trip has an empty endDate
  /** [lng, lat] for a locator ring when the polygon is missing/too small (e.g. Singapore). */
  marker?: [number, number];
}
```

- [ ] **Step 2: Import the new type in `content.ts`**

In `src/lib/content.ts`, the type import block currently reads:

```ts
import type {
  Trip,
  Entry,
  TripColor,
  SlotTint,
  GalleryImage,
  PortableBlock,
  TravelImage,
} from './types';
```

Add `VisitedCountry` to it:

```ts
import type {
  Trip,
  Entry,
  TripColor,
  SlotTint,
  GalleryImage,
  PortableBlock,
  TravelImage,
  VisitedCountry,
} from './types';
```

- [ ] **Step 3: Add the ISO + marker maps**

In `src/lib/content.ts`, immediately after the existing `REGION_COLOR` map (the block ending `};` around line 23), add:

```ts
/** region (lowercased) → ISO 3166-1 numeric code (as string; matches world-atlas feature ids). */
const REGION_ISO: Record<string, string> = {
  malaysia: '458',
  singapore: '702',
  canada: '124',
};

/** Micro-states whose polygon is missing/invisible at world scale → locator ring at [lng, lat]. */
const REGION_MARKER: Record<string, [number, number]> = {
  singapore: [103.82, 1.35],
};
```

- [ ] **Step 4: Add `getVisitedCountries()`**

In `src/lib/content.ts`, add this to the public API section (e.g. directly after the `getMapEntries` function):

```ts
/** One record per visited country (deduped by region), for the world map. */
export async function getVisitedCountries(): Promise<VisitedCountry[]> {
  const trips = await getTrips(); // current/ongoing trip sorts first
  const byKey = new Map<string, VisitedCountry>();
  for (const trip of trips) {
    const key = trip.region.toLowerCase();
    const iso = REGION_ISO[key];
    if (!iso) continue; // no mapping yet → skip gracefully
    const live = !trip.endDate;
    const existing = byKey.get(key);
    if (existing) {
      existing.live = existing.live || live;
      continue;
    }
    byKey.set(key, { key, region: trip.region, color: trip.color, iso, live, marker: REGION_MARKER[key] });
  }
  return [...byKey.values()];
}
```

- [ ] **Step 5: Verify the build still compiles**

Run: `npm run build`
Expected: `[build] Complete!`. (The function isn't rendered yet — it's exercised and asserted in Task 3, where the homepage consumes it.)

---

## Task 3: Create `WorldMap.astro` and wire the homepage teaser

**Files:**
- Create: `src/components/WorldMap.astro`
- Modify: `src/pages/index.astro` (swap teaser component + imports + copy)

- [ ] **Step 1: Create `src/components/WorldMap.astro`**

```astro
---
// Static, theme-styled world choropleth. Visited countries (from trip regions)
// are filled in their trip color; the rest of the world is gray. The map is
// generated at BUILD TIME with d3-geo — the browser receives only SVG markup.
//
//   variant="teaser" -> static; visited countries are <a> deep-links to /journey
//   variant="full"   -> visited countries carry data-key; the Journey filter
//                       script wires tab <-> map highlight both directions.
import type { VisitedCountry, TripColor } from '@/lib/types';
import { feature } from 'topojson-client';
import { geoNaturalEarth1, geoPath, geoGraticule10 } from 'd3-geo';
import world from 'world-atlas/countries-110m.json';

interface Props {
  countries: VisitedCountry[];
  variant?: 'full' | 'teaser';
}
const { countries, variant = 'full' } = Astro.props;

const COLOR_HEX: Record<TripColor, string> = {
  coral: '#FF6A4D',
  teal: '#16B3A7',
  magenta: '#F0407F',
  gold: '#FFB22E',
};

const W = 1000;
const H = 500;
const VB_H = 450; // crop the Antarctic band off the bottom of the viewBox

const topo = world as any;
const land: any = feature(topo, topo.objects.countries);
const projection = geoNaturalEarth1().fitSize([W, H], { type: 'Sphere' } as any);
const path = geoPath(projection as any);

const spherePath = path({ type: 'Sphere' } as any) ?? '';
const graticulePath = path(geoGraticule10()) ?? '';

const visitedByIso = new Map(countries.map((c) => [c.iso, c]));
const countryPaths = land.features.map((f: any) => ({
  d: path(f) ?? '',
  visited: visitedByIso.get(String(f.id)) as VisitedCountry | undefined,
}));

const rings = countries
  .filter((c) => c.marker)
  .map((c) => {
    const xy = projection(c.marker as [number, number]);
    return { c, x: xy?.[0] ?? 0, y: xy?.[1] ?? 0 };
  });

const summary = countries.map((c) => c.region).join(', ');
const href = (key: string) => `/journey?trip=${key}#map`;
---
<div class:list={['wm', `wm--${variant}`]}>
  <svg
    class="wm__svg"
    viewBox={`0 0 ${W} ${VB_H}`}
    role="img"
    aria-label={`World map highlighting countries visited: ${summary}.`}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path class="wm__sphere" d={spherePath} />
    <path class="wm__grat" d={graticulePath} aria-hidden="true" />
    <g class="wm__land">
      {countryPaths.map((cp) =>
        cp.visited ? (
          variant === 'teaser' ? (
            <a href={href(cp.visited.key)} aria-label={`Stories from ${cp.visited.region}`}>
              <path
                class="wm__country wm__country--visited"
                d={cp.d}
                data-key={cp.visited.key}
                style={`--fill:${COLOR_HEX[cp.visited.color]}`}
              />
            </a>
          ) : (
            <path
              class="wm__country wm__country--visited"
              d={cp.d}
              data-key={cp.visited.key}
              style={`--fill:${COLOR_HEX[cp.visited.color]}`}
              role="button"
              tabindex="0"
              aria-label={`Filter stories: ${cp.visited.region}`}
            />
          )
        ) : (
          <path class="wm__country" d={cp.d} aria-hidden="true" />
        )
      )}
    </g>
    <g class="wm__rings">
      {rings.map((r) =>
        variant === 'teaser' ? (
          <a href={href(r.c.key)} aria-label={`Stories from ${r.c.region}`}>
            <circle class="wm__ring" cx={r.x} cy={r.y} r="7" data-key={r.c.key} style={`--fill:${COLOR_HEX[r.c.color]}`} />
          </a>
        ) : (
          <circle
            class="wm__ring"
            cx={r.x}
            cy={r.y}
            r="7"
            data-key={r.c.key}
            style={`--fill:${COLOR_HEX[r.c.color]}`}
            role="button"
            tabindex="0"
            aria-label={`Filter stories: ${r.c.region}`}
          />
        )
      )}
    </g>
  </svg>
</div>

<style is:global>
  .wm { width: 100%; align-self: center; }
  .wm__svg { width: 100%; height: auto; display: block; }
  .wm__sphere { fill: #fff; }
  .wm__grat { fill: none; stroke: rgba(43, 35, 66, 0.12); stroke-width: 0.5; }
  .wm__country { fill: #dcd7cf; stroke: #fff; stroke-width: 0.5; }
  .wm__country--visited {
    fill: var(--fill);
    fill-opacity: 0.55;
    transition: fill-opacity 0.15s ease;
  }
  .wm--full .wm__country--visited { cursor: pointer; }
  .wm--full .wm__country--visited:hover { fill-opacity: 0.82; }
  .wm__country--visited.is-selected { fill-opacity: 1; stroke: var(--plum); stroke-width: 1.4; }
  .wm__ring {
    fill: var(--fill);
    fill-opacity: 0.6;
    stroke: #fff;
    stroke-width: 1.5;
    transition: fill-opacity 0.15s ease;
  }
  .wm--full .wm__ring { cursor: pointer; }
  .wm--full .wm__ring:hover { fill-opacity: 0.9; }
  .wm__ring.is-selected { fill-opacity: 1; stroke: var(--plum); stroke-width: 2; }
  .wm [role="button"]:focus-visible { outline: 2px solid var(--plum); outline-offset: 1px; }
</style>
```

- [ ] **Step 2: Swap the import in `src/pages/index.astro`**

Change line 7 from:
```astro
import JourneyMap from '@/components/JourneyMap.astro';
```
to:
```astro
import WorldMap from '@/components/WorldMap.astro';
```

- [ ] **Step 3: Swap the content import in `src/pages/index.astro`**

Change the content import (line 8) from:
```astro
import { getCurrentTrip, getFeaturedEntries, getTrips, getEntries, getMapEntries } from '@/lib/content';
```
to:
```astro
import { getCurrentTrip, getFeaturedEntries, getTrips, getEntries, getVisitedCountries } from '@/lib/content';
```

- [ ] **Step 4: Replace the map data + drop the unused `liveSlug` in `src/pages/index.astro`**

Find:
```astro
const mapEntries = await getMapEntries();
```
Replace with:
```astro
const visited = await getVisitedCountries();
```

Then find and **delete** this line (it was only used by the old map; `liveEntry` stays because `heroLocation` uses it):
```astro
const liveSlug = liveEntry?.slug;
```

- [ ] **Step 5: Swap the teaser markup + copy in `src/pages/index.astro`**

Find:
```astro
          <JourneyMap entries={mapEntries} liveSlug={liveSlug} variant="teaser" />
```
Replace with:
```astro
          <WorldMap countries={visited} variant="teaser" />
```

Then find the teaser paragraph:
```astro
            <p style="color:rgba(255,255,255,.9);">Three countries, fourteen stops, and a route that made almost no logistical sense. Tap any pin to read what happened there.</p>
```
Replace with:
```astro
            <p style="color:rgba(255,255,255,.9);">Three countries, fourteen stops, and a route that made almost no logistical sense. Tap a country to read those stories.</p>
```

- [ ] **Step 6: Build and assert the teaser rendered**

Run: `npm run build`
Expected: `[build] Complete!`

Run: `grep -o 'data-key="[a-z]*"' dist/index.html | sort -u`
Expected: includes `data-key="canada"`, `data-key="malaysia"`, `data-key="singapore"`.

Run: `grep -c 'wm__ring' dist/index.html`
Expected: `≥ 1` (Singapore locator ring).

Run: `grep -c 'wm__sphere' dist/index.html`
Expected: `1` (the white globe path is present).

---

## Task 4: Wire the Journey page (full variant) + bidirectional filter

**Files:**
- Modify: `src/pages/journey.astro` (imports, frontmatter, map markup, copy, `<script>`)

- [ ] **Step 1: Swap the component import in `src/pages/journey.astro`**

Change line 5 from:
```astro
import JourneyMap from '@/components/JourneyMap.astro';
```
to:
```astro
import WorldMap from '@/components/WorldMap.astro';
```

- [ ] **Step 2: Swap the content import in `src/pages/journey.astro`**

Change line 6 from:
```astro
import { getEntries, getMapEntries, getTrips, getCurrentTrip } from '@/lib/content';
```
to:
```astro
import { getEntries, getVisitedCountries, getTrips } from '@/lib/content';
```

- [ ] **Step 3: Replace the frontmatter data block in `src/pages/journey.astro`**

Find:
```astro
const entries = await getEntries(); // newest first
const mapEntries = await getMapEntries();
const trips = await getTrips();
const current = await getCurrentTrip();

const liveEntry = current ? entries.find((e) => e.tripSlug === current.slug) : undefined;
const liveSlug = liveEntry?.slug;
```
Replace with:
```astro
const entries = await getEntries(); // newest first
const visited = await getVisitedCountries();
const trips = await getTrips();
```

- [ ] **Step 4: Swap the map markup in `src/pages/journey.astro`**

Find:
```astro
        <JourneyMap entries={mapEntries} liveSlug={liveSlug} variant="full" />
```
Replace with:
```astro
        <WorldMap countries={visited} variant="full" />
```

- [ ] **Step 5: Update the map sub-heading + note copy in `src/pages/journey.astro`**

Find:
```astro
            <p class="jbig__sub">Kuala Lumpur → Penang → Singapore → all the way to the Canadian Rockies. Tap a pin to jump to that story.</p>
```
Replace with:
```astro
            <p class="jbig__sub">Kuala Lumpur → Penang → Singapore → all the way to the Canadian Rockies. Tap a country to filter the stories below.</p>
```

Find:
```astro
          {mapEntries.length} stops pinned · the coral one is where I'm standing right now.
```
Replace with:
```astro
          {visited.length} countries on the map · the coral one is where I'm standing right now.
```

- [ ] **Step 6: Replace the entire `<script>` block in `src/pages/journey.astro`**

Replace the whole existing `<script> … </script>` (the browse-by-trip filter) with:

```astro
<script>
  // Browse-by-trip filter, linked BOTH ways to the world map:
  //  - selecting a tab (or arriving via ?trip=) highlights that country on the map
  //  - clicking a country on the map filters the cards + updates the active tab
  const bar = document.getElementById('filterbar');
  const cards = Array.from(document.querySelectorAll<HTMLElement>('#entries .entry-card'));
  const empty = document.getElementById('empty');
  const mapEls = Array.from(document.querySelectorAll<SVGElement>('#map [data-key]'));
  const valid = Array.from(bar?.querySelectorAll('.ftab[data-trip]') ?? [])
    .map((b) => b.getAttribute('data-trip') ?? '')
    .filter((t) => t && t !== 'all');

  function apply(trip: string) {
    let shown = 0;
    cards.forEach((c) => {
      const match = trip === 'all' || c.getAttribute('data-trip') === trip;
      c.classList.toggle('is-hidden', !match);
      if (match) shown++;
    });
    if (empty) empty.style.display = shown ? 'none' : 'block';
    bar?.querySelectorAll('.ftab').forEach((b) => {
      const on = b.getAttribute('data-trip') === trip;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    mapEls.forEach((el) => {
      const on = trip !== 'all' && el.getAttribute('data-key') === trip;
      el.classList.toggle('is-selected', on);
    });
    history.replaceState(null, '', trip === 'all' ? location.pathname + location.hash : '?trip=' + trip);
  }

  function scrollToEntries() {
    document.getElementById('entries')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  bar?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.ftab');
    if (!btn) return;
    apply(btn.getAttribute('data-trip') || 'all');
    scrollToEntries();
  });

  mapEls.forEach((el) => {
    const key = el.getAttribute('data-key');
    if (!key) return;
    el.addEventListener('click', () => { apply(key); scrollToEntries(); });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        apply(key);
        scrollToEntries();
      }
    });
  });

  const q = new URLSearchParams(location.search).get('trip');
  if (q && valid.includes(q)) apply(q);
</script>
```

- [ ] **Step 7: Build and assert the Journey map rendered interactively**

Run: `npm run build`
Expected: `[build] Complete!`

Run: `grep -o 'role="button"' dist/journey/index.html | head -1`
Expected: `role="button"` (visited countries are interactive on the Journey page).

Run: `grep -o 'data-key="[a-z]*"' dist/journey/index.html | sort -u`
Expected: `data-key="canada"`, `data-key="malaysia"`, `data-key="singapore"`.

- [ ] **Step 8: Manual interaction check**

Run: `npm run dev` and open the printed localhost URL.
- Journey page (`/journey#map`): click the **Canada** filter tab → Canada brightens on the map. Click **Malaysia** on the map → the cards filter to Malaysia, the Malaysia tab activates, and the page scrolls to the entries. The Singapore **ring** highlights when Singapore is selected.
- Open `/journey?trip=canada` directly → Canada is highlighted on load.
- Homepage (`/`): click a country in the teaser map → navigates to `/journey?trip=<that country>#map` with that country pre-highlighted.

Expected: all of the above behave as described. (Stop the dev server when done.)

---

## Task 5: Remove the old map, drop MapLibre, clean dead CSS

**Files:**
- Delete: `src/components/JourneyMap.astro`
- Modify: `package.json` (remove `maplibre-gl`)
- Modify: `src/lib/content.ts` (remove now-unused `getMapEntries`)
- Modify: `src/styles/pages.css` (`.jbig__field` chrome)

- [ ] **Step 1: Delete the old component**

Run: `rm /Users/baiweizhong/detourist/src/components/JourneyMap.astro`

- [ ] **Step 2: Remove the MapLibre dependency**

Run: `npm uninstall maplibre-gl`

- [ ] **Step 3: Remove the now-unused `getMapEntries` from `src/lib/content.ts`**

Delete the whole function (no remaining callers — confirmed):
```ts
/** Entries that have a geopoint, oldest-first so the route line draws in order. */
export async function getMapEntries(): Promise<Entry[]> {
  const entries = await getEntries();
  return entries
    .filter((e) => e.location)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
```

- [ ] **Step 4: Strip the map-field placeholder chrome in `src/styles/pages.css`**

The old map filled a fixed-height dashed box; the new white-sphere SVG is its own frame. Find:
```css
.jbig__field{position:relative;z-index:2;height:clamp(360px,52vw,540px);border-radius:16px;
  background:rgba(255,255,255,.08);border:2px dashed rgba(255,255,255,.32);overflow:hidden;}
```
Replace with:
```css
.jbig__field{position:relative;z-index:2;border-radius:16px;overflow:hidden;}
```

- [ ] **Step 5: Remove the responsive fixed height in `src/styles/pages.css`**

Find (inside the `@media(max-width:520px)` block):
```css
  .jbig__field{height:380px;}
```
Delete that line.

- [ ] **Step 6: Build and assert MapLibre + old map are gone, maps still render**

Run: `npm run build`
Expected: `[build] Complete!`, 15 pages.

Run: `grep -rn "maplibre\|JourneyMap" /Users/baiweizhong/detourist/src`
Expected: **no output** (no lingering references).

Run: `grep -c "maplibre" /Users/baiweizhong/detourist/package.json`
Expected: `0`.

Run: `grep -rc "maplibregl" /Users/baiweizhong/detourist/dist/*.html /Users/baiweizhong/detourist/dist/journey/index.html | grep -v ':0' || echo "no maplibre in output"`
Expected: `no maplibre in output` (the heavy lib is no longer shipped).

Run: `grep -c 'wm__sphere' dist/journey/index.html`
Expected: `1` (the choropleth still renders on Journey).

---

## Task 6: Update `CLAUDE.md` Map section

**Files:**
- Modify: `CLAUDE.md` (the `## Map` section)

- [ ] **Step 1: Replace the Map section**

Find the current section:
```markdown
## Map

Rendered with MapLibre GL JS using OpenFreeMap vector tiles. The map style is
**customized to the site's palette** (not a generic gray basemap). One marker
per entry `geopoint`; optionally connect markers by `date` to draw a route.
Implement it as a client-side Astro island — keep the rest of the page static.
```
Replace with:
```markdown
## Map

A **static world choropleth**, generated at build time by `WorldMap.astro` using
`d3-geo` + `topojson-client` over a `world-atlas` TopoJSON. Each **visited country**
(derived from a trip's `region`, via `getVisitedCountries()`) is filled in its trip
color; the rest of the world is gray. The projection is `geoNaturalEarth1` with a
faint graticule and a white sphere — a flat "poster" map, not a slippy tile map. The
heavy libraries run **only at build**; the browser receives plain inline SVG.

Tiny countries that have no usable polygon at world scale (e.g. Singapore) get a
small trip-colored locator ring via the `marker` field on `VisitedCountry`.

Interaction: on the homepage teaser, visited countries are static `<a>` deep-links to
`/journey?trip=<region>#map`. On the Journey page the map is linked to the browse-by-trip
filter **both directions** — selecting a tab highlights that country, and clicking a
country filters the entries. There is no per-entry pin or route line (browsing is by
trip/country only). Do NOT reintroduce MapLibre or an SSR adapter — the map is static SVG.
```

- [ ] **Step 2: Verify the section reads correctly**

Run: `grep -n "MapLibre" /Users/baiweizhong/detourist/CLAUDE.md`
Expected: the only remaining mention is the line that says *not* to reintroduce MapLibre (no stale "Rendered with MapLibre GL JS" claim).

---

## Self-Review

**1. Spec coverage** — every spec section maps to a task:
- Pure country choropleth, per-trip colors → Task 3 (`WorldMap.astro` fills + `COLOR_HEX`).
- Build-time SVG, libs not shipped → Task 1 + Task 3 (frontmatter render) + Task 5 Step 6 assertion.
- `getVisitedCountries` + `VisitedCountry` + `REGION_ISO`/`REGION_MARKER` → Task 2.
- Bidirectional filter ↔ map → Task 4 Step 6 script.
- Both places (teaser static `<a>`, full interactive) → Task 3 (teaser) + Task 4 (full).
- Singapore locator ring → Task 2 (`REGION_MARKER`) + Task 3 (`rings`) + asserted Task 3 Step 6.
- Keep existing teal cards → no card-color change; only the inner `.jbig__field` chrome is stripped (Task 5). (Note: the Journey map card `.jbig` is **teal**, not paper as the spec prose said — corrected here; no behavior change.)
- Remove MapLibre + old component + dead code → Task 5.
- Update CLAUDE.md → Task 6.

**2. Placeholder scan** — no "TBD/TODO/handle edge cases"; every code step shows full code; `VB_H = 450` is a concrete cosmetic constant with a one-line rationale, not a deferral.

**3. Type consistency** — `VisitedCountry` fields (`key, region, color, iso, live, marker`) defined in Task 2 are used identically in Task 3 (`cp.visited.key`, `.region`, `.color`, `c.marker`) and Task 4 (`visited.length`). `getVisitedCountries()` signature matches its callers in both pages. `data-key` is written by `WorldMap.astro` (Task 3) and read by the Journey script (Task 4) — same attribute name. `COLOR_HEX` keys match `TripColor`.

**Open follow-up:** SVG inline markup size is acceptable per the spec (110m dataset, gzips well); no action unless it proves heavy.
