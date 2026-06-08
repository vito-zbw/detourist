import { defineArrayMember, defineField, defineType } from 'sanity';

const altField = defineField({
  name: 'alt',
  title: 'Alt text',
  type: 'string',
  description: 'Describe the image for screen readers. Required.',
  validation: (r) => r.required(),
});

export const entry = defineType({
  name: 'entry',
  title: 'Entry',
  type: 'document',
  fields: [
    defineField({ name: 'title', title: 'Title', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'trip',
      title: 'Trip',
      type: 'reference',
      to: [{ type: 'trip' }],
      validation: (r) => r.required(),
    }),
    defineField({ name: 'date', title: 'Date', type: 'datetime', validation: (r) => r.required() }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'object',
      description: 'Where this entry took place — just the place name. Shown on the entry and the homepage hero.',
      fields: [
        defineField({ name: 'name', title: 'Place name', type: 'string' }),
      ],
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover image',
      type: 'image',
      options: { hotspot: true },
      fields: [altField],
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'block',
          styles: [
            { title: 'Normal', value: 'normal' },
            { title: 'Heading', value: 'h2' },
          ],
          lists: [{ title: 'Bullet', value: 'bullet' }],
          marks: {
            decorators: [
              { title: 'Strong', value: 'strong' },
              { title: 'Emphasis', value: 'em' },
            ],
            annotations: [
              {
                name: 'link',
                type: 'object',
                title: 'Link',
                fields: [{ name: 'href', type: 'url', title: 'URL' }],
              },
            ],
          },
        }),
        // inline single image
        defineArrayMember({
          type: 'image',
          name: 'image',
          title: 'Image',
          options: { hotspot: true },
          fields: [altField, defineField({ name: 'caption', title: 'Caption', type: 'string' })],
        }),
        // coral pull-quote
        defineArrayMember({
          type: 'object',
          name: 'pullQuote',
          title: 'Pull quote',
          fields: [defineField({ name: 'text', title: 'Quote', type: 'text', rows: 2 })],
          preview: { select: { title: 'text' }, prepare: ({ title }) => ({ title: `“${title ?? ''}”` }) },
        }),
        // teal "Field note" callout
        defineArrayMember({
          type: 'object',
          name: 'tip',
          title: 'Field note',
          fields: [
            defineField({ name: 'heading', title: 'Heading', type: 'string', initialValue: 'Field note' }),
            defineField({ name: 'text', title: 'Text', type: 'text', rows: 3 }),
          ],
          preview: { select: { title: 'heading', subtitle: 'text' } },
        }),
        // inline polaroid gallery
        defineArrayMember({
          type: 'object',
          name: 'gallery',
          title: 'Photo gallery',
          fields: [
            defineField({ name: 'heading', title: 'Heading', type: 'string' }),
            defineField({ name: 'note', title: 'Note', type: 'string' }),
            defineField({
              name: 'images',
              title: 'Images',
              type: 'array',
              of: [
                defineArrayMember({
                  type: 'image',
                  options: { hotspot: true },
                  fields: [altField, defineField({ name: 'caption', title: 'Caption', type: 'string' })],
                }),
              ],
            }),
          ],
          preview: { select: { title: 'heading' }, prepare: ({ title }) => ({ title: title ?? 'Photo gallery' }) },
        }),
      ],
    }),
    defineField({ name: 'excerpt', title: 'Excerpt', type: 'text', rows: 2 }),
    defineField({
      name: 'featured',
      title: 'Featured on homepage',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  orderings: [{ title: 'Date, newest', name: 'dateDesc', by: [{ field: 'date', direction: 'desc' }] }],
  preview: {
    select: { title: 'title', subtitle: 'date', media: 'coverImage' },
  },
});
