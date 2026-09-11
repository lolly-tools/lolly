// SPDX-License-Identifier: MPL-2.0
/**
 * ASCII mockups - a structural wireframe of a designer tool's layout, drawn with
 * box-drawing characters so you can judge composition and positioning in the terminal
 * WITHOUT a browser or a raster. Two paths, auto-selected:
 *
 *  • Spatial (SVG tools - chart, badge-on-svg, pose-geeko, diagram): read the viewBox,
 *    scale every positioned shape/text into a character grid, and draw shaded boxes where
 *    the graphics sit + the actual text where the text sits. This is true positioning.
 *  • Structural (HTML-layout tools - event badge, wayfinding, lockup): jsdom computes no
 *    layout, so instead draw the DOM's container hierarchy as NESTED labelled boxes - a
 *    document-outline wireframe (header / body / footer …) that still conveys the shape.
 *
 * Terminal cells are ~twice as tall as wide, so the spatial path compensates (CELL_ASPECT)
 * to keep proportions readable rather than squashed.
 */
import { cssToHex } from './html-render.ts';

const CELL_ASPECT = 2;   // a character cell is ~2× taller than wide

type El = {
  tagName: string;
  getAttribute(n: string): string | null;
  textContent: string | null;
  childNodes: ArrayLike<Node> & Iterable<Node>;
};

// ── shared grid ──────────────────────────────────────────────────────────────
class Grid {
  private g: string[][];
  constructor(public cols: number, public rows: number) {
    this.g = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ' '));
  }
  set(r: number, c: number, ch: string): void {
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols || !ch) return;
    this.g[r]![c] = ch;
  }
  box(r0: number, c0: number, r1: number, c1: number): void {
    if (c1 - c0 < 1 || r1 - r0 < 1) { this.set(r0, c0, '▪'); return; }
    for (let c = c0 + 1; c < c1; c++) { this.set(r0, c, '─'); this.set(r1, c, '─'); }
    for (let r = r0 + 1; r < r1; r++) { this.set(r, c0, '│'); this.set(r, c1, '│'); }
    this.set(r0, c0, '┌'); this.set(r0, c1, '┐'); this.set(r1, c0, '└'); this.set(r1, c1, '┘');
  }
  fill(r0: number, c0: number, r1: number, c1: number, ch: string): void {
    if (ch === ' ') return;
    for (let r = Math.max(0, r0 + 1); r < r1; r++) for (let c = Math.max(0, c0 + 1); c < c1; c++) if (this.g[r]![c] === ' ') this.set(r, c, ch);
  }
  text(r: number, c: number, s: string): void {
    const t = s.replace(/\s+/g, ' ').trim();
    for (let i = 0; i < t.length; i++) this.set(r, c + i, t[i]!);
  }
  lines(): string[] { return this.g.map((row) => row.join('').replace(/\s+$/, '')); }
}

/** A fill colour → a shade block by luminance (transparent/none → blank). */
function shade(fill: string | null): string {
  if (!fill || fill === 'none' || fill === 'transparent') return ' ';
  const hex = cssToHex(fill);
  if (!hex) return '░';
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.8 ? '░' : lum > 0.55 ? '▒' : lum > 0.25 ? '▓' : '█';
}

// ── spatial (SVG) ────────────────────────────────────────────────────────────
interface Xform { tx: number; ty: number; sx: number; sy: number }
const IDENT: Xform = { tx: 0, ty: 0, sx: 1, sy: 1 };

/** Parse the translate()/scale() out of a transform attribute (rotation ignored). */
function parseXform(attr: string | null, base: Xform): Xform {
  let { tx, ty, sx, sy } = base;
  if (attr) {
    const t = attr.match(/translate\(\s*([-\d.]+)[,\s]*([-\d.]+)?/);
    const s = attr.match(/scale\(\s*([-\d.]+)[,\s]*([-\d.]+)?/);
    if (t) { tx += sx * parseFloat(t[1]!); ty += sy * (t[2] ? parseFloat(t[2]) : 0); }
    if (s) { const a = parseFloat(s[1]!); sx *= a; sy *= s[2] ? parseFloat(s[2]) : a; }
  }
  return { tx, ty, sx, sy };
}
const num = (el: El, n: string, d = 0): number => { const v = parseFloat(el.getAttribute(n) ?? ''); return Number.isFinite(v) ? v : d; };

interface Shape { x: number; y: number; w: number; h: number; fill: string | null; text?: string; area: number }

/** Local bounding box of a leaf element (before the accumulated transform). */
function localBox(el: El): { x: number; y: number; w: number; h: number } | null {
  switch (el.tagName.toLowerCase()) {
    case 'rect': case 'image': case 'use': case 'foreignobject':
      return { x: num(el, 'x'), y: num(el, 'y'), w: num(el, 'width'), h: num(el, 'height') };
    case 'circle': { const r = num(el, 'r'); return { x: num(el, 'cx') - r, y: num(el, 'cy') - r, w: 2 * r, h: 2 * r }; }
    case 'ellipse': { const rx = num(el, 'rx'), ry = num(el, 'ry'); return { x: num(el, 'cx') - rx, y: num(el, 'cy') - ry, w: 2 * rx, h: 2 * ry }; }
    default: return null;
  }
}

/** Collect positioned shapes + text from an SVG, applying nested translate/scale. */
function collectSvg(root: El): { shapes: Shape[]; vb: [number, number, number, number] } | null {
  // find the <svg> and its viewBox
  let svg: El | null = root.tagName.toLowerCase() === 'svg' ? root : null;
  if (!svg) { for (const n of descend(root)) if (n.tagName.toLowerCase() === 'svg') { svg = n; break; } }
  if (!svg) return null;
  const vbAttr = svg.getAttribute('viewBox');
  let vb: [number, number, number, number];
  if (vbAttr) { const p = vbAttr.trim().split(/[\s,]+/).map(Number); if (p.length !== 4 || p.some(x => !Number.isFinite(x)) || p[2]! <= 0 || p[3]! <= 0) return null; vb = p as [number, number, number, number]; }
  else { const w = num(svg, 'width'), h = num(svg, 'height'); if (w <= 0 || h <= 0) return null; vb = [0, 0, w, h]; }

  const shapes: Shape[] = [];
  const NODE_ELEMENT = 1, NODE_TEXT = 3;
  const walk = (node: El, xf: Xform): void => {
    for (const child of Array.from(node.childNodes) as Array<Node & Partial<El>>) {
      if (child.nodeType !== NODE_ELEMENT) continue;
      const el = child as unknown as El;
      const tag = el.tagName.toLowerCase();
      if (tag === 'defs' || tag === 'clippath' || tag === 'mask' || tag === 'style' || tag === 'lineargradient' || tag === 'radialgradient') continue;
      const xf2 = parseXform(el.getAttribute('transform'), xf);
      if (tag === 'text' || tag === 'tspan') {
        const t = directText(el);
        if (t) { const x = xf2.tx + xf2.sx * num(el, 'x'), y = xf2.ty + xf2.sy * num(el, 'y'); shapes.push({ x, y, w: t.length, h: 1, fill: null, text: t, area: 0 }); }
        walk(el, xf2);
        continue;
      }
      const lb = localBox(el);
      if (lb && lb.w > 0 && lb.h > 0) {
        const x = xf2.tx + xf2.sx * lb.x, y = xf2.ty + xf2.sy * lb.y, w = xf2.sx * lb.w, h = xf2.sy * lb.h;
        shapes.push({ x, y, w, h, fill: el.getAttribute('fill'), area: w * h });
      }
      walk(el, xf2);
    }
  };
  walk(svg, IDENT);
  return shapes.length ? { shapes, vb } : null;
}

/** Draw the collected shapes into a character grid sized to (cols × rows). */
function drawSpatial(data: { shapes: Shape[]; vb: [number, number, number, number] }, cols: number, rows: number): string[] {
  const [minX, minY, vbW, vbH] = data.vb;
  const innerC = Math.max(2, cols - 1), innerR = Math.max(2, rows - 1);
  // fit the viewBox into the grid, compensating for tall cells, preserving aspect
  const s = Math.min(innerC / vbW, (innerR * CELL_ASPECT) / vbH);
  const toC = (x: number): number => Math.round((x - minX) * s);
  const toR = (y: number): number => Math.round((y - minY) * s / CELL_ASPECT);
  const grid = new Grid(cols, rows);
  // big shapes first so small ones land on top; skip the full-canvas background
  const boxes = data.shapes.filter(s2 => !s2.text).sort((a, b) => b.area - a.area);
  const canvasArea = vbW * vbH;
  for (const b of boxes) {
    if (b.area >= canvasArea * 0.92 && shade(b.fill) === ' ') continue;   // transparent full-canvas frame: skip
    const c0 = toC(b.x), r0 = toR(b.y), c1 = toC(b.x + b.w), r1 = toR(b.y + b.h);
    grid.fill(r0, c0, r1, c1, shade(b.fill));
    grid.box(r0, c0, r1, c1);
  }
  for (const t of data.shapes) if (t.text) grid.text(toR(t.y), toC(t.x), t.text);
  return grid.lines();
}

// ── structural (HTML) ─────────────────────────────────────────────────────────
const CONTAINER = new Set(['div', 'section', 'header', 'footer', 'main', 'nav', 'article', 'aside', 'form', 'figure', 'ul', 'ol', 'table', 'p']);
const HEADING = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'legend', 'caption', 'figcaption']);
// Non-visual elements never contribute a box or a label (else CSS/JS text leaks in).
const NONVISUAL = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'head', 'title', 'svg', 'defs', 'br', 'hr']);
const visualChildren = (el: El): El[] => elementChildren(el).filter(k => !NONVISUAL.has(k.tagName.toLowerCase()));

/** First short piece of text anywhere under `el` (breadth-first), for labelling. */
function firstText(el: El, budget = 40): string {
  const q: El[] = [el];
  while (q.length) {
    const n = q.shift()!;
    const own = directText(n);
    if (own) return trunc(own, budget);
    for (const c of visualChildren(n)) q.push(c);
  }
  return '';
}

/** A short label for a structural box: aria/heading/own text/first descendant text/tag. */
function boxLabel(el: El): string {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  for (const n of visualChildren(el)) if (HEADING.has(n.tagName.toLowerCase())) { const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim(); if (t) return t; }
  const own = directText(el);
  if (own) return own;
  const deep = firstText(el);
  if (deep) return deep;
  const cls = (el.getAttribute('class') ?? '').split(/\s+/)[0];
  return cls || el.tagName.toLowerCase();
}

/** Skip past pure single-child wrappers so boxes carry real content, not <div><div>… */
function unwrap(el: El): El {
  let cur = el, guard = 0;
  while (guard++ < 6) {
    const kids = visualChildren(cur);
    if (kids.length === 1 && !directText(cur) && CONTAINER.has(cur.tagName.toLowerCase())) cur = kids[0]!;
    else break;
  }
  return cur;
}

/** Render the DOM container hierarchy as nested labelled boxes (2 levels deep). */
function drawStructural(body: El, cols: number, rows: number): string[] {
  const grid = new Grid(cols, rows);
  const root = unwrap(body);
  // top-level visual blocks become stacked rows; each direct container child becomes a
  // sub-box laid left→right inside it.
  const list = visualChildren(root).filter(el => CONTAINER.has(el.tagName.toLowerCase()) || HEADING.has(el.tagName.toLowerCase()) || directText(el).length > 0);
  const rowsList = (list.length ? list : visualChildren(root)).slice(0, Math.max(1, Math.floor((rows - 1) / 2)));
  if (!rowsList.length) return grid.lines();
  const each = Math.max(2, Math.floor((rows - 1) / rowsList.length));
  let r = 0;
  for (const raw of rowsList) {
    if (r + 2 > rows) break;
    const el = unwrap(raw);
    const r1 = Math.min(rows - 1, r + each - 1);
    grid.box(r, 0, r1, cols - 1);
    grid.text(r, 2, ` ${trunc(boxLabel(el), cols - 6)} `);
    const kids = visualChildren(el).filter(k => CONTAINER.has(k.tagName.toLowerCase()) || HEADING.has(k.tagName.toLowerCase()));
    if (kids.length > 1 && r1 - r >= 3) {
      const w = Math.max(8, Math.floor((cols - 4) / Math.min(kids.length, 4)));
      let c = 2;
      for (const k of kids.slice(0, 4)) {
        if (c + w > cols - 2) break;
        const uk = unwrap(k);
        grid.box(r + 1, c, r1 - 1, c + w - 1);
        grid.text(r + 1, c + 1, trunc(boxLabel(uk), w - 2));
        c += w + 1;
      }
    }
    r = r1 + 1;
  }
  return grid.lines();
}

// ── helpers ────────────────────────────────────────────────────────────────────
function* descend(el: El): Generator<El> {
  for (const c of Array.from(el.childNodes) as Array<Node & Partial<El>>) {
    if (c.nodeType === 1) { const e = c as unknown as El; yield e; yield* descend(e); }
  }
}
function elementChildren(el: El): El[] {
  return (Array.from(el.childNodes) as Array<Node & Partial<El>>).filter(n => n.nodeType === 1).map(n => n as unknown as El);
}
/** Concatenated DIRECT text (not descendants') of an element, collapsed. */
function directText(el: El): string {
  let out = '';
  for (const n of Array.from(el.childNodes) as Array<Node & { nodeType: number; textContent: string | null }>) if (n.nodeType === 3) out += n.textContent ?? '';
  return out.replace(/\s+/g, ' ').trim();
}
const trunc = (s: string, n: number): string => (s.length > n ? s.slice(0, Math.max(0, n - 1)) + '…' : s);

/**
 * Build an ASCII layout mockup of a tool's hydrated body. Prefers the spatial SVG
 * wireframe; falls back to the structural DOM outline. Returns [] if there's nothing.
 */
export function buildMockup(body: El, cols: number, rows: number): string[] {
  const c = Math.max(8, cols), r = Math.max(4, rows);
  try {
    const svg = collectSvg(body);
    if (svg) return drawSpatial(svg, c, r);
  } catch { /* fall through to structural */ }
  try { return drawStructural(body, c, r); } catch { return []; }
}
