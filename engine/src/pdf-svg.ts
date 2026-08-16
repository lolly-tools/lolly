// SPDX-License-Identifier: MPL-2.0
/**
 * PDF page → standalone SVG serializer (pure, DOM-free).
 *
 * Takes the PdfNodes the content-stream interpreter (pdf-map.ts) produced for one
 * page (BEFORE finalizeBoxes, so the `_vector*` / `_imageXObject` placeholders are
 * still present) and emits one self-contained SVG document for the whole page.
 * This is the "PDF page as an asset" sibling of the Design import path: the
 * SAME interpreted nodes either become editable boxes (design-import) or this flat
 * SVG (asset upload), so the two ingest surfaces can never disagree about what a
 * page contains.
 *
 * Raster image XObjects can't be decoded here (that needs a canvas); the shell
 * decodes them and passes the results in `opts.images` (imageKey → href, usually a
 * data: URI) so the output stays self-contained. An image with no resolved href is
 * skipped, mirroring the boxes path, where it degrades to an empty box.
 *
 * Group ids (OCG layers / form XObjects / q…Q blocks, resolved by the interpreter
 * onto contiguous paint-order runs) are kept as <g data-group="…"> wrappers, so a
 * page SVG re-imported into Design yields the same grouping.
 *
 * The page background is transparent by design. PDF "paper" is a viewer
 * convention, not page content, and vector art (the .ai logo case) should land on
 * any canvas without a baked white plate. Pass `background` to opt into one.
 */

import type { PdfNode, PdfGradient } from './pdf-map.ts';

export interface PdfSvgOptions {
  /**
   * Namespace for generated `<defs>` ids (gradients, clips, masks).
   *
   * Defaults to 'p', which is what every existing caller gets. It matters
   * because a stored SVG asset is INLINED as a nested `<svg>` on export, and a
   * nested `<svg>` does not scope ids: two documents that both minted `pgrad0`
   * end up cross-referencing each other's paint servers in one output file. That
   * is silent and produces plausible-but-wrong artwork, so any caller emitting
   * more than one SVG destined for the same canvas must pass a distinct prefix.
   */
  idPrefix?: string;
  /** Page (MediaBox) size in points: becomes the viewBox and intrinsic size. */
  width: number;
  height: number;
  /** Resolved raster XObjects: PdfNode._imageXObject key → href (a data: URI). */
  images?: Record<string, string>;
  /** Optional opaque background colour (e.g. '#ffffff'); default transparent. */
  background?: string;
  /**
   * Hoist byte-identical `<path>` elements into `<defs>` and reference them with
   * `<use>`. OFF by default, and deliberately opt-in: see the warning below.
   *
   * Why it exists: a print engine draws a dashed border as FOUR separate paints,
   * each carrying the WHOLE dash ring and each clipped to one mitred border-side
   * wedge. The ring can run 50 KB, so one bordered control costs 200 KB, 37% of
   * a docs brand-studio capture and 50% of a logo-grid one. The copies are NOT
   * redundant (each has a different innermost clip), so collapsing the DRAWS
   * would delete three sides of every dashed border. This collapses only the
   * DATA: every `<use>` keeps its own clip/group wrappers, so rendering is
   * identical by construction.
   *
   * WARNING: do not enable for SVG destined for a re-export path. `svg-ir.ts`
   * (EMF/EPS/DXF) skips `<use>` outright, so a hoisted path would silently
   * vanish there. Enable it only for terminal output such as a docs screenshot.
   */
  dedupePaths?: boolean;
}

// Round for compact, stable output (the interpreter already works in ~0.01pt).
// The isFinite check is on the ROUNDED value too: v·100 overflows to Infinity
// somewhere past 1e306, and `x="Infinity"` is not valid SVG. A coordinate that
// large is garbage from a malformed PDF either way. Emit 0 rather than poison
// the document (pdfNodeExtent refuses to bound such nodes, so they are kept).
const r = (v: number): number => {
  const n = Math.round(((typeof v === 'number' && isFinite(v)) ? v : 0) * 100) / 100;
  return isFinite(n) ? n : 0;
};

const escapeXml = (s: string): string =>
  String(s).replace(/[&<>"']/g, (c) => (
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  ));

// Only colours the interpreter itself emits (safeColor output: #rgb/#rrggbb/… or
// 'none') are let through. Anything else falls back, so no attribute injection.
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

/**
 * The `d` a vector node actually gets serialized with. Extracted so pdfNodeExtent
 * bounds the SAME string, not the raw `_vectorPath`: the sanitiser DELETES rather
 * than escapes, so a quote between two digits (`L1'0000 0`) fuses them into a
 * different, larger coordinate. Reading the raw value there would bound geometry
 * the document doesn't contain, and miss the geometry it does.
 */
function vectorPathD(n: PdfNode): string {
  return String(n._vectorPath ?? '').replace(/["<>&']/g, '');
}

// A baked vector path is already in absolute page coordinates: no transform needed.
function pathEl(n: PdfNode, fillOverride?: string): string {
  const d = vectorPathD(n);
  if (!d) return '';
  const fill = fillOverride || safeAttrColor(n._vectorFill, 'none');
  const st = n._vectorStroke;
  const stroke = (st && st.color)
    ? ` stroke="${safeAttrColor(st.color, '#000000')}" stroke-width="${r(Math.max(0.3, +st.width || 1))}"`
      + (st.cap === 'round' || st.cap === 'square' ? ` stroke-linecap="${st.cap}"` : '')
      + (st.join === 'round' || st.join === 'bevel' ? ` stroke-linejoin="${st.join}"` : '')
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
  // An image whose ROUNDED extent is zero cannot draw, so emitting it is pure weight,
  // and the weight is not small: the href is a base64 raster. The node-level guard is
  // `n.w > 0`, which a 0.004-unit box passes before `r()` rounds the attribute to "0".
  // Test what will actually be written, not what was computed.
  if (r(n.w) <= 0 || r(n.h) <= 0) return '';
  return `<image x="${r(n.x)}" y="${r(n.y)}" width="${r(n.w)}" height="${r(n.h)}" preserveAspectRatio="none" href="${escapeXml(href)}"${opacityAttr(n)}${rotateAttr(n)}/>`;
}

// The leading a text node's lines are placed at, as a multiple of fontSize:
// the interpreter's measured `lineHeight` when the node carries one, else the
// historical 1.4 estimate. Every consumer of line geometry (textEl,
// outlinedTextEl, pdfNodeExtent) MUST read it here so they cannot disagree.
function leadOf(n: PdfNode): number {
  const v = +(n.lineHeight ?? 0);
  return isFinite(v) && v > 0 ? v : 1.4;
}

// Outlined text: the same baseline/line geometry as textEl, but each line is a
// real <path> of glyph outlines (font units already resolved to SVG px by the
// shaper) placed by a translate, so the SVG needs no font at render time. Only
// used for un-rotated runs (the shell keeps rotated text as <text>).
function outlinedTextEl(n: PdfNode): string {
  const lines = n._outlinePath ?? [];
  if (!lines.length) return '';
  const size = Math.max(1, +(n.fontSize ?? 0) || 12);
  const lineH = leadOf(n) * size;
  const baseline0 = n.y + size * 0.8;
  const fill = safeAttrColor(n.fg, '#000000');
  const parts: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const d = lines[i];
    if (!d) continue;
    // Same alpha as the <text> rung: the outlined path is the same run, so the two
    // presentations must not disagree about how strong the ink is.
    parts.push(`<g transform="translate(${r(n.x)} ${r(baseline0 + i * lineH)})"><path d="${d}" fill="${fill}"${opacityAttr(n)}/></g>`);
  }
  return parts.join('');
}

// Text: the interpreter puts the box top at (baseline − 0.8·size) and sizes the box
// at 1.4·size per line. Mirror both so this presentation matches the boxes path.
function textEl(n: PdfNode): string {
  const text = String(n.text ?? '');
  if (!text.trim()) return '';
  const size = Math.max(1, +(n.fontSize ?? 0) || 12);
  const lineH = leadOf(n) * size;
  const baseline0 = n.y + size * 0.8;
  const family = String(n.fontFamily || '').trim();
  const familyAttr = family
    ? ` font-family="${escapeXml(family)}, sans-serif"`
    : ` font-family="sans-serif"`;
  const weight = n.fontWeight != null && n.fontWeight !== '' ? ` font-weight="${escapeXml(String(n.fontWeight))}"` : '';
  // Text rotates about its PDF anchor (the first line's origin), not the box centre.
  const rot = n.rot ? ` transform="rotate(${r(n.rot)} ${r(n.x)} ${r(baseline0)})"` : '';
  const spans = text.split('\n').map((line, i) =>
    `<tspan x="${r(n.x)}" y="${r(baseline0 + i * lineH)}">${escapeXml(line)}</tspan>`).join('');
  // `opacityAttr` like every other element builder: text was the ONE that omitted it,
  // so a muted or secondary label (PDF `/ca`, or a soft mask folded to a constant)
  // rendered at full strength, which reads as the wrong colour, not as slightly off.
  return `<text xml:space="preserve" fill="${safeAttrColor(n.fg, '#000000')}" font-size="${r(size)}"${familyAttr}${weight}${opacityAttr(n)}${rot}>${spans}</text>`;
}

// Gradient coords/matrix carry more meaningful precision than the 2-dp `r` used
// for page geometry (a normalized 0..1 axis, or a small pattern-matrix scale).
const g4 = (v: number): number => Math.round(((typeof v === 'number' && isFinite(v)) ? v : 0) * 1e4) / 1e4;
const g6 = (v: number): number => Math.round(((typeof v === 'number' && isFinite(v)) ? v : 0) * 1e6) / 1e6;
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * A PDF shading → an SVG paint server. The shading keeps its own coordinate space;
 * `matrix` (shading space → page/box space) rides on `gradientTransform` /
 * `patternTransform` so any affine, including a skewed radial, is exact without
 * pre-transforming the endpoints. `gradientUnits="userSpaceOnUse"` because the
 * coords are absolute, not fractions of the painted box. Returns '' for a shading
 * we can't faithfully emit (fewer than two stops, a degenerate radius, a non-finite
 * matrix, a tile key with no registered image) so the caller falls back to the
 * node's flat fill.
 */
function gradientMarkup(g: PdfGradient, id: string, images: Record<string, string>): string {
  const m = g.matrix;
  if (!Array.isArray(m) || m.length < 6 || !m.every((v) => isFinite(v))) return '';

  // ShadingType 1 (function-based): an irreducibly 2-D colour field the shell
  // rasterised to a tile. `tileKey` is opaque here: resolved through the same
  // `images` record, and behind the same data:-URI check, as an image XObject, so
  // this can't become a second, laxer href path.
  //
  // The tile is emitted at the pattern origin (x=y=0) with the domain offset folded
  // into patternTransform, NOT as an x/y on the <pattern>: renderers disagree about
  // whether pattern content coordinates are tile-relative or user-space, and at
  // x=y=0 both readings coincide. Deliberate limitation: a raster tile is a raster,
  // and zooming far enough into an exported OKLCH wheel blurs it. Bounded to genuinely
  // 2-D fields and switchable off (PdfPageSvgOpts.rasterFallback).
  //
  // Second deliberate limitation: `patternTransform` is less well-trodden in
  // renderers than `gradientTransform` (resvg, Inkscape, older Safari). The docs
  // pipeline renders through Chromium so the primary consumer is safe; someone
  // opening the exported SVG elsewhere may see a misplaced tile.
  if (g.type === 1) {
    const key = g.tileKey;
    const href = key ? images[key] : undefined;
    if (!href || !/^data:image\//i.test(href)) return '';
    const d = g.domain;
    if (!Array.isArray(d) || d.length < 4 || !d.slice(0, 4).every((v) => isFinite(v))) return '';
    const [x0, x1, y0, y1] = d as [number, number, number, number];
    const tw = x1 - x0, th = y1 - y0;
    if (!(tw > 0) || !(th > 0)) return '';
    // matrix ∘ translate(x0, y0)
    const [a, b, c, dd, e, f] = m as [number, number, number, number, number, number];
    const pt = [a, b, c, dd, a * x0 + c * y0 + e, b * x0 + dd * y0 + f];
    return `<pattern id="${id}" patternUnits="userSpaceOnUse" x="0" y="0" width="${g4(tw)}" height="${g4(th)}"`
      + ` patternTransform="matrix(${pt.map(g6).join(' ')})">`
      + `<image x="0" y="0" width="${g4(tw)}" height="${g4(th)}" preserveAspectRatio="none" href="${escapeXml(href)}"/></pattern>`;
  }

  const stops = (g.stops ?? []).filter((s) => s && isFinite(s.offset));
  if (stops.length < 2) return '';
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

/** Which element (if any) pdfNodesToSvg emits for a node. */
export type PdfElementKind = 'path' | 'image' | 'outlined-text' | 'text' | 'box' | 'none';

/**
 * The serializer's element dispatch, extracted so `pdfNodeExtent` can mirror it
 * EXACTLY rather than re-deriving it. Order matters here and matches the emit
 * loop below.
 *
 * LANDMINE this exists to defuse: `kind: 'image'` is the interpreter's generic
 * drawn-node carrier. A baked vector path is an `'image'` node with `_vectorPath`
 * set (pdf-map.ts:898-901 makes the same point for raster detection). Anything
 * that branches on `n.kind` alone silently mis-classifies vector tiles; branch on
 * this instead.
 */
export function pdfNodeElementKind(n: PdfNode): PdfElementKind {
  if (!n) return 'none';
  if (n._vectorPath) return 'path';
  if (n._imageXObject) return 'image';
  if (n._outlinePath?.length) return 'outlined-text';
  if (n.kind === 'text') return 'text';
  if (n.kind === 'box') return 'box';
  return 'none';
}

/**
 * Serialize one interpreted PDF page to a standalone SVG document.
 * Nodes render in array order (the interpreter's paint order, back-to-front).
 */
export function pdfNodesToSvg(nodes: PdfNode[], opts: PdfSvgOptions): string {
  // Sanitised: an id has to survive as a bare `url(#…)` reference.
  const idp = (opts.idPrefix ?? 'p').replace(/[^A-Za-z0-9_-]/g, '') || 'p';
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
  // Without this, a print engine's soft shadows (large low-alpha shapes cut down
  // by a clip) render as giant plates.
  const clipDefs = new Map<string, string>();
  const clipId = (c: NonNullable<PdfNode['_clips']>[number]): string => {
    const key = `${c.evenOdd ? 'e' : 'n'}|${c.d}`;
    let id = clipDefs.get(key);
    if (!id) {
      id = `${idp}clip${clipDefs.size}`;
      clipDefs.set(key, id);
    }
    return id;
  };
  const clipWrap = (n: PdfNode, el: string): string => {
    if (!el || !n._clips?.length) return el;
    const open = n._clips.map((c) => `<g clip-path="url(#${clipId(c)})">`).join('');
    return `${open}${el}${'</g>'.repeat(n._clips.length)}`;
  };

  // Gradient fills (PDF ShadingType 1/2/3) → deduped <linearGradient>/
  // <radialGradient>/<pattern> defs; a node's flat fill is replaced with a `url(#…)`
  // ref. Deduped by content so a hero gradient, or three instances of one OKLCH
  // wheel, emits once. A shading we can't emit returns '' → the node keeps its flat
  // fill, which the interpreter now always populates.
  const gradDefs = new Map<string, { id: string; markup: string }>();
  const gradientFill = (n: PdfNode): string => {
    const g = n._gradient;
    if (!g) return '';
    const key = JSON.stringify([g.type, g.coords, g.matrix, g.extend, g.stops, g.domain, g.tileKey]);
    let entry = gradDefs.get(key);
    if (!entry) {
      const id = `${idp}grad${gradDefs.size}`;
      entry = { id, markup: gradientMarkup(g, id, images) };
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

  // Gradient defs are REFERENCE-driven, not registration-driven: `gradientFill`
  // registers a def as a side effect of being asked for a paint, but the node may
  // still yield no element (an empty `d`, a fill of none, an unresolved image).
  // Only ids that actually reached the output are emitted. Otherwise a node that
  // paints nothing would still ship its <defs> payload, and for a ShadingType-1
  // tile that payload is a base64 PNG. This is also what makes cullPdfNodes safe
  // to use without a separate def sweep: cull nodes, and the defs follow.
  const usedGrads = new Set<string>();

  // One node → one element. Extracted so a <mask>'s children go through the EXACT
  // same path as the page's own nodes: gradients, clips, rasters, even-odd rules and
  // rotations all work inside a mask for free, because there is only one renderer.
  // Dispatch via the shared classifier so pdfNodeExtent can mirror it exactly.
  // See pdfNodeElementKind for why a `kind` test alone is a trap.
  const renderNode = (n: PdfNode): { el: string; gref: string } => {
    let el = '', gref = '';
    switch (pdfNodeElementKind(n)) {
      case 'path': gref = gradientFill(n); el = pathEl(n, gref); break;
      case 'image': el = imageEl(n, images); break;
      case 'outlined-text': el = outlinedTextEl(n); break;
      case 'text': el = textEl(n); break;
      case 'box': gref = gradientFill(n); el = n.shape === 'ellipse' ? ellipseEl(n, gref) : rectEl(n, gref); break;
      case 'none': el = ''; break;
    }
    return { el, gref };
  };

  /**
   * A PDF /Luminosity (or /Alpha) soft mask → an SVG `<mask>`, deduped by the
   * interpreter's own (mask, CTM) key. PDF 32000-1 section 11.6.5.2 maps exactly:
   *   /S /Luminosity        → `<mask>` (SVG's default mask is luminance)
   *   group /CS /DeviceGray → sRGB luminance of (g,g,g) IS g, EXACT
   *   group /BBox           → maskUnits="userSpaceOnUse" + explicit x/y/width/height
   *   outside the /BBox     → 0, which is PDF's own default (black) /BC, exact
   *   /S /Alpha             → mask-type="alpha"
   *
   * This is how a CSS box-shadow finally renders: Chromium bakes its blur, offset and
   * rounded corners into the mask (94% of the time a single blurred greyscale JPEG),
   * fills the element's whole rect with flat translucent ink, and lets the mask carve
   * the shape. See pdf-smask.ts.
   *
   * `color-interpolation:sRGB` is pinned deliberately: SVG 1.1 nominally computes mask
   * luminance in linearRGB, while CSS Masking Level 1 (what browsers actually
   * implement, and what /Luminosity means) uses sRGB. Stating it removes the
   * ambiguity for resvg/Inkscape and keeps this in step with pdf-smask's
   * `relativeLuminance`, which the interpreter's constant-fold rung uses.
   *
   * A mask whose children all render to nothing emits NOTHING for the masked node: an
   * unknowable mask is a black mask, and a print engine's shadow ink rendered UNMASKED
   * is an opaque grey plate the size of the control, the worse of the two errors.
   */
  const maskDefs = new Map<string, { id: string; markup: string; grefs: string[] }>();
  const maskWrap = (n: PdfNode, el: string): string => {
    const m = n._softMask;
    if (!el || !m || !(m.w > 0) || !(m.h > 0)) return el;
    let entry = maskDefs.get(m.key);
    if (!entry) {
      const id = `${idp}mask${maskDefs.size}`;
      const grefs: string[] = [];
      // A child's own `_softMask` is ignored. The interpreter caps mask nesting at
      // one level (section 11.6.5.2 turns soft masks off inside a mask group), so it is
      // always absent here.
      let kids = '';
      for (const k of m.nodes ?? []) {
        if (!k || !(k.w > 0) || !(k.h > 0)) continue;
        const got = renderNode(k);
        if (!got.el) continue;
        if (got.gref) grefs.push(got.gref.slice(5, -1));
        kids += clipWrap(k, got.el);
      }
      const ty = m.subtype === 'Alpha' ? ' mask-type="alpha"' : '';
      entry = {
        id, grefs,
        markup: kids
          ? `<mask id="${id}" maskUnits="userSpaceOnUse" x="${r(m.x)}" y="${r(m.y)}"`
            + ` width="${r(m.w)}" height="${r(m.h)}"${ty} style="color-interpolation:sRGB">${kids}</mask>`
          : '',
      };
      maskDefs.set(m.key, entry);
    }
    if (!entry.markup) return '';
    // The mask's own gradient defs are reference-driven too: they only survive the
    // <defs> filter once a node actually used this mask.
    for (const g of entry.grefs) usedGrads.add(g);
    return `<g mask="url(#${entry.id})">${el}</g>`;
  };

  // Identical `<path>` markup → one <defs> entry + <use> references (opt-in; see
  // PdfSvgOptions.dedupePaths). Keyed on the WHOLE serialised element, which
  // already encodes d + every paint attribute, so nothing that differs in ink can
  // ever collapse. Clip and group wrappers stay outside the key and outside the
  // <use>, which is what makes this safe for the four-wedge border case.
  interface PathDef { id: string; markup: string; uses: number; slot: number }
  const pathDefs = new Map<string, PathDef>();
  const useRef = (el: string): string => {
    // Translucent ink is the one exception: two identical semi-transparent paths
    // at the same place composite DARKER than one, so a repeat is meaningful.
    if (!opts.dedupePaths || !el.startsWith('<path ') || el.includes('opacity=')) return el;
    let d = pathDefs.get(el);
    if (!d) {
      d = { id: `${idp}use${pathDefs.size}`, markup: el, uses: 0, slot: body.length };
      pathDefs.set(el, d);
      d.uses++;
      return el;   // first occurrence stays inline; patched to a <use> below if reused
    }
    d.uses++;
    return `<use href="#${d.id}"/>`;
  };

  for (const n of nodes ?? []) {
    if (!n || !(n.w > 0) || !(n.h > 0)) continue;
    const got = renderNode(n);
    // Clip outermost, mask inside: both are intersections, and this keeps the
    // existing clip dedup and the <g data-group> runs untouched.
    const el = maskWrap(n, got.el);
    if (!el) continue;
    if (got.gref) usedGrads.add(got.gref.slice(5, -1));   // 'url(#<p>gradN)' → '<p>gradN'
    setGroup(n.group ?? '');
    body.push(clipWrap(n, useRef(el)));
  }
  setGroup('');

  // Promote only the paths that were actually reused: a single-use <use> is pure
  // loss. The first occurrence was emitted inline, so rewrite that one body entry
  // to reference the def instead.
  const pathDefsXml = [...pathDefs.values()].filter((d) => d.uses > 1).map((d) => {
    const inline = body[d.slot];
    if (inline !== undefined) body[d.slot] = inline.replace(d.markup, `<use href="#${d.id}"/>`);
    return d.markup.replace('<path ', `<path id="${d.id}" `);
  }).join('');

  const gradDefsXml = [...gradDefs.values()].filter((e) => usedGrads.has(e.id)).map((e) => e.markup).join('');
  const maskDefsXml = [...maskDefs.values()].map((e) => e.markup).join('');
  const clipDefsXml = [...clipDefs.entries()].map(([key, id]) =>
    `<clipPath id="${id}"><path d="${escapeXml(key.slice(2))}"${key.startsWith('e|') ? ' clip-rule="evenodd"' : ''}/></clipPath>`).join('');
  const defs = (gradDefsXml || maskDefsXml || clipDefsXml || pathDefsXml)
    ? `<defs>${gradDefsXml}${maskDefsXml}${clipDefsXml}${pathDefsXml}</defs>` : '';
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
 * Window a pdfNodesToSvg document to a sub-rect: the vector counterpart of a
 * raster clip. Scroll offset and crop insets become viewBox geometry, so the
 * "cropped" export is a lossless re-framing of the same vectors. Pure string
 * surgery on the serializer's own root element (viewBox + width + height are
 * always its first three attributes, see pdfNodesToSvg). No DOM, so shells and
 * tests share it. Returns the input unchanged when the root doesn't match (an
 * SVG from anywhere else); callers can pass any svg string safely.
 */
export function windowPdfSvg(svg: string, win: SvgWindow): string {
  const m = /^<svg ([^>]*?)viewBox="[^"]*" width="[^"]*" height="[^"]*">/.exec(svg);
  if (!m) return svg;
  const x = r(win.x), y = r(win.y);
  const w = Math.max(1, r(win.width)), h = Math.max(1, r(win.height));
  const ow = Math.max(1, r(win.outWidth ?? w)), oh = Math.max(1, r(win.outHeight ?? h));
  return `<svg ${m[1]}viewBox="${x} ${y} ${w} ${h}" width="${ow}" height="${oh}">` + svg.slice(m[0].length);
}

// ── Crop culling ──────────────────────────────────────────────────────────────
//
// SOUNDNESS: culling is legal only because everything pdfNodesToSvg emits is
// INTERSECTIVE: a node's ink never leaves its own geometry, so a node outside the
// crop cannot influence a pixel inside it. Concretely: no filter, no blend mode, no
// <use>, no <marker>; `transform` is only rotate()/translate(); clip-path and (since
// engine 1.63) mask can only remove ink, never move or spread it. A `<mask>` is
// emitted with maskUnits="userSpaceOnUse" and an explicit region, and SVG renders
// neither the mask's content nor the masked element outside that region. This is
// why pdfNodeExtent intersects with the mask rect rather than ignoring it.
//
// If a filter, a blend mode, or a mask WITHOUT a bounded region ever lands here,
// this function is WRONG, not just imprecise. tests/pdf-cull.test.ts pins the
// emitted element/attribute/transform vocabulary so the change can't land quietly.
//
// Culling is deliberately NOT folded into windowPdfSvg. Windowing is an exact
// viewBox rewrite that happens last, with the measured points-per-px ratio;
// culling is a conservative, padded, fail-open optimisation that must happen
// FIRST, before the shell decodes rasters, rasterises shading tiles and
// HarfBuzz-shapes text, which is where a cropped capture actually spends its
// bytes and its seconds. Both rects derive from one crop in each caller.

/** An axis-aligned box in the page's own (point) space. */
export interface PdfExtent { x: number; y: number; w: number; h: number }

/** A crop rectangle in the page's own (point) space: the same space as SvgWindow. */
export interface CullWindow {
  x: number; y: number; width: number; height: number;
  /**
   * Outset applied to the window before testing, in points. Absorbs the caller's
   * own rounding, the pt/px ratio's rounding, and renderer antialiasing at the
   * crop edge. Default CULL_PAD_PT.
   */
  pad?: number;
}

export interface CullResult {
  /** Survivors, in unchanged paint order (the same array elements, not clones). */
  nodes: PdfNode[];
  total: number;
  dropped: number;
  /** Nodes kept only because their extent could not be bounded (fail-open). */
  unbounded: number;
}

/** 2pt ≈ 2.7 CSS px ≈ 3 device px at 1×. See CullWindow.pad. */
export const CULL_PAD_PT = 2;

/** A node whose extent is provably empty (the serializer emits nothing for it). */
const EMPTY_EXTENT: PdfExtent = { x: 0, y: 0, w: 0, h: 0 };

const finite = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/** Clip stacks past this depth are treated as unbounded: pathological nesting. */
const MAX_CLIPS = 64;
/** A clip `d` longer than this isn't scanned (bounded work per node). */
const MAX_CLIP_D = 64_000;
/** A vector node's own `d`; larger than a clip's because real artwork paths are. */
const MAX_PATH_D = 400_000;
/** Total outline-path characters scanned for one text node (bounded work). */
const MAX_OUTLINE_D = 400_000;
/**
 * Beyond this magnitude a coordinate is not geometry, it is corruption. The
 * serializer's own 2-dp rounding can no longer represent it (see `r`), so the box
 * we'd compute would not describe where the ink actually lands. Fail open.
 * A PDF page is ~1e3 pt; even a pathological UserUnit page is far below this.
 */
const MAX_COORD = 1e9;

/**
 * "Unbounded on this axis", expressed as a number instead of Infinity: a span so
 * much larger than any page that intersecting it with a clip/mask still works and
 * every window still overlaps it, but the arithmetic stays finite.
 *
 * A PLANE-sized extent is NOT geometry. It means "this node's ink cannot be located
 * on this axis", the only honest answer for a `<text>` run, whose advance width is
 * decided by whatever font the RENDERER resolves (see the text branch below).
 */
const PLANE = MAX_COORD;
const planeBox = (): PdfExtent => ({ x: -PLANE, y: -PLANE, w: 2 * PLANE, h: 2 * PLANE });

/**
 * The control-point hull of an SVG path `d`, or null when it can't be scanned.
 *
 * Every command this codebase emits into a `d` takes pure coordinate-pair operands:
 * `M`/`L`/`C`/`Z` from pdf-map's serializePath, plus `Q` from the HarfBuzz shaper
 * (shells/web/src/bridge/text.ts transformPath). So every number is alternately an
 * x and a y, and Bézier control points are included: a superset of the true curve,
 * which is exactly what a conservative culler wants.
 *
 * The vocabulary check is a WHITELIST, deliberately. An earlier blacklist of
 * absolute command letters let the RELATIVE forms (`m`/`l`/`c`/`z`) through, and a
 * relative path scanned as absolute yields a bbox that need not contain the real
 * path at all: a silent cull. Anything outside `M L C Q Z`, digits, sign,
 * dot, comma, exponent and whitespace ⇒ null ⇒ the caller must not shrink.
 */
function pathDataBox(d: string, maxLen: number): PdfExtent | null {
  if (!d || d.length > maxLen) return null;
  if (/[^MLCQZ0-9eE.,+\s-]/.test(d)) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let i = 0;
  for (const m of d.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g)) {
    const v = +m[0];
    if (!isFinite(v)) return null;
    if ((i++ & 1) === 0) { if (v < minX) minX = v; if (v > maxX) maxX = v; }
    else { if (v < minY) minY = v; if (v > maxY) maxY = v; }
  }
  if (i < 2 || (i & 1) === 1 || !isFinite(minX) || !isFinite(minY)) return null;  // odd count ⇒ not pure pairs
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Bounding box of a clip path emitted by pdf-map's serializePath, or null when we
 * can't establish one (so the caller must not shrink the node's extent).
 *
 * Prefers a `bbox` recorded by the interpreter (serializePath already computes the
 * control-point hull), but only a SANE one: a negative span is not a tighter
 * clip, it is a bug upstream, and trusting it would collapse the extent to nothing
 * and drop a node that paints. Falls back to scanning `d`.
 */
function clipExtent(c: { d?: string; bbox?: PdfExtent } | null | undefined): PdfExtent | null {
  if (!c) return null;
  const bb = c.bbox;
  if (bb && finite(bb.x) && finite(bb.y) && finite(bb.w) && finite(bb.h) && bb.w >= 0 && bb.h >= 0) return bb;
  return pathDataBox(typeof c.d === 'string' ? c.d : '', MAX_CLIP_D);
}

/**
 * How far past a clip/mask edge a rasteriser can still put ink, in points. One
 * device pixel is 0.75 pt at the docs pipeline's own scale (1440 px ↔ 1080 pt), and
 * antialiasing spreads at most a pixel either side of an edge, so 1 pt covers it
 * with room to spare. Only ever WIDENS a clip, so it cannot cause a false drop.
 */
const AA_PAD = 1;

/** `box ∩ clip`, with the clip widened by AA_PAD (see the clip loop for why). */
function intersectAa(box: PdfExtent, c: PdfExtent): PdfExtent {
  const x1 = Math.max(box.x, c.x - AA_PAD), y1 = Math.max(box.y, c.y - AA_PAD);
  const x2 = Math.min(box.x + box.w, c.x + c.w + AA_PAD), y2 = Math.min(box.y + box.h, c.y + c.h + AA_PAD);
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** AABB of a box rotated `deg` about (ax, ay). */
function rotatedAabb(b: PdfExtent, deg: number, ax: number, ay: number): PdfExtent {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const xs = [b.x, b.x + b.w], ys = [b.y, b.y + b.h];
  for (const x of xs) for (const y of ys) {
    const dx = x - ax, dy = y - ay;
    const px = ax + dx * cos - dy * sin;
    const py = ay + dx * sin + dy * cos;
    if (px < minX) minX = px; if (px > maxX) maxX = px;
    if (py < minY) minY = py; if (py > maxY) maxY = py;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * The axis-aligned page-space box that contains every pixel `n` can paint, or null
 * when it can't be bounded (→ the caller must KEEP the node). Mirrors
 * pdfNodesToSvg's element dispatch exactly, via pdfNodeElementKind.
 *
 * A node the serializer skips outright (w/h ≤ 0, or a kind that emits nothing)
 * returns a zero-area box, which no window intersects. Dropping it is
 * behaviour-preserving, not a guess.
 *
 * THREE return shapes, and a caller must handle all three:
 *   • a real box            : bounds every pixel this node can paint
 *   • zero area             : the serializer emits nothing for it
 *   • null, or a box spanning ±PLANE on an axis: NOT geometry, "can't be located".
 *     A `<text>` run is the standard case (its advance depends on the renderer's
 *     font), so treat a PLANE span as "keep", never as a bounding box. Clips and
 *     soft masks still intersect it, which is how a clipped unbounded node is
 *     bounded after all.
 *
 * Exported for tests and for future content-bbox uses.
 */
export function pdfNodeExtent(n: PdfNode): PdfExtent | null {
  try {
    if (!n || typeof n !== 'object') return EMPTY_EXTENT;
    if (!finite(n.x) || !finite(n.y) || !finite(n.w) || !finite(n.h)) return null;
    if (n.rot != null && !finite(n.rot)) return null;
    if (Math.abs(n.x) > MAX_COORD || Math.abs(n.y) > MAX_COORD
      || Math.abs(n.w) > MAX_COORD || Math.abs(n.h) > MAX_COORD) return null;
    // The serializer's own gate, ahead of the dispatch (pdfNodesToSvg's loop head).
    if (!(n.w > 0) || !(n.h > 0)) return EMPTY_EXTENT;

    const kind = pdfNodeElementKind(n);
    const rot = n.rot || 0;
    let box: PdfExtent;

    if (kind === 'none') {
      box = EMPTY_EXTENT;
    } else if (kind === 'outlined-text') {
      // Outlined text is EXACTLY bounded: the glyph outlines are real path data, and
      // outlinedTextEl places line i at translate(x, baseline0 + i·1.4·size) with the
      // baseline at the path's own y=0. So scan the paths: no font, no guessing.
      const size = Math.max(1, +(n.fontSize ?? 0) || 12);
      const lineH = leadOf(n) * size;
      const baseline0 = n.y + size * 0.8;
      const lines = n._outlinePath ?? [];
      if (!Array.isArray(lines) || lines.length > 1e6) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let budget = MAX_OUTLINE_D, scannable = true;
      for (let i = 0; i < lines.length && scannable; i++) {
        const d = lines[i];
        if (!d) continue;                                  // outlinedTextEl skips it too
        budget -= d.length;
        const lb = budget < 0 ? null : pathDataBox(d, MAX_OUTLINE_D);
        if (!lb) { scannable = false; break; }
        const dy = baseline0 + i * lineH;
        if (n.x + lb.x < minX) minX = n.x + lb.x;
        if (n.x + lb.x + lb.w > maxX) maxX = n.x + lb.x + lb.w;
        if (dy + lb.y < minY) minY = dy + lb.y;
        if (dy + lb.y + lb.h > maxY) maxY = dy + lb.y + lb.h;
      }
      if (!scannable) box = planeBox();                    // fail open, never guess
      else if (!isFinite(minX)) box = EMPTY_EXTENT;        // every line empty ⇒ no element
      else box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      // outlinedTextEl emits no rotate at all (the shell only outlines un-rotated
      // runs), so `rot` is deliberately ignored here: mirroring the serializer is
      // the invariant, not mirroring what the PDF said.
    } else if (kind === 'text') {
      // A `<text>` element's ink is NOT bounded by anything the engine knows. `n.w`
      // is pdf-map's char-count estimate off the FIRST line only (flushText:
      // `max(4, firstLine.length·size·0.55, size·2)`), so a wrapped paragraph whose
      // second line is longer, or any full-width script at ~1em per glyph, paints
      // far to the right of it, and the final advance is decided by whichever font
      // the RENDERER resolves, which is not knowable in a DOM-free engine.
      //
      // So the horizontal axis is reported as unbounded (PLANE) rather than guessed.
      // The vertical axis IS bounded, by fontSize: no shipping face puts ink more
      // than 1.3em above its baseline or 0.5em below it, and textEl's own geometry
      // fixes each baseline at y + 0.8·size + i·1.4·size. That vertical band is what
      // culls the 100+ labels of a sidebar that sits above or below the crop.
      //
      // Cost of being honest: text nodes level with the crop are never culled. They
      // are also never the payload: a cropped capture's bytes are rasters and
      // shading tiles (an 11.7 MB base64 <canvas> node against ~150 B per label),
      // and on the docs path text is OUTLINED, which takes the exact branch above.
      const size = Math.max(1, +(n.fontSize ?? 0) || 12);
      const baseline0 = n.y + size * 0.8;
      const text = String(n.text ?? '');
      if (!text.trim()) { box = EMPTY_EXTENT; }            // textEl emits nothing
      else if (rot) { box = planeBox(); }                  // rotating an unbounded strip
      else {
        const lineCount = Math.max(text.split('\n').length, 1);
        if (!finite(lineCount) || lineCount > 1e6) return null;
        const top = n.y - size * 0.5;                      // = baseline0 − 1.3·size
        const bottom = baseline0 + (lineCount - 1) * leadOf(n) * size + size * 0.5;
        box = { x: -PLANE, y: top, w: 2 * PLANE, h: bottom - top };
      }
    } else if (kind === 'path') {
      // pathEl emits no transform (a baked path is already in absolute page
      // coordinates and pdf-map sets rot: 0). Bound the `d` the serializer will
      // actually write, unioned with the interpreter's declared box: the two agree
      // today (both are serializePath's hull) and the union means a future producer
      // that sets one without the other cannot silently lose ink.
      const d = vectorPathD(n);
      if (!d) { box = EMPTY_EXTENT; } else {               // pathEl emits nothing
        const hull = pathDataBox(d, MAX_PATH_D);
        if (!hull) box = planeBox();                       // unscannable ⇒ fail open
        else {
          box = {
            x: Math.min(n.x, hull.x), y: Math.min(n.y, hull.y),
            w: Math.max(n.x + n.w, hull.x + hull.w) - Math.min(n.x, hull.x),
            h: Math.max(n.y + n.h, hull.y + hull.h) - Math.min(n.y, hull.y),
          };
        }
      }
      const st = n._vectorStroke;
      if (st && st.color && box !== EMPTY_EXTENT) {
        // SVG's default stroke-linejoin: miter with the default stroke-miterlimit
        // of 4 (SVG 1.1 section 11.4) lets a spike reach 4 × halfWidth = 2 × width past
        // the geometric path, and the serializer emits neither property, so the
        // default governs. Same clamped width pathEl uses. Skipped for an empty
        // box: a path with no `d` draws nothing, and outsetting nothing would
        // manufacture ink at the origin.
        const sw = Math.max(0.3, +st.width || 1);
        if (!finite(sw)) return null;
        const o = 2 * sw;
        box = { x: box.x - o, y: box.y - o, w: box.w + 2 * o, h: box.h + 2 * o };
      }
    } else {
      // image / box: rect, ellipse and <image preserveAspectRatio="none"> all fill
      // exactly x,y,w,h (rx only shrinks a rect), rotated about the box centre.
      box = { x: n.x, y: n.y, w: n.w, h: n.h };
      if (rot) box = rotatedAabb(box, rot, n.x + n.w / 2, n.y + n.h / 2);
    }

    if (!finite(box.x) || !finite(box.y) || !finite(box.w) || !finite(box.h)) return null;

    // Clips can only REMOVE ink, so intersecting is a proof, not a guess, and it
    // is where the structural win lives: `sh` shadings and print-engine shadow
    // plates emit a node covering the WHOLE page whose real extent is the clip.
    //
    // Each clip is inflated by AA_PAD before intersecting, because a RASTERISER's
    // idea of "inside the clip" is wider than the geometry's. Observed on the real
    // tools-gallery page (2026-07-26): a card backdrop `<rect x="536.49" …>` sat
    // inside a `<clipPath>` whose right edge was exactly 536.49, so the exact
    // intersection was zero-width, yet Chromium antialiased the coincident edge
    // into a real 1-device-px column. Declaring that node inkless dropped a column
    // of pixels the uncropped render had. The paint there was `opacity="0.06"` so
    // the loss was ~2/255 over 23 pixels, but the SAME collapse under an opaque
    // fill is a visible grey hairline. This is the one place the extent bypasses
    // cullPdfNodes' own `pad` (an empty extent overlaps no window at all), so the
    // tolerance has to live here.
    const clips = n._clips;
    if (clips && clips.length) {
      if (!Array.isArray(clips) || clips.length > MAX_CLIPS) return null;
      for (const c of clips) {
        const ce = clipExtent(c as { d?: string; bbox?: PdfExtent });
        if (!ce) continue;                                   // unknown clip ⇒ don't shrink
        box = intersectAa(box, ce);
        if (!(box.w > 0) || !(box.h > 0)) return EMPTY_EXTENT;
      }
    }

    // A soft mask can only remove ink too, and its region is already an axis-aligned
    // box: outside a userSpaceOnUse <mask> the mask value is the backdrop, which for
    // everything we emit is 0 (see maskWrap). So this is the same proof as the clip
    // intersection, and it is the tight bound on a box-shadow plate: an element-sized
    // fill whose visible extent is exactly the mask's blurred rect. Same AA_PAD, for
    // the same reason (a mask region is a clip as far as the rasteriser is concerned).
    const sm = n._softMask;
    if (sm && finite(sm.x) && finite(sm.y) && finite(sm.w) && finite(sm.h) && sm.w > 0 && sm.h > 0) {
      box = intersectAa(box, sm);
      if (!(box.w > 0) || !(box.h > 0)) return EMPTY_EXTENT;
    }
    return box;
  } catch {
    return null;                                             // fail open, always
  }
}

/**
 * Drop nodes that PROVABLY cannot paint inside `win`. Pure, total, never throws;
 * any node whose extent can't be established is kept, and a degenerate window is a
 * no-op (a malformed crop must never blank a capture).
 *
 * Conservative by design. The payload of a cropped capture is dominated by a few
 * enormous nodes (a re-sourced canvas raster, a ShadingType-1 tile) that are
 * wholly in or wholly out, so edge-trimming buys sub-1% of the bytes for unbounded
 * correctness risk. The same interpreter serves every user who imports a .pdf
 * or .ai, where a dropped hairline is silent, permanent data loss in their artwork.
 * Cropping a straddling raster's PIXELS is the next real win; that is a canvas job
 * and belongs in the shell, not here.
 */
export function cullPdfNodes(nodes: PdfNode[], win: CullWindow): CullResult {
  const list = Array.isArray(nodes) ? nodes : [];
  const total = list.length;
  if (!win || !finite(win.x) || !finite(win.y) || !finite(win.width) || !finite(win.height)
    || !(win.width > 0) || !(win.height > 0)) {
    return { nodes: list, total, dropped: 0, unbounded: 0 };
  }
  const pad = finite(win.pad) ? Math.max(0, win.pad) : CULL_PAD_PT;
  const wx = win.x - pad, wy = win.y - pad;
  const wx2 = win.x + win.width + pad, wy2 = win.y + win.height + pad;

  const out: PdfNode[] = [];
  let unbounded = 0;
  for (const n of list) {
    let keep = true;
    try {
      const e = pdfNodeExtent(n);
      if (e === null) unbounded++;
      else keep = e.w > 0 && e.h > 0 && e.x < wx2 && e.x + e.w > wx && e.y < wy2 && e.y + e.h > wy;
    } catch {
      unbounded++;
      keep = true;
    }
    if (keep) out.push(n);
  }
  return { nodes: out, total, dropped: total - out.length, unbounded };
}
