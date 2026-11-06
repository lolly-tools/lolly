// SPDX-License-Identifier: MPL-2.0
/**
 * Text-run outlining for the renderSvg fast path: a tool whose template root is an
 * <svg> is exported as a clone of that <svg>, and outlineSvgTextRuns() turns the
 * clone's <text> runs into <path> outlines shaped in each run's computed font. It
 * lived inside export.ts until 2026-09-16 and was moved verbatim. export.ts imports
 * from here; this file never imports export.ts, only the leaf modules both use.
 */
import { resolveVectorFont } from './font-registry.ts';
import type { VectorFont } from './font-registry.ts';
import { letterSpacingPx, featureSettingsToHb, applyTextTransform, physicalTextAnchor } from './text-svg.ts';
import { hasRtlText } from '@lolly-tools/node-shell/text-bidi';
import { _host, fontMetricsPx } from './export-shared.ts';
import { n2 } from './export-css.ts';

// Convert the <text> runs of a tool's own <svg> (the renderSvg fast-path clone) into
// outlined <path>s, so an exported SVG renders identically without the authoring
// machine's fonts - the same guarantee the HTML path (emitInlineTextSvg) already gives.
//
// Styles are read from the LIVE element (`liveSvg`, still connected during render): its
// computed `font-family` resolves the brand var - `var(--font-brand, 'SUSE', …)` becomes
// the actual brand stack (the platform SUSE face, or a user's Google font) - which resolveVectorFont then
// maps to a fetchable sfnt. The clone is a deep copy, so its <text> list is 1:1 with the
// live one in document order; we shape each run and swap the clone's node for a <path>.
//
// A run made of flat <tspan> lines (a wrapped title) outlines line by line into a <g>.
// Runs we can't faithfully outline - nested or mixed <tspan> content, an unresolvable/icon
// font, or one with a .notdef glyph - keep their <text>, but get the resolved family
// baked as an INLINE style (which beats the tool's internal <style> rule; a presentation
// attribute would not) so they never fall through to the 'SUSE' var fallback. When
// `outline` is false (the "Convert paths" toggle off) every run is left as editable text
// with only the family baked, honouring the user's request.
//
// A run's direction comes from the page around the <svg>, which the standalone file does
// not have. A right-to-left run states its direction on a kept <text>, and an outlined
// one reads `text-anchor` against it, so `start` stays the right edge as it was on screen.
export async function outlineSvgTextRuns(liveSvg: Element, clone: Element, outline: boolean): Promise<void> {
  const liveTexts = liveSvg.querySelectorAll('text');
  const cloneTexts = clone.querySelectorAll('text');
  // A deep clone keeps a 1:1, same-order <text> list; a mismatch means something
  // rewrote the tree between clone and now - leave it rather than mis-map runs.
  if (!liveTexts.length || liveTexts.length !== cloneTexts.length) return;
  const textApi = _host?.text;
  const NS = 'http://www.w3.org/2000/svg';
  const num = (v: string | null): number => { const n = parseFloat(v ?? ''); return Number.isFinite(n) ? n : 0; };
  const rel = (v: string | null, em: number): number => {
    const s = (v ?? '').trim(); if (!s) return 0;
    return s.endsWith('em') ? (parseFloat(s) || 0) * em : (parseFloat(s) || 0);
  };

  // Shape one run in `cs`'s font. Null when the face can't be resolved, shaping
  // fails, or a glyph is missing - the caller then keeps the run as <text>.
  const shapeRun = async (raw: string, cs: CSSStyleDeclaration): Promise<{ d: string; adv: number } | null> => {
    const fontSizePx = parseFloat(cs.fontSize) || 16;
    const styleSlice = { fontFamily: cs.fontFamily, fontWeight: cs.fontWeight, fontStyle: cs.fontStyle };
    let vf: VectorFont | null = null;
    try { vf = await resolveVectorFont(styleSlice, raw); } catch { vf = null; }
    if (!vf?.url || !textApi) return null;
    const letterSpacing = letterSpacingPx(cs.letterSpacing);
    const features = featureSettingsToHb(cs.fontFeatureSettings);
    try {
      const rtl = cs.direction === 'rtl';
      const r = await textApi.toPath({ text: raw, fontUrl: vf.url, fontSize: fontSizePx, features: features as string[], letterSpacing, variations: vf.variations, fallbackFonts: vf.fallbacks, ...(rtl || hasRtlText(raw) ? { direction: rtl ? 'rtl' as const : 'ltr' as const } : {}) });
      return r.d && !(r.notdef ?? 0) ? { d: r.d, adv: r.advanceWidth || 0 } : null;
    } catch (e) {
      _host?.log?.('warn', `svg: SVG-text outline failed, keeping <text> - ${(e as Error).message}`);
      return null;
    }
  };
  // toPath places the baseline at y=0 with the pen starting at x=0. SVG's own `y`
  // IS the baseline for the default (auto/alphabetic) dominant-baseline; the other
  // values shift it by font metrics.
  const baselineShift = (live: Element, cs: CSSStyleDeclaration, fontSizePx: number): number => {
    const db = live.getAttribute('dominant-baseline') || cs.dominantBaseline || 'auto';
    if (db === 'middle' || db === 'central') { const { ascent, descent } = fontMetricsPx(cs, fontSizePx); return (ascent - descent) / 2; }
    if (db === 'hanging' || db === 'text-before-edge') return fontMetricsPx(cs, fontSizePx).ascent;
    if (db === 'text-after-edge' || db === 'ideographic') return -fontMetricsPx(cs, fontSizePx).descent;
    return 0;
  };
  // A <path> for one shaped run, painted from `cs`. `withOpacity` is false for a
  // tspan, whose parent <text> opacity is carried by the wrapping group instead.
  const runPath = (d: string, transform: string, live: Element, cs: CSSStyleDeclaration, withOpacity: boolean): SVGPathElement => {
    const path = document.createElementNS(NS, 'path') as SVGPathElement;
    path.setAttribute('d', d);
    path.setAttribute('transform', transform);
    path.setAttribute('fill', cs.fill || live.getAttribute('fill') || '#000');
    if (cs.fillOpacity && parseFloat(cs.fillOpacity) < 1) path.setAttribute('fill-opacity', cs.fillOpacity);
    if (withOpacity && cs.opacity && parseFloat(cs.opacity) < 1) path.setAttribute('opacity', cs.opacity);
    // Preserve text stroke/outline in vector export
    const stroke = cs.stroke || live.getAttribute('stroke');
    if (stroke) {
      path.setAttribute('stroke', stroke);
      const strokeWidth = cs.strokeWidth || live.getAttribute('stroke-width');
      if (strokeWidth) path.setAttribute('stroke-width', strokeWidth);
      const strokeOpacity = cs.strokeOpacity || live.getAttribute('stroke-opacity');
      if (strokeOpacity) path.setAttribute('stroke-opacity', strokeOpacity);
    }
    return path;
  };

  for (let i = 0; i < liveTexts.length; i++) {
    const live = liveTexts[i] as SVGTextElement;
    if (live.hasAttribute('data-lolly-emoji-source') || live.closest('defs')) continue;
    const cl = cloneTexts[i] as SVGElement;
    const cs = window.getComputedStyle(live);
    if (cs.display === 'none') continue;                         // hidden - leave as-is
    const raw = applyTextTransform((live.textContent ?? '').replace(/\s+/g, ' ').trim(), cs.textTransform);
    if (!raw) continue;

    // Bake the brand-resolved family inline so a KEPT <text> can't inherit the SUSE
    // var fallback. No-op cost on a run we go on to replace with a <path>. A tool
    // rule may name tspans directly, so each kept tspan gets its own resolved family.
    const bakeFamily = () => {
      cl.style.fontFamily = cs.fontFamily;
      if (cs.direction === 'rtl' && !cl.getAttribute('direction')) cl.setAttribute('direction', 'rtl');
      const liveSpans = live.querySelectorAll('tspan');
      const cloneSpans = cl.querySelectorAll('tspan');
      if (liveSpans.length === cloneSpans.length) {
        cloneSpans.forEach((span, k) => { (span as SVGElement).style.fontFamily = window.getComputedStyle(liveSpans[k]!).fontFamily; });
      }
    };

    const simple = [...live.childNodes].every(n => n.nodeType === 3);   // no <tspan>
    // Line runs: every child is a flat <tspan> (whitespace between them aside), the
    // shape a wrapped title takes. Each tspan outlines on its own pen position.
    const lineRuns = !simple && [...live.childNodes].every(n =>
      (n.nodeType === 3 && !(n.textContent ?? '').trim())
      || (n.nodeType === 1 && (n as Element).localName === 'tspan' && [...n.childNodes].every(c => c.nodeType === 3)));
    if (!outline || !textApi || (!simple && !lineRuns)) { bakeFamily(); continue; }

    const fontSizePx = parseFloat(cs.fontSize) || 16;
    const own = live.getAttribute('transform');
    const anchor = live.getAttribute('text-anchor') || cs.textAnchor || 'start';

    if (simple) {
      const shaped = await shapeRun(raw, cs);
      if (!shaped) { bakeFamily(); continue; }
      // `x` (+ dx) with text-anchor and the shaped advance width give the left edge.
      const x = num(live.getAttribute('x')) + rel(live.getAttribute('dx'), fontSizePx);
      const y = num(live.getAttribute('y')) + rel(live.getAttribute('dy'), fontSizePx) + baselineShift(live, cs, fontSizePx);
      let adv = shaped.adv;
      if (adv <= 0) { try { adv = live.getComputedTextLength(); } catch { adv = 0; } }
      const side = physicalTextAnchor(anchor, cs.direction);
      const xAdj = side === 'middle' ? x - adv / 2 : side === 'end' ? x - adv : x;
      cl.replaceWith(runPath(shaped.d, `${own ? own + ' ' : ''}translate(${n2(xAdj)},${n2(y)})`, live, cs, true));
      continue;
    }

    // A tspan may reset the pen (x/y) or offset it (dx/dy); a run that sets neither
    // continues where the previous one ended. All runs must shape, or none are
    // replaced, so a line is never half outlined.
    let penX = num(live.getAttribute('x')) + rel(live.getAttribute('dx'), fontSizePx);
    let penY = num(live.getAttribute('y')) + rel(live.getAttribute('dy'), fontSizePx);
    const shift = baselineShift(live, cs, fontSizePx);
    const paths: SVGPathElement[] = [];
    let failed = false;
    for (const span of live.querySelectorAll('tspan')) {
      const scs = window.getComputedStyle(span);
      const text = applyTextTransform((span.textContent ?? '').replace(/\s+/g, ' ').trim(), scs.textTransform);
      const em = parseFloat(scs.fontSize) || fontSizePx;
      if (span.hasAttribute('x')) penX = num(span.getAttribute('x'));
      if (span.hasAttribute('y')) penY = num(span.getAttribute('y'));
      penX += rel(span.getAttribute('dx'), em);
      penY += rel(span.getAttribute('dy'), em);
      if (!text) continue;
      const shaped = await shapeRun(text, scs);
      if (!shaped) { failed = true; break; }
      let adv = shaped.adv;
      if (adv <= 0) { try { adv = (span as SVGTextContentElement).getComputedTextLength(); } catch { adv = 0; } }
      const spanAnchor = physicalTextAnchor(span.getAttribute('text-anchor') || anchor, scs.direction);
      const xAdj = spanAnchor === 'middle' ? penX - adv / 2 : spanAnchor === 'end' ? penX - adv : penX;
      paths.push(runPath(shaped.d, `translate(${n2(xAdj)},${n2(penY + shift)})`, span, scs, true));
      // Right-to-left runs follow each other leftwards.
      penX = scs.direction === 'rtl' ? xAdj : xAdj + adv;
    }
    if (failed || !paths.length) { bakeFamily(); continue; }
    const group = document.createElementNS(NS, 'g');
    if (own) group.setAttribute('transform', own);
    const groupOpacity = live.getAttribute('opacity') ?? (parseFloat(cs.opacity) < 1 ? cs.opacity : null);
    if (groupOpacity != null && parseFloat(groupOpacity) < 1) group.setAttribute('opacity', groupOpacity);
    for (const path of paths) group.appendChild(path);
    cl.replaceWith(group);
  }
}
