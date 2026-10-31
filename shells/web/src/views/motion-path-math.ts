// SPDX-License-Identifier: MPL-2.0
/**
 * motion-path-math.ts - the arithmetic behind EDITING a motion path (plans/330), kept
 * apart from the overlay that draws it so every number can be tested without a DOM.
 *
 * Two spaces meet here and the module never confuses them:
 *
 *   - SURFACE offsets: what a keyframe's `x`/`y` channels and its path handles hold,
 *     px from the box's own authored centre, before any camera.
 *   - NATIVE points: canvas px as the camera SHOWS them at one instant, which is where
 *     the overlay draws a point and where a pointer is read.
 *
 * `pathProjector` is the only bridge between the two. Forward it is the engine's own
 * `projectLayer`, the fold the export uses; backward it is `kfUnprojectCentre`, that
 * fold inverted (a uniform scale and a translate, or a homography under a tilted
 * camera). Both run at the keyframe's OWN time, with the camera and the depth the box
 * has then, so a dragged point ends up exactly where the export will put the box.
 *
 * Every track edit below keeps a keyframe's other channels, its ease and the handles it
 * is not editing, and returns plain keys for `setKfTrack`: one write, one undo step.
 */
import {
  evaluateKf, kfUnprojectCentre, projectLayer, resolveCamera,
  type KfCameraClip, type KfCameraView, type KfHandle, type KfKey, type KfTrack,
} from '../../../../engine/src/keyframes.ts';
import { num, type Box } from './free-canvas-math.ts';
import { boxTiming, kfBoxTrack, type MotionPathEnv, type TimeCfg } from './timeline-math.ts';

/** A point in either space. */
export interface Pt { x: number; y: number }

/** The surface ↔ native map for one box, evaluated at a keyframe's own time. */
export interface PathProjector {
  /** Surface offset (the `x`/`y` channel space) → native point at local time `ms`. */
  project(ms: number, dx: number, dy: number): Pt & { a: number };
  /** Native point → surface offset at local time `ms`; null past a tilted camera's horizon. */
  unproject(ms: number, nx: number, ny: number): Pt | null;
}

/**
 * One box's projector. `centre` is the box's authored centre (its `bx`/`by`), the same
 * one `kfMotionPath` folds, so a point drawn by the path and a point mapped here agree.
 */
export function pathProjector(
  box: Box, cfg: TimeCfg, centre: Pt, env: MotionPathEnv,
): PathProjector {
  const track = kfBoxTrack(box, cfg);
  const startMs = (boxTiming(box, cfg).start ?? 0) * 1000;
  const baseZ = cfg.zField ? num(box[cfg.zField], 0) : 0;
  const cams: readonly KfCameraClip[] | null = env.cameras ?? null;
  const w = num(env.stageW, 0), h = num(env.stageH, 0);
  const bx = num(centre.x, 0), by = num(centre.y, 0);
  const at = (ms: number): { cam: KfCameraView; z: number } => {
    const cam = { ...resolveCamera(cams, startMs + ms), w, h } as KfCameraView;
    const z = evaluateKf(track, ms, ['z']).z;
    return { cam, z: typeof z === 'number' ? z : baseZ };
  };
  return {
    project(ms, dx, dy) {
      const { cam, z } = at(ms);
      const p = projectLayer(cam, { bx, by, dxK: dx, dyK: dy, z });
      return { x: bx + p.dx, y: by + p.dy, a: p.alphaGuard };
    },
    unproject(ms, nx, ny) {
      const { cam, z } = at(ms);
      const s = kfUnprojectCentre(cam, nx, ny, z);
      return s ? { x: s.x - bx, y: s.y - by } : null;
    },
  };
}

/** Does this keyframe hold a whole position, the thing a path point can move? */
export const holdsPosition = (k: KfKey | undefined): boolean =>
  !!k && typeof k.v.x === 'number' && typeof k.v.y === 'number';

/** Does this keyframe key either axis? Such a point can be dragged; the drag keys both. */
export const movesPosition = (k: KfKey | undefined): boolean =>
  !!k && (typeof k.v.x === 'number' || typeof k.v.y === 'number');

/** A keyframe's position, surface offsets, or the track's value there when it holds none. */
export function keyPosition(track: KfTrack, k: KfKey): Pt {
  if (holdsPosition(k)) return { x: k.v.x as number, y: k.v.y as number };
  const p = evaluateKf(track, k.t, ['x', 'y']);
  return { x: num(p.x, 0), y: num(p.y, 0) };
}

/** The keyframes holding a position before and after `t`, nearest first, or undefined. */
export function positionNeighbours(track: KfTrack, t: number): { prev?: KfKey; next?: KfKey } {
  let prev: KfKey | undefined;
  let next: KfKey | undefined;
  for (const k of track) {
    if (!movesPosition(k)) continue;
    if (k.t < t) prev = k;
    else if (k.t > t && !next) next = k;
  }
  return { prev, next };
}

/** One keyframe with a patch, everything else kept. Unchanged when no keyframe sits at `t`. */
function patchKey(track: KfTrack, t: number, patch: (k: KfKey) => KfKey): KfKey[] {
  return track.map((k) => (k.t === t ? patch(k) : k));
}

/**
 * Move one keyframe's POSITION. Its handles are offsets from it, so they travel with
 * it; every other channel, its ease and every other keyframe stay as they were.
 */
export function kfTrackSetPosition(track: KfTrack, t: number, x: number, y: number): KfKey[] {
  return patchKey(track, t, (k) => ({ ...k, v: { ...k.v, x, y } }));
}

/**
 * Set or clear one keyframe's handles. `undefined` keeps a side as it is, `null`
 * retracts that side. A keyframe that holds no position cannot carry a handle (the wire drops
 * it), so it is left alone.
 */
export function kfTrackSetHandles(
  track: KfTrack, t: number, hi: KfHandle | null | undefined, ho: KfHandle | null | undefined,
): KfKey[] {
  return patchKey(track, t, (k) => {
    if (!holdsPosition(k)) return k;
    const out: { -readonly [P in keyof KfKey]: KfKey[P] } = { ...k };
    if (hi === null) delete out.hi; else if (hi) out.hi = hi;
    if (ho === null) delete out.ho; else if (ho) out.ho = ho;
    return out;
  });
}

/** Is this keyframe's travel curved on either side? */
export const hasHandles = (k: KfKey | undefined): boolean => !!k && !!(k.hi || k.ho);

/** The angle a curved end bows away from its chord, in degrees. */
const BOW_DEG = 30;

const rot = (v: Pt, deg: number): Pt => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
};
const len = (v: Pt): number => Math.hypot(v.x, v.y);
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const scale = (v: Pt, k: number): Pt => ({ x: v.x * k, y: v.y * k });
const pair = (v: Pt): KfHandle => [v.x, v.y];

/**
 * The handles **Curve the path** gives a keyframe, from its neighbours alone.
 *
 * Between two neighbours the tangent runs parallel to the line joining them (the
 * Catmull-Rom tangent every "auto bezier" uses), each handle a third of its own
 * segment, so the path passes smoothly through the point. Three points in a line would
 * stay a line, so there the tangent turns by {@link BOW_DEG} and the path makes a
 * gentle S. At either end of the path there is one segment to curve, and the handle
 * leaves along it turned by the same angle, so the segment bows; the first and the last
 * keyframe bow to the same side. Null when the keyframe has no neighbour holding a
 * position, since a single point has no travel to curve.
 */
export function autoHandles(track: KfTrack, t: number): { hi: KfHandle | null; ho: KfHandle | null } | null {
  const k = track.find((key) => key.t === t);
  if (!holdsPosition(k)) return null;
  const at = keyPosition(track, k!);
  const { prev, next } = positionNeighbours(track, t);
  const P = prev ? keyPosition(track, prev) : null;
  const N = next ? keyPosition(track, next) : null;
  if (P && N) {
    const d = sub(N, P);
    const span = len(d);
    if (!(span > 0)) return null;
    let u = scale(d, 1 / span);
    const cross = (at.x - P.x) * d.y - (at.y - P.y) * d.x;
    if (Math.abs(cross) <= 1e-6 * span * span) u = rot(u, BOW_DEG);
    return { hi: pair(scale(u, -len(sub(at, P)) / 3)), ho: pair(scale(u, len(sub(N, at)) / 3)) };
  }
  if (N) {
    const c = sub(N, at);
    return len(c) > 0 ? { hi: null, ho: pair(scale(rot(c, BOW_DEG), 1 / 3)) } : null;
  }
  if (P) {
    const c = sub(at, P);
    return len(c) > 0 ? { hi: pair(scale(rot(scale(c, -1), -BOW_DEG), 1 / 3)), ho: null } : null;
  }
  return null;
}

/** **Curve the path** at one keyframe: its handles from {@link autoHandles}. */
export function kfTrackCurve(track: KfTrack, t: number): KfKey[] {
  const h = autoHandles(track, t);
  return h ? kfTrackSetHandles(track, t, h.hi, h.ho) : track.map((k) => k);
}

/** **Straighten**: both handles retracted, so the travel either side is a line again. */
export function kfTrackStraighten(track: KfTrack, t: number): KfKey[] {
  return kfTrackSetHandles(track, t, null, null);
}

/** True when two handles leave their point in one line (within half a degree). */
export function handlesInLine(a: KfHandle | undefined, b: KfHandle | undefined): boolean {
  if (!a || !b) return false;
  const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
  if (!(la > 0) || !(lb > 0)) return false;
  const cos = -(a[0] * b[0] + a[1] * b[1]) / (la * lb);
  return cos >= Math.cos((0.5 * Math.PI) / 180);
}

/**
 * The opposite handle while one is dragged and the two were in line: it stays opposite
 * the dragged one and keeps its own length, which is the pen tool's smooth node.
 */
export function mirrorHandle(dragged: KfHandle, other: KfHandle): KfHandle | null {
  const ld = Math.hypot(dragged[0], dragged[1]);
  const lo = Math.hypot(other[0], other[1]);
  if (!(ld > 0)) return null;
  return [(-dragged[0] / ld) * lo, (-dragged[1] / ld) * lo];
}

/** One keyframe's point on the drawn path, with its handle tips, all native px. */
export interface PathKeyPoint {
  /** Local keyframe ms. */
  t: number;
  x: number;
  y: number;
  /** The camera's behind-camera ramp at that instant; 0 means not on screen. */
  a: number;
  /** Keys a position (either axis), so the point can be dragged. */
  pos: boolean;
  /** Holds a whole position, so the point can carry handles. */
  curve: boolean;
  /** Projected handle tips, present only where the keyframe has that handle. */
  hi?: Pt;
  ho?: Pt;
}

/**
 * Every keyframe of a box inside its clip's window, as the path draws the keyframes. A keyframe
 * past the out-point is not on the path (the path draws what plays), so it is not here.
 */
export function pathKeyPoints(box: Box, cfg: TimeCfg, centre: Pt, env: MotionPathEnv): PathKeyPoint[] {
  const track = kfBoxTrack(box, cfg);
  if (track.length < 2) return [];
  const timing = boxTiming(box, cfg);
  const winMs = timing.dur !== null
    ? timing.dur * 1000
    : Math.max(num(env.totalMs, 0), track[track.length - 1]!.t);
  const proj = pathProjector(box, cfg, centre, env);
  const out: PathKeyPoint[] = [];
  for (const k of track) {
    if (k.t < 0 || k.t > winMs) continue;
    const at = keyPosition(track, k);
    const p = proj.project(k.t, at.x, at.y);
    const item: PathKeyPoint = { t: k.t, x: p.x, y: p.y, a: p.a, pos: movesPosition(k), curve: holdsPosition(k) };
    if (k.hi) { const q = proj.project(k.t, at.x + k.hi[0], at.y + k.hi[1]); item.hi = { x: q.x, y: q.y }; }
    if (k.ho) { const q = proj.project(k.t, at.x + k.ho[0], at.y + k.ho[1]); item.ho = { x: q.x, y: q.y }; }
    out.push(item);
  }
  return out;
}
