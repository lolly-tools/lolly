// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas-pen-ops.ts - the pure half of the pen's newer gestures: Shift's angle steps,
 * snapping a point to the other nodes of its own path, retracting handles, and resuming a
 * drawn path from one of its open ends.
 *
 * DOM-free like free-canvas-pen.ts, and a separate module rather than part of that file:
 * free-canvas-pen.ts owns the path model and its coordinate spaces, this one owns small
 * decisions a gesture makes about a point. Every point here is in whichever space the caller passes; the angle
 * helpers are meant to be called in NATIVE px, because a 15 degree step is a promise about
 * what the user sees, and a rotated frame would turn a local step into a screen slant.
 */
import type { AuthoredPath, SplineNode } from '@lolly/engine';
import type { SnapLines } from './free-canvas-math.ts';
import { localToFrame, type PenFrame } from './free-canvas-pen.ts';

/** The step Shift holds a segment or a handle to, the same step the rotate gesture uses. */
export const ANGLE_STEP_DEG = 15;

export interface PenPt { x: number; y: number }

/** Clean a unit-vector component of cos/sin's last-bit noise, so a step at 90 degrees is
 *  exactly vertical rather than 6e-17 off vertical. */
const tidy = (v: number): number => (Math.abs(v) < 1e-12 ? 0 : v);

/**
 * `to`, held to the nearest direction from `from` that is a whole number of `stepDeg`
 * steps: the point on that ray closest to `to`. A projection rather than a rotation, so
 * the constrained point stays as near the pointer as the constraint allows, which is what
 * makes a Shift drag feel like it follows the hand. A zero-length pull is returned as is,
 * since it has no direction to round.
 */
export function constrainAngle(from: PenPt, to: PenPt, stepDeg = ANGLE_STEP_DEG): PenPt {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (!(Math.hypot(dx, dy) > 1e-9) || !(stepDeg > 0)) return { x: to.x, y: to.y };
  const step = (stepDeg * Math.PI) / 180;
  const a = Math.round(Math.atan2(dy, dx) / step) * step;
  const ux = tidy(Math.cos(a)), uy = tidy(Math.sin(a));
  const d = dx * ux + dy * uy;
  return { x: from.x + ux * d, y: from.y + uy * d };
}

/** The contour slices of a combined node-edit path, as the gesture code holds them. */
export interface PenContourPart { count: number; closed: boolean }

/**
 * The node a Shift drag of node `index` measures its angle from: the previous node on the
 * same contour, else the next one, wrapping round a closed contour. A neighbour that is
 * moving with the drag is skipped, since an angle to a point that travels with you is no
 * constraint at all. -1 when there is no still neighbour; the caller then steps the drag
 * direction itself.
 */
export function angleNeighbour(parts: readonly PenContourPart[], index: number, moving: ReadonlySet<number>): number {
  let start = 0;
  for (const part of parts) {
    const end = start + part.count;
    if (index >= start && index < end) {
      const local = index - start;
      const prev = local > 0 ? start + local - 1 : part.closed && part.count > 2 ? end - 1 : -1;
      const next = local < part.count - 1 ? index + 1 : part.closed && part.count > 2 ? start : -1;
      for (const k of [prev, next]) if (k >= 0 && k !== index && !moving.has(k)) return k;
      return -1;
    }
    start = end;
  }
  return -1;
}

/**
 * Snap lines for the other nodes of the path being drawn or edited, merged onto whatever
 * lines the canvas already snaps to (authored guides). A node then lines up with its
 * neighbours on either axis, and sits exactly on one when both axes catch.
 */
export function withNodeLines(lines: SnapLines | undefined, pts: readonly PenPt[]): SnapLines {
  const xs = pts.map((p) => p.x).filter(Number.isFinite);
  const ys = pts.map((p) => p.y).filter(Number.isFinite);
  return {
    ...(lines ?? {}),
    x: [...(lines?.x ?? []), ...xs],
    y: [...(lines?.y ?? []), ...ys],
  };
}

/** A selected-handle key, `"<node>:in"` or `"<node>:out"`, read back into its parts. */
function handleKey(key: string): { node: number; which: 'in' | 'out' } | null {
  const [i, which] = key.split(':');
  const node = Number(i);
  if (!Number.isInteger(node) || node < 0 || (which !== 'in' && which !== 'out')) return null;
  return { node, which };
}

/**
 * Pull the selected handles back onto their nodes. The handle is REMOVED rather than set
 * to a zero offset: an absent handle lowers exactly as a zero one does, and it leaves no
 * dot sitting on top of the node. The node becomes a corner, because a smooth or symmetric
 * rule would otherwise rebuild the missing arm from the other one on the next edit.
 *
 * `changed` counts the handles that actually went: a key pointing at a handle the node
 * never had does nothing, and the caller can tell from a zero.
 */
export function retractHandles(p: AuthoredPath, keys: Iterable<string>): { path: AuthoredPath; changed: number } {
  const byNode = new Map<number, Set<'in' | 'out'>>();
  for (const key of keys) {
    const k = handleKey(key);
    if (!k || k.node >= p.nodes.length) continue;
    const set = byNode.get(k.node) ?? new Set<'in' | 'out'>();
    set.add(k.which);
    byNode.set(k.node, set);
  }
  let changed = 0;
  const nodes = p.nodes.map((n, i) => {
    const sides = byNode.get(i);
    if (!sides) return n;
    const out: SplineNode = { ...n };
    let hit = false;
    if (sides.has('in') && (n.hInX !== undefined || n.hInY !== undefined)) {
      delete out.hInX;
      delete out.hInY;
      hit = true;
      changed++;
    }
    if (sides.has('out') && (n.hOutX !== undefined || n.hOutY !== undefined)) {
      delete out.hOutX;
      delete out.hOutY;
      hit = true;
      changed++;
    }
    if (!hit) return n;
    out.continuity = 'corner';
    return out;
  });
  return { path: changed ? { ...p, nodes } : p, changed };
}

/**
 * The same path drawn the other way round: node order reversed and each node's two
 * handles swapped, so every segment is the same curve walked backwards. This is how a
 * path is continued from its START: reverse it, append like any draft, reverse back, and
 * the new nodes come out in front of the old first node.
 */
export function reversePath(p: AuthoredPath): AuthoredPath {
  const nodes = [...p.nodes].reverse().map((n) => {
    const out: SplineNode = { x: n.x, y: n.y };
    if (n.hOutX !== undefined) out.hInX = n.hOutX;
    if (n.hOutY !== undefined) out.hInY = n.hOutY;
    if (n.hInX !== undefined) out.hOutX = n.hInX;
    if (n.hInY !== undefined) out.hOutY = n.hInY;
    if (n.continuity !== undefined) out.continuity = n.continuity;
    return out;
  });
  return { ...p, nodes };
}

/**
 * A box-local path placed in NATIVE px through its frame: positions through
 * `localToFrame`, handle offsets turned by the frame's rotation only, since an offset has
 * no position to move. The result is the drawn shape exactly, ready to be a draft.
 */
export function pathToNative(p: AuthoredPath, fr: PenFrame): AuthoredPath {
  const r = ((fr.rot || 0) * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  const turn = (x: number | undefined, y: number | undefined): [number, number] | null => {
    if (x === undefined && y === undefined) return null;
    const vx = x ?? 0, vy = y ?? 0;
    return fr.rot ? [vx * c - vy * s, vx * s + vy * c] : [vx, vy];
  };
  const nodes = p.nodes.map((n) => {
    const at = localToFrame(fr, n.x, n.y);
    const out: SplineNode = { x: at.x, y: at.y };
    const hi = turn(n.hInX, n.hInY);
    if (hi) { out.hInX = hi[0]; out.hInY = hi[1]; }
    const ho = turn(n.hOutX, n.hOutY);
    if (ho) { out.hOutX = ho[0]; out.hOutY = ho[1]; }
    if (n.continuity !== undefined) out.continuity = n.continuity;
    return out;
  });
  return { ...p, nodes };
}

/**
 * Which open END of a path a point is on, within `tol`: the end a pen press can resume
 * drawing from. A closed path has no ends, and a path of under two nodes is not one yet.
 * When both ends are in reach (a tiny path) the nearer wins, and a tie goes to the end,
 * because carrying on forwards is the ordinary case.
 */
export function resumableEnd(p: AuthoredPath, x: number, y: number, tol: number): 'start' | 'end' | null {
  if (p.closed || p.nodes.length < 2) return null;
  const first = p.nodes[0]!, last = p.nodes[p.nodes.length - 1]!;
  const d0 = Math.hypot(first.x - x, first.y - y);
  const d1 = Math.hypot(last.x - x, last.y - y);
  if (d1 <= tol && d1 <= d0) return 'end';
  if (d0 <= tol) return 'start';
  return null;
}
