# Entry Image Lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let readers click/tap a photo in an entry body to expand it in a scrapbook-styled lightbox, paging within a gallery and opening standalone inline photos alone.

**Architecture:** Pure navigation/grouping logic lives in a unit-tested `src/lib/lightbox.ts`. PhotoSlot conditionally wraps body images in a `<button data-zoomable>` trigger carrying a large image URL + caption. A single `<Lightbox.astro>` component renders one native `<dialog>` plus a small vanilla `<script>` that collects the triggers, groups them by their `.gallery` ancestor, and drives open/close/navigate/keyboard/swipe. Zoom is switched on only in `PortableText.astro`, which is what keeps the cover photo and entry cards non-interactive.

**Tech Stack:** Astro 5, TypeScript, vitest (existing, node env), native HTML `<dialog>`, Sanity image-url builder. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-06-08-entry-image-lightbox-design.md`

**Testing convention:** This project unit-tests pure TS logic with vitest (`npm test`) — see `scripts/import/*.test.ts`. There is no component/DOM test harness, and adding one (jsdom/Playwright) for this small feature is out of scope. So Task 1 is full TDD; the Astro/DOM tasks are verified with `npm run check` (astro check / tsc) + `npm run build` + a manual smoke test (Task 6). Behavioral verification needs real images — seed mode has `asset: null` everywhere, so no `<img>`s render locally without Sanity creds.

---

### Task 1: Pure lightbox helpers (TDD)

**Files:**
- Create: `src/lib/lightbox.ts`
- Test: `src/lib/lightbox.test.ts`

Vitest runs in node and (in this repo) resolves no `@/` alias, so the test imports the module with a **relative** path, exactly like `scripts/import/text.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/lightbox.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { step, groupByGallery, counterLabel } from './lightbox';

describe('step', () => {
  it('advances forward', () => {
    expect(step(0, 1, 3)).toBe(1);
  });
  it('wraps past the end', () => {
    expect(step(2, 1, 3)).toBe(0);
  });
  it('wraps before the start', () => {
    expect(step(0, -1, 3)).toBe(2);
  });
  it('is safe for an empty set', () => {
    expect(step(0, 1, 0)).toBe(0);
  });
});

describe('groupByGallery', () => {
  it('groups photos that share a gallery key, in order', () => {
    expect(groupByGallery(['g0', 'g0', 'g0'])).toEqual([[0, 1, 2]]);
  });
  it('gives each standalone photo (null key) its own singleton group', () => {
    expect(groupByGallery([null, null])).toEqual([[0], [1]]);
  });
  it('keeps separate galleries separate and preserves first-seen order', () => {
    expect(groupByGallery(['g0', null, 'g1', 'g1'])).toEqual([[0], [1], [2, 3]]);
  });
});

describe('counterLabel', () => {
  it('returns a 1-based label for multi-photo groups', () => {
    expect(counterLabel(1, 6)).toBe('PHOTO 2 / 6');
  });
  it('returns null for a single-photo group', () => {
    expect(counterLabel(0, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/lightbox.test.ts`
Expected: FAIL — `Failed to resolve import "./lightbox"` / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/lightbox.ts`:

```ts
// Pure helpers for the entry image lightbox. DOM wiring lives in
// components/Lightbox.astro; this module holds only logic that can be
// unit-tested without a browser (see lightbox.test.ts).

/** Wrap-around index step. step(2, +1, 3) -> 0 ; step(0, -1, 3) -> 2 */
export function step(current: number, delta: number, length: number): number {
  if (length <= 0) return 0;
  return (current + delta + length) % length;
}

/**
 * Group photo refs that share a gallery key into ordered navigable sets, in the
 * order each group is first seen. A null/undefined key is a standalone photo:
 * it forms a singleton group of its own and is never merged with others.
 * Returns groups as arrays of indices into the input array.
 */
export function groupByGallery(keys: (string | null | undefined)[]): number[][] {
  const groups: number[][] = [];
  const byKey = new Map<string, number[]>();
  keys.forEach((key, i) => {
    if (key == null) {
      groups.push([i]);
      return;
    }
    let g = byKey.get(key);
    if (!g) {
      g = [];
      byKey.set(key, g);
      groups.push(g);
    }
    g.push(i);
  });
  return groups;
}

/** Counter label for the lightbox; null when the group has a single photo. */
export function counterLabel(indexInGroup: number, groupSize: number): string | null {
  if (groupSize <= 1) return null;
  return `PHOTO ${indexInGroup + 1} / ${groupSize}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/lightbox.test.ts`
Expected: PASS — all 9 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/lightbox.ts src/lib/lightbox.test.ts
git commit -m "feat(lightbox): pure nav + grouping helpers" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: PhotoSlot zoom trigger + trigger CSS

Make PhotoSlot able to wrap its `<img>` in a click-to-expand `<button>` when asked. Nothing passes `zoomable` yet, so behavior is unchanged after this task (build stays green).

**Files:**
- Modify: `src/components/PhotoSlot.astro` (full new contents below)
- Modify: `src/styles/blog.css` (add one rule after line 206, `.photo-slot__img`)

- [ ] **Step 1: Replace `src/components/PhotoSlot.astro` with:**

```astro
---
// A photo slot. When `image` (a Sanity image source) is present it renders an
// optimised <img> via the Sanity image pipeline; otherwise it falls back to the
// design's labeled "drop-in" placeholder. Children render as overlays (chips…).
// When `zoomable` is set and an image is present, the <img> is wrapped in a
// click-to-expand lightbox trigger (see components/Lightbox.astro).
import { urlForImage } from '@/lib/sanity';
import type { SanityImageSource, SlotTint } from '@/lib/types';

interface Props {
  image?: SanityImageSource | null;
  alt: string;
  label?: string;
  tint?: SlotTint;
  width?: number;
  height?: number;
  /** show a small location pin before the placeholder label */
  pin?: boolean;
  /** when true + an image is present, make the photo a lightbox trigger */
  zoomable?: boolean;
  /** handwritten caption shown in the lightbox (zoomable photos only) */
  caption?: string;
  class?: string;
}

const {
  image = null,
  alt,
  label,
  tint,
  width = 1200,
  height,
  pin = false,
  zoomable = false,
  caption,
  class: className,
} = Astro.props;

let src: string | undefined;
let full: string | undefined;
if (image) {
  let builder = urlForImage(image).width(width).auto('format');
  if (height) builder = builder.height(height).fit('crop');
  src = builder.url();
  // Larger source for the expanded view — same pipeline call, bigger width.
  if (zoomable) full = urlForImage(image).width(1800).auto('format').url();
}
---
<div class:list={['photo-slot', tint && `slot-${tint}`, image && 'photo-slot--filled', className]}>
  {src && zoomable && full ? (
    <button
      type="button"
      class="photo-slot__zoom"
      data-zoomable
      data-full={full}
      data-caption={caption ?? ''}
      data-alt={alt}
      aria-label={`Expand photo: ${alt}`}
    >
      <img class="photo-slot__img" src={src} alt={alt} loading="lazy" decoding="async" />
    </button>
  ) : (
    src && <img class="photo-slot__img" src={src} alt={alt} loading="lazy" decoding="async" />
  )}
  {!image && label && (
    <span class="photo-slot__label">
      {pin && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
          ><path
            d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
          ></path></svg
        >
      )}
      {label}
    </span>
  )}
  <slot />
</div>
```

- [ ] **Step 2: Add the trigger style to `src/styles/blog.css`**

Immediately after the `.photo-slot__img{...}` line (line 206), add:

```css
.photo-slot__zoom{position:absolute;inset:0;width:100%;height:100%;padding:0;margin:0;border:0;background:none;cursor:zoom-in;display:block;z-index:2;}
```

(The button fills the relatively-positioned `.photo-slot` and becomes the containing block for the absolute `.photo-slot__img` inside it, so the photo renders exactly as before.)

- [ ] **Step 3: Type-check and build**

Run: `npm run check && npm run build`
Expected: both succeed with no new errors. (Output is unchanged from before — no caller passes `zoomable` yet.)

- [ ] **Step 4: Commit**

```bash
git add src/components/PhotoSlot.astro src/styles/blog.css
git commit -m "feat(lightbox): optional zoom-trigger button in PhotoSlot" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Thread `zoomable` through Polaroid → Gallery → PortableText

Turn zoom on for body photos only. After this task body images render as `<button data-zoomable>`; clicking does nothing yet (no Lightbox mounted), which is a harmless intermediate state.

**Files:**
- Modify: `src/components/Polaroid.astro` (full new contents below)
- Modify: `src/components/Gallery.astro` (full new contents below)
- Modify: `src/components/PortableText.astro` (two lines)

- [ ] **Step 1: Replace `src/components/Polaroid.astro` with:**

```astro
---
// A tilted polaroid frame with optional washi tape, pushpin and handwritten
// caption — the core scrapbook unit.
import PhotoSlot from './PhotoSlot.astro';
import type { SanityImageSource, SlotTint, TapeColor, PinColor } from '@/lib/types';

interface Props {
  image?: SanityImageSource | null;
  alt: string;
  label?: string;
  tint?: SlotTint;
  caption?: string;
  tilt?: 'l' | 'r' | 'l2' | 'r2';
  tape?: TapeColor;
  tapeStyle?: string;
  pin?: PinColor;
  /** show the little location icon inside the placeholder label */
  labelPin?: boolean;
  /** when true + an image is present, make the photo a lightbox trigger */
  zoomable?: boolean;
  wide?: boolean;
  width?: number;
  height?: number;
  class?: string;
}

const {
  image = null,
  alt,
  label,
  tint,
  caption,
  tilt,
  tape,
  tapeStyle,
  pin,
  labelPin = false,
  zoomable = false,
  wide = false,
  width,
  height,
  class: className,
} = Astro.props;

const tapeS = tapeStyle ?? 'top:-12px;left:32%;transform:rotate(-5deg);';
---
<div class:list={['polaroid', wide && 'polaroid--wide', tilt && `tilt-${tilt}`, className]}>
  {tape && <span class:list={['tape', `tape--${tape}`]} style={tapeS}></span>}
  {pin && <span class:list={['pin', `pin--${pin}`]} style="top:-11px;left:50%;transform:translateX(-50%);"></span>}
  <PhotoSlot
    image={image}
    alt={alt}
    label={label}
    tint={tint}
    width={width}
    height={height}
    pin={labelPin}
    zoomable={zoomable}
    caption={caption ?? label}
  />
  {caption && <div class="polaroid__cap">{caption}</div>}
</div>
```

(The lightbox caption falls back to the polaroid `label` when there's no `caption`, per the spec.)

- [ ] **Step 2: Replace `src/components/Gallery.astro` with:**

```astro
---
// An inline photo gallery of tilted polaroids. Per-frame scrapbook accents
// (tilt/tint) fall back to a deterministic pattern by index, so even a plain
// Sanity gallery (images + alt only) gets the full scrapbook treatment.
import Polaroid from './Polaroid.astro';
import type { GalleryImage } from '@/lib/types';

interface Props {
  heading?: string;
  note?: string;
  images: GalleryImage[];
  /** when true, each photo becomes a lightbox trigger */
  zoomable?: boolean;
}

const { heading, note, images, zoomable = false } = Astro.props;

const TILTS = ['l', 'r', 'r', 'l', 'l', 'r'] as const;
const TINTS = ['teal', 'gold', 'coral', 'magenta', 'sky', 'gold'] as const;
---
<div class="gallery">
  {(heading || note) && (
    <div class="gallery__head">
      {heading && <span class="script">{heading}</span>}
      {note && <span class="k">{note}</span>}
    </div>
  )}
  <div class="gallery__grid">
    {images.map((img, i) => (
      <Polaroid
        image={img.asset}
        alt={img.alt}
        label={img.label}
        tint={img.tint ?? TINTS[i % TINTS.length]}
        caption={img.caption}
        tilt={img.tilt ?? TILTS[i % TILTS.length]}
        tape={img.tape}
        pin={img.pin}
        zoomable={zoomable}
      />
    ))}
  </div>
</div>
```

- [ ] **Step 3: Enable zoom in `src/components/PortableText.astro`**

Find this line (currently ~line 83):

```astro
  if (b._type === 'gallery') return <Gallery heading={b.heading} note={b.note} images={b.images} />;
```

Replace with:

```astro
  if (b._type === 'gallery') return <Gallery heading={b.heading} note={b.note} images={b.images} zoomable />;
```

Find the next line (currently ~line 84):

```astro
  if (b._type === 'image') return <Polaroid image={b.asset} alt={b.alt} label={b.label} tint={b.tint} />;
```

Replace with:

```astro
  if (b._type === 'image') return <Polaroid image={b.asset} alt={b.alt} label={b.label} tint={b.tint} zoomable />;
```

- [ ] **Step 4: Type-check and build**

Run: `npm run check && npm run build`
Expected: both succeed with no new errors. (Body photos in a Sanity-backed build now render as `[data-zoomable]` buttons; the cover photo and entry cards — which never pass `zoomable` — are unchanged.)

- [ ] **Step 5: Commit**

```bash
git add src/components/Polaroid.astro src/components/Gallery.astro src/components/PortableText.astro
git commit -m "feat(lightbox): enable zoom triggers on body photos + galleries" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Lightbox component (dialog + styles + script)

Create the single lightbox dialog, its scrapbook styling, and the vanilla script that wires everything using the Task 1 helpers. Not mounted yet, so still inert (build stays green).

**Files:**
- Create: `src/components/Lightbox.astro`

- [ ] **Step 1: Create `src/components/Lightbox.astro` with:**

```astro
---
// One native <dialog> lightbox for entry body photos. Pure nav/grouping logic
// lives in ../lib/lightbox.ts; this component owns the DOM and the look.
// Triggers are the [data-zoomable] buttons emitted by PhotoSlot.
---
<dialog class="lightbox" aria-label="Photo viewer">
  <button type="button" class="lightbox__close" aria-label="Close photo viewer">✕</button>
  <button type="button" class="lightbox__nav lightbox__nav--prev" aria-label="Previous photo" hidden>‹</button>
  <button type="button" class="lightbox__nav lightbox__nav--next" aria-label="Next photo" hidden>›</button>
  <figure class="lightbox__frame">
    <span class="lightbox__tape lightbox__tape--a"></span>
    <span class="lightbox__tape lightbox__tape--b"></span>
    <img class="lightbox__img" alt="" />
    <figcaption class="lightbox__cap">
      <span class="lightbox__cap-text"></span>
      <span class="lightbox__count"></span>
    </figcaption>
  </figure>
</dialog>

<style>
  .lightbox {
    width: 100vw; max-width: 100vw; height: 100vh; max-height: 100vh;
    margin: 0; padding: 0; border: 0; background: transparent; overflow: hidden;
  }
  .lightbox[open] { display: grid; place-items: center; }
  .lightbox::backdrop {
    /* crisp dots on top, light plum filter, warm paper underneath */
    background:
      radial-gradient(rgba(43, 35, 66, .14) 1.4px, transparent 1.4px),
      linear-gradient(rgba(43, 35, 66, .16), rgba(43, 35, 66, .16)),
      #FFF7ED;
    background-size: 14px 14px, auto, auto;
  }

  .lightbox__frame {
    position: relative; margin: 0; background: #fff; padding: 14px 14px 0;
    box-shadow: 0 24px 56px rgba(43, 35, 66, .34); max-width: min(92vw, 900px);
  }
  .lightbox__img {
    display: block; width: auto; height: auto; max-width: 100%; max-height: 72vh;
  }
  .lightbox__cap { text-align: center; padding: 8px 4px 12px; }
  .lightbox__cap-text {
    display: block; font-family: var(--script); font-weight: 700; font-size: 27px;
    color: var(--plum); line-height: 1.1;
  }
  .lightbox__count {
    display: block; font-family: var(--stamp); font-size: 12px; letter-spacing: .1em;
    color: var(--coral);
  }
  .lightbox__count:empty { display: none; }

  .lightbox__tape { position: absolute; width: 78px; height: 26px; z-index: 1; }
  .lightbox__tape--a { top: -11px; left: 26%; transform: rotate(-7deg); background: rgba(22, 179, 167, .6); }
  .lightbox__tape--b { bottom: 56px; right: -22px; transform: rotate(86deg); background: rgba(255, 178, 46, .6); }

  .lightbox__close, .lightbox__nav {
    position: fixed; border: 0; cursor: pointer; display: grid; place-items: center;
    border-radius: 50%; line-height: 1;
  }
  .lightbox__close {
    top: 16px; right: 16px; width: 44px; height: 44px; background: var(--coral);
    color: #fff; font-size: 20px; box-shadow: 0 5px 14px rgba(43, 35, 66, .3);
  }
  .lightbox__nav {
    top: 50%; transform: translateY(-50%); width: 46px; height: 46px; background: #fff;
    color: var(--plum); font-size: 28px; box-shadow: 0 5px 14px rgba(43, 35, 66, .22);
  }
  .lightbox__nav--prev { left: 16px; }
  .lightbox__nav--next { right: 16px; }
  /* explicit because .lightbox__nav sets display:grid, which would beat [hidden] */
  .lightbox__nav[hidden] { display: none; }

  @media (prefers-reduced-motion: no-preference) {
    .lightbox[open] .lightbox__frame { animation: lb-pop .18s ease-out; }
    @keyframes lb-pop {
      from { opacity: 0; transform: scale(.96); }
      to   { opacity: 1; transform: scale(1); }
    }
  }
</style>

<script>
  import { step, groupByGallery, counterLabel } from '../lib/lightbox';

  const dialog = document.querySelector('dialog.lightbox') as HTMLDialogElement | null;
  const triggers = Array.from(
    document.querySelectorAll('[data-zoomable]'),
  ) as HTMLButtonElement[];

  if (dialog && triggers.length) {
    const img = dialog.querySelector('.lightbox__img') as HTMLImageElement;
    const capText = dialog.querySelector('.lightbox__cap-text') as HTMLElement;
    const countEl = dialog.querySelector('.lightbox__count') as HTMLElement;
    const prevBtn = dialog.querySelector('.lightbox__nav--prev') as HTMLButtonElement;
    const nextBtn = dialog.querySelector('.lightbox__nav--next') as HTMLButtonElement;
    const closeBtn = dialog.querySelector('.lightbox__close') as HTMLButtonElement;

    // Photos sharing a .gallery ancestor navigate together; a photo with no
    // .gallery ancestor is a standalone (its own singleton group).
    const galleries = Array.from(document.querySelectorAll('.gallery'));
    const keys = triggers.map((t) => {
      const g = t.closest('.gallery');
      return g ? String(galleries.indexOf(g)) : null;
    });
    const groups = groupByGallery(keys);

    // trigger index -> its group (array of trigger indices) and position within it
    const placement = new Map<number, { group: number[]; pos: number }>();
    for (const group of groups) {
      group.forEach((triggerIndex, pos) => placement.set(triggerIndex, { group, pos }));
    }

    let current = 0;

    function render(i: number) {
      current = i;
      const t = triggers[i];
      const place = placement.get(i)!;
      img.src = t.dataset.full ?? '';
      img.alt = t.dataset.alt ?? '';
      capText.textContent = t.dataset.caption ?? '';
      const label = counterLabel(place.pos, place.group.length);
      countEl.textContent = label ?? '';
      const multi = place.group.length > 1;
      prevBtn.hidden = !multi;
      nextBtn.hidden = !multi;
    }

    function move(delta: number) {
      const place = placement.get(current)!;
      render(place.group[step(place.pos, delta, place.group.length)]);
    }

    triggers.forEach((t, i) =>
      t.addEventListener('click', () => {
        render(i);
        dialog.showModal();
      }),
    );

    prevBtn.addEventListener('click', () => move(-1));
    nextBtn.addEventListener('click', () => move(1));
    closeBtn.addEventListener('click', () => dialog.close());

    // Click on the dimmed backdrop (the dialog element itself) closes it.
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) dialog.close();
    });

    // Arrow keys page within the current gallery (Esc is handled by <dialog>).
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
    });

    // Horizontal swipe on touch devices.
    let touchX: number | null = null;
    dialog.addEventListener(
      'touchstart',
      (e) => { touchX = e.changedTouches[0].clientX; },
      { passive: true },
    );
    dialog.addEventListener(
      'touchend',
      (e) => {
        if (touchX === null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        if (Math.abs(dx) > 40) move(dx < 0 ? 1 : -1);
        touchX = null;
      },
      { passive: true },
    );
  }
</script>
```

- [ ] **Step 2: Type-check and build**

Run: `npm run check && npm run build`
Expected: both succeed. The component is not imported anywhere yet, so its script does not run on any page.

- [ ] **Step 3: Commit**

```bash
git add src/components/Lightbox.astro
git commit -m "feat(lightbox): dialog component, styles, and wiring script" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Mount the lightbox on the entry page

**Files:**
- Modify: `src/pages/entries/[slug].astro` (add an import; mount the component before `</Layout>`)

- [ ] **Step 1: Import the component**

In the frontmatter of `src/pages/entries/[slug].astro`, after the existing component imports (the block that includes `import PortableText from '@/components/PortableText.astro';`), add:

```astro
import Lightbox from '@/components/Lightbox.astro';
```

- [ ] **Step 2: Mount it before the closing `</Layout>` (currently line 142)**

Find the end of the file:

```astro
    </section>
  )}
</Layout>
```

Replace with:

```astro
    </section>
  )}

  <Lightbox />
</Layout>
```

- [ ] **Step 3: Type-check and build**

Run: `npm run check && npm run build`
Expected: both succeed. The built entry pages now include the `<dialog class="lightbox">` and the bundled script.

- [ ] **Step 4: Commit**

```bash
git add "src/pages/entries/[slug].astro"
git commit -m "feat(lightbox): mount lightbox on entry pages" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full automated suite**

Run: `npm test && npm run check && npm run build`
Expected: vitest green (incl. `lightbox.test.ts`), astro check 0 errors, build succeeds.

- [ ] **Step 2: Manual smoke test (requires real images)**

Seed mode has `asset: null`, so no body `<img>`s render without Sanity. Run a Sanity-backed preview — set `SANITY_PROJECT_ID` / `SANITY_DATASET` / `SANITY_API_READ_TOKEN` in `.env`, then:

Run: `npm run build && npm run preview`

Open an entry that has a body gallery and confirm:
- Hovering a body photo shows a zoom cursor; clicking opens the styled lightbox (warm paper + plum tint + dots backdrop, white polaroid frame, tape, handwritten caption).
- For a gallery photo: prev/next arrows + a "PHOTO n / m" counter appear; arrows, `←`/`→` keys, and swipe page within that gallery and wrap around.
- A standalone inline body photo opens with no arrows and no counter.
- The coral ✕, a click on the dimmed backdrop, and `Esc` each close the lightbox; focus returns to the photo that was clicked.
- The large cover photo and the related-entry cards are NOT clickable/zoomable.

- [ ] **Step 3: No commit** (verification only). If any check fails, fix in the relevant task's file and re-run Step 1 before considering the feature complete.

---

## Self-Review

**Spec coverage:**
- Scope (body photos + galleries, not cover/cards) → Task 3 (zoom enabled only in PortableText). ✓
- Within-gallery navigation + counter; standalone opens alone → Tasks 1 (`groupByGallery`, `counterLabel`, `step`) + 4 (grouping by `.gallery`, prev/next hidden for singletons). ✓
- Look: warm paper + dots + plum filter, straight white polaroid frame, tape, Caveat caption, coral close, white nav, gallery-only counter → Task 4 styles. ✓
- Build approach: vanilla + native `<dialog>`, one component + script, no deps → Task 4. ✓
- Data flow: `data-full` via `urlForImage(...).width(1800)`, no `src` until open → Task 2 (data attrs) + Task 4 (src set in `render`). ✓
- Accessibility: real `<button>` trigger w/ aria-label, `showModal()` focus-trap + Esc + focus return, labelled controls, img alt, reduced-motion → Tasks 2 + 4. ✓
- Non-goals (cover/cards/cross-gallery/pinch) → respected; nothing implements them. ✓
- Verification note (needs real images) → Task 6. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete content. ✓

**Type consistency:** `step`, `groupByGallery`, `counterLabel` signatures match between `lightbox.ts`, `lightbox.test.ts`, and the Task 4 script. Data attributes `data-full` / `data-caption` / `data-alt` are written in Task 2 and read in Task 4. `zoomable` / `caption` props flow PhotoSlot ← Polaroid ← Gallery ← PortableText consistently. ✓
