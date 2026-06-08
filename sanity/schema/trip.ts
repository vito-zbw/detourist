import { defineField, defineType } from 'sanity';

export const trip = defineType({
  name: 'trip',
  title: 'Trip',
  type: 'document',
  fields: [
    defineField({ name: 'name', title: 'Name', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'name', maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'region',
      title: 'Region',
      type: 'string',
      description: 'e.g. "Malaysia", "Singapore", "Canada" — also drives the trip accent colour.',
      validation: (r) => r.required(),
    }),
    defineField({ name: 'startDate', title: 'Start date', type: 'date', validation: (r) => r.required() }),
    defineField({
      name: 'endDate',
      title: 'End date',
      type: 'date',
      description:
        'Leave EMPTY for the ongoing trip. An empty end date marks the current trip and drives the "Last stop at …" homepage hero.',
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover image',
      type: 'image',
      options: { hotspot: true },
      fields: [defineField({ name: 'alt', title: 'Alt text', type: 'string', validation: (r) => r.required() })],
    }),
    defineField({ name: 'summary', title: 'Summary', type: 'text', rows: 3 }),
  ],
  preview: {
    select: { title: 'name', subtitle: 'region', media: 'coverImage' },
  },
});
