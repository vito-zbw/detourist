# Detourist

**[Explore the live website →](https://detourist.pages.dev/)**

<img width="1512" height="727" alt="image" src="https://github.com/user-attachments/assets/c658132b-6e07-4637-8196-b5e708193bf6" />

A responsive personal travel journal built for publishing stories and photos from a phone while travelling. Detourist combines a scrapbook-inspired design with a content-driven publishing workflow: new trips and entries feed the site's pages, navigation, and travel summaries automatically on rebuild.

**Astro · TypeScript · Sanity · D3 · Cloudflare Pages**

## Highlights

- **Content-driven updates:** Homepage trip counts and related travel summaries are derived from content, so adding a trip updates them on rebuild without manual page edits.
- **Publish from a phone:** Write and publish in Sanity Studio; a publish webhook triggers a Cloudflare Pages rebuild and deployment.
- **Explore by destination:** Browse stories by trip, with linked country selections and shareable trip-filter URLs.
- **Lightweight world map:** Generate a country map at build time using D3 and TopoJSON; the browser receives SVG rather than a full mapping library.
- **Photo-first storytelling:** Rich-text entries, cover images, and galleries use Sanity's image pipeline for resizing and cropping.
- **Credential-free preview:** Bundled sample content lets developers explore the project without setting up a CMS account.

## Why this architecture?

The goal is to keep publishing convenient while serving a fully static site.

| Decision | Purpose |
| --- | --- |
| Astro build-time rendering | Serve prebuilt pages without an application server. |
| Sanity headless CMS | Separate content authoring from code changes and support mobile publishing. |
| Publish-triggered deployments | Refresh generated pages and content-derived information after publishing. |
| Build-time SVG map | Keep map-generation dependencies out of the browser bundle. |
| Shared content access layer | Keep pages independent of whether content comes from Sanity or local samples. |
| TypeScript | Define shared types for trips, entries, and content access. |

### Publishing flow

1. Create or update a trip or entry in Sanity Studio.
2. Publish the document.
3. Sanity calls the configured Cloudflare Pages Deploy Hook.
4. Astro fetches the content and regenerates the site.
5. Cloudflare Pages serves the updated pages.

Updates appear after deployment completes; the site does not require live CMS requests from visitors.

## Explore the site

| Route | Features |
| --- | --- |
| `/` | Current-trip hero, travel summaries, featured entries, trip cards, and map teaser. |
| `/journey` | World map, trip filters, and entry browsing. |
| `/entries/[slug]` | Individual stories with rich text, photography, and related entries. |
| `/about` | Background and introduction to the journal. |

## Run locally

Install Node.js and npm, then:

```bash
git clone https://github.com/vito-zbw/detourist.git
cd detourist
npm install
npm run dev
```

With no `SANITY_PROJECT_ID` configured, the site uses bundled content from `src/lib/seed.ts`. No CMS credentials are required for the sample-content preview.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server. |
| `npm run check` | Run Astro and TypeScript checks. |
| `npm test` | Run the Vitest suite. |
| `npm run build` | Generate the production site in `dist/`. |
| `npm run preview` | Preview the production build locally. |
| `npm run studio:dev` | Start Sanity Studio with the required project configuration. |

## Connect Sanity

Use `.env.example` as the configuration reference. Configure these variables for your own Sanity project:

```dotenv
SANITY_PROJECT_ID=your-project-id
SANITY_DATASET=production
# Only required for a private dataset:
SANITY_API_READ_TOKEN=your-read-token
```

Keep credentials in local environment files or hosting settings; never commit them.

The content model has two main document types:

- **Trip:** Name, slug, region, dates, cover image, and summary. A trip without an end date represents the current trip.
- **Entry:** Title, trip reference, date, location, cover image, gallery, rich-text body, excerpt, and featured status.

`src/lib/content.ts` provides the shared content access layer. Pages and components use that layer rather than querying Sanity directly.

## Deploy to Cloudflare Pages

1. Connect the repository to Cloudflare Pages.
2. Select the Astro framework preset.
3. Set the build command to `npm run build` and output directory to `dist`.
4. Add the Sanity environment variables.
5. Create a Cloudflare Pages Deploy Hook and configure a Sanity webhook to call it when content is published.

The output is fully static; no server-side rendering adapter is required.

## Project structure

```text
src/
  components/   Reusable UI components and build-time SVG map
  layouts/      Shared page layout
  lib/          Content access, queries, types, and sample content
  pages/        Home, journey, entry, and about routes
  styles/       Shared design system and page styles
sanity/         Content schemas and Studio configuration
scripts/        Content import and site utilities
```

## Development approach

Built with AI-assisted development tools, including Claude Code. The project combines content modelling, static site generation, responsive UI implementation, and deployment configuration around a practical publishing need.
