// SPDX-License-Identifier: MPL-2.0
/**
 * Animated-SVG assembly - pure, DOM-free, unit-testable core.
 *
 * The export bridge (bridge/export.ts renderSvgAnim) samples a motion tool's live
 * DOM into N vector-SVG snapshots (one per moment, via renderSvgFromHtml - text
 * stays outlined, so the frames scale cleanly). This module stitches those frames
 * into ONE self-contained animated SVG: a "flipbook" where each frame is a <g>
 * layer and an embedded CSS @keyframes cross-cuts exactly one layer visible per
 * time slice. No video codec, no external runtime - a plain .svg that animates in
 * a browser tab or an <img>, and scales to any size because every frame is vector.
 *
 * Two responsibilities, kept pure so they can be exercised without a DOM:
 *   • namespaceSvgIds - each snapshot generates its OWN ids (svggrad-1, fcclip-1,
 *     shadow-1 …). Stacked in one document those collide and cross-wire references,
 *     so every frame's ids + their url(#…)/href="#…" refs are prefixed per frame.
 *   • assembleAnimatedSvg - builds the flipbook: a <style> with one step-end
 *     @keyframes per frame (hard cuts, no fade) + the N wrapped, namespaced layers.
 *
 * Lives in lib/ (not bridge/) precisely so tests/svg-anim.test.ts can import it
 * without pulling in dom-to-image or the rest of the rasteriser.
 */

/** Prefix every generated id and its internal references so `frame`-local ids
 *  become globally unique when frames are stacked in one document. */
export function namespaceSvgIds(inner: string, prefix: string): string {
  return inner
    .replace(/\bid="([^"]+)"/g, (_m, id: string) => `id="${prefix}${id}"`)
    // url(#x), url('#x'), url("#x") - the only internal-ref form the SVG walker emits.
    .replace(/\burl\((['"]?)#([^)'"]+)\1\)/g, (_m, q: string, id: string) => `url(${q}#${prefix}${id}${q})`)
    // href="#x" / xlink:href="#x" - hash refs only; data:/blob: hrefs are untouched.
    .replace(/\b(xlink:href|href)="#([^"]+)"/g, (_m, attr: string, id: string) => `${attr}="#${prefix}${id}"`);
}

export interface AnimatedSvgParts {
  /** Inner content of each frame's <svg> (defs + drawing), in playback order. */
  frames: string[];
  /** Outer <svg> geometry, copied from the first frame. */
  widthAttr: string;
  heightAttr: string;
  viewBox: string;
  /** Per-frame display time (ms) - the sampled frame interval. */
  frameMs: number;
  /** Loop count: 0 = forever, n>0 = play n times then hold the last frame. */
  loops: number;
  /** Optional Dublin-Core-ish provenance, emitted as a comment + <metadata>. */
  meta?: { description?: string; source?: string; contact?: string } | null;
}

// Percentage of the total cycle, trimmed (no trailing zeros): 33.3333 not 33.333300.
function pct(n: number): string {
  return `${Math.round(n * 1e4) / 1e4}`;
}

/**
 * Build the flipbook keyframe CSS for `n` frames.
 *
 * Each frame i is visible across [i/n, (i+1)/n) of the cycle. With
 * `animation-timing-function: step-end`, each keyframe's value is HELD until the
 * next keyframe, so placing opacity:1 at the frame's start boundary and opacity:0
 * at 0% / its end boundary yields a hard cut with no interpolation:
 *   frame 0     : 0%{1} → e0%{0}                 (visible from the start)
 *   frame i     : 0%{0} → si%{1} → ei%{0}        (visible only in its slice)
 *   frame n-1   : 0%{0} → s%{1}                  (fill-mode holds it at the end)
 */
function flipbookKeyframes(n: number): string {
  const rules: string[] = [];
  for (let i = 0; i < n; i++) {
    const start = (i / n) * 100;
    const end = ((i + 1) / n) * 100;
    const stops: string[] = [];
    if (i === 0) {
      stops.push('0%{opacity:1}', `${pct(end)}%{opacity:0}`);
    } else if (i === n - 1) {
      stops.push('0%{opacity:0}', `${pct(start)}%{opacity:1}`);
    } else {
      stops.push('0%{opacity:0}', `${pct(start)}%{opacity:1}`, `${pct(end)}%{opacity:0}`);
    }
    rules.push(`@keyframes la${i}{${stops.join('')}}`);
  }
  return rules.join('');
}

/** Assemble the frames into one self-contained animated SVG string. */
export function assembleAnimatedSvg(parts: AnimatedSvgParts): string {
  const { frames, widthAttr, heightAttr, viewBox, frameMs, loops, meta } = parts;
  const n = frames.length;
  if (n === 0) throw new Error('assembleAnimatedSvg: no frames');

  const layers = frames
    .map((inner, i) => `<g class="laf laf-${i}">${namespaceSvgIds(inner, `f${i}-`)}</g>`)
    .join('');

  // A lone frame is just a static SVG - no <style>, no animation.
  let style = '';
  if (n > 1) {
    const totalMs = Math.max(1, Math.round(frameMs * n));
    const iter = loops > 0 ? String(loops) : 'infinite';
    style =
      `<style>` +
      `.laf{opacity:0;animation:${totalMs}ms step-end ${iter} both}` +
      frames.map((_f, i) => `.laf-${i}{animation-name:la${i}}`).join('') +
      flipbookKeyframes(n) +
      `</style>`;
  }

  const metaBlock = buildMetaBlock(meta);
  const head = '<?xml version="1.0" encoding="UTF-8"?>\n';
  return (
    head +
    (metaBlock.comment ?? '') +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${widthAttr}" height="${heightAttr}" viewBox="${viewBox}">` +
    metaBlock.metadata +
    style +
    layers +
    `</svg>\n`
  );
}

// Provenance as a leading comment + a Dublin-Core <metadata> block (mirrors the
// still-SVG path's injectSvgMeta, kept here so the core stays self-contained).
function buildMetaBlock(meta: AnimatedSvgParts['meta']): { comment: string | null; metadata: string } {
  if (!meta) return { comment: null, metadata: '' };
  const bits = [meta.description, meta.contact, meta.source].filter(Boolean) as string[];
  if (!bits.length) return { comment: null, metadata: '' };
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const credit = esc(bits.join(' · '));
  return {
    comment: `<!-- ${credit} -->\n`,
    metadata:
      `<metadata><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dc="http://purl.org/dc/elements/1.1/">` +
      `<rdf:Description><dc:description>${credit}</dc:description></rdf:Description></rdf:RDF></metadata>`,
  };
}
