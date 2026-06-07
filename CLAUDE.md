# CLAUDE.md

Project instructions for Claude Code. Read this before making changes.

## Project

A personal travel blog — visual-forward, with a vibrant, bold, handcrafted
personality and a strong first-person voice. It documents past trips and one
ongoing trip:

- **Malaysia 2024** — 7 diary entries (existing)
- **Singapore 2024** — 10 diary entries (existing)
- **Cross-Canada 2026** — solo trip, documented live while traveling (ongoing)

A core requirement: the author must be able to **publish new entries from a
phone while traveling**. The architecture below exists to support that.

## Tech stack

- **Astro** — static site generator (build-time rendering, minimal client JS)
- **Sanity** — headless CMS; the single source of truth for all content
- **d3-geo + topojson-client + world-atlas** — build-time static SVG world choropleth (no client-side map library)
- **Cloudflare Pages** — hosting
- **TypeScript** throughout

## Architecture & data flow

Content is authored in Sanity. Astro pulls it at **build time** and renders a
fully **static** site, which is hosted on Cloudflare Pages.

Publishing flow (this is what enables phone publishing):

1. Author publishes an entry in the Sanity Studio (works on mobile).
2. Sanity fires a **webhook** on publish.
3. The webhook hits a **Cloudflare Pages Deploy Hook** (a URL that triggers a
   build).
4. Cloudflare rebuilds and redeploys the static site (~1 minute).

The site is fully static — **do not add an SSR adapter** unless this flow is
explicitly being replaced.

`src/lib/content.ts` is the single content access layer: when a Sanity project
is configured (`SANITY_PROJECT_ID` set) it fetches from Sanity, otherwise it
falls back to the bundled seed content in `src/lib/seed.ts` so the site builds
and previews with no credentials. Pages/components never touch Sanity directly.

## Content model (Sanity schemas)

Two document types.

### `trip`
- `name` (string)
- `slug` (slug, from name)
- `region` (string) — e.g. "Malaysia", "Canada"
- `startDate` (date)
- `endDate` (date, optional) — **leave empty for the ongoing trip; an empty
  `endDate` marks the current trip and drives the homepage hero**
- `coverImage` (image, with alt + hotspot)
- `summary` (text)

### `entry`
- `title` (string)
- `slug` (slug, from title)
- `trip` (reference → `trip`) — how entries group under a trip
- `date` (datetime)
- `location` (object: `name` string + `geopoint` lat/lng) — feeds the map
- `coverImage` (image, with alt + hotspot)
- `gallery` (array of images, each with alt)
- `body` (Portable Text / rich text — may embed images inline)
- `excerpt` (text) — short blurb for cards
- `featured` (boolean) — surfaces the entry in the homepage featured section

**Browsing is by trip only.** Do NOT add theme/category/tag fields or any
theme-based navigation — it is intentionally out of scope.

## Pages & routes

Four pages — the design ships exactly these. Nav is **Home · Journey · About**.

- `/` — homepage: a "Currently in {current trip}" hero (the trip with an empty
  `endDate`), a featured-entries section, browse-by-trip cards, and a journey
  map teaser.
- `/journey` — the stories hub: page header, the full journey map (`#map`
  anchor — the nav "Journey" link and the homepage teaser both deep-link here),
  a browse-by-trip filter (client-side, with `?trip=` deep links), and the
  all-entries grid.
- `/entries/[slug]` — a single entry: large cover photo, Portable Text body
  (may embed an inline gallery), prev/next, and related entries. One page is
  statically generated per entry.
- `/about` — About / Start Here page.

There is intentionally **no `/trips` or `/trips/[slug]`** — browsing by trip
lives in the `/journey` filter.

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

## Design direction

Vibrant, bold, handcrafted, visual-forward; big photography; strong personal
voice. The visual design originates from a Claude Design prototype handoff —
adapt that handoff into Astro components and styling, preserving its look.

The handoff's chosen defaults are **baked in** (not run-time toggles): Caveat
"script" headlines, a teal→coral color-block hero, and full "chaos" scrapbook
texture (`body.sb-chaos`). The prototype's React "Tweaks" panel is **not
shipped** — it was a design-time tool. The design system lives in
`src/styles/{blog,home,pages}.css`.

**Responsive is non-negotiable:** mobile and desktop are both first-class.
Readers and the author both use phones.

## Images

Serve images through Sanity's image pipeline (its image CDN handles
resizing/cropping via the stored hotspot). Use Astro's image handling for
further optimization where it applies. Every image must have alt text.

## Commands

- `npm run dev` — local dev server
- `npm run build` — production build (outputs to `dist/`)
- `npm run preview` — preview the production build locally

## Deployment (Cloudflare Pages)

- Framework preset: **Astro**. Build command: `npm run build`. Output
  directory: `dist`.
- Set these as environment variables in Cloudflare Pages (and in a local
  `.env`, which must never be committed):
  - `SANITY_PROJECT_ID`
  - `SANITY_DATASET`
  - `SANITY_API_READ_TOKEN` (only if the dataset is private)
- Create a **Cloudflare Pages Deploy Hook** and register its URL as a webhook
  in Sanity, triggered on document publish. This is the publish-from-phone
  rebuild trigger described in the architecture section.
- If a specific Node version is needed, set the `NODE_VERSION` environment
  variable in Cloudflare Pages.

## Conventions

- TypeScript everywhere.
- Keep client-side JavaScript minimal — use Astro islands only for genuinely
  interactive pieces (currently just the map).
- Keep all secrets in environment variables; never commit `.env`.

## Out of scope (do not add unless asked)

- Theme / category / tag browsing.
- SSR / on-demand rendering (the static + deploy-hook flow is intentional).
- Comments and search (may come later).
