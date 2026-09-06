// SPDX-License-Identifier: MPL-2.0
// free-canvas-math.js - DOM-free geometry for the WYSIWYG "editor" layout.
//
// The web shell's free-canvas overlay (free-canvas.js) is the only DOM here; ALL
// coordinate math lives in this module so it can be unit-tested at the repo root,
// exactly like block-tree.js is for nested blocks. Everything operates on a FLAT
// array of "box" objects (one row of a `blocks` input) plus a `cfg` describing
// which sub-fields carry geometry (from the input's `canvas` flag). Functions are
// pure: they read boxes, return NEW boxes / arrays, and never touch the DOM.
//
// Coordinate space: box x/y/w/h are in CANVAS (native render) pixels; the box is
// the axis-aligned rectangle [x, x+w] × [y, y+h] BEFORE rotation, and `rot`
// degrees is applied clockwise about the box centre (matching CSS
// `transform: rotate()` with the default centre transform-origin). Screen↔native
// mapping is the shell's job (it reads live getBoundingClientRect); this module is
// purely in native pixels.

import type { InputValue } from '../../../../engine/src/inputs.ts';
// The lift ladder is written in MAGNIFICATION and stored as depth; the engine owns
// the conversion (plans/104 section 4.3 - `eff` and `z` are only the same sentence at one
// perspective, so nobody re-types the formula).
import { depthForEff } from '../../../../engine/src/keyframes.ts';
// ONE mapping from a deck transition to the per-box pair that expresses it (plans/179 M4),
// shared with the presenter and the .pptx writer so a slide laid out on the timeline and
// the same slide presented can never disagree about what "slide" means.
import { slideTransitionPair } from '../lib/motion-model.ts';

/** A flat row of a `blocks` input, keyed by field id - the structure of one "box". */
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

/** Partial geometry to write back via {@link withRect} - only present fields change. */
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

/** A resize-handle name - the 8 compass points around a box. */
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

/** The rect a resize gesture started from - `rot` may be absent (treated as 0). */
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
  const n = typeof v === 'number' ? v : parseFloat(v as string);
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

/** Local→world rotation of a vector by `deg` (clockwise, screen y-down). */
export function rotateVec(vx: number, vy: number, deg: number): Point {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return { x: vx * c - vy * s, y: vx * s + vy * c };
}

/** Centre of a box's rect. */
export function rectCentre(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * The displacement half of the sequence applier's fold, as `bridge/sequence-dom.ts`
 * publishes it (`SequencePose`). Restated structurally rather than imported so this
 * module keeps its one property: pure geometry, no bridge, no DOM.
 */
export interface SeqPose {
  /** The leading `translate`, native px - applied OUTSIDE the box's own rotation. */
  dx: number;
  dy: number;
  /** The trailing `scale`, about the box's centre. */
  sc: number;
  /** Extra rotation, degrees, composed AFTER the authored one. */
  rot: number;
  /** The layout size at this instant - the box's own unless `sized`. */
  w: number;
  h: number;
  /** True when `w`/`h` are a KEYED size, i.e. the applier wrote the layout box too. */
  sized: boolean;
}

/**
 * A box's rect AS THE PLAYHEAD SHOWS IT: its authored rect mapped through the pose the
 * applier has it in (plans/104 section 6.5 - editor chrome projects through the same fold
 * the render used, never through a second evaluation of the same track).
 *
 * The map is exactly what `composeTransform` writes and CSS then applies about the
 * box's centre - `translate(dx,dy) <authored> rotate(rot) scale(sc)` - read back as
 * geometry. Because `sc` is uniform, scaling about the centre and rotating about the
 * centre commute, so the posed shape is still a rectangle: same centre plus `dx,dy`,
 * sides `sc` times longer, turned by the authored angle plus `rot`.
 *
 * A KEYED size is a layout write, and a box grows from its TOP-LEFT (`left`/`top` are
 * what is authored, `width`/`height` are what the applier writes), so the centre the
 * transform pivots on moves by half the growth - the same half-growth `foldKfPose`
 * anchors its projection on, which is why `dx`/`dy` are measured from the grown centre
 * and not the authored one.
 *
 * A null/absent pose - the byte-identity floor, and by far the common case - hands back
 * the SAME rect object, so an untimed board's chrome is placed by the identical
 * expressions it always was. So does an exactly neutral pose: a box at rest inside a
 * projecting stage must not be nudged by a round trip through IEEE.
 *
 * NOT the whole picture under a TILTED camera (P2): the element then paints a
 * trapezoid, and `dx`/`dy`/`sc` describe only its projected centre and magnification.
 * That is section 6.5's stated "projected-AABB chrome" approximation, not the quad.
 */
export function posedRect(r: Rect, pose: SeqPose | null | undefined): Rect {
  if (!pose) return r;
  const sc = Number.isFinite(pose.sc) ? pose.sc : 1;
  const dx = Number.isFinite(pose.dx) ? pose.dx : 0;
  const dy = Number.isFinite(pose.dy) ? pose.dy : 0;
  const rot = Number.isFinite(pose.rot) ? pose.rot : 0;
  const w0 = pose.sized && Number.isFinite(pose.w) ? Math.max(0, pose.w) : r.w;
  const h0 = pose.sized && Number.isFinite(pose.h) ? Math.max(0, pose.h) : r.h;
  if (dx === 0 && dy === 0 && sc === 1 && rot === 0 && w0 === r.w && h0 === r.h) return r;
  const cx = r.x + w0 / 2 + dx;
  const cy = r.y + h0 / 2 + dy;
  const w = Math.max(0, w0 * sc);
  const h = Math.max(0, h0 * sc);
  return { x: cx - w / 2, y: cy - h / 2, w, h, rot: r.rot + rot };
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
  let acc: { minX: number; minY: number; maxX: number; maxY: number } | null = null;
  for (const i of indices) {
    const b = boxes[i];
    if (!b) continue;
    const a = boxAABB(b, cfg);
    acc = acc
      ? {
          minX: Math.min(acc.minX, a.minX), minY: Math.min(acc.minY, a.minY),
          maxX: Math.max(acc.maxX, a.maxX), maxY: Math.max(acc.maxY, a.maxY),
        }
      : { minX: a.minX, minY: a.minY, maxX: a.maxX, maxY: a.maxY };
  }
  if (!acc) return null;
  return { ...acc, w: acc.maxX - acc.minX, h: acc.maxY - acc.minY };
}

/**
 * Topmost box index under a native point, honouring rotation. -1 if none.
 * `skip` excludes a box from hit-testing entirely (the click falls through to
 * whatever is below) - the sequence editor passes "hidden at the playhead", so
 * a user can only ever select what they can currently see.
 */
export function hitTest(boxes: Box[], px: number, py: number, cfg: BoxFieldConfig, skip?: (i: number) => boolean): number {
  for (let i = boxes.length - 1; i >= 0; i--) {
    if (skip && skip(i)) continue;
    const r = boxRect(boxes[i], cfg);
    const c = rectCentre(r);
    // Rotate the point into the box's local (unrotated) frame.
    const l = rotateVec(px - c.x, py - c.y, -r.rot);
    if (Math.abs(l.x) <= r.w / 2 && Math.abs(l.y) <= r.h / 2) return i;
  }
  return -1;
}

/** Indices whose AABB intersects a native marquee rect {x,y,w,h}. `skip` as in hitTest. */
export function marqueeHit(boxes: Box[], rect: MarqueeRect, cfg: BoxFieldConfig, skip?: (i: number) => boolean): number[] {
  const mx1 = Math.min(rect.x, rect.x + rect.w), mx2 = Math.max(rect.x, rect.x + rect.w);
  const my1 = Math.min(rect.y, rect.y + rect.h), my2 = Math.max(rect.y, rect.y + rect.h);
  const out: number[] = [];
  for (let i = 0; i < boxes.length; i++) {
    if (skip && skip(i)) continue;
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
    ? { minX: 0, minY: 0, maxX: canvas.w, maxY: canvas.h }
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
  const first = items[0]!.a, last = items[items.length - 1]!.a;
  const span = horiz ? last.maxX - first.minX : last.maxY - first.minY;
  let sizes = 0;
  for (const it of items) sizes += horiz ? it.a.w : it.a.h;
  const gap = (span - sizes) / (items.length - 1);
  const moves = new Map<number, number>();
  let cursor = horiz ? first.minX : first.minY;
  for (let k = 0; k < items.length; k++) {
    const it = items[k]!;
    const curMin = horiz ? it.a.minX : it.a.minY;
    if (k > 0 && k < items.length - 1) {
      moves.set(it.i, cursor - curMin);
    }
    cursor += (horiz ? it.a.w : it.a.h) + gap;
  }
  return boxes.map((b, i) => {
    if (!moves.has(i)) return b;
    const r = boxRect(b, cfg);
    const d = moves.get(i)!;
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
        [arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!];
        set.delete(i); set.add(i + 1);
      }
    }
    return arr;
  }
  if (op === 'backward') {
    for (let i = 1; i < arr.length; i++) {
      if (set.has(i) && !set.has(i - 1)) {
        [arr[i], arr[i - 1]] = [arr[i - 1]!, arr[i]!];
        set.delete(i); set.add(i - 1);
      }
    }
    return arr;
  }
  return boxes;
}

// ── Lift layers (plans/104 section 7 P3) ────────────────────────────────────────────
//
// The engine enumerates an SVG's layers (`enumerateSvgLayers`). This module is the other
// half: it turns those layers into the rows that REPLACE the source box. It lives
// here rather than in timeline-math.ts because its neighbours are `seedBox`,
// `withRect`, and `reorderZ`. It is box synthesis in the canvas's flat model, and
// it touches no clock. The `z` it writes is the per-box DEPTH FIELD (section 5.3, the
// slider), not a keyframe track: a lifted stack is a static arrangement until
// someone animates it.

/** One enumerated layer, resolved to something a box can point at. */
export interface LiftLayerSource {
  /**
   * What goes in the image field: the derived per-layer SVG as a `data:` URL, or
   * any asset ref the shell has already stored. The caller owns getting here - 
   * the per-layer markup goes through the SAME sanitise path an upload does
   * (picker.ts → DOMPurify → blob/data URL), because a derived document is still
   * made of bytes that arrived from a stranger.
   */
  src: string;
  /** Fresh box id for this row, minted by the caller (ids must stay unique). */
  id: string | number;
  /**
   * The crop the engine gave this layer's document (`SvgLayer.viewBox`), in the
   * SOURCE SVG's user units - absent when the layer kept the whole stage.
   *
   * With {@link LiftOptions.viewBox} it is the affine map from the source box's
   * rect to this row's, which is what makes a row CONTENT-SIZED: the 16 px icon
   * gets a 16 px box, so its depth shadow is a 16 px gaussian, not a
   * full-frame one (plans/104 section 9 P3.1 item 1: eleven full-stage shadows abort
   * the encoder watchdog).
   */
  crop?: { x: number; y: number; w: number; h: number } | null;
  /**
   * The layer's INK EXTENT as the engine measured it (`SvgLayer.bbox`), in the
   * same units as {@link crop}. Used only to decide which rows are geometric
   * peers ({@link liftSlots}) - never for placement.
   *
   * It is a different rectangle from the crop and both are needed: a crop is
   * intersected with the source viewBox, so three identical cards half off the
   * edge of a phone screenshot crop to three different widths while remaining
   * obviously one row of one grid. Depth coherence is a question about the
   * artwork; placement is a question about the document.
   */
  bbox?: { x: number; y: number; w: number; h: number } | null;
}

/** The extra field ids a lift writes, beyond the geometry `BoxFieldConfig`. */
export interface LiftFieldConfig {
  imageField: string;
  groupField?: string;
  zField?: string;
  shadowField?: string;
  kindField?: string;
  textField?: string;
  fillField?: string;
  gradField?: string;
  /** `object-fit`. A cropped row is written `fill`: its rect IS the image's rect. */
  fitField?: string;
  /** `object-position`. Anything but centred takes cropping off the table. */
  imgPosField?: string;
  /** A shape clip on the box - per-row clips are not one clip, so: no cropping. */
  clipField?: string;
}

export interface LiftOptions {
  /** Clamp for the depth field - pass `KF_Z_FIELD_CLAMP` from the engine. */
  zClamp?: readonly [number, number];
  /** Group id shared by every lifted row, minted by the caller (freshGroupId). */
  group?: string;
  /** Shadow target pre-set on lifted rows. section 7 says `depth`; '' writes none. */
  shadow?: string;
  /** Box kind for a row holding an image. Defaults to the source's own kind. */
  kind?: string;
  /**
   * The source SVG's own viewBox (`enumerateSvgLayers().viewBox`). Without it
   * every row keeps the source's rect, exactly as 1.119 did - there is no map
   * from a layer's crop to a rect on the canvas.
   */
  viewBox?: { x: number; y: number; w: number; h: number } | null;
  /** How the source box renders the image: `contain` (default), `cover`, `fill`. */
  fit?: string;
  /**
   * An UNGROUP, not a lift: the rows keep the source's own depth and shadow, so nothing
   * changes but the layering - an imported SVG comes apart into the parts it was drawn
   * from, each an ordinary box where the ink was. Off (the default) the rows climb the
   * depth ladder with `shadow: depth`, plans/104 section 7's stack.
   */
  flat?: boolean;
  /**
   * Depth-intensity multiplier for the derived stack (audit A5#2) - one of
   * {@link LIFT_STRENGTH}. Absent / 1 is the shipped taste ceiling, so a lift with no
   * strength chosen is byte-identical to every lift before the control existed.
   */
  strength?: number;
}

// ─── the depth ladder ───────────────────────────────────────────────────────

/**
 * How much bigger than the page the FIRST lifted layer reads, at the default
 * camera. This is the ladder's rung height where there is room for a full one.
 *
 * The ladder is written in magnification, not in depth, because magnification
 * is the thing a person sees and depth is the thing a file stores. `z` is only
 * meaningful against a perspective: at P = 1200 a step of 40 px is +3.4 %, and
 * the same 40 px is +0.7 % at P = 6000. So the step is 2 % and the engine
 * ({@link depthForEff}) says what that costs in z - 23.53 px today.
 */
export const LIFT_EFF_STEP = 0.02;

/**
 * The magnification the TOP of a lifted stack reaches, and never passes,
 * however many layers there are. This is plans/104 section 5.3's taste ceiling (the "tasteful
 * eff 1.05-1.2 band"), which is z = 200 at P = 1200.
 *
 * This is the fix for a content-blind ladder. A fixed 40 px per layer is fine
 * for three layers and absurd for thirty. The acceptance pass measured a
 * 54-layer lift where 31 rows sat pinned at the field clamp (z = 900) with NO
 * relative parallax at all, and the layers that did move spread 125x apart:
 * a "stack" whose top plate flew past the camera at eff 10 while its bottom
 * crawled at 1.2. Above roughly 11 layers the rung shrinks so the top rung still lands
 * here; below that, every rung is a full {@link LIFT_EFF_STEP}.
 */
export const LIFT_EFF_CEIL = 1.2;

/**
 * Depth-intensity presets for the Lift dialog (audit A5#2), a multiplier on the
 * per-rung magnification `liftDepths` derives. `medium` is 1: the tasteful ceiling this
 * feature shipped with, so a Medium lift is BYTE-IDENTICAL to every lift before this
 * control existed. `subtle` flattens it for busy artwork; `dramatic` pushes past the
 * ceiling for real parallax on a sparse hero shot, the "less flat" the audit asked for,
 * as an opt-in rather than a moved default. The numbers stay well clear of collapsing the
 * 0.01 px depth quantum even at the 64-layer cap (closest rungs about 0.24 px x 0.6, about 0.14 px).
 */
export const LIFT_STRENGTH: Readonly<Record<string, number>> = Object.freeze({
  subtle: 0.6,
  medium: 1,
  dramatic: 1.9,
});

/**
 * The depth for each row of a stack, given each row's DEPTH SLOT.
 *
 * Slots rather than positions, because {@link liftSlots} puts several rows on one
 * rung: a 3x3 grid of cards is one surface at one height, and staggering its
 * cells reads as a bug, not as depth.
 *
 * Rows sharing a rung do NOT share a depth exactly. They spread across that one
 * rung, in paint order, by a fraction of it. plans/104 P3.2 says "one depth, or a
 * whisper apart, at most one band step", and the whisper is doing real work.
 * Equal depths would make the depth sort (section 4.2) a tie broken by DOM order, which
 * is correct but leaves two plates at one z and a stack with no ordering of its
 * own. A nine-hundredth of a magnification between them keeps every depth
 * DISTINCT and monotone in paint order while the grid still reads as one
 * surface. Nothing else in the feature has to know about peers at all.
 *
 * Properties this guarantees, which the P3.1 acceptance pass measured the
 * absence of: every depth inside the band (so nothing reaches the guard, nothing
 * reaches the field clamp), rungs of equal magnification (so the parallax
 * between neighbours is even), and every depth DISTINCT (measured on all six
 * banked shots; at the 64-layer cap the closest two rungs are about 0.24 px apart
 * against the 0.01 px quantum, so distinctness survives the rounding).
 *
 * ⚑ NOT "strictly increasing depth per row", which this docstring used to claim
 * and which is false on half the banked shots. `ai-stance-change-history` reads
 * `0, 14.16, …, 80.22, 48.14, 92.56, …`. It is monotone in RUNG, and a rung is
 * monotone in paint order only where no rows are peers: {@link liftSlots} puts
 * peers on one rung, and peer sets interleave in DOM order, so their rungs
 * interleave with them. That is the behaviour three paragraphs up asks for
 * ("interleaving is allowed, inversions are not"). The guarantee list simply
 * over-stated it.
 */
export function liftDepths(
  slots: readonly number[], zClamp?: readonly [number, number], strength = 1,
): number[] {
  if (!slots.length) return [];
  // Where each row sits on the ladder: its rung, plus its place within the rung.
  const size = new Map<number, number>();
  for (const s of slots) size.set(s, (size.get(s) ?? 0) + 1);
  const seen = new Map<number, number>();
  const rungs = slots.map((s) => {
    const rank = seen.get(s) ?? 0;
    seen.set(s, rank + 1);
    const base = Number.isFinite(s) && s > 0 ? s : 0;
    return base + rank / Math.max(1, size.get(s) ?? 1);
  });
  const top = rungs.reduce((a, b) => Math.max(a, b), 0);
  // `strength` scales the per-rung magnification (audit A5#2 - the Lift dialog's Depth
  // intensity). Default 1 is the shipped ceiling, so an unscaled lift is byte-identical.
  // Guarded so a junk value can never zero the ladder (which would TIE every depth and
  // collapse the paint order) or invert it: <=0 / non-finite falls back to 1.
  const k = Number.isFinite(strength) && strength > 0 ? strength : 1;
  const step = (top > 0 ? Math.min(LIFT_EFF_STEP, (LIFT_EFF_CEIL - 1) / top) : 0) * k;
  const [lo, hi] = zClamp ?? [-Infinity, Infinity];
  return rungs.map((rung) => {
    // section 4.6's z quantum is 0.01 px, and the ladder is stored, so it quantises here
    // rather than leaving 23.529411764705884 in a URL.
    const z = Math.round(depthForEff(1 + rung * step) * 100) / 100;
    return Math.min(hi, Math.max(lo, z));
  });
}

/** Relative size difference two rows may have and still be peers. */
export const LIFT_PEER_SIZE_TOL = 0.12;
/** How far apart, as a fraction of size, two peers' edges may sit and still align. */
export const LIFT_PEER_ALIGN_TOL = 0.25;
/**
 * How far apart two peers may sit ALONG their shared band, in multiples of the
 * larger one's size, and still be neighbours.
 *
 * Union-find chains, so a row of ten icons still links end to end at one hop
 * each - this only stops the hop that is not a neighbour at all. Measured on
 * `seq-studio-timeline`: a 16 px toolbar icon and an 18 px clip icon 146 px
 * below it are the same size and the same column, and chaining them dragged the
 * toolbar's whole row down among the clip bars - where the inversions it caused
 * then dissolved the row entirely. A grid is a local thing.
 */
export const LIFT_PEER_GAP = 4;

/**
 * How much of the smaller box two rows must share before a depth INVERSION
 * between them counts as repainting the picture.
 *
 * Not zero, and the reason is measured: `bs-palette-pane`'s swatch wells are
 * 66 px on a 55 px pitch and each carries a drop shadow, so every row of that
 * grid overlaps its neighbour a little and each chip kisses the NEXT well by
 * about 4 % of its own area. At a zero threshold that hairline is enough to
 * refuse coherence on the one piece of content coherence exists for - fifty
 * swatches, fifty depths. At a quarter, an edge that two anti-aliased pixels
 * wide is tolerated and a card genuinely sitting on a panel is not.
 */
export const LIFT_PEER_OVERLAP_TOL = 0.25;

/**
 * Which rows share a depth: geometric PEERS get one rung between them.
 *
 * A lift reads its stack out of paint order, which is a fine default and a poor
 * description of a grid. The nine cards of `cc-verify-mobile`'s 3 × 3 block are
 * one surface - same size, same rows, same columns - and a ladder that lifts
 * each one 40 px above the last turns a grid into a staircase. So rows that are
 * the same size AND share a row band or a column band are one rung.
 *
 * Two decisions worth their sentences:
 *
 *   • **Alignment is required, not just size.** Two 48 px icons at opposite
 *     corners of a page are the same size and are not a grid. Sharing a band is
 *     what makes a set read as one surface.
 *   • **Interleaving is allowed, inversions are not.** A swatch grid alternates
 *     66 px wells and 48 px chips, so the two peer sets interleave in paint
 *     order and their rungs necessarily do too. That is fine while the rows it
 *     inverts do not overlap - draw order only matters where ink meets ink.
 *     Where an inversion WOULD flip overlapping ink, the group causing it gives
 *     up its coherence (its members become singletons) rather than repaint the
 *     picture. plans/104 section 4.2 sorts paint order by resolved depth, so this is a
 *     property of the render, not a nicety.
 *
 * Rows with no crop (unmeasured ink, a full-stage layer) are always their own
 * rung: nothing is known about their extent, and the background of a screenshot
 * is not a peer of anything.
 */
export function liftSlots(crops: ReadonlyArray<LiftLayerSource['crop'] | undefined>): number[] {
  const n = crops.length;
  if (n <= 1) return crops.map((_, i) => i);
  const box = (i: number): { x: number; y: number; w: number; h: number } | null => {
    const c = crops[i];
    return c && Number.isFinite(c.w) && Number.isFinite(c.h) && c.w > 0 && c.h > 0 ? c : null;
  };

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]!]!; i = parent[i]!; } return i; };
  const near = (a: number, b: number, scale: number, tol: number): boolean =>
    Math.abs(a - b) <= tol * Math.max(1e-6, scale);

  const join = (dropped: ReadonlySet<number>): number[] => {
    for (let i = 0; i < n; i++) parent[i] = i;
    for (let i = 0; i < n; i++) {
      const a = box(i);
      if (!a || dropped.has(i)) continue;
      for (let j = i + 1; j < n; j++) {
        const b = box(j);
        if (!b || dropped.has(j) || find(i) === find(j)) continue;
        const sameSize = near(a.w, b.w, Math.max(a.w, b.w), LIFT_PEER_SIZE_TOL)
          && near(a.h, b.h, Math.max(a.h, b.h), LIFT_PEER_SIZE_TOL);
        if (!sameSize) continue;
        const mw = Math.max(a.w, b.w), mh = Math.max(a.h, b.h);
        const sameRow = near(a.y, b.y, mh, LIFT_PEER_ALIGN_TOL) && Math.abs(a.x - b.x) <= LIFT_PEER_GAP * mw;
        const sameCol = near(a.x, b.x, mw, LIFT_PEER_ALIGN_TOL) && Math.abs(a.y - b.y) <= LIFT_PEER_GAP * mh;
        if (!sameRow && !sameCol) continue;
        const ra = find(i), rb = find(j);
        if (ra !== rb) parent[ra] = rb;
      }
    }
    // Slot numbers follow FIRST APPEARANCE, so the ladder still climbs with the
    // artwork: the first row of a group fixes the group's rung.
    const slotOf = new Map<number, number>();
    return Array.from({ length: n }, (_, i) => {
      const root = box(i) && !dropped.has(i) ? find(i) : ~i; // singletons get a private key
      let s = slotOf.get(root);
      if (s == null) { s = slotOf.size; slotOf.set(root, s); }
      return s;
    });
  };

  const overlaps = (i: number, j: number): boolean => {
    const a = box(i), b = box(j);
    // ⚑ An unmeasured row does NOT veto coherence, which is the one place this
    // function guesses instead of refusing. A row is unmeasured because it holds
    // `<text>` or `<use>` - a glyph run, whose ink is a fraction of any box it
    // sits in - and the alternative was measured on the P3 demo: four identical
    // cards, each followed by its own caption, lost their grid entirely because
    // an unmeasurable caption sat between every pair of them. The cost of being
    // wrong is a label drawn under a card it does not belong to, in a proposal
    // the user accepts or cancels; the cost of refusing is that no labelled grid
    // ever coheres.
    if (!a || !b) return false;
    const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (w <= 0 || h <= 0) return false;
    return w * h >= LIFT_PEER_OVERLAP_TOL * Math.min(a.w * a.h, b.w * b.h);
  };

  const dropped = new Set<number>();
  for (let pass = 0; pass <= n; pass++) {
    const slots = join(dropped);
    // An inversion is a pair the depth sort would repaint out of authored order.
    const guilty = new Map<number, number>();
    const size = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      if (!box(i) || dropped.has(i)) continue;
      const r = find(i);
      size.set(r, (size.get(r) ?? 0) + 1);
    }
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (slots[i]! <= slots[j]! || !overlaps(i, j)) continue;
        // Both ends of an inversion are implicated; only a MERGED group can give
        // anything up, so singletons are counted and then never chosen.
        for (const k of [i, j]) {
          if (!box(k) || dropped.has(k)) continue;
          const r = find(k);
          guilty.set(r, (guilty.get(r) ?? 0) + 1);
        }
      }
    }
    if (!guilty.size) return slots;
    let worst = -1;
    let worstCount = 0;
    for (const [root, count] of guilty) {
      if ((size.get(root) ?? 0) < 2) continue;
      if (count > worstCount) { worstCount = count; worst = root; }
    }
    // Nothing left to give up: the inversions are between rows that were never
    // merged, so coherence is not what caused them - fall back to one rung each.
    if (worst < 0) break;
    for (let i = 0; i < n; i++) if (box(i) && !dropped.has(i) && find(i) === worst) dropped.add(i);
  }
  return crops.map((_, i) => i);
}

/**
 * The rows that replace a lifted box: one per layer, same geometry, staggered depth.
 *
 * Pure. Everything with a source of truth elsewhere is an argument - ids and the
 * group id are minted by the caller (they are the shell's counters), the derived
 * markup arrives already sanitised, and the depth clamp is the engine's
 * `KF_Z_FIELD_CLAMP` rather than a re-typed −300/900.
 *
 * **Paint order is preserved, including the parts that are not the artwork.** A
 * box paints background → image → text, so splitting one box into N cannot just
 * copy all three onto every row: the background would composite N times and the
 * caption would be printed N times. Instead the source's own paint is
 * distributed the way the stack rebuilds it - 
 *
 *   • the BOTTOM row keeps the background (fill/gradient), which paints first;
 *   • the TOP row keeps the text, which paints last;
 *   • every row carries exactly one layer's artwork.
 *
 * …so bg → layer 1 … layer N → text comes out in the original order, and nothing
 * the user authored is silently dropped. Everything else on the source row
 * (rotation, opacity, blend, clip, frame, timing) is inherited by every row,
 * because those are properties of WHERE the artwork sits.
 *
 * ## Rows are SIZED TO THEIR INK where the engine could crop safely
 *
 * A row whose layer came back with a `crop` gets the rect that crop maps to
 * inside the source box, not the source's own rect. Same picture - the derived
 * document's viewBox is that same crop, so a smaller window over a
 * proportionally smaller box is an identity - and everything that follows the
 * BOX rather than the ink stops being charged for the whole stage: a depth
 * shadow becomes a shadow of the thing, a plate becomes the size of the thing,
 * and the fx cache stops evicting itself (measured on the six banked shots: the
 * per-layer filtered area falls to 6–30 % of the full-stage cost).
 *
 * Placement is exact rather than tidy: the rect is quantised to 0.01 px instead
 * of rounded to whole pixels, because a rounded row is a row whose ink has moved
 * up to half a pixel away from where the original drew it, and the identity
 * property is measured against a real renderer.
 *
 * Which rows crop is not this function's decision - it is
 * {@link liftCanCrop}'s, asked BEFORE the documents were derived, because a
 * cropped document needs a cropped row and the two are decided in different
 * places. Here a layer that arrived with a crop is placed at it, and a layer
 * that did not keeps the source's rect; the only refusal left is geometric (no
 * viewBox to map through, or a `cover` fit whose content overflows the box - 
 * a sub-rect row would reveal what the box was clipping).
 *
 * ⚑ AND IT IS NOT RE-ASKED HERE, which an earlier version of this comment claimed.
 * It cannot usefully be: by the time `liftRows` runs the DOCUMENTS already carry the
 * crop as their viewBox, so answering "no" now would place a cropped document in a
 * full-stage row - the layer blown up to the whole box, which is worse than the thing
 * the predicate was refusing. The geometric half IS re-derived (via
 * {@link liftContentRect} above), because that half is about the row and can still be
 * honoured. The paint half - a corner radius, a shape clip, an off-centre
 * `object-position`, a background fill, a gradient, a caption - is decided once, at the
 * dialog. KNOWN WINDOW, small and stated rather than papered over: `runLift` re-reads
 * `getBoxes()` and tolerates the box having moved while the assets were written, so a
 * box that GAINS a caption or a background between opening the dialog and confirming it
 * gets cropped rows anyway (and the background ends up confined to the bottom layer's
 * ink). Closing it means re-deriving the documents at commit time, not re-asking here.
 *
 * Note on `shadow: depth` at z = 0: the derivation is a pure function of z
 * (section 12.5), and at z = 0 it is still a 10 px ground shadow - the bottom layer is
 * lifted off the surface too, which is the look section 7 asks for. Pass `shadow: ''`
 * for a lift that changes nothing but the layering - or `flat: true`, which is that
 * plus "keep the source's own depth": the Ungroup of an imported SVG, where a depth
 * ladder would be a surprise on a board that has no camera.
 */
export function liftRows(
  source: Box,
  layers: LiftLayerSource[],
  cfg: BoxFieldConfig & LiftFieldConfig,
  opts: LiftOptions = {},
): Box[] {
  if (!Array.isArray(layers) || !layers.length) return [];
  const flat = opts.flat === true;
  const shadow = opts.shadow === undefined ? (flat ? '' : 'depth') : opts.shadow;
  const last = layers.length - 1;

  const src = boxRect(source, cfg);
  const content = liftContentRect(src, opts.viewBox, String(opts.fit ?? 'contain'));
  const crops = layers.map((L) => (content && L.crop ? L.crop : null));
  // Peers are decided on INK, cropped or not: coherence is a property of the
  // artwork, so a lift with cropping refused still keeps its grids together.
  const depths = liftDepths(liftSlots(layers.map((L, i) => L.bbox ?? crops[i] ?? null)), opts.zClamp, opts.strength);

  return layers.map((layer, i) => {
    let row: Box = { ...source };
    if (cfg.idField) row[cfg.idField] = layer.id;
    row[cfg.imageField] = layer.src;
    if (cfg.kindField && opts.kind) row[cfg.kindField] = opts.kind;
    if (cfg.groupField && opts.group) row[cfg.groupField] = opts.group;
    if (cfg.zField && !flat) row[cfg.zField] = depths[i]!;
    if (cfg.shadowField && shadow) row[cfg.shadowField] = shadow;
    const crop = crops[i];
    if (crop && content) {
      row = liftPlaceRow(row, src, content, crop, cfg);
      // The row's rect IS the crop's rect, so `fill` is the identity map and the
      // one fit that cannot letterbox it back by a rounding hair.
      if (cfg.fitField) row[cfg.fitField] = 'fill';
    }
    // Paint order, restated as code: background on the bottom row, text on the top.
    if (i > 0) {
      if (cfg.fillField) row[cfg.fillField] = '';
      if (cfg.gradField) row[cfg.gradField] = '';
    }
    if (i < last && cfg.textField) row[cfg.textField] = '';
    return row;
  });
}

/** Where the source SVG's viewBox actually lands inside the source box, or null. */
interface LiftContent { x: number; y: number; sx: number; sy: number; vx: number; vy: number }

/**
 * Is this box one whose layers may be cropped to their ink? - ASK BEFORE
 * ENUMERATING (`enumerateSvgLayers(markup, { cropToInk: liftCanCrop(…) })`).
 *
 * The decision has to be made before the documents are derived, because a
 * cropped document and a full-stage row are not the same picture: the crop is
 * the document's viewBox, so a row that ignores it renders the layer blown up to
 * the whole box. ⚑ ONE CALLER - the Lift dialog, which asks this to configure the
 * engine (and {@link liftCropScale} beside it, for the scale the crop is snapped
 * to). `liftRows` does NOT ask it again: see its own docstring for why re-asking
 * at commit time would be actively wrong, which half it does re-derive, and the
 * window that leaves.
 *
 * It refuses on geometry it cannot map ({@link liftContentRect}) and on paint the
 * split would move: a corner radius or a shape clip (per-row clips are not one
 * clip), an `object-position` that is not centred, and - the two that surprise - 
 * a background fill or a caption, because `liftRows` leaves those on the bottom
 * and top rows, and a background confined to one layer's crop is not a
 * background. Such a box lifts exactly as it did in 1.119: full-stage rows.
 */
export function liftCanCrop(
  source: Box,
  cfg: BoxFieldConfig & LiftFieldConfig,
  opts: Pick<LiftOptions, 'viewBox' | 'fit'> = {},
): boolean {
  if (!liftContentRect(boxRect(source, cfg), opts.viewBox, String(opts.fit ?? 'contain'))) return false;
  if (cfg.radiusField && num(source[cfg.radiusField], 0) > 0) return false;
  if (cfg.clipField) {
    const clip = String(source[cfg.clipField] ?? '').trim().toLowerCase();
    if (clip && clip !== 'none') return false;
  }
  if (cfg.imgPosField) {
    const pos = String(source[cfg.imgPosField] ?? '').trim().toLowerCase();
    if (pos && pos !== 'center' && pos !== 'centre' && pos !== '50% 50%') return false;
  }
  if (cfg.fillField && source[cfg.fillField]) return false;
  if (cfg.gradField && source[cfg.gradField]) return false;
  if (cfg.textField && source[cfg.textField]) return false;
  return true;
}

/**
 * The scale a cropped row will be PLACED at - user units → canvas px, per axis - 
 * or null when there is no map (the same refusal {@link liftCanCrop} makes).
 *
 * Handed to `enumerateSvgLayers`'s `cropScale` so the engine can snap each crop
 * to whole ROW pixels instead of whole user units. The two are the same number
 * only at k = 1, and a lifted box is any size: at k = 0.694 (a 1440-wide shot in
 * a 1000-wide box) a user-unit crop puts every row between device pixels and the
 * browser resamples the whole layer, which costs more fidelity than the crop was
 * ever going to buy. Same inputs as `liftRows`' own placement, and it is the same
 * function underneath, so the dialog and the write cannot disagree about k.
 */
export function liftCropScale(
  source: Box,
  cfg: BoxFieldConfig & LiftFieldConfig,
  opts: Pick<LiftOptions, 'viewBox' | 'fit'> = {},
): { x: number; y: number } | null {
  const c = liftContentRect(boxRect(source, cfg), opts.viewBox, String(opts.fit ?? 'contain'));
  return c ? { x: c.sx, y: c.sy } : null;
}

function liftContentRect(
  src: Rect,
  viewBox: LiftOptions['viewBox'],
  fit: string,
): LiftContent | null {
  if (!viewBox || !(viewBox.w > 0 && viewBox.h > 0) || !(src.w > 0 && src.h > 0)) return null;
  const base = { vx: viewBox.x, vy: viewBox.y };
  if (fit === 'fill') return { x: src.x, y: src.y, sx: src.w / viewBox.w, sy: src.h / viewBox.h, ...base };
  const k = fit === 'cover'
    ? Math.max(src.w / viewBox.w, src.h / viewBox.h)
    : Math.min(src.w / viewBox.w, src.h / viewBox.h);
  const w = viewBox.w * k;
  const h = viewBox.h * k;
  // `cover` that actually crops: the box is hiding part of the artwork, and a row
  // placed at the artwork's own rect would put the hidden part back on the canvas.
  if (w > src.w + 1e-6 || h > src.h + 1e-6) return null;
  return { x: src.x + (src.w - w) / 2, y: src.y + (src.h - h) / 2, sx: k, sy: k, ...base };
}

/** Write one row's rect: the crop mapped into the box, rotated with the box. */
function liftPlaceRow(
  row: Box, src: Rect, c: LiftContent,
  crop: { x: number; y: number; w: number; h: number },
  cfg: BoxFieldConfig,
): Box {
  const w = crop.w * c.sx;
  const h = crop.h * c.sy;
  const x = c.x + (crop.x - c.vx) * c.sx;
  const y = c.y + (crop.y - c.vy) * c.sy;
  // A rotated box rotates about ITS OWN centre, so a sub-rect that inherits the
  // angle has to have its CENTRE carried round the source's centre first - 
  // otherwise every row spins in place and the picture comes apart.
  const centre = rectCentre(src);
  const v = rotateVec(x + w / 2 - centre.x, y + h / 2 - centre.y, src.rot);
  const q = (n: number): number => Math.round(n * 100) / 100;
  const next: Box = { ...row };
  next[cfg.xField] = q(centre.x + v.x - w / 2);
  next[cfg.yField] = q(centre.y + v.y - h / 2);
  next[cfg.wField] = q(w);
  next[cfg.hField] = q(h);
  return next;
}

/**
 * Splice lifted rows in where the source box was - ONE commit, one undo step.
 *
 * In place, not appended: the stack has to keep the source's position in the
 * array, because array order IS z-order on this canvas (`reorderZ`), and a lift
 * that jumped its artwork to the front would re-stack the whole board.
 */
export function applyLift(boxes: Box[], index: number, rows: Box[]): Box[] {
  if (!Array.isArray(boxes) || index < 0 || index >= boxes.length || !rows.length) return boxes;
  return [...boxes.slice(0, index), ...rows, ...boxes.slice(index + 1)];
}

/**
 * Does this image-field value hold an SVG - i.e. is "Lift layers" offered at all?
 *
 * The ref's own metadata first, on `precheckAnimatedRef`'s terms (lib/anim-detect.ts):
 * a catalog vector and a `.svg` upload both come back with `type: 'vector'`, and the
 * picker records `format: 'svg'`. The URL is the fallback for a ref assembled by
 * something that recorded neither - a hook patch, a hand-written share link, an older
 * saved session - because the file extension and the `data:` MIME are the only other
 * honest signals available WITHOUT fetching. The markup sniff proper happens later and
 * elsewhere: `enumerateSvgLayers` is the thing that decides whether bytes really are a
 * liftable SVG, and it says so in words the dialog prints (section 7). This predicate only
 * decides whether the menu entry appears, so it errs towards offering: an entry that
 * opens a dialog saying "this file has no <svg> root" teaches more than a missing one.
 *
 * A Lottie is deliberately excluded even though it is vector: its layers are a JSON
 * animation, not SVG elements, and `enumerateSvgLayers` would refuse it anyway.
 */
export function isSvgImageRef(v: unknown): boolean {
  if (!v || typeof v !== 'object') return false;
  const ref = v as { type?: unknown; format?: unknown; url?: unknown };
  const format = String(ref.format ?? '').toLowerCase();
  if (format === 'lottie' || format === 'json' || ref.type === 'lottie') return false;
  if (format === 'svg' || ref.type === 'vector') return true;
  const url = typeof ref.url === 'string' ? ref.url : '';
  if (!url) return false;
  if (/^data:image\/svg\+xml[;,]/i.test(url)) return true;
  // Extension test on the PATH only - a `?v=2` cache-buster or a `#frag` must not
  // hide a `.svg`, and a `?x=.svg` query must not promote a PNG.
  return /\.svg$/i.test(url.split(/[?#]/)[0] || '');
}

/** One page of an imported document, in its own coordinates, ready to become an artboard. */
export interface ArtboardFrameSource {
  name: string;
  width: number;
  height: number;
  boxes: Box[];
  /** This page's own ground, painted as the frame's fill; else the document's. */
  background?: string;
  /** The slide's speaker notes, where the source carried them (plans/179 P2). */
  notes?: string;
}

export interface ArtboardLayoutOpts {
  cfg: BoxFieldConfig & {
    kindField: string;
    groupField?: string;
    clipField?: string;
    labelField?: string;
    fillField?: string;
  };
  /** The frame primitive's field names (canvas.frameField / frameKind / orderField). */
  frameField: string;
  frameKind: string;
  orderField?: string;
  /** The Artboard add-kind's seed - the frame box's declared look (kind, bg, …). */
  frameSeed?: Box | null;
  /** Mint an id unused by `used` - the shell's ULID minter. */
  mintId: (used: Box[]) => string;
  /** Page ground painted onto every frame that has no fill of its own. */
  background?: string;
  /** Horizontal gap between artboards, px. Default 8 % of the widest page (min 40). */
  gap?: number;
  /** The frame field a page's SPEAKER NOTES land in (Design: 'notes'). Without it an
   *  imported deck's notes are parsed and then thrown away (plans/179 P2). */
  notesField?: string;
}

/**
 * Lay imported pages out as ARTBOARDS: one frame box per page, left to right along
 * y = 0 with a gap between them, each page's boxes inside it as members. Pure - ids
 * come from `mintId`, field names from the caller - so the deck import and its test
 * share one layout.
 *
 * What a member needs to be a member: its rect shifted by the frame's origin (frames
 * store their children at ABSOLUTE canvas coordinates plus a `frame` field naming the
 * page - `frameLocalXY` is what the hook subtracts back out), a fresh id (every page
 * arrives from `finalizeBoxes` as `p0, p1, …`, so two pages collide on every id), and
 * the references that point at those ids re-pointed: a clip's mask id, and the group
 * tags, which are compared for equality across the WHOLE document and would otherwise
 * merge page 3's "g2" with page 7's. The frame boxes carry `order` = page index, the
 * hook's play order, and the page's own name where the tool has a label field.
 *
 * The first artboard sits at the origin so it coincides with the export frame - the
 * same rule `addArtboard` follows - and the pages keep their own sizes: a deck of
 * 16:9 slides with one portrait handout stays a deck with one portrait handout.
 */
export function layoutArtboards(frames: ArtboardFrameSource[], opts: ArtboardLayoutOpts): Box[] {
  const { cfg, frameField, frameKind, orderField, mintId } = opts;
  const list = Array.isArray(frames) ? frames.filter((f) => f && f.width > 0 && f.height > 0) : [];
  if (!list.length) return [];
  const widest = list.reduce((m, f) => Math.max(m, f.width), 0);
  const gap = Number.isFinite(opts.gap) && (opts.gap as number) >= 0 ? (opts.gap as number) : Math.max(40, Math.round(widest * 0.08));

  const out: Box[] = [];
  let x = 0;
  list.forEach((frame, index) => {
    const fid = mintId(out);
    const seed = { ...(opts.frameSeed || {}) } as Box;
    const fb: Box = seedBox(cfg, {}, seed, { x, y: 0, w: frame.width, h: frame.height, rot: 0 }, fid);
    fb[cfg.kindField] = frameKind;
    if (orderField) fb[orderField] = index;
    if (cfg.labelField && frame.name) fb[cfg.labelField] = frame.name;
    if (opts.notesField && frame.notes) fb[opts.notesField] = frame.notes;
    const ground = frame.background || opts.background;
    if (cfg.fillField && ground) fb[cfg.fillField] = ground;
    fb[frameField] = '';   // a frame never nests
    out.push(fb);

    // Members: fresh ids first (minted against the growing array), then every
    // reference rewritten through the same map.
    const idMap = new Map<string, string>();
    const members = (Array.isArray(frame.boxes) ? frame.boxes : []).filter((b): b is Box => !!b && typeof b === 'object');
    for (const b of members) {
      const old = b[cfg.idField] == null ? '' : String(b[cfg.idField]);
      const id = mintId(out);
      if (old) idMap.set(old, id);
      out.push({ [cfg.idField]: id } as Box);   // reserve the id; replaced below
    }
    const base = out.length - members.length;
    members.forEach((b, i) => {
      const row: Box = { ...b };
      row[cfg.idField] = out[base + i]![cfg.idField];
      row[cfg.xField] = num(b[cfg.xField]) + x;
      row[cfg.yField] = num(b[cfg.yField]);
      row[frameField] = fid;
      if (cfg.clipField && row[cfg.clipField]) {
        const to = idMap.get(String(row[cfg.clipField]));
        row[cfg.clipField] = to ?? '';
      }
      if (cfg.groupField && row[cfg.groupField]) row[cfg.groupField] = `${index}.${String(row[cfg.groupField])}`;
      out[base + i] = row;
    });
    x += frame.width + gap;
  });
  return out;
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
  const x = Math.min(x0, x1), y = Math.min(y0, y1);
  let w = Math.abs(x1 - x0), h = Math.abs(y1 - y0);
  if (w < minSize) w = minSize;
  if (h < minSize) h = minSize;
  return { x, y, w, h };
}

// ── Group transforms (multi-selection: scale + rotate about a pivot) ──────────
// A group / multi-selection scales UNIFORMLY (shear-free - a rotated box can't
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

/** Persistent document guide positions to add to the ordinary artboard/object targets. */
export interface SnapLines {
  x?: readonly number[];
  y?: readonly number[];
  angled?: readonly { x: number; y: number; rotation: number }[];
}

/** Nearest perpendicular projection onto an authored, non-axis-aligned guide. */
function snapAngled(points: Point[], lines: SnapLines, threshold: number, canvas: Canvas): SnapMoveResult | null {
  let best: SnapMoveResult | null = null;
  let distance = threshold;
  for (const line of lines.angled ?? []) {
    if (![line.x, line.y, line.rotation].every(Number.isFinite)) continue;
    const angle = line.rotation * Math.PI / 180;
    const vx = Math.cos(angle), vy = Math.sin(angle);
    const nx = -vy, ny = vx;
    for (const point of points) {
      const d = (line.x - point.x) * nx + (line.y - point.y) * ny;
      if (Math.abs(d) > distance) continue;
      distance = Math.abs(d);
      const length = Math.hypot(canvas.w, canvas.h, line.x, line.y);
      best = { dx: d * nx, dy: d * ny, guides: [{
        x1: line.x - vx * length, y1: line.y - vy * length,
        x2: line.x + vx * length, y2: line.y + vy * length,
      }] };
    }
  }
  return best;
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
 * {minX,minY,maxX,maxY}. Returns { dx, dy, guides:[{x1,y1,x2,y2}] } - the extra
 * translation that lands an edge/centre on a target, plus guide segments.
 */
export function snapMove(active: AABB, others: AABB[], canvas: Canvas, threshold: number, lines: SnapLines = {}): SnapMoveResult {
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
  for (const x of lines.x ?? []) if (Number.isFinite(x)) xTargets.push({ v: x, span: [0, canvas.h] });
  for (const y of lines.y ?? []) if (Number.isFinite(y)) yTargets.push({ v: y, span: [0, canvas.w] });
  const bx = pickSnap([active.minX, acx, active.maxX], xTargets, threshold);
  const by = pickSnap([active.minY, acy, active.maxY], yTargets, threshold);
  const diagonal = snapAngled(
    [active.minX, acx, active.maxX].flatMap(x => [active.minY, acy, active.maxY].map(y => ({ x, y }))),
    lines, threshold, canvas
  );
  if (diagonal && (!bx && !by || Math.hypot(diagonal.dx, diagonal.dy) < Math.hypot(bx?.d ?? 0, by?.d ?? 0))) return diagonal;
  const guides: Guide[] = [];
  if (bx) guides.push({ x1: bx.line, y1: bx.span![0], x2: bx.line, y2: bx.span![1] });
  if (by) guides.push({ x1: by.span![0], y1: by.line, x2: by.span![1], y2: by.line });
  return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guides };
}

/**
 * Snap a single pointer/corner point (native px) to the artboard + sibling
 * edge/centre lines. Used for create-drag and unrotated resize (the handle
 * follows the pointer, so snapping the pointer aligns the moving edge).
 * Returns { x, y, guides }.
 */
export function snapPoint(px: number, py: number, others: AABB[], canvas: Canvas, threshold: number, lines: SnapLines = {}): SnapPointResult {
  const xTargets: SnapTarget[] = [{ v: 0 }, { v: canvas.w / 2 }, { v: canvas.w }];
  const yTargets: SnapTarget[] = [{ v: 0 }, { v: canvas.h / 2 }, { v: canvas.h }];
  for (const o of others) {
    xTargets.push({ v: o.minX }, { v: (o.minX + o.maxX) / 2 }, { v: o.maxX });
    yTargets.push({ v: o.minY }, { v: (o.minY + o.maxY) / 2 }, { v: o.maxY });
  }
  for (const x of lines.x ?? []) if (Number.isFinite(x)) xTargets.push({ v: x });
  for (const y of lines.y ?? []) if (Number.isFinite(y)) yTargets.push({ v: y });
  const bx = pickSnap([px], xTargets, threshold);
  const by = pickSnap([py], yTargets, threshold);
  const diagonal = snapAngled([{ x: px, y: py }], lines, threshold, canvas);
  if (diagonal && (!bx && !by || Math.hypot(diagonal.dx, diagonal.dy) < Math.hypot(bx?.d ?? 0, by?.d ?? 0))) {
    return { x: px + diagonal.dx, y: py + diagonal.dy, guides: diagonal.guides };
  }
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

// ── Connector / edge geometry - re-exported from the engine (plan 90 R1) ──────────
// The routing, arrowheads, endpoint model, and the committed-SVG builder now live in
// engine/src/connectors.ts as the ONE source, so the editor preview here, the committed
// export, and the CLI all emit identical geometry. Re-exported so every existing
// `from './free-canvas-math.ts'` import keeps working unchanged.
export {
  edgeAnchor, edgeBorderPt, edgeWaypoints, edgeNested, connectorRoute,
  roundedEdgePath, smoothEdgePath, edgeArrowHead, edgeHeadInset,
  isEdgePoint, parseEdgePoint, formatEdgePoint, edgeEndRect, buildConnectorSvg,
  // plan 96 P3/P5 - the ONE routed-line renderer (a legacy edge and a bound path both end
  // up here) and the ONE spline-kind → route mapping the editor and the pack hooks share.
  routedLineSvg, pathRouteStyle, isConnectorRouteStyle, CONNECTOR_ROUTE_STYLES,
} from '@lolly/engine';
export type { EdgeRect, EdgeAnchor, ConnectorRoute, ConnectorRenderOpts, ConnectorDecor } from '@lolly/engine';

// ── path end tangents (plan 96 P1 - arrowheads on an authored path) ──────────
//
// An arrowhead needs a tip and a direction. On a connector the direction comes out of the
// route (`ConnectorRoute.tux/tuy`); on an AUTHORED path there is no route, so it is read
// off the lowered curve - which is the only honest source, since the same nodes lower to
// different tangents under different spline kinds.
//
// Both vectors point OUT of the path, i.e. the way a head at that end faces: `start` is
// the reverse of the direction the curve leaves node 0 in, `end` is the direction it
// arrives at its last node along. That is exactly `edgeArrowHead`'s (ux, uy).

/** A cubic segment as the engine lowers it: [x0,y0, c1x,c1y, c2x,c2y, x3,y3]. */
type CubicTuple = readonly number[];

/** Unit vector from a → b, or null when they coincide (nothing to point along). */
function unitFrom(ax: number, ay: number, bx: number, by: number): Point | null {
  const dx = bx - ax, dy = by - ay;
  const L = Math.hypot(dx, dy);
  return L > 1e-9 ? { x: dx / L, y: dy / L } : null;
}

/**
 * The outward unit tangents at a lowered path's two ends, or null when the whole path is
 * degenerate (every control point coincident - a "path" with no direction anywhere).
 *
 * A zero-length control leg is stepped over rather than trusted: a cubic whose second
 * control point sits exactly on its endpoint is ordinary (it is what a straight segment
 * out of `fromNodes` looks like), and normalising that leg would divide by zero. Only when
 * a whole end segment is degenerate does the walk continue into the neighbouring one.
 */
export function pathEndTangents(cubics: CubicTuple[]): { start: Point; end: Point } | null {
  if (!cubics.length) return null;
  let start: Point | null = null;
  for (let i = 0; i < cubics.length && !start; i++) {
    const c = cubics[i]!;
    const x0 = c[0]!, y0 = c[1]!;
    for (const [xi, yi] of [[2, 3], [4, 5], [6, 7]] as const) {
      // Reversed: a head at the START points back out of the curve.
      const u = unitFrom(c[xi]!, c[yi]!, x0, y0);
      if (u) { start = u; break; }
    }
  }
  let end: Point | null = null;
  for (let i = cubics.length - 1; i >= 0 && !end; i--) {
    const c = cubics[i]!;
    const x3 = c[6]!, y3 = c[7]!;
    for (const [xi, yi] of [[4, 5], [2, 3], [0, 1]] as const) {
      const u = unitFrom(c[xi]!, c[yi]!, x3, y3);
      if (u) { end = u; break; }
    }
  }
  return start && end ? { start, end } : null;
}

/** The two points a path's heads sit ON: its first and last lowered point. */
export function pathEndPoints(cubics: CubicTuple[]): { start: Point; end: Point } | null {
  if (!cubics.length) return null;
  const a = cubics[0]!, z = cubics[cubics.length - 1]!;
  return { start: { x: a[0]!, y: a[1]! }, end: { x: z[6]!, y: z[7]! } };
}

// ── authored dash arrays (plan 96 P0 - the power-user dash field) ─────────────
//
// A path box's dash STYLE is a keyword (solid/dashed/dotted) whose pattern the tool's
// hook derives from the stroke width. A power user wants the actual numbers, so the
// stroke panel offers a text field alongside - "6 4", "8 4 2 4" - and this is the
// parse that decides whether what was typed is a pattern at all.
//
// The canonical stored form is SPACE-separated, deliberately: the compact blocks URL
// splits rows on '~' and fields on ',', and neither separator can be escaped inside a
// value (see lib/blocks-url.ts), so a comma-bearing dash array would push every
// design link onto the lossless JSON fallback. Commas are ACCEPTED on the way in
// (they are what every other tool prints) and normalised away by formatDashArray.
//
// This is the SHELL's copy of a contract the engine also owns: at runtime the panel
// prefers `host.connectors.dashFit.parse` when the running engine carries it, and falls
// back to this. Kept here rather than imported so the field still validates on an engine
// that predates the primitive, and pure so it is testable without a DOM.

/** How many entries a dash pattern may carry. SVG allows any count; this is a sanity
 *  bound on a hand-typed field, well past the longest pattern anyone authors. */
export const DASH_ARRAY_MAX = 16;

/**
 * A typed dash pattern → its numbers, or null when it is not one.
 *
 * Rejects - rather than repairs - anything that is not a plain list of non-negative
 * finite numbers, because the caller's answer to null is "show the error and write
 * NOTHING to the box". A pattern of nothing but zeros is rejected too: it paints an
 * invisible stroke, which reads as a broken shape rather than as a style choice.
 * An empty/blank string is not an error - it is "no authored array" - and returns [].
 */
export function parseDashArray(text: string | null | undefined): number[] | null {
  const s = String(text ?? '').trim();
  if (!s) return [];
  const parts = s.split(/[\s,]+/).filter(Boolean);
  if (!parts.length || parts.length > DASH_ARRAY_MAX) return null;
  const out: number[] = [];
  for (const p of parts) {
    // Number() would take '0x10', '1e3', 'Infinity' and ''. Pin the grammar instead.
    if (!/^\d*\.?\d+$/.test(p)) return null;
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0) return null;
    out.push(n);
  }
  return out.some((n) => n > 0) ? out : null;
}

/** The canonical stored form of a parsed pattern: space-separated, at most two decimals
 *  (the same rounding the hook's `f2` applies before the number reaches the attribute,
 *  so what is stored is what is drawn). */
export function formatDashArray(nums: number[]): string {
  return nums.map((n) => String(Math.round(n * 100) / 100)).join(' ');
}

// ── on-canvas gradient editing ───────────────────────────────────────────────
//
// The geometry behind dragging a gradient's stops and direction directly on the
// artboard. DOM-free and unit-tested for the usual reason: a gesture that lands a
// stop 3% off is invisible in review and obvious to the person using it.

/** The two ends of a gradient's line: where 0% and 100% sit, in box-local px. */
export interface GradientLine {
  from: Point;
  to: Point;
}

/**
 * The gradient line for a `w`×`h` box at `angleDeg`, in CSS `linear-gradient`
 * terms: 0° points UP (the gradient runs bottom→top), 90° points right, and the
 * line is centred on the box and long enough that its ends sit exactly where the
 * first and last stop colours become solid.
 *
 * That length is not the box diagonal - CSS defines it as the projection of the
 * box onto the gradient direction, |w·sin θ| + |h·cos θ|, which is what makes a
 * 45° gradient reach the corners of a rectangle rather than stopping short. Using
 * the diagonal instead is the classic off-by-a-bit that makes on-canvas handles
 * disagree with the paint underneath them.
 */
export function gradientLine(w: number, h: number, angleDeg: number): GradientLine {
  const rad = (((angleDeg % 360) + 360) % 360) * Math.PI / 180;
  // CSS angle → direction vector. 0deg = up = (0,-1) in screen coords.
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const len = Math.abs(w * dx) + Math.abs(h * dy);
  const cx = w / 2;
  const cy = h / 2;
  return {
    from: { x: cx - (dx * len) / 2, y: cy - (dy * len) / 2 },
    to: { x: cx + (dx * len) / 2, y: cy + (dy * len) / 2 },
  };
}

/**
 * Where a point falls along a gradient line, as a stop position 0–100 (clamped).
 * The point is projected ONTO the line, so a drag that wanders off the line still
 * moves the stop by the component that matters instead of stalling.
 */
export function gradientPosAt(w: number, h: number, angleDeg: number, px: number, py: number): number {
  const { from, to } = gradientLine(w, h, angleDeg);
  const vx = to.x - from.x;
  const vy = to.y - from.y;
  const len2 = vx * vx + vy * vy;
  if (!(len2 > 0)) return 0;
  const t = ((px - from.x) * vx + (py - from.y) * vy) / len2;
  return Math.min(100, Math.max(0, t * 100));
}

/**
 * The CSS gradient angle that points from the box centre toward (px, py) - what a
 * drag on the direction handle means. Snaps to the nearest `snap` degrees when
 * given one (the Shift-key affordance), so 0/45/90 are reachable exactly.
 */
export function gradientAngleAt(w: number, h: number, px: number, py: number, snap = 0): number {
  const dx = px - w / 2;
  const dy = py - h / 2;
  if (!dx && !dy) return 0;
  // Inverse of gradientLine's mapping: atan2(dx, -dy) puts 0° at "up".
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (snap > 0) deg = Math.round(deg / snap) * snap;
  return ((deg % 360) + 360) % 360;
}

// ── Frame primitive - membership + cascade geometry (plan 93 section 5/section 10) ──────────
//
// A "frame" is an ordinary box (kind === 'frame') that OWNS the boxes whose centre
// falls inside it. Membership is derived here, DOM-free, so the carousel strip is
// reproducible as N side-by-side frames: a frame at global x is the reference
// origin for its members' local coordinates. Pure - geometry read via `num`, no
// mutation of inputs, no assumption beyond flat x/y/w/h + kind/id/frame fields.

/** id of the LAST (topmost, z = array order) frame whose rect contains `box`'s centre; '' if none. A frame box never nests, so it resolves to ''. */
export function resolveFrame(box: Box | undefined, frameBoxes: Box[]): string {
  if (!box || box.kind === 'frame') return '';
  const cx = num(box.x) + num(box.w) / 2;
  const cy = num(box.y) + num(box.h) / 2;
  let hit = '';
  for (const f of frameBoxes) {
    const fx = num(f?.x), fy = num(f?.y);
    if (cx >= fx && cx <= fx + num(f?.w) && cy >= fy && cy <= fy + num(f?.h)) {
      hit = f?.id == null ? '' : String(f.id);
    }
  }
  return hit;
}

/** A box's position expressed relative to its frame's origin (the frame-local coordinate). */
export function frameLocalXY(box: Box | undefined, frame: Box | undefined): Point {
  return { x: num(box?.x) - num(frame?.x), y: num(box?.y) - num(frame?.y) };
}

/** New boxes array with the frame (id === frameId) AND every member (frame === frameId) shifted by (dx,dy); others untouched, input not mutated. */
export function cascadeFrameMove(boxes: Box[], frameId: string, dx: number, dy: number): Box[] {
  const fid = String(frameId);
  return boxes.map((b) => {
    const moves = (b?.id != null && String(b.id) === fid) || (b?.frame != null && String(b.frame) === fid);
    return moves ? { ...b, x: num(b.x) + dx, y: num(b.y) + dy } : b;
  });
}

/** New frame copies with `order` (0-based) assigned left→right by ascending x, stable for ties; input not mutated. */
export function seedFrameOrder(frameBoxes: Box[], orderField = 'order', xField = 'x'): Box[] {
  const ranked = frameBoxes.map((b, i) => ({ i, x: num(b?.[xField]) }));
  ranked.sort((a, b) => a.x - b.x || a.i - b.i);
  const order: number[] = new Array(frameBoxes.length);
  ranked.forEach((r, rank) => { order[r.i] = rank; });
  return frameBoxes.map((b, i) => ({ ...b, [orderField]: order[i] }));
}

/**
 * Renumber the `order` field of frame-kind boxes densely 0..n-1 to match `seq` - an
 * ordered list of frame ids (the new page sequence). Non-frame boxes, and frame boxes
 * whose id is absent from `seq`, are returned unchanged; a frame already carrying its
 * target rank keeps its identity (no needless re-render churn). Field names are injected
 * so the shell's configurable canvas fields drive it. Input is never mutated.
 *
 * Renumbering densely (not sparsely) is deliberate: the hook sorts pages by
 * (order asc, then x asc), so a gap-free 0..n-1 sequence means the x tie-break can never
 * fight the explicit order the user just chose.
 */
export function renumberFrameOrder(
  boxes: Box[],
  seq: string[],
  fields: { kindField: string; idField: string; orderField: string; frameKind: string },
): Box[] {
  const { kindField, idField, orderField, frameKind } = fields;
  const rank = new Map<string, number>();
  seq.forEach((id, i) => rank.set(String(id), i));
  return boxes.map((b) => {
    if (!b || String(b[kindField]) !== frameKind) return b;
    const id = b[idField] == null ? '' : String(b[idField]);
    const r = rank.get(id);
    if (r == null) return b;
    const cur = b[orderField];
    // Write when unset (so 0..n-1 is dense) or when the stored rank differs; otherwise
    // keep the existing object so an unchanged frame doesn't force a re-render.
    if (cur != null && cur !== '' && Number(cur) === r) return b;
    return { ...b, [orderField]: r };
  });
}

// ── Artboard housekeeping (plans/179 section 5.2 - A1, A7, A8, A9, A13) ─────────
//
// Everything below reads the SAME page order the tool's hook reads (order asc, then x
// asc), so the shell and a headless render can never disagree about which artboard is
// slide 1. All of it is pure: boxes in, new boxes out, no DOM, no mutation.

/** The frame-primitive field names these helpers need (the shell's `canvas` flags). */
export interface FrameFields {
  idField: string;
  kindField: string;
  xField: string;
  yField: string;
  wField: string;
  hField: string;
  frameField: string;
  orderField: string;
  frameKind: string;
}

/** A box's id as a string ('' when it carries none). */
function fmId(b: Box | undefined, idField: string): string {
  const v = b?.[idField];
  return v == null ? '' : String(v);
}

/** Is this row a frame (artboard)? */
function isFrameBox(b: Box | undefined, kindField: string, frameKind: string): boolean {
  return !!b && String(b[kindField]) === frameKind;
}

/**
 * The document's artboards in PAGE order - `order` ascending, x ascending as the
 * tie-break. Exactly the comparator `frameGroupsFor` uses in the tool's hooks, which is
 * why it lives here once instead of being retyped at each call site. Input untouched.
 */
export function framesInPageOrder(
  boxes: Box[], fields: { kindField: string; xField: string; orderField: string; frameKind: string },
): Box[] {
  const { kindField, xField, orderField, frameKind } = fields;
  return boxes
    .filter((b) => isFrameBox(b, kindField, frameKind))
    .sort((a, b) => (num(a?.[orderField]) - num(b?.[orderField])) || (num(a?.[xField]) - num(b?.[xField])));
}

/**
 * The artboard the user is working ON (plans/179 A1 + A11) - the one a fill swatch should
 * paint and a still export should frame.
 *
 * Three answers in order: a SELECTED artboard is itself the active one; otherwise the
 * artboard that owns the first selected box - its STORED membership first, because that
 * is what the render reads (the hook never re-resolves geometry), with `resolveFrame` as
 * the fallback for a row that has never been through a gesture; and only with nothing
 * selected (or a selection sitting on the pasteboard) the PRIMARY artboard, i.e. the
 * first in page order. '' when the document has no artboards at all.
 */
export function activeFrameIdFor(
  boxes: Box[], selectionIds: Iterable<string>, fields: FrameFields,
): string {
  const { idField, kindField, frameField, frameKind } = fields;
  const frames = boxes.filter((b) => isFrameBox(b, kindField, frameKind));
  if (!frames.length) return '';
  const sel = new Set<string>();
  for (const id of selectionIds) sel.add(String(id));
  if (sel.size) {
    const selected = boxes.filter((b) => b && sel.has(fmId(b, idField)));
    for (const b of selected) {
      if (isFrameBox(b, kindField, frameKind)) return fmId(b, idField);
    }
    const frameIds = new Set(frames.map((f) => fmId(f, idField)));
    for (const b of selected) {
      const stored = b![frameField] == null ? '' : String(b![frameField]);
      if (stored && frameIds.has(stored)) return stored;
      const hit = resolveFrame(b, frames);
      if (hit) return hit;
    }
  }
  return fmId(framesInPageOrder(boxes, fields)[0], idField);
}

/** The page `order` a NEWLY created artboard takes: one past the highest in the document
 *  (0 when there are none). A board drawn to the LEFT of a deck is the last slide, not
 *  the first - which is the whole of plans/179 A9. */
export function nextFrameOrder(
  boxes: Box[], fields: { kindField: string; orderField: string; frameKind: string },
): number {
  const { kindField, orderField, frameKind } = fields;
  let max = -1;
  for (const b of boxes) {
    if (!isFrameBox(b, kindField, frameKind)) continue;
    const v = b![orderField];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

/**
 * Seed `order` from x on a LEGACY document - one whose artboards carry no order at all,
 * because until plans/179 nothing on the canvas ever wrote the field. Run once, on the
 * first commit that creates or deletes an artboard, so that "the order you see" becomes
 * "the order that is stored" before anything renumbers around it.
 *
 * A document where even ONE artboard carries an order is left alone: that order is a
 * user's (or an import's) explicit answer and re-deriving it from x would overwrite it.
 * Returns the SAME array when nothing was seeded, so a caller can skip a commit.
 */
export function seedFrameOrders(
  boxes: Box[], fields: { kindField: string; xField: string; orderField: string; frameKind: string },
): Box[] {
  const { kindField, orderField, frameKind } = fields;
  const frames = boxes.filter((b) => isFrameBox(b, kindField, frameKind));
  if (!frames.length) return boxes;
  const hasAny = frames.some((b) => {
    const v = b![orderField];
    return v != null && v !== '' && isFinite(Number(v));
  });
  if (hasAny) return boxes;
  const seeded = seedFrameOrder(frames, orderField, fields.xField);
  const swap = new Map<Box, Box>();
  frames.forEach((f, i) => swap.set(f!, seeded[i]!));
  return boxes.map((b) => (b && swap.has(b) ? swap.get(b)! : b));
}

/** What {@link rehomeChildrenOfDeletedFrames} did, so the caller can say it out loud. */
export interface RehomeResult {
  /** boxes with the children re-homed - SAME length and index order as the input, so the
   *  caller still drops the deleted rows by index in the same commit. */
  boxes: Box[];
  /** children moved onto the previous artboard. */
  homed: number;
  /** children left on the pasteboard (their artboard was the first one). */
  orphaned: number;
}

/**
 * Deleting an artboard must not strand its children (plans/179 A7). Before the delete,
 * every box whose `frame` names a doomed artboard is moved to the PREVIOUS surviving
 * artboard in page order - translated so it keeps its frame-LOCAL position, which is what
 * makes the move look like the slide's content arriving rather than jumping - or, when the
 * doomed artboard was the first one, is cut loose onto the pasteboard (`frame` cleared).
 *
 * Without this the children keep pointing at a dead id: still visible in the editor, and
 * absent from every PNG/PDF/PPTX export, because the render only walks boxes whose stored
 * `frame` names a live page.
 *
 * Returns an array of the SAME length - the deleted rows are untouched here, so the caller
 * filters them out by index in the same commit and the whole delete stays one undo step.
 */
export function rehomeChildrenOfDeletedFrames(
  boxes: Box[], deletedIds: Iterable<string>, fields: FrameFields,
): RehomeResult {
  const { idField, kindField, xField, yField, frameField, frameKind } = fields;
  const dead = new Set<string>();
  for (const id of deletedIds) dead.add(String(id));
  if (!dead.size) return { boxes, homed: 0, orphaned: 0 };

  // Walk the pages in order, remembering the last SURVIVOR: that is "the previous
  // artboard" for every doomed page that follows it.
  const target = new Map<string, Box | null>();
  const doomed = new Map<string, Box>();
  let prevAlive: Box | null = null;
  for (const f of framesInPageOrder(boxes, fields)) {
    const id = fmId(f, idField);
    if (dead.has(id)) { target.set(id, prevAlive); doomed.set(id, f!); }
    else prevAlive = f!;
  }
  if (!doomed.size) return { boxes, homed: 0, orphaned: 0 };

  let homed = 0;
  let orphaned = 0;
  const next = boxes.map((b) => {
    if (!b || dead.has(fmId(b, idField))) return b;          // the doomed rows are the caller's to drop
    if (isFrameBox(b, kindField, frameKind)) return b;       // a frame never belongs to a frame
    const owner = b[frameField] == null ? '' : String(b[frameField]);
    if (!owner || !doomed.has(owner)) return b;
    const src = doomed.get(owner)!;
    const dst = target.get(owner) ?? null;
    if (!dst) { orphaned++; return { ...b, [frameField]: '' }; }
    homed++;
    return {
      ...b,
      [frameField]: fmId(dst, idField),
      [xField]: num(b[xField]) + (num(dst[xField]) - num(src[xField])),
      [yField]: num(b[yField]) + (num(dst[yField]) - num(src[yField])),
    };
  });
  return { boxes: next, homed, orphaned };
}

/** What {@link duplicateFrameWithChildren} produced. */
export interface FrameDupResult {
  boxes: Box[];
  /** id of the copied artboard ('' when `frameId` named no artboard - boxes come back unchanged). */
  frameId: string;
  /** every minted id, the frame's first. */
  ids: string[];
}

/**
 * Duplicate an artboard AND everything on it (plans/179 A8).
 *
 * Three things make this more than a row copy:
 *
 *  1. **The children come too**, with fresh ids, keeping their frame-local position and
 *     pointing at the copy. Cloning the frame row alone left an empty page.
 *  2. **The copy goes clear of EVERY artboard** - past the right edge of the furthest
 *     frame, plus `gap` - never on top of one. That is not only tidiness: `resolveFrame`
 *     answers with the LAST containing frame and the copies are appended last, so a copy
 *     laid over ANY board would swallow that board's children on their next gesture - the
 *     re-bucket trap the plan describes. Clearing the original alone is not enough: every
 *     shipped multi-artboard layout puts the SAME order of gutter between its pages
 *     (carousel 56, slide-deck 80, `layoutArtboards` max(40, 8% of the width)), so
 *     `src.x + src.w + gap` drops the copy almost exactly on the NEXT slide. Placing it
 *     past the furthest board is the rule `addArtboard` already follows.
 *  3. **It takes the next page slot** - `order` = the original's + 1, with every later
 *     artboard renumbered through {@link renumberFrameOrder} - so a duplicated slide 2
 *     becomes slide 3, not slide 12.
 *
 * References BETWEEN copied rows are re-keyed: `groupField` gets a whole new group id per
 * distinct group (otherwise clicking a copy would select the original's members too), and
 * every field named in `refFields` (clip, linkOf, …) that points at a copied box is
 * repointed at its copy. A reference OUT of the copied set is left exactly as authored -
 * which is what keeps a morph key (`matchOf`, a free-text tag, not an id) working between
 * a slide and its duplicate.
 */
export function duplicateFrameWithChildren(
  boxes: Box[],
  frameId: string,
  fields: FrameFields,
  mint: { id: () => string; group?: () => string },
  opts: { gap?: number; groupField?: string; refFields?: readonly string[] } = {},
): FrameDupResult {
  const { idField, kindField, xField, yField, wField, frameField, orderField, frameKind } = fields;
  const gap = opts.gap ?? 56;
  const wanted = String(frameId);
  const src = boxes.find((b) => isFrameBox(b, kindField, frameKind) && fmId(b, idField) === wanted);
  if (!src || !wanted) return { boxes, frameId: '', ids: [] };
  const kids = boxes.filter((b) =>
    b && !isFrameBox(b, kindField, frameKind) && String(b[frameField] ?? '') === wanted);

  const sources = [src, ...kids];
  // Fresh ids minted per SOURCE ROW (not per old id) so a row that arrived without one
  // still gets a copy with an id; `idMap` is keyed by old id, for the reference re-keying.
  const newIds = sources.map(() => mint.id());
  const idMap = new Map<string, string>();
  sources.forEach((s, i) => { const old = fmId(s, idField); if (old) idMap.set(old, newIds[i]!); });

  const groupMap = new Map<string, string>();
  const gf = opts.groupField;
  if (gf && mint.group) {
    for (const s of sources) {
      const g = s[gf] == null ? '' : String(s[gf]);
      if (g && !groupMap.has(g)) groupMap.set(g, mint.group());
    }
  }

  // Clear of every artboard, same row (see 2. above), and never to the LEFT of the
  // original however the boards are laid out.
  const srcRight = num(src[xField]) + num(src[wField]);
  const deckRight = boxes.reduce((m, b) => (isFrameBox(b, kindField, frameKind)
    ? Math.max(m, num(b?.[xField]) + num(b?.[wField])) : m), srcRight);
  const dx = deckRight + gap - num(src[xField]);
  const newFrameId = newIds[0]!;
  const copies: Box[] = sources.map((s, i) => {
    const copy: Box = { ...s, [idField]: newIds[i]!, [xField]: num(s[xField]) + dx, [yField]: num(s[yField]) };
    if (s !== src) copy[frameField] = newFrameId;
    if (gf) {
      const g = s[gf] == null ? '' : String(s[gf]);
      if (g && groupMap.has(g)) copy[gf] = groupMap.get(g)!;
    }
    for (const rf of opts.refFields ?? []) {
      const v = copy[rf];
      const ref = v == null ? '' : String(v);
      if (ref && idMap.has(ref)) copy[rf] = idMap.get(ref)!;
    }
    return copy;
  });

  // The new page sequence: the copy sits immediately after its original.
  const seq: string[] = [];
  for (const f of framesInPageOrder(boxes, fields)) {
    const id = fmId(f, idField);
    seq.push(id);
    if (id === wanted) seq.push(newFrameId);
  }
  const next = renumberFrameOrder([...boxes, ...copies], seq,
    { kindField, idField, orderField, frameKind });
  return { boxes: next, frameId: newFrameId, ids: copies.map((c) => String(c[idField])) };
}

/**
 * The marquee rule for artboards (plans/179 A13, Figma's): a band selects an artboard only
 * when it FULLY ENCLOSES it. Crossing a board on the way to its cards used to grab the
 * board itself, so the next Fill recoloured the page and Delete removed the slide.
 * Children keep the ordinary "touched by the band" rule.
 *
 * `hits` are indices into `boxes` (whatever the generic marquee returned); the returned
 * array keeps their order and drops only the partially-crossed frames. Containment is
 * tested on the plain x/y/w/h rect, matching `resolveFrame` - the frame primitive never
 * rotates a page.
 */
export function filterMarqueeFrames(
  boxes: Box[], hits: readonly number[], rect: MarqueeRect,
  fields: { kindField: string; xField: string; yField: string; wField: string; hField: string; frameKind: string },
): number[] {
  const { kindField, xField, yField, wField, hField, frameKind } = fields;
  const rx = Math.min(rect.x, rect.x + rect.w);
  const ry = Math.min(rect.y, rect.y + rect.h);
  const rr = Math.max(rect.x, rect.x + rect.w);
  const rb = Math.max(rect.y, rect.y + rect.h);
  return hits.filter((i) => {
    const b = boxes[i];
    if (!isFrameBox(b, kindField, frameKind)) return true;
    const x = num(b![xField]), y = num(b![yField]);
    return rx <= x && ry <= y && rr >= x + num(b![wField]) && rb >= y + num(b![hField]);
  });
}

// ── Carousel → Design frame migration (plan 92 - folding carousel-maker into Design) ─
//
// A saved carousel-maker session stores a FLAT global-strip boxes array (global x across the
// whole N-page strip; NO kind:'frame' boxes) plus the input values pages/pageW/pageH. Design
// renders per-artboard [data-pdf-page] pages ONLY when boxes carry kind:'frame' + a `frame`
// membership field, and its render reads the STORED `frame` field - it never re-resolves
// geometry. So a bare resume of a carousel session into Design shows one flat wide strip and
// loses image-sequence / multi-page PDF / PPTX export. This shim converts the record into
// Design frame shape so those paths work again.
//
// The page math is carousel-maker/hooks.js verbatim (GAP=56, stride=pw+GAP, and pageOf =
// clamp(round((boxCentreX - pw/2)/stride), 0, count-1) with boxCentreX = box.x + max(1,box.w)/2).
// It deliberately uses pageOf (round + clamp), NOT resolveFrame (strict containment): the two
// DISAGREE in the GAP=56 seams between artboards and for out-of-strip boxes, and stamping the
// stored `frame` via pageOf is exactly what bridges that difference. PURE + DOM-free: reads the
// record, returns a NEW record, never mutates the input.

/** Which entries the carousel record carries + a boxes array, all optional (defensive). */
export type CarouselRecord = { [key: string]: unknown };

/** GAP between carousel artboards - render.pages.gap in carousel-maker/tool.json. */
const CAROUSEL_GAP = 56;

/** carousel-maker/hooks.js safeColor (the shared copy) - lets through only shapes CSS can't
 *  be smuggled past, so a hand-edited record can't inject a style property. */
function carouselSafeColor(v: unknown, fallback: string): string {
  const s = String(v == null ? '' : v).trim();
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return s;
  if (/^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)) return s;
  if (/^[a-zA-Z]+$/.test(s)) return s; // named colour (e.g. "transparent", "tomato")
  return fallback;
}

/** clamp v into [a,b] (carousel-maker/hooks.js shared clamp). */
function clampNum(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

/**
 * Pick a deterministic frame-id prefix so that `prefix + (1..count)` collides with NO existing
 * box id. Escalates by prepending 'p' until clear - deterministic and collision-free.
 */
function carouselFramePrefix(existingIds: Set<string>, count: number): string {
  let prefix = 'page-';
  while (true) {
    let clash = false;
    for (let i = 1; i <= count; i++) {
      if (existingIds.has(prefix + i)) { clash = true; break; }
    }
    if (!clash) return prefix;
    prefix = 'p' + prefix;
  }
}

/**
 * Convert a resumed carousel-maker session record into Design frame shape:
 *   • synthesize one kind:'frame' artboard box per page (x=i*stride, y=0, w=pw, h=ph, bg=pageBg,
 *     a stable unique id, order=i, clipChildren:true) - mirroring Design's frame addKind seed;
 *   • stamp every original box with `frame` = the artboard id for its pageOf() bucket, keeping
 *     GLOBAL x/y (Design's frame render does child.x − frame.x itself - do NOT pre-subtract);
 *   • return a NEW record whose boxes array is [ ...frames, ...originals ] - frames FIRST so they
 *     paint BEHIND their children (Design paints in array order, later = on top).
 *
 * ADDITIVE + defensive. Returns the record UNCHANGED when:
 *   • it is not an object, or has no `boxes` array;
 *   • its boxes already contain ANY kind:'frame' box (already a Design doc / already migrated);
 *   • it is not carousel-shaped (none of pages / pageW / pageH present).
 * The input record and its boxes/box objects are never mutated.
 */
export function migrateCarouselToFrames(record: CarouselRecord): CarouselRecord {
  if (!record || typeof record !== 'object') return record;
  const boxes = (record as { boxes?: unknown }).boxes;
  if (!Array.isArray(boxes)) return record;
  // Idempotent-ish: a real Design doc / already-migrated record already carries frame boxes.
  if (boxes.some((b) => b != null && typeof b === 'object' && String((b as Box).kind) === 'frame')) return record;
  // Defensive: a non-carousel record (no page geometry at all) is left alone.
  const rec = record as { pages?: unknown; pageW?: unknown; pageH?: unknown; background?: unknown; transparentBg?: unknown };
  if (rec.pages == null && rec.pageW == null && rec.pageH == null) return record;

  const count = clampNum(Math.round(num(rec.pages as InputValue, 3)), 1, 6);
  const pw = Math.max(1, Math.round(num(rec.pageW as InputValue, 1080)));
  const ph = Math.max(1, Math.round(num(rec.pageH as InputValue, 1350)));
  const stride = pw + CAROUSEL_GAP;
  const pageBg = rec.transparentBg === true ? 'transparent' : carouselSafeColor(rec.background, '#ffffff');

  const existingIds = new Set<string>();
  for (const b of boxes) {
    const id = b != null && typeof b === 'object' ? (b as Box).id : undefined;
    if (id != null && id !== '') existingIds.add(String(id));
  }
  const prefix = carouselFramePrefix(existingIds, count);
  const frameIdFor = (page: number): string => prefix + (page + 1);

  // pageOf - carousel-maker/hooks.js verbatim (round to nearest artboard column, clamp to strip).
  const pageOf = (b: Box): number => {
    const cx = num(b?.x, 0) + Math.max(1, num(b?.w, 1)) / 2;
    return clampNum(Math.round((cx - pw / 2) / stride), 0, count - 1);
  };

  const frames: Box[] = [];
  for (let i = 0; i < count; i++) {
    frames.push({
      kind: 'frame',
      id: frameIdFor(i),
      x: i * stride,
      y: 0,
      w: pw,
      h: ph,
      bg: pageBg,
      order: i,
      clipChildren: true,
      shape: 'rect',
    });
  }

  // Stamp membership onto a COPY of each original box; global x/y preserved.
  const stamped: unknown[] = boxes.map((b) =>
    b != null && typeof b === 'object'
      ? { ...(b as Box), frame: frameIdFor(pageOf(b as Box)) }
      : b,
  );

  return { ...record, boxes: [...frames, ...stamped] };
}

// ── Frames AS scenes - turn frame order into a timeline sequence (plan 92 section Frames) ─
//
// "Frames are scenes": the frame ORDER is a slideshow. Sequencing a frame doc lays every
// frame end-to-end in TIME on a scenes lane, so the sequence clock can gate the canvas to
// ONE frame at the playhead (a slide at a time) while spatial view still shows them side
// by side. Pure - reads the frame boxes, returns a NEW boxes array, never mutates. Writes
// ONLY the timeline fields (start/dur/lane/enter/exit); the committed geometry
// (x/y/w/h/order) is untouched, so a sequenced deck still exports as the same pages.
//
// UNITS: the timeline fields store SECONDS - the same contract timeline-math.ts and the
// tool hook's startSeconds/seqDurationMs read (a frame's start*1000 becomes its
// data-t-start ms). `defaultDurMs` is expressed in MILLISECONDS for the caller's
// convenience and converted to seconds here, so a 3000 ms default is 3 s in the field and
// 3000 in the emitted data-t-dur. Storing ms straight into the field would read back as
// 3000 s and clamp to the hour ceiling - the conversion is essential, not cosmetic.

/** Ceiling for an authored time value, seconds. Mirrors timeline-math.ts MAX_TIME_S. */
const FRAME_MAX_TIME_S = 3600;
/** Floor for a scene's length, seconds. Mirrors timeline-math.ts MIN_DUR. */
const FRAME_MIN_DUR_S = 0.1;
/** ms grid for accumulated starts - mirrors timeline-math.ts r3 / packOrder. */
const r3s = (v: number): number => Math.round(v * 1000) / 1000;

/** Field names + defaults for {@link sequenceFramesInOrder}. */
export interface FrameSeqOpts {
  /** Default scene length, MILLISECONDS, for a frame with no authored dur (e.g. 3000). */
  defaultDurMs?: number;
  /** The scenes lane value written to every frame's lane field (e.g. 'seq'). */
  lane: string;
  /** Default enter transition when a frame has none authored (e.g. 'fade'). Omit to leave enter alone.
   *  Ignored for a frame whose own `transitionField` resolves to a pair - see the field below. */
  defaultEnter?: string;
  /** Default exit transition when a frame has none authored (e.g. 'fade'). Omit to leave exit alone. */
  defaultExit?: string;
  /** The FRAME sub-field holding this slide's own transition to the next one (Design's
   *  `slideTransition`). Given, each frame's enter/exit are derived from ITS value rather
   *  than from the flat defaults above. Omit for a caller with no per-frame transition
   *  (Sequence Studio), which keeps the defaults exactly as they were. */
  transitionField?: string;
  /** The DOCUMENT's transition, which a frame whose own value is empty inherits. */
  docTransition?: string;
  /**
   * Per-frame dwell FLOOR in MILLISECONDS, keyed by frame id (plans/180 T1, T7).
   *
   * `defaultDurMs` cannot express "this ONE slide must be at least 11.4 s": it fills
   * an unset dur and nothing else, so a narrated slide whose author already set a 3 s
   * dwell would cut its own voice off mid-sentence. A floor named here raises that
   * frame to `max(its own dwell, the floor)` and the pack re-flows behind it, so every
   * later slide's start shifts by exactly what the narration needed.
   *
   * A frame not named here is untouched - which is what keeps Narrate off the slides
   * that have nothing to say. Values are read through the same second/clamp discipline
   * as `defaultDurMs`, so a floor over the hour ceiling clamps rather than overflowing.
   */
  minDurMs?: Readonly<Record<string, number>>;
  /** The row's id field, read ONLY to look a frame up in {@link minDurMs}. Default 'id'. */
  idField?: string;
  startField: string;
  durField: string;
  laneField: string;
  enterField: string;
  exitField: string;
  orderField: string;
  kindField: string;
  frameKind: string;
}

/** The subset of {@link FrameSeqOpts} that {@link framesAreSequenced} reads. */
export interface FramesSequencedCfg {
  kindField: string;
  frameKind: string;
  startField: string;
  durField: string;
}

/** Absent / empty / 'none' - the three spellings of "no transition authored". */
function noTransition(v: InputValue | undefined): boolean {
  return v == null || v === '' || v === 'none';
}

/** Does `v` parse to a finite number at all (an authored start, vs an empty field)? */
function finiteField(v: InputValue | undefined): boolean {
  if (v == null || v === '') return false;
  const x = typeof v === 'number' ? v : parseFloat(v as string);
  return Number.isFinite(x);
}

/**
 * Are the doc's frames already SEQUENCED - i.e. has any frame been given timing? A frame
 * counts as sequenced once it carries a scene length (dur>0) OR an authored start. Used to
 * decide whether to OFFER "play in order": offer only when frames exist and none are timed
 * yet, so the prompt never nags once the user has sequenced (or declined) them.
 */
export function framesAreSequenced(boxes: Box[], cfg: FramesSequencedCfg): boolean {
  const rows = Array.isArray(boxes) ? boxes : [];
  for (const b of rows) {
    if (!b || String(b[cfg.kindField]) !== cfg.frameKind) continue;
    if (num(b[cfg.durField], 0) > 0) return true;
    if (finiteField(b[cfg.startField])) return true;
  }
  return false;
}

/**
 * Sequence every FRAME box end-to-end in time, in play order (order asc, then x asc - the
 * exact key frameGroupsFor / seedFrameOrder use, so the timeline order matches the editor's
 * frame numbering). Each frame gets:
 *   • start = cumulative sum of the prior frames' durations (gapless from 0),
 *   • dur   = its existing dur when >0, else the default scene length - raised to this
 *     frame's `minDurMs` floor when one is given (a narrated slide must hold its clip),
 *   • lane  = the scenes lane,
 *   • exit  = its existing transition, else the exit half of the pair its OWN slide
 *     transition means (`transitionField`, inheriting `docTransition` when empty),
 *     else the flat default,
 *   • enter = its existing transition, else the enter half of the pair its PREDECESSOR's
 *     slide transition means - the field says how a slide changes into the NEXT one, so
 *     the move into this frame was authored on the frame before it.
 * Non-frame boxes are returned untouched (same reference). The input is never mutated, and a
 * frame already at its target timing keeps object identity (no re-render churn), so the
 * operation is idempotent in value.
 */
export function sequenceFramesInOrder(boxes: Box[], opts: FrameSeqOpts): Box[] {
  const rows = Array.isArray(boxes) ? boxes : [];
  const { startField, durField, laneField, enterField, exitField, orderField, kindField, frameKind, lane } = opts;
  const clampDur = (s: number): number => (s < FRAME_MIN_DUR_S ? FRAME_MIN_DUR_S : s > FRAME_MAX_TIME_S ? FRAME_MAX_TIME_S : s);
  const clampTime = (s: number): number => (s < 0 ? 0 : s > FRAME_MAX_TIME_S ? FRAME_MAX_TIME_S : s);
  const defaultDurS = clampDur(r3s(num(opts.defaultDurMs, 3000) / 1000));
  const defEnter = opts.defaultEnter;
  const defExit = opts.defaultExit;

  // Frame indices in play order: order asc, ties broken by x asc, then array index.
  const frames: number[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && String(rows[i]![kindField]) === frameKind) frames.push(i);
  }
  frames.sort((a, b) => {
    const oa = num(rows[a]![orderField], 0), ob = num(rows[b]![orderField], 0);
    if (oa !== ob) return oa - ob;
    const xa = num(rows[a]!.x, 0), xb = num(rows[b]!.x, 0);
    return xa !== xb ? xa - xb : a - b;
  });

  // Per-frame dwell floors, seconds (plans/180 T1): a narrated slide has to hold its
  // own voice, so its length is max(what the author set, what the narration needs).
  const idField = opts.idField || 'id';
  const floors = opts.minDurMs;
  const floorOf = (i: number): number => {
    if (!floors) return 0;
    const id = String(rows[i]?.[idField] ?? '');
    const msVal = id ? floors[id] : undefined;
    if (typeof msVal !== 'number' || !Number.isFinite(msVal) || msVal <= 0) return 0;
    return clampDur(r3s(msVal / 1000));
  };

  const starts = new Map<number, number>();
  const durs = new Map<number, number>();
  let cursor = 0;
  for (const i of frames) {
    const existing = num(rows[i]![durField], 0);
    const authored = existing > 0 ? clampDur(existing) : defaultDurS;
    const d = Math.max(authored, floorOf(i));
    const room = FRAME_MAX_TIME_S - cursor;
    // ONE rounding grid (packOrder's discipline): advance the cursor by the STORED dur so
    // start[i] === start[i-1] + dur[i-1] exactly, else a gapless row grows sub-ms seams.
    const dr = clampDur(r3s(Math.min(d, room)));
    starts.set(i, cursor);
    durs.set(i, dr);
    cursor = clampTime(r3s(cursor + dr));
  }

  // The first frame in play order (cumulative start === 0) is the slide the deck OPENS on.
  // A slideshow's first slide must appear IMMEDIATELY at t=0 - transitions happen BETWEEN
  // slides - so it takes enter "none" (full opacity at local=0) rather than the default
  // "fade" that would leave it mid fade-in (opacity 0) and open the deck on a blank frame.
  // Later frames keep the default enter; the first frame still gets `defExit` so it fades
  // OUT into the second. An explicitly-authored enter is untouched (noTransition guard).
  const firstFrame = frames.length ? frames[0]! : -1;
  const trField = opts.transitionField;
  // Each frame's PREDECESSOR in play order - the frame whose "Transition to next" is the
  // move INTO this one. Absent for the first frame, which nothing precedes.
  const prevFrame = new Map<number, number>();
  for (let k = 1; k < frames.length; k++) prevFrame.set(frames[k]!, frames[k - 1]!);
  return rows.map((b, i) => {
    if (!b || !starts.has(i)) return b;
    const patch: Record<string, InputValue> = {
      [startField]: starts.get(i)!,
      [durField]: durs.get(i)!,
      [laneField]: lane,
    };
    // Which enter/exit this frame gets, resolved the one way motion-model resolves a
    // slide transition: an authored value wins, '' inherits the document's, and 'custom'
    // derives NOTHING - it is the author saying the frame's timeline rows are the truth.
    // Without a `transitionField` (Sequence Studio) the flat defaults stand, exactly as
    // they did before per-frame transitions existed.
    //
    // The field means "how THIS slide changes into the NEXT one", so the two halves come
    // off two different frames: a frame EXITS the way it says, and it ENTERS the way its
    // PREDECESSOR said. Taking both off the arriving frame is what made A ('slide') slide
    // out leftwards while B ('fade') cross-faded in - a mismatched pair the presenter
    // (which resolves min(from, to), the earlier frame) and the .pptx writer (which gives
    // slide k the transition slide k-1 authored) both already got right.
    let frameEnter = defEnter;
    let frameExit = defExit;
    if (trField) {
      const own = (v: number | undefined): string => (v == null ? '' : String(rows[v]?.[trField] ?? ''));
      const ownStr = own(i);
      const prevStr = own(prevFrame.get(i));
      const exitPair = ownStr === 'custom' ? null : slideTransitionPair(ownStr || opts.docTransition);
      const enterPair = prevStr === 'custom' ? null : slideTransitionPair(prevStr || opts.docTransition);
      frameEnter = enterPair ? enterPair.enter : undefined;
      frameExit = exitPair ? exitPair.exit : undefined;
    }
    if (frameEnter != null && noTransition(b[enterField])) patch[enterField] = i === firstFrame ? 'none' : frameEnter;
    if (frameExit != null && noTransition(b[exitField])) patch[exitField] = frameExit;
    let changed = false;
    for (const k of Object.keys(patch)) { if (b[k] !== patch[k]) { changed = true; break; } }
    return changed ? { ...b, ...patch } : b;
  });
}
