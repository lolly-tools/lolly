// SPDX-License-Identifier: MPL-2.0
/**
 * vector-paint - the vocabulary shared by a canvas that PAINTS and a walker that
 * SERIALISES, so the two can agree on the same picture without importing each other.
 *
 * The mechanism it exists for: a clip bar keeps its <canvas> exactly as it is for the
 * live UI, and additionally stamps `__lollyVectorTwin` on that element - a function
 * returning SVG markup for what it just painted, or null when it cannot say. The
 * HTML→SVG walker's `tag === 'canvas'` branch asks for the twin FIRST and falls back
 * to today's `toDataURL()` on any miss, throw or timeout. A canvas with no such
 * property must serialise byte-identically to how it always has - that is the whole
 * safety guarantee for every other tool's export, so nothing here may be reachable
 * from the plain path.
 *
 * DOM-LIGHT ON PURPOSE. This module is imported by BOTH the timeline panel and
 * bridge/export.ts; the panel must never gain a static edge to the export bridge (it
 * has none today, and a twin must not be what introduces one). So the shared pieces - 
 * the geometry, the markup builders, the id namespacing - live here, in a file that
 * touches only `DOMParser` and the `Element` API and imports nothing at all.
 *
 * THE DRIFT RULE. `waveformPathD` and `stillTilePx` are transcriptions of two loops in
 * views/timeline-panel.ts. If the canvas arithmetic moves and these do not, an export
 * silently stops matching the screen - the one failure this feature must not have.
 * vector-paint.test.ts pins each against the panel's expression term for term.
 */

/** What a painting element stamps on itself: markup for what it just drew, or null. */
export type VectorTwin = () => string | null | Promise<string | null>;

/** A canvas that may be able to describe its own paint as vector. */
export type VectorTwinCanvas = HTMLCanvasElement & { __lollyVectorTwin?: VectorTwin };

/**
 * Tiling caps out here. A bar is at most a few thousand CSS px and a tile at least 6,
 * so a legitimate still never approaches this; a degenerate tile width (or a future
 * caller passing a bad aspect) would otherwise emit an unbounded run of <use>.
 */
export const MAX_TWIN_TILES = 64;

/**
 * A twin larger than this is refused at the parse boundary rather than spliced in.
 * The point of a twin is FIDELITY and resolution independence, not size - a producer
 * emitting a quarter-megabyte of markup has lost the plot, and the raster fallback is
 * both correct and bounded, so declining is strictly the better failure.
 */
export const MAX_TWIN_BYTES = 256 * 1024;

const SVG_NS = 'http://www.w3.org/2000/svg';

/** XML text/attribute escaping. Colours and ids reach markup as raw strings. */
export function escXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Coordinate formatting. Three decimals is below a device pixel at any zoom this UI
 * reaches, and trimming the tail keeps a few thousand waveform bars from paying for
 * `0.000000000001` noise out of the float arithmetic.
 */
export function n3(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** A complete standalone SVG document string around an already-built body. */
export function svgDoc(w: number, h: number, body: string): string {
  const vw = Math.max(0, w);
  const vh = Math.max(0, h);
  return `<svg xmlns="${SVG_NS}" width="${n3(vw)}" height="${n3(vh)}" `
    + `viewBox="0 0 ${n3(vw)} ${n3(vh)}" preserveAspectRatio="none">${body}</svg>`;
}

/** The flat-fill bar: the same one fillRect `paintFill` draws. */
export function rectBody(color: string, w: number, h: number): string {
  return `<rect x="0" y="0" width="${n3(Math.max(0, w))}" height="${n3(Math.max(0, h))}"`
    + ` fill="${escXml(color)}"/>`;
}

/**
 * The waveform, as one path of bar subpaths.
 *
 * TRANSCRIBED from the `mode === 'waveform'` fillRect loop in views/timeline-panel.ts:
 *
 *   const bw = w / data.length;
 *   const amp = Math.max(0.02, Math.min(1, data[i]));
 *   const bh  = amp * (h - 4);
 *   ctx.fillRect(i * bw, (h - bh) / 2, Math.max(1, bw - 0.5), bh);
 *
 * Every term is reproduced, including the 0.02 floor - which is why a silent clip
 * exports as the same hairline row of bars it shows on screen rather than as nothing.
 */
export function waveformPathD(data: ArrayLike<number>, w: number, h: number): string {
  const n = data.length;
  if (!n || !(w > 0)) return '';
  const bw = w / n;
  const barW = Math.max(1, bw - 0.5);
  let d = '';
  for (let i = 0; i < n; i++) {
    const amp = Math.max(0.02, Math.min(1, Number(data[i]) || 0));
    const bh = amp * (h - 4);
    const x = i * bw;
    const y = (h - bh) / 2;
    d += `M${n3(x)} ${n3(y)}h${n3(barW)}v${n3(bh)}h${n3(-barW)}Z`;
  }
  return d;
}

/**
 * The tile advance for a still, from `drawTiled` in views/timeline-panel.ts:
 *
 *   const tile = bm.height > 0 ? Math.max(6, (bm.width / bm.height) * h) : h;
 *
 * `aspect` is that width/height; a caller with no usable aspect (a zero-height or
 * undecoded bitmap) passes 0 and gets the bar height back, exactly as the canvas does.
 */
export function stillTilePx(aspect: number, h: number): number {
  return aspect > 0 ? Math.max(6, aspect * h) : h;
}

/**
 * One tile, defined once and repeated across the bar with <use> - the vector form of
 * `for (let x = 0; x < w; x += tile) drawImage(...)`.
 *
 * Clipped to the bar box because the canvas version is: the last tile overhangs `w`
 * and the canvas edge cuts it. Without the clip an inlined twin would paint past its
 * bar and over its neighbour.
 *
 * Ids here are LOCAL and deliberately unremarkable - `namespaceSvgRefs` namespaces them at
 * insertion time, which is what keeps two twins in one document from colliding.
 *
 * Returns NULL rather than a short run when the bar needs more than MAX_TWIN_TILES.
 * The canvas loop this transcribes has no cap (`for (let x = 0; x < w; x += tile)`), so
 * capping the vector form would export a bar whose right-hand end is blank while the
 * screen shows it fully tiled - the one failure this feature must never have, and not a
 * rare one: `tile` floors at 6px, so a tall still truncates from about 384px of bar.
 * Null falls through to the PNG the user is actually looking at.
 */
export function tileBody(innerMarkup: string, tileW: number, w: number, h: number): string | null {
  const width = Math.max(0, w);
  const height = Math.max(0, h);
  const step = tileW > 0 ? tileW : width || 1;
  if (Math.ceil(width / step) > MAX_TWIN_TILES) return null;
  let uses = '';
  for (let x = 0; x < width; x += step) {
    uses += `<use href="#twin-tile" x="${n3(x)}" y="0"/>`;
  }
  return `<defs><g id="twin-tile">${innerMarkup}</g>`
    + `<clipPath id="twin-clip"><rect x="0" y="0" width="${n3(width)}" height="${n3(height)}"/></clipPath>`
    + `</defs><g clip-path="url(#twin-clip)">${uses}</g>`;
}

/**
 * Parse a twin's markup into an element the walker can adopt, or null.
 *
 * Null is a first-class answer, not an error path: every rejection here simply leaves
 * the canvas to today's toDataURL block. So the checks are cheap and total - a size
 * cap before parsing, the browser's own parsererror node, and a root that must
 * actually be <svg> (a producer returning a fragment, HTML, or an error page must not
 * be spliced into the export tree).
 */
export function parseSvgRoot(markup: string): Element | null {
  if (typeof markup !== 'string' || !markup) return null;
  if (markup.length > MAX_TWIN_BYTES) return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
  } catch {
    return null;
  }
  // Failure is reported IN-BAND as a <parsererror> element, not by throwing, and it can
  // sit anywhere in the returned tree depending on the engine - hence the query rather
  // than a root-tag test.
  if (doc.getElementsByTagName('parsererror').length) return null;
  const root = doc.documentElement;
  if (!root || root.localName !== 'svg') return null;
  return root;
}

const URL_REF = /url\(\s*(['"]?)#([^)'"\s]+)\1\s*\)/g;
/** The only two attributes that take a bare `#fragment` - see namespaceSvgRefs. */
const LOCAL_HREF = new Set(['href', 'xlink:href']);
/** `#foo` in CSS SELECTOR position: preceded by start-of-text, whitespace, or a combinator. */
const ID_SELECTOR = /(^|[\s,>+~{}])#([A-Za-z_][\w-]*)/g;
/** `.foo` in CSS selector position, same leads. Classes are namespaced wholesale - a
 *  twin's stylesheet is unscoped in the export document, so an un-prefixed class rule
 *  reaches every element in the file. */
const CLASS_SELECTOR = /(^|[\s,>+~{}])\.([A-Za-z_][\w-]*)/g;

/**
 * Namespace every id in a twin, and every reference to one.
 *
 * HAZARD THIS EXISTS FOR: `renderSvgFromHtml`'s `uid` counter is a per-call local, so
 * two independently-produced twins in one document both mint `fcclip-1` and every
 * later `url(#fcclip-1)` resolves to whichever came first - clip paths, gradients and
 * masks silently swapping between clips. Ids are only unique within the twin that
 * made them, so they get made unique at insertion instead.
 *
 * Only ids DEFINED in this subtree are rewritten. A reference pointing outside (into
 * the host document) is left exactly as it is - rewriting it would break it.
 */
export function namespaceSvgRefs(root: Element, prefix: string): void {
  if (!root || !prefix) return;
  const all: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];

  const defined = new Set<string>();
  for (const el of all) {
    const id = el.getAttribute('id');
    if (id) defined.add(id);
  }
  // No early return on an empty id set: CLASS namespacing below is independent of ids,
  // and a twin carrying `.cls-1 { … }` with no ids at all is exactly the Illustrator
  // export that would otherwise restyle the whole document.

  const rename = (id: string): string => `${prefix}${id}`;

  for (const el of all) {
    const id = el.getAttribute('id');
    if (id && defined.has(id)) el.setAttribute('id', rename(id));

    for (const attr of Array.from(el.attributes)) {
      const v = attr.value;
      if (!v) continue;
      // A bare fragment reference, and ONLY on the two attributes that actually take
      // one. The tempting rule - "any value starting with # whose target is a defined
      // id" - is ambiguous by construction: `fill="#abc"` is the colour #abc, and a
      // twin embedding arbitrary user SVG (the still path resolves a data: URL) can
      // easily define an id named `abc`. That rewrite produced `fill="#tw1-abc"`,
      // which is not a colour at all, so the shape silently lost its paint.
      if (LOCAL_HREF.has(attr.localName) && v.charCodeAt(0) === 35 /* # */) {
        const target = v.slice(1);
        if (defined.has(target)) { attr.value = `#${rename(target)}`; continue; }
      }
      // Class ATTRIBUTES move with the class selectors renamed in <style> below - 
      // renaming one without the other is how a twin loses its paint.
      if (attr.localName === 'class') {
        attr.value = v.split(/\s+/).filter(Boolean).map((c) => `${prefix}${c}`).join(' ');
        continue;
      }
      // url(#…) can appear in ANY attribute value, including the inline `style`
      // attribute (which is why style needs no special case - it is an attribute).
      if (v.includes('url(')) {
        URL_REF.lastIndex = 0;
        attr.value = v.replace(URL_REF, (whole, q: string, target: string) =>
          defined.has(target) ? `url(${q}#${rename(target)}${q})` : whole);
      }
    }

    // A twin may carry its own <style>, and it reaches the export document UNSCOPED
    // (export.ts runs unscopeStyleEls before this), so everything in it has to be
    // namespaced or it addresses the whole file:
    //   • url(#…) - the same references the attributes above carry;
    //   • `#foo { … }` ID SELECTORS - renaming the id without renaming the selector
    //     leaves a rule matching nothing, so the twin silently loses that styling;
    //   • `.cls-1 { … }` CLASS SELECTORS - nothing else namespaces classes, and an
    //     Illustrator-style `.cls-1 { fill: … }` riding in on a still would restyle
    //     unrelated elements ANYWHERE in the exported document.
    if (el.localName === 'style' && el.textContent) {
      URL_REF.lastIndex = 0;
      el.textContent = el.textContent
        .replace(URL_REF, (whole, q: string, target: string) =>
          defined.has(target) ? `url(${q}#${rename(target)}${q})` : whole)
        .replace(ID_SELECTOR, (whole, lead: string, target: string) =>
          defined.has(target) ? `${lead}#${rename(target)}` : whole)
        .replace(CLASS_SELECTOR, (_whole, lead: string, cls: string) => `${lead}.${prefix}${cls}`);
    }
  }
}
