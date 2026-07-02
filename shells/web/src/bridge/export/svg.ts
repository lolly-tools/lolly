// SPDX-License-Identifier: MPL-2.0
/**
 * SVG export.
 *
 * Tools whose canvas IS an SVG element (lockup, qr-code) take the fast-path
 * clone in renderSvg. All HTML-DOM tools go through renderSvgFromHtml, which
 * decomposes the live DOM into SVG primitives. It mirrors drawHtmlVectors (the
 * PDF DOM walker in export/pdf.ts) in structure; changes to one should be
 * reflected in the other.
 */

import {
  parseDimension, toCssPx, toCssLength,
  insetCorners, uniformRadius, roundedRectPath, parseBoxShadow,
} from '@lolly/engine';
import type { HostV1, TextAPI } from '@lolly/engine';
import { exportDims, inlineBlobUrlsInEl, blobToDataUrl } from './dom.ts';
import { injectSvgMeta } from './metadata.ts';
import {
  SVG_NS, isSvgRooted, pureRotationDeg, rotationPivot, parseCssColorFull, parseCssLen,
  resolveRadii, makeSvgRect, makeRoundedFill, buildLinearGradientEl, n2, visualLines,
  fontMetricsPx, applyTextTransform, pseudoDescriptor, bakeImageFilter, inlineSvgFromImg,
} from './dom-vectors.ts';
import type { RootRect } from './dom-vectors.ts';
import {
  resolveSuseFontUrl, canVectoriseText, textBaselineY,
} from '../text-svg.ts';
import type { FormatAdapter, RenderContext, ExportOptions } from './types.ts';

// Elements that carry an inline style (HTML + SVG) — the rotation neutraliser
// needs one; anything else (MathML) walks unrotated as before.
function styled(el: Element): (Element & ElementCSSInlineStyle) | null {
  return (el instanceof HTMLElement || el instanceof SVGElement) ? el : null;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export async function renderSvg(node: HTMLElement, opts: ExportOptions, host: HostV1 | null): Promise<Blob> {
  if (!isSvgRooted(node)) return renderSvgFromHtml(node, opts, host);
  const svg = node.tagName.toLowerCase() === 'svg' ? node : node.querySelector('svg');
  if (!svg) return renderSvgFromHtml(node, opts, host); // unreachable after isSvgRooted; keep the walker fallback
  // cloneNode is typed to return the base Node; a deep clone of an element is an
  // Element with the same attribute surface.
  const clone = svg.cloneNode(true) as Element;
  // Apply the requested size in its native unit (e.g. "210mm") — SVG is
  // resolution-independent. Ensure a viewBox so the original coordinates scale
  // into the new physical size.
  const d = exportDims(node, opts);
  if (parseDimension(opts.width) || parseDimension(opts.height)) {
    if (!clone.getAttribute('viewBox')) {
      const ow = svg.getBoundingClientRect();
      clone.setAttribute('viewBox', `0 0 ${ow.width || d.node.w} ${ow.height || d.node.h}`);
    }
    clone.setAttribute('width', toCssLength(d.w));
    clone.setAttribute('height', toCssLength(d.h));
  }
  await inlineBlobUrlsInEl(clone);
  const xml = injectSvgMeta(new XMLSerializer().serializeToString(clone), opts.meta);
  return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
}

export async function renderSvgFromHtml(node: HTMLElement, opts: ExportOptions, host: HostV1 | null): Promise<Blob> {
  // Text → vector <path> by default (self-contained, font-independent SVG). The
  // 'Convert paths' export toggle (opts.convertPaths) turns this off, falling back
  // to <text> elements everywhere for selectable, editable output.
  const vectorText = opts.convertPaths !== false;
  const { width: nodeW, height: nodeH } = node.getBoundingClientRect();
  const d = exportDims(node, opts);
  // viewBox lives in CSS px (physical units at 96dpi); the width/height carry
  // the real unit so the SVG renders at the correct physical size.
  const vbW = toCssPx(d.w);
  const vbH = toCssPx(d.h);
  const scaleX  = vbW / nodeW;
  const scaleY  = vbH / nodeH;

  const svgEl = document.createElementNS(SVG_NS, 'svg');
  svgEl.setAttribute('xmlns',   SVG_NS);
  svgEl.setAttribute('width',   toCssLength(d.w));
  svgEl.setAttribute('height',  toCssLength(d.h));
  svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

  const defs = document.createElementNS(SVG_NS, 'defs');
  svgEl.appendChild(defs);

  const rootRect = node.getBoundingClientRect();
  let uid = 0;

  const rootG = document.createElementNS(SVG_NS, 'g');
  if (Math.abs(scaleX - 1) > 1e-4 || Math.abs(scaleY - 1) > 1e-4) {
    rootG.setAttribute('transform', `scale(${scaleX.toFixed(6)},${scaleY.toFixed(6)})`);
  }
  svgEl.appendChild(rootG);

  async function visitSvgNode(el: Element, parentG: SVGElement): Promise<void> {
    if (el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase();
    if (tag === 'style' || tag === 'script') return;

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return;
    const opacity = parseFloat(style.opacity ?? '1');
    if (opacity === 0) return;

    // CSS rotate(): neutralise it, walk the axis-aligned subtree, then wrap the
    // whole thing in an SVG rotation about the transform-origin (faithful in SVG,
    // unlike the AABB fallback). Additive — no-op for every unrotated element.
    const rotDeg = pureRotationDeg(style.transform);
    const inline = styled(el);
    if (rotDeg && inline) {
      const prevInline = inline.style.transform;
      inline.style.transform = 'none';
      const unrot = el.getBoundingClientRect();   // reading forces the reflow
      const pivot = rotationPivot(style, unrot, rootRect);
      const gRot = document.createElementNS(SVG_NS, 'g');
      gRot.setAttribute('transform', `rotate(${rotDeg.toFixed(4)} ${pivot.x.toFixed(3)} ${pivot.y.toFixed(3)})`);
      parentG.appendChild(gRot);
      try { await visitSvgNode(el, gRot); }
      finally { inline.style.transform = prevInline; }
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.width < 0.5 || rect.height < 0.5) return;

    const x = rect.left - rootRect.left;
    const y = rect.top  - rootRect.top;
    const w = rect.width;
    const h = rect.height;

    const g = document.createElementNS(SVG_NS, 'g');
    if (opacity < 0.999) g.setAttribute('opacity', opacity.toFixed(4));
    parentG.appendChild(g);

    // clip-path: polygon(...) — a free-canvas box masked by another box's shape.
    // Translate the local-space polygon into an SVG <clipPath> so it exports (the
    // walker otherwise ignores clipping). Points are element-local px → offset to
    // root coords. (Raster honours the CSS clip-path directly; PDF flattens.)
    const cp = style.clipPath || style.getPropertyValue('-webkit-clip-path');
    if (cp && cp.indexOf('polygon(') === 0) {
      const pts = cp.slice(8, cp.indexOf(')')).split(',')
        .map(s => s.trim().split(/\s+/).map(parseFloat))
        .filter((p): p is [number, number] => p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
      if (pts.length >= 3) {
        const cid = `fcclip-${++uid}`;
        const clip = document.createElementNS(SVG_NS, 'clipPath');
        clip.setAttribute('id', cid);
        clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
        const poly = document.createElementNS(SVG_NS, 'polygon');
        poly.setAttribute('points', pts.map(p => `${(x + p[0]).toFixed(2)},${(y + p[1]).toFixed(2)}`).join(' '));
        clip.appendChild(poly);
        defs.appendChild(clip);
        g.setAttribute('clip-path', `url(#${cid})`);
      }
    }

    // ── Border radius (CSS corner-overlap clamped → pill, not ellipse) ───────
    const { radii, uniform } = resolveRadii(style, w, h);

    // ── Box shadow ────────────────────────────────────────────────────────────
    // Each outer shadow is the box's own shape, offset + grown by spread, filled
    // with the shadow colour and Gaussian-blurred, painted BEHIND the background.
    // Skipped for EMF/EPS (opts.noBoxShadow) — those formats have no blur primitive
    // and would emit an ugly hard-edged offset shape. Painted back-to-front so the
    // first-listed shadow ends up on top, matching CSS.
    if (!opts.noBoxShadow && tag !== 'img' && tag !== 'svg') {
      for (const sh of parseBoxShadow(style.boxShadow).reverse()) {
        const col = parseCssColorFull(sh.color);
        if (!col) continue;
        const sw = Math.max(0, w + 2 * sh.spread);
        const sh2 = Math.max(0, h + 2 * sh.spread);
        if (sw <= 0 || sh2 <= 0) continue;
        const sRadii = insetCorners(radii, -sh.spread);   // negative inset = outset
        const fill = col[3] < 1
          ? `rgba(${col[0]},${col[1]},${col[2]},${col[3]})`
          : `rgb(${col[0]},${col[1]},${col[2]})`;
        const shape = makeRoundedFill(x + sh.x - sh.spread, y + sh.y - sh.spread,
          sw, sh2, sRadii, uniformRadius(sRadii), fill);
        if (sh.blur > 0) {
          const fId = `shadow-${++uid}`;
          const filt = document.createElementNS(SVG_NS, 'filter');
          filt.setAttribute('id', fId);
          // userSpaceOnUse region padded for the blur so it isn't clipped.
          const pad = sh.blur * 1.5 + Math.abs(sh.spread) + 8;
          filt.setAttribute('filterUnits', 'userSpaceOnUse');
          filt.setAttribute('x',      String(x + sh.x - sh.spread - pad));
          filt.setAttribute('y',      String(y + sh.y - sh.spread - pad));
          filt.setAttribute('width',  String(sw + 2 * pad));
          filt.setAttribute('height', String(sh2 + 2 * pad));
          const fe = document.createElementNS(SVG_NS, 'feGaussianBlur');
          fe.setAttribute('in', 'SourceGraphic');
          fe.setAttribute('stdDeviation', String(sh.blur / 2));
          filt.appendChild(fe);
          defs.appendChild(filt);
          shape.setAttribute('filter', `url(#${fId})`);
        }
        g.appendChild(shape);
      }
    }

    // ── Background ──────────────────────────────────────────────────────────
    const bgImg = style.backgroundImage;
    if (bgImg && bgImg !== 'none') {
      const gradEl = buildLinearGradientEl(bgImg, x, y, w, h, ++uid);
      if (gradEl) {
        defs.appendChild(gradEl);
        g.appendChild(makeRoundedFill(x, y, w, h, radii, uniform, `url(#svggrad-${uid})`));
      }
    } else {
      const bgRgb = parseCssColorFull(style.backgroundColor);
      if (bgRgb) {
        const fill = bgRgb[3] < 1
          ? `rgba(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]},${bgRgb[3]})`
          : `rgb(${bgRgb[0]},${bgRgb[1]},${bgRgb[2]})`;
        g.appendChild(makeRoundedFill(x, y, w, h, radii, uniform, fill));
      }
    }

    // ── Borders ─────────────────────────────────────────────────────────────
    // Mirror the PDF walker: a uniform border becomes one stroked rect/path (radius
    // honoured); a divider (border-top only) or mixed border fills per edge.
    // Colours keep their alpha (stroke-opacity / fill-opacity) — svg-ir flattens
    // it over the background for EMF/EPS — so hairline rgba() borders don't go opaque.
    const bSide = (wVal: string, cVal: string) => {
      const bw = parseFloat(wVal) || 0;
      return { bw, rgb: bw > 0 ? parseCssColorFull(cVal) : null };
    };
    const bT = bSide(style.borderTopWidth,    style.borderTopColor);
    const bR = bSide(style.borderRightWidth,  style.borderRightColor);
    const bB = bSide(style.borderBottomWidth, style.borderBottomColor);
    const bL = bSide(style.borderLeftWidth,   style.borderLeftColor);
    type Col = [number, number, number, number];
    const eqRgb = (a: Col | null, b: Col | null) => Boolean(a && b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3]);
    const rgbStr = (c: Col) => `rgb(${c[0]},${c[1]},${c[2]})`;
    const uniformBorder = bT.rgb && bT.bw === bR.bw && bT.bw === bB.bw && bT.bw === bL.bw
      && eqRgb(bT.rgb, bR.rgb) && eqRgb(bT.rgb, bB.rgb) && eqRgb(bT.rgb, bL.rgb);
    if (uniformBorder && bT.rgb) {
      const lw = bT.bw;
      // Centred stroke: inset the box by lw/2 and the radius by lw/2 (border-box
      // radius minus half the border). Uniform corners → <rect>; else a <path>.
      const r = uniform
        ? makeSvgRect(x + lw / 2, y + lw / 2, Math.max(0, w - lw), Math.max(0, h - lw),
            Math.max(0, uniform[0] - lw / 2), 'none', Math.max(0, uniform[1] - lw / 2))
        : (() => {
            const p = document.createElementNS(SVG_NS, 'path');
            p.setAttribute('d', roundedRectPath(x + lw / 2, y + lw / 2,
              Math.max(0, w - lw), Math.max(0, h - lw), insetCorners(radii, lw / 2)));
            p.setAttribute('fill', 'none');
            return p;
          })();
      r.setAttribute('stroke', rgbStr(bT.rgb));
      r.setAttribute('stroke-width', String(lw));
      if (bT.rgb[3] < 1) r.setAttribute('stroke-opacity', String(bT.rgb[3]));
      g.appendChild(r);
    } else {
      const edge = (rgb: Col, el2: SVGRectElement) => {
        if (rgb[3] < 1) el2.setAttribute('fill-opacity', String(rgb[3]));
        g.appendChild(el2);
      };
      if (bT.rgb) edge(bT.rgb, makeSvgRect(x, y, w, bT.bw, 0, rgbStr(bT.rgb)));
      if (bB.rgb) edge(bB.rgb, makeSvgRect(x, y + h - bB.bw, w, bB.bw, 0, rgbStr(bB.rgb)));
      if (bL.rgb) edge(bL.rgb, makeSvgRect(x, y, bL.bw, h, 0, rgbStr(bL.rgb)));
      if (bR.rgb) edge(bR.rgb, makeSvgRect(x + w - bR.bw, y, bR.bw, h, 0, rgbStr(bR.rgb)));
    }

    // ── Inline SVG passthrough ──────────────────────────────────────────────
    if (tag === 'svg') {
      const clone = el.cloneNode(true) as Element;
      clone.setAttribute('x',      String(x));
      clone.setAttribute('y',      String(y));
      clone.setAttribute('width',  String(w));
      clone.setAttribute('height', String(h));
      await inlineBlobUrlsInEl(clone);
      g.appendChild(clone);
      return;
    }

    // ── Image (SVG source → inline vector; bitmap → raster <image>) ───────────
    if (el instanceof HTMLImageElement) {
      const src = el.src || el.getAttribute('src') || '';
      if (src && w > 0 && h > 0) {
        // SVG sources stay VECTOR — inline them as a nested <svg>, fitted "meet"
        // (object-fit: contain), instead of a raster <image>. SVG-ness is sniffed
        // from the bytes (asset URLs are blob: with no extension/MIME hint). Mirrors
        // the PDF walker; real bitmaps fall through to the <image> path below.
        let inlineSvg: SVGSVGElement | null = null;
        try { inlineSvg = await inlineSvgFromImg(src); } catch { inlineSvg = null; }
        if (inlineSvg) {
          await inlineBlobUrlsInEl(inlineSvg);
          // Nested-<svg> scaling needs a viewBox; synthesise one from width/height
          // if the source omitted it, so the mark still fits its box.
          if (!inlineSvg.getAttribute('viewBox')) {
            const iw = parseFloat(inlineSvg.getAttribute('width') ?? '');
            const ih = parseFloat(inlineSvg.getAttribute('height') ?? '');
            if (iw > 0 && ih > 0) inlineSvg.setAttribute('viewBox', `0 0 ${iw} ${ih}`);
          }
          inlineSvg.setAttribute('x',      String(x));
          inlineSvg.setAttribute('y',      String(y));
          inlineSvg.setAttribute('width',  String(w));
          inlineSvg.setAttribute('height', String(h));
          if (!inlineSvg.getAttribute('preserveAspectRatio')) {
            inlineSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          }
          g.appendChild(inlineSvg);
          return;
        }
        try {
          const dataUrl0 = src.startsWith('data:') ? src
            : src.startsWith('blob:') ? await blobToDataUrl(src) : src;
          // CSS filter() (e.g. grayscale/contrast presets) is baked into the bitmap
          // via the browser so the vector image matches screen/PNG instead of
          // exporting full-colour. No-op + graceful fallback when filter is none.
          const dataUrl = await bakeImageFilter(el, dataUrl0, style.filter);
          const rMin = Math.min(
            parseCssLen(style.borderTopLeftRadius,     w),
            parseCssLen(style.borderTopRightRadius,    w),
            parseCssLen(style.borderBottomLeftRadius,  w),
            parseCssLen(style.borderBottomRightRadius, w),
          );
          const isCircle = rMin >= Math.min(w, h) * 0.45;
          const img = document.createElementNS(SVG_NS, 'image');
          img.setAttribute('href',   dataUrl);
          img.setAttribute('x',      String(x));
          img.setAttribute('y',      String(y));
          img.setAttribute('width',  String(w));
          img.setAttribute('height', String(h));
          if (isCircle) {
            const clipId = `imgclip-${++uid}`;
            const cp2 = document.createElementNS(SVG_NS, 'clipPath');
            cp2.setAttribute('id', clipId);
            const circle = document.createElementNS(SVG_NS, 'circle');
            circle.setAttribute('cx', String(x + w / 2));
            circle.setAttribute('cy', String(y + h / 2));
            circle.setAttribute('r',  String(Math.min(w, h) / 2));
            cp2.appendChild(circle);
            defs.appendChild(cp2);
            img.setAttribute('clip-path',           `url(#${clipId})`);
            img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          } else if (style.objectFit === 'cover') {
            // Fill the box, cropping the overflow — `slice` clips to the image's own
            // x/y/width/height viewport, so no extra clipPath is needed (matches the
            // on-screen hero/masthead). Other object-fit values keep the SVG default
            // (xMidYMid meet = contain), unchanged.
            img.setAttribute('preserveAspectRatio', 'xMidYMid slice');
          }
          g.appendChild(img);
        } catch { /* skip unloadable images */ }
      }
      return;
    }

    // ── Recurse block-level children ────────────────────────────────────────
    for (const child of el.children) {
      const cd = window.getComputedStyle(child).display;
      if (cd !== 'inline' && cd !== 'inline-block' && cd !== 'inline-flex') {
        await visitSvgNode(child, g);
      }
    }

    // ── Inline text ─────────────────────────────────────────────────────────
    await emitInlineTextSvg(el, style, rootRect, g, vectorText, host);

    // ── CSS generated content (::before/::after markers) ──────────────────────
    await svgPseudoContent(g, rootRect, el, vectorText, host);
  }

  await visitSvgNode(node, rootG);
  const xml = injectSvgMeta(new XMLSerializer().serializeToString(svgEl), opts.meta);
  return new Blob(['<?xml version="1.0" standalone="no"?>\n' + xml], { type: 'image/svg+xml' });
}

// Walks text nodes and inline elements, emitting one node per text line.
//
// By default each line becomes a true vector <path> (host.text.toPath, HarfBuzz
// shaped) so the SVG is self-contained and renders identically without the font
// installed — no bitmap, no <foreignObject>. Runs we can't vectorise faithfully
// (non-SUSE font, no host.text, letter-spacing) fall back to a positioned <text>
// element. Line positions come from Range.getBoundingClientRect, same strategy as
// renderInlineContent for PDF.
async function emitInlineTextSvg(
  blockEl: Element, blockStyle: CSSStyleDeclaration, rootRect: RootRect,
  parentG: SVGElement, vectorText: boolean, host: HostV1 | null,
): Promise<void> {
  const textApi: TextAPI | null = (vectorText ? host?.text : null) ?? null;

  async function walk(node: Node, nodeStyle: CSSStyleDeclaration): Promise<void> {
    if (node instanceof Text) {
      const text = node.textContent;
      if (!text || !text.trim()) return;
      const col = parseCssColorFull(nodeStyle.color);
      const fillAttr  = col ? `rgb(${col[0]},${col[1]},${col[2]})` : null;
      const alphaAttr = col && col[3] < 1 ? String(col[3]) : null;
      const fontSizePx = parseFloat(nodeStyle.fontSize) || 16;
      const fontUrl = resolveSuseFontUrl(nodeStyle);
      const vectorise = canVectoriseText(nodeStyle, fontUrl, Boolean(textApi));

      // Emit one run, positioned at its own line box `r`. Used per visual line.
      const placeLine = async (lineText: string, r: DOMRect): Promise<void> => {
        lineText = applyTextTransform(lineText, nodeStyle.textTransform);
        const x = r.left - rootRect.left;
        const top = r.top - rootRect.top;
        // fontUrl != null is implied by canVectoriseText, restated so the type narrows.
        if (vectorise && textApi && fontUrl != null) {
          try {
            const { d } = await textApi.toPath({ text: lineText, fontUrl, fontSize: fontSizePx });
            if (d) {
              const { ascent, descent } = fontMetricsPx(nodeStyle, fontSizePx);
              const by = textBaselineY(top, r.height, ascent, descent);
              const p = document.createElementNS(SVG_NS, 'path');
              p.setAttribute('d', d);
              p.setAttribute('transform', `translate(${n2(x)},${n2(by)})`);
              if (fillAttr)  p.setAttribute('fill', fillAttr);
              if (alphaAttr) p.setAttribute('fill-opacity', alphaAttr);
              parentG.appendChild(p);
              return;
            }
          } catch (e) {
            host?.log('warn', `svg: text-to-path failed, using <text> — ${errMsg(e)}`);
          }
        }
        const t = document.createElementNS(SVG_NS, 'text');
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
        t.textContent = lineText;
        parentG.appendChild(t);
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
            }
          }
        }
        offset += seg.length + 1; // +1 for the '\n'
      }

    } else if (node instanceof Element) {
      if (node.tagName.toLowerCase() === 'br') return;
      const s = window.getComputedStyle(node);
      if (s.display === 'none') return;
      if (s.display !== 'inline' && s.display !== 'inline-block' && s.display !== 'inline-flex') return;
      for (const child of node.childNodes) await walk(child, s);
    }
  }
  for (const child of blockEl.childNodes) await walk(child, blockStyle);
}

// Emit any ::before/::after markers of `el` into the SVG group `parentG`.
async function svgPseudoContent(
  parentG: SVGElement, rootRect: RootRect, el: Element, vectorText: boolean, host: HostV1 | null,
): Promise<void> {
  for (const name of ['::before', '::after'] as const) {
    const ds = pseudoDescriptor(el, name);
    if (!ds) continue;
    const x = ds.x - rootRect.left;
    const y = ds.y - rootRect.top;
    if (ds.bg && ds.w > 0.5 && ds.h > 0.5) {
      const f = ds.bg[3] < 1
        ? `rgba(${ds.bg[0]},${ds.bg[1]},${ds.bg[2]},${ds.bg[3]})`
        : `rgb(${ds.bg[0]},${ds.bg[1]},${ds.bg[2]})`;
      parentG.appendChild(makeRoundedFill(x, y, ds.w, ds.h, ds.radii, ds.uniform, f));
    }
    if (!ds.text.trim()) continue;
    const fontSizePx = parseFloat(ds.ps.fontSize) || 16;
    const fontUrl = resolveSuseFontUrl(ds.ps);
    const col = parseCssColorFull(ds.ps.color);
    const fillAttr  = col ? `rgb(${col[0]},${col[1]},${col[2]})` : null;
    const alphaAttr = col && col[3] < 1 ? String(col[3]) : null;
    const lineH = parseFloat(ds.ps.lineHeight) || fontSizePx * 1.2;
    let placed = false;
    const textApi = host?.text;
    // fontUrl != null is implied by canVectoriseText, restated so the type narrows.
    if (vectorText && textApi && fontUrl != null && canVectoriseText(ds.ps, fontUrl, true)) {
      try {
        const { d } = await textApi.toPath({ text: ds.text, fontUrl, fontSize: fontSizePx });
        if (d) {
          const { ascent, descent } = fontMetricsPx(ds.ps, fontSizePx);
          const by = textBaselineY(y, lineH, ascent, descent);
          const p = document.createElementNS(SVG_NS, 'path');
          p.setAttribute('d', d);
          p.setAttribute('transform', `translate(${n2(x)},${n2(by)})`);
          if (fillAttr)  p.setAttribute('fill', fillAttr);
          if (alphaAttr) p.setAttribute('fill-opacity', alphaAttr);
          parentG.appendChild(p);
          placed = true;
        }
      } catch (e) { host?.log('warn', `svg: pseudo text-to-path failed — ${errMsg(e)}`); }
    }
    if (!placed) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x',                 String(n2(x)));
      t.setAttribute('y',                 String(n2(y)));
      t.setAttribute('dominant-baseline', 'text-before-edge');
      t.setAttribute('font-size',         ds.ps.fontSize);
      t.setAttribute('font-weight',       ds.ps.fontWeight);
      t.setAttribute('font-style',        ds.ps.fontStyle);
      t.setAttribute('font-family',       ds.ps.fontFamily);
      if (fillAttr)  t.setAttribute('fill',         fillAttr);
      if (alphaAttr) t.setAttribute('fill-opacity', alphaAttr);
      t.textContent = ds.text;
      parentG.appendChild(t);
    }
  }
}

export const svgAdapter: FormatAdapter = {
  formats: ['svg'],
  render(ctx: RenderContext): Promise<Blob> {
    return renderSvg(ctx.node, ctx.opts, ctx.host);
  },
};
