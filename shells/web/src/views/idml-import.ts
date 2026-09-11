// SPDX-License-Identifier: MPL-2.0
// Design Import - Adobe InDesign IDML parser.
//
// A raw .indd is a proprietary binary database with no open parser, so this path takes
// IDML - InDesign's documented, ZIP-of-XML interchange format (File → Export → InDesign
// Markup). That maps cleanly to editable free-canvas boxes, exactly like Figma/Penpot's
// open exports: each spread's rectangles/ovals/text-frames become boxes with real
// coordinates, groups and fills. Runs entirely on-device (DOMParser + the pure engine
// geometry helpers); linked (not embedded) images can't be pulled in, so image frames
// degrade to a placeholder box.
//
// Geometry model: every page item carries an `ItemTransform` (a b c d e f) that maps its
// own coordinate space into its parent's, and a `PathGeometry` of anchor points in that
// own space. We fold the anchors' local bbox through the accumulated transform with the
// shared engine `boxGeomFromBBox`, then shift the whole spread to a top-left origin.
//
// Grouping: every InDesign <Group> becomes a box `group` id, innermost-wins (nested
// groups flatten to the tightest one, since the box model's `group` is a single flat id).
// Imported groups can be moved or ungrouped as a unit in the editor.

import { boxGeomFromBBox, safeColor, mapAlign, finalizeBoxes, type DesignMapOptions } from '@lolly/engine';
import type { PageText, TextBlock } from '@lolly/engine';
import { strFromU8 } from 'fflate';
import type { UnpackHandle } from './unpack-open.ts';
import type { PdfPageSvg, EmbeddedFont, EmbeddedImageScan } from './pdf-import.ts';

interface M { a: number; b: number; c: number; d: number; e: number; f: number; }
interface StoryStyle { text: string; fontSize: number; fg: string; font: string; weight: number; align: string; }
interface IdmlNode {
  kind: 'box' | 'text';
  x: number; y: number; w: number; h: number; rot: number;
  group: string;
  fill?: string;
  shape?: string;
  text?: string;
  fg?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  textAlign?: string;
}
interface Ctx {
  nodes: IdmlNode[];
  swatches: Record<string, string>;
  stories: Record<string, StoryStyle>;
  seen: { group: number };
  warn: (msg: string) => void;
}
interface ImportResult { boxes: object[]; width: number; height: number; background: string; }

const IDENTITY: M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const ITEM_TAGS = new Set(['Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'TextFrame', 'Group']);

/**
 * Parse an unzipped IDML package into a Design boxes array.
 * @param files unzipped entries (path → bytes)
 */
export async function parseIdmlZip(
  files: Record<string, Uint8Array>,
  { warn = () => {}, map }: { host?: unknown; warn?: (msg: string) => void; map?: DesignMapOptions } = {},
): Promise<ImportResult> {
  const parser = new DOMParser();
  const xml = (path: string): Document | null => {
    const b = files[path];
    if (!b) return null;
    try {
      const doc = parser.parseFromString(strFromU8(b), 'application/xml');
      return doc.querySelector('parsererror') ? null : doc;
    } catch { return null; }
  };

  const designmap = xml('designmap.xml');
  if (!designmap) throw new Error('This .idml is missing its designmap.xml - re-export it from InDesign.');

  const pkgSrcs = (localName: string): string[] => elems(designmap)
    .filter((el) => el.localName === localName && el.getAttribute('src'))
    .map((el) => el.getAttribute('src') as string);

  const spreadSrcs = pkgSrcs('Spread');
  if (!spreadSrcs.length) throw new Error('This .idml has no spreads to import.');

  // Swatches (fills) and stories (text) are shared resources referenced by the items.
  const swatches = parseSwatches(xml(pkgSrcs('Graphic')[0] || 'Resources/Graphic.xml'));
  const stories: Record<string, StoryStyle> = {};
  for (const src of pkgSrcs('Story')) { const d = xml(src); if (d) parseStories(d, swatches, stories); }

  const spreadDoc = xml(spreadSrcs[0]!);
  const spreadEl = spreadDoc && innerElement(spreadDoc, 'Spread');
  if (!spreadEl) throw new Error('Couldn’t read the first spread of this .idml.');
  if (spreadSrcs.length > 1) warn(`Imported the first of ${spreadSrcs.length} spreads.`);

  const ctx: Ctx = { nodes: [], swatches, stories, seen: { group: 0 }, warn };
  for (const child of Array.from(spreadEl.children)) walkItem(child, IDENTITY, '', ctx);
  if (!ctx.nodes.length) throw new Error('This .idml spread had no importable page items.');

  const { width, height } = shiftToOrigin(ctx.nodes);
  const boxes = finalizeBoxes(ctx.nodes, { prefix: 'd', ...map });
  return { boxes, width, height, background: '#ffffff' };
}

// ── item walk ────────────────────────────────────────────────────────────────

function walkItem(el: Element, parentMatrix: M, group: string, ctx: Ctx): void {
  const tag = el.localName;
  if (!ITEM_TAGS.has(tag)) return;
  const world = matMul(parentMatrix, parseItemTransform(el));

  if (tag === 'Group') {
    // A fresh id per Group → innermost wins (nested groups flatten to the tightest one).
    const gid = `group${++ctx.seen.group}`;
    for (const child of Array.from(el.children)) walkItem(child, world, gid, ctx);
    return;
  }

  const bbox = localBBox(el);
  if (!bbox) return;
  const geom = boxGeomFromBBox(bbox, world);
  if (geom.w < 1 && geom.h < 1) return;

  const base = { x: geom.x, y: geom.y, w: geom.w, h: geom.h, rot: geom.rot, group };
  const fill = resolveColor(el.getAttribute('FillColor'), ctx.swatches);

  if (tag === 'TextFrame') {
    const story = ctx.stories[el.getAttribute('ParentStory') || ''];
    if (story && (story.text || '').trim()) {
      ctx.nodes.push({
        kind: 'text', ...base,
        text: story.text,
        fg: story.fg || safeColor(fill, '') || '#0c322c',
        fontSize: story.fontSize || 24,
        fontFamily: story.font || '',
        fontWeight: story.weight || 400,
        textAlign: story.align || 'left',
      });
      return;
    }
    ctx.nodes.push({ kind: 'box', ...base, fill: '' }); // empty frame
    return;
  }

  // A frame that only exists to hold a (linked) image → placeholder box; IDML links
  // images externally, so the raster itself isn't in the package.
  if (hasPlacedContent(el)) {
    ctx.warn('A linked image came in as a placeholder (IDML doesn’t embed image files).');
    ctx.nodes.push({ kind: 'box', ...base, fill: fill || '#eef1f0' });
    return;
  }

  const node: IdmlNode = { kind: 'box', ...base, fill };
  if (tag === 'Oval') node.shape = 'ellipse';
  ctx.nodes.push(node);
}

// ── geometry ──────────────────────────────────────────────────────────────────

function parseItemTransform(el: Element): M {
  const t = (el.getAttribute('ItemTransform') || '').trim().split(/\s+/).map(Number);
  if (t.length < 6 || t.some((n) => !isFinite(n))) return IDENTITY;
  return { a: t[0]!, b: t[1]!, c: t[2]!, d: t[3]!, e: t[4]!, f: t[5]! };
}

// Local bounding box from the item's OWN PathGeometry anchors (direct child only, so a
// frame's placed-image geometry doesn't leak in).
function localBBox(el: Element): { x: number; y: number; width: number; height: number } | null {
  const props = directChild(el, 'Properties');
  const geom = props && directChild(props, 'PathGeometry');
  const anchors = geom ? Array.from(geom.getElementsByTagName('PathPointType')) : [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const pt of anchors) {
    const a = (pt.getAttribute('Anchor') || '').trim().split(/\s+/).map(Number);
    if (a.length < 2 || !isFinite(a[0]!) || !isFinite(a[1]!)) continue;
    minX = Math.min(minX, a[0]!); maxX = Math.max(maxX, a[0]!);
    minY = Math.min(minY, a[1]!); maxY = Math.max(maxY, a[1]!);
  }
  if (!isFinite(minX)) return null;
  return { x: minX, y: minY, width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) };
}

function matMul(P: M, C: M): M {
  return {
    a: P.a * C.a + P.c * C.b,
    b: P.b * C.a + P.d * C.b,
    c: P.a * C.c + P.c * C.d,
    d: P.b * C.c + P.d * C.d,
    e: P.a * C.e + P.c * C.f + P.e,
    f: P.b * C.e + P.d * C.f + P.f,
  };
}

// Translate all nodes so the union of their rects starts at (0,0); return the canvas size.
function shiftToOrigin(nodes: IdmlNode[]): { width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h);
  }
  if (!isFinite(minX)) return { width: 1080, height: 1080 };
  for (const n of nodes) { n.x -= minX; n.y -= minY; }
  return { width: Math.max(1, Math.round(maxX - minX)), height: Math.max(1, Math.round(maxY - minY)) };
}

// ── swatches (fills) ──────────────────────────────────────────────────────────

// InDesign's built-in swatches aren't always spelled out in Graphic.xml.
const BUILTIN_SWATCHES: Record<string, string> = {
  'Swatch/None': '', 'Color/Paper': '#ffffff', 'Color/Black': '#000000',
  'Color/Cyan': '#00aeef', 'Color/Magenta': '#ec008c', 'Color/Yellow': '#fff200',
};

function parseSwatches(doc: Document | null): Record<string, string> {
  const map: Record<string, string> = { ...BUILTIN_SWATCHES };
  if (!doc) return map;
  for (const c of Array.from(doc.getElementsByTagName('Color'))) {
    const self = c.getAttribute('Self');
    if (!self) continue;
    const hex = colorValueToHex(c.getAttribute('Space'), c.getAttribute('ColorValue'));
    if (hex) map[self] = hex;
  }
  // Tints reference a base colour at a % - approximate as the base colour.
  for (const t of Array.from(doc.getElementsByTagName('Tint'))) {
    const self = t.getAttribute('Self'); const base = t.getAttribute('BaseColor');
    if (self && base && map[base]) map[self] = map[base]!;
  }
  return map;
}

function resolveColor(ref: string | null, swatches: Record<string, string>): string {
  if (!ref) return '';
  if (Object.hasOwn(swatches, ref)) return swatches[ref] ?? '';
  return '';
}

function colorValueToHex(space: string | null, value: string | null): string {
  const v = (value || '').trim().split(/\s+/).map(Number);
  if (v.some((n) => !isFinite(n))) return '';
  const to255 = (x: number): number => Math.max(0, Math.min(255, Math.round(x)));
  const sp = space || '';
  if (/RGB/i.test(sp) && v.length >= 3) return rgb(to255(v[0]!), to255(v[1]!), to255(v[2]!));
  if (/CMYK/i.test(sp) && v.length >= 4) {
    const c = v[0]! / 100, m = v[1]! / 100, y = v[2]! / 100, k = v[3]! / 100;
    return rgb(to255(255 * (1 - c) * (1 - k)), to255(255 * (1 - m) * (1 - k)), to255(255 * (1 - y) * (1 - k)));
  }
  if (/Gray/i.test(sp) && v.length >= 1) { const g = to255(255 * (1 - v[0]! / 100)); return rgb(g, g, g); }
  return '';
}
function rgb(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

// ── stories (text) ─────────────────────────────────────────────────────────────

function parseStories(doc: Document, swatches: Record<string, string>, out: Record<string, StoryStyle>): void {
  for (const story of Array.from(doc.getElementsByTagName('Story'))) {
    const self = story.getAttribute('Self');
    if (!self) continue;
    let text = '';
    let fontSize = 0, fg = '', font = '', weight = 0, align = '';
    for (const psr of Array.from(story.getElementsByTagName('ParagraphStyleRange'))) {
      if (!align) align = mapAlign(justificationToAlign(psr.getAttribute('Justification')));
      if (text) text += '\n';
      for (const csr of Array.from(psr.getElementsByTagName('CharacterStyleRange'))) {
        if (!fontSize) fontSize = Math.round(parseFloat(csr.getAttribute('PointSize') || '') || 0);
        if (!fg) fg = safeColor(resolveColor(csr.getAttribute('FillColor'), swatches), '');
        if (!font) font = fontFamilyOf(csr);
        if (!weight) weight = weightFromFontStyle(csr.getAttribute('FontStyle'));
        for (const child of Array.from(csr.childNodes)) {
          if (child.nodeType === 1 && (child as Element).localName === 'Content') text += child.textContent || '';
          else if (child.nodeType === 1 && (child as Element).localName === 'Br') text += '\n';
        }
      }
    }
    out[self] = { text: text.replace(/\n{3,}/g, '\n\n').replace(/\s+$/g, ''), fontSize, fg, font, weight, align };
  }
}

function justificationToAlign(j: string | null): string {
  const s = String(j || '');
  if (/Center/i.test(s)) return 'center';
  if (/Right/i.test(s)) return 'right';
  return 'left';
}
function fontFamilyOf(csr: Element): string {
  const af = csr.getElementsByTagName('AppliedFont')[0];
  return (af && (af.textContent || '').trim()) || csr.getAttribute('AppliedFont') || '';
}
function weightFromFontStyle(style: string | null): number {
  const s = String(style || '');
  if (/black|heavy/i.test(s)) return 900;
  if (/extra[\s-]*bold|ultra/i.test(s)) return 800;
  if (/semi[\s-]*bold|demi/i.test(s)) return 600;
  if (/bold/i.test(s)) return 700;
  if (/medium/i.test(s)) return 500;
  if (/light/i.test(s)) return 300;
  return 400;
}

// ── DOM helpers ────────────────────────────────────────────────────────────────

function elems(doc: Document): Element[] { return Array.from(doc.getElementsByTagName('*')); }
function directChild(el: Element, localName: string): Element | null {
  for (const c of Array.from(el.children)) if (c.localName === localName) return c;
  return null;
}
// The first element whose localName matches AND that actually holds page items - skips the
// idPkg wrapper element that shares the local name (e.g. <idPkg:Spread><Spread>…).
function innerElement(doc: Document, localName: string): Element | null {
  const all = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === localName);
  return all.find((el) => Array.from(el.children).some((c) => ITEM_TAGS.has(c.localName) || c.localName === 'Page'))
    || all[all.length - 1] || null;
}
function hasPlacedContent(el: Element): boolean {
  for (const c of Array.from(el.children)) {
    if (c.localName === 'Image' || c.localName === 'EPS' || c.localName === 'PDF' || c.localName === 'WMF' || c.localName === 'PICT') return true;
  }
  return false;
}

// ── Unpack reader (idml → PdfHandle) ────────────────────────────────────────────

/** A referenced-but-not-embedded font row - IDML links its fonts, so no bytes. */
function namesOnlyFont(family: string): EmbeddedFont {
  return {
    name: family, family, ext: 'ttf', bytes: new Uint8Array(0),
    subset: false, installable: false,
    embedding: { permission: 'unknown', noSubsetting: false, bitmapOnly: false, fsType: null },
  };
}

const XML_ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const xmlEsc = (s: string): string => String(s).replace(/[&<>"]/g, (c) => XML_ESC[c]!);

/** A spread's page items as a plain preview SVG - rects/ellipses for shapes, text
 *  for frames. Not a faithful render (no wrapping or kerning), just enough to
 *  recognise the page beside its extracted prose. */
function idmlNodesToSvg(nodes: IdmlNode[], width: number, height: number): string {
  const parts = nodes.map((n) => {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    const rot = n.rot ? ` transform="rotate(${n.rot} ${cx} ${cy})"` : '';
    if (n.kind === 'text') {
      const fs = n.fontSize || 16;
      const fill = n.fg || '#0c322c';
      const anchor = n.textAlign === 'center' ? 'middle' : n.textAlign === 'right' ? 'end' : 'start';
      const tx = anchor === 'middle' ? cx : anchor === 'end' ? n.x + n.w : n.x;
      const tspans = String(n.text || '').split('\n').map((ln, li) =>
        `<tspan x="${tx}" dy="${li === 0 ? fs : fs * 1.25}">${xmlEsc(ln)}</tspan>`).join('');
      return `<text x="${tx}" y="${n.y}" font-size="${fs}" fill="${fill}" text-anchor="${anchor}"${rot}>${tspans}</text>`;
    }
    const fill = n.fill || 'none';
    const stroke = n.fill ? '' : ' stroke="#d5dbd9" stroke-width="1"';
    if (n.shape === 'ellipse') return `<ellipse cx="${cx}" cy="${cy}" rx="${n.w / 2}" ry="${n.h / 2}" fill="${fill}"${stroke}${rot}/>`;
    return `<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" fill="${fill}"${stroke}${rot}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#ffffff"/>${parts.join('')}</svg>`;
}

const emptyPage = (): PageText =>
  ({ blocks: [], text: '', markdown: '', columns: 1, scanned: false, rotated: 0, order: 'geometric' });

/**
 * Open an IDML package for Unpack - one page per spread, in designmap order (which
 * IS reading order, so it is never re-sorted). Text comes from the stories the
 * spread's frames reference; the palette from the document swatches; fonts are
 * REFERENCED, never embedded, so they come back as names-only rows; and linked
 * images are counted, never fetched, because an .idml carries their names, not
 * their pixels.
 */
export async function openIdmlFile(files: Record<string, Uint8Array>): Promise<UnpackHandle> {
  const parser = new DOMParser();
  const xml = (path: string): Document | null => {
    const b = files[path];
    if (!b) return null;
    try {
      const doc = parser.parseFromString(strFromU8(b), 'application/xml');
      return doc.querySelector('parsererror') ? null : doc;
    } catch { return null; }
  };

  const designmap = xml('designmap.xml');
  if (!designmap) throw new Error('This .idml is missing its designmap.xml.');
  const pkgSrcs = (localName: string): string[] => elems(designmap)
    .filter((el) => el.localName === localName && el.getAttribute('src'))
    .map((el) => el.getAttribute('src') as string);

  const spreadSrcs = pkgSrcs('Spread');
  if (!spreadSrcs.length) throw new Error('This .idml has no spreads to take apart.');

  const swatches = parseSwatches(xml(pkgSrcs('Graphic')[0] || 'Resources/Graphic.xml'));
  const stories: Record<string, StoryStyle> = {};
  for (const src of pkgSrcs('Story')) { const d = xml(src); if (d) parseStories(d, swatches, stories); }

  // Referenced font families - Fonts.xml is the authoritative list; fall back to
  // the families the stories actually applied.
  const fontFamilies: string[] = [];
  const seenFont = new Set<string>();
  const addFont = (fam: string): void => {
    const f = (fam || '').trim();
    if (f && !seenFont.has(f.toLowerCase())) { seenFont.add(f.toLowerCase()); fontFamilies.push(f); }
  };
  const fontsDoc = xml(pkgSrcs('Fonts')[0] || 'Resources/Fonts.xml');
  if (fontsDoc) for (const ff of Array.from(fontsDoc.getElementsByTagName('FontFamily'))) addFont(ff.getAttribute('Name') || '');
  if (!fontFamilies.length) for (const s of Object.values(stories)) addFont(s.font);

  // Linked images - count distinct linked resources across every spread (an .idml
  // stores their URIs, never the bytes).
  const linkedUris = new Set<string>();
  for (const src of spreadSrcs) {
    const d = xml(src);
    if (!d) continue;
    for (const link of Array.from(d.getElementsByTagName('Link'))) {
      const uri = link.getAttribute('LinkResourceURI');
      if (uri) linkedUris.add(uri);
    }
  }

  const nodeCache = new Map<number, { nodes: IdmlNode[]; width: number; height: number }>();
  const spreadNodes = (i: number): { nodes: IdmlNode[]; width: number; height: number } => {
    const hit = nodeCache.get(i);
    if (hit) return hit;
    const doc = xml(spreadSrcs[i]!);
    const el = doc && innerElement(doc, 'Spread');
    const ctx: Ctx = { nodes: [], swatches, stories, seen: { group: 0 }, warn: () => {} };
    if (el) for (const child of Array.from(el.children)) walkItem(child, IDENTITY, '', ctx);
    const { width, height } = shiftToOrigin(ctx.nodes);
    const out = { nodes: ctx.nodes, width: width || 1, height: height || 1 };
    nodeCache.set(i, out);
    return out;
  };

  const palette: string[] = [];
  const seenHex = new Set<string>();
  for (const hex of Object.values(swatches)) {
    if (hex && !seenHex.has(hex)) { seenHex.add(hex); palette.push(hex); }
  }

  return {
    pageCount: spreadSrcs.length,
    async pageToSvg(i: number): Promise<PdfPageSvg> {
      const { nodes, width, height } = spreadNodes(i);
      return { svg: idmlNodesToSvg(nodes, width, height), width, height, elementCount: nodes.length };
    },
    pageToText(i: number): PageText {
      const { nodes } = spreadNodes(i);
      const blocks: TextBlock[] = [];
      for (const n of nodes) {
        if (n.kind !== 'text') continue;
        const txt = (n.text || '').trim();
        if (!txt) continue;
        blocks.push({ kind: 'paragraph', text: txt, size: n.fontSize || 0, bold: (n.fontWeight || 400) >= 600, column: 0 });
      }
      if (!blocks.length) return emptyPage();
      const text = blocks.map((b) => b.text).join('\n\n');
      return { blocks, text, markdown: text, columns: 1, scanned: false, rotated: 0, order: 'geometric' };
    },
    listPalette(): string[] {
      return palette;
    },
    listFonts(): EmbeddedFont[] {
      return fontFamilies.map(namesOnlyFont);
    },
    listImages(): Promise<EmbeddedImageScan> {
      return Promise.resolve({ images: [], skipped: linkedUris.size, skippedFilters: [] });
    },
  };
}
