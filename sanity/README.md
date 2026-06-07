# Sanity Studio

The author-facing CMS and **single source of truth** for Detourist content.
These schema files match the `trip` / `entry` content model in the project
`CLAUDE.md`. The Astro site reads the same dataset at build time
(`src/lib/sanity.ts`); when no Sanity project is configured it falls back to
the bundled seed content in `src/lib/seed.ts`.

## Run the Studio

The Studio has its own dependencies that the static Astro build does **not**
need, so they are intentionally left out of the app `package.json`:

```bash
npm i sanity @sanity/vision react react-dom
SANITY_STUDIO_PROJECT_ID=<your-id> SANITY_STUDIO_DATASET=production npx sanity dev
```

`sanity.config.ts` (at the repo root) wires these schemas into the Studio.

## Publish-from-phone flow

1. Author publishes an entry in the Studio (works in the Sanity mobile app).
2. Sanity fires a **webhook** on publish.
3. The webhook hits a **Cloudflare Pages Deploy Hook** URL.
4. Cloudflare rebuilds and redeploys the static site (~1 minute).

Register the Deploy Hook URL as a Sanity webhook triggered on document
publish. See `CLAUDE.md` → Deployment.
