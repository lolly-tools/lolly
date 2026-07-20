// SPDX-License-Identifier: MPL-2.0
/**
 * PDF page → standalone SVG serializer (pure, DOM-free).
 *
 * Takes the PdfNodes the content-stream interpreter (pdf-map.ts) produced for one
 * page — BEFORE finalizeBoxes, so the `_vector*` / `_imageXObject` placeholders are
 * still present — and emits one self-contained SVG document for the whole page.
 * This is the "PDF page as an asset" sibling of the Layout Studio import path: the
 * SAME interpreted nodes either become editable boxes (design-import) or this flat
 * SVG (asset upload), so the two ingest surfaces can never disagree about what a
 * page contains.
 *
 * Raster image XObjects can't be decoded here (that needs a canvas); the shell
 * decodes them and passes the results in `opts.images` (imageKey → href, usually a
 * data: URI) so the output stays self-contained. An image with no resolved href is
 * skipped — mirroring the boxes path, where it degrades to an empty box.
 *
 * Group ids (OCG layers / form XObjects / q…Q blocks, resolved by the interpreter
 * onto contiguous paint-order runs) are kept as <g data-group="…"> wrappers, so a
 * page SVG re-imported into Layout Studio yields the same grouping.
 *
 * The page background is transparent by design — PDF "paper" is a viewer
 * convention, not page content, and vector art (the .ai logo case) should land on
 * any canvas without a baked white plate. Pass `background` to opt into one.
 */

import type { PdfNode, PdfGradient } from './pdf-map.ts';

export interface PdfSvgOptions {
  /** Page (MediaBox) size in points — becomes the viewBox and intrinsic size. */
  width: number;
  height: number;
  /** Resolved raster XObjects: PdfNode._imageXObject key → href (a data: URI). */
  images?: Record<string, string>;
  /** Optional opaque background colour (e.g. '#ffffff'); default transparent. */
  background?: string;
}

// Round for compact, stable output (the interpreter already works in ~0.01pt).
const r = (v: number): number => Math.round(((typeof v === 'number' && isFinite(v)) ? v : 0) * 100) / 100;

const escapeXml = (s: string): string =>
  String(s).replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  ));

// Only colours the interpreter itself emits (safeColor output: #rgb/#rrggbb/… or
// 'none') are let through — anything else falls back, so no attribute injection.
const safeAttrColor = (v: unknown, dflt: string): string => {
  const s = String(v ?? '').trim();
  if (s.toLowerCase() === 'none') return 'none';
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : dflt;
};

/** `opacity="…"` when the node's 0–100 alpha actually dims, else ''. */
const opacityAttr = (n: PdfNode): string => {
  const v = typeof n.opacity === 'number' ? n.opacity : 100;
  return v >= 100 || v < 0 ? '' : ` opacity="${r(v / 100)}"`;
};

/** rotate about the box centre (the interpreter anchors rotated rects there). */
const rotateAttr = (n: PdfNode): string =>
  n.rot ? ` transform="rotate(${r(n.rot)} ${r(n.x + n.w / 2)} ${r(n.y + n.h / 2)})"` : '';

// `fillOverride` (a `url(#id)` gradient ref built by the caller) wins over the flat
// fill and suppresses the "fill:none → emit nothing" shortcut. It's caller-controlled
// (`url(#pgradN)`), so it's safe to inject verbatim.
function rectEl(n: PdfNode, fillOverride?: string): string {
  const fill = fillOverride || safeAttrColor(n.fill, 'none');
  if (fill === 'none') return '';
  const rx = n.radius ? ` rx="${r(n.radius)}"` : '';
  return `<rect x="${r(n.x)}" y="${r(n.y)}" width="${r(n.w)}" height="${r(n.h)}"${rx} fill="${fill}"${opacityAttr(n)}${rotateAttr(n)}/>`;
}

function ellipseEl(n: PdfNode, fillOverride?: string): string {
  const fill = fillOverride || safeAttrColor(n.fill, 'none');
  if (fill === 'none') return '';
  return `<ellipse cx="${r(n.x + n.w / 2)}" cy="${r(n.y + n.h / 2)}" rx="${r(n.w / 2)}" ry="${r(n.h / 2)}" fill="${fill}"${opacityAttr(n)}${rotateAttr(n)}/>`;
}

// A baked vector path is already in absolute page coordinates — no transform needed.
function pathEl(n: PdfNode, fillOverride?: string): string {
  const d = String(n._vectorPath ?? '').replace(/["<>&']/g, '');
  if (!d) return '';
  const fill = fillOverride || safeAttrColor(n._vectorFill, 'none');
  const st = n._vectorStroke;
  const stroke = (st && st.color)
    ? ` stroke="${safeAttrColor(st.color, '#000000')}" stroke-width="${r(Math.max(0.3, +st.width || 1))}"`
    : '';
  if (fill === 'none' && !stroke) return '';
  const rule = n._vectorFillRule === 'evenodd'
    ? ' fill-rule="evenodd"'
    : (stroke ? ' fill-rule="nonzero"' : '');
  return `<path d="${d}" fill="${fill}"${stroke}${rule}${opacityAttr(n)}/>`;
}

function imageEl(n: PdfNode, images: Record<string, string>): string {
  const href = n._imageXObject ? images[n._imageXObject] : undefined;
  if (!href || !/^data:image\//i.test(href)) return ''; // self-contained or nothing
  return `<image x="${r(n.x)}" y="${r(n.y)}" width="${r(n.w)}" height="${r(n.h)}" preserveAspectRatio="none" href="${escapeXml(href)}"${opacityAttr(n)}${rotateAttr(n)}/>`;
}

// Outlined text: the same baseline/line geometry as textEl, but each line is a
// real <path> of glyph outlines (font units already resolved to SVG px by the
// shaper) placed by a translate — so the SVG needs no font at render time. Only
// used for un-rotated runs (the shell keeps rotated text as <text>).
function outlinedTextEl(n: PdfNode): string {
  const lines = n._outlinePath ?? [];
  if (!lines.length) return '';
  const size = Math.max(1, +(n.fontSize ?? 0) || 12);
  const baseline0 = n.y + size * 0.8;
  const fill = safeAttrColor(n.fg, '#000000');
  const parts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const d = lines[i];
    if (!d) continue;
    parts.push(`<g transform="translate(${r(n.x)} ${r(baseline0 + i * size * 1.4)})"><path d="${d}" fill="${fill}"/></g>`);
  }
  return parts.join('');
}

// Text: the interpreter puts the box top at (baseline − 0.8·size) and sizes the box
// at 1.4·size per line — mirror both so this presentation matches the boxes path.
function textEl(n: PdfNode): string {
  const text = String(n.text ?? '');
  if (!text.trim()) return '';
  const size = Math.max(1, +(n.fontSize ?? 0) || 12);
  const baseline0 = n.y + size * 0.8;
  const family = String(n.fontFamily || '').trim();
  const familyAttr = family
    ? ` font-family="${escapeXml(family)}, sans-serif"`
    : ` font-family="sans-serif"`;
  const weight = n.fontWeight != null && n.fontWeight !== '' ? ` font-weight="${escapeXml(String(n.fontWeight))}"` : '';
  // Text rotates about its PDF anchor (the first line's origin), not the box centre.
  const rot = n.rot ? ` transform="rotate(${r(n.rot)} ${r(n.x)} ${r(baseline0)})"` : '';
  const spans = text.split('\n').map((line, i) =>
    `<tspan x="${r(n.x)}" y="${r(baseline0 + i * size * 1.4)}">${escapeXml(line)}</tspan>`).join('');
  return `<text xml:space="preserve" fill="${safeAttrColor(n.fg, '#000000')}" font-size="${r(size)}"${familyAttr}${weight}${rot}>${spans}</text>`;
}

// Gradient coords/matrix carry more meaningful precision than the 2-dp `r` used
// for page geometry (a normalized 0..1 axis, or a small pattern-matrix scale).
const g4 = (v: number): number => Math.round(((typeof v === 'number' && isFinite(v)) ? v : 0) * 1e4) / 1e4;
const g6 = (v: number): number => Math.round(((typeof v === 'number' && isFinite(v)) ? v : 0) * 1e6) / 1e6;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A PDF axial (type 2) / radial (type 3) shading → an SVG gradient element. The
 * shading keeps its own coordinate space; `matrix` (shading space → page/box space)
 * rides on `gradientTransform` so any affine — including a skewed radial — is exact
 * without pre-transforming the endpoints. `gradientUnits="userSpaceOnUse"` because
 * the coords are absolute, not fractions of the painted box. Returns '' for a
 * shading we can't faithfully emit (fewer than two stops, a degenerate radius, a
 * non-finite matrix) so the caller falls back to the node's flat fill.
 */
function gradientMarkup(g: PdfGradient, id: string): string {
  const stops = (g.stops ?? []).filter((s) => s && isFinite(s.offset));
  if (stops.length < 2) return '';
  const m = g.matrix;
  if (!Array.isArray(m) || m.length < 6 || !m.every((v) => isFinite(v))) return '';
  const gt = ` gradientTransform="matrix(${m.slice(0, 6).map(g6).join(' ')})"`;
  const stopsXml = stops.map((s) =>
    `<stop offset="${clamp01(s.offset)}" stop-color="${safeAttrColor(s.color, '#000000')}"/>`).join('');
  const c = g.coords ?? [];
  if (g.type === 2) {
    if (c.length < 4 || !c.slice(0, 4).every((v) => isFinite(v))) return '';
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${g4(c[0]!)}" y1="${g4(c[1]!)}" x2="${g4(c[2]!)}" y2="${g4(c[3]!)}"${gt}>${stopsXml}</linearGradient>`;
  }
  // type 3 radial: end circle (x1,y1,r1) → SVG (cx,cy,r); start circle → focal (fx,fy,fr).
  if (c.length < 6 || !c.slice(0, 6).every((v) => isFinite(v)) || !(c[5]! > 0)) return '';
  const fr = c[2]! > 0 ? ` fr="${g4(c[2]!)}"` : '';
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${g4(c[3]!)}" cy="${g4(c[4]!)}" r="${g4(c[5]!)}" fx="${g4(c[0]!)}" fy="${g4(c[1]!)}"${fr}${gt}>${stopsXml}</radialGradient>`;
}

/**
 * Serialize one interpreted PDF page to a standalone SVG document.
 * Nodes render in array order (the interpreter's paint order, back-to-front).
 */
export function pdfNodesToSvg(nodes: PdfNode[], opts: PdfSvgOptions): string {
  const w = Math.max(1, Math.round(opts.width || 0));
  const h = Math.max(1, Math.round(opts.height || 0));
  const images = opts.images ?? {};

  const body: string[] = [];
  if (opts.background) {
    const bg = safeAttrColor(opts.background, 'none');
    if (bg !== 'none') body.push(`<rect x="0" y="0" width="${w}" height="${h}" fill="${bg}"/>`);
  }

  // Interpreter clip stacks (`W`/`W*`) → shared <clipPath> defs; a clipped node is
  // wrapped in one <g clip-path> per stack entry (nested groups = intersection).
  // Without this, a print engine's soft shadows — large low-alpha shapes cut down
  // by a clip — render as giant plates.
  const clipDefs = new Map<string, string>();
  const clipId = (c: NonNullable<PdfNode['_clips']>[number]): string => {
    const key = `${c.evenOdd ? 'e' : 'n'}|${c.d}`;
    let id = clipDefs.get(key);
    if (!id) {
      id = `pclip${clipDefs.size}`;
      clipDefs.set(key, id);
    }
    return id;
  };
  const clipWrap = (n: PdfNode, el: string): string => {
    if (!el || !n._clips?.length) return el;
    const open = n._clips.map((c) => `<g clip-path="url(#${clipId(c)})">`).join('');
    return `${open}${el}${'</g>'.repeat(n._clips.length)}`;
  };

  // Gradient fills (PDF ShadingType 2/3) → deduped <linearGradient>/<radialGradient>
  // defs; a node's flat fill is replaced with a `url(#…)` ref. Deduped by content so
  // a hero gradient reused across nodes emits once. A shading we can't emit returns
  // '' → the node keeps its flat fill.
  const gradDefs = new Map<string, { id: string; markup: string }>();
  const gradientFill = (n: PdfNode): string => {
    const g = n._gradient;
    if (!g) return '';
    const key = JSON.stringify([g.type, g.coords, g.matrix, g.extend, g.stops]);
    let entry = gradDefs.get(key);
    if (!entry) {
      const id = `pgrad${gradDefs.size}`;
      entry = { id, markup: gradientMarkup(g, id) };
      gradDefs.set(key, entry);
    }
    return entry.markup ? `url(#${entry.id})` : '';
  };

  // Contiguous same-group runs become a <g data-group>: the interpreter resolves
  // groups from properly-nested frames, so members are always adjacent in paint order.
  let openGroup = '';
  const setGroup = (g: string): void => {
    if (g === openGroup) return;
    if (openGroup) body.push('</g>');
    if (g) body.push(`<g data-group="${escapeXml(g)}">`);
    openGroup = g;
  };

  for (const n of nodes ?? []) {
    if (!n || !(n.w > 0) || !(n.h > 0)) continue;
    let el = '';
    if (n._vectorPath) el = pathEl(n, gradientFill(n));
    else if (n._imageXObject) el = imageEl(n, images);
    else if (n._outlinePath?.length) el = outlinedTextEl(n);
    else if (n.kind === 'text') el = textEl(n);
    else if (n.kind === 'box') el = n.shape === 'ellipse' ? ellipseEl(n, gradientFill(n)) : rectEl(n, gradientFill(n));
    if (!el) continue;
    setGroup(n.group ?? '');
    body.push(clipWrap(n, el));
  }
  setGroup('');

  const gradDefsXml = [...gradDefs.values()].map((e) => e.markup).join('');
  const clipDefsXml = [...clipDefs.entries()].map(([key, id]) =>
    `<clipPath id="${id}"><path d="${escapeXml(key.slice(2))}"${key.startsWith('e|') ? ' clip-rule="evenodd"' : ''}/></clipPath>`).join('');
  const defs = (gradDefsXml || clipDefsXml) ? `<defs>${gradDefsXml}${clipDefsXml}</defs>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${defs}${body.join('')}</svg>`;
}

/** A sub-rect of a pdfNodesToSvg document, in its own (point) coordinate space. */
export interface SvgWindow {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Intrinsic size to stamp on the windowed root (e.g. the CSS-px viewport the
   *  window represents). Defaults to the window's own width/height. */
  outWidth?: number;
  outHeight?: number;
}

/**
 * Window a pdfNodesToSvg document to a sub-rect — the vector counterpart of a
 * raster clip: scroll offset and crop insets become viewBox geometry, so the
 * "cropped" export is a lossless re-framing of the same vectors. Pure string
 * surgery on the serializer's own root element (viewBox + width + height are
 * always its first three attributes, see pdfNodesToSvg) — no DOM, so shells and
 * tests share it. Returns the input unchanged when the root doesn't match (an
 * SVG from anywhere else) — callers can pass any svg string safely.
 */
export function windowPdfSvg(svg: string, win: SvgWindow): string {
  const m = /^<svg ([^>]*?)viewBox="[^"]*" width="[^"]*" height="[^"]*">/.exec(svg);
  if (!m) return svg;
  const x = r(win.x), y = r(win.y);
  const w = Math.max(1, r(win.width)), h = Math.max(1, r(win.height));
  const ow = Math.max(1, r(win.outWidth ?? w)), oh = Math.max(1, r(win.outHeight ?? h));
  return `<svg ${m[1]}viewBox="${x} ${y} ${w} ${h}" width="${ow}" height="${oh}">` + svg.slice(m[0].length);
}
