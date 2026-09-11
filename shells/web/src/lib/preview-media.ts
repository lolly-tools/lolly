// SPDX-License-Identifier: MPL-2.0
/**
 * A tool's committed preview element, shared by the gallery tiles and the asset picker,
 * plus the ONE playback policy every motion thumbnail on every surface obeys.
 *
 * `tools/<id>/card.html` - a self-contained animated HTML banner (CSS `@keyframes`, no JS,
 * e.g. digi-ad's ad loop) - renders in a SANDBOXED, click-through `<iframe>`:
 *   • sandbox="allow-same-origin" - no scripts run (safe), but the banner's own brand
 *     @font-face can still load from same-origin /catalog/fonts.
 *   • pointer-events:none - clicks fall through to the tile's own link/button.
 *   • loading="lazy" (unless `eager`, below) - an off-screen banner costs nothing until
 *     it scrolls near.
 * It's a few KB of vector-crisp CSS that animates natively and pauses off-screen - far
 * lighter than an APNG/GIF/video for an HTML/CSS tool.
 *
 * Every other preview (card.svg / card.png / a generated svg|png|webp) is a plain `<img>`.
 * Pass a `cls` matching the surrounding image so the box is identical either way, and an
 * `iframeSize` CSS fragment for the fitting the context needs (the default fills a
 * definite box; a fixed-height slot such as the hero or a picker tile passes an
 * aspect-ratio instead so the responsive banner isn't stretched).
 *
 * `eager` is for the handful of tiles that are above the fold on a cold load. Lazy is the
 * right default for a long grid, but a lazy image is discovered only after layout, so with
 * EVERY tile lazy the browser has no high-priority image to race - and the app's LCP
 * element ends up being whatever text painted first. The eager tiles opt out of that and
 * ask for `fetchpriority="high"`, which is what makes one of them the LCP candidate.
 *
 * MOTION PREVIEWS (plans/155 WP-5.3)
 *
 * A tool whose content genuinely animates (still-changing frames past 700 ms - the motion
 * probe's rule, scripts/probe-motion.ts) can ship a motion file beside its static preview:
 * `tools/<id>/card.webm` or an APNG `tools/<id>/card.png`. The catalog index carries it as
 * `anim` and keeps `preview` pointing at the STATIC file, so no surface is ever forced to
 * download motion just to show a tool. Callers pass both here.
 *
 * The markup a motion preview ships is the SAME `<img>` a still tool ships - static `src`,
 * `loading`/`fetchpriority` untouched - with the motion URL parked in `data-motion-src`.
 * That is deliberate and it is what makes the policy cheap:
 *   • zero motion bytes until the user shows intent, on every surface, with no gate to
 *     forget - there is no media element to preload;
 *   • the LCP story is unchanged (an `<img fetchpriority="high">` still wins the race; a
 *     `<video poster>` is an LCP candidate in Chromium but takes no priority hint and has
 *     no `loading="lazy"`, so it would fetch every off-screen poster eagerly);
 *   • with motion suppressed the markup is byte-identical to a still tool's, so "reduced
 *     motion loads nothing extra" is true by construction rather than by a runtime branch.
 *
 * Intent is `armMotionPreviews` below: hover/focus on a pointer-fine device, or being the
 * most-centered visible tile on a coarse/touch one. `playMotionPreview` then swaps an APNG
 * in place of the poster (an `<img>` APNG cannot be paused, so the still sibling IS the
 * pause state and both URLs have to be on the element), or upgrades the `<img>` to a real
 * `<video muted loop playsinline>` for a WebM.
 *
 * The asset picker's and catalog's user/library VIDEO thumbnails are the same policy on a
 * pre-built `<video>`: they have no still sibling to poster with, so they ship
 * `preload="none"` and no `autoplay`, and the arm below is what starts them.
 */
import { escape } from '../utils.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';

export function isHtmlPreview(src: string | undefined | null): boolean {
  return !!src && src.endsWith('.html');
}

/** Motion file kinds a preview element can carry, as the `data-motion` marker value.
 *  'video' upgrades to a `<video>` on intent; 'raster' (APNG / animated WebP) swaps the
 *  `<img>` src, because those animate in the `<img>` itself and cannot be paused there. */
export type MotionKind = 'video' | 'raster';

/** Which mechanism a motion file needs, from its extension. */
export function motionKind(src: string): MotionKind {
  return /\.(webm|mp4|mov)$/i.test(src) ? 'video' : 'raster';
}

/**
 * Is motion suppressed right now? Three switches, one answer, checked at PLAY time and
 * never latched (a11y-prefs.ts explains why a cached read goes stale): the OS
 * `prefers-reduced-motion`, the app's own `data-a11y-motion="reduce"` (both inside
 * `prefersReducedMotion`), and `data-a11y-previews="hidden"`, whose whole point is a
 * calm gallery - a tile that starts moving under the pointer is the opposite of that.
 */
export function motionPreviewsSuppressed(): boolean {
  if (prefersReducedMotion()) return true;
  return typeof document !== 'undefined' && document.documentElement.dataset.a11yPreviews === 'hidden';
}

/**
 * `anim` is the tool's motion file (catalog index `anim`), always paired with `src`, the
 * static poster. Absent, this is exactly the still markup it has always been.
 */
export function previewMedia(
  src: string,
  cls: string,
  iframeSize = 'width:100%;height:100%',
  eager = false,
  anim?: string | null,
): string {
  if (isHtmlPreview(src)) {
    // No fetchpriority on the iframe: it isn't an LCP candidate (its own document paints
    // the art), and the attribute has no defined effect on a frame's subresources.
    return `<iframe class="${cls}" src="${escape(src)}" tabindex="-1" aria-hidden="true" loading="${eager ? 'eager' : 'lazy'}" scrolling="no" sandbox="allow-same-origin" style="border:0;background:transparent;pointer-events:none;${iframeSize}"></iframe>`;
  }
  // data-motion-poster repeats the static src rather than reading it back at pause time:
  // the raster branch OVERWRITES src with the APNG, so by then the element no longer knows
  // what it used to show.
  const motion = anim
    ? ` data-motion="${motionKind(anim)}" data-motion-src="${escape(anim)}" data-motion-poster="${escape(src)}"`
    : '';
  return `<img class="${cls}" src="${escape(src)}" alt="" aria-hidden="true" loading="${eager ? 'eager' : 'lazy'}"${eager ? ' fetchpriority="high"' : ''} decoding="async"${motion}>`;
}

/**
 * Markup for a picker/catalog asset video thumbnail - a user upload or a library clip,
 * which has no still sibling to poster with.
 *
 * `preload="none"` and no `autoplay`: until `armMotionPreviews` decides this tile has the
 * user's attention it costs one HTTP request of nothing. It used to be
 * `autoplay preload="metadata"` with no visibility gate at all, so a catalog of clips
 * fetched every one of their headers and played every one of them off screen.
 * `muted` + `playsinline` stay mandatory - a browser refuses to start a video without them.
 */
export function motionVideoThumb(url: string, cls: string): string {
  return `<video class="${cls}" data-motion="video" src="${escape(url)}" muted loop playsinline preload="none"></video>`;
}

/** Every motion-capable element under `root`, in document order. */
export function motionPreviewEls(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('[data-motion]')];
}

/** The `<video>` an `<img data-motion="video">` was upgraded into, so a stop can reverse it. */
const upgraded = new WeakMap<HTMLElement, HTMLVideoElement>();

/**
 * The one preview allowed to be moving anywhere in the app, enforced here rather than per
 * surface. Two things drive playback - each surface's own hover hook and this module's arm -
 * and an app-wide "one at a time" is not something either can promise alone: a tile hovered
 * from the gallery's prefetch listener and a tile focused through the arm would otherwise
 * both run, as would a picker tile opened over a gallery still playing underneath.
 */
let playing: HTMLElement | null = null;

/**
 * Start this element's motion, if motion is allowed at all. Idempotent - a second call
 * while it is already playing is a no-op, which is what lets a hover and the centered-tile
 * observer both drive the same element without fighting.
 */
export function playMotionPreview(el: HTMLElement): void {
  if (motionPreviewsSuppressed()) return;
  if (playing && playing !== el) stopMotionPreview(playing);
  playing = el;
  // tagName, not `instanceof HTMLVideoElement`: the element belongs to the document's
  // realm, which is not this module's realm under jsdom or inside an iframe, and there the
  // constructor identity check silently answers false for a real <video>.
  if (el.tagName === 'VIDEO') { startVideo(el as HTMLVideoElement); return; }
  const motionSrc = el.dataset.motionSrc;
  if (!motionSrc) return;
  if (el.dataset.motion === 'raster') {
    if (el.getAttribute('src') !== motionSrc) el.setAttribute('src', motionSrc);
    return;
  }
  if (upgraded.has(el)) return;
  const doc = el.ownerDocument;
  const video = doc.createElement('video');
  video.className = el.className;
  // No data-motion marker on the upgrade: the hidden `<img>` keeps it, and it stays the
  // one handle every path uses. A second marked element inside the card would make the
  // "exactly one" card test below stop matching mid-play.
  //
  // The poster is the frame already on screen, so the swap has nothing to flash through
  // while the first video frame decodes.
  video.poster = el.getAttribute('src') ?? '';
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('aria-hidden', 'true');
  video.src = motionSrc;
  el.hidden = true;
  el.after(video);
  upgraded.set(el, video);
  startVideo(video);
}

/** play() rejects on a refused autoplay and returns undefined on hosts that never
 *  implemented it (jsdom). Neither is a failure worth surfacing: the poster or the resting
 *  frame is already the correct picture. */
function startVideo(video: HTMLVideoElement): void {
  try { void video.play()?.catch(() => { /* refused - the resting frame stays */ }); }
  catch { /* not implemented here */ }
}

/** Stop and REWIND this element's motion: leaving a tile must return it to its poster,
 *  not to a paused frame halfway through a loop. */
export function stopMotionPreview(el: HTMLElement): void {
  if (playing === el) playing = null;
  if (el.tagName === 'VIDEO') {
    const v = el as HTMLVideoElement;
    v.pause();
    // A seek on a preload="none" video that never started would force a fetch of exactly
    // the bytes this policy exists to avoid.
    if (v.currentTime) v.currentTime = 0;
    return;
  }
  if (el.dataset.motion === 'raster') {
    const poster = el.dataset.motionPoster;
    if (poster && el.getAttribute('src') !== poster) el.setAttribute('src', poster);
    return;
  }
  // The upgraded <video> is REMOVED rather than parked paused: a detached element stops
  // decoding and holds no buffer, and the file is in the HTTP cache, so the next hover
  // rebuilds it for free and always starts the loop from its first frame.
  const video = upgraded.get(el);
  if (!video) return;
  upgraded.delete(el);
  video.pause();
  video.removeAttribute('src');
  video.remove();
  el.hidden = false;
}

/** Play the one motion element inside `scope` (a tile, a card), stopping nothing else. */
export function playMotionIn(scope: Element | null | undefined): void {
  const el = scope?.querySelector<HTMLElement>('[data-motion]');
  if (el) playMotionPreview(el);
}

/** The stop half of `playMotionIn`. */
export function stopMotionIn(scope: Element | null | undefined): void {
  const el = scope?.querySelector<HTMLElement>('[data-motion]');
  if (el) stopMotionPreview(el);
}

export interface MotionArmOpts {
  /** Wire hover here? Pass false on a surface that already has a per-tile `pointerenter`
   *  hook of its own and calls `playMotionIn` from it (the gallery's prefetch hook) - a
   *  delegated listener on top of that would play every tile twice. */
  hover?: boolean;
  /** Stale-render guard, matching autoplayLottieThumbs / mountAudioThumbs: an async
   *  callback that arrives after the surface closed must do nothing. */
  isCurrent?: () => boolean;
}

/** Does this device hover? A phone reports `(hover: none)`, so a hover-driven policy would
 *  never start a single preview there - which is why the coarse branch exists. */
function pointerFine(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
}

/**
 * The scope a pointer/focus event should drive: walk up from the target to the first
 * ancestor holding EXACTLY ONE motion element. That is the card, whatever a given surface
 * calls its card, without this module knowing any surface's class names. Requiring exactly
 * one is what stops the grid itself from matching when the pointer crosses the gap between
 * two tiles.
 */
function motionElFor(root: Element, target: EventTarget | null): HTMLElement | null {
  // Duck-typed, not `instanceof Element`: the event target belongs to the document's realm,
  // and under jsdom (and inside an iframe) that constructor is not this module's.
  const el = target as Element | null;
  let n: Element | null = el && typeof el.matches === 'function' ? el : null;
  for (; n && n !== root.parentElement; n = n.parentElement) {
    if (n.matches('[data-motion]')) return n as HTMLElement;
    if (n.querySelectorAll('[data-motion]').length === 1) return n.querySelector<HTMLElement>('[data-motion]');
  }
  return null;
}

/** What the centered-tile observer watches: the motion element's PARENT box, never the
 *  element itself. Playing a WebM hides the `<img>` and puts a `<video>` beside it, so the
 *  element under observation would report itself off screen the instant it started - the
 *  observer would drop it, hand the tile to a neighbour, and the two would trade forever.
 *  The parent's box is the same box either way. */
function motionBox(el: HTMLElement): Element {
  const parent = el.parentElement;
  // Two motion elements under one parent would map that single box to whichever was seen
  // last, and the other could then never be picked. A surface that packs them like that
  // gets per-element observation instead, which is at worst the flapping described above
  // and never a preview that can never play.
  if (!parent || parent.querySelectorAll('[data-motion]').length !== 1) return el;
  return parent;
}

/**
 * Arm the playback policy over `root`. Call it after every (re)render and destroy the
 * previous arm first, exactly like `autoplayLottieThumbs` and `mountAudioThumbs` - the
 * markup those observers were watching is gone after an innerHTML rebuild.
 *
 * Pointer-fine: hover and keyboard focus play one preview, leaving stops and rewinds it.
 *
 * Coarse/touch: there is no hover to read intent from, so an IntersectionObserver picks the
 * MOST-CENTERED visible tile and plays only that one. One at a time is the point: a phone
 * scrolling a grid of six playing videos is a battery and bandwidth event, and six moving
 * tiles is unreadable anyway. Thresholds are a ladder rather than a single 0, so the pick
 * is re-evaluated as tiles slide through the viewport without a scroll listener.
 *
 * Keyboard focus is wired on BOTH branches: a coarse device can still have a keyboard, and
 * a focus that plays nothing is a preview a keyboard user can never see.
 */
export function armMotionPreviews(root: Element, { hover = true, isCurrent = () => true }: MotionArmOpts = {}): { destroy(): void } {
  let current: HTMLElement | null = null;
  const setCurrent = (next: HTMLElement | null): void => {
    if (next === current || !isCurrent()) return;
    if (current) stopMotionPreview(current);
    current = next;
    if (next) playMotionPreview(next);
  };

  const onOver = (e: Event): void => setCurrent(motionElFor(root, e.target));
  const onOut = (e: Event): void => {
    // relatedTarget is where the pointer went. Still inside the same card (crossing from
    // the image onto its caption) is not a leave.
    const to = (e as PointerEvent).relatedTarget;
    if (motionElFor(root, to) !== current) setCurrent(null);
  };
  const onFocusIn = (e: Event): void => setCurrent(motionElFor(root, e.target));
  const onFocusOut = (e: Event): void => {
    if (motionElFor(root, (e as FocusEvent).relatedTarget) !== current) setCurrent(null);
  };

  const fine = pointerFine();
  if (hover && fine) {
    root.addEventListener('pointerover', onOver);
    root.addEventListener('pointerout', onOut);
  }
  root.addEventListener('focusin', onFocusIn);
  root.addEventListener('focusout', onFocusOut);

  let io: IntersectionObserver | null = null;
  if (!fine && typeof IntersectionObserver === 'function') {
    const elOf = new Map<Element, HTMLElement>();
    const visible = new Set<Element>();
    const pickCentered = (): void => {
      if (!isCurrent()) return;
      const mid = (root.ownerDocument?.defaultView?.innerHeight ?? 0) / 2;
      let best: Element | null = null;
      let bestDist = Infinity;
      for (const box of visible) {
        const r = box.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestDist) { bestDist = d; best = box; }
      }
      setCurrent(best ? elOf.get(best) ?? null : null);
    };
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) visible.add(e.target);
        else visible.delete(e.target);
      }
      pickCentered();
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
    for (const el of motionPreviewEls(root)) {
      const box = motionBox(el);
      elOf.set(box, el);
      io.observe(box);
    }
  }

  return {
    destroy() {
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('pointerout', onOut);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      io?.disconnect();
      if (current) stopMotionPreview(current);
      current = null;
    },
  };
}
