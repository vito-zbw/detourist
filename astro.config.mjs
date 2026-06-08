import { defineConfig } from 'astro/config';

// Detourist is a fully STATIC site. Content is pulled from Sanity (or the
// bundled seed fallback) at BUILD time and rendered to HTML — there is no SSR
// adapter. This is intentional: the publish-from-phone flow works by having
// Sanity fire a webhook on publish that triggers a Cloudflare Pages rebuild.
// Do not add an SSR/on-demand adapter unless that flow is being replaced.
export default defineConfig({
  site: 'https://detourist.pages.dev',
});
