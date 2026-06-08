import { defineCliConfig } from 'sanity/cli';

// Used by the Sanity CLI (`sanity dev` / `sanity deploy`). `studioHost` fixes the
// hosted Studio URL to https://detourist.sanity.studio so deploys are
// non-interactive. The Studio is the author-facing CMS (works on mobile) and is
// the single source of truth; Astro reads the same dataset at build time.
export default defineCliConfig({
  api: {
    projectId: 'qrrikls2',
    dataset: 'production',
  },
  studioHost: 'detourist',
  autoUpdates: true,
});
