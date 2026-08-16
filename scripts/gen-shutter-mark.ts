// SPDX-License-Identifier: MPL-2.0
/**
 * Generate the export shutter's Lolly mark from the repo-root icon.svg - 
 * the ONE source of truth for the mark (the previous shutter-mark.ts was a
 * hand-cleaned Inkscape export that silently went stale when the icon moved).
 * Runs as part of `npm run icons`, so an icon update re-derives the mark.
 *
 * WHY LAYER SLICES, NOT ONE SVG. The mark spins during export - while the main
 * thread is busy rendering the export itself. CSS transforms on SVG *child*
 * elements are main-thread in Chromium, so the old single-SVG mark froze the
 * moment the export started (Andy's field report, 2026-08-10). Transforms on
 * HTML elements composite off-thread. So the icon is sliced in stacking order
 * into static and spinning layers; lib/shutter.ts stacks each slice in its own
 * absolutely-positioned <div>, and tool.css rotates the DIVs - the spin
 * survives any main-thread stall.
 *
 * Each slice is a self-contained <svg> carrying its own copy of the defs with
 * slice-prefixed ids (inline SVGs share the document id namespace - see
 * shells/web/src/bridge/svg-inline-ids.ts for the collision class this avoids).
 * The brand green is rewired to var(--exsh-swirl), which lib/shutter.ts sets
 * to the same brand tone the WebGL iris paints.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'icon.svg');
const OUT = resolve(ROOT, 'shells/web/src/lib/shutter-mark.ts');

const BRAND_GREEN = '#008657';
const SPIN_CLASS: Record<string, 1 | 2 | 3> = { 'lolly-outer': 1, 'lolly-mid': 2, 'lolly-inner': 3 };

const raw = readFileSync(SRC, 'utf8');
const dom = new JSDOM(raw, { contentType: 'image/svg+xml' });
const doc = dom.window.document;
const root = doc.documentElement;
if (root.tagName.toLowerCase() !== 'svg') throw new Error('icon.svg: root is not <svg>');
const viewBox = root.getAttribute('viewBox');
if (!viewBox) throw new Error('icon.svg: no viewBox');

// The animation lives in tool.css for the shutter; the icon's own style block
// (and metadata) must not ride along into the slices.
for (const el of [...root.querySelectorAll('style'), ...root.querySelectorAll('metadata')]) el.remove();

const defs = [...root.children].filter((c) => c.tagName.toLowerCase() === 'defs');
const content = [...root.children].filter((c) => c.tagName.toLowerCase() !== 'defs');
if (content.length !== 1 || content[0]!.tagName.toLowerCase() !== 'g') {
  throw new Error(`icon.svg: expected one content <g> beside <defs>, found ${content.map((c) => c.tagName).join(', ')}`);
}
const wrapper = content[0]!;
const defsMarkup = defs.map((d) => d.outerHTML).join('');
const wrapperAttrs = [...wrapper.attributes].map((a) => ` ${a.name}="${a.value}"`).join('');

// Slice the wrapper's children in stacking order, splitting FURTHER by blend
// mode. The swirl layers are concentric and their brand-green paths paint with
// mix-blend-mode:multiply - inner darkens mid darkens outer - so blending
// reaches ACROSS the layers, and no partition into plain stacked divs can
// reproduce it (caught by the composite-vs-whole verification, 2026-08-10:
// 40% of pixels washed out). SVG blends only within one canvas; CSS blends
// across stacked elements. So every run of same-blend children inside a layer
// becomes its own slice, lib/shutter.ts gives multiply slices a div with
// CSS mix-blend-mode:multiply (isolation:isolate on the mark keeps the blend
// from sampling the seal behind, matching the old one-canvas semantics), and
// a spinning layer's base + multiply divs share the same animation - started
// in the same innerHTML batch, so they can never drift out of phase.
interface Slice { spin: 0 | 1 | 2 | 3; blend: 'normal' | 'multiply'; parts: string[] }
const slices: Slice[] = [];
const blendOf = (el: Element): 'normal' | 'multiply' =>
  /mix-blend-mode:\s*multiply/.test(el.getAttribute('style') ?? '') ? 'multiply' : 'normal';
const push = (spin: 0 | 1 | 2 | 3, blend: 'normal' | 'multiply', markup: string): void => {
  const last = slices[slices.length - 1];
  if (last && last.spin === spin && last.blend === blend) last.parts.push(markup);
  else slices.push({ spin, blend, parts: [markup] });
};
for (const el of [...wrapper.children]) {
  const cls = [...el.classList].find((c) => c in SPIN_CLASS);
  if (cls) {
    // Split the layer's own children by blend, preserving their paint order.
    // The group wrapper's attributes ride along on each sub-slice.
    const gAttrs = [...el.attributes].filter((a) => a.name !== 'class').map((a) => ` ${a.name}="${a.value}"`).join('');
    for (const child of [...el.children]) {
      // The blend moves to the DIV - strip it from the path so it doesn't
      // double-apply within the slice canvas.
      const markup = child.outerHTML.replace(/mix-blend-mode:\s*multiply;?/g, '');
      push(SPIN_CLASS[cls]!, blendOf(child), `<g${gAttrs}>${markup}</g>`);
    }
  } else {
    push(0, blendOf(el), el.outerHTML.replace(/mix-blend-mode:\s*multiply;?/g, ''));
  }
}
const spinSet = new Set(slices.filter((s) => s.spin).map((s) => s.spin));
if (spinSet.size !== 3) {
  throw new Error(`icon.svg: expected slices from each of .lolly-outer/.lolly-mid/.lolly-inner, got cadences [${[...spinSet].join(',')}]`);
}

/** Prefix every id (and reference) in `markup` so the stacked slices cannot collide. */
const prefixIds = (markup: string, prefix: string): string => {
  const ids = new Set<string>();
  for (const m of markup.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]!);
  return markup
    .replace(/\bid="([^"]+)"/g, (m, id) => (ids.has(id) ? `id="${prefix}${id}"` : m))
    .replace(/url\(#([^)]+)\)/g, (m, id) => (ids.has(id) ? `url(#${prefix}${id})` : m))
    .replace(/\b(xlink:href|href)="#([^"]+)"/g, (m, attr, id) => (ids.has(id) ? `${attr}="#${prefix}${id}"` : m));
};

const layers = slices.map((s, i) => {
  let svg = `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">`
    + defsMarkup + `<g${wrapperAttrs}>` + s.parts.join('') + '</g></svg>';
  svg = prefixIds(svg, `esm${i}-`);
  svg = svg.replaceAll(`fill="${BRAND_GREEN}"`, `fill="var(--exsh-swirl, ${BRAND_GREEN})"`);
  return { spin: s.spin, blend: s.blend, svg };
});

const body = layers
  .map((l) => `  { spin: ${l.spin}, blend: '${l.blend}', svg: \`${l.svg}\` },`)
  .join('\n');

writeFileSync(OUT, `// SPDX-License-Identifier: MPL-2.0
/**
 * GENERATED by scripts/gen-shutter-mark.ts from the repo-root icon.svg —
 * do not edit by hand; run \`npm run icons\` after an icon change.
 *
 * The export shutter's Lolly mark, sliced in stacking order into static and
 * spinning layers. lib/shutter.ts stacks each slice in its own <div> and
 * tool.css rotates the DIVs (spin 1/2/3 = outer/mid/inner cadence) — HTML
 * transforms composite off the main thread, so the spin keeps turning while
 * the export render blocks it (SVG-child transforms, the old approach, froze).
 * The brand swirl reads var(--exsh-swirl), set per export by lib/shutter.ts.
 */

export interface ShutterMarkLayer {
  /** 0 = static; 1/2/3 = the outer/mid/inner spin cadence (tool.css). */
  readonly spin: 0 | 1 | 2 | 3;
  /** CSS blend for this slice's div — 'multiply' reproduces the icon's
   *  cross-layer swirl darkening at the STACKING level (see generator). */
  readonly blend: 'normal' | 'multiply';
  readonly svg: string;
}

export const SHUTTER_MARK_LAYERS: readonly ShutterMarkLayer[] = [
${body}
];
`, 'utf8');

console.log(`shutter-mark: ${layers.length} layers (${layers.filter((l) => l.spin).length} spinning) from icon.svg → ${OUT.replace(ROOT + '/', '')}`);
