// ============================================================
// Bundled SEED content — used when no Sanity project is configured, so the
// site builds and previews immediately. Lifted from the design prototype's
// placeholder copy, given real geopoints + coherent trip dates. All images
// are null (PhotoSlot renders the labeled "drop-in" placeholder); replace by
// authoring real content in Sanity, no code change needed.
// ============================================================
import type { Trip, Entry, PortableBlock, GalleryImage, TripColor, SlotTint } from './types';

// ---------- small Portable Text authoring helpers ----------
const p = (text: string): PortableBlock => ({ _type: 'block', style: 'normal', children: [{ _type: 'span', text }] });
const h2 = (text: string): PortableBlock => ({ _type: 'block', style: 'h2', children: [{ _type: 'span', text }] });
const li = (text: string): PortableBlock => ({ _type: 'block', listItem: 'bullet', children: [{ _type: 'span', text }] });
const quote = (text: string): PortableBlock => ({ _type: 'pullQuote', text });
const tip = (heading: string, text: string): PortableBlock => ({ _type: 'tip', heading, text });

// ---------- trips ----------
export const seedTrips: Trip[] = [
  {
    _id: 'trip-malaysia',
    name: 'Malaysia',
    slug: 'malaysia',
    region: 'Malaysia',
    startDate: '2024-08-25',
    endDate: '2024-09-14',
    summary:
      "Three weeks of street food, murals and mountain tea — from George Town's painted lanes to the fog of the Cameron Highlands.",
    coverImage: null,
    color: 'magenta',
    duration: '3 weeks',
    routeLabel: '9 stops · Penang → Cameron Highlands',
  },
  {
    _id: 'trip-singapore',
    name: 'Singapore',
    slug: 'singapore',
    region: 'Singapore',
    startDate: '2024-09-26',
    endDate: '2024-09-30',
    summary:
      'Five days, one city, eaten thoroughly. Hawker stalls, glowing Supertrees and slow pastel mornings.',
    coverImage: null,
    color: 'teal',
    duration: '5 days',
    routeLabel: '1 city · eaten thoroughly',
  },
  {
    _id: 'trip-canada',
    name: 'Canada',
    slug: 'canada',
    region: 'Canada',
    startDate: '2026-05-25',
    endDate: null, // ongoing — drives the "Currently in Canada" hero
    summary:
      'An ongoing, slightly chaotic loop through the Rockies and the West Coast — written from the road in real time.',
    coverImage: null,
    color: 'coral',
    duration: undefined,
    routeLabel: 'ongoing · following along in real time',
  },
];

// ---------- entry factory ----------
const TRIPS_META = {
  malaysia: { slug: 'malaysia', name: 'Malaysia', color: 'magenta' as TripColor },
  singapore: { slug: 'singapore', name: 'Singapore', color: 'teal' as TripColor },
  canada: { slug: 'canada', name: 'Canada', color: 'coral' as TripColor },
};
type TripKey = keyof typeof TRIPS_META;

interface EntryInput {
  id: string;
  title: string;
  slug: string;
  trip: TripKey;
  date: string;
  location: { name: string; lat: number; lng: number } | null;
  coverLabel: string;
  coverTint: SlotTint;
  excerpt: string;
  readMins: number;
  featured?: boolean;
  gallery?: GalleryImage[];
  body: PortableBlock[];
}

function mkEntry(i: EntryInput): Entry {
  const t = TRIPS_META[i.trip];
  return {
    _id: i.id,
    title: i.title,
    slug: i.slug,
    tripSlug: t.slug,
    tripName: t.name,
    tripColor: t.color,
    tripKey: i.trip,
    date: i.date,
    location: i.location,
    coverImage: { asset: null, alt: i.coverLabel, label: i.coverLabel, tint: i.coverTint },
    coverTint: i.coverTint,
    gallery: i.gallery ?? [],
    body: i.body,
    excerpt: i.excerpt,
    featured: Boolean(i.featured),
    readMins: i.readMins,
  };
}

// the full-treatment gallery from the design (Lake Louise entry)
const lakeLouiseGallery: GalleryImage[] = [
  { asset: null, alt: 'The lake reflection at 6:14am', label: 'the reflection, 6:14am', tint: 'teal', tilt: 'l', tape: 'teal', caption: 'glass water ✦' },
  { asset: null, alt: 'First light hitting the peak', label: 'first light on the peak', tint: 'gold', tilt: 'r', pin: 'gold', caption: 'gold hour' },
  { asset: null, alt: 'My very wrong jacket', label: 'my very wrong jacket', tint: 'coral', tilt: 'r' },
  { asset: null, alt: 'The very calm elk', label: 'the calm elk', tint: 'magenta', tilt: 'l' },
  { asset: null, alt: 'Canoes still stacked for the morning', label: 'canoes, still stacked', tint: 'sky', tilt: 'l', pin: 'teal' },
  { asset: null, alt: 'That hard-earned breakfast sandwich', label: 'that breakfast sandwich', tint: 'gold', tilt: 'r', caption: 'earned it 🥪' },
];

// ---------- entries ----------
export const seedEntries: Entry[] = [
  // ===== CANADA (ongoing — newest last entry is "live") =====
  mkEntry({
    id: 'entry-lake-louise',
    title: 'Sunrise at Lake Louise (and why I cried a little)',
    slug: 'sunrise-at-lake-louise',
    trip: 'canada',
    date: '2026-06-04T06:30:00Z',
    location: { name: 'Lake Louise, Alberta', lat: 51.4254, lng: -116.1773 },
    coverLabel: 'photo · sunrise over Lake Louise',
    coverTint: 'coral',
    excerpt:
      "I set three alarms to catch the light hit the water. Turns out the lake didn't care about my schedule, and neither did the moose blocking the trailhead…",
    readMins: 6,
    featured: true,
    gallery: lakeLouiseGallery,
    body: [
      p("I set three alarms the night before. Not because I'm disciplined — quite the opposite — but because I knew that if I rolled over even once, the light would happen without me and I'd spend the whole rest of the trip pretending I wasn't bitter about it."),
      p("The trailhead was pitch dark and colder than my phone had promised. I'd packed exactly the wrong jacket. Somewhere off to the left, something large and unbothered moved through the trees, and I made the executive decision to walk a little faster and think about it later."),
      quote('And then the lake just… appeared. Flat as glass, holding the entire mountain upside down.'),
      {
        _type: 'block',
        style: 'normal',
        children: [
          { _type: 'span', text: "I'd seen the photos. Everyone's seen the photos. What the photos don't tell you is how " },
          { _type: 'span', text: 'quiet', marks: ['em'] },
          { _type: 'span', text: " it is — the kind of quiet that makes you lower your voice even when there's nobody to talk to. I stood there with my wrong jacket and my cheap gas-station coffee and felt, embarrassingly, a little teary. Don't tell anyone." },
        ],
      },
      h2('Getting there before the crowds'),
      p("If you want the lake to yourself, the window is brutally early — but it's worth it. Here's roughly what worked for me:"),
      li('Arrive at least 45 minutes before sunrise. The parking lot fills frighteningly fast.'),
      li('Bring more layers than you think you need, then bring one more.'),
      li('The far shoreline path is where the reflection sits perfectly still.'),
      li('Coffee in a thermos beats coffee from a paper cup you have to hold with frozen fingers.'),
      tip('Field note', 'The moose, it turns out, was a very large and very calm elk. We made brief eye contact. It was clearly more comfortable being awake at 5am than I was.'),
      h2('The part nobody photographs'),
      p('About twenty minutes after the sun cleared the ridge, the colour drained out of everything and the crowds rolled in with their tripods and their drones. I packed up, walked back to the car, and ate the worst, best breakfast sandwich of my life in the driver’s seat with the heater on full.'),
      p("That's the bit I'll actually remember. Not the postcard shot — the sandwich, the heater, the slightly smug feeling of having earned the morning. Travel keeps teaching me that the good part is almost never the part you planned."),
      { _type: 'gallery', heading: 'From the morning', note: '— six frames, one cold sunrise', images: lakeLouiseGallery },
      p("If you're following along from somewhere warmer: I'm okay, the jacket situation has been resolved, and I'd do the whole freezing morning again in a heartbeat. Next stop, the Icefields Parkway — assuming I can find a gas station that's actually open."),
    ],
  }),
  mkEntry({
    id: 'entry-icefields',
    title: 'Driving the Icefields Parkway with no plan',
    slug: 'driving-the-icefields-parkway',
    trip: 'canada',
    date: '2026-06-01T15:00:00Z',
    location: { name: 'Icefields Parkway, Alberta', lat: 52.2168, lng: -117.183 },
    coverLabel: 'photo · the Icefields Parkway',
    coverTint: 'gold',
    excerpt:
      'Two hundred kilometres of glaciers, one playlist on repeat, and a tank of gas I cut way too close…',
    readMins: 7,
    body: [
      p("Two hundred and thirty kilometres of glaciers, turquoise lakes and not a single open gas station — that's the Icefields Parkway in a sentence. I'd been warned. I did not listen."),
      p('I left Lake Louise with three-quarters of a tank and the unshakeable confidence of a man who has never once run out of fuel. By the Columbia Icefield that confidence had curdled into arithmetic, and I was doing the kind of mental math you only do when the next pump might be a hundred kilometres away.'),
      quote('Every viewpoint looked like a screensaver someone had clearly faked. They had not.'),
      p('I made it, obviously — coasting the downhill stretches in neutral like that would help, pulling into Saskatchewan River Crossing on fumes and pure spite. Worth it. I’d do it again tomorrow, with a full tank and slightly more humility.'),
      tip('Field note', 'Fill up in Lake Louise or Jasper. The Crossing has fuel but the hours are a rumour, and the prices will make your eyes water more than the glaciers.'),
    ],
  }),
  mkEntry({
    id: 'entry-vancouver',
    title: 'First impressions of Vancouver, in the rain',
    slug: 'first-impressions-of-vancouver',
    trip: 'canada',
    date: '2026-05-28T18:00:00Z',
    location: { name: 'Vancouver, BC', lat: 49.2827, lng: -123.1207 },
    coverLabel: 'photo · Vancouver seawall',
    coverTint: 'teal',
    excerpt: 'Everyone warned me about the drizzle. Nobody warned me about the cinnamon buns…',
    readMins: 4,
    body: [
      p('Everyone warned me about the rain. Nobody thought to mention the cinnamon buns, which feels like a far more important piece of information to lead with.'),
      p("I landed to a sky the colour of wet concrete and a forecast that just said 'yes.' So I did the only sensible thing: bought an umbrella I'd lose within the day, and walked the entire seawall anyway, soaked and grinning."),
      quote("Turns out a city is just better when nobody's pretending the weather is fine."),
      p("Stanley Park in the drizzle, steam off a paper cup, the mountains showing up for about four minutes between clouds like a magician's reveal. I get it now. I'd move here on the strength of one rainy afternoon."),
    ],
  }),
  mkEntry({
    id: 'entry-banff',
    title: 'A bear, a bakery, and the best day in Banff',
    slug: 'best-day-in-banff',
    trip: 'canada',
    date: '2026-06-06T17:00:00Z',
    location: { name: 'Banff National Park, Alberta', lat: 51.1784, lng: -115.5708 },
    coverLabel: 'photo · Banff townsite at dusk',
    coverTint: 'magenta',
    excerpt: 'It started with an elk in the parking lot and somehow ended with me adopting a new favourite town…',
    readMins: 5,
    body: [
      p('It started with an elk in the parking lot, the way the best days here seem to, and ended with me quietly deciding this was my new favourite town on earth.'),
      p('Banff is almost too pretty to be real — a postcard someone propped up against the Rockies and forgot to take down. I expected to find it cheesy. Instead I found a bakery, made friends with the person behind the counter, and stayed three days longer than planned.'),
      tip('Field note', 'The elk are not pets. A very patient ranger reminded me of this. The elk, for its part, seemed entirely unbothered by either of us.'),
      p("I'm writing this from a cabin with surprisingly good wifi, a little footsore and completely happy. This is where the map says I am right now. For once, the map and I agree."),
    ],
  }),

  // ===== SINGAPORE =====
  mkEntry({
    id: 'entry-hawker',
    title: '72 hours of hawker food in Singapore',
    slug: '72-hours-of-hawker-food',
    trip: 'singapore',
    date: '2024-09-30T12:00:00Z',
    location: { name: 'Maxwell, Singapore', lat: 1.2803, lng: 103.8447 },
    coverLabel: 'photo · hawker stall, Maxwell',
    coverTint: 'teal',
    excerpt: 'A loose plan, an elastic waistband, and a list of stalls from a stranger on the train…',
    readMins: 4,
    featured: true,
    body: [
      p("The plan was loose, the waistband looser, and the list of stalls came from a stranger on the MRT who overheard me mispronouncing 'char kway teow' and took pity."),
      p('Seventy-two hours, one mission: eat. Maxwell for chicken rice, Old Airport Road for everything else, Tiong Bahru for the kind of kaya toast that ruins all other kaya toast forever. I kept a tally. I lost the tally somewhere around plate eleven.'),
      quote('Singapore doesn’t have a food scene. Singapore is a food scene that happens to have a city attached.'),
      p("I rolled onto my flight out heavier, happier, and already plotting a return built entirely around the stalls I didn't get to. There were a lot of stalls I didn't get to."),
    ],
  }),
  mkEntry({
    id: 'entry-supertrees',
    title: 'Looking up: a night among the Supertrees',
    slug: 'a-night-among-the-supertrees',
    trip: 'singapore',
    date: '2024-09-28T20:00:00Z',
    location: { name: 'Gardens by the Bay, Singapore', lat: 1.2816, lng: 103.8636 },
    coverLabel: 'photo · Gardens by the Bay',
    coverTint: 'gold',
    excerpt: "I'm not usually a botanical-gardens person. Then the whole grove lit up and I changed my mind…",
    readMins: 5,
    body: [
      p('I am not, by nature, a botanical-gardens person. I went to Gardens by the Bay fully prepared to be politely unimpressed, mostly to get out of the heat.'),
      p('Then the sun went down and the whole grove of Supertrees lit up and started, improbably, to sing. I stood in the middle of it with my neck craned back like a tourist in a movie about tourists. Reader, I was moved.'),
      quote("Sometimes the touristy thing is touristy because it's actually that good."),
    ],
  }),
  mkEntry({
    id: 'entry-tiong-bahru',
    title: 'A slow morning in Tiong Bahru',
    slug: 'a-slow-morning-in-tiong-bahru',
    trip: 'singapore',
    date: '2024-09-26T09:00:00Z',
    location: { name: 'Tiong Bahru, Singapore', lat: 1.2847, lng: 103.8329 },
    coverLabel: 'photo · shophouses, Tiong Bahru',
    coverTint: 'magenta',
    excerpt: 'Coffee, kaya toast, and an hour of doing absolutely nothing on a pastel-coloured corner…',
    readMins: 3,
    body: [
      p('Some mornings the only itinerary worth keeping is a coffee, a slab of kaya toast, and an hour of doing absolutely nothing on a pastel-coloured corner.'),
      p("Tiong Bahru is all curved 1930s shophouses, sleepy cats and bookshops that double as cafés. I'd meant to stay forty minutes. I stayed until lunch, then stayed for lunch."),
      quote('The best souvenir I brought home from Singapore was the habit of slowing down.'),
    ],
  }),

  // ===== MALAYSIA =====
  mkEntry({
    id: 'entry-george-town',
    title: 'Getting gloriously lost in George Town',
    slug: 'getting-lost-in-george-town',
    trip: 'malaysia',
    date: '2024-09-12T11:00:00Z',
    location: { name: 'George Town, Penang', lat: 5.4141, lng: 100.3288 },
    coverLabel: 'photo · George Town mural',
    coverTint: 'magenta',
    excerpt: 'Every wrong turn in Penang ended at something delicious or something painted on a wall…',
    readMins: 5,
    featured: true,
    body: [
      p('Every wrong turn in George Town ended at something delicious or something painted on a wall, and after a while I stopped trying to navigate and just followed whichever smell or colour was loudest.'),
      p('The murals send you on a treasure hunt across the old town — a boy on a bike here, two kids on a swing there — and somewhere between them you trip over the best laksa of your life in a doorway with no sign and no name.'),
      quote('I came for the street art and stayed for the breakfast. This will be a recurring theme.'),
      tip('Field note', 'Go early. By eleven the heat turns the cobblestones into a frying pan and the mural queues turn into actual queues.'),
    ],
  }),
  mkEntry({
    id: 'entry-kl',
    title: 'Kuala Lumpur at street level',
    slug: 'kuala-lumpur-at-street-level',
    trip: 'malaysia',
    date: '2024-09-08T13:00:00Z',
    location: { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 },
    coverLabel: 'photo · KL skyline, Petronas',
    coverTint: 'gold',
    excerpt: 'Everyone photographs the towers. I spent my time three floors down, where the satay smoke lives…',
    readMins: 6,
    body: [
      p('Everyone photographs the towers. I spent most of my time three floors down, in the alleys where the satay smoke lives and the real city actually happens.'),
      p('Kuala Lumpur rewards the street-level wanderer: a tangle of hawker stalls, gold-trimmed mosques, colonial leftovers and glass towers all elbowing for the same patch of sky. I ate my way through Jalan Alor twice and regret nothing.'),
      quote('Look up for the skyline, sure. But look down for dinner.'),
    ],
  }),
  mkEntry({
    id: 'entry-cameron',
    title: 'Tea, fog, and switchbacks in the Highlands',
    slug: 'tea-fog-switchbacks-cameron-highlands',
    trip: 'malaysia',
    date: '2024-09-04T10:00:00Z',
    location: { name: 'Cameron Highlands', lat: 4.4712, lng: 101.3776 },
    coverLabel: 'photo · tea fields, Cameron Highlands',
    coverTint: 'teal',
    excerpt: 'The bus driver took the corners like a rally pro. The reward at the top was worth every queasy minute…',
    readMins: 4,
    body: [
      p("The bus driver took the switchbacks like a man with somewhere urgent to be, and by the third hairpin I'd made peace with several gods I don't normally consult."),
      p('Then the air went cool and green and the whole world turned into rows and rows of tea, combed across the hills like corduroy. I drank a pot of it at the top, queasiness forgotten, and understood why people make the trip.'),
      quote('Worth every nauseating corner. I’d just maybe sit at the front next time.'),
    ],
  }),
  mkEntry({
    id: 'entry-langkawi',
    title: 'Doing nothing, beautifully, in Langkawi',
    slug: 'doing-nothing-in-langkawi',
    trip: 'malaysia',
    date: '2024-08-30T16:00:00Z',
    location: { name: 'Langkawi', lat: 6.35, lng: 99.8 },
    coverLabel: 'photo · Langkawi beach',
    coverTint: 'coral',
    excerpt: 'My grand plan was to be productive. Instead I read two books and learned the names of three beach dogs…',
    readMins: 5,
    body: [
      p('My grand plan for Langkawi was to be productive — catch up on writing, sort my photos, become a better-organised person. Instead I read two novels and learned the names of three beach dogs.'),
      p('The island has a way of dissolving ambition. Days became a loop of swim, eat, nap, repeat, punctuated by sunsets so theatrical they felt slightly unfair to everywhere else I’d ever watched one.'),
      quote('Doing nothing, it turns out, is a skill. I got very good at it.'),
    ],
  }),
  mkEntry({
    id: 'entry-night-market',
    title: 'A field guide to the Penang night market',
    slug: 'penang-night-market-field-guide',
    trip: 'malaysia',
    date: '2024-08-27T19:30:00Z',
    location: { name: 'George Town, Penang', lat: 5.425, lng: 100.332 },
    coverLabel: 'photo · night market, Penang',
    coverTint: 'gold',
    excerpt: "Char kway teow, cendol, and the art of pointing hopefully at things you can't pronounce…",
    readMins: 4,
    body: [
      p('A field guide to the Penang night market, in one rule: point hopefully at whatever the longest local queue is buying, and eat it before you ask what it was.'),
      p('Char kway teow hissing off a wok the size of a satellite dish, cendol sweet enough to fix any mood, durian for the brave and the foolish. I qualified as both before the night was done.'),
      tip('Field note', 'Bring small notes and an empty stomach, in that order. The good stalls move fast and do not love breaking a fifty.'),
    ],
  }),
];
