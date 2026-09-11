// SPDX-License-Identifier: MPL-2.0
/**
 * Shell-side enhancer for `[data-anim-src]` markers: fetch an SVG, sanitise it,
 * and INLINE it as a live `<svg>` so its animation actually plays AND is
 * frame-addressable (seekable via dom-frame's scrubAnimations). This is the
 * animated-SVG analogue of lottie-mount.ts - a first-class media citizen so any
 * CSS/SMIL-animated SVG (catalog OR a user upload) behaves like a Lottie: it
 * plays in the preview, samples through `onFrame` (filter's live source), and
 * exports frame-accurately in the sequence compositor.
 *
 * Why inline (not `<img>`): an `<img src=…svg>` is an opaque, script-inert
 * document whose animation the browser will play but which `getAnimations()`
 * cannot see and no canvas can seek - so it freezes on rasterisation. Inlining
 * makes it live and seekable; the cost is that inline SVG executes what it
 * carries, so every source goes through the SVG sanitiser first (scripts, `on*`
 * handlers, `javascript:` refs, `<foreignObject>` stripped - animation CSS/SMIL
 * preserved). Same treatment an upload gets at ingest; belt-and-braces here.
 *
 * Marker attributes:
 *   data-anim-src   required - URL of the SVG (blob:/https/relative)
 *   data-anim-fit   'cover' → preserveAspectRatio 'xMidYMid slice' (default 'meet')
 *
 * No global animation loop to leak (unlike lottie-web's shared rAF), so there is
 * no player registry to reap - a CSS/SMIL SVG removed by the innerHTML rebuild is
 * simply gone. The only shared state is a per-URL cache of the sanitised markup so
 * a repaint re-inlines from memory instead of re-fetching + re-sanitising.
 */

import { sanitizeSvgToString } from '../bridge/svg-sanitize.ts';

/** Sanitised `<svg>` markup per URL - one fetch + sanitise per asset across paints. */
const markupCache = new Map<string, Promise<string>>();

/** Fetch + sanitise an SVG, cached by URL. Rejections are dropped from the cache so a
 *  transient failure does not poison the URL for later mounts. */
export function fetchAnimSvg(url: string): Promise<string> {
  let p = markupCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`anim-svg fetch ${res.status}: ${url}`);
        return res.text();
      })
      .then((text) => sanitizeSvgToString(text));
    p.catch(() => {
      if (markupCache.get(url) === p) markupCache.delete(url);
    });
    markupCache.set(url, p);
  }
  return p;
}

/** True once `el` holds an inlined `<svg>` (already mounted this paint). */
function isMounted(el: Element): boolean {
  return !!el.querySelector(':scope > svg');
}

async function mountOne(el: Element, isCurrent: () => boolean): Promise<void> {
  const src = el.getAttribute('data-anim-src');
  if (!src || isMounted(el)) return;

  const clean = await fetchAnimSvg(src);
  // Re-guard after the await: the paint may have moved on, the node may be
  // orphaned, or a concurrent pass may have mounted this el while we fetched.
  if (!isCurrent() || !el.isConnected || isMounted(el)) return;

  el.innerHTML = clean;
  const svg = el.querySelector(':scope > svg') as SVGSVGElement | null;
  if (!svg) return;
  // Fill the host box; honour the box's fit. The SVG keeps its own viewBox.
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';
  svg.setAttribute(
    'preserveAspectRatio',
    el.getAttribute('data-anim-fit') === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet',
  );
  el.classList.add('is-anim-live');
}

/**
 * Post-paint enhancer: inline a live `<svg>` on every `[data-anim-src]` marker
 * under `rootEl` that is not already mounted. Resolves after all mounts settle
 * (immediately when there is nothing to mount). Per-marker failures are warned
 * and swallowed - one bad asset must not break the paint. Mirrors the
 * `mountLottiePlayers` contract so `tool.ts`'s paint pass drives both the same way.
 */
export async function mountAnimSvgPlayers(
  rootEl: Element,
  { isCurrent = () => true }: { isCurrent?: () => boolean } = {},
): Promise<void> {
  const els = [...rootEl.querySelectorAll('[data-anim-src]')];
  if (!els.length || !isCurrent()) return;
  await Promise.all(
    els.map(async (el) => {
      try {
        await mountOne(el, isCurrent);
      } catch (e) {
        console.warn(`anim-svg-mount: ${el.getAttribute('data-anim-src')}: ${(e as { message?: string })?.message ?? e}`);
      }
    }),
  );
}

/** Mount ONE `[data-anim-src]` marker (for the media sampler, which mounts a single
 *  off-screen host before sampling it). Resolves once inlined (or on failure). */
export async function mountAnimSvgMarker(
  el: Element,
  { isCurrent = () => true }: { isCurrent?: () => boolean } = {},
): Promise<void> {
  try {
    await mountOne(el, isCurrent);
  } catch (e) {
    console.warn(`anim-svg-mount: ${el.getAttribute('data-anim-src')}: ${(e as { message?: string })?.message ?? e}`);
  }
}
