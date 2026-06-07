import { defineField, defineType } from 'sanity';

// Singleton (fixed _id: "siteSettings") holding site "chrome" images that
// aren't tied to a trip or entry — the About portrait, the Journey header
// background, and the two homepage hero-collage photos. Editable in the Studio;
// also settable via scripts/site/upload-site.ts.
const imageField = (name: string, title: string, description: string) =>
  defineField({
    name,
    title,
    type: 'image',
    options: { hotspot: true },
    description,
    fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string', validation: (r) => r.required() })],
  });

export const siteSettings = defineType({
  name: 'siteSettings',
  title: 'Site settings',
  type: 'document',
  fields: [
    imageField('portrait', 'Portrait', 'About page portrait photo.'),
    imageField('journeyHero', 'Journey hero background', 'Background photo behind the Journey page title.'),
    imageField('homeHeroPrimary', 'Home hero — primary', 'Larger photo in the homepage hero collage.'),
    imageField('homeHeroSecondary', 'Home hero — secondary', 'Smaller photo in the homepage hero collage.'),
  ],
  preview: { prepare: () => ({ title: 'Site settings' }) },
});
