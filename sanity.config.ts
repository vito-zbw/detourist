import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './sanity/schema';

// Sanity Studio config. The Studio is the author-facing CMS — including the
// mobile app — and is the single source of truth for content. Astro reads the
// same dataset at build time (see src/lib/sanity.ts).
//
// To run / deploy the Studio (studio-only deps, intentionally kept OUT of the
// Astro build's package.json — install them locally first):
//   npm i --no-save sanity @sanity/vision react react-dom styled-components
//   npx sanity dev      # local at http://localhost:3333
//   npx sanity deploy   # hosted at detourist.sanity.studio (see sanity.cli.ts)
export default defineConfig({
  name: 'detourist',
  title: 'Detourist',
  projectId: process.env.SANITY_STUDIO_PROJECT_ID || 'qrrikls2',
  dataset: process.env.SANITY_STUDIO_DATASET || 'production',
  plugins: [structureTool(), visionTool()],
  schema: { types: schemaTypes },
});
