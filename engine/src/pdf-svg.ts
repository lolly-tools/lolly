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

import type { PdfNode } from './pdf-map.ts';

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

function rectEl(n: PdfNode): string {
  const fill = safeAttrColor(n.fill, 'none');
  if (fill === 'none') return '';
  const rx = n.radius ? ` rx="${r(n.radius)}"` : '';
  return `<rect x="${r(n.x)}" y="${r(n.y)}" width="${r(n.w)}" height="${r(n.h)}"${rx} fill="${fill}"${opacityAttr(n)}${rotateAttr(n)}/>`;
}

function ellipseEl(n: PdfNode): string {
  const fill = safeAttrColor(n.fill, 'none');
  if (fill === 'none') return '';
  return `<ellipse cx="${r(n.x + n.w / 2)}" cy="${r(n.y + n.h / 2)}" rx="${r(n.w / 2)}" ry="${r(n.h / 2)}" fill="${fill}"${opacityAttr(n)}${rotateAttr(n)}/>`;
}

// A baked vector path is already in absolute page coordinates — no transform needed.
function pathEl(n: PdfNode): string {
  const d = String(n._vectorPath ?? '').replace(/["<>&']/g, '');
  if (!d) return '';
  const fill = safeAttrColor(n._vectorFill, 'none');
  const st = n._vectorStroke;
  const stroke = (st && st.color)
    ? ` stroke="${safeAttrColor(st.color, '#000000')}" stroke-width="${r(Math.max(0.3, +st.width || 1))}"`
    : '';
  if (fill === 'none' && !stroke) return '';
  return `<path d="${d}" fill="${fill}"${stroke ? `${stroke} fill-rule="nonzero"` : ''}${opacityAttr(n)}/>`;
}

function imageEl(n: PdfNode, images: Record<string, string>): string {
  const href = n._imageXObject ? images[n._imageXObject] : undefined;
  if (!href || !/^data:image\//i.test(href)) return ''; // self-contained or nothing
  return `<image x="${r(n.x)}" y="${r(n.y)}" width="${r(n.w)}" height="${r(n.h)}" preserveAspectRatio="none" href="${escapeXml(href)}"${opacityAttr(n)}${rotateAttr(n)}/>`;
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
    if (n._vectorPath) el = pathEl(n);
    else if (n._imageXObject) el = imageEl(n, images);
    else if (n.kind === 'text') el = textEl(n);
    else if (n.kind === 'box') el = n.shape === 'ellipse' ? ellipseEl(n) : rectEl(n);
    if (!el) continue;
    setGroup(n.group ?? '');
    body.push(el);
  }
  setGroup('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body.join('')}</svg>`;
}
