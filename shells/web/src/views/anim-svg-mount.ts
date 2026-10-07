// SPDX-License-Identifier: MPL-2.0
/**
 * Shell-side enhancer for `[data-anim-src]` markers: fetch an SVG, sanitise it,
 * and INLINE it as a live `<svg>` so its animation actually plays AND is
 * frame-addressable (seekable via export.ts's scrubAnimations). This is the
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
import { scopeTemplateStyles } from '../lib/scope-css.ts';

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

/** A per-mount prefix source: every inlined copy gets ids and a style scope of its own. */
let mountSeq = 0;

/** The `url(#id)` references in an attribute value or stylesheet, pointed at the renamed ids. */
function retarget(value: string, ids: Map<string, string>): string {
  return value.replace(/url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g, (whole, q: string, id: string) =>
    ids.has(id) ? `url(${q}#${ids.get(id)}${q})` : whole);
}

/**
 * Give one inlined SVG ids nothing else on the page shares.
 *
 * An `<img>` is its own document, so two boxes showing the same SVG never noticed they
 * both said `id="linear-gradient-3"`. Inlined, they share the app's one document, where
 * `url(#…)` resolves to the FIRST element with that id: the second copy borrows the
 * first copy's gradients and clip paths, and when the first copy sits in something
 * hidden (another artboard, a collapsed group) the second paints black or unclipped.
 * Two different tools composed into one board collide the same way on ordinary
 * exporter names. So each mount renames every id with its own prefix and points every
 * reference inside the SVG at the new name: `url(#…)` in attributes and stylesheets,
 * `href="#…"`, and an SMIL `begin`/`end` that waits on another element (`a.end`).
 */
function namespaceIds(svg: SVGSVGElement, prefix: string): void {
  const ids = new Map<string, string>();
  for (const node of svg.querySelectorAll('[id]')) {
    ids.set(node.id, prefix + node.id);
    node.id = prefix + node.id;
  }
  if (!ids.size) return;
  for (const node of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...node.attributes]) {
      const { name, value } = attr;
      if (name === 'id') continue;
      let next = value;
      if ((name === 'href' || name === 'xlink:href') && value.startsWith('#')) {
        const id = value.slice(1);
        if (ids.has(id)) next = `#${ids.get(id)}`;
      } else if (name === 'begin' || name === 'end') {
        next = value.replace(/(^|[;\s])([A-Za-z_][\w.-]*?)\.(begin|end|repeat|click)/g, (whole, lead: string, id: string, ev: string) =>
          ids.has(id) ? `${lead}${ids.get(id)}.${ev}` : whole);
      } else if (value.includes('url(')) {
        next = retarget(value, ids);
      }
      if (next !== value) node.setAttributeNS(attr.namespaceURI, name, next);
    }
    if (node.localName === 'style' && node.textContent?.includes('url(')) node.textContent = retarget(node.textContent, ids);
  }
}

async function mountOne(el: Element, isCurrent: () => boolean): Promise<void> {
  const src = el.getAttribute('data-anim-src');
  if (!src || isMounted(el)) return;

  const clean = await fetchAnimSvg(src);
  // Re-guard after the await: the paint may have moved on, the node may be
  // orphaned, or a concurrent pass may have mounted this el while we fetched.
  if (!isCurrent() || !el.isConnected || isMounted(el)) return;

  // Built in a detached holder and made unique before it is inserted, so no frame ever
  // shows two copies sharing an id. Its own stylesheet is scoped to this marker as a
  // tool template's is (and marked, so an exporter lifting the <svg> out un-scopes the
  // rules again): an inlined `<style>` is otherwise page-global, and one SVG's `.cls-5`
  // restyled every other SVG that used the same exporter's class names.
  const scope = String(++mountSeq);
  const holder = el.ownerDocument.createElement('div');
  holder.innerHTML = clean;
  const svg = [...holder.children].find((n): n is SVGSVGElement => n.localName === 'svg');
  if (!svg) return;
  namespaceIds(svg, `lam${scope}-`);
  el.setAttribute('data-anim-scope', scope);
  scopeTemplateStyles(holder, `[data-anim-scope="${scope}"]`);
  el.replaceChildren(...holder.childNodes);
  // Fill the host box; honour the box's fit. The SVG keeps its own viewBox.
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  svg.style.display = 'block';
  svg.setAttribute(
    'preserveAspectRatio',
    el.getAttribute('data-anim-fit') === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet',
  );
  el.classList.add('is-anim-live');
  // Every <svg> keeps its own SMIL timeline, and Chromium starts a NESTED one only when
  // the page loads: inserted later, as here, its tracks sit at their first sample while
  // getCurrentTime() reports time passing. A composed tool render is exactly that shape
  // (the export wraps the tool's own <svg> in an outer one), so Pose Geeko's loop showed
  // as a still. Seeking a nested timeline starts its tracks, but only from a later
  // task than the insertion: in the same task, or on the very next animation frame, the
  // tracks are not scheduled yet and the seek does nothing (measured in Chromium). A
  // timeline someone has paused since (the sequence clock posing the picture) belongs
  // to that someone and is left alone. The ready nudge follows the kick, so a clock
  // that poses on the nudge always has the last word.
  const kick = (): void => {
    if (!svg.isConnected) return;
    for (const inner of svg.querySelectorAll('svg')) {
      try { if (!inner.animationsPaused()) { inner.setCurrentTime(svg.getCurrentTime()); inner.unpauseAnimations(); } } catch { /* no SMIL support */ }
    }
    // A timeline that is holding the playhead has to pose this picture too, and it was
    // not here when that pass ran: the same nudge lottie-mount gives the sequence clock.
    el.dispatchEvent(new CustomEvent('lolly:anim-svg-ready', { bubbles: true }));
  };
  setTimeout(kick, 0);
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
