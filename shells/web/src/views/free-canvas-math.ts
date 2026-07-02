// free-canvas-math.ts — DOM-free geometry for the WYSIWYG "editor" layout.
//
// The web shell's free-canvas overlay (free-canvas.js) does the DOM here; ALL
// coordinate math lives in this module so it can be unit-tested at the repo root,
// exactly like block-tree.ts does for nested blocks. Everything operates on FLAT
// array "box" objects (one row of a `blocks` input) plus a `cfg` describing
// which sub-fields carry the geometry (from the input's `canvas` flag). Functions are
// pure: they read boxes, return NEW boxes / arrays, and never touch the DOM.
//
// Coordinate space: box x/y/w/h are in CANVAS (native render) pixels; the box is
// the axis-aligned rectangle [x, x+w] × [y, y+h] BEFORE rotation, with `rot`
// degrees applied clockwise about the box's centre (matching the CSS
// `transform: rotate()` default centre transform-origin). Screen↔native
// mapping is the shell's job (it reads the live getBoundingClientRect); this
// module works purely in native pixels.

import type { InputValue } from '@lolly/engine';

/** A flat row of a `blocks` input, keyed by field id — the shape of one "box". */
export type Box = { [key: string]: InputValue | undefined };

/** Which sub-fields of a box carry its geometry (from the input's `canvas` flag). */
export interface BoxFieldConfig {
  idField: string;
  xField: string;
  yField: string;
  wField: string;
  hField: string;
  rotationField: string;
  fontSizeField?: string;
  radiusField?: string;
}

/** A box's geometry, resolved to finite numbers. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot: number;
}

/** Partial geometry to write back via {@link withRect} — only present fields change. */
export type PartialRect = { x?: number; y?: number; w?: number; h?: number; rot?: number };

/** A world-space (native px) point. */
export interface Point {
  x: number;
  y: number;
}

/** An axis-aligned bounding box (world px), plus its size for convenience. */
export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
}

/** A native-px rectangle in x/y/w/h form (e.g. a marquee-select drag). */
export interface MarqueeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The artboard's native-px size. */
export interface Canvas {
  w: number;
  h: number;
}

/** A guide line segment to draw (native px), reported by the snap helpers. */
export interface Guide {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Result of {@link snapMove}: the extra translation, plus guides to draw. */
export interface SnapMoveResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

/** Result of {@link snapPoint}: the snapped point, plus guides to draw. */
export interface SnapPointResult {
  x: number;
  y: number;
  guides: Guide[];
}

/** A resize-handle name — the 8 compass points around a box. */
export type HandleName = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Options for {@link resizeRect}. */
export interface ResizeOpts {
  minSize?: number;
  keepAspect?: boolean;
  fromCentre?: boolean;
}

/** Options for {@link scaleGroup}. */
export interface ScaleOpts {
  minSize?: number;
}

/** The rect a resize gesture started from — `rot` may be absent (treated as 0). */
export interface StartRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
}

/** Which artboard/selection edge to align to. */
export type AlignEdge = 'left' | 'hcentre' | 'right' | 'top' | 'vcentre' | 'bottom';

/** Which axis to distribute boxes along. */
export type Axis = 'h' | 'v';

/** A re-stacking (z-order) operation. */
export type ZOp = 'front' | 'back' | 'forward' | 'backward';

/** Coerce a possibly-stringy field (URL round-trips numbers as strings) to a finite number. */
export function num(v: InputValue | undefined, fallback = 0): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : fallback;
}

/** Read a box's geometry as finite numbers, tolerant of string fields. */
export function boxRect(box: Box | undefined, cfg: BoxFieldConfig): Rect {
  return {
    x: num(box?.[cfg.xField], 0),
    y: num(box?.[cfg.yField], 0),
    w: Math.max(0, num(box?.[cfg.wField], 0)),
    h: Math.max(0, num(box?.[cfg.hField], 0)),
    rot: num(box?.[cfg.rotationField], 0),
  };
}

/** Return a NEW box with the given rect (+optional rot) written back, rounded to whole px. */
export function withRect(box: Box, rect: PartialRect, cfg: BoxFieldConfig): Box {
  const next: Box = { ...box };
  if (rect.x != null) next[cfg.xField] = Math.round(rect.x);
  if (rect.y != null) next[cfg.yField] = Math.round(rect.y);
  if (rect.w != null) next[cfg.wField] = Math.round(rect.w);
  if (rect.h != null) next[cfg.hField] = Math.round(rect.h);
  if (rect.rot != null && cfg.rotationField) next[cfg.rotationField] = Math.round(rect.rot * 10) / 10;
  return next;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** Rotate a local→world vector by `deg` (clockwise, screen y-down). */
export function rotateVec(vx: number, vy: number, deg: number): Point {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return { x: vx * c - vy * s, y: vx * s + vy * c };
}

/** Centre of a rect. */
export function rectCentre(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/** The four rotated corners of a box, in world (native) pixels, TL,TR,BR,BL order. */
export function boxCorners(box: Box | undefined, cfg: BoxFieldConfig): Point[] {
  const r = boxRect(box, cfg);
  const c = rectCentre(r);
  const hw = r.w / 2, hh = r.h / 2;
  const corners: [number, number][] = [
    [-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh],
  ];
  return corners.map(([lx, ly]) => {
    const w = rotateVec(lx, ly, r.rot);
    return { x: c.x + w.x, y: c.y + w.y };
  });
}

/** Axis-aligned bounding box (world px) of a possibly-rotated box. */
export function boxAABB(box: Box | undefined, cfg: BoxFieldConfig): AABB {
  const pts = boxCorners(box, cfg);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Union AABB of a set of boxes (by index list). null if empty. */
export function selectionAABB(boxes: Box[], indices: number[], cfg: BoxFieldConfig): AABB | null {
  let acc: AABB | null = null;
  for (const i of indices) {
    const b = boxes[i];
    if (!b) continue;
    const a = boxAABB(b, cfg);
    acc = acc
      ? {
          minX: Math.min(acc.minX, a.minX), minY: Math.min(acc.minY, a.minY),
          maxX: Math.max(acc.maxX, a.maxX), maxY: Math.max(acc.maxY, a.maxY),
          w: 0, h: 0,
        }
      : { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY, w: 0, h: 0 };
  }
  if (!acc) return null;
  return { ...acc, w: acc.maxX - acc.minX, h: acc.maxY - acc.minY };
}

/** Topmost box index under a native point, honouring rotation. -1 if none. */
export function hitTest(boxes: Box[], px: number, py: number, cfg: BoxFieldConfig): number {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const r = boxRect(boxes[i], cfg);
    const c = rectCentre(r);
    // Rotate the point into the box's local (unrotated) frame.
    const l = rotateVec(px - c.x, py - c.y, -r.rot);
    if (Math.abs(l.x) <= r.w / 2 && Math.abs(l.y) <= r.h / 2) return i;
  }
  return -1;
}

/** Indices whose AABB intersects a native marquee rect {x,y,w,h}. */
export function marqueeHit(boxes: Box[], rect: MarqueeRect, cfg: BoxFieldConfig): number[] {
  const mx1 = Math.min(rect.x, rect.x + rect.w), mx2 = Math.max(rect.x, rect.x + rect.w);
  const my1 = Math.min(rect.y, rect.y + rect.h), my2 = Math.max(rect.y, rect.y + rect.h);
  const out: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    const a = boxAABB(boxes[i], cfg);
    if (a.maxX >= mx1 && a.minX <= mx2 && a.maxY >= my1 && a.minY <= my2) out.push(i);
  }
  return out;
}

/** Move a set of boxes by (dx,dy) native px. Returns a NEW boxes array. */
export function moveBoxes(boxes: Box[], indices: number[], dx: number, dy: number, cfg: BoxFieldConfig): Box[] {
  const set = new Set(indices);
  return boxes.map((b, i) => {
    if (!set.has(i)) return b;
    const r = boxRect(b, cfg);
    return withRect(b, { x: r.x + dx, y: r.y + dy }, cfg);
  });
}

// Handle → local sign of the corner/edge being dragged. 0 = free on that axis.
const HANDLE_SIGN: Record<HandleName, [number, number]> = {
  n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0],
  ne: [1, -1], nw: [-1, -1], se: [1, 1], sw: [-1, 1],
};

/**
 * Resize one box by dragging `handle`, given the TOTAL pointer delta (native px)
 * since the gesture began and the box's rect AT gesture start (`startRect`).
 * Rotation-aware: the opposite anchor stays fixed in world space.
 * opts: { minSize, keepAspect, fromCentre }.
 */
export function resizeRect(startRect: StartRect, handle: HandleName, dxTotal: number, dyTotal: number, opts: ResizeOpts = {}): Rect {
  const minSize = opts.minSize ?? 8;
  const [hx, hy] = HANDLE_SIGN[handle] || [0, 0];
  const rot = startRect.rot || 0;
  // World unit vectors of the box's local axes.
  const ax = rotateVec(1, 0, rot); // local +x in world
  const ay = rotateVec(0, 1, rot); // local +y in world
  // Pointer delta projected onto the local axes.
  const dLocalX = dxTotal * ax.x + dyTotal * ax.y;
  const dLocalY = dxTotal * ay.x + dyTotal * ay.y;
  let newW = startRect.w + (hx === 0 ? 0 : hx * dLocalX);
  let newH = startRect.h + (hy === 0 ? 0 : hy * dLocalY);
  newW = Math.max(minSize, newW);
  newH = Math.max(minSize, newH);

  if (opts.keepAspect && startRect.w > 0 && startRect.h > 0) {
    const aspect = startRect.w / startRect.h;
    if (hx !== 0 && hy !== 0) {
      // Corner drag: drive height from width along the aspect.
      newH = Math.max(minSize, newW / aspect);
      newW = newH * aspect;
    } else if (hx !== 0) {
      newH = newW / aspect;
    } else if (hy !== 0) {
      newW = newH * aspect;
    }
  }

  const c0 = { x: startRect.x + startRect.w / 2, y: startRect.y + startRect.h / 2 };
  if (opts.fromCentre) {
    return { x: c0.x - newW / 2, y: c0.y - newH / 2, w: newW, h: newH, rot };
  }
  // Fixed anchor = the corner OPPOSITE the dragged handle (local sign -hx,-hy),
  // kept put in world space.
  const fx = -hx, fy = -hy;
  const anchorLocal0 = { x: (fx * startRect.w) / 2, y: (fy * startRect.h) / 2 };
  const aw = rotateVec(anchorLocal0.x, anchorLocal0.y, rot);
  const anchorWorld = { x: c0.x + aw.x, y: c0.y + aw.y };
  const anchorLocal1 = { x: (fx * newW) / 2, y: (fy * newH) / 2 };
  const aw1 = rotateVec(anchorLocal1.x, anchorLocal1.y, rot);
  const c1 = { x: anchorWorld.x - aw1.x, y: anchorWorld.y - aw1.y };
  return { x: c1.x - newW / 2, y: c1.y - newH / 2, w: newW, h: newH, rot };
}

/** Snap an angle (deg) to the nearest `step` when within `tol` degrees. */
export function snapAngle(deg: number, step = 15, tol = 4): number {
  const nearest = Math.round(deg / step) * step;
  return Math.abs(deg - nearest) <= tol ? nearest : deg;
}

/** Normalise a degrees value into [-180, 180). */
export function normAngle(deg: number): number {
  let d = deg % 360;
  if (d >= 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Align boxes to an edge. If `indices` has ≤1 box the reference is the artboard
 * (0..canvasW/H); otherwise it is the selection's union AABB. Edges:
 * 'left'|'hcentre'|'right'|'top'|'vcentre'|'bottom'. Returns a NEW boxes array.
 */
export function alignBoxes(boxes: Box[], indices: number[], edge: AlignEdge, cfg: BoxFieldConfig, canvas: Canvas): Box[] {
  if (!indices.length) return boxes;
  const single = indices.length <= 1;
  const ref = single
    ? { minX: 0, minY: 0, maxX: canvas.w, maxY: canvas.h, w: canvas.w, h: canvas.h }
    : selectionAABB(boxes, indices, cfg);
  if (!ref) return boxes;
  const set = new Set(indices);
  return boxes.map((b, i) => {
    if (!set.has(i)) return b;
    const a = boxAABB(b, cfg);
    let dx = 0, dy = 0;
    switch (edge) {
      case 'left': dx = ref.minX - a.minX; break;
      case 'right': dx = ref.maxX - a.maxX; break;
      case 'hcentre': dx = (ref.minX + ref.maxX) / 2 - (a.minX + a.maxX) / 2; break;
      case 'top': dy = ref.minY - a.minY; break;
      case 'bottom': dy = ref.maxY - a.maxY; break;
      case 'vcentre': dy = (ref.minY + ref.maxY) / 2 - (a.minY + a.maxY) / 2; break;
      default: return b;
    }
    const r = boxRect(b, cfg);
    return withRect(b, { x: r.x + dx, y: r.y + dy }, cfg);
  });
}

/**
 * Distribute boxes evenly along an axis ('h' or 'v') by equalising the GAPS
 * between adjacent AABBs, keeping the two extreme boxes fixed. Needs ≥3.
 * Returns a NEW boxes array.
 */
export function distributeBoxes(boxes: Box[], indices: number[], axis: Axis, cfg: BoxFieldConfig): Box[] {
  if (indices.length < 3) return boxes;
  const horiz = axis === 'h';
  const items = indices.map((i) => ({ i, a: boxAABB(boxes[i], cfg) }));
  items.sort((p, q) => (horiz ? p.a.minX - q.a.minX : p.a.minY - q.a.minY));
  const first = items[0], last = items[items.length - 1];
  if (!first || !last) return boxes; // unreachable — indices.length >= 3 guarantees both exist
  const spanTotal = horiz ? last.a.maxX - first.a.minX : last.a.maxY - first.a.minY;
  let sizes = 0;
  for (const it of items) sizes += horiz ? it.a.w : it.a.h;
  const gap = (spanTotal - sizes) / (items.length - 1);
  const moves = new Map<number, number>();
  let cursor = horiz ? first.a.minX : first.a.minY;
  for (let k = 0; k < items.length; k++) {
    const it = items[k];
    if (!it) continue; // unreachable — k < items.length guarantees a slot
    const curMin = horiz ? it.a.minX : it.a.minY;
    if (k > 0 && k < items.length - 1) {
      moves.set(it.i, cursor - curMin);
    }
    cursor += (horiz ? it.a.w : it.a.h) + gap;
  }
  return boxes.map((b, i) => {
    if (!moves.has(i)) return b;
    const r = boxRect(b, cfg);
    const d = moves.get(i) ?? 0;
    return withRect(b, horiz ? { x: r.x + d } : { y: r.y + d }, cfg);
  });
}

/**
 * Re-stack boxes (z-order == array order; later = on top).
 * op: 'front'|'back'|'forward'|'backward'. Returns a NEW boxes array.
 */
export function reorderZ(boxes: Box[], indices: number[], op: ZOp): Box[] {
  const set = new Set(indices);
  if (!set.size) return boxes;
  if (op === 'front') {
    const keep = boxes.filter((_, i) => !set.has(i));
    const sel = boxes.filter((_, i) => set.has(i));
    return [...keep, ...sel];
  }
  if (op === 'back') {
    const keep = boxes.filter((_, i) => !set.has(i));
    const sel = boxes.filter((_, i) => set.has(i));
    return [...sel, ...keep];
  }
  const arr = boxes.slice();
  if (op === 'forward') {
    // Walk from top down so a moving box doesn't leapfrog another selected one.
    for (let i = arr.length - 2; i >= 0; i--) {
      if (set.has(i) && !set.has(i + 1)) {
        const a = arr[i], b = arr[i + 1];
        if (a === undefined || b === undefined) continue;
        arr[i] = b; arr[i + 1] = a;
        set.delete(i); set.add(i + 1);
      }
    }
    return arr;
  }
  if (op === 'backward') {
    for (let i = 1; i < arr.length; i++) {
      if (set.has(i) && !set.has(i - 1)) {
        const a = arr[i], b = arr[i - 1];
        if (a === undefined || b === undefined) continue;
        arr[i] = b; arr[i - 1] = a;
        set.delete(i); set.add(i - 1);
      }
    }
    return arr;
  }
  return boxes;
}

/**
 * Build a new box object from block-field defaults + a kind's seed + a rect + id.
 * Pure: the shell supplies `defaults` (declared field defaults) and `id`.
 */
export function seedBox(cfg: BoxFieldConfig, defaults: Box | null | undefined, kindSeed: Box | null | undefined, rect: Rect, id: string | number | null | undefined): Box {
  const box: Box = { ...(defaults || {}), ...(kindSeed || {}) };
  if (cfg.idField && id != null) box[cfg.idField] = id;
  box[cfg.xField] = Math.round(rect.x);
  box[cfg.yField] = Math.round(rect.y);
  box[cfg.wField] = Math.round(rect.w);
  box[cfg.hField] = Math.round(rect.h);
  if (cfg.rotationField && box[cfg.rotationField] == null) box[cfg.rotationField] = 0;
  return box;
}

/** Normalise a drag rect (can be dragged up/left) into positive w/h with a floor. */
export function normDragRect(x0: number, y0: number, x1: number, y1: number, minSize = 8): MarqueeRect {
  let x = Math.min(x0, x1), y = Math.min(y0, y1);
  let w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
  if (w < minSize) w = minSize;
  if (h < minSize) h = minSize;
  return { x, y, w, h };
}

// ── Group transforms (multi-selection: scale + rotate about a pivot) ──────────
// A group / multi-selection scales UNIFORMLY (shear-free — a rotated box can't
// represent a non-uniform scale) about a fixed `anchor`, and rotates rigidly about
// a fixed `centre`. Text size + corner radius scale with the group so it reads as
// real scaling. Both return NEW boxes arrays.

export function scaleGroup(boxes: Box[], indices: number[], anchor: Point, k: number, cfg: BoxFieldConfig, opts: ScaleOpts = {}): Box[] {
  const set = new Set(indices);
  const minSize = opts.minSize ?? 1;
  const kk = k > 0 ? k : 0.01;
  return boxes.map((b, i) => {
    if (!set.has(i)) return b;
    const r = boxRect(b, cfg);
    const c = rectCentre(r);
    const nc = { x: anchor.x + (c.x - anchor.x) * kk, y: anchor.y + (c.y - anchor.y) * kk };
    const nw = Math.max(minSize, r.w * kk);
    const nh = Math.max(minSize, r.h * kk);
    const nb = withRect(b, { x: nc.x - nw / 2, y: nc.y - nh / 2, w: nw, h: nh }, cfg);
    if (cfg.fontSizeField && b[cfg.fontSizeField] != null && b[cfg.fontSizeField] !== '')
      nb[cfg.fontSizeField] = Math.max(1, Math.round(num(b[cfg.fontSizeField]) * kk));
    if (cfg.radiusField && b[cfg.radiusField] != null && b[cfg.radiusField] !== '')
      nb[cfg.radiusField] = Math.max(0, Math.round(num(b[cfg.radiusField]) * kk));
    return nb;
  });
}

export function rotateGroup(boxes: Box[], indices: number[], centre: Point, deltaDeg: number, cfg: BoxFieldConfig): Box[] {
  const set = new Set(indices);
  return boxes.map((b, i) => {
    if (!set.has(i)) return b;
    const r = boxRect(b, cfg);
    const c = rectCentre(r);
    const v = rotateVec(c.x - centre.x, c.y - centre.y, deltaDeg);
    const nc = { x: centre.x + v.x, y: centre.y + v.y };
    return withRect(b, { x: nc.x - r.w / 2, y: nc.y - r.h / 2, rot: normAngle(r.rot + deltaDeg) }, cfg);
  });
}

// ── Snapping ──────────────────────────────────────────────────────────────────
// Design-tool "smart guides": while moving/resizing/creating, snap the active
// box's edges + centres to the artboard (edges + centre) and to every OTHER box's
// edges + centres, and report guide line segments to draw. All native px.

interface SnapTarget {
  v: number;
  span?: [number, number];
}

interface SnapPick {
  d: number;
  line: number;
  span?: [number, number];
}

function pickSnap(edges: number[], targets: SnapTarget[], threshold: number): SnapPick | null {
  let best: SnapPick | null = null;
  for (const e of edges) {
    for (const t of targets) {
      const d = t.v - e;
      if (Math.abs(d) <= threshold && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, line: t.v, span: t.span };
    }
  }
  return best;
}

/**
 * Snap a rigidly-translating selection: `active` and `others` are AABBs
 * {minX,minY,maxX,maxY}. Returns { dx, dy, guides:[{x1,y1,x2,y2}] } — the extra
 * translation that lands an edge/centre on a target, plus guide segments.
 */
export function snapMove(active: AABB, others: AABB[], canvas: Canvas, threshold: number): SnapMoveResult {
  const acx = (active.minX + active.maxX) / 2, acy = (active.minY + active.maxY) / 2;
  const xTargets: SnapTarget[] = [
    { v: 0, span: [0, canvas.h] }, { v: canvas.w / 2, span: [0, canvas.h] }, { v: canvas.w, span: [0, canvas.h] },
  ];
  const yTargets: SnapTarget[] = [
    { v: 0, span: [0, canvas.w] }, { v: canvas.h / 2, span: [0, canvas.w] }, { v: canvas.h, span: [0, canvas.w] },
  ];
  for (const o of others) {
    const ocx = (o.minX + o.maxX) / 2, ocy = (o.minY + o.maxY) / 2;
    const yspan: [number, number] = [Math.min(active.minY, o.minY), Math.max(active.maxY, o.maxY)];
    const xspan: [number, number] = [Math.min(active.minX, o.minX), Math.max(active.maxX, o.maxX)];
    xTargets.push({ v: o.minX, span: yspan }, { v: ocx, span: yspan }, { v: o.maxX, span: yspan });
    yTargets.push({ v: o.minY, span: xspan }, { v: ocy, span: xspan }, { v: o.maxY, span: xspan });
  }
  const bx = pickSnap([active.minX, acx, active.maxX], xTargets, threshold);
  const by = pickSnap([active.minY, acy, active.maxY], yTargets, threshold);
  const guides: Guide[] = [];
  if (bx && bx.span) guides.push({ x1: bx.line, y1: bx.span[0], x2: bx.line, y2: bx.span[1] });
  if (by && by.span) guides.push({ x1: by.span[0], y1: by.line, x2: by.span[1], y2: by.line });
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guides };
}

/**
 * Snap a single pointer/corner point (native px) to the artboard + sibling
 * edge/centre lines. Used for create-drag and unrotated resize (the handle
 * follows the pointer, so snapping the pointer aligns the moving edge).
 * Returns { x, y, guides }.
 */
export function snapPoint(px: number, py: number, others: AABB[], canvas: Canvas, threshold: number): SnapPointResult {
  const xTargets: SnapTarget[] = [{ v: 0 }, { v: canvas.w / 2 }, { v: canvas.w }];
  const yTargets: SnapTarget[] = [{ v: 0 }, { v: canvas.h / 2 }, { v: canvas.h }];
  for (const o of others) {
    xTargets.push({ v: o.minX }, { v: (o.minX + o.maxX) / 2 }, { v: o.maxX });
    yTargets.push({ v: o.minY }, { v: (o.minY + o.maxY) / 2 }, { v: o.maxY });
  }
  const bx = pickSnap([px], xTargets, threshold);
  const by = pickSnap([py], yTargets, threshold);
  const guides: Guide[] = [];
  if (bx) guides.push({ x1: bx.line, y1: 0, x2: bx.line, y2: canvas.h });
  if (by) guides.push({ x1: 0, y1: by.line, x2: canvas.w, y2: by.line });
  return { x: bx ? px + bx.d : px, y: by ? py + by.d : py, guides };
}

/** Clamp a box's rect so its centre stays within the artboard (never fully lost). */
export function clampBoxToCanvas(box: Box, cfg: BoxFieldConfig, canvas: Canvas): Box {
  const r = boxRect(box, cfg);
  const c = rectCentre(r);
  const cx = Math.max(0, Math.min(canvas.w, c.x));
  const cy = Math.max(0, Math.min(canvas.h, c.y));
  if (cx === c.x && cy === c.y) return box;
  return withRect(box, { x: r.x + (cx - c.x), y: r.y + (cy - c.y) }, cfg);
}
