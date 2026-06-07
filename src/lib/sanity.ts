import { createClient, type SanityClient } from '@sanity/client';
import imageUrlBuilder from '@sanity/image-url';
import type { SanityImageSource } from './types';

// Read at BUILD time. import.meta.env covers the Astro/Vite path; process.env
// is a fallback for plain Node contexts. Non-public vars never reach the client.
const projectId = import.meta.env.SANITY_PROJECT_ID ?? process.env.SANITY_PROJECT_ID;
const dataset = import.meta.env.SANITY_DATASET ?? process.env.SANITY_DATASET ?? 'production';
const token = import.meta.env.SANITY_API_READ_TOKEN ?? process.env.SANITY_API_READ_TOKEN ?? undefined;

/** True when a Sanity project is configured. When false, the site builds
 *  against the bundled seed content (see content.ts). */
export const hasSanity = Boolean(projectId);

export const sanityClient: SanityClient | null = hasSanity
  ? createClient({
      projectId: projectId as string,
      dataset,
      apiVersion: '2024-02-01',
      // CDN is fine for public reads; bypass it when using a token.
      useCdn: !token,
      token,
      perspective: 'published',
    })
  : null;

const builder = hasSanity ? imageUrlBuilder({ projectId: projectId as string, dataset }) : null;

/** Build a Sanity image-pipeline URL (honours stored hotspot/crop). */
export function urlForImage(source: SanityImageSource) {
  if (!builder) throw new Error('Sanity is not configured; cannot build an image URL.');
  return builder.image(source as never);
}
