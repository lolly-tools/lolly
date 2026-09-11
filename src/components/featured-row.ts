// SPDX-License-Identifier: MPL-2.0
/**
 * Featured row - the gallery's cinematic hero.
 *
 * A slowly-drifting strip of large tiles, one per tool flagged `featured` in its
 * manifest. Each tile demonstrates Lolly's core idea, *one tool, endless on-brand
 * outputs*: it starts on the tool's committed preview, then cross-fades through a
 * handful of rendered example looks (manifest.featured.variants - different inputs
 * AND themes). Each look is produced by the real engine path (see
 * lib/featured-render.ts) and memoised so later visits are instant.
 *
 * Motion, and its restraint:
 *   - The whole row drifts left at a gentle ~22px/s. It PAUSES the moment a pointer
 *     is over it, focus lands inside it, a touch begins, or the visitor scrolls it
 *     by hand, so it never fights the user, and resumes shortly after.
 *   - Within a tile, the active look cross-fades every ~4.6s with a slow Ken-Burns
 *     drift, so a still tile still breathes.
 *   - Reduced motion (the OS preference OR the app's own, lib/a11y-prefs.ts) turns
 *     ALL of that off: no drift, no cross-fade, no variant rendering. The strip
 *     stays a plain, manually-scrollable row of tiles. Read once per mount, so a
 *     mid-session toggle takes effect on the next mount of the row.
 *
 * The tile art uses object-fit:contain over a themed backdrop, never cropped (a
 * cropped logo or badge is worse than a letterboxed one), and every tile is a real
 * link to its tool, so the whole feature degrades to "a scrollable row of links".
 */

import { mountCoverflow, type CoverflowHandle } from './coverflow.ts';
import { featuredStartIndex, recordFeaturedActivity, type FeaturedCollection } from '../lib/featured-activity.ts';
import type { PreviewQueue } from '../lib/preview-queue.ts';
import { escape } from '../utils.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { perfUiOn } from '../feature-flags.ts';
import { captureNeutralPinned } from '../lib/capture-neutral.ts';
import { renderFeaturedVariant, renderMissingLook, isManifestLook, displayFormatOf } from '../lib/featured-render.ts';
import { toolSeedHref } from '../lib/seed-url.ts';
import { galleryLookHref, renderGalleryLook } from '../lib/gallery-preview.ts';
import { playSfx } from '../lib/sfx.ts';
import { currentTheme } from '../theme.ts';
import { icon } from '../lib/icons.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { PreviewsAPI } from '../bridge/previews.ts';

export interface FeaturedVariant {
  motion?: import('../lib/template-motion.ts').TemplateMotion;
  /** An external starting template; opens through the same template route. */
  templateId?: string;
  label?: string;
  /**
   * Which UI theme this look suits - set on looks that render ink on a TRANSPARENT
   * background (e.g. a reverse/white logo). 'dark' looks are shown on dark/SUSE themes,
   * 'light' looks on the light theme; a clashing look would be near-invisible on the
   * tile, so it's filtered out. Omit for looks that bake their own background (any theme).
   */
  theme?: 'light' | 'dark';
  values: Record<string, unknown>;
}
export interface FeaturedManifest {
  blurb?: string;
  order?: number;
  /** DEPRECATED alias for the top-level `examples` field - see resolveExamples(). */
  variants?: FeaturedVariant[];
}
/** The slice of a catalog index entry the featured row reads. */
export interface FeaturedEntry {
  /** Tool discovery renders in the active brand; saved-work ribbons keep their own art. */
  galleryPreview?: boolean;
  version?: string;
  id: string;
  name: string;
  preview?: string;
  /** The tool's inlined icon SVG - shown as the tile's fallback art when no preview/
   *  variant has loaded (and revealed if one errors), hidden once real art is ready. */
  icon?: string;
  formats?: readonly string[];
  status?: string;
  /**
   * Where the tile links. Defaults to the tool route `#/tool/<id>`. Callers reusing the
   * strip for non-tool tiles (e.g. the Projects view's saved-session previews) set the
   * resume URL here so a middle-click / no-JS open still lands in the right place.
   */
  href?: string;
  /** Example looks (manifest.examples) - the canonical source; see resolveExamples(). */
  examples?: FeaturedVariant[];
  featured: FeaturedManifest;
}

/**
 * The example looks a tile cross-fades / scrolls through. The canonical field is the
 * top-level `examples`; `featured.variants` is the pre-`examples` alias kept working for
 * tools authored before it. `examples` wins when both are present. Shared by the featured
 * row and the gallery tile's preview strip so they never diverge on which looks a tool has.
 */
export function resolveExamples(src: { examples?: FeaturedVariant[]; featured?: FeaturedManifest } | undefined | null): FeaturedVariant[] {
  return src?.examples ?? src?.featured?.variants ?? [];
}

type FeaturedHost = HostV1 & { previews?: PreviewsAPI };

/** One queued look: the tool plus the example to paint. `index` is the look's ORIGINAL
 *  manifest position (not its position after the theme filter), so it keys the render
 *  cache and the preview manifest identically whichever looks a theme filters out. */
interface VariantJob {
  id: string;
  formats: readonly string[] | undefined;
  index: number;
  values: Record<string, unknown>;
  look?: FeaturedVariant;
  tool?: FeaturedEntry;
}

export interface FeaturedRowHandle {
  /** Pause/resume all motion (the gallery hides the row during search/filter). */
  setVisible(visible: boolean): void;
  /** Switch between the Gallery strip and the Cover Flow player-select. */
  setViewMode(mode: FeaturedViewMode): void;
  /** Tear down timers, the drift loop, listeners and the pending render queue. */
  destroy(): void;
}

const FADE_INTERVAL_MS = 4600;    // dwell on each look before cross-fading
const DRIFT_PX_PER_SEC = 22;      // "slowly" - a calm, readable drift speed
const RESUME_DELAY_MS = 900;      // after a manual scroll settles, ease back into drift
const WHEEL_TO_VELOCITY = 14;     // px/s of spin added per unit of horizontal wheel delta
const MAX_VELOCITY = 3200;        // px/s cap so a wild flick or wheel can't teleport the strip
const INERTIA_FRICTION = 0.94;    // velocity decay per ~16.7ms frame (≈1s coast to rest)
const INERTIA_MIN_V = 6;          // px/s; below this the coast stops and ambient drift may resume
// Lucide "arrow-right" - the Open affordance glyph.
const ARROW = icon('arrowRight', { size: 15, strokeWidth: 2.2 });

// Lucide "circle-help" - the optional "(?)" glyph beside a strip's pull label (opts.labelHref).
// Path data lives in lib/icons.ts as 'help' - deduped against footer-nav.ts's identical glyph
// (component-audit rec 5; help-tip.ts's own copy is a separate agent's territory, see followups).
const HELP_ICON = icon('help', { size: 12, strokeWidth: 2.4 });

// Kebab "more actions" glyph - the optional per-tile ⋯ menu button (opts.tileMenu). The
// consumer (e.g. Projects' Uncategorised ribbon) delegates the button's click to its own menu.
const MENU_DOTS = icon('menuDots', { size: 18, filled: true });

const ric = (cb: () => void): number =>
  (typeof requestIdleCallback === 'function'
    ? requestIdleCallback(cb, { timeout: 3000 })
    : setTimeout(cb, 60)) as unknown as number;
const cancelRic = (id: number): void =>
  (typeof cancelIdleCallback === 'function' ? cancelIdleCallback(id) : clearTimeout(id));

/** In featured `order` (ascending); entries without one keep catalog order, last. */
function byFeaturedOrder(a: FeaturedEntry, b: FeaturedEntry): number {
  const ao = a.featured.order ?? Infinity;
  const bo = b.featured.order ?? Infinity;
  return ao - bo;
}

function tileMarkup(entry: FeaturedEntry, eager = false, menu = false): string {
  const label = `Open ${entry.name}`;
  // The committed preview is the instant first frame; rendered variants are appended
  // as layers as they arrive. A tool whose preview is missing (dev, before
  // `pnpm run previews`) simply starts on the themed backdrop until its first variant.
  // The FIRST tile is the above-the-fold LCP element, so it loads eagerly at high
  // priority - `loading="lazy"` on the hero delays LCP (the browser defers the very
  // image LCP measures). Off-screen tiles (index > 0) keep lazy.
  const loadAttrs = eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"';
  const base = entry.preview
    ? `<img class="ftile-img is-active" data-base src="${escape(entry.preview)}" alt="" aria-hidden="true" draggable="false" ${loadAttrs}>`
    : '';
  // The tool's own icon is the always-present fallback: it shows until a real preview/
  // variant decodes (so a missing or slow image is never a blank/broken box), and it's
  // hidden the instant art is ready (`.ftile.has-art` - a transparent preview would
  // otherwise let the icon show through behind it). '' when the tool has no icon.
  const iconFill = entry.icon ? `<span class="ftile-iconfill" aria-hidden="true">${entry.icon}</span>` : '';
  // Icon-HERO tile: no preview and no example looks means the icon isn't a
  // loading fallback here - it IS the artwork for the tile's whole life (the
  // utility entries, favourited view cards). ftile--icon styles it substantial
  // (large, bold, brand-hued) instead of the faint loading ghost, and pairs it
  // with the name in a pill so icon + title read as ONE centred object: for a
  // utility the name identifies it faster than the glyph does.
  const iconHero = !entry.preview && resolveExamples(entry).length === 0;
  // The pill lives inside the (aria-hidden) stage, so it's decoration - the
  // link's aria-label still carries the name, and nothing is announced twice.
  // Its visible twin in .ftile-meta is hidden by CSS on these tiles.
  const iconName = iconHero ? `<span class="ftile-iconname">${escape(entry.name)}</span>` : '';
  const href = entry.href ?? `#/tool/${entry.id}`;
  // `data-basehref` is the tool's default route - the fallback the tile's href reverts to
  // while the committed placeholder is showing (a rendered look then points href at its own
  // seeded URL, so opening the tile lands in the look you're watching; see refreshLinkHref).
  return `
    <li class="ftile${iconHero ? ' ftile--icon' : ''}" data-tool="${escape(entry.id)}">
      ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - every entry.href is a fixed-prefix in-app route ('#/tool/…', '#/c?asset=…', '#/batch?session=…'), else the '#/tool/<id>' fallback */ ''}
      <a class="ftile-link" href="${escape(href)}" data-basehref="${escape(href)}" aria-label="${escape(label)}" draggable="false">
        <span class="ftile-stage" aria-hidden="true">
          ${iconFill}
          ${iconName}
          ${base}
          <span class="ftile-open">Open ${ARROW}</span>
        </span>
        <span class="ftile-meta">
          <span class="ftile-name">${escape(entry.name)}</span>
        </span>
        <span class="ftile-dots" aria-hidden="true"></span>
      </a>
      ${menu ? `<button type="button" class="ftile-menu" aria-label="Actions for ${escape(entry.name)}" title="Actions">${MENU_DOTS}</button>` : ''}
    </li>`;
}

/**
 * Mount the featured row into `mount` (its innerHTML is replaced). Returns a handle
 * whose destroy() must be called before re-mounting or navigating away.
 */
export type FeaturedViewMode = 'gallery' | 'coverflow';

export function mountFeaturedRow(
  mount: HTMLElement,
  entriesIn: FeaturedEntry[],
  host: FeaturedHost,
  opts: { collection?: FeaturedCollection; favourites?: Iterable<string>; previewQueue?: PreviewQueue; viewMode?: FeaturedViewMode; staticStrip?: boolean; label?: string; ariaLabel?: string; tileDragOut?: boolean; tileMenu?: boolean; labelHref?: string; labelHelp?: string; onActivate?: (id: string) => void } = {},
): FeaturedRowHandle {
  const entries = [...entriesIn].sort(byFeaturedOrder);
  // An automated screenshot run is treated as reduced motion. Every motion this
  // component owns is JS-driven, so it is invisible to the capture harness's
  // FREEZE_CSS, which can only zero CSS animations/transitions. Left running, the
  // ambient drift moves `scrollLeft` and the cross-fade advances each tile's look
  // between one capture and the next. Re-shooting the gallery gave -22%, then -84%
  // byte swings. As a VECTOR baseline this is churn on every run: the raster
  // baselines used to hide it behind their `tolerance=` pixel budget, but vector
  // shots compare exactly and ignore that budget. Reusing `reduced` rather than
  // adding a second switch means the still path taken here is the one users already
  // exercise, not a capture-only branch nothing else tests. The gallery favourites
  // strip opts in unconditionally (`staticStrip`, Andy 2026-08-10): no auto-drift
  // marquee and no example/preset cross-fade. A favourite shows the tool's single
  // committed template, swipe/drag only. Cover Flow and the Projects ribbon keep
  // their motion.
  // perf-ui folds in here so ONE flag both stills the drift loop (line ~888) AND skips the
  // progressive variant rasterisation (line ~913) - the tile falls back to its static
  // preview/icon, exactly as under reduced motion. Off by default ⇒ byte-identical.
  const reduced = prefersReducedMotion() || captureNeutralPinned() || opts.staticStrip === true || perfUiOn();
  let coverflow = opts.viewMode === 'coverflow';
  const collection = opts.collection ?? 'tools';
  const initialIndex = featuredStartIndex(collection, entries.map(entry => entry.id), opts.favourites);
  let flow: CoverflowHandle | null = null;
  let pendingDx = 0;
  // Drag-out mode (Projects "Uncategorised" ribbon): each tile is a native HTML5 drag
  // source so a loose session can be dragged onto a "Move to" folder. The consumer wires
  // dragstart/dragend (it owns the payload); here we only make the tiles draggable and,
  // below, keep a tile-press from being swallowed by the grab-pan so the drag can start.
  const tileDragOut = opts.tileDragOut === true;
  // Per-tile ⋯ menu button (Projects' Uncategorised ribbon): a visible, touch-friendly handle
  // whose click the consumer delegates to its own actions menu (Move to folder…, Rename, …).
  const tileMenu = opts.tileMenu === true;
  // In-view activation: when the consumer wants a tile press to DO something in place
  // (e.g. open a modal) rather than navigate a route, it passes onActivate. Tiles then
  // hand their id to it instead of following their href - which is what keeps the
  // catalogue favourites strip's "Open" (a same-route #/c?asset=… link) from being
  // swallowed by the router's same-route dedupe. The <a href> is kept as the middle- /
  // ⌘-click "open in new tab" + no-JS deep-link fallback.
  const onActivate = opts.onActivate;

  mount.innerHTML = `
    <section class="featured${reduced ? ' featured--static' : ''}${coverflow ? ' featured--coverflow' : ''}" aria-label="${escape(opts.ariaLabel || opts.label || 'Featured tools')}" aria-roledescription="carousel">
      ${/* nosemgrep: lolly-href-escape-is-not-scheme-validation - opts.labelHref is a call-site literal doc route, never remote data */ ''}
      ${opts.label ? `<span class="featured-label">${escape(opts.label)}${opts.labelHref ? `<a class="featured-label-help" href="${escape(opts.labelHref)}" aria-label="${escape(opts.labelHelp || 'Learn more')}" title="${escape(opts.labelHelp || 'Learn more')}">${HELP_ICON}</a>` : ''}</span>` : ''}
      <div class="featured-viewport" tabindex="0" aria-label="${escape(opts.ariaLabel || opts.label || 'Featured tools')}">
        <ul class="featured-track">${entries.map((e, i) => tileMarkup(e, i === initialIndex, tileMenu)).join('')}</ul>
      </div>
      <button type="button" class="featured-go">Open ${ARROW}</button>
      <div class="featured-grip" aria-hidden="true"><span class="featured-grip-bar"></span></div>
    </section>`;

  const section = mount.querySelector<HTMLElement>('.featured')!;
  const viewport = mount.querySelector<HTMLElement>('.featured-viewport')!;
  const track = mount.querySelector<HTMLElement>('.featured-track')!;

  // Make the ORIGINAL tile links drag sources; setupLoop's wrap-clones are cloneNode(true)
  // copies made after this, so they inherit draggable (and re-cloning on a view switch
  // keeps it). tileMarkup sets draggable="false" to suppress the native link-drag ghost
  // during a pan - here we deliberately turn it back on.
  if (tileDragOut) track.querySelectorAll<HTMLElement>('.ftile-link').forEach((l) => { l.draggable = true; });

  const ac = new AbortController();
  const { signal } = ac;
  let destroyed = false;
  let visible = true; // the gallery pauses the row while a search / filter is active
  // Scrolled-into-view gate: when the strip is fully scrolled off-screen (user is down in
  // the grid) there's nothing to animate, so we park the whole drift loop + cross-fade
  // rather than write scrollLeft 60×/s off-screen (each write re-fires the scroll listener
  // → normalizeWrap). An IntersectionObserver (set up after startRaf below) flips this;
  // SSR / engines without IntersectionObserver keep it true → always-on, as before.
  let onScreen = true;
  let vizObserver: IntersectionObserver | undefined;

  // ── Cross-fade + Ken Burns: one shared ticker advances every tile's active look ──
  // (a still tile keeps breathing via CSS Ken Burns on .is-active). Skips tiles with
  // fewer than two decoded images, and pauses wholesale while the row is off-screen.
  const isReady = (img: HTMLImageElement): boolean => img.complete && img.naturalWidth > 0;

  // Icon fallback ⇄ real art. Mark a tile `has-art` the instant any preview/variant image
  // decodes - that hides the icon so a transparent image can't reveal it behind the art - 
  // and DROP an image that 404s/errors so the icon stands in rather than a broken box.
  // Capture phase (load/error don't bubble); covers the committed base AND the lazily
  // appended variant layers.
  const markArt = (img: HTMLImageElement): void => { if (isReady(img)) img.closest('.ftile')?.classList.add('has-art'); };
  track.querySelectorAll<HTMLImageElement>('.ftile-img').forEach(markArt);   // warm-cache hits
  track.addEventListener('load', (e) => { const t = e.target as HTMLElement | null; if (t?.classList?.contains('ftile-img')) markArt(t as HTMLImageElement); }, { capture: true, signal });
  // A look painted from the preview MANIFEST is a URL now (it used to be an inlined
  // data-URL, which could not fail), so a missing look file reaches us here as `error`.
  // Dropping the image alone would silently cost the tile that look - and if every look
  // 404s, the hero stops cross-fading at all and the row is a static strip of committed
  // previews. So an image that carries a job re-renders it live instead, the same
  // degradation a stale bundle `sig` already takes (lib/featured-render.ts).
  const lookJob = new WeakMap<HTMLImageElement, VariantJob>();
  let retryLook: (job: VariantJob) => void = () => {};
  track.addEventListener('error', (e) => {
    const t = e.target as HTMLElement | null;
    if (!t?.classList?.contains('ftile-img')) return;
    const job = lookJob.get(t as HTMLImageElement);
    t.remove();                    // no broken box either way; the icon stands in meanwhile
    if (job) retryLook(job);
  }, { capture: true, signal });

  function syncDots(link: Element, imgs: HTMLImageElement[], activeIdx: number): void {
    const dots = link.querySelector<HTMLElement>('.ftile-dots');
    if (!dots) return;
    if (imgs.length < 2) { dots.innerHTML = ''; return; }
    if (dots.childElementCount !== imgs.length) {
      // data-dot = rotation index; the delegated click handler jumps straight to that
      // look. Spans, not buttons - they live inside the tile's <a> (no nested
      // interactives) and stay aria-hidden decoration; keyboard users get the same
      // looks via the ambient rotation + the seeded link.
      dots.innerHTML = imgs.map((_, i) => `<span class="ftile-dot" data-dot="${i}"></span>`).join('');
    }
    [...dots.children].forEach((d, i) => d.classList.toggle('is-on', i === activeIdx));
  }

  // The looks a stage rotates through: decoded variant layers if any have arrived, else
  // the committed-preview placeholder. So once real variants render, the base drops out
  // of the rotation (it was only the instant first-paint image, and may not suit the
  // current theme anyway).
  function rotationImgs(stage: Element): HTMLImageElement[] {
    const ready = [...stage.querySelectorAll<HTMLImageElement>('.ftile-img')].filter(isReady);
    const variants = ready.filter((i) => i.dataset.base === undefined);
    return variants.length ? variants : ready;
  }

  // Point a tile's <a> at the currently-shown look's seeded URL, so a tap / click / ⌘-click
  // (new tab) / keyboard Enter opens the tool in THAT exact style - the featured row's parity
  // with the gallery carousels' click-to-seed ("you get the config you saw"). Reverts to the
  // tool's default route (`data-basehref`) while the committed placeholder is active or before
  // a look's seed URL has resolved. Each rendered look carries its URL on `data-seedhref` (set
  // in addVariantImage once toolSeedHref resolves).
  function refreshLinkHref(link: Element | null): void {
    if (!(link instanceof HTMLAnchorElement)) return;
    const active = link.querySelector<HTMLImageElement>('.ftile-stage .ftile-img.is-active');
    link.setAttribute('href', active?.dataset.seedhref ?? link.dataset.basehref ?? link.getAttribute('href') ?? '');
  }

  // Cross-fade a stage straight to look `idx` (clamped into the rotation).
  function showStage(stage: Element, idx: number): void {
    const link = stage.parentElement!;
    const all = [...stage.querySelectorAll<HTMLImageElement>('.ftile-img')];
    const imgs = rotationImgs(stage);
    if (!imgs.length) return;
    const shownIdx = Math.max(0, Math.min(idx, imgs.length - 1));
    all.forEach((i) => i.classList.remove('is-active'));  // also clears a lingering base
    imgs[shownIdx]!.classList.add('is-active');
    syncDots(link, imgs, imgs.length < 2 ? -1 : shownIdx);
    refreshLinkHref(link);   // the tile now links to the look it's showing
  }

  // Cross-fade a stage to the next (dir 1) / previous (dir -1) look.
  function advanceStage(stage: Element, dir = 1): void {
    const imgs = rotationImgs(stage);
    if (!imgs.length) return;
    const cur = imgs.findIndex((i) => i.classList.contains('is-active'));
    // cur === -1 means the active layer is the base placeholder (now out of rotation) - 
    // step onto the first variant regardless of direction.
    showStage(stage, imgs.length < 2 || cur === -1
      ? 0
      : ((cur + dir) % imgs.length + imgs.length) % imgs.length);
  }

  // Jump one tool's stages - BOTH its original tile and its wrap-clone - to look `idx`,
  // so the pair stays in sync (a dot click can land on either copy).
  function jumpTool(toolId: string, idx: number): void {
    track.querySelectorAll(`.ftile[data-tool="${CSS.escape(toolId)}"] .ftile-stage`).forEach((s) => showStage(s, idx));
  }

  // A manual look-pick (dot click) suppresses the auto cross-fade + drift for a beat
  // and speeds the transition (.is-shifting) so hand-picks feel snappy, not slow.
  let shiftClsTimer: ReturnType<typeof setTimeout> | undefined;
  function markManualShift(): void {
    manualUntil = performance.now() + RESUME_DELAY_MS;
    section.classList.add('is-shifting');
    clearTimeout(shiftClsTimer);
    shiftClsTimer = setTimeout(() => section.classList.remove('is-shifting'), 600);
  }

  let fadeTimer: ReturnType<typeof setInterval> | undefined;
  if (!reduced) {
    fadeTimer = setInterval(() => {
      // Pause the auto cross-fade while the pointer is over the strip or a finger is on
      // it - a cross-fade firing mid-swipe animates two drop-shadowed images at once and
      // janks the scroll (mobile especially). `touching` covers the whole swipe;
      // hovering/manualUntil cover the mouse + post-gesture rest.
      if (destroyed || !visible || !onScreen || document.hidden || hovering || touching || performance.now() < manualUntil) return;
      track.querySelectorAll('.ftile-stage').forEach((s) => advanceStage(s));
    }, FADE_INTERVAL_MS);
  }

  // ── Motion model: ambient drift · flick/wheel inertia · pointer drag ─────────
  // The viewport is a native horizontal scroller (swipe / trackpad / keyboard all
  // free). One rAF loop owns scrollLeft with three states, in priority order:
  //   1. dragging - the pointer sets scrollLeft directly (see pointermove).
  //   2. |velocity| - a flick-release or wheel spin-up coasts and decays ("wheel
  //                   physics": grab-and-throw keeps spinning, then eases to rest).
  //   3. idle - the slow ambient drift resumes.
  // A cloned second copy of the track keeps the wrap gapless. Cloning + auto motion
  // engage only when the content overflows; under reduced motion the strip is a plain
  // (still grab-draggable) scroller with no drift and no inertia coast.
  let raf = 0;
  let lastTs = 0;
  let looping = false;
  let halfWidth = 0;
  let velocity = 0;   // px/s, for flick / wheel inertia
  let snap: { from: number; to: number; start: number; duration: number } | null = null;
  let cfWheelUntil = 0;

  // Drag state - mouse/pen "grab and shift" (horizontal carousel pan).
  let dragging = false;
  let dragMoved = false;
  let dragPointerId = -1;
  let dragStartX = 0;   // where the press began - the click-vs-drag slop is measured from here
  let dragStartY = 0;
  let dragAxis: 'pending' | 'horizontal' | 'vertical' = 'horizontal';
  let dragPosition = 0; // retain fractional pixels rather than round every pointer delta
  let dragSamples: Array<{ x: number; ts: number }> = [];
  let lastPointerX = 0;
  let lastMoveTs = 0;
  let pressLink: HTMLAnchorElement | null = null; // the tile link a mouse/pen press landed on
  let suppressNextClick = false;                  // we opened on pointerup; cancel the native click

  const DRAG_SLOP = 8;      // px a mouse/pen press may travel and still count as a click, not a drag

  // The current UI theme decides which transparent-background looks are legible (a
  // reverse/white look on a light tile - or a dark look on a dark tile - would vanish).
  const darkTheme = /^(dark|suse)$/.test(currentTheme());

  // Pause signals for the AMBIENT drift only (drag + inertia are user-driven and
  // ignore these). The drift runs only when ALL are clear.
  let hovering = false;
  let focusWithin = false;
  let touching = false;
  let manualUntil = 0; // timestamp; a hand-scroll / drag suppresses drift briefly

  // Flick cue - a soft paper tick as each tile / cover flips past WHILE the user is scrolling
  // (drag or flick-coast), never during the calm ambient drift. `flickIndex` tracks the item
  // currently at centre so we only tick on a crossing; the play is rate-limited so a fast riffle
  // flutters rather than buzzes.
  const FLICK_MIN_MS = 42;
  let lastFlickTs = 0;
  let flickIndex = -1;
  function flick(): void {
    const now = performance.now();
    if (now - lastFlickTs < FLICK_MIN_MS) return;
    lastFlickTs = now;
    playSfx('flick');
  }

  const clampV = (v: number): number => Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, v));
  const canDrift = (now: number): boolean =>
    looping && !coverflow && !reduced && !destroyed && visible && onScreen && !document.hidden &&
    !hovering && !focusWithin && !touching && now >= manualUntil;

  function normalizeWrap(): void {
    if (!looping || halfWidth <= 0) return;
    // Keep scrollLeft within [0, halfWidth): the second copy is identical, so
    // subtracting one copy's width has no visible seam. Handles drift, inertia
    // coast, and a hand-drag/scroll that runs off either end.
    if (viewport.scrollLeft >= halfWidth) viewport.scrollLeft -= halfWidth;
    else if (viewport.scrollLeft < 0) viewport.scrollLeft += halfWidth;
  }

  // The shared fan owns geometry, clone identity and seamless rebasing. Input
  // below supplies one scroll write per animation frame, as on the Docs landing.
  function layoutCoverflow(): void {
    if (!flow) return;
    const shift = flow.normalize();
    if (shift) {
      dragPosition += shift;
      if (snap) { snap.from += shift; snap.to += shift; }
    }
    flow.paint();
    section.classList.toggle('is-moving', dragging || snap !== null || performance.now() < cfWheelUntil);
  }
  const coverScrollLeft = (el: HTMLElement): number => flow?.target(el) ?? 0;
  const coverAtClientX = (x: number): HTMLElement | null => flow?.atClientX(x) ?? null;
  const nearestCoverScrollLeft = (position = viewport.scrollLeft): number => flow?.nearest(position) ?? 0;
  function flushDrag(): void {
    if (!pendingDx) return;
    dragPosition -= pendingDx;
    pendingDx = 0;
    viewport.scrollLeft = dragPosition;
    // Keep the browser's bounds for a single item, plus its fractional position.
    if (Math.abs(viewport.scrollLeft - dragPosition) > 1) dragPosition = viewport.scrollLeft;
    layoutCoverflow();
  }

  // Choose the landing cover at release, then travel there in ONE deceleration.
  // Coasting to a stop before choosing a snap caused a pause and sometimes a
  // backwards correction. A short flick must advance; a long swipe can cross
  // several covers. Velocity comes from recent event timestamps, not delivery
  // intervals (which bunch up when the mobile main thread is busy).
  function settleCoverflow(releaseVelocity = 0): void {
    const from = viewport.scrollLeft;
    let to = nearestCoverScrollLeft(from + releaseVelocity * 0.18);
    if (Math.abs(releaseVelocity) >= 250 && (to - from) * releaseVelocity <= 0) {
      to = flow?.step(Math.sign(releaseVelocity)) ?? to;
    }
    snapToCover(to, releaseVelocity);
  }

  function snapToCover(to: number, releaseVelocity = 0): void {
    const from = viewport.scrollLeft;
    velocity = 0;
    if (reduced || Math.abs(to - from) < 0.5) {
      viewport.scrollLeft = to;
      snap = null;
      layoutCoverflow();
      return;
    }
    const duration = Math.max(180, Math.min(480, 3000 * Math.abs(to - from) / Math.max(1000, Math.abs(releaseVelocity))));
    snap = { from, to, start: performance.now(), duration };
  }

  function tick(ts: number): void {
    if (destroyed) { raf = 0; return; }             // stop rescheduling once torn down
    if (!onScreen) { raf = 0; return; }             // parked off-screen - the observer restarts us
    raf = requestAnimationFrame(tick);
    const dt = lastTs ? ts - lastTs : 0;
    lastTs = ts;
    if (!visible || document.hidden || dt <= 0 || dt > 200) return; // skip huge gaps
    if (dragging) { if (coverflow) { flushDrag(); layoutCoverflow(); } return; }   // (1) pointer owns scrollLeft

    if (coverflow) {
      if (!snap && ts >= cfWheelUntil && Math.abs(nearestCoverScrollLeft() - viewport.scrollLeft) > 0.5) settleCoverflow();
      if (snap) {
        const progress = Math.min(1, Math.max(0, (ts - snap.start) / snap.duration));
        viewport.scrollLeft = snap.from + (snap.to - snap.from) * (1 - (1 - progress) ** 3);
        if (progress === 1) snap = null;
      }
      layoutCoverflow();
      return;
    }

    if (Math.abs(velocity) > INERTIA_MIN_V) {      // (2) flick / wheel coast
      viewport.scrollLeft += (velocity * dt) / 1000;
      velocity = clampV(velocity * INERTIA_FRICTION ** (dt / 16.67)); // frame-rate independent
      if (Math.abs(velocity) < INERTIA_MIN_V) velocity = 0;
      normalizeWrap();
      return;
    }
    if (canDrift(ts)) {                            // (3) ambient drift
      viewport.scrollLeft += (DRIFT_PX_PER_SEC * dt) / 1000;
      normalizeWrap();
    }
  }

  function setupLoop(): void {
    if (coverflow) {
      section.classList.remove('featured--overflow');
      if (flow) { if (flow.refresh()) { snap = null; pendingDx = 0; dragPosition = viewport.scrollLeft; } }
      else {
        track.querySelectorAll('.ftile--clone').forEach(node => node.remove());
        looping = false;
        halfWidth = 0;
        flow = mountCoverflow(viewport, track, { initialIndex, onChange(index) {
          if (flickIndex !== index) { if (flickIndex !== -1) flick(); flickIndex = index; }
          const button = section.querySelector('.featured-go');
          button?.setAttribute('aria-label', `Open ${entries[index]?.name ?? ''}`);
        } });
      }
      layoutCoverflow();
      return;
    }
    flow?.destroy();
    flow = null;
    track.querySelectorAll('.ftile--clone').forEach(node => node.remove());
    looping = false;
    halfWidth = 0;
    // A tile is ~fixed width; overflow means the single set is wider than the viewport.
    const overflow = track.scrollWidth - viewport.clientWidth > 4;
    if (reduced || !overflow) { section.classList.toggle('featured--overflow', overflow); return; }
    section.classList.add('featured--overflow');
    const originals = [...track.children] as HTMLElement[];
    const clones = originals.map((tile) => {
      const c = tile.cloneNode(true) as HTMLElement;
      c.classList.add('ftile--clone');
      c.setAttribute('aria-hidden', 'true');
      // Clones are decorative duplicates - keep them out of the tab order and off AT.
      if (c.matches('a,button,[tabindex]')) c.setAttribute('tabindex', '-1');
      c.querySelectorAll<HTMLElement>('a,button,[tabindex]').forEach((el) => el.setAttribute('tabindex', '-1'));
      return c;
    });
    clones.forEach((c) => track.appendChild(c));
    // The wrap period is the exact on-screen distance from the first original to
    // its clone - measured from layout, so track padding + the flex gap are all
    // accounted for (a computed width would be off by a gutter and the wrap would jump).
    halfWidth = clones[0]!.offsetLeft - originals[0]!.offsetLeft;
    looping = halfWidth > 0;
  }

  // ── Pause wiring (ambient drift) ─────────────────────────────────────────────
  section.addEventListener('pointerenter', () => { hovering = true; }, { signal });
  section.addEventListener('pointerleave', () => { hovering = false; }, { signal });
  section.addEventListener('focusin', () => { focusWithin = true; }, { signal });
  section.addEventListener('focusout', () => { focusWithin = false; }, { signal });
  viewport.addEventListener('touchstart', () => { touching = true; velocity = 0; }, { signal, passive: true });
  const endTouch = (): void => { touching = false; manualUntil = performance.now() + RESUME_DELAY_MS; };
  viewport.addEventListener('touchend', endTouch, { signal, passive: true });
  viewport.addEventListener('touchcancel', endTouch, { signal, passive: true });
  viewport.addEventListener('scroll', () => {
    if (coverflow) return; // the animation frame paints the fan once, after its scroll write
    normalizeWrap();
    // Flick as each tile passes centre - but only while the user is driving it (a drag or a
    // flick-coast), never during the calm ambient drift. `flickIndex` tracks position even while
    // drifting so the next user flick doesn't start out of sync.
    if (looping && halfWidth > 0) {
      const stride = halfWidth / Math.max(1, entries.length);
      const idx = Math.round((viewport.scrollLeft + viewport.clientWidth / 2) / stride);
      if (idx !== flickIndex) {
        if (flickIndex !== -1 && (dragging || Math.abs(velocity) > 30)) flick();
        flickIndex = idx;
      }
    }
  }, { signal, passive: true });

  // Open a tile's link the same way its native anchor would (same-origin hash route,
  // or an explicit resume URL). We do this on pointerup for a clean tap rather than
  // trust the native click, which a drifting / re-cloning carousel drops when the
  // mousedown and mouseup resolve to different nodes (and which pointer capture can
  // retarget off the anchor) - the root of "Open sometimes does nothing" on desktop.
  const openLink = (link: HTMLAnchorElement | null): void => {
    // Consumer-driven in-view open (see onActivate): hand the tile's id to the callback
    // rather than navigating its href, so a same-route "Open" isn't lost to route dedupe.
    const id = link?.closest<HTMLElement>('.ftile')?.dataset.tool;
    if (id) recordFeaturedActivity(collection, id);
    if (onActivate) {
      if (id) { onActivate(id); return; }
    }
    const href = link?.href || link?.getAttribute('href');
    if (href) window.location.href = href;
  };

  // ── Wheel ─────────────────────────────────────────────────────────────────────
  // Horizontal wheel (trackpad swipe) spins the carousel with momentum - the only
  // axis the strip owns. A vertical wheel ALWAYS falls through and scrolls the
  // PAGE, in every view mode: the strip must never capture it (scroll hijack - 
  // the old vertical-flips-examples gesture trapped readers trying to get past
  // the row). Non-passive so the horizontal branch can preventDefault.
  viewport.addEventListener('wheel', (e) => {
    if (reduced && !coverflow) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;    // vertical → page scroll
    manualUntil = performance.now() + RESUME_DELAY_MS;
    e.preventDefault();
    if (coverflow) {
      // Trackpads already supply momentum deltas. Follow them directly, then
      // settle after their stream ends instead of multiplying their inertia.
      viewport.scrollLeft += e.deltaX;
      snap = null;
      cfWheelUntil = performance.now() + 100;
      layoutCoverflow();
      return;
    }
    velocity = clampV(velocity + e.deltaX * WHEEL_TO_VELOCITY);
  }, { signal });

  // ── Pointer down - mouse/pen start a horizontal carousel drag; gallery touch is
  // left ENTIRELY to the browser (touch-action pan-x pan-y: horizontal pans the
  // strip's native scroller, vertical scrolls the page - never captured). Either
  // way the grab lights up the backdrop (see .is-grabbing). ──
  viewport.addEventListener('pointerdown', (e) => {
    if (dragging || !e.isPrimary) return;
    if (e.pointerType !== 'touch' && e.button !== 0 && e.button !== 1) return;
    // A press on the ⋯ menu button or an example dot is neither a pan nor a tile open - 
    // leave it to its own click handling (the consumer's actions menu / the dot branch of
    // the capture click handler below), whatever the view mode / device. Skipping here
    // also keeps pressLink unset, so the pointerup deterministic-open never fires for it.
    if ((e.target as Element | null)?.closest?.('.ftile-menu, .ftile-dot')) return;
    // Drag-out mode: a mouse/pen press ON a tile is a click-to-open or the start of a
    // native drag-to-folder - never a pan grab. Yield to the browser (no preventDefault /
    // pointer capture / dragging state) so HTML5 drag can begin; panning stays available
    // via the wheel/trackpad, the mobile grip, and the ambient drift. (Touch has no native
    // DnD, so it keeps its native scroll gestures.)
    if (tileDragOut && e.pointerType !== 'touch' && e.button === 0 && (e.target as Element | null)?.closest?.('.ftile-link')) return;
    velocity = 0;                                            // a grab cancels any coast
    snap = null;
    pendingDx = 0;
    dragMoved = false;                                       // fresh press - never inherit a prior drag's "moved"
    suppressNextClick = false;                               // fresh press - never inherit a stale suppress flag
    dragStartX = e.clientX;                                  // anchor for the click-vs-drag slop test
    dragStartY = e.clientY;
    dragAxis = e.pointerType === 'touch' ? 'pending' : 'horizontal';
    dragPosition = viewport.scrollLeft;
    dragSamples = [{ x: e.clientX, ts: e.timeStamp }];
    pressLink = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('.ftile-link') ?? null;
    section.classList.add('is-grabbing');
    // Gallery touch: no JS gesture - the native scroller owns both axes. (Cover Flow
    // touch keeps the JS horizontal drag; its pan-y touch-action leaves vertical to
    // the page.)
    if (e.pointerType === 'touch' && !coverflow) return;
    dragging = true;
    dragPointerId = e.pointerId;
    lastPointerX = e.clientX;
    lastMoveTs = performance.now();
    try { viewport.setPointerCapture(e.pointerId); } catch { /* capture is best-effort */ }
    // Stop the browser turning the drag into a text selection / native image-drag.
    if (e.pointerType !== 'touch') e.preventDefault();
  }, { signal });

  // A middle-button press must pan (like the canvas), not engage the browser's middle-click
  // autoscroll. preventDefault() on the pointerdown above doesn't stop it - the autoscroll
  // is a default action of the mousedown on this native scroller - so cancel it here.
  viewport.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); }, { signal });

  viewport.addEventListener('pointermove', (e) => {
    // Gallery touch never drags via JS (native scroller owns it), so `dragging` is
    // false and this returns. Mouse/pen (and Cover Flow touch): horizontal drag.
    if (!dragging || e.pointerId !== dragPointerId) return;
    if (dragAxis === 'pending') {
      const x = Math.abs(e.clientX - dragStartX), y = Math.abs(e.clientY - dragStartY);
      if (Math.max(x, y) <= DRAG_SLOP) return;
      dragAxis = x >= y ? 'horizontal' : 'vertical';
    }
    if (dragAxis === 'vertical') return; // native pan-y owns this gesture until pointercancel
    const now = performance.now();
    const dx = e.clientX - lastPointerX;
    // Click-vs-drag: it's a drag (which cancels the tile's click) only once the press has
    // travelled past the slop from where it began. A pixel or three of hand-jitter during
    // a plain click must still open the tool. Panning tracks every move regardless.
    if (Math.abs(e.clientX - dragStartX) > DRAG_SLOP) dragMoved = true;
    if (coverflow) {
      pendingDx += dx; // coalesced with every pointer sample into the next frame
      dragSamples.push({ x: e.clientX, ts: e.timeStamp });
      while (dragSamples.length > 2 && dragSamples[0]!.ts < e.timeStamp - 100) dragSamples.shift();
    } else viewport.scrollLeft -= dx;                        // content follows the pointer
    normalizeWrap();
    const dtm = now - lastMoveTs;
    if (dtm > 0) {
      // -dx: dragging content right (dx>0) DECREASES scrollLeft, so the coast that
      // continues that motion is negative. Exponential-smoothed so a jittery final
      // sample doesn't dominate the throw.
      velocity = clampV(velocity * 0.7 + ((-dx / dtm) * 1000) * 0.3);
    }
    lastPointerX = e.clientX;
    lastMoveTs = now;
    e.preventDefault();
  }, { signal });

  const endDrag = (e: PointerEvent): void => {
    if (e.pointerType === 'touch' && !coverflow) {           // no JS gesture to unwind - just the grab tint
      section.classList.remove('is-grabbing');
      manualUntil = performance.now() + RESUME_DELAY_MS;
      return;
    }
    if (!dragging || (e.pointerId !== undefined && e.pointerId !== dragPointerId)) return;
    if (coverflow) flushDrag();
    dragging = false;
    dragPointerId = -1;
    section.classList.remove('is-grabbing');
    manualUntil = performance.now() + RESUME_DELAY_MS;       // let the coast finish before drift
    const cancelled = e.type !== 'pointerup';
    if (coverflow) {
      const first = dragSamples[0]!, last = dragSamples.at(-1)!;
      const elapsed = last.ts - first.ts;
      const releaseVelocity = !cancelled && dragMoved && !reduced && elapsed > 0 && e.timeStamp - last.ts <= 80
        ? clampV((first.x - last.x) * 1000 / elapsed) : 0;
      settleCoverflow(releaseVelocity);
    } else if (cancelled || reduced || performance.now() - lastMoveTs > 80) velocity = 0;
    if (cancelled) { pressLink = null; suppressNextClick = true; return; }
    // As on Docs, take focus on release so a mouse/trackpad grab can be
    // followed immediately by arrow keys without an extra Tab or click.
    if (coverflow && e.pointerType !== 'touch') {
      viewport.dataset.focusBy = 'pointer';
      viewport.focus({ preventScroll: true });
    }
    // Deterministic open: a clean left tap/click (no drag, no modifier keys) opens the
    // pressed tile right here on release, rather than depending on the native <a> click
    // (which the drifting carousel drops when the press and release land on different
    // nodes → no click fires). Modified / middle clicks fall through to the native
    // anchor so cmd/ctrl/middle-click still open a new tab; keyboard Enter is unaffected.
    // In Cover Flow, only the centred cover opens - a side cover's click centres it (the
    // capture-phase handler below), so leave that to the native click path.
    const plainTap = !dragMoved && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey);
    const centredOrGallery = !coverflow || (pressLink?.closest('.ftile')?.classList.contains('is-centred') ?? false);
    if (plainTap && pressLink && centredOrGallery) {
      suppressNextClick = true;                              // cancel the native click so we don't double-navigate
      openLink(pressLink);
    }
  };
  viewport.addEventListener('pointerup', endDrag, { signal });
  viewport.addEventListener('pointercancel', endDrag, { signal });
  viewport.addEventListener('lostpointercapture', endDrag, { signal });
  viewport.addEventListener('click', (e) => {
    // Let a ⋯ menu-button click through untouched - it must reach the consumer's delegated
    // handler, and (in Cover Flow) must NOT be treated as a "centre this side cover" click.
    if ((e.target as Element | null)?.closest?.('.ftile-menu')) return;
    // An example dot picks that look directly - swallow the click so the wrapping
    // <a> doesn't also navigate. (The non-hijacking replacement for the old
    // vertical-scroll shift gesture.)
    const dot = (e.target as Element | null)?.closest?.<HTMLElement>('.ftile-dot');
    if (dot) {
      e.preventDefault();
      e.stopPropagation();
      const toolId = dot.closest<HTMLElement>('.ftile')?.dataset.tool;
      if (toolId) { jumpTool(toolId, Number(dot.dataset.dot ?? 0)); markManualShift(); }
      return;
    }
    // We already navigated on pointerup (deterministic open) - swallow the native click
    // so the anchor doesn't fire a second, duplicate navigation.
    if (suppressNextClick) { suppressNextClick = false; e.preventDefault(); e.stopPropagation(); dragMoved = false; return; }
    if (dragMoved) { e.preventDefault(); e.stopPropagation(); dragMoved = false; return; }
    // In-view activation (onActivate): a plain, unmodified click that DIDN'T come from a
    // pointerup-open - keyboard Enter on the focused anchor, or any native click we didn't
    // already handle - hands off to onActivate instead of the anchor's href navigation, so
    // keyboard users get the same in-view open (and it isn't lost to route dedupe). Modified
    // / middle clicks fall through so ⌘/ctrl/middle-click still open the deep link in a new
    // tab. In Cover Flow only the centred cover activates; a side cover still centres below.
    if (onActivate && e.button === 0 && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('.ftile-link');
      const centredOrGallery = !coverflow || (link?.closest('.ftile')?.classList.contains('is-centred') ?? false);
      if (link && centredOrGallery) { e.preventDefault(); e.stopPropagation(); openLink(link); return; }
    }
    // Cover Flow: clicking a side cover brings it to the centre (select it) rather than
    // opening; the centred cover is opened from the Open button (see .featured-go).
    // `closest('.ftile')` can't be trusted here - inside the fan Chrome's event hit test
    // resolves to the TRACK, never a cover (see coverAtClientX) - so fall back to which
    // cover the pointer's x lands on.
    if (coverflow) {
      const tile = (e.target as Element | null)?.closest?.<HTMLElement>('.ftile') ?? coverAtClientX(e.clientX);
      if (tile && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) {
        e.preventDefault(); e.stopPropagation();
        if (tile.classList.contains('is-centred')) openLink(tile.querySelector<HTMLAnchorElement>('.ftile-link'));
        else snapToCover(coverScrollLeft(tile));
      }
    }
  }, { signal, capture: true });

  section.addEventListener('keydown', (event) => {
    if (!coverflow || !flow || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    delete viewport.dataset.focusBy;
    const targetEl = event.target as Element;
    if (targetEl.closest('input,select,textarea,[contenteditable="true"],.ftile-menu,.ftile-dot')) return;
    let target: number | undefined;
    if (event.key === 'ArrowLeft') target = flow.step(-1, snap?.to);
    if (event.key === 'ArrowRight') target = flow.step(1, snap?.to);
    if (event.key === 'Home') target = flow.first();
    if (event.key === 'End') target = flow.last();
    if (target !== undefined) { event.preventDefault(); snapToCover(target); }
    else if (event.key === 'Enter' && event.target === viewport) {
      event.preventDefault();
      openLink(track.querySelector<HTMLAnchorElement>('.is-centred .ftile-link'));
    }
  }, { signal });
  viewport.addEventListener('focusin', (event) => {
    if (!coverflow || !flow) return;
    const tile = (event.target as Element).closest<HTMLElement>('.ftile:not(.ftile--clone)');
    if (tile) snapToCover(flow.target(tile));
  }, { signal });
  viewport.addEventListener('blur', () => { delete viewport.dataset.focusBy; }, { signal });

  // ── Cover Flow's Open button ─────────────────────────────────────────────────
  // The one control that opens the selected cover, and the reason it lives out here in
  // the section rather than inside the cover it belongs to: Chrome cannot target
  // anything inside the fan. Every cover carries a `translateZ` (layoutCoverflow recedes
  // each one so the fan can't paint over the centred cover), and a z-translated plane
  // inside a `transform-style: preserve-3d` context is not hit-testable - the event's
  // target is the preserve-3d root, `.featured-track`, wherever in the fan you press.
  // (Verified in Chrome 141: `rotateY` alone hit-tests fine, adding any translateZ makes
  // the subtree untargetable; elementsFromPoint still reports the covers, so it's the
  // event hit test specifically.) So the button sits OUTSIDE the 3D context, absolutely
  // positioned over the bottom edge of the centred cover (see featured.css), where it is
  // an ordinary, reliably clickable button - and it reads the cover to open off
  // `.is-centred` at click time.
  const goBtn = section.querySelector<HTMLElement>('.featured-go');
  goBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Mid-flick no cover is close enough to be `.is-centred`, and the button is always
    // there to be pressed - fall back to whichever cover is nearest the slot it sits in,
    // so a press during the settle opens that cover rather than nothing.
    const centred = section.querySelector<HTMLElement>('.ftile.is-centred')
      ?? coverAtClientX(viewport.getBoundingClientRect().left + viewport.clientWidth / 2);
    openLink(centred?.querySelector<HTMLAnchorElement>('.ftile-link') ?? null);
  }, { signal });
  // A middle-drag that actually panned must NOT also open the pressed tile in a new tab; a
  // stationary middle-click still gets its native open-in-new-tab (dragMoved stays false).
  viewport.addEventListener('auxclick', (e) => {
    if (dragMoved) { e.preventDefault(); e.stopPropagation(); dragMoved = false; }
  }, { signal, capture: true });

  // ── Mobile drag handle - a JS-driven page-scroll grip (pointer events, so it works
  // with a finger AND with a mouse at mobile widths). A belt-and-braces explicit
  // handle that drags the page 1:1 (finger/cursor up → content up), like the tool
  // editor's sheet grip. (Vertical swipes on the strip itself also scroll the page
  // now - the strip never captures vertical.) ──
  const grip = section.querySelector<HTMLElement>('.featured-grip');
  if (grip) {
    let gripId = -1;
    let gripY = 0;
    grip.addEventListener('pointerdown', (e) => {
      gripId = e.pointerId;
      gripY = e.clientY;
      grip.classList.add('is-dragging');
      try { grip.setPointerCapture(e.pointerId); } catch { /* best effort */ }
      e.preventDefault();
    }, { signal });
    grip.addEventListener('pointermove', (e) => {
      if (e.pointerId !== gripId) return;
      const dy = e.clientY - gripY;
      gripY = e.clientY;
      window.scrollBy(0, -dy);                 // drag up → scroll the page down (content follows)
      e.preventDefault();
    }, { signal });
    const gripEnd = (e: PointerEvent): void => {
      if (e.pointerId !== gripId) return;
      gripId = -1;
      grip.classList.remove('is-dragging');
      try { grip.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    };
    grip.addEventListener('pointerup', gripEnd, { signal });
    grip.addEventListener('pointercancel', gripEnd, { signal });
  }

  // Recompute the loop on resize (debounced to a frame).
  let resizeRaf = 0;
  const onResize = (): void => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(setupLoop);
  };
  window.addEventListener('resize', onResize, { signal });
  const sizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null;
  sizeObserver?.observe(viewport);
  const firstTile = track.querySelector('.ftile');
  if (firstTile) sizeObserver?.observe(firstTile);

  // Initial layout can shift as the committed preview images decode (they change tile
  // heights only, but a late web-font / reflow can nudge widths); establish the loop
  // now and once more after a beat.
  const startRaf = (): void => { if (!raf && !destroyed) raf = requestAnimationFrame(tick); };
  setupLoop();
  const relayout = setTimeout(setupLoop, 600);
  // Gallery needs the loop for drift/inertia (skipped under reduced motion); Cover Flow
  // always needs it for its snap + live transforms.
  if (coverflow || !reduced) startRaf();

  // Resume hook for the progressive-variant queue below - assigned once its jobs exist,
  // called by the vizObserver when the row scrolls back into view. No-op until then.
  let resumeQueue: () => void = () => {};

  // Park all motion while the strip is fully scrolled out of view; resume (slightly early,
  // via the rootMargin) as it comes back. On-screen behaviour is byte-identical - this only
  // stops the loop + cross-fade when there's nothing on screen to animate. Graceful fallback:
  // no IntersectionObserver → onScreen stays true and everything runs as before.
  if (typeof IntersectionObserver === 'function') {
    vizObserver = new IntersectionObserver((entries2) => {
      const nowOn = entries2[entries2.length - 1]!.isIntersecting;
      if (nowOn === onScreen) return;
      onScreen = nowOn;
      if (nowOn) { lastTs = 0; startRaf(); resumeQueue(); }   // reset clock + resume enrichment on re-entry
    }, { rootMargin: '200px' });
    vizObserver.observe(section);
  }

  // ── Progressive previews (one still cover for discovery under reduced motion) ──
  // Round-robin across tools so every tile gets its first extra look before any gets
  // its second - the row enriches evenly. Serial, on idle, cached; a failure just
  // leaves that tile with fewer looks.
  let ricId = 0;
  if (!perfUiOn() && (!reduced || entries.some(e => e.galleryPreview))) {
    const jobs: VariantJob[] = [];
    const perTool = entries.map((e) => {
      const fmt = displayFormatOf(e.formats);
      const looks = fmt ? resolveExamples(e) : [];
      return { entry: e, id: e.id, formats: e.formats, canRender: !!fmt, variants: reduced ? (e.galleryPreview ? looks.slice(0, 1) : []) : looks };
    });
    const maxV = perTool.reduce((m, t) => Math.max(m, t.variants.length), 0);
    for (let i = 0; i < maxV; i++) {
      for (const t of perTool) {
        const v = t.variants[i];
        if (!v || !t.canRender) continue;
        // Theme filter: skip a look tagged for the OPPOSITE UI theme - a reverse/white
        // look on a light tile (or a dark look on a dark tile) would be near-invisible.
        // `index: i` keeps the ORIGINAL manifest position so the render cache key is
        // stable whichever looks the theme filters in/out.
        if (v.theme && (v.theme === 'dark') !== darkTheme) continue;
        jobs.push({ id: t.id, formats: t.formats, index: i, values: v.values, look: v, tool: t.entry });
      }
    }

    const addVariantImage = async (job: VariantJob, src: string): Promise<void> => {
      // Append to the original tile AND its clone, so both stay in sync as they drift.
      const added: HTMLImageElement[] = [];
      track.querySelectorAll<HTMLElement>(`.ftile[data-tool="${CSS.escape(job.id)}"] .ftile-stage`).forEach((stage) => {
        const img = document.createElement('img');
        img.className = stage.querySelector('.ftile-img.is-active') ? 'ftile-img' : 'ftile-img is-active';
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.draggable = false;
        // A pre-rendered look is a manifest URL (fetched, and able to 404); a live render
        // is a data-URL that decodes synchronously-ish. Either way the ticker rotates it
        // in once ready - only the first kind needs the error handler's re-render, so only
        // that kind carries its job.
        if (isManifestLook(src)) lookJob.set(img, job);
        img.src = src;
        stage.appendChild(img);
        added.push(img);
      });
      // Precompute this look's seeded open URL once (shared by the tile + its wrap-clone) so
      // clicking the tile while this look is on screen opens the tool in this exact style - 
      // matching the gallery carousels. advanceStage points the tile's <a> at whichever look
      // is active; if this one is already showing when its URL resolves, refresh it now. A
      // failed build just leaves the default route (toolSeedHref falls back to it).
      void (job.tool?.galleryPreview ? galleryLookHref(job.id, job.look) : toolSeedHref(job.id, job.values)).then((href) => {
        for (const img of added) {
          img.dataset.seedhref = href;
          if (img.classList.contains('is-active')) refreshLinkHref(img.closest('.ftile-link'));
        }
      });
      await Promise.all(added.map(img => img.decode().catch(() => {})));
    };

    // A look whose manifest file 404'd: render it live and re-append it. Once per look,
    // not once per <img> - the tile and each of setupLoop's wrap-clones carries its own
    // copy of the same src, so they all error separately; addVariantImage then re-appends
    // to every stage at once. The re-render is cached under its own namespace, so the
    // repeat visit that 404s again reuses it instead of rendering a second time.
    const retried = new Set<string>();
    retryLook = (job: VariantJob): void => {
      const key = `${job.id}:${job.index}`;
      if (destroyed || retried.has(key)) return;
      retried.add(key);
      void renderMissingLook(host, job.id, job.formats, job.index, job.values)
        .then(async (thumb) => { if (!destroyed) await addVariantImage(job, thumb); })
        .catch((e) => host.log?.('warn', `Featured look missing and re-render failed for ${job.id}`, { error: String((e as { message?: unknown })?.message ?? e) }));
    };

    const renderJob = async (job: VariantJob): Promise<void> => {
      if (destroyed) return;
      try {
        const thumb = await (job.tool?.galleryPreview && job.look
          ? renderGalleryLook(host, job.tool, job.index, job.look)
          : renderFeaturedVariant(host, job.id, job.formats, job.index, job.values));
        if (!destroyed) await addVariantImage(job, thumb);
      } catch (e) {
        host.log?.('warn', `Featured variant failed for ${job.id}`, { error: String(e) });
      }
    };
    if (opts.previewQueue) {
      // Register the whole strip now so its extra templates cannot jump ahead
      // of covers in the grid (or another strip). Hidden rows park their work.
      const firstByTool = new Set<string>();
      for (const job of jobs) {
        const cover = !firstByTool.has(job.id);
        firstByTool.add(job.id);
        opts.previewQueue.add({
          priority: () => !visible ? null : cover ? (onScreen ? 0 : 1) : onScreen ? 2 : null,
          stale: () => destroyed,
          run: () => renderJob(job),
        });
      }
      resumeQueue = () => opts.previewQueue?.wake();
    } else {
      // Other consumers keep their own queue, paused while their row is off-screen.
      let queueArmed = false;
      const pumpQueue = (): void => {
        if (destroyed || !onScreen) return;
        const job = jobs.shift();
        if (!job) return;
        void renderJob(job).finally(() => {
          if (!destroyed && onScreen && jobs.length) ricId = ric(pumpQueue);
        });
      };
      resumeQueue = (): void => { if (queueArmed && !destroyed && onScreen && jobs.length) ricId = ric(pumpQueue); };
      const armQueue = (): void => { if (queueArmed || destroyed || !jobs.length) return; queueArmed = true; ricId = ric(pumpQueue); };
      if (document.readyState === 'complete') ricId = ric(armQueue);
      else window.addEventListener('load', () => ric(armQueue), { once: true, signal });
    }
  }

  return {
    setVisible(v: boolean) {
      visible = v;
      opts.previewQueue?.wake();
      // Re-measure when re-shown: the row may have been laid out (or the window
      // resized) while hidden, so the loop's overflow decision can be stale.
      if (v) setupLoop();
    },
    setViewMode(mode: FeaturedViewMode) {
      const next = mode === 'coverflow';
      if (next === coverflow) return;
      coverflow = next;
      velocity = 0;
      snap = null;
      flickIndex = -1;   // the two modes index differently - don't flick on the switchover
      section.classList.toggle('featured--coverflow', coverflow);
      pendingDx = 0;
      dragging = false;
      setupLoop();
      startRaf();                            // Cover Flow needs the loop even under reduced motion
    },
    destroy() {
      destroyed = true;
      ac.abort();
      vizObserver?.disconnect();
      flow?.destroy();
      sizeObserver?.disconnect();
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      clearTimeout(relayout);
      clearTimeout(shiftClsTimer);
      if (fadeTimer) clearInterval(fadeTimer);
      if (ricId) cancelRic(ricId);
    },
  };
}
