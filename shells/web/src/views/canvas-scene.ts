// SPDX-License-Identifier: MPL-2.0
/**
 * Canvas Scene - the Phase-A essential core of plans/98 (Live Canvas).
 *
 * Two pure, DOM-free primitives that turn the editor's O(document) hot paths into
 * O(damage) / O(viewport) ones, WITHOUT yet touching the 8.4k-line free-canvas.ts
 * overlay. They are unit-tested here and benchmarked by scripts/bench-canvas.ts.
 *
 *   1. diffBoxes() - the DAMAGE STREAM (plans/98 section 5). Given the previous and next
 *      `boxes` arrays, report exactly which boxes changed and in which LANE, so a
 *      paint touches only the damaged nodes instead of re-emitting the whole canvas
 *      (`innerHTML` swap). The lanes are kept separate on purpose: a geometry-only
 *      change ("moved") must never invalidate a cached raster the way a content
 *      change ("restyled") does - plans/98 section 5, plans/99 section 4.3. This is also the exact
 *      diff the collaboration seam consumes: interned to stable ids it becomes the
 *      canvas-op stream (plans/99 section 7.1) - here it stays index-keyed for the shell's
 *      hot loop, matching plans/98 section 5's number[] interface.
 *
 *   2. buildHitGrid()/hitGrid() - the SPATIAL HIT INDEX (plans/98 section 6.1). A uniform
 *      AABB grid that replaces free-canvas-math.ts's linear back-to-front scan
 *      (hitTest, run per pointer event) above ~500 boxes. hitGrid() is contractually
 *      identical to hitTest() - same topmost-wins, same rotation-aware body test - 
 *      just seeded from the point's grid cell instead of every box. Proven by the
 *      co-located test (random queries, hitGrid ≡ hitTest).
 *
 * Nothing here imports the DOM, a framework, or storage; it lives in the web shell
 * (not engine/) per plans/98 section 11.3.
 */
import type { Box, BoxFieldConfig, MarqueeRect } from './free-canvas-math.ts';
import { boxAABB, boxRect, rectCentre, rotateVec, num, hitTest, marqueeHit } from './free-canvas-math.ts';

// ------------------------------------------------------------------ damage

/**
 * Field names that carry a box's STRUCTURE (paint order / frame membership /
 * grouping / kind) - the fields the manifest's `canvas` flag names beyond the
 * geometry set in {@link BoxFieldConfig}. Defaults match the shipped
 * design manifest (frame/order/group/kind).
 */
export interface StructuralFieldConfig {
  frameField?: string;
  orderField?: string;
  groupField?: string;
  kindField?: string;
}

const structuralDefaults: Required<StructuralFieldConfig> = {
  frameField: 'frame',
  orderField: 'order',
  groupField: 'group',
  kindField: 'kind',
};

/**
 * A damage set: which boxes changed, split into non-exclusive LANES (a box that
 * both moved and restyled appears in both). Indices are into the NEXT array,
 * except `removed`, which indexes the PREV array. plans/98 section 5.
 */
export interface Damage {
  /** Geometry changed (x/y/w/h/rot). Re-place the node; NEVER invalidates a raster. */
  moved: number[];
  /** A content field changed. Re-emit the node; invalidate its raster/tiles. */
  restyled: number[];
  /** New id, not present in prev. */
  added: number[];
  /** Present in prev, gone in next (indexes PREV). */
  removed: number[];
  /** Paint order / frame / group changed (reparent or reorder). */
  zChanged: number[];
  /** A `kind:"frame"` box whose geometry changed - its page bounds + membership move. */
  frames: number[];
  /** True iff any lane is non-empty. A clean paint can be skipped entirely. */
  dirty: boolean;
}

const EMPTY_DAMAGE = (): Damage => ({
  moved: [], restyled: [], added: [], removed: [], zChanged: [], frames: [], dirty: false,
});


/**
 * Diff two `boxes` arrays into a {@link Damage} set (plans/98 section 5). O(prev+next).
 * Values are compared with strict `!==`; box rows are flat scalar fields (complex
 * fields like `path` are string-encoded), so a shallow compare is exact.
 */
export function diffBoxes(
  prev: readonly Box[],
  next: readonly Box[],
  cfg: BoxFieldConfig,
  structural: StructuralFieldConfig = {},
): Damage {
  const s = { ...structuralDefaults, ...structural };
  const d = EMPTY_DAMAGE();
  const idField = cfg.idField;

  const geomFields = [cfg.xField, cfg.yField, cfg.wField, cfg.hField, cfg.rotationField];
  const structFields = [s.frameField, s.orderField, s.groupField];
  const laneSkip = new Set<string>([idField, ...geomFields, ...structFields]);

  // Intern each id ONCE (String coercion is the per-box cost; every later pass reads
  // the cached array, not the box again).
  const prevIds: string[] = new Array(prev.length);
  const prevById = new Map<string, number>();
  for (let i = 0; i < prev.length; i++) { const id = String(prev[i]![idField] ?? ''); prevIds[i] = id; prevById.set(id, i); }
  const nextIds: string[] = new Array(next.length);
  const nextById = new Map<string, number>();
  for (let i = 0; i < next.length; i++) { const id = String(next[i]![idField] ?? ''); nextIds[i] = id; nextById.set(id, i); }

  // added / removed by id-set difference.
  for (let i = 0; i < prev.length; i++) if (!nextById.has(prevIds[i]!)) d.removed.push(i);

  // Common-id relative order, for pure-reorder detection (an insert/delete alone
  // must NOT flag every trailing box as zChanged - compare rank within the ids
  // present in BOTH arrays).
  const rankPrev = new Map<string, number>();
  for (let i = 0, r = 0; i < prev.length; i++) if (nextById.has(prevIds[i]!)) rankPrev.set(prevIds[i]!, r++);
  const rankNext = new Map<string, number>();
  for (let i = 0, r = 0; i < next.length; i++) if (prevById.has(nextIds[i]!)) rankNext.set(nextIds[i]!, r++);

  for (let i = 0; i < next.length; i++) {
    const b = next[i]!;
    const id = nextIds[i]!;
    const pi = prevById.get(id);
    if (pi === undefined) { d.added.push(i); continue; }
    const p = prev[pi]!;

    let moved = false, restyled = false, zChanged = false;

    for (const f of geomFields) if (p[f] !== b[f]) { moved = true; break; }
    for (const f of structFields) if (p[f] !== b[f]) { zChanged = true; break; }
    if (rankPrev.get(id) !== rankNext.get(id)) zChanged = true;

    // content lane: any field outside id/geometry/structural changed. Box rows carry
    // a FIXED field set (the wire format is append-only - every box has every declared
    // field), so one pass over `b`'s own keys is exact; no per-box Set/array allocation.
    for (const k in b) {
      if (laneSkip.has(k)) continue;
      if (p[k] !== b[k]) { restyled = true; break; }
    }

    if (moved) {
      d.moved.push(i);
      if (String(b[s.kindField]) === 'frame') d.frames.push(i);
    }
    if (restyled) d.restyled.push(i);
    if (zChanged) d.zChanged.push(i);
  }

  d.dirty = Boolean(
    d.moved.length || d.restyled.length || d.added.length ||
    d.removed.length || d.zChanged.length,
  );
  return d;
}

/**
 * True iff `d` is a pure geometry move: some box moved, and NOTHING was restyled, added,
 * removed, reordered, or reparented, and no frame moved (a frame move changes page bounds
 * + membership, so it is not fast-pathable). The gate for the geometry paint fast-path
 * (plans/98 section 9).
 */
export function isGeometryOnlyDamage(d: Damage): boolean {
  return d.moved.length > 0
    && d.restyled.length === 0 && d.added.length === 0 && d.removed.length === 0
    && d.zChanged.length === 0 && d.frames.length === 0;
}

/**
 * The planner's relaxed gate (plans/141 WP-A item 6): like isGeometryOnlyDamage,
 * but moved FRAMES are admitted - the planner itself then proves each one is a pure
 * translation whose members rode exactly with it (their rendered position is
 * frame-LOCAL, so the page element carries them and no member patch exists). Any
 * frame damage the planner cannot prove safe still returns null → full repaint.
 */
function isMovedOnlyDamage(d: Damage): boolean {
  return d.moved.length > 0
    && d.restyled.length === 0 && d.added.length === 0 && d.removed.length === 0
    && d.zChanged.length === 0;
}

/** Field names + cross-box context the geometry fast-path planner needs (plans/98 section 9). */
export interface FastPathCfg {
  /** id/x/y/w/h/rot - the geometry lane. */
  field: BoxFieldConfig;
  frameField?: string;
  groupField?: string;
  kindField?: string;
  clipField?: string;
  /** Connector bind fields (a box referenced by a bound path is a connector endpoint). */
  bindStartField?: string;
  bindEndField?: string;
  /** Ids that are connector endpoints - a move of one restyles the shared connector SVG. */
  connectorEndpointIds?: ReadonlySet<string>;
}

/** One node to move: its id and the new rounded left/top (matches hooks.js boxCss).
 *  `frame: true` targets the artboard page element (`.lolly-frame-page[data-frame-id]`,
 *  whose inline left/top are GLOBAL) instead of a `.lolly-box[data-box-id]`. */
export interface FastPatch { id: string; x: number; y: number; frame?: boolean; }

/**
 * The set of box ids that are connector endpoints (plans/98 section 9): every non-empty
 * `bindStart`/`bindEnd` value (the boxes a bound path attaches to) UNION every `kind:"path"`
 * box's own id (the line itself). Moving any of these re-routes a connector line, so the
 * geometry fast-path must exclude them. Kept here so paint() and free-canvas derive the
 * identical set from one source.
 */
export function boundEndpointIds(
  boxes: readonly Box[],
  cfg: { idField: string; bindStartField?: string; bindEndField?: string; kindField?: string },
): Set<string> {
  const bs = cfg.bindStartField ?? 'bindStart';
  const be = cfg.bindEndField ?? 'bindEnd';
  const kf = cfg.kindField ?? 'kind';
  const ids = new Set<string>();
  for (const b of boxes) {
    if (!b) continue;
    const start = String(b[bs] ?? ''); if (start) ids.add(start);
    const end = String(b[be] ?? ''); if (end) ids.add(end);
    if (String(b[kf] ?? '') === 'path') { const id = String(b[cfg.idField] ?? ''); if (id) ids.add(id); }
  }
  return ids;
}

/**
 * Build a {@link FastPathCfg} from a canvas-input flag, defaulting the geometry field
 * names EXACTLY as free-canvas.ts does (so paint() and the overlay agree). `kind` is
 * fixed; connector endpoints are supplied by the caller from the edges input.
 */
export function resolveCanvasFastCfg(canvas: Record<string, unknown>): Omit<FastPathCfg, 'connectorEndpointIds'> {
  const s = (k: string, d?: string): string | undefined => {
    const v = canvas[k];
    return typeof v === 'string' && v ? v : d;
  };
  return {
    field: {
      idField: s('idField', 'id')!,
      xField: s('xField', 'x')!,
      yField: s('yField', 'y')!,
      wField: s('wField', 'w')!,
      hField: s('hField', 'h')!,
      rotationField: s('rotationField', 'rot')!,
    },
    frameField: s('frameField'),
    groupField: s('groupField'),
    kindField: 'kind',
    clipField: s('clipField'),
    bindStartField: s('bindStartField', 'bindStart'),
    bindEndField: s('bindEndField', 'bindEnd'),
  };
}

/**
 * Plan a geometry paint fast-path (plans/98 section 9), or return null to force a full paint.
 *
 * Returns the moved boxes' new left/top ONLY when the change is a **pure x/y translation**
 * (w/h/rot unchanged) of boxes with no cross-box or structural coupling that a full paint
 * would re-derive elsewhere - because the fast path patches ONLY each moved box's own
 * `left/top`, leaving every other node exactly as the last full paint produced it. It
 * therefore refuses when a moved box:
 *   - resized or rotated (would change `--fit`, a path child's `d`, or its own clip-path);
 *   - is a frame member (its effective left/top is a frame-local override, not the raw x/y);
 *   - is a clip source (its own clip-path polygon depends on its x/y) or a clip mask
 *     (a dependent box's baked clip-path depends on this box's geometry);
 *   - is a connector endpoint (the shared connector SVG is rebuilt from its geometry).
 * These couplings are invisible to the field-level {@link diffBoxes}, so they are checked
 * here explicitly (a mask reverse-index over `next`, the caller-supplied endpoint set).
 */
export function geometryFastPathPlan(
  prev: readonly Box[], next: readonly Box[], cfg: FastPathCfg,
): FastPatch[] | null {
  const f = cfg.field;
  const d = diffBoxes(prev, next, f, {
    frameField: cfg.frameField, groupField: cfg.groupField, kindField: cfg.kindField,
  });
  if (!isMovedOnlyDamage(d)) return null;

  const prevById = new Map<string, Box>();
  for (const b of prev) prevById.set(String(b?.[f.idField] ?? ''), b);

  // Ids some box clips against - a moved mask invalidates every dependent's baked clip.
  const maskIds = new Set<string>();
  if (cfg.clipField) {
    for (const b of next) { const m = String(b?.[cfg.clipField] ?? ''); if (m) maskIds.add(m); }
  }

  // Matches diffBoxes' own frame classification (the literal 'frame' kind).
  const isFrame = (b: Box): boolean => !!cfg.kindField && String(b[cfg.kindField]) === 'frame';

  const plan: FastPatch[] = [];

  // Pass 1 - the moved ARTBOARDS (plans/141 WP-A item 6): pure translation only, and
  // each becomes one patch against its page element. Record the delta so pass 2 can
  // prove every member rode along.
  const frameDelta = new Map<string, { dx: number; dy: number }>();
  for (const i of d.frames) {
    const box = next[i];
    if (!box) return null;
    const id = String(box[f.idField] ?? '');
    if (!id) return null; // need a stable [data-frame-id] key
    const p = prevById.get(id);
    if (!p) return null;
    if (Math.round(num(p[f.wField], 1)) !== Math.round(num(box[f.wField], 1))) return null;
    if (Math.round(num(p[f.hField], 1)) !== Math.round(num(box[f.hField], 1))) return null;
    if (num(p[f.rotationField], 0) !== num(box[f.rotationField], 0)) return null;
    if (cfg.connectorEndpointIds?.has(id)) return null;
    frameDelta.set(id, {
      dx: num(box[f.xField], 0) - num(p[f.xField], 0),
      dy: num(box[f.yField], 0) - num(p[f.yField], 0),
    });
    plan.push({ id, x: Math.round(num(box[f.xField], 0)), y: Math.round(num(box[f.yField], 0)), frame: true });
  }

  for (const i of d.moved) {
    const box = next[i];
    if (!box) return null;
    if (isFrame(box)) continue;                     // handled in pass 1
    const id = String(box[f.idField] ?? '');
    if (!id) return null; // need a stable [data-box-id] key
    const p = prevById.get(id);
    if (!p) return null;
    // pure translation only
    if (Math.round(num(p[f.wField], 1)) !== Math.round(num(box[f.wField], 1))) return null;
    if (Math.round(num(p[f.hField], 1)) !== Math.round(num(box[f.hField], 1))) return null;
    if (num(p[f.rotationField], 0) !== num(box[f.rotationField], 0)) return null;
    // cross-box exclusions shared by both member kinds
    if (cfg.clipField && String(box[cfg.clipField] ?? '') !== '') return null;   // clip source
    if (maskIds.has(id)) return null;                                            // clip mask
    if (cfg.connectorEndpointIds?.has(id)) return null;                          // connector endpoint
    const owner = cfg.frameField ? String(box[cfg.frameField] ?? '') : '';
    if (owner) {
      // A frame MEMBER renders at a frame-LOCAL position (with the frame's border
      // inset folded in by the hook), so its DOM cannot be verified against global
      // coords - and does not need to be: when it moved EXACTLY with its (also
      // moved) frame, the page element carried it and its local style is unchanged
      // by construction. Prove the ride model-side, emit nothing. Any other member
      // move (a drag inside the frame, a desynced cascade) → full repaint.
      const fd = frameDelta.get(owner);
      if (!fd) return null;
      const dx = num(box[f.xField], 0) - num(p[f.xField], 0);
      const dy = num(box[f.yField], 0) - num(p[f.yField], 0);
      if (Math.abs(dx - fd.dx) > 1e-6 || Math.abs(dy - fd.dy) > 1e-6) return null;
      continue;
    }
    plan.push({ id, x: Math.round(num(box[f.xField], 0)), y: Math.round(num(box[f.yField], 0)) });
  }
  return plan.length ? plan : null;
}

// --------------------------------------------------------------- hit index

/** A uniform AABB grid over the boxes, for O(viewport) hit-testing. */
export interface HitGrid {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly minX: number;
  readonly minY: number;
  readonly buckets: readonly (readonly number[])[];
  readonly boxes: readonly Box[];
  readonly cfg: BoxFieldConfig;
}

/** Default grid cell ≈ the median box AABB size, clamped to a sane range. */
function medianCell(boxes: readonly Box[], cfg: BoxFieldConfig): number {
  if (!boxes.length) return 256;
  const sizes: number[] = [];
  const step = Math.max(1, Math.floor(boxes.length / 512)); // sample large docs
  for (let i = 0; i < boxes.length; i += step) {
    const a = boxAABB(boxes[i], cfg);
    if (Number.isFinite(a.w) && Number.isFinite(a.h)) sizes.push(Math.max(a.w, a.h));
  }
  if (!sizes.length) return 256;
  sizes.sort((x, y) => x - y);
  const med = sizes[Math.floor(sizes.length / 2)] || 256;
  return Math.min(4096, Math.max(16, med));
}

/**
 * Build a hit grid over `boxes`. Each box is inserted into every cell its AABB
 * overlaps, so the point-cell lookup in {@link hitGrid} yields a superset of the
 * boxes whose (rotation-aware) body could contain a query point. Rebuild on
 * geometry damage (cheap: O(n) bucketing); pans/zooms need no rebuild.
 */
export function buildHitGrid(boxes: readonly Box[], cfg: BoxFieldConfig, cell?: number): HitGrid {
  const c = cell && cell > 0 ? cell : medianCell(boxes, cfg);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const aabbs: { minX: number; minY: number; maxX: number; maxY: number }[] = [];
  for (const b of boxes) {
    const a = boxAABB(b, cfg);
    aabbs.push(a);
    if (Number.isFinite(a.minX)) { if (a.minX < minX) minX = a.minX; if (a.maxX > maxX) maxX = a.maxX; }
    if (Number.isFinite(a.minY)) { if (a.minY < minY) minY = a.minY; if (a.maxY > maxY) maxY = a.maxY; }
  }
  if (!Number.isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }
  const cols = Math.max(1, Math.ceil((maxX - minX) / c) + 1);
  const rows = Math.max(1, Math.ceil((maxY - minY) / c) + 1);
  const buckets: number[][] = Array.from({ length: cols * rows }, () => []);
  const cx = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / c)));
  const cy = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / c)));
  for (let i = 0; i < boxes.length; i++) {
    const a = aabbs[i]!;
    if (!Number.isFinite(a.minX)) continue;
    for (let gy = cy(a.minY); gy <= cy(a.maxY); gy++)
      for (let gx = cx(a.minX); gx <= cx(a.maxX); gx++)
        buckets[gy * cols + gx]!.push(i);
  }
  return { cell: c, cols, rows, minX, minY, buckets, boxes, cfg };
}

/**
 * Topmost box index under a native point, honouring rotation - the grid-seeded
 * equivalent of free-canvas-math.ts `hitTest`. -1 if none. `skip` as in hitTest.
 */
export function hitGrid(grid: HitGrid, px: number, py: number, skip?: (i: number) => boolean): number {
  const { cell, cols, rows, minX, minY, buckets, boxes, cfg } = grid;
  const gx = Math.floor((px - minX) / cell);
  const gy = Math.floor((py - minY) / cell);
  if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) return -1;
  const bucket = buckets[gy * cols + gx]!;
  let best = -1;
  for (const i of bucket) {
    if (i <= best) continue; // topmost wins; a lower index can't beat the current best
    if (skip && skip(i)) continue;
    const r = boxRect(boxes[i], cfg);
    const c = rectCentre(r);
    const l = rotateVec(px - c.x, py - c.y, -r.rot);
    if (Math.abs(l.x) <= r.w / 2 && Math.abs(l.y) <= r.h / 2) best = i;
  }
  return best;
}

/** Indices whose AABB intersects a marquee rect - grid-seeded equivalent of `marqueeHit`. */
export function hitGridMarquee(grid: HitGrid, rect: MarqueeRect, skip?: (i: number) => boolean): number[] {
  const { cell, cols, rows, minX, minY, buckets, boxes, cfg } = grid;
  const mx1 = Math.min(rect.x, rect.x + rect.w), mx2 = Math.max(rect.x, rect.x + rect.w);
  const my1 = Math.min(rect.y, rect.y + rect.h), my2 = Math.max(rect.y, rect.y + rect.h);
  const cx = (x: number) => Math.min(cols - 1, Math.max(0, Math.floor((x - minX) / cell)));
  const cy = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y - minY) / cell)));
  const seen = new Set<number>();
  const out: number[] = [];
  for (let gy = cy(my1); gy <= cy(my2); gy++) {
    for (let gx = cx(mx1); gx <= cx(mx2); gx++) {
      for (const i of buckets[gy * cols + gx]!) {
        if (seen.has(i)) continue;
        seen.add(i);
        if (skip && skip(i)) continue;
        const a = boxAABB(boxes[i], cfg);
        if (a.maxX >= mx1 && a.minX <= mx2 && a.maxY >= my1 && a.minY <= my2) out.push(i);
      }
    }
  }
  out.sort((p, q) => p - q);
  return out;
}

// ---------------------------------------------------- accelerated pick (drop-in)

/**
 * Above this box count the grid beats a linear scan; below it, the scan is a few µs
 * and the grid's build cost isn't worth it (plans/98 section 6.1). Tuned from bench-canvas.
 */
export const GRID_PICK_MIN = 500;

// Grid cache keyed by the boxes ARRAY IDENTITY. The editor replaces `boxes` with a new
// array on every `setInput` (immutable updates), so a fresh array ⇒ a fresh grid, and
// repeated picks within one gesture reuse it. WeakMap ⇒ evicted when the array is gone.
const gridCache = new WeakMap<readonly Box[], HitGrid>();

function gridFor(boxes: readonly Box[], cfg: BoxFieldConfig): HitGrid {
  let g = gridCache.get(boxes);
  if (g === undefined) { g = buildHitGrid(boxes, cfg); gridCache.set(boxes, g); }
  return g;
}

/**
 * Topmost box index under a point - a DROP-IN for free-canvas-math `hitTest` that uses
 * the spatial grid on large docs and the linear scan on small ones. Result is identical
 * either way (proven in canvas-scene.test.ts). `skip` semantics match hitTest exactly.
 */
export function pickTopmost(
  boxes: readonly Box[], px: number, py: number, cfg: BoxFieldConfig, skip?: (i: number) => boolean,
): number {
  return boxes.length >= GRID_PICK_MIN
    ? hitGrid(gridFor(boxes, cfg), px, py, skip)
    : hitTest(boxes as Box[], px, py, cfg, skip);
}

/** Marquee indices - a DROP-IN for `marqueeHit`, grid-accelerated on large docs. */
export function pickMarquee(
  boxes: readonly Box[], rect: MarqueeRect, cfg: BoxFieldConfig, skip?: (i: number) => boolean,
): number[] {
  return boxes.length >= GRID_PICK_MIN
    ? hitGridMarquee(gridFor(boxes, cfg), rect, skip)
    : marqueeHit(boxes as Box[], rect, cfg, skip);
}

/** Shared field config for the shipped design canvas (id/x/y/w/h/rot). */
export const LAYOUT_STUDIO_CFG: BoxFieldConfig = {
  idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot',
};

/** Number coercion re-exported for fixture/bench code that builds raw boxes. */
export { num };
