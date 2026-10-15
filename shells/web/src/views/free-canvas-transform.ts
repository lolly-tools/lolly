// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas-transform.ts - DOM-free maths for the Design canvas's selection
 * transforms (plan 311): uniform Scale, the selection-level resize, content
 * scaling, the live box transform, grab zones, rotation-aware cursors, rotation
 * snapping and two-finger pinch.
 *
 * Units: geometry is in native canvas px unless a name or a parameter says screen
 * px. The grab zones and the small-object rule measure the posed selection ON
 * SCREEN, so a zone keeps one size at every zoom; the caller maps native to screen
 * first. Angles are degrees, clockwise with y down, as CSS `rotate()` reads them.
 *
 * Every function is pure and computes from the snapshot it is handed, so a gesture
 * calls it once per frame from its start state and rounded values never compound.
 * `free-canvas-math.ts` keeps the primitives shared with the deck editor
 * (`resizeRect`, `snapAngle`, `scaleGroup`, `rotateGroup`); nothing here changes
 * their behaviour.
 */
import type { InputValue } from '../../../../engine/src/inputs.ts';
// The tilt's perspective distance. The Design hook hand-copies this constant as
// TILT_PERSPECTIVE; importing the engine's own keeps the live preview at the same distance.
import { DEFAULT_PERSPECTIVE } from '../../../../engine/src/keyframes.ts';
import {
  HANDLE_SIGN, SCALE_K_FLOOR, formatDashArray, normAngle, num, parseDashArray, rotateVec, snapAngle, uniformScaleFloor,
} from './free-canvas-math.ts';
import type { AABB, Box, Guide, HandleName, Point, Rect, StartRect } from './free-canvas-math.ts';

/** Axis-aligned bounds without their size, as the selection chrome measures them. */
type Bounds = Pick<AABB, 'minX' | 'minY' | 'maxX' | 'maxY'>;

// ── The modifier table ───────────────────────────────────────────────────────

/** The modifier keys one gesture frame was taken with: a pointer event, or the replay
 *  of the last one when a modifier key goes down or up mid-drag. */
export interface ModifierKeys {
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

/** The transform a frame belongs to: Resize, Scale (K on), a turn or a move. */
export type TransformKind = 'resize' | 'scale' | 'rotate' | 'move';

/** What the held modifiers mean for one frame. */
export interface TransformRules {
  /** One factor for both axes: Shift on a Resize, and always on a Scale. */
  keepAspect: boolean;
  /** Resize and Scale about the centre, the dragged edge following the pointer. */
  fromCentre: boolean;
  /** Smart guides and the grid. A turn has the angle magnet instead. */
  snap: boolean;
  /** The angle snap a turn takes, for {@link rotateSnap}. */
  rotate: { shift: boolean; free: boolean };
}

/**
 * The modifier table every selection transform shares (plan 311), read from each
 * frame's own event so a key pressed or released mid-drag applies at once:
 *
 * - Resize: Shift keeps the aspect, Alt works from the centre with snapping still on,
 *   and ⌘ or Ctrl suspends snapping and the grid.
 * - Scale: already uniform, so Shift adds nothing; Alt from the centre; ⌘ or Ctrl
 *   suspends snapping.
 * - Rotate: the soft 15 degree magnet; Shift gives hard steps; Alt, ⌘ or Ctrl turns freely.
 * - Move: Alt keeps its own meanings (no snapping, and a detach from layout on drop,
 *   which the drop reads itself), and ⌘ or Ctrl suspends snapping as well.
 */
export function transformRules(kind: TransformKind, keys: ModifierKeys): TransformRules {
  const shift = !!keys.shiftKey, alt = !!keys.altKey, cmd = !!(keys.metaKey || keys.ctrlKey);
  const sizing = kind === 'resize' || kind === 'scale';
  return {
    keepAspect: kind === 'scale' || (kind === 'resize' && shift),
    fromCentre: sizing && alt,
    snap: kind !== 'rotate' && !cmd && !(kind === 'move' && alt),
    rotate: { shift: kind === 'rotate' && shift, free: kind === 'rotate' && (alt || cmd) },
  };
}

// ── Uniform scale ─────────────────────────────────────────────────────────────

/** The largest uniform factor a Scale may reach: the engine's `scaleTextStory`
 *  refuses more, and text, geometry and the readout share one factor. */
export const SCALE_K_MAX = 100;

/**
 * Clamp ONE uniform factor for a whole set of boxes. The floor is the largest
 * {@link uniformScaleFloor} over the members, so the member closest to `minSize`
 * stops the set and every member keeps its aspect (clamping each box on its own
 * would turn a 120x10 divider at 50% into 60x8). A side already under `minSize` is
 * exempt; a NaN factor reads as 1, no change.
 */
export function clampScaleK(k: number, rects: ReadonlyArray<{ w: number; h: number }>, minSize: number, kMax = SCALE_K_MAX): number {
  if (Number.isNaN(k)) return 1;
  let kMin = SCALE_K_FLOOR;
  for (const r of rects) kMin = Math.max(kMin, uniformScaleFloor(r.w, r.h, minSize));
  return Math.min(kMax, Math.max(kMin, k));
}

/**
 * The uniform factor a resize result applied to its start rect, read from the
 * longer side (the more precise one, and the one a 0-height line still has). With
 * the aspect forced the two sides agree; 1 when the start rect has no size.
 */
export function scaleFactorOf(start: { w: number; h: number }, result: { w: number; h: number }): number {
  if (start.w >= start.h && start.w > 0) return result.w / start.w;
  if (start.h > 0) return result.h / start.h;
  return 1;
}

/** A corner follows the axis that changed more relative to its size (Figma); a
 *  missing axis (an edge handle, or a side with no size) defers to the other one. */
function pickUniform(sx: number, sy: number): number {
  const okX = Number.isFinite(sx), okY = Number.isFinite(sy);
  if (okX && okY) return Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
  return okX ? sx : okY ? sy : 1;
}

/**
 * The raw uniform factor for dragging `handle` of one box by the TOTAL pointer
 * delta (native px). Rotation-aware: the delta is projected onto the box's own
 * axes, as {@link resizeRect} does. `fromCentre` mirrors the drag, so the dragged
 * edge follows the pointer and the size changes by twice the projected delta.
 * Unclamped: pass the result through {@link clampScaleK}.
 */
export function handleScaleK(start: StartRect, handle: HandleName, dx: number, dy: number, fromCentre = false): number {
  const [hx, hy] = HANDLE_SIGN[handle] ?? [0, 0];
  const rot = start.rot || 0;
  const ax = rotateVec(1, 0, rot), ay = rotateVec(0, 1, rot);
  const grow = fromCentre ? 2 : 1;
  const sx = hx !== 0 && start.w > 0 ? 1 + (grow * hx * (dx * ax.x + dy * ax.y)) / start.w : NaN;
  const sy = hy !== 0 && start.h > 0 ? 1 + (grow * hy * (dx * ay.x + dy * ay.y)) / start.h : NaN;
  return pickUniform(sx, sy);
}

/**
 * One side of a box under the factor `s`: `side * s`, but never under the smaller of
 * its start size and `minSize`. {@link clampScaleK} and the per-axis clamp already keep
 * every side at or over `minSize` there, so this holds only a side that started thinner
 * (a 1 px rule, a hairline) at its own size. Without the floor `s` takes that side
 * toward 0, the commit's whole-pixel rounding writes 0, and no later scale can grow a
 * 0 back. A side of 0 stays 0.
 */
export function scaleSide(side: number, s: number, minSize: number): number {
  const next = side * s;
  return side > 0 ? Math.max(next, Math.min(side, minSize)) : next;
}

/**
 * `start` scaled uniformly by `k` about the point a `handle` drag holds still: the
 * opposite corner, the opposite edge's midpoint, or the centre with `fromCentre`.
 * Rotation-aware: the anchor stays put in world space and `rot` is unchanged. With
 * `minSize`, a side thinner than that keeps its size ({@link scaleSide}) and the anchor
 * still holds.
 */
export function scaleRectAbout(start: StartRect, handle: HandleName, k: number, fromCentre = false, minSize = 0): Rect {
  const [hx, hy] = HANDLE_SIGN[handle] ?? [0, 0];
  const rot = start.rot || 0;
  const c0 = { x: start.x + start.w / 2, y: start.y + start.h / 2 };
  const w = scaleSide(start.w, k, minSize), h = scaleSide(start.h, k, minSize);
  if (fromCentre) return { x: c0.x - w / 2, y: c0.y - h / 2, w, h, rot };
  // The anchor keeps its world point: the new centre sits the new size's half-diagonal
  // back from it, so a side held by the floor moves the centre no further than it grew.
  const a0 = rotateVec((-hx * start.w) / 2, (-hy * start.h) / 2, rot);
  const a1 = rotateVec((-hx * w) / 2, (-hy * h) / 2, rot);
  const c1 = { x: c0.x + a0.x - a1.x, y: c0.y + a0.y - a1.y };
  return { x: c1.x - w / 2, y: c1.y - h / 2, w, h, rot };
}

/** Options for {@link uniformResize}. */
export interface UniformResizeOpts {
  /** Alt: scale about the centre, mirrored so the dragged edge follows the pointer. */
  fromCentre?: boolean;
  minSize?: number;
  kMax?: number;
}

/**
 * One box's Scale drag: the clamped uniform factor for the pointer delta, and the
 * rect it gives. The same `k` then drives content scaling and the readout.
 */
export function uniformResize(start: StartRect, handle: HandleName, dx: number, dy: number, opts: UniformResizeOpts = {}): { rect: Rect; k: number } {
  const centre = !!opts.fromCentre;
  const minSize = opts.minSize ?? 8;
  const k = clampScaleK(handleScaleK(start, handle, dx, dy, centre), [start], minSize, opts.kMax);
  return { rect: scaleRectAbout(start, handle, k, centre, minSize), k };
}

// ── Scale about an anchor (the Scale popover) ────────────────────────────────

/** One of the nine points a Scale can hold still: a handle's point, or 'c' for the centre. */
export type ScaleAnchor = HandleName | 'c';

/** The nine anchors in reading order, the cells of the 3x3 picker. */
export const SCALE_ANCHORS: readonly ScaleAnchor[] = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'];

/** The world point an anchor picks out on axis-aligned bounds. */
export function anchorPoint(a: Bounds, anchor: ScaleAnchor): Point {
  const [hx, hy] = anchor === 'c' ? [0, 0] : (HANDLE_SIGN[anchor] ?? [0, 0]);
  const pick = (s: number, lo: number, hi: number): number => (s < 0 ? lo : s > 0 ? hi : (lo + hi) / 2);
  return { x: pick(hx, a.minX, a.maxX), y: pick(hy, a.minY, a.maxY) };
}

/** The handle across the box from each handle: the corner or edge a drag holds still. */
export const OPPOSITE_HANDLE: Readonly<Record<HandleName, HandleName>> = {
  n: 's', s: 'n', e: 'w', w: 'e', ne: 'sw', sw: 'ne', nw: 'se', se: 'nw',
};

/** The point a drag of `handle` holds still on axis-aligned bounds without Alt: the
 *  opposite corner, or the middle of the opposite edge. */
export function handleAnchor(a: Bounds, handle: HandleName): Point {
  return anchorPoint(a, OPPOSITE_HANDLE[handle] ?? handle);
}

/**
 * One box scaled by `k` with `anchor` held still in world space, rotation-aware: the
 * same rect a Scale drag of the opposite handle gives, or a from-centre drag for 'c'.
 * `minSize` is the drag's own floor ({@link scaleSide}).
 */
export function scaleRectAt(start: StartRect, anchor: ScaleAnchor, k: number, minSize = 0): Rect {
  if (anchor === 'c') return scaleRectAbout(start, 'se', k, true, minSize);
  return scaleRectAbout(start, OPPOSITE_HANDLE[anchor], k, false, minSize);
}

/**
 * A set scaled by one factor `k` about a world point, as the Scale popover scales a
 * selection: each member centre maps about `anchor`, each side follows
 * {@link scaleSide}, and `rot` is unchanged. Pass `k` through {@link clampScaleK} first.
 */
export function scaleMembersAt(members: ReadonlyArray<StartRect>, anchor: Point, k: number, minSize = 0): Rect[] {
  return members.map((m) => placeMember(m, anchor, k, k, false, minSize));
}

// ── Selection (group) resize and scale ───────────────────────────────────────

/** How close (degrees) a rotation must be to a quarter turn to count as one. */
export const ROT_EPS = 0.01;

/** Distance (degrees) from `rot` to the nearest multiple of `m`. */
function offMultiple(rot: number, m: number): number {
  const r = ((rot % m) + m) % m;
  return Math.min(r, m - r);
}

/** True when a box is turned a quarter (or three quarters) so its w runs along y. */
function sideways(rot: number): boolean {
  return offMultiple(rot - 90, 180) <= ROT_EPS;
}

/**
 * Whether a set can take a non-uniform (sx != sy) resize without shearing: every
 * member's rotation is a multiple of 90 degrees. A box at 30 degrees cannot hold a
 * different factor per world axis, so such a set falls back to uniform.
 */
export function canResizeNonUniform(members: ReadonlyArray<{ rot?: number }>): boolean {
  return members.every((m) => offMultiple(m.rot || 0, 90) <= ROT_EPS);
}

/** The world-axis bounding box of rotated rects (native px), or null for none. */
export function rectsAABB(rects: ReadonlyArray<StartRect>): AABB | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    const c = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
    for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const v = rotateVec((sx * r.w) / 2, (sy * r.h) / 2, r.rot || 0);
      minX = Math.min(minX, c.x + v.x); maxX = Math.max(maxX, c.x + v.x);
      minY = Math.min(minY, c.y + v.y); maxY = Math.max(maxY, c.y + v.y);
    }
  }
  if (minX > maxX) return null;
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Options for {@link transformSelection}. */
export interface SelectionTransformOpts {
  /** Shift: one factor for both axes. */
  keepAspect?: boolean;
  /** Alt: scale about the selection centre, mirrored so the dragged edge follows the pointer. */
  fromCentre?: boolean;
  /** Scale mode, or a set with a group row in it: never a different factor per axis. */
  uniformOnly?: boolean;
  minSize?: number;
  kMax?: number;
}

/** Result of {@link transformSelection}. */
export interface SelectionTransform {
  /** One rect per member, in the order given; `rot` is unchanged. */
  rects: Rect[];
  /** The selection's new bounding box. */
  aabb: AABB;
  /** The point held still. */
  anchor: Point;
  /** World-axis factors; equal when `uniform`. */
  sx: number;
  sy: number;
  /** The content factor: sx (= sy) when `uniform`, otherwise 1, since a
   *  non-uniform resize never scales content. */
  k: number;
  uniform: boolean;
}

/** A member's rect under the world factors (sx, sy) about `anchor`: its centre maps
 *  affinely, and a member turned a quarter (`swap`) takes sy on its w and sx on its h.
 *  Each side follows {@link scaleSide}, so a side thinner than `minSize` keeps its size. */
function placeMember(m: StartRect, anchor: Point, sx: number, sy: number, swap: boolean, minSize: number): Rect {
  const w = scaleSide(m.w, swap ? sy : sx, minSize), h = scaleSide(m.h, swap ? sx : sy, minSize);
  const c = { x: m.x + m.w / 2, y: m.y + m.h / 2 };
  const nc = { x: anchor.x + (c.x - anchor.x) * sx, y: anchor.y + (c.y - anchor.y) * sy };
  return { x: nc.x - w / 2, y: nc.y - h / 2, w, h, rot: m.rot || 0 };
}

/** One axis's factor clamped so no member's extent along that world axis drops
 *  under `minSize`; a member already under `minSize` on that axis is exempt. */
function clampAxis(s: number, members: ReadonlyArray<StartRect>, axis: 'x' | 'y', minSize: number, kMax: number): number {
  let lo = SCALE_K_FLOOR;
  for (const m of members) {
    const turned = sideways(m.rot || 0);
    const extent = (axis === 'x') !== turned ? m.w : m.h;
    if (extent >= minSize && extent > 0) lo = Math.max(lo, minSize / extent);
  }
  return Math.min(kMax, Math.max(lo, s));
}

/**
 * Resize or scale a selection by dragging one of the 8 handles of its start
 * bounding box `aabb` by the TOTAL pointer delta (native px). The anchor is the
 * opposite corner, the opposite edge's midpoint, or the centre with `fromCentre`.
 *
 * Non-uniform (sx != sy) only when `uniformOnly` and `keepAspect` are off and every
 * member is axis-aligned ({@link canResizeNonUniform}); a member turned a quarter
 * takes sy on its w and sx on its h. Otherwise one clamped factor drives both
 * axes: a corner follows the axis that moved further, an edge its own axis. Each
 * member centre maps affinely about the anchor, so the set stays rigid. A member side
 * that started under `minSize` (a 1 px divider in a card) is exempt from the clamp and
 * keeps its own size instead ({@link scaleSide}), so it never reaches 0.
 */
export function transformSelection(
  members: ReadonlyArray<StartRect>, aabb: Bounds, handle: HandleName, dx: number, dy: number,
  opts: SelectionTransformOpts = {},
): SelectionTransform {
  const minSize = opts.minSize ?? 8;
  const kMax = opts.kMax ?? SCALE_K_MAX;
  const [hx, hy] = HANDLE_SIGN[handle] ?? [0, 0];
  const W = aabb.maxX - aabb.minX, H = aabb.maxY - aabb.minY;
  const cx = (aabb.minX + aabb.maxX) / 2, cy = (aabb.minY + aabb.maxY) / 2;
  const fromCentre = !!opts.fromCentre;
  const anchor = {
    x: fromCentre || hx === 0 ? cx : hx > 0 ? aabb.minX : aabb.maxX,
    y: fromCentre || hy === 0 ? cy : hy > 0 ? aabb.minY : aabb.maxY,
  };
  const grow = fromCentre ? 2 : 1;
  const rawX = hx !== 0 && W > 0 ? 1 + (grow * hx * dx) / W : NaN;
  const rawY = hy !== 0 && H > 0 ? 1 + (grow * hy * dy) / H : NaN;
  const uniform = !!(opts.uniformOnly || opts.keepAspect) || !canResizeNonUniform(members);
  let sx: number, sy: number;
  if (uniform) {
    sx = sy = clampScaleK(pickUniform(rawX, rawY), members, minSize, kMax);
  } else {
    sx = Number.isFinite(rawX) ? clampAxis(rawX, members, 'x', minSize, kMax) : 1;
    sy = Number.isFinite(rawY) ? clampAxis(rawY, members, 'y', minSize, kMax) : 1;
  }
  const rects = members.map((m) => placeMember(m, anchor, sx, sy, !uniform && sideways(m.rot || 0), minSize));
  const minX = anchor.x + (aabb.minX - anchor.x) * sx, maxX = anchor.x + (aabb.maxX - anchor.x) * sx;
  const minY = anchor.y + (aabb.minY - anchor.y) * sy, maxY = anchor.y + (aabb.maxY - anchor.y) * sy;
  return {
    rects, aabb: { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }, anchor,
    sx, sy, k: uniform ? sx : 1, uniform,
  };
}

/**
 * The point a selection handle drag carries, for snapping: the handle's own point on
 * the start bounds moved by the pointer delta. The dragged edge follows the pointer,
 * from the opposite edge and from the centre alike (a from-centre drag is mirrored), so
 * snapping this point to a guide puts the edge on that guide. An edge handle drives one axis only,
 * and the axis it leaves alone is null.
 */
export function handleDragPoint(a: Bounds, handle: HandleName, dx: number, dy: number): { x: number | null; y: number | null } {
  const [hx, hy] = HANDLE_SIGN[handle] ?? [0, 0];
  return {
    x: hx === 0 ? null : (hx > 0 ? a.maxX : a.minX) + dx,
    y: hy === 0 ? null : (hy > 0 ? a.maxY : a.minY) + dy,
  };
}

/**
 * The snap guides a transformed selection really touches: a vertical guide that one of
 * the bounds' x edges reaches, a horizontal one a y edge reaches (within half a pixel),
 * on the axes the drag drives, and an angled guide that `corner` (the dragged corner,
 * passed only for a free corner drag) lies on. A uniform drag follows one axis and a
 * clamp can stop an edge short, so a guide the edges missed is dropped rather than
 * drawn where no edge reached.
 */
export function touchedGuides(guides: readonly Guide[], a: Bounds, axes: { x: boolean; y: boolean }, corner?: Point): Guide[] {
  const on = (v: number, lo: number, hi: number): boolean => Math.abs(v - lo) <= 0.5 || Math.abs(v - hi) <= 0.5;
  const onSlope = (g: Guide, p: Point): boolean => {
    const vx = g.x2 - g.x1, vy = g.y2 - g.y1, len = Math.hypot(vx, vy);
    return len > 0 && Math.abs(vx * (p.y - g.y1) - vy * (p.x - g.x1)) / len <= 0.5;
  };
  return guides.filter((g) =>
    g.x1 === g.x2 ? axes.x && on(g.x1, a.minX, a.maxX)
      : g.y1 === g.y2 ? axes.y && on(g.y1, a.minY, a.maxY)
        : !!corner && onSlope(g, corner));
}

// ── Content scaling (Scale mode) ─────────────────────────────────────────────

/** A field's manifest bounds (`min`/`max` from the box field declaration). */
export interface FieldBounds {
  min?: number;
  max?: number;
}

/** The free canvas's FieldCfg names for the content it scales, plus the declared
 *  box field ids and their bounds. Any name may be absent when a tool has no such field. */
export interface ContentScaleFields {
  fontSizeField?: string;
  radiusField?: string;
  strokeWField?: string;
  padField?: string;
  trackingField?: string;
  shadowXField?: string;
  shadowYField?: string;
  shadowBlurField?: string;
  /** The box field ids the tool declares (`fc.declaredBoxFields`). */
  declared?: Iterable<string>;
  /** Manifest bounds by field id (`fc.boxFieldBounds`). */
  bounds?: ReadonlyMap<string, FieldBounds> | Readonly<Record<string, FieldBounds>>;
}

/** Which fields a Scale touches, resolved once per tool by {@link contentScaleSpec}. */
export interface ContentScaleSpec {
  /** Plain px numbers, multiplied by k. */
  readonly lengths: readonly string[];
  /** The space-separated dash pattern field, when declared. */
  readonly dashArray: string | null;
  /** The text-wrap JSON field, when declared. */
  readonly textWrap: string | null;
  /** The web box's layout width field, when declared. */
  readonly webView: string | null;
  readonly bounds: ReadonlyMap<string, FieldBounds>;
}

/** Declared px fields found by id, as `canFlip` finds the flip fields: each tool
 *  gets the subset it declares. */
export const CONTENT_LENGTH_IDS: readonly string[] = [
  'blur', 'bgBlur', 'strokeDashLen', 'strokeGapLen', 'layoutGapX', 'layoutGapY',
  'layoutPadTop', 'layoutPadRight', 'layoutPadBottom', 'layoutPadLeft',
  'layoutMarginTop', 'layoutMarginRight', 'layoutMarginBottom', 'layoutMarginLeft',
  'layoutMinW', 'layoutMaxW', 'layoutMinH', 'layoutMaxH',
];

/** Never scaled, whatever a tool maps onto them: line height is a multiplier,
 *  opacity a percentage, and rotation, tilt and depth are not lengths. */
export const NEVER_SCALED: readonly string[] = ['lineHeight', 'opacity', 'rot', 'rx', 'ry', 'z'];

/** The largest text-wrap offset the engine accepts (`text-wrap.ts`). */
export const TEXT_WRAP_OFFSET_MAX = 1000;

/** Resolve which fields a Scale touches for one tool. */
export function contentScaleSpec(fields: ContentScaleFields): ContentScaleSpec {
  const declared = new Set(fields.declared ?? []);
  const never = new Set(NEVER_SCALED);
  const named = [
    fields.fontSizeField, fields.radiusField, fields.strokeWField, fields.padField, fields.trackingField,
    fields.shadowXField, fields.shadowYField, fields.shadowBlurField,
  ];
  const lengths = [...new Set([...named, ...CONTENT_LENGTH_IDS.filter((id) => declared.has(id))])]
    .filter((f): f is string => !!f && !never.has(f));
  const b = fields.bounds;
  const bounds: ReadonlyMap<string, FieldBounds> = b instanceof Map ? b : new Map(Object.entries(b ?? {}));
  return {
    lengths,
    dashArray: declared.has('strokeDashArray') ? 'strokeDashArray' : null,
    textWrap: declared.has('textWrap') ? 'textWrap' : null,
    webView: declared.has('webView') ? 'webView' : null,
    bounds,
  };
}

/** A present, non-empty, finite number (a number, or a numeric string), else null. */
function finiteOf(v: InputValue | undefined): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || !v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** v * k rounded to 0.1 px. A non-zero value never rounds to 0, which would turn a
 *  thin stroke or a small offset off rather than make it smaller. */
function scaleLength(v: number, k: number): number {
  const r = Math.round(v * k * 10) / 10;
  if (r === 0 && v !== 0) return v > 0 ? 0.1 : -0.1;
  return r + 0;
}

/** `next` clamped to `bounds`, except that a clamp never reverses the change: a
 *  value already outside its bounds (blocks are not clamped on write) stays put
 *  rather than jumping back across its start. */
function clampToward(v: number, next: number, bounds: FieldBounds | undefined): number {
  if (!bounds) return next;
  let c = next;
  if (bounds.min != null && c < bounds.min) c = bounds.min;
  if (bounds.max != null && c > bounds.max) c = bounds.max;
  return (c - v) * (next - v) < 0 ? v : c;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * A text-wrap setting (`{"mode":"box","offset":{"top":8,...}}`, the JSON the wrap
 * popover writes and `designTextWrap` reads) with its four px offsets scaled by
 * `k`, or null when nothing changes: empty, invalid JSON, no offsets, or offsets
 * that round to the same values. Every other key is kept in its original order.
 */
export function scaleTextWrap(raw: string, k: number): string | null {
  if (!raw.trim()) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!isRecord(parsed) || !isRecord(parsed.offset)) return null;
  const offset: Record<string, unknown> = { ...parsed.offset };
  const bounds = { min: -TEXT_WRAP_OFFSET_MAX, max: TEXT_WRAP_OFFSET_MAX };
  let changed = false;
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const v = offset[side];
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    const s = clampToward(v, scaleLength(v, k), bounds);
    if (s !== v) { offset[side] = s; changed = true; }
  }
  return changed ? JSON.stringify({ ...parsed, offset }) : null;
}

/** Options for {@link scaleBoxContent}. */
export interface ScaleContentOpts {
  /** The box's effective width at gesture start (native px): where a web box
   *  with webView 0 was laying its page out. */
  startWidth?: number;
}

/**
 * One box's content scaled by a uniform `k` (Scale mode, plan 311 Amendment 9).
 * Only a value that is present, non-empty and finite is scaled, and it is written
 * only when it changes, so an unset layout margin ('') stays unset and no absent
 * field is created. Lengths round to 0.1 px, clamp to the manifest bounds and are
 * written as numbers, even when the row stored a numeric string. The
 * dash pattern and the text-wrap JSON are parsed and written back in their stored
 * forms; an empty or invalid value is left alone. A web box laying out at its own
 * size (webView 0) gets its start width, so the page zooms with the box rather
 * than reflowing; one with a set width already zooms and is not touched. Returns
 * `box` itself when nothing changes.
 */
export function scaleBoxContent(box: Box, k: number, spec: ContentScaleSpec, opts: ScaleContentOpts = {}): Box {
  if (!(k > 0) || !Number.isFinite(k) || k === 1) return box;
  const patch: Record<string, InputValue> = {};
  for (const f of spec.lengths) {
    const v = finiteOf(box[f]);
    if (v === null) continue;
    const next = clampToward(v, scaleLength(v, k), spec.bounds.get(f));
    if (next !== v) patch[f] = next;
  }
  if (spec.dashArray) {
    const raw = box[spec.dashArray];
    const nums = typeof raw === 'string' ? parseDashArray(raw) : null;
    if (nums?.length) {
      const scaled = nums.map((n) => (n === 0 ? 0 : scaleLength(n, k)));
      if (scaled.some((n, i) => n !== nums[i])) patch[spec.dashArray] = formatDashArray(scaled);
    }
  }
  if (spec.textWrap) {
    const raw = box[spec.textWrap];
    const next = typeof raw === 'string' ? scaleTextWrap(raw, k) : null;
    if (next !== null) patch[spec.textWrap] = next;
  }
  if (spec.webView && opts.startWidth != null && Number.isFinite(opts.startWidth)) {
    const v = finiteOf(box[spec.webView]);
    // The hook rounds and floors at 0 before reading 0 as "lay out at the box size".
    if (v !== null && Math.round(v) <= 0) {
      const b = spec.bounds.get(spec.webView);
      let w = Math.round(opts.startWidth);
      if (b?.max != null) w = Math.min(b.max, w);
      if (b?.min != null) w = Math.max(b.min, w);
      if (w > 0 && w !== v) patch[spec.webView] = w;
    }
  }
  return Object.keys(patch).length ? { ...box, ...patch } : box;
}

/**
 * Which axes of a layout row take a new size under Scale. A 'hug' or 'fill' axis keeps
 * its mode and lets the layout size it from the scaled children, gaps and padding, so
 * only a fixed axis (the default) is written.
 */
export function scaledLayoutAxes(row: Box): { w: boolean; h: boolean } {
  const fixed = (v: InputValue | undefined): boolean => v !== 'hug' && v !== 'fill';
  return { w: fixed(row.layoutW), h: fixed(row.layoutH) };
}

/** A rect's top-left corner after its turn, the point a layout child's offset is
 *  measured from and to (the layout's own `basis`). */
function turnedCorner(r: StartRect): Point {
  const a = rotateVec(-r.w / 2, -r.h / 2, r.rot || 0);
  return { x: r.x + r.w / 2 + a.x, y: r.y + r.h / 2 + a.y };
}

/**
 * Where an absolutely placed layout child's row goes when a Scale grows its container
 * by `k`: the child's turned corner keeps its direction from the container's turned
 * corner at `k` times the distance, so its offset in the container's axes grows by `k`
 * whatever the anchor and the turn. Both corners are the START ones, because the layout
 * reads a child's new offset against its container's place before the edit (layout.ts
 * `sourceEdit`). `out` is the child's new size and turn; the result is its new x/y.
 */
export function scaleChildOffset(parentStart: StartRect, childStart: StartRect, out: { w: number; h: number; rot?: number }, k: number): Point {
  const p = turnedCorner(parentStart), c = turnedCorner(childStart);
  const at = turnedCorner({ x: 0, y: 0, w: out.w, h: out.h, rot: out.rot });
  return { x: p.x + (c.x - p.x) * k - at.x, y: p.y + (c.y - p.y) * k - at.y };
}

// ── Live box transform ───────────────────────────────────────────────────────

/** A box's own transform fields, as values (string or number, as rows carry them). */
export interface BoxPose {
  rot?: InputValue;
  flipH?: InputValue;
  flipV?: InputValue;
  rx?: InputValue;
  ry?: InputValue;
}

/** The tilt clamp. The same 75 is hand-copied as the hook's TILT_MAX, the manifest's
 *  rx/ry min/max, TILT_RANGE in free-canvas-fields.ts and KF_TILT_FIELD_CLAMP in
 *  bridge/sequence-plan.ts; change them together. */
export const TILT_MAX_DEG = 75;

/** The Design hook's `boolVal(v, false)`: real booleans, and the string forms a URL carries. */
function flagOf(v: InputValue | undefined): boolean {
  if (v === true || v === false) return v;
  if (v == null || v === '') return false;
  const s = String(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}

/** The hook's `tiltDeg`: clamped to the tilt band, then rounded to 0.01 degree. */
function tiltOf(v: InputValue | undefined): number {
  return Math.round(Math.min(TILT_MAX_DEG, Math.max(-TILT_MAX_DEG, num(v, 0))) * 100) / 100;
}

/**
 * The CSS transform a box element carries, rebuilt from the box's own fields in the
 * order `boxCss` composes in `community/design/hooks.js` (the `tf` string after
 * `var fh = boolVal(b.flipH, false)`): the perspective tilt first, then rotate, then
 * the flip's negative scale. CSS applies the list right to left, so the box flips
 * and turns in its own plane before the tilt pitches the finished card.
 *
 * `k` (Scale mode's live preview) is inserted between the rotate and the flip, so
 * the element keeps its start size and grows by `k` about its centre before the
 * tilt, exactly as a box committed at `k` times the size would render. With k = 1
 * the string is byte-identical to the hook's, so a drag keeps flips and tilts.
 * Rebuilt from fields, never read back from `el.style`, where the sequence applier
 * writes poses.
 */
export function boxTransformCss(pose: BoxPose, k = 1): string {
  const rot = num(pose.rot, 0);
  const parts: string[] = [];
  if (rot) parts.push(`rotate(${Math.round(rot * 10) / 10}deg)`);
  const kk = Number.isFinite(k) && k > 0 ? Number(k.toPrecision(6)) : 1;
  if (kk !== 1) parts.push(`scale(${kk})`);
  const fh = flagOf(pose.flipH), fv = flagOf(pose.flipV);
  if (fh || fv) parts.push(`scale(${fh ? -1 : 1},${fv ? -1 : 1})`);
  const rx = tiltOf(pose.rx), ry = tiltOf(pose.ry);
  if (rx || ry) {
    const tilt = [`perspective(${DEFAULT_PERSPECTIVE}px)`];
    if (ry) tilt.push(`rotateY(${ry}deg)`);
    if (rx) tilt.push(`rotateX(${rx}deg)`);
    parts.unshift(...tilt);
  }
  return parts.join(' ');
}

// ── Grab zones (screen px) ───────────────────────────────────────────────────

/** Which kind of pointer pressed. Pen follows mouse sizing (plan 311 Amendment 4). */
export type PointerKind = 'mouse' | 'pen' | 'touch';

/** A screen-px rect turned `rot` degrees about its centre (the posed selection). */
export interface ScreenRect {
  x: number;
  y: number;
  w: number;
  h: number;
  rot?: number;
}

/** An axis-aligned screen-px rect: the visible part of the stage. */
export interface ViewRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Options for {@link zoneAt} and {@link zoneLayout}. All sizes are screen px. */
export interface ZoneOpts {
  pointerKind: PointerKind;
  /** GIMP-sized zones from the visible rect (touch, or "Large grab areas"). */
  large: boolean;
  /** The visible stage, for clipping and for sizing large zones. */
  viewport: ViewRect;
  /** Edge strip thickness, centred on the edge (default 8, 12 for touch). */
  strip?: number;
  /** Corner zone side in the default sizing (default 2.5 strips: 20, 30 for touch). */
  corner?: number;
  /** Rotate zone width just outside each corner (default 20; 0 turns them off). */
  rotateZone?: number;
  /** False for rows that never rotate (artboards, locked rows): no rotate zones. */
  allowRotate: boolean;
  /** Only the edge strips, full length: no corner zones. */
  edgesOnly?: boolean;
}

export type ZoneKind = 'corner' | 'edge' | 'rotate';

/** A zone hit. `outside` is true when the point lies outside the rect itself, so a
 *  caller can ignore outer strips for a Shift, ⌘ or Ctrl press. */
export interface ZoneHit {
  kind: ZoneKind;
  handle: HandleName;
  outside: boolean;
}

/** A rect in the selection's local frame: origin at its centre, unrotated, screen px. */
export interface LocalRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** One zone's geometry, for the hover wash: local parts, and the same parts as
 *  screen-px quads (4 points each, clockwise from the local top-left). */
export interface ZoneRect {
  kind: ZoneKind;
  handle: HandleName;
  parts: LocalRect[];
  quads: Point[][];
}

/**
 * 'inside': strips and corners centred on the outline. 'outside': a small box
 * (25 px or less on an axis) gets them outside only. 'large': GIMP zones inside the
 * rect. 'narrow': a large-zone rect too small for them gets them outside.
 */
export type ZoneMode = 'inside' | 'outside' | 'large' | 'narrow';

/** Result of {@link zoneLayout}: the zones in hit-test priority order. */
export interface ZoneLayout {
  mode: ZoneMode;
  /** The large-zone corner size per axis (0 outside the large modes). */
  cornerW: number;
  cornerH: number;
  zones: ZoneRect[];
}

export const ZONE_STRIP = 8;
export const ZONE_STRIP_COARSE = 12;
export const ZONE_ROTATE = 20;
/** Penpot's small-object thresholds (screen px). */
export const SMALL_OBJECT_PX = 25;
export const TINY_OBJECT_PX = 10;
/** GIMP-style grab zone clamp (screen px): the floor is the WCAG 2.5.8 target, the
 *  ceiling the repo's 44 px touch target. */
export const GRAB_ZONE_MIN = 24;
export const GRAB_ZONE_MAX = 44;
/** A visible side under this many corner sizes switches large zones to narrow mode. */
export const NARROW_FACTOR = 3;
/** Zones are laid around a band at least this thick, so the inside of a hairline
 *  or a 0-height line can still start a move (Penpot's minimum selection rect). */
export const MIN_MOVE_PX = 10;

/**
 * Which handles the DOM chrome shows for a posed box of `wScreen`×`hScreen` screen
 * px (Penpot's rule, for every pointer). 25 px or less on an axis hides the two
 * midpoint handles that sit along that axis (a narrow width hides n and s) and
 * moves the corners outward; 10 px or less on either axis drops the corners too.
 */
export function smallObjectHandles(wScreen: number, hScreen: number): { hide: HandleName[]; outward: boolean } {
  const hide: HandleName[] = [];
  if (wScreen <= SMALL_OBJECT_PX) hide.push('n', 's');
  if (hScreen <= SMALL_OBJECT_PX) hide.push('e', 'w');
  if (wScreen <= TINY_OBJECT_PX || hScreen <= TINY_OBJECT_PX) hide.push('nw', 'ne', 'se', 'sw');
  return { hide, outward: wScreen <= SMALL_OBJECT_PX || hScreen <= SMALL_OBJECT_PX };
}

/** Sutherland-Hodgman: a convex polygon clipped to an axis-aligned rect. */
function clipToView(poly: Point[], v: ViewRect): Point[] {
  const sides: Array<(p: Point) => number> = [
    (p) => p.x - v.x, (p) => v.x + v.w - p.x, (p) => p.y - v.y, (p) => v.y + v.h - p.y,
  ];
  let out = poly;
  for (const inside of sides) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const a = input[i]!, b = input[(i + 1) % input.length]!;
      const fa = inside(a), fb = inside(b);
      if (fa >= 0) out.push(a);
      if ((fa >= 0) !== (fb >= 0)) {
        const t = fa / (fa - fb);
        out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
    if (!out.length) break;
  }
  return out;
}

/**
 * The visible part of a rotated screen rect, measured along the rect's own axes:
 * the rect clipped to the viewport, then its extent in the local frame. A rect
 * entirely off screen measures 0x0.
 */
export function visibleExtent(rect: ScreenRect, viewport: ViewRect): { w: number; h: number } {
  const rot = rect.rot || 0;
  const c = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  const corners = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as const).map(([sx, sy]) => {
    const v = rotateVec((sx * rect.w) / 2, (sy * rect.h) / 2, rot);
    return { x: c.x + v.x, y: c.y + v.y };
  });
  const clipped = clipToView(corners, viewport);
  if (!clipped.length) return { w: 0, h: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of clipped) {
    const l = rotateVec(p.x - c.x, p.y - c.y, -rot);
    x0 = Math.min(x0, l.x); x1 = Math.max(x1, l.x);
    y0 = Math.min(y0, l.y); y1 = Math.max(y1, l.y);
  }
  return { w: x1 - x0, h: y1 - y0 };
}

const CORNERS: ReadonlyArray<readonly [HandleName, number, number]> = [['nw', -1, -1], ['ne', 1, -1], ['se', 1, 1], ['sw', -1, 1]];

/** A box given in corner-folded coordinates (u, v grow outward from the corner at
 *  (hw, hh)) mapped back to the local frame for the corner with signs (sx, sy). */
function unfold(sx: number, sy: number, u0: number, u1: number, v0: number, v1: number): LocalRect {
  return {
    x0: sx > 0 ? u0 : -u1, x1: sx > 0 ? u1 : -u0,
    y0: sy > 0 ? v0 : -v1, y1: sy > 0 ? v1 : -v0,
  };
}

/**
 * The grab zones of a posed selection rect, in hit-test priority order: corners,
 * then edges, then rotate zones. All sizes are screen px and none depends on zoom.
 *
 * Default sizing (`large` off): strips of `strip` px centred on each edge, corner
 * squares of `corner` px centred on each corner, and a `rotateZone`-wide band just
 * outside each corner zone. A rect 25 px or less on an axis takes them outside
 * only, and 10 px or less drops the corners ({@link smallObjectHandles}).
 *
 * Large sizing (GIMP's crop tool): each corner zone is a quarter of the VISIBLE
 * width by a quarter of the visible height, clamped to 24-44 px, inside the rect;
 * each side zone is the edge between two corners, as thick as a corner. When the
 * visible width or height is under 3 corner sizes the zones move outside at 24 px
 * (narrow mode). There is no centre zone in either sizing: the interior is left to
 * the normal select-and-move path.
 */
export function zoneLayout(rect: ScreenRect, opts: ZoneOpts): ZoneLayout {
  const coarse = opts.pointerKind === 'touch';
  const strip = Math.max(0, opts.strip ?? (coarse ? ZONE_STRIP_COARSE : ZONE_STRIP));
  const corner = Math.max(0, opts.corner ?? strip * 2.5);
  // Touch keeps the lollipop: a finger landing just outside a corner is far more
  // often a missed resize than a turn, so the outer band is for mouse and pen.
  const rz = opts.allowRotate ? Math.max(0, opts.rotateZone ?? (coarse ? 0 : ZONE_ROTATE)) : 0;
  const hw = Math.max(rect.w, MIN_MOVE_PX) / 2, hh = Math.max(rect.h, MIN_MOVE_PX) / 2;

  let mode: ZoneMode;
  let cornerW = 0, cornerH = 0;
  let withCorners = !opts.edgesOnly;
  // Corner reach inward/outward per axis, edge band inward/outward per axis, and how
  // far each edge stops short of its corners.
  let ciX: number, ciY: number, coX: number, coY: number;
  let eiX: number, eiY: number, eoX: number, eoY: number;
  let insetX = 0, insetY = 0;
  if (opts.large) {
    const vis = visibleExtent(rect, opts.viewport);
    cornerW = Math.min(GRAB_ZONE_MAX, Math.max(GRAB_ZONE_MIN, vis.w / 4));
    cornerH = Math.min(GRAB_ZONE_MAX, Math.max(GRAB_ZONE_MIN, vis.h / 4));
    if (vis.w < NARROW_FACTOR * cornerW || vis.h < NARROW_FACTOR * cornerH) {
      mode = 'narrow';
      const n = GRAB_ZONE_MIN;
      ciX = ciY = 0; coX = coY = n;
      eiX = eiY = 0; eoX = eoY = n;
    } else {
      mode = 'large';
      const o = strip / 2;
      ciX = cornerW; ciY = cornerH; coX = coY = o;
      eiX = cornerW; eiY = cornerH; eoX = eoY = o;
      if (withCorners) { insetX = cornerW; insetY = cornerH; }
    }
  } else {
    const small = smallObjectHandles(rect.w, rect.h);
    if (small.outward) {
      mode = 'outside';
      if (small.hide.includes('nw')) withCorners = false;
      ciX = ciY = 0; coX = coY = corner / 2;
      eiX = eiY = 0; eoX = eoY = strip;
    } else {
      mode = 'inside';
      // The inward reach stops MIN_MOVE_PX short of the centre, so a coarse corner
      // on a box just over the small threshold still leaves a band to move by.
      const capX = Math.max(0, hw - MIN_MOVE_PX / 2), capY = Math.max(0, hh - MIN_MOVE_PX / 2);
      ciX = Math.min(corner / 2, capX); ciY = Math.min(corner / 2, capY); coX = coY = corner / 2;
      eiX = Math.min(strip / 2, capX); eiY = Math.min(strip / 2, capY); eoX = eoY = strip / 2;
    }
  }

  const zones: Array<{ kind: ZoneKind; handle: HandleName; parts: LocalRect[] }> = [];
  if (withCorners) {
    for (const [handle, sx, sy] of CORNERS) {
      zones.push({ kind: 'corner', handle, parts: [unfold(sx, sy, hw - ciX, hw + coX, hh - ciY, hh + coY)] });
    }
  }
  const lx = Math.max(0, hw - insetX), ly = Math.max(0, hh - insetY);
  zones.push(
    { kind: 'edge', handle: 'n', parts: [{ x0: -lx, x1: lx, y0: -hh - eoY, y1: -hh + eiY }] },
    { kind: 'edge', handle: 'e', parts: [{ x0: hw - eiX, x1: hw + eoX, y0: -ly, y1: ly }] },
    { kind: 'edge', handle: 's', parts: [{ x0: -lx, x1: lx, y0: hh - eiY, y1: hh + eoY }] },
    { kind: 'edge', handle: 'w', parts: [{ x0: -hw - eoX, x1: -hw + eiX, y0: -ly, y1: ly }] },
  );
  if (rz > 0) {
    // An L just beyond the corner zone's outer reach: the square from the rect
    // corner out to reach + rz, less the part the corner zone already holds.
    const rX = withCorners ? coX : 0, rY = withCorners ? coY : 0;
    for (const [handle, sx, sy] of CORNERS) {
      const parts = [unfold(sx, sy, hw + rX, hw + rX + rz, hh, hh + rY + rz)];
      if (rX > 0) parts.push(unfold(sx, sy, hw, hw + rX, hh + rY, hh + rY + rz));
      zones.push({ kind: 'rotate', handle, parts });
    }
  }

  const rot = rect.rot || 0;
  const c = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
  const toScreen = (x: number, y: number): Point => {
    const v = rotateVec(x, y, rot);
    return { x: c.x + v.x, y: c.y + v.y };
  };
  return {
    mode, cornerW, cornerH,
    zones: zones.map((z) => ({
      ...z,
      quads: z.parts.map((p) => [toScreen(p.x0, p.y0), toScreen(p.x1, p.y0), toScreen(p.x1, p.y1), toScreen(p.x0, p.y1)]),
    })),
  };
}

/** The zone geometry alone, for drawing the hovered zone's wash. */
export function zoneRects(rect: ScreenRect, opts: ZoneOpts): ZoneRect[] {
  return zoneLayout(rect, opts).zones;
}

/**
 * Which grab zone a screen point is in, or null: outside the viewport, in the
 * interior (the caller's normal select-and-move path runs), or clear of every
 * zone. Corners beat edges and edges beat rotate zones.
 */
export function zoneAt(point: Point, rect: ScreenRect, opts: ZoneOpts): ZoneHit | null {
  const v = opts.viewport;
  if (point.x < v.x || point.x > v.x + v.w || point.y < v.y || point.y > v.y + v.h) return null;
  const rot = rect.rot || 0;
  const l = rotateVec(point.x - (rect.x + rect.w / 2), point.y - (rect.y + rect.h / 2), -rot);
  // A point on the outline counts as inside, with room for the rotation's rounding.
  const outside = Math.abs(l.x) > rect.w / 2 + 1e-6 || Math.abs(l.y) > rect.h / 2 + 1e-6;
  for (const z of zoneLayout(rect, opts).zones) {
    if (z.parts.some((p) => l.x >= p.x0 && l.x <= p.x1 && l.y >= p.y0 && l.y <= p.y1)) {
      return { kind: z.kind, handle: z.handle, outside };
    }
  }
  return null;
}

// ── Cursors ──────────────────────────────────────────────────────────────────

export type ResizeCursor = 'ns-resize' | 'nesw-resize' | 'ew-resize' | 'nwse-resize';

/** Each handle's outward direction at rot 0 (degrees, clockwise from +x, y down). */
const HANDLE_ANGLE: Readonly<Record<HandleName, number>> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
const RESIZE_CURSORS: readonly ResizeCursor[] = ['ew-resize', 'nwse-resize', 'ns-resize', 'nesw-resize'];

/** The resize cursor nearest a handle's direction once the box is turned `rotDeg`. */
export function resizeCursorFor(handle: HandleName, rotDeg = 0): ResizeCursor {
  const a = (HANDLE_ANGLE[handle] ?? 0) + (Number.isFinite(rotDeg) ? rotDeg : 0);
  const half = ((a % 180) + 180) % 180;
  return RESIZE_CURSORS[Math.round(half / 45) % 4] ?? 'ew-resize';
}

// ── Rotation snapping ────────────────────────────────────────────────────────

/** The rotation step for Shift and for the soft magnet. */
export const ROTATE_STEP = 15;

/** Round to the NEAREST multiple of `step` (Penpot floors, which biases every
 *  snap toward the lower angle). */
export function snapAngleHard(deg: number, step = ROTATE_STEP): number {
  if (!(step > 0) || !Number.isFinite(deg)) return deg;
  return Math.round(deg / step) * step + 0;
}

/**
 * The rotation snap for the held modifiers. Shift gives hard 15 degree steps and
 * wins over the others; `free` (Alt, or ⌘/Ctrl) turns snapping off; otherwise the
 * soft magnet pulls to a 15 degree step within 4 degrees, as today.
 */
export function rotateSnap(deg: number, mods: { shift?: boolean; free?: boolean } = {}): number {
  if (mods.shift) return snapAngleHard(deg);
  if (mods.free) return deg;
  return snapAngle(deg, ROTATE_STEP, 4);
}

// ── Two-finger pinch ─────────────────────────────────────────────────────────

/** Options for {@link pinchTransform}; feed the last result's engage state back. */
export interface PinchOpts {
  /** Relative spread change that starts the scale (default 0.02, as stage-nav). */
  scaleDeadZone?: number;
  /** Twist (degrees) that starts the rotation (default 10). */
  rotateEngageDeg?: number;
  /** The scale engaged on an earlier frame, so the factor no longer drops back to 1. */
  scaleEngaged?: boolean;
  /** The twist at which rotation engaged on an earlier frame. */
  engagedAt?: number | null;
}

/** Result of {@link pinchTransform}. */
export interface PinchResult {
  /** Spread ratio since the start, 1 until the scale engages. */
  k: number;
  /** Rotation (degrees) since the twist engaged, 0 before. */
  dRot: number;
  /** Midpoint travel since the start (screen px, or whatever units the points use). */
  dx: number;
  dy: number;
  /** The start midpoint, the pivot for k and dRot. */
  centre: Point;
  scaleEngaged: boolean;
  rotateEngaged: boolean;
  /** The twist when rotation engaged, for the next call's `engagedAt`. */
  engagedAt: number | null;
}

/**
 * Scale, twist and travel from two pointers' start and current positions. The
 * scale waits for the spread to pass the dead zone, then follows the full ratio so
 * the fingers stay on the content. The twist waits for `rotateEngageDeg`, then
 * counts from the angle it engaged at, so the selection never jumps by the
 * threshold. Both stay engaged once engaged when the caller feeds back
 * `scaleEngaged` and `engagedAt`.
 */
export function pinchTransform(startA: Point, startB: Point, curA: Point, curB: Point, opts: PinchOpts = {}): PinchResult {
  const dead = opts.scaleDeadZone ?? 0.02;
  const engageDeg = opts.rotateEngageDeg ?? 10;
  const centre = { x: (startA.x + startB.x) / 2, y: (startA.y + startB.y) / 2 };
  const dx = (curA.x + curB.x) / 2 - centre.x, dy = (curA.y + curB.y) / 2 - centre.y;
  const d0 = Math.hypot(startB.x - startA.x, startB.y - startA.y);
  const d1 = Math.hypot(curB.x - curA.x, curB.y - curA.y);
  let scaleEngaged = !!opts.scaleEngaged;
  let engagedAt = opts.engagedAt ?? null;
  if (!(d0 > 0) || !(d1 > 0)) {
    return { k: 1, dRot: 0, dx, dy, centre, scaleEngaged, rotateEngaged: engagedAt != null, engagedAt };
  }
  const spread = d1 / d0;
  if (!scaleEngaged && Math.abs(spread - 1) > dead) scaleEngaged = true;
  const angle = (a: Point, b: Point): number => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const twist = normAngle(angle(curA, curB) - angle(startA, startB));
  if (engagedAt == null && Math.abs(twist) >= engageDeg) engagedAt = twist;
  const dRot = engagedAt == null ? 0 : normAngle(twist - engagedAt) + 0;
  return { k: scaleEngaged ? spread : 1, dRot, dx, dy, centre, scaleEngaged, rotateEngaged: engagedAt != null, engagedAt };
}
