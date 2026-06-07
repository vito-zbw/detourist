# Detourist

A vibrant, handcrafted personal travel blog — visual-forward, scrapbook
texture, strong first-person voice. Built to publish new entries **from a
phone while traveling**.

- **Astro** (static, no SSR) · **Sanity** (headless CMS) · **MapLibre GL JS +
  OpenFreeMap** (custom-styled journey map) · **Cloudflare Pages** · TypeScript.

See [`CLAUDE.md`](./CLAUDE.md) for the full architecture, content model, and
deployment notes.

## Quick start

```bash
npm install
npm run dev      # local dev server
npm run build    # static build -> dist/
npm run preview  # preview the build
npm run check    # astro type-check
```

The site builds with **no configuration**: with no Sanity project set, it uses
the bundled seed content in `src/lib/seed.ts`, so `npm run dev` / `npm run
build` work out of the box.

## Content: Sanity or seed

`src/lib/content.ts` is the single content access layer. It reads from Sanity
when `SANITY_PROJECT_ID` is set (see [`.env.example`](./.env.example)), and
otherwise falls back to the seed. Pages/components never touch Sanity directly.

To run the author-facing Studio (matching schemas in `sanity/schema/`):

```bash
npm i sanity @sanity/vision react react-dom
SANITY_STUDIO_PROJECT_ID=<id> SANITY_STUDIO_DATASET=production npx sanity dev
```

## Pages

- `/` — "Currently in {trip}" hero, featured entries, browse-by-trip, map teaser
- `/journey` — full journey map (`#map`) + browse-by-trip filter + all entries
- `/entries/[slug]` — single entry (cover, Portable Text body, gallery, related)
- `/about` — about / start here

## Structure

```
src/
  components/   PhotoSlot, Polaroid, EntryCard, Stamp, PortableText,
                JourneyMap (MapLibre island), Nav, Footer
  layouts/      Layout.astro
  lib/          content.ts (source switch) · sanity.ts · queries.ts ·
                seed.ts · types.ts
  pages/        index · journey · entries/[slug] · about
  styles/       blog.css (design system) · home.css · pages.css
sanity/         Studio schemas (trip, entry)
```

Images flow through Sanity's image pipeline (`PhotoSlot`); every image has alt
text. Where no image exists yet, the design's labeled placeholder slot renders.
