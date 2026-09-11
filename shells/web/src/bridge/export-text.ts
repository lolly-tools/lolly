// SPDX-License-Identifier: MPL-2.0
/** HTML inline text emission. Capabilities and filter IDs belong to one render;
 * DOM ranges and computed styles remain browser-shell concerns. */
import { parseTextShadow } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { textStrokeAttrs, canVectoriseText, letterSpacingPx, featureSettingsToHb, textBaselineY, applyTextTransform } from './text-svg.ts';
import type { FontStyleSlice } from './text-svg.ts';
import type { VectorFont } from './font-registry.ts';
import { n2, parseCssColorFull } from './export-css.ts';

export interface InlineTextContext {
  readonly text: Pick<NonNullable<HostV1['text']>, 'toPath'> | null;
  readonly log: HostV1['log'] | undefined;
  readonly resolveFont: (style: FontStyleSlice, text: string) => Promise<VectorFont | null>;
  readonly fontMetrics: (style: CSSStyleDeclaration, size: number) => { ascent: number; descent: number };
  readonly nextShadowId: () => string;
}

/** Filter IDs are local to the output SVG, including interleaved/repeated renders. */
export function createInlineTextContext(capabilities: Omit<InlineTextContext, 'nextShadowId'>): InlineTextContext {
  let shadowUid = 0;
  return { ...capabilities, nextShadowId: () => `fctxsh-${++shadowUid}` };
}

// Underline / line-through carried by a computed style. text-decoration-line is NOT
// inherited, so a nested <strong>/<span> under a decorated ancestor computes 'none' - 
// the walkers therefore OR these flags down the tree rather than reading them only off
// the text node's immediate parent. (Neither vector walker reads text-decoration
// otherwise, so without this underline/strike render on screen but vanish in export.)
export interface Deco { u: boolean; s: boolean }
export function decoFlags(style: CSSStyleDeclaration): Deco {
  const td = String(style.textDecorationLine || style.textDecoration || '');
  return { u: /underline/.test(td), s: /line-through/.test(td) };
}
export function mergeDeco(a: Deco, b: Deco): Deco { return { u: a.u || b.u, s: a.s || b.s }; }

// Walks text nodes and inline elements, emitting one node per text line.
//
// By default each line becomes a true vector <path> (host.text.toPath, HarfBuzz
// shaped) so the SVG is self-contained and renders identically without the font
// installed - no bitmap, no <foreignObject>. Runs we can't vectorise faithfully
// (unresolved font, missing host.text or uncovered glyphs) fall back to a positioned <text>
// element. Line positions come from Range.getBoundingClientRect, same strategy as
// renderInlineContent for PDF.
export async function emitInlineTextSvg(
  ctx: InlineTextContext, NS: string, blockEl: ParentNode, blockStyle: CSSStyleDeclaration,
  rootRect: { left: number; top: number }, parentG: Element,
): Promise<void> {
  const textApi = ctx.text;
  // Filters need a <defs>. This function is called from both walkers and does not
  // own the document, so the sink is found from the tree it is writing into - the
  // root <svg>'s existing <defs>, or one created on demand.
  const ownerSvg = parentG.ownerDocument?.documentElement?.tagName === 'svg'
    ? parentG.ownerDocument.documentElement : parentG.closest?.('svg');
  const shadowDefs: Element = (ownerSvg?.querySelector?.('defs') as Element | null)
    ?? (() => {
      const d = document.createElementNS(NS, 'defs');
      (ownerSvg ?? parentG).insertBefore(d, (ownerSvg ?? parentG).firstChild);
      return d;
    })();

  async function walk(node: Node, nodeStyle: CSSStyleDeclaration, deco: Deco): Promise<void> {
    if (node.nodeType === 3) {
      const text = node.textContent;
      if (!text?.trim()) return;
      const col = parseCssColorFull(nodeStyle.color);
      const fillAttr  = col ? `rgb(${col[0]},${col[1]},${col[2]})` : null;
      const alphaAttr = col && col[3] < 1 ? String(col[3]) : null;
      // Text stroke: CSS -webkit-text-stroke on HTML text, or SVG stroke inside inline
      // SVG, plus paint-order/linejoin so an outer stroke exports as painted.
      const strokeAttrs = textStrokeAttrs(nodeStyle, parseCssColorFull);
      const fontSizePx = parseFloat(nodeStyle.fontSize) || 16;
      // SUSE statics, a user's Google font (decompressed on demand) or the
      // platform face - whichever the family stack resolves to first.
      const vf = textApi ? await ctx.resolveFont(nodeStyle, text) : null;
      const fontUrl = vf?.url ?? null;
      const vectorise = canVectoriseText(nodeStyle, fontUrl, Boolean(textApi));
      // Tracking + OpenType feature toggles are baked into the shaped path so the
      // outline matches the on-screen (and raster) run exactly.
      const letterSpacing = letterSpacingPx(nodeStyle.letterSpacing);
      const features = featureSettingsToHb(nodeStyle.fontFeatureSettings);

      // text-shadow, back-to-front (CSS paints the FIRST-listed shadow on top, so the
      // list is drawn in reverse). Each shadow is a DUPLICATE of the run's own
      // geometry - the outlined <path>, or the <text> fallback - recoloured, shifted
      // and blurred, rather than a filter on the original.
      //
      // Duplicates rather than a filter because a filter is all-or-nothing outside
      // SVG: svg-ir skips <filter> entirely, so an EMF/EPS/DXF export would lose the
      // shadow completely. A duplicated path survives those formats, and when the
      // blur is zero - the hard offset idiom - it is exact everywhere with no filter
      // at all.
      const textShadows = parseTextShadow(nodeStyle.textShadow).reverse();
      const appendWithShadows = (el: Element): void => {
        for (const sh of textShadows) {
          const col = parseCssColorFull(sh.color);
          if (!col) continue;
          const copy = el.cloneNode(true) as Element;
          copy.setAttribute('fill', `rgb(${col[0]},${col[1]},${col[2]})`);
          copy.setAttribute('fill-opacity', String(col[3]));
          // A stroke belongs to the text, not to its shadow: CSS shadows the rendered
          // glyph shape, and carrying the original's stroke colour through would draw
          // an outline in the wrong colour on top of the blur.
          copy.removeAttribute('stroke');
          copy.removeAttribute('stroke-width');
          copy.removeAttribute('stroke-opacity');
          // The offset goes on a wrapper so it composes with whatever transform the
          // original already carries (the outlined path is placed by translate()).
          const wrap = document.createElementNS(NS, 'g');
          wrap.setAttribute('transform', `translate(${n2(sh.x)},${n2(sh.y)})`);
          if (sh.blur > 0) {
            const fId = ctx.nextShadowId();
            const filt = document.createElementNS(NS, 'filter');
            filt.setAttribute('id', fId);
            filt.setAttribute('x', '-50%'); filt.setAttribute('y', '-50%');
            filt.setAttribute('width', '200%'); filt.setAttribute('height', '200%');
            // sRGB, because CSS composites shadows in sRGB and SVG's filter default
            // is linearRGB - the same blur looks materially lighter without this.
            filt.setAttribute('color-interpolation-filters', 'sRGB');
            const fe = document.createElementNS(NS, 'feGaussianBlur');
            fe.setAttribute('stdDeviation', String(n2(sh.blur / 2)));   // CSS blur radius → σ
            filt.appendChild(fe);
            shadowDefs.appendChild(filt);
            wrap.setAttribute('filter', `url(#${fId})`);
          }
          wrap.appendChild(copy);
          parentG.appendChild(wrap);
        }
        parentG.appendChild(el);
      };

      // Emit one run, positioned at its own line box `r`. Used per visual line.
      const placeLine = async (lineText: string, r: DOMRect) => {
        lineText = applyTextTransform(lineText, nodeStyle.textTransform);
        const x = r.left - rootRect.left;
        const top = r.top - rootRect.top;
        if (vectorise) {
          try {
            // `notdef` > 0 means this face has no glyph for something in the run - 
            // outlining would draw tofu, so keep the <text> fallback instead.
            const { d, notdef } = await textApi!.toPath({ text: lineText, fontUrl: fontUrl!, fontSize: fontSizePx, features: features as string[], letterSpacing, variations: vf!.variations, fallbackFonts: vf!.fallbacks });
            if (d && !notdef) {
              const { ascent, descent } = ctx.fontMetrics(nodeStyle, fontSizePx);
              const by = textBaselineY(top, r.height, ascent, descent);
              const p = document.createElementNS(NS, 'path');
              p.setAttribute('d', d);
              p.setAttribute('transform', `translate(${n2(x)},${n2(by)})`);
              if (fillAttr)  p.setAttribute('fill', fillAttr);
              if (alphaAttr) p.setAttribute('fill-opacity', alphaAttr);
              for (const [k, v] of strokeAttrs) p.setAttribute(k, v);
              appendWithShadows(p);
              return;
            }
          } catch (e) {
            ctx.log?.('warn', `svg: text-to-path failed, using <text> - ${(e as Error).message}`);
          }
        }
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x',                 String(n2(x)));
        t.setAttribute('y',                 String(n2(top)));
        t.setAttribute('dominant-baseline', 'text-before-edge');
        t.setAttribute('font-size',         nodeStyle.fontSize);
        t.setAttribute('font-weight',       nodeStyle.fontWeight);
        t.setAttribute('font-style',        nodeStyle.fontStyle);
        t.setAttribute('font-family',       nodeStyle.fontFamily);
        if (nodeStyle.letterSpacing && nodeStyle.letterSpacing !== 'normal') {
          t.setAttribute('letter-spacing', nodeStyle.letterSpacing);
        }
        if (fillAttr)  t.setAttribute('fill',         fillAttr);
        if (alphaAttr) t.setAttribute('fill-opacity', alphaAttr);
        for (const [k, v] of strokeAttrs) t.setAttribute(k, v);
        t.textContent = lineText;
        appendWithShadows(t);
      };

      // Draw underline / strikethrough as filled rects spanning the line box, in the
      // run's own colour - text-decoration is otherwise dropped by the vector walk.
      const drawDeco = (r: DOMRect) => {
        if (!fillAttr || (!deco.u && !deco.s)) return;
        const x = r.left - rootRect.left;
        const top = r.top - rootRect.top;
        const { ascent, descent } = ctx.fontMetrics(nodeStyle, fontSizePx);
        const by = textBaselineY(top, r.height, ascent, descent);
        const thick = Math.max(0.75, fontSizePx * 0.06);
        const bar = (yc: number) => {
          const rect = document.createElementNS(NS, 'rect');
          rect.setAttribute('x', String(n2(x)));
          rect.setAttribute('y', String(n2(yc - thick / 2)));
          rect.setAttribute('width', String(n2(r.width)));
          rect.setAttribute('height', String(n2(thick)));
          rect.setAttribute('fill', fillAttr);
          if (alphaAttr) rect.setAttribute('fill-opacity', alphaAttr);
          parentG.appendChild(rect);
        };
        if (deco.u) bar(by + fontSizePx * 0.11);   // just below the baseline
        if (deco.s) bar(by - fontSizePx * 0.28);   // through the x-height
      };

      // Split on explicit newlines first, then on soft wraps within each segment
      // (CSS-wrapped text has no '\n'). Each visual line is shaped and placed on
      // its own baseline; without this a wrapped run collapses onto one line.
      const segs = text.split('\n');
      let offset = 0;
      for (const seg of segs) {
        if (seg.trim().length > 0) {
          for (const line of visualLines(node, offset, offset + seg.length)) {
            if (line.rect.width > 0.5 && line.rect.height > 0.5) {
              await placeLine(line.text, line.rect);
              drawDeco(line.rect);
            }
          }
        }
        offset += seg.length + 1; // +1 for the '\n'
      }

    } else if (node.nodeType === 1) {
      const element = node as Element;
      if (element.tagName.toLowerCase() === 'br') return;
      const s = window.getComputedStyle(element);
      if (s.display === 'none') return;
      // Non-replaced `display: inline` only. Anything with a box of its own - 
      // inline-block, inline-flex, an <input>, an inline <svg> - is visited by
      // visitSvgNode, which paints its background, border and text as a unit.
      // Descending into it here as well would draw its text a second time.
      if (s.display !== 'inline' || isReplaced(element)) return;
      const cd = mergeDeco(deco, decoFlags(s));
      for (const child of node.childNodes) await walk(child, s, cd);
    }
  }
  for (const child of blockEl.childNodes) await walk(child, blockStyle, decoFlags(blockStyle));
}

/** Elements whose box is drawn by the UA rather than by their children: replaced
 *  content and form controls. They default to `display: inline` but are atomic - 
 *  the inline text walk has nothing to find inside them. */
const REPLACED = new Set(['img', 'svg', 'canvas', 'video', 'audio', 'iframe', 'object', 'embed',
                          'input', 'select', 'textarea', 'progress', 'meter']);
export function isReplaced(el: Element): boolean {
  return REPLACED.has(el.tagName.toLowerCase());
}

// Split a text node's [start,end) offset range into visual lines, so CSS soft
// wrapping (which inserts no '\n') is honoured. We walk characters and start a
// new line whenever a glyph's top jumps; each line's edge whitespace is trimmed
// so its rect.left aligns with the first rendered glyph (collapsed leading spaces
// would otherwise shift the shaped run). Returns [{ text, rect }] per line.
export function visualLines(node: Node, start: number, end: number): { text: string; rect: DOMRect }[] {
  const probe = document.createRange();
  const breaks = [start];
  let prevTop: number | null = null;
  for (let i = start; i < end; i++) {
    probe.setStart(node, i);
    probe.setEnd(node, i + 1);
    const rects = probe.getClientRects();
    if (!rects.length) continue; // collapsed whitespace contributes no box
    const top = rects[rects.length - 1]!.top;
    if (prevTop === null) prevTop = top;
    else if (Math.abs(top - prevTop) > 0.5) { breaks.push(i); prevTop = top; }
  }
  breaks.push(end);

  const full = node.textContent as string;
  const out: { text: string; rect: DOMRect }[] = [];
  for (let k = 0; k + 1 < breaks.length; k++) {
    let s = breaks[k]!, e = breaks[k + 1]!;
    const slice = full.slice(s, e);
    s += slice.length - slice.replace(/^\s+/, '').length; // drop leading ws
    e -= slice.length - slice.replace(/\s+$/, '').length; // drop trailing ws
    if (e <= s) continue;
    probe.setStart(node, s);
    probe.setEnd(node, e);
    out.push({ text: full.slice(s, e), rect: probe.getBoundingClientRect() });
  }
  return out;
}

