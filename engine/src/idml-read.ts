// SPDX-License-Identifier: MPL-2.0
/** Bounded IDML parts into editable Design frames, using injected XML and asset IO. */
import { boxGeomFromBBox, safeColor, mapAlign, finalizeBoxes, type DesignMapOptions } from './design-map.ts';
import { readAdobeXml, type AdobeXmlParser } from './adobe-xml.ts';
import { designTextOf } from './design-text.ts';
import { strFromU8 } from 'fflate';
import type { SourceParaV1, AssetRef } from '@lolly-tools/core';
interface M { a: number; b: number; c: number; d: number; e: number; f: number; }
interface StoryStyle { text: string; fontSize: number; fg: string; font: string; weight: number; align: string; }
export interface IdmlNode {
  kind: 'box' | 'text' | 'image';
  image?: AssetRef;
  _imagePath?: string;
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
export interface ImportResult { boxes: object[]; width: number; height: number; background: string; }
export interface IdmlOptions { warn?: (msg: string) => void; map?: DesignMapOptions; linkedFiles?: Record<string, Uint8Array>; storeImage?: (path: string, bytes: Uint8Array) => Promise<AssetRef | null> }

const IDENTITY: M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const ITEM_TAGS = new Set(['Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'TextFrame', 'Group']);

/**
 * Parse an unzipped IDML package into a Design boxes array.
 * @param files unzipped entries (path → bytes)
 */
export async function readIdmlSpreads(files: Record<string, Uint8Array>, parse: AdobeXmlParser, { warn = () => {}, map, linkedFiles = {}, storeImage }: IdmlOptions = {}): Promise<(ImportResult & { name: string; nodes: IdmlNode[] })[]> {
  if (Object.keys(files).length > 4096 || Object.values(files).reduce((n, b) => n + b.length, 0) > 128 * 1024 * 1024) throw new Error('IDML package exceeds the import limits.');
  const xml = (path: string): Document | null => {
    const b = files[path];
    if (!b) return null;
    try {
      return readAdobeXml(strFromU8(b), parse, 8 * 1024 * 1024);
    } catch (error) { throw new Error(`Invalid IDML XML part ${path}: ${String(error)}`); }
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
  const styles = new Map<string, Element>();
  const stylesDoc = xml(pkgSrcs('Styles')[0] || 'Resources/Styles.xml');
  if (stylesDoc) for (const el of elems(stylesDoc)) if (el.hasAttribute('Self')) styles.set(el.getAttribute('Self')!, el);
  const stories: Record<string, StoryStyle> = Object.create(null);
  for (const src of pkgSrcs('Story')) { const d = xml(src); if (d) parseStories(d, swatches, stories, styles, warn); }

  if (spreadSrcs.length > 256) throw new Error('IDML contains more than 256 spreads.');
  const frames: (ImportResult & { name: string; nodes: IdmlNode[] })[] = [];
  const images = new Map<string, AssetRef | null>(); let totalItems = 0;
  for (const [index, src] of spreadSrcs.entries()) {
    const spreadDoc = xml(src), spreadEl = spreadDoc && innerElement(spreadDoc, 'Spread');
    if (!spreadEl) throw new Error(`Could not read IDML spread ${index + 1}.`);
    const ctx: Ctx = { nodes: [], swatches, stories, seen: { group: 0 }, warn };
    for (const child of Array.from(spreadEl.children)) walkItem(child, IDENTITY, '', ctx);
    if (ctx.nodes.length > 10000) throw new Error('IDML spread exceeds the item limit.');
    totalItems += ctx.nodes.length; if (totalItems > 100000) throw new Error('IDML document exceeds the total item limit.');
    for (const node of ctx.nodes) if (node._imagePath) {
      const path = node._imagePath.replace(/^file:\/\//i, '').replace(/^\.\//, '');
      const bytes = Object.hasOwn(linkedFiles, node._imagePath) ? linkedFiles[node._imagePath] : Object.hasOwn(files, path) ? files[path] : undefined;
      if (bytes && bytes.length > 64 * 1024 * 1024) throw new Error('IDML linked image exceeds 64 MB.');
      if (bytes && storeImage) {
        const name = path.split('/').pop() || 'image.png';
        if (!images.has(path)) images.set(path, await storeImage(path, bytes));
        const ref = images.get(path);
        if (ref && (ref.type === 'raster' || ref.type === 'vector')) { node.kind = 'image'; node.image = ref; }
        else warn(`Image ${name} could not be imported.`);
      } else warn(`Missing linked image: ${node._imagePath}. Supply its bytes to replace the placeholder.`);
    }
    const pages = Array.from(spreadEl.children).filter(el => el.localName === 'Page').map(el => {
      const bounds = (el.getAttribute('GeometricBounds') || '').split(/\s+/).map(Number);
      if (bounds.length !== 4 || bounds.some(n => !Number.isFinite(n))) return null;
      return boxGeomFromBBox({ x: bounds[1]!, y: bounds[0]!, width: bounds[3]! - bounds[1]!, height: bounds[2]! - bounds[0]! }, parseItemTransform(el));
    }).filter((p): p is NonNullable<typeof p> => p !== null);
    let size: { width: number; height: number };
    if (pages.length) {
      const x = Math.min(...pages.map(p => p.x)), y = Math.min(...pages.map(p => p.y));
      size = { width: Math.max(1, Math.round(Math.max(...pages.map(p => p.x + p.w)) - x)), height: Math.max(1, Math.round(Math.max(...pages.map(p => p.y + p.h)) - y)) };
      for (const node of ctx.nodes) { node.x -= x; node.y -= y; }
    } else size = shiftToOrigin(ctx.nodes);
    if (!Number.isFinite(size.width * size.height) || size.width * size.height > 32000000 || ctx.nodes.some(node => ![node.x, node.y, node.w, node.h, node.rot].every(Number.isFinite))) throw new Error('IDML spread geometry exceeds the preview limits.');
    frames.push({ ...size, nodes: ctx.nodes, name: `Spread ${index + 1}`, boxes: finalizeBoxes(ctx.nodes, { prefix: `d${index}-`, ...map }), background: '#ffffff' });
  }
  return frames;
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
    const link = Array.from(el.getElementsByTagName('Link'))[0];
    ctx.nodes.push({ kind: 'box', ...base, fill: fill || '#eef1f0', _imagePath: link?.getAttribute('LinkResourceURI') || '' });
    if (!link) ctx.warn('A placed graphic has no readable link and remains a placeholder.');
    return;
  }

  const node: IdmlNode = { kind: 'box', ...base, fill };
  if (tag === 'Oval') node.shape = 'ellipse';
  ctx.nodes.push(node);
}

// ── geometry ──────────────────────────────────────────────────────────────────

function parseItemTransform(el: Element): M {
  const t = (el.getAttribute('ItemTransform') || '').trim().split(/\s+/).map(Number);
  if (t.length < 6 || t.some((n) => !Number.isFinite(n))) return IDENTITY;
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
    if (a.length < 2 || !Number.isFinite(a[0]!) || !Number.isFinite(a[1]!)) continue;
    minX = Math.min(minX, a[0]!); maxX = Math.max(maxX, a[0]!);
    minY = Math.min(minY, a[1]!); maxY = Math.max(maxY, a[1]!);
  }
  if (!Number.isFinite(minX)) return null;
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
  if (!Number.isFinite(minX)) return { width: 1080, height: 1080 };
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
  if (v.some((n) => !Number.isFinite(n))) return '';
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

function parseStories(doc: Document, swatches: Record<string, string>, out: Record<string, StoryStyle>, styles: ReadonlyMap<string, Element> = new Map(), warn: (message: string) => void = () => {}): void {
  for (const story of Array.from(doc.getElementsByTagName('Story'))) {
    const self = story.getAttribute('Self');
    if (!self) continue;
    const paras: SourceParaV1[] = [];
    let fontSize = 0, fg = '', font = '', weight = 0, align = '';
    for (const psr of Array.from(story.getElementsByTagName('ParagraphStyleRange'))) {
      const ps = styles.get(psr.getAttribute('AppliedParagraphStyle') || '');
      const paragraphAlign = mapAlign(justificationToAlign(psr.getAttribute('Justification') || ps?.getAttribute('Justification') || null));
      if (!align) align = paragraphAlign;
      const para: SourceParaV1 = { runs: [], align: paragraphAlign };
      for (const csr of Array.from(psr.getElementsByTagName('CharacterStyleRange'))) {
        const cs = styles.get(csr.getAttribute('AppliedCharacterStyle') || '');
        const attr = (key: string) => csr.getAttribute(key) || cs?.getAttribute(key) || psr.getAttribute(key) || ps?.getAttribute(key) || '';
        const size = parseFloat(attr('PointSize')) || 0, color = safeColor(resolveColor(attr('FillColor'), swatches), '');
        const family = fontFamilyOf(csr) || (cs ? fontFamilyOf(cs) : '') || (ps ? fontFamilyOf(ps) : ''), style = attr('FontStyle');
        if (!fontSize) fontSize = size;
        if (!fg) fg = color;
        if (!font) font = family;
        if (!weight) weight = weightFromFontStyle(style);
        let text = '';
        for (const child of Array.from(csr.childNodes)) {
          if (child.nodeType === 1 && (child as Element).localName === 'Content') text += child.textContent || '';
          else if (child.nodeType === 1 && (child as Element).localName === 'Br') text += '\n';
        }
        if (text) para.runs.push({ text, bold: /Bold|Black|Heavy/i.test(style), italic: /Italic|Oblique/i.test(style), underline: attr('Underline') === 'true', strike: attr('StrikeThru') === 'true', ...(size ? { sizePt: size } : {}), ...(family ? { font: family } : {}), ...(color ? { color: { hex: color } } : {}) });
      }
      const last = para.runs.at(-1); if (last?.text.endsWith('\n')) last.text = last.text.slice(0, -1);
      paras.push(para);
    }
    if (paras.some(para => para.runs.some(run => !run.bold && run.text.trim()))) weight = 400;
    const formatted = designTextOf(paras, { carryColour: true, rowWeight: weight || 400 });
    if (formatted.dropped.length) warn(`Story ${self}: unsupported formatting ${formatted.dropped.join(', ')}.`);
    if (story.getElementsByTagName('Table').length || story.getElementsByTagName('Footnote').length) warn(`Story ${self}: tables and footnotes are reduced to supported text runs.`);
    out[self] = { text: formatted.text, fontSize, fg, font, weight, align };
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


export { parseSwatches as idmlSwatches, parseStories as idmlStories };
