# Entry image lightbox — design

**Date:** 2026-06-08
**Status:** Approved (design); pending implementation plan
**Feature:** Click/tap a photo in an entry body to expand it in a lightbox.

## Summary

Readers can click (or tap) a photo inside an entry's article body to open it in
a full-screen lightbox styled to match Detourist's handcrafted scrapbook look.
Gallery photos can be paged through with prev/next; standalone inline photos
open on their own. Built with plain vanilla JS and the native `<dialog>`
element — no new dependencies, consistent with the site's minimal-client-JS
ethos.

## Decisions (locked during brainstorming)

1. **Scope — body photos + galleries only.** Both standalone inline `image`
   blocks and `gallery` block images in the article body are zoomable. The
   large **cover photo is NOT** interactive. **Entry-card thumbnails** (related
   section, journey/home grids) are **NOT** interactive.
2. **Navigation — swipe within a gallery.** Opening a photo that belongs to a
   gallery shows prev/next controls (arrow keys + horizontal swipe on mobile)
   and a `PHOTO n / m` counter that cycle **within that gallery only**. A
   standalone inline photo opens alone — no counter, no arrows. There is no
   cross-gallery / whole-entry navigation.
3. **Look — straightened scrapbook polaroid.**
   - Backdrop: the warm paper color (`#FFF7ED`) with its faint dot texture,
     **plus a light plum filter** laid over the top to dim it gently. Layer
     order: dots on top (crisp), then the plum tint, then paper.
     - Plum filter: `linear-gradient(rgba(43,35,66,.16), rgba(43,35,66,.16))`
     - Dots: `radial-gradient(rgba(43,35,66,.14) 1.4px, transparent 1.4px)`,
       `background-size: 14px 14px`
     - Tint strength, dot opacity, and dot size are intended as easy-to-tune
       knobs.
   - The photo sits **straight** (no tilt) inside a **white polaroid frame**
     with a soft drop shadow.
   - **Washi tape** accents kept on the frame (e.g. a teal piece top-left, a
     gold piece rotated on the right edge).
   - **Handwritten caption** in Caveat below the photo.
   - **Counter** (`PHOTO n / m`, Anton, coral) shown for gallery photos only.
   - **Close** button: coral circle with ✕, top-right.
   - **Prev/next**: white circular buttons with chevrons, vertically centered
     on the left/right edges.
4. **Build — vanilla JS + native `<dialog>`.** One small hand-written Astro
   `<script>` island plus CSS, matching the existing nav-menu and journey-filter
   scripts. `<dialog>.showModal()` provides focus-trapping, `Esc`-to-close, and
   the `::backdrop` pseudo-element for free. No third-party lightbox library.

## Architecture & data flow

### Files touched

| File | Change |
|---|---|
| `src/components/Lightbox.astro` (new) | The single `<dialog class="lightbox">` markup (stage, `<img>`, caption element, counter, close button, prev/next buttons), a scoped `<style>` block for the lightbox look, and a `<script>` island wiring open/close/navigate/keyboard/swipe. |
| `src/components/PhotoSlot.astro` | Add optional props `zoomable?: boolean` and `caption?: string`. When `zoomable` **and** a real `image` is present, render the `<img>` wrapped in `<button type="button" class="photo-slot__zoom" data-zoomable data-full="…" data-caption="…" aria-label="Expand photo: {alt}">…</button>`. When not zoomable, or when there is no image (placeholder), render exactly as today. |
| `src/components/Polaroid.astro` | Add `zoomable?: boolean`. Forward it to `PhotoSlot`, and forward the zoom caption as `caption ?? label`. |
| `src/components/Gallery.astro` | Render each `Polaroid` with `zoomable`. |
| `src/components/PortableText.astro` | Pass `zoomable` to the inline `image` `Polaroid` and to `Gallery`. **This is the only place zoom is enabled** — which is precisely what keeps the cover photo and entry cards non-interactive. |
| `src/pages/entries/[slug].astro` | Render `<Lightbox />` once on the page. |
| `src/styles/blog.css` | `.photo-slot__zoom` trigger style: an invisible, full-bleed button (`position:absolute; inset:0; border:0; background:none; padding:0; cursor:zoom-in;`) so the image still fills the slot exactly as before. |

### The zoom trigger (PhotoSlot)

Today PhotoSlot renders:

```astro
{src && <img class="photo-slot__img" src={src} alt={alt} loading="lazy" decoding="async" />}
```

When `zoomable` and `image` are both present, it instead renders:

```astro
<button
  type="button"
  class="photo-slot__zoom"
  data-zoomable
  data-full={urlForImage(image).width(1800).auto('format').url()}
  data-caption={caption ?? ''}
  aria-label={`Expand photo: ${alt}`}
>
  <img class="photo-slot__img" src={src} alt={alt} loading="lazy" decoding="async" />
</button>
```

- `data-full` reuses the **same `urlForImage` call** that already builds the
  thumbnail, just at a larger width (≈1800px) — so it works wherever a real
  `<img>` renders and adds no new failure mode.
- The button becomes the positioned containing block; `.photo-slot__img` stays
  `position:absolute; inset:0` and fills it exactly as before, so layout and the
  scrapbook framing are unchanged.

### Runtime grouping & open (Lightbox script)

On `DOMContentLoaded`:

1. Collect all `[data-zoomable]` buttons on the page.
2. Group each by its **closest `.gallery` ancestor**. Buttons with no `.gallery`
   ancestor (standalone inline images) each form their own singleton group.
3. On a button's `click` (or `Enter`/`Space`, handled natively by the button),
   open the dialog populated from that button's `data-full` (→ lightbox img
   `src`), `data-caption` (→ caption text), and the inner img's `alt` (→ lightbox
   img `alt`). Track the active group and index.
4. If the active group length > 1: show prev/next + counter (`PHOTO {i+1} / {n}`).
   Else: hide prev/next and the counter.
5. `dialog.showModal()` opens it (modal, focus-trapped, `Esc` enabled).

Navigation:
- Prev/next buttons and `ArrowLeft`/`ArrowRight` move within the active group
  (wrap-around), swapping the img `src`, caption, and counter.
- Horizontal touch swipe (`touchstart`/`touchend`, threshold ≈40px) maps to
  prev/next on mobile.

Close:
- Coral ✕ button → `dialog.close()`.
- Click on the dialog element where `event.target === dialog` (the dimmed
  backdrop area; the frame/photo are children) → close.
- `Esc` → handled natively by `<dialog>`.

Performance: the lightbox `<img>` has **no `src` until opened**, so full-size
(1800px) images are never downloaded until a reader actually opens one.

## Accessibility

- The trigger is a real `<button>` — keyboard-focusable and announced, with
  `aria-label="Expand photo: {alt}"`.
- `dialog.showModal()` traps focus, enables `Esc`, and **returns focus to the
  triggering button on close** (native behavior).
- Close, prev, and next are `<button>`s with `aria-label`s.
- The lightbox `<img>` carries the photo's `alt`.
- The open/transition animation is gated behind
  `@media (prefers-reduced-motion: no-preference)`.

## Non-goals

- Cover photo zoom.
- Entry-card thumbnail zoom.
- Cross-gallery or whole-entry navigation (each gallery is self-contained).
- Pinch-to-zoom / deep pan within the expanded image.
- Captions for inline photos that have neither a caption nor a label (the
  caption area is simply empty).

## Verification

- `npm run build` must pass.
- **Behavioral verification requires real images.** In seed/preview mode every
  body asset is `null`, so PhotoSlot renders placeholders and there are no
  `<img>`s — the lightbox has nothing to bind to. To see it work, build/preview
  against a Sanity-backed dataset (configured credentials) or temporarily point a
  seed gallery/inline image at a real image URL fixture.
- Manual checks (Sanity-backed): clicking a gallery photo opens the styled
  lightbox; prev/next + counter cycle within that gallery and wrap; arrow keys
  and swipe work; a standalone inline photo opens with no arrows/counter; ✕,
  backdrop click, and `Esc` all close; focus returns to the clicked photo; the
  cover photo and related-entry cards remain non-interactive.
