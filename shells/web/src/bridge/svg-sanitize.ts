// SPDX-License-Identifier: MPL-2.0
/**
 * Make untrusted SVG markup safe to INLINE live into the app DOM.
 *
 * Inlining a raw `<svg>` (unlike an `<img src=…svg>`, which is an opaque, script-
 * inert document) executes anything it carries - `<script>`, `on*` handlers,
 * `javascript:` refs, `<foreignObject>` HTML. That is the price of making an SVG
 * animation live + seekable (see anim-svg-mount / dom-frame). So every SVG that
 * did not originate in our own catalog goes through here first.
 *
 * This is the SAME treatment an upload already gets at ingest (picker.ts) and in
 * beam-pack import: DOMPurify's SVG profile, serialised from the sanitised DOM
 * NODE with XMLSerializer (NOT DOMPurify's HTML string output, which turns a
 * literal U+00A0 into `&nbsp;` - undefined in XML, blanks the file on strict
 * re-parse). Verified to PRESERVE animation: `<style>`, `@keyframes`, the
 * `animation` property, `color-mix()`, `var()`, `transform-box`, `hue-rotate`
 * and `mix-blend-mode` all survive, so a sanitised SVG still animates.
 *
 * FAILS CLOSED: a realm without a DOM (a worker, a test) cannot make markup safe,
 * so it throws rather than return something it did not read. Callers that reach
 * this only run on the main thread (the enhancer inlines into the live document).
 */

/** DOMPurify is a heavy dep; load it on demand (first untrusted SVG), like lottie-web. */
let purifyPromise: Promise<typeof import('dompurify').default> | null = null;
function getPurify(): Promise<typeof import('dompurify').default> {
  if (!purifyPromise) purifyPromise = import('dompurify').then((m) => m.default);
  return purifyPromise;
}

export class SvgSanitizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SvgSanitizeError';
  }
}

/**
 * Sanitise SVG markup and return a self-contained `<svg>…</svg>` string safe to
 * inline. Throws {@link SvgSanitizeError} when there is no DOM to sanitise with,
 * or when nothing drawable (an `<svg>` root) survives - an "SVG" that does not
 * survive as one was not one, and inlining the original would be the hole this
 * closes.
 */
export async function sanitizeSvgToString(markup: string): Promise<string> {
  const g = globalThis as { DOMParser?: unknown; XMLSerializer?: unknown };
  if (typeof g.DOMParser !== 'function' || typeof g.XMLSerializer !== 'function') {
    throw new SvgSanitizeError('no SVG sanitiser on this device');
  }
  const DOMPurify = await getPurify();
  const dom = DOMPurify.sanitize(markup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM: true,
  }) as unknown as ParentNode;
  const svg = dom.querySelector('svg');
  const clean = svg ? new XMLSerializer().serializeToString(svg) : '';
  if (!/<svg[\s>]/i.test(clean)) {
    throw new SvgSanitizeError('nothing drawable survived sanitisation');
  }
  return clean;
}
