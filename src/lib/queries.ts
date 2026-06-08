// GROQ queries. These project Sanity documents into a shape close to our
// types; content.ts finishes the mapping (derived colours, reading time, etc.).

export const TRIPS_QUERY = /* groq */ `
*[_type == "trip"] | order(startDate asc) {
  _id,
  name,
  "slug": slug.current,
  region,
  startDate,
  endDate,
  summary,
  coverImage{ ..., "alt": coalesce(alt, "") }
}`;

export const ENTRIES_QUERY = /* groq */ `
*[_type == "entry"] | order(date desc) {
  _id,
  title,
  "slug": slug.current,
  date,
  excerpt,
  featured,
  location{ name },
  coverImage{ ..., "alt": coalesce(alt, "") },
  body[]{
    ...,
    _type == "gallery" => { ..., images[]{ ..., "alt": coalesce(alt, "") } }
  },
  "tripId": trip._ref,
  "tripName": trip->name,
  "tripSlug": trip->slug.current,
  "tripRegion": trip->region
}`;

export const SITE_SETTINGS_QUERY = /* groq */ `
*[_type == "siteSettings"][0]{
  portrait{ ..., "alt": coalesce(alt, "") },
  journeyHero{ ..., "alt": coalesce(alt, "") },
  homeHeroPrimary{ ..., "alt": coalesce(alt, "") },
  homeHeroSecondary{ ..., "alt": coalesce(alt, "") }
}`;
