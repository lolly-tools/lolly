// SPDX-License-Identifier: MPL-2.0
/** Bounded IDML parts into editable Design frames, using injected XML and asset IO. */
import { boxGeomFromBBox, finalizeBoxes, type DesignMapOptions } from './design-map.ts';
import { readAdobeXml, type AdobeXmlParser } from './adobe-xml.ts';
import { strFromU8 } from 'fflate';
import { StyleBook, tally, statsNotes, tintHex, type IdmlStats } from './idml-styles.ts';
import { buildText, type StoryStyle, type TextEnv } from './idml-text.ts';
import { tableNodes, type TableBudget } from './idml-table.ts';
import { applyAppearance, objectAttrs } from './idml-object.ts';
import { MasterBook, pageRect, type Rect } from './idml-master.ts';
import type { AssetRef } from '@lolly-tools/core';
interface M { a: number; b: number; c: number; d: number; e: number; f: number; }
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
  pad?: number;
  radius?: number;
  opacity?: number;
  blend?: string;
  strokeDash?: string;
  stroke?: string;
  strokeW?: number;
  strokeAlign?: 'inside' | 'center' | 'outside';
  strokeTop?: number;
  strokeRight?: number;
  strokeBottom?: number;
  strokeLeft?: number;
  lineHeight?: number;
  tracking?: number;
  /** An empty text frame: kept on a page, not copied from a master. */
  empty?: boolean;
}
interface Ctx {
  nodes: IdmlNode[];
  swatches: Record<string, string>;
  stories: Record<string, StoryStyle>;
  seen: { group: number };
  warn: (msg: string) => void;
  book: StyleBook;
  stats: IdmlStats;
  /** Stories already placed in a frame, so threaded frames do not repeat them. */
  used: Set<string>;
  tables: TableBudget;
  env: TextEnv;
}
export interface ImportResult { boxes: object[]; width: number; height: number; background: string; }
export interface IdmlOptions { warn?: (msg: string) => void; stats?: IdmlStats; map?: DesignMapOptions; linkedFiles?: Record<string, Uint8Array>; storeImage?: (path: string, bytes: Uint8Array) => Promise<AssetRef | null> }

const IDENTITY: M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
const ITEM_TAGS = new Set(['Rectangle', 'Oval', 'Polygon', 'GraphicLine', 'TextFrame', 'Group']);

/**
 * Parse an unzipped IDML package into a Design boxes array.
 * @param files unzipped entries (path → bytes)
 */
export async function readIdmlSpreads(files: Record<string, Uint8Array>, parse: AdobeXmlParser, { warn = () => {}, map, linkedFiles = {}, storeImage, stats = {} }: IdmlOptions = {}): Promise<(ImportResult & { name: string; nodes: IdmlNode[] })[]> {
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
  const book = new StyleBook(xml(pkgSrcs('Styles')[0] || 'Resources/Styles.xml'));
  const stories: Record<string, StoryStyle> = Object.create(null);
  for (const src of pkgSrcs('Story')) { const d = xml(src); if (d) parseStories(d, swatches, stories, book, warn, stats); }

  const masterEntries = pkgSrcs('MasterSpread').flatMap(src => {
    const doc = xml(src), el = doc && innerElement(doc, 'MasterSpread');
    return el ? [{ id: el.getAttribute('Self') || '', el }] : [];
  });
  const env: TextEnv = { book, warn, stats, colour: (ref, tint) => tintHex(resolveColor(ref ?? null, swatches), tint) };
  const shared = { used: new Set<string>(), tables: { cells: 0 } as TableBudget, env };
  const masterGroups = { group: 0 };
  const masters = new MasterBook(masterEntries, el => pageRect(el, parseItemTransform(el)), item => {
    const mctx: Ctx = { nodes: [], swatches, stories, seen: masterGroups, warn, book, stats, ...shared };
    walkItem(item, IDENTITY, '', mctx);
    return mctx.nodes;
  });
  if (spreadSrcs.length > 256) throw new Error('IDML contains more than 256 spreads.');
  const frames: (ImportResult & { name: string; nodes: IdmlNode[] })[] = [];
  const images = new Map<string, AssetRef | null>(); let totalItems = 0;
  for (const [index, src] of spreadSrcs.entries()) {
    const spreadDoc = xml(src), spreadEl = spreadDoc && innerElement(spreadDoc, 'Spread');
    if (!spreadEl) throw new Error(`Could not read IDML spread ${index + 1}.`);
    const ctx: Ctx = { nodes: [], swatches, stories, seen: { group: 0 }, warn, book, stats, ...shared };
    for (const child of Array.from(spreadEl.children)) walkItem(child, IDENTITY, '', ctx);
    const pageEls = Array.from(spreadEl.children).filter(el => el.localName === 'Page');
    const pageRects = pageEls.map(el => pageRect(el, parseItemTransform(el)));
    if (masters.size > 0 && spreadEl.getAttribute('ShowMasterItems') !== 'false') {
      const below: IdmlNode[] = [];
      pageEls.forEach((el, i) => {
        const rect = pageRects[i], id = el.getAttribute('AppliedMaster') || '';
        if (rect && masters.has(id)) below.push(...masters.place(id, rect, new Set((el.getAttribute('OverrideList') || '').split(/\s+/).filter(Boolean)), stats));
      });
      ctx.nodes = [...below, ...ctx.nodes];
    }
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
    const pages = pageRects.filter((p): p is Rect => p !== null);
    let size: { width: number; height: number };
    if (pages.length) {
      const x = Math.min(...pages.map(p => p.x)), y = Math.min(...pages.map(p => p.y));
      size = { width: Math.max(1, Math.round(Math.max(...pages.map(p => p.x + p.w)) - x)), height: Math.max(1, Math.round(Math.max(...pages.map(p => p.y + p.h)) - y)) };
      for (const node of ctx.nodes) { node.x -= x; node.y -= y; }
    } else size = shiftToOrigin(ctx.nodes);
    if (!Number.isFinite(size.width * size.height) || size.width * size.height > 32000000 || ctx.nodes.some(node => ![node.x, node.y, node.w, node.h, node.rot].every(Number.isFinite))) throw new Error('IDML spread geometry exceeds the preview limits.');
    frames.push({ ...size, nodes: ctx.nodes, name: `Spread ${index + 1}`, boxes: finalizeBoxes(ctx.nodes, { prefix: `d${index}-`, ...map }), background: '#ffffff' });
  }
  if (book.truncated) tally(stats, 'style.chain-cut', 'approximated', book.truncated);
  for (const note of statsNotes(stats)) warn(note);
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
  const attrs = objectAttrs(el, ctx.book);
  const push = (node: IdmlNode): void => {
    applyAppearance(node, tag, attrs, ctx.env.colour, ctx.stats);
    if (node.kind === 'box' && node.empty && (node.fill || node.stroke)) delete node.empty;
    ctx.nodes.push(node);
  };

  if (tag === 'TextFrame') {
    const storyId = el.getAttribute('ParentStory') || '';
    const story = ctx.stories[storyId];
    if (story && !ctx.used.has(storyId) && ((story.text || '').trim() || story.tables?.length)) {
      ctx.used.add(storyId);
      if ((story.text || '').trim()) push({
        kind: 'text', ...base,
        text: story.text,
        fg: story.fg || '#0c322c',
        fontSize: story.fontSize || 24,
        fontFamily: story.font || '',
        fontWeight: story.weight || 400,
        textAlign: story.align || 'left',
        ...(story.lineHeight ? { lineHeight: story.lineHeight } : {}),
        ...(story.tracking ? { tracking: story.tracking } : {}),
      });
      let cursor = 0;
      for (const [i, t] of (story.tables ?? []).entries()) {
        const size = story.fontSize || 12, lines = Math.max(t.before, Math.ceil(t.chars * size * 0.5 / Math.max(1, geom.w)));
        const y = base.y + Math.max(cursor, lines * size * (story.lineHeight || 1.2));
        const made = tableNodes(t.el, { x: base.x, y, group: `${group || 'table'}-${++ctx.seen.group}-${i}` }, ctx.env, ctx.tables);
        ctx.nodes.push(...made.nodes); cursor = y - base.y + made.height;
      }
      return;
    }
    if (story && ctx.used.has(storyId)) tally(ctx.stats, 'text.threaded', 'approximated');
    push({ kind: 'box', ...base, fill: '', empty: true }); // empty frame
    return;
  }

  // A frame that only exists to hold a (linked) image → placeholder box; IDML links
  // images externally, so the raster itself isn't in the package.
  if (hasPlacedContent(el)) {
    const link = Array.from(el.getElementsByTagName('Link'))[0];
    const node: IdmlNode = { kind: 'box', ...base, fill: '', _imagePath: link?.getAttribute('LinkResourceURI') || '' };
    push(node);
    if (!node.fill) node.fill = '#eef1f0';
    if (!link) ctx.warn('A placed graphic has no readable link and remains a placeholder.');
    return;
  }

  const node: IdmlNode = { kind: 'box', ...base, fill: '' };
  if (tag === 'Oval') node.shape = 'ellipse';
  push(node);
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
  // A gradient is approximated by its first stop.
  for (const g of Array.from(doc.getElementsByTagName('Gradient'))) {
    const self = g.getAttribute('Self'); const stop = Array.from(g.children).find(c => c.localName === 'GradientStop');
    const base = stop?.getAttribute('StopColor');
    if (self && base && map[base]) map[self] = map[base]!;
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

function parseStories(doc: Document, swatches: Record<string, string>, out: Record<string, StoryStyle>, book: StyleBook = new StyleBook(null), warn: (message: string) => void = () => {}, stats?: IdmlStats): void {
  const colour = (ref: string | undefined, tint: number | undefined) => tintHex(resolveColor(ref ?? null, swatches), tint);
  for (const story of Array.from(doc.getElementsByTagName('Story'))) {
    const self = story.getAttribute('Self');
    if (!self) continue;
    out[self] = buildText(story, { book, colour, warn, stats });
  }
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
