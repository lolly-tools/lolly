// SPDX-License-Identifier: MPL-2.0
const dbTextCache = new Map();
export async function dbTextMetrics(S) {
  const faces = {};
  if (host.text?.fontUrl) {
    for (const weight of new Set([S.labelWeight, 400, 500, 600])) {
      try { faces[weight] = await host.text.fontUrl(S.brand.font, { weight: weight }); }
      catch (_err) { faces[weight] = null; }
    }
  }
  return async (text, size, weight) => {
    const face = faces[weight], key = JSON.stringify([face, S.brand.font, size, weight, text]);
    if (dbTextCache.has(key)) {
      const cached = dbTextCache.get(key);
      if (cached.missing) note('Some characters are missing from the design-system font. Check their appearance before exporting.');
      return cached.width;
    }
    let width, missing = false;
    if (face && host.text?.toPath) {
      try {
        const shaped = await host.text.toPath({ text: text, fontUrl: face.url, fontSize: size, variations: face.variations });
        missing = !!shaped.notdef;
        if (missing) note('Some characters are missing from the design-system font. Check their appearance before exporting.');
        else width = shaped.advanceWidth;
      } catch (_err) { note('Font measurement is unavailable. Check long labels before exporting.'); }
    }
    if (!Number.isFinite(width)) {
      width = Array.from(text).reduce((sum, ch) => sum + (/[\u2e80-\uffff]/.test(ch) ? 1 : /[ilI.,' ]/.test(ch) ? 0.28 : /[MW@]/.test(ch) ? 0.9 : 0.57) * size, 0);
    }
    if (dbTextCache.size > 6000) dbTextCache.clear();
    dbTextCache.set(key, { width, missing }); return width;
  };
}
export async function dbWrap(text, width, size, weight, measure) {
  if (!trim(text)) return [];
  if (String(text).length > 1600) throw new Error('Keep each card label and detail below 1600 characters.');
  if (!String(text).includes('\n') && await measure(text, size, weight) <= width) return [String(text).trim()];
  const segments = typeof Intl !== 'undefined' && Intl.Segmenter ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (s) => s.segment) : Array.from(text);
  let lines = [], current = '', lastSpace = -1;
  for (const ch of segments) {
    if (ch === '\n') { lines.push(current.trim()); current = ''; lastSpace = -1; continue; }
    const candidate = current + ch;
    if (current && await measure(candidate, size, weight) > width) {
      if (lastSpace > 0) { lines.push(current.slice(0, lastSpace).trim()); current = current.slice(lastSpace + 1) + ch; }
      else { lines.push(current.trim()); current = ch; }
      lastSpace = current.lastIndexOf(' ');
    } else { current = candidate; if (/\s/.test(ch)) lastSpace = current.length - 1; }
    if (lines.length >= 12) { note('Some text exceeds twelve lines. Widen the card or shorten the text.'); lines[11] += '…'; return lines; }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}
export async function dbMeasureNodes(nodes, S) {
  S.measure = await dbTextMetrics(S);
  for (const n of nodes) {
    let cardWidth = n.w || S.cardWidth, width = cardWidth - 2 * S.cardPadV;
    if (n.image && S.cardLayout === 'row') width -= S.rowImgSide + S.imgGap;
    if (n.shape === 'diamond') width = cardWidth * 0.5 - 2 * S.cardPadV;
    if (n.shape === 'hexagon') width -= 32;
    if (n.shape === 'circle' || n.shape === 'ellipse') width *= 0.7;
    n.lines = await dbWrap(n.label, Math.max(40, width), S.labelSize, S.labelWeight, S.measure);
    n.details = await dbWrap(n.detail, Math.max(40, width), S.detailSize, 400, S.measure);
    n.textHeight = n.lines.length * S.labelLH + (n.details.length ? n.details.length * S.detailLH + 5 : 0);
    n.measuredHeight = Math.max(60 * S.scale, 2 * S.cardPadV + (S.cardLayout === 'row' ? Math.max(S.rowImgSide, n.textHeight) : S.imgBand + n.textHeight));
    if (n.shape === 'diamond') n.measuredHeight = Math.max(2 * (n.textHeight + 2 * S.cardPadV), S.cardWidth * 0.65);
    if (n.shape === 'circle') n.measuredHeight = Math.max(n.measuredHeight, S.cardWidth);
  }
}
export function dbText(x, y, content, size, weight, fill, anchor) {
  const rtl = /[\u0590-\u08ff]/.test(content);
  const el = textEl(x, y, content, size, weight, fill, anchor);
  return rtl ? el.replace('<text ', '<text direction="rtl" unicode-bidi="plaintext" ') : el;
}
export function dbCard(n, S) {
  let fill = color(n.fill, S.nodeFill), focal = n.emphasis === 'accent' || (n.emphasis !== 'quiet' && S.inp.focalEmphasis === 'first' && !n.parentId && n.idx === 0);
  if (!n.fill && !S.inp.nodeFill && S.look === 'flow') fill = dbMix(n.accent, S.nodeFill, 0.9);
  if (!n.fill && !S.inp.nodeFill && focal) fill = S.brand.primary;
  const ink = dbInk(fill, S.nodeText, 4.5), detail = dbInk(fill, S.detailColor, 4.5);
  const stroke = color(n.stroke, S.nodeStroke), width = n.strokeWidth > 0 ? n.strokeWidth : S.cardBorderWidth;
  const geom = shapeGeom(n.shape, n.x, n.y, n.w, n.h, S, stroke, width), d = geom.outline;
  let out = '<g' + dbCardAttrs(n, S) + ' data-diagram-node="' + esc(n.id) + '">';
  if (d) {
    out += dbShadow(d, S.inp.cardDepth, false, S, n);
    out += dbFill(d, fill);
    if (S.look === 'studio' && S.inp.surfaceHighlight > 0 && (n.shape === 'box' || n.shape === 'rounded' || n.shape === 'pill')) {
      const r = rectRx(n.shape, n.w, n.h, S);
      for (let i = 0; i < 10; i++) {
        const inset = 0.5 + i * 0.45;
        const sheen = roundedRectPath(n.x + inset, n.y + inset, n.w - inset * 2, n.h - inset * 2, Math.max(0, r - inset));
        out += dbFill(sheen, dbMix(fill, '#ffffff', 0.055 * Number(S.inp.surfaceHighlight) * (1 - i / 10)));
      }
    }
    if (width > 0) out += dbStroke(d, stroke, width);
    if (S.look === 'editorial' && !focal && (n.shape === 'rounded' || n.shape === 'box')) out += dbFill(roundedRectPath(n.x + 1, n.y + 13, 3, Math.max(8, n.h - 26), 1.5), n.accent);
  }
  out += geom.decor;
  const imageSide = n.image ? S.rowImgSide : 0;
  const available = geom.tb.w - S.cardPadV * 2 - (imageSide ? imageSide + S.imgGap : 0);
  const textHeight = n.textHeight || 0;
  if (textHeight > geom.tb.h - S.cardPadV || available < 40) note('Some cards need more space for their text. Increase the card width or source box size.');
  const left = S.cardLayout === 'row', tx = left ? geom.tb.x + S.cardPadV + (imageSide ? imageSide + S.imgGap : 0) : n.x + n.w / 2;
  let ty = geom.tb.y + (geom.tb.h - textHeight) / 2;
  if (n.image) {
    let iw = left ? imageSide : Math.min(S.imgH, n.w - 2 * S.cardPadV), ih = iw;
    if (n._imgAspect > 0) { if (n._imgAspect > 1) ih /= n._imgAspect; else iw *= n._imgAspect; }
    const ix = left ? n.x + S.cardPadV : n.x + (n.w - iw) / 2;
    const iy = left ? n.y + (n.h - ih) / 2 : n.y + S.cardPadV;
    out += '<image href="' + esc(n.image) + '" x="' + f2(ix) + '" y="' + f2(iy) + '" width="' + f2(iw) + '" height="' + f2(ih) + '"/>';
    if (!left) ty = n.y + S.cardPadV + S.imgBand;
  }
  (n.lines || [n.label]).forEach((line, i) => {
    const rtl = /[\u0590-\u08ff]/.test(line), x = left && rtl ? geom.tb.x + geom.tb.w - S.cardPadV : tx;
    out += dbText(x, ty + S.labelSize * 0.82 + i * S.labelLH, line, S.labelSize, S.labelWeight, ink, left ? 'start' : 'middle');
  });
  const detailY = ty + (n.lines || []).length * S.labelLH + 5;
  (n.details || []).forEach((line, i) => {
    const rtl = /[\u0590-\u08ff]/.test(line), x = left && rtl ? geom.tb.x + geom.tb.w - S.cardPadV : tx;
    out += dbText(x, detailY + S.detailSize * 0.82 + i * S.detailLH, line, S.detailSize, 400, detail, left ? 'start' : 'middle');
  });
  return out + '</g>';
}
