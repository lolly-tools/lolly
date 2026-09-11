// SPDX-License-Identifier: MPL-2.0
/**
 * Shell-side shaped-glyph enhancer for split text (plans/175 WP-D - the "glyph tier").
 *
 * The design hook's LETTER tier wraps each letter in its own inline-block span so the
 * timeline applier can move letters independently (sequence-dom.ts applySplitUnits).
 * That is the whole industry's approach and it has the whole industry's cost: every
 * letter is laid out alone, so kerning pairs open up, font-formed ligatures (fi, fl)
 * un-ligate, and a joining script cannot be split at all (each Arabic letter would
 * render its isolated form) - which is why the hook degrades letter → word there.
 *
 * This enhancer fixes that where it can, and only there: after a paint, each letter-
 * tier WORD (`.lly-w`), and each word of a joining-script box the hook marked
 * `data-t-split-want="letter"`, is shaped as ONE run through host.text.toPath with
 * `clusters: true` - HarfBuzz applies kerning, ligatures and contextual joining to
 * the whole word - and the per-cluster outlines come back as inline SVG `<g class=
 * "lly-u">` groups the applier moves exactly as it moved the spans. The original
 * text stays in the DOM, hidden (visibility), so the word keeps its line box and
 * the aria-label wrapper still carries the string. Modelled on lottie-mount.ts: an
 * async post-paint pass with an `isCurrent()` stale-render guard; a paint that
 * rebuilds the canvas simply runs it again on fresh nodes.
 *
 * Progressive by construction: no host.text, no resolvable font file for the run,
 * or a glyph the chain cannot cover, and the span tier stays exactly as shipped.
 * The CLI never runs this (its stills are the span tier at rest - identical glyphs).
 *
 * What the glyph tier gives up, knowingly: text-shadow and -webkit-text-stroke on a
 * shaped word (the paths carry the fill only), and selectable text in a static
 * vector export of a split box (it exports as real paths - the WP-D promise).
 */

import type { TextAPI, TextPathCluster } from '@lolly-tools/core/host-v1';
import { resolveVectorFont } from '../bridge/font-registry.ts';
import { featureSettingsToHb, letterSpacingPx, textBaselineY } from '../bridge/text-svg.ts';

/** Marker on a shaped (or refused) word so a repeat pass over the same nodes skips it. */
export const SHAPED_ATTR = 'data-lly-shaped';

export interface GlyphSvgSpec {
  clusters: TextPathCluster[];
  /** The run's pen advance, px - the word's shaped width. */
  advance: number;
  /** The word's line box height, px. */
  lineHeight: number;
  /** Baseline y within that line box, px (textBaselineY). */
  baselineY: number;
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * The inline SVG for one shaped word - pure, so it is unit-tested without a DOM.
 *
 * One `<g class="lly-u">` per cluster that drew something (a space draws nothing and
 * is not a unit, exactly as it was not a span). `transform-box: fill-box` +
 * `transform-origin: center` make the applier's `rotate`/`scale` act about the
 * glyph's own box, matching what an inline-block span did. `fill="currentColor"`
 * inherits the text colour the box authored. `overflow: visible` lets a rising or
 * spinning glyph leave the word box mid-flight, as a span could.
 */
export function glyphSvgMarkup(spec: GlyphSvgSpec): string {
  const w = Math.max(1, Math.ceil(spec.advance));
  const h = Math.max(1, Math.ceil(spec.lineHeight));
  const groups = spec.clusters
    .filter((c) => c.d)
    .map((c) => `<g class="lly-u" data-cl="${c.start}-${c.end}" style="transform-box:fill-box;transform-origin:center">`
      + `<path d="${c.d}" fill="currentColor"/></g>`)
    .join('');
  return `<svg class="lly-glyphs" aria-hidden="true" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" `
    + `style="position:absolute;left:0;top:0;overflow:visible;pointer-events:none;display:block">`
    + `<g transform="translate(0 ${r2(spec.baselineY)})">${groups}</g></svg>`;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** The font's ascent/descent in px for a computed style, via canvas metrics. */
function fontAscentDescent(cs: CSSStyleDeclaration, px: number): { ascent: number; descent: number } {
  if (measureCtx === undefined) measureCtx = document.createElement('canvas').getContext('2d');
  if (measureCtx) {
    measureCtx.font = `${cs.fontStyle || 'normal'} ${cs.fontWeight || '400'} ${px}px ${cs.fontFamily}`;
    const m = measureCtx.measureText('Hg');
    const a = m.fontBoundingBoxAscent, d = m.fontBoundingBoxDescent;
    if (Number.isFinite(a) && Number.isFinite(d) && a > 0) return { ascent: a, descent: d };
  }
  return { ascent: px * 0.8, descent: px * 0.2 };
}

/** Shape one word element in place; a refusal leaves the span tier and marks the word. */
async function shapeWord(word: HTMLElement, textApi: TextAPI, isCurrent: () => boolean): Promise<void> {
  const text = word.textContent ?? '';
  if (!text.trim()) { word.setAttribute(SHAPED_ATTR, '0'); return; }
  const cs = getComputedStyle(word);
  const fontSizePx = parseFloat(cs.fontSize) || 16;
  const vf = await resolveVectorFont(
    { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle }, text,
  ).catch(() => null);
  if (!isCurrent() || !word.isConnected) return;
  if (!vf?.url) { word.setAttribute(SHAPED_ATTR, '0'); return; }

  const features = featureSettingsToHb(cs.fontFeatureSettings).filter((f): f is string => !!f);
  // The box's ligatures toggle reaches the browser as font-variant-ligatures; mirror
  // it into HarfBuzz so the shaped word ligates exactly as the browser text did.
  if (/\bnone\b|no-common-ligatures/.test(cs.fontVariantLigatures || '')) features.push('liga=0', 'clig=0');

  const r = await textApi.toPath({
    text, fontUrl: vf.url, fontSize: fontSizePx, features,
    letterSpacing: letterSpacingPx(cs.letterSpacing), variations: vf.variations,
    fallbackFonts: vf.fallbacks, clusters: true,
  });
  if (!isCurrent() || !word.isConnected) return;
  const clusters = (r.clusters ?? []).filter((c) => c.d);
  if (r.notdef || !clusters.length) { word.setAttribute(SHAPED_ATTR, '0'); return; }

  const lineHeight = word.offsetHeight || fontSizePx * 1.2;
  const { ascent, descent } = fontAscentDescent(cs, fontSizePx);
  const baselineY = textBaselineY(0, lineHeight, ascent, descent);

  // The source text stays for layout height and the a11y tree, hidden. A bare text
  // node (a degraded word unit) gets a span to hide; letter spans hand the unit class
  // over to the glyph groups so the applier sees exactly one set of units.
  for (const src of [...word.childNodes]) {
    if (src.nodeType === Node.TEXT_NODE) {
      const holder = document.createElement('span');
      holder.className = 'lly-u-src';
      holder.style.visibility = 'hidden';
      word.replaceChild(holder, src);
      holder.appendChild(src);
    } else if (src instanceof HTMLElement) {
      src.classList.remove('lly-u');
      src.classList.add('lly-u-src');
      src.style.visibility = 'hidden';
    }
  }
  word.classList.remove('lly-u');
  word.style.position = 'relative';
  word.style.display = 'inline-block';
  word.style.width = `${r2(r.advanceWidth)}px`;
  word.insertAdjacentHTML('beforeend', glyphSvgMarkup({ clusters, advance: r.advanceWidth, lineHeight, baselineY }));
  word.setAttribute(SHAPED_ATTR, '1');
}

/**
 * Shape every letter-tier word under `rootEl` that is not shaped yet. Letter-tier
 * boxes contribute their `.lly-w` word groups; a joining-script box the hook degraded
 * to word (`data-t-split-want="letter"`) contributes its `.lly-u` word units, each of
 * which becomes a container of per-letter glyph groups - the case HTML spans can never
 * serve, and the reason this tier exists.
 */
export async function mountGlyphSplits(
  rootEl: Element,
  { isCurrent = () => true, textApi }: { isCurrent?: () => boolean; textApi: TextAPI | undefined },
): Promise<void> {
  if (!textApi || typeof textApi.toPath !== 'function') return;
  const words: HTMLElement[] = [];
  for (const box of rootEl.querySelectorAll<HTMLElement>('.lolly-box[data-t-split]')) {
    const tier = box.getAttribute('data-t-split');
    if (tier === 'letter') words.push(...box.querySelectorAll<HTMLElement>(`.lly-w:not([${SHAPED_ATTR}])`));
    else if (tier === 'word' && box.getAttribute('data-t-split-want') === 'letter') {
      words.push(...box.querySelectorAll<HTMLElement>(`.lly-u:not([${SHAPED_ATTR}])`));
    }
  }
  if (!words.length || !isCurrent()) return;
  await Promise.all(words.map((w) => shapeWord(w, textApi, isCurrent).catch((e) => {
    console.warn(`glyph-split: ${(e as Error)?.message ?? e}`);
  })));
}
