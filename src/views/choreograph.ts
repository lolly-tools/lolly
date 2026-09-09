// SPDX-License-Identifier: MPL-2.0
/**
 * Choreograph (plans/104 P4) - one click, a composed motion arc over a stack of boxes.
 *
 * The pure half of the "Choreograph" action beside Lift layers: given the boxes of a
 * stack (a lifted SVG, a grouped selection, a swatch grid) it writes EXPANDED per-box
 * keyframe tracks and one camera track. Nothing is stored by name - the result is
 * ordinary keyframes, the same posture as the camera presets, so what a showcase
 * writes is fully editable afterwards and indistinguishable from a hand-authored move.
 *
 * The vocabulary is the ARC GRAMMAR (plans/104 section 9, Andy 2026-08-12):
 *
 *   INTRO    blank / exploded -> rest        Buildup, Map-scan
 *   FEATURE  rest -> departure -> rest       Hero arc, Trench run
 *   OUTRO    rest -> exploded / blank        Deconstruct (deliberately NOT rest-ending)
 *   LOOP     exploded -> rest -> exploded    The Loop (end state == start state, so an
 *                                            exported gif/apng cycles without a jump)
 *
 * and the Resolution Rule falls out of it: every arc except an OUTRO ends at the rest
 * pose - the authored composition, with each box back at its OWN z field (a lifted
 * stack's depth ladder), offsets 0, scale 1, opacity 1, blur 0, camera at the default
 * pose. tests/choreograph.test.ts evaluates every showcase through the real engine
 * and asserts exactly that, per arc type.
 *
 * Channel semantics the generator leans on (engine/src/keyframes.ts, section 5.2):
 * x/y are px OFFSETS from the authored position, s multiplies, o multiplies (and always
 * fades linearly whatever the ease), b adds, z REPLACES the box's z field for the
 * segment - which is why a rest key carries the box's own z and never 0. rx/ry are the
 * box's own pitch and yaw and follow z's rule exactly (P2.1), so a rest key carries the
 * box's OWN tilt and never 0. A key's ease governs the segment LEAVING it. The FLOAT
 * quality is therefore two things resolving together: the scale breath (s 1 -> 1.02 -> 1)
 * and the perspective TUMBLE (a few degrees on each axis, carried by the exploded pose),
 * both landing back on the authored composition, plus seeded per-element timing variance.
 *
 * The tumble is OPT-IN (`tumble: true`, and only with `float`): a single tilt key sends
 * the export to the slower capture tier and refuses video, so the default arc must not
 * write one. A TRACK that never mentions rx/ry leaves the fold on the box's own tilt
 * FIELD - note "track", not "key": once any key mentions the channel, the last mention
 * clamp-holds forever, which is why a tumbling track must carry the rest tilt
 * explicitly. A board that never tumbles carries no rx/ry token at all, and a box with
 * an authored tilt still renders that tilt without a single key.
 *
 * Everything is deterministic from `seed` (mulberry32, the transitions.ts precedent):
 * the same stack, options and seed always produce the same wire.
 */
import type { KfKeyInput } from '../../../../engine/src/keyframes.ts';
import { KF_MAX_TIME_MS, KF_Z_FIELD_CLAMP, parseKf, serialiseKf } from '../../../../engine/src/keyframes.ts';
import { num, type Box } from './free-canvas-math.ts';
import type { TimeCfg } from './timeline-math.ts';
import { boxTiming, deriveDuration, indexOfId, kfTrackAfter, moveOverlay, setDuration, setKfTrack } from './timeline-math.ts';

import { launchChoreograph, LAUNCH_RECIPES, type LaunchRecipe } from './launch-choreograph.ts';
import { clamp } from '@lolly/engine';

export type ShowcaseId = LaunchRecipe | 'buildup' | 'deconstruct' | 'loop' | 'hero' | 'trench' | 'scan';
export type ChoreoArc = 'intro' | 'feature' | 'outro' | 'loop';
/** The stagger order - the text split order's vocabulary, plus the stack's own depth. */
export type ChoreoOrder = '' | 'reverse' | 'center' | 'random' | 'depth';

/**
 * One box of the stack, in stage-native px: its authored rect centre and its rest depth -
 * plus, optionally, its own authored TILT in degrees (P2.1). Optional because absent IS
 * flat: a caller on a tool that declares no tilt fields hands over what it always did.
 */
export interface ChoreoBox { id: string; z: number; cx: number; cy: number; w: number; h: number; rx?: number; ry?: number }
export interface ChoreoStage { w: number; h: number }

export interface ChoreoOptions {
  showcase: ShowcaseId;
  /** The whole arc, ms. Defaults to the showcase's authored length. */
  durationMs?: number;
  /** Delay between consecutive ranks, ms. Compressed when the ranks would overrun the window. */
  staggerMs?: number;
  order?: ChoreoOrder;
  seed?: number;
  /** Write the camera track (default true). */
  camera?: boolean;
  /** The scale breath and the seeded timing variance (default true). */
  float?: boolean;
  /**
   * The perspective TUMBLE - a few seeded degrees of rx/ry on the exploded pose,
   * resolving to the box's own tilt. OPT-IN, never a default: one tilt key routes the
   * whole export onto the slower capture tier and refuses a board that holds a video
   * clip (boxesTilt feeds the same gate the tilted camera does), so the default Float
   * must not change how a board exports. Requires `float`.
   */
  tumble?: boolean;
}

export interface ChoreoPlan {
  arc: ChoreoArc;
  durationMs: number;
  boxes: Array<{ id: string; keys: KfKeyInput[] }>;
  /** Absolute sequence ms, or null when the showcase leaves the camera alone. */
  camera: KfKeyInput[] | null;
}

export const SHOWCASE_IDS: readonly ShowcaseId[] = Object.freeze(['buildup', 'deconstruct', 'loop', 'hero', 'trench', 'scan', ...LAUNCH_RECIPES]);
export const SHOWCASE_ARC: Readonly<Record<ShowcaseId, ChoreoArc>> = Object.freeze({
  buildup: 'intro', deconstruct: 'outro', loop: 'loop', hero: 'feature', trench: 'feature', scan: 'intro',
  'editorial-reveal': 'intro', 'type-snap': 'intro', 'feature-cascade': 'intro', 'assemble-loop': 'loop',
});
/** Authored lengths, ms - what a fresh (untimed) stack is given. */
export const SHOWCASE_MS: Readonly<Record<ShowcaseId, number>> = Object.freeze({
  buildup: 3000, deconstruct: 2500, loop: 6000, hero: 6000, trench: 5000, scan: 8000,
  'editorial-reveal': 6000, 'type-snap': 6000, 'feature-cascade': 6000, 'assemble-loop': 6000,
});
export const DEFAULT_STAGGER_MS = 90;
/** The floor under any arc - below this a stagger strobes rather than reads. */
export const CHOREO_MIN_MS = 800;

/** The inertia curve of the Map-scan pans - a hard expo-out decay, the thrown-map settle. */
const INERTIA = 'eb(0.16)(1)(0.3)(1)';
/** How far a box lifts when it explodes, px above its own rest depth. */
const LIFT_PX = 120;
/** The tilt window a generated camera may use - well inside KF_TILT_CONTROL's +/-75. */
const TILT_MAX = 30;
/**
 * The window a BOX tilt may use: the tilt FIELD's own range (P2.1). Wider than the
 * camera's, because a box tumble is added ON TOP of whatever the box authored - a card
 * already posed at 70 degrees still has to come home to 70. The other three copies of
 * this number are the design manifest's min/max, the hook's `TILT_MAX` and
 * `KF_TILT_CONTROL`; the planner's `KF_TILT_FIELD_CLAMP` is the fifth.
 */
const TILT_BOX_MAX = 75;
/** How far a box tumbles off its own tilt while exploded, degrees, either way. Big
 *  enough to read as a card catching the light, small enough that a box near the field
 *  ceiling only meets the clamp rather than folding through its own near plane. */
const TUMBLE_MIN = 3, TUMBLE_MAX = 8;
const fin = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** mulberry32 - tiny, seeded, and identical everywhere a showcase is generated. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over the stack's ids - the default seed, so the same stack always draws the same numbers. */
export function seedFor(ids: readonly string[]): number {
  let h = 0x811c9dc5;
  for (const id of ids) {
    for (let i = 0; i < id.length; i++) {
      h ^= id.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    h ^= 0x2f; h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The rank of each box in the stagger, by array index. Reading order is row-major
 * over the box centres with a row band of the median height, so a swatch grid reads
 * left to right, top to bottom, and a lifted stack (every centre equal) keeps its
 * array order, which IS its depth order.
 */
export function rankStack(stack: readonly ChoreoBox[], order: ChoreoOrder, rnd: () => number): number[] {
  const n = stack.length;
  const idx = stack.map((_b, i) => i);
  if (n < 2) return idx.map(() => 0);
  const hs = stack.map((b) => Math.abs(b.h)).sort((a, b) => a - b);
  const band = Math.max(1, hs[Math.floor(n / 2)]!);
  // Rows by TOLERANCE, not by quantising cy: a quantiser splits one visual row in two
  // whenever its centres straddle a band boundary (swatches lifted from crops of slightly
  // different heights), and the stagger then ping-pongs across the row. Walk the centres
  // in cy order and open a new row only when the next centre is more than half a band
  // below the row's first.
  const row = new Array<number>(n).fill(0);
  const byCy = idx.slice().sort((a, b) => (stack[a]!.cy - stack[b]!.cy) || (a - b));
  let r = 0, rowTop = stack[byCy[0]!]!.cy;
  for (const i of byCy) {
    if (stack[i]!.cy - rowTop > band / 2) { r++; rowTop = stack[i]!.cy; }
    row[i] = r;
  }
  const reading = (a: number, b: number): number => {
    const A = stack[a]!, B = stack[b]!;
    return (row[a]! - row[b]!) || (A.cx - B.cx) || (a - b);
  };
  let sorted: number[];
  switch (order) {
    case 'reverse': sorted = idx.sort(reading).reverse(); break;
    case 'center': {
      const c = centroid(stack);
      const d = stack.map((b) => Math.hypot(b.cx - c.x, b.cy - c.y));
      sorted = idx.sort((a, b) => (d[a]! - d[b]!) || (a - b));
      break;
    }
    case 'random': {
      sorted = idx;
      for (let i = n - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
      }
      break;
    }
    case 'depth': sorted = idx.sort((a, b) => (stack[a]!.z - stack[b]!.z) || (a - b)); break;
    default: sorted = idx.sort(reading);
  }
  const rank = new Array<number>(n).fill(0);
  sorted.forEach((i, r) => { rank[i] = r; });
  return rank;
}

function centroid(stack: readonly ChoreoBox[]): { x: number; y: number } {
  let x = 0, y = 0;
  for (const b of stack) { x += b.cx; y += b.cy; }
  const n = Math.max(1, stack.length);
  return { x: x / n, y: y / n };
}

/**
 * Deal a settle/depart segment to every rank inside [winStart, winEnd]. The window is
 * always FILLED: each rank starts `gap` after the one before (the stagger, compressed
 * when the ranks would not fit), and the segment is whatever is left once the last rank
 * has started, never less than 40 % of the window - so a longer arc is a slower move,
 * not a static tail, and two boxes settle over most of the window while nine share it.
 * A seeded nudge of up to a quarter gap keeps a grid from ticking like a metronome;
 * order is preserved because the nudge is always smaller than half a gap, and the
 * segment's end is held inside the window whatever the nudge did.
 */
function dealWindow(
  winStart: number, winEnd: number, ranks: readonly number[], staggerMs: number, nudge: readonly number[],
): Array<{ from: number; to: number; seg: number }> {
  const n = ranks.length;
  const W = Math.max(0, winEnd - winStart);
  const segMin = 0.4 * W;
  const gap = n > 1 ? Math.min(Math.max(0, staggerMs), (W - segMin) / (n - 1)) : 0;
  const seg = W - gap * (n - 1);
  const end = Math.round(winStart + W);
  return ranks.map((r, i) => {
    const d = clamp(r * gap + (nudge[i] ?? 0) * 0.25 * gap, 0, W - seg);
    const from = Math.min(end, Math.round(winStart + d));
    return { from, to: Math.min(end, Math.round(from + seg)), seg };
  });
}

type Pose = Partial<Record<'x' | 'y' | 'z' | 's' | 'o' | 'b' | 'rx' | 'ry', number>>;

/** A seeded tumble, degrees on each axis - or null for a box that does not tumble. */
type Tumble = { rx: number; ry: number } | null;

/** The box's own authored tilt, held to the field range. Absent is flat. */
const baseTilt = (v: unknown): number => clamp(fin(v, 0), -TILT_BOX_MAX, TILT_BOX_MAX);

/**
 * Every box's rest pose: its OWN depth, no offset, scale 1, opaque, no blur - and, when
 * `tumble` is on, its OWN tilt. The tilt is conditional for the reason spelled at the
 * top of the file: a key that omits rx/ry leaves the fold on the box's tilt field, so
 * writing `rx0` into a board that never tumbles would add a wire token for nothing.
 */
const restOf = (b: ChoreoBox, tumble: Tumble = null): Pose => ({
  x: 0, y: 0, z: clamp(b.z, KF_Z_FIELD_CLAMP[0], KF_Z_FIELD_CLAMP[1]),
  ...(tumble ? { rx: baseTilt(b.rx), ry: baseTilt(b.ry) } : {}),
  s: 1, o: 1, b: 0,
});

/**
 * The exploded pose: lifted `lift` px above its own depth and pushed away from the
 * stack's centroid by `spread` of its distance (plus a floor, so the centre box of a
 * grid still moves). `visible` keeps it opaque (a fly-through) or fades it out with a
 * touch of blur (a build). `tumble` adds the float tilt on top of the box's own.
 */
function explodedOf(b: ChoreoBox, c: { x: number; y: number }, lift: number, spread: number, visible: boolean, tumble: Tumble = null): Pose {
  const dx = b.cx - c.x, dy = b.cy - c.y;
  const dist = Math.hypot(dx, dy);
  const ux = dist > 0.5 ? dx / dist : 0, uy = dist > 0.5 ? dy / dist : -1;
  const mag = spread > 0 ? dist * spread + 24 : 0;
  return {
    x: r2(ux * mag), y: r2(uy * mag),
    z: clamp(r2(b.z + lift), KF_Z_FIELD_CLAMP[0], KF_Z_FIELD_CLAMP[1]),
    ...(tumble ? { rx: r2(baseTilt(b.rx) + tumble.rx), ry: r2(baseTilt(b.ry) + tumble.ry) } : {}),
    s: 1, o: visible ? 1 : 0, b: visible ? 0 : 6,
  };
}

/** One tumble amplitude from one draw: 3-8 degrees, signed. */
const tumbleDeg = (r: number): number => r2((r < 0.5 ? -1 : 1) * (TUMBLE_MIN + Math.abs(r * 2 - 1) * (TUMBLE_MAX - TUMBLE_MIN)));

/** Hold every rx/ry a track carries inside `max`, in place. */
function clampTilt(keys: readonly KfKeyInput[] | null | undefined, max: number): void {
  if (!keys) return;
  for (const k of keys) {
    const v = k.v as Record<string, number> | null | undefined;
    if (!v) continue;
    if (typeof v.rx === 'number') v.rx = clamp(v.rx, -max, max);
    if (typeof v.ry === 'number') v.ry = clamp(v.ry, -max, max);
  }
}

const r2 = (v: number): number => Math.round(v * 100) / 100;

/** exploded -> rest over [from, to], with the scale breath on its way down when `breath` > 0. */
function settleKeys(from: number, to: number, exploded: Pose, rest: Pose, breath: number): KfKeyInput[] {
  const keys: KfKeyInput[] = [{ t: from, ease: 'eo', v: exploded }];
  if (breath > 0 && to - from > 40) {
    keys.push({ t: Math.round(from + (to - from) * 0.7), ease: 'eio', v: { s: r3(1 + breath) } });
  }
  keys.push({ t: to, v: rest });
  return keys;
}

/** rest -> exploded over [from, to]. */
function departKeys(from: number, to: number, rest: Pose, exploded: Pose): KfKeyInput[] {
  return [{ t: from, ease: 'ei', v: rest }, { t: to, v: exploded }];
}

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Pan values that put a stage point at the principal point (the stage centre). */
const panTo = (p: { x: number; y: number }, stage: ChoreoStage): { x: number; y: number } => ({
  x: r2(p.x - stage.w / 2), y: r2(p.y - stage.h / 2),
});

const CAM_REST = Object.freeze({ x: 0, y: 0, z: 0, rx: 0, ry: 0 });

/**
 * Three pan targets for the Map-scan, by farthest-point sampling: the box nearest the
 * centroid first, then the box farthest from it, then the one farthest from both - so
 * the camera crosses the page rather than shuffling between neighbours.
 */
function scanTargets(stack: readonly ChoreoBox[]): Array<{ x: number; y: number }> {
  const c = centroid(stack);
  const pts = stack.map((b) => ({ x: b.cx, y: b.cy }));
  const d = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
  const chosen: Array<{ x: number; y: number }> = [];
  let first = 0;
  for (let i = 1; i < pts.length; i++) if (d(pts[i]!, c) < d(pts[first]!, c)) first = i;
  chosen.push(pts[first]!);
  while (chosen.length < 3 && chosen.length < pts.length) {
    let best = -1, bestD = -1;
    for (let i = 0; i < pts.length; i++) {
      const m = Math.min(...chosen.map((q) => d(q, pts[i]!)));
      if (m > bestD) { bestD = m; best = i; }
    }
    if (best < 0 || bestD <= 0) break;
    chosen.push(pts[best]!);
  }
  while (chosen.length < 3) chosen.push(chosen[chosen.length - 1] ?? c);
  return chosen;
}

/**
 * THE generator. Pure: the same inputs always give the same plan. Times are ms from the
 * arc's start (box keys) or absolute sequence ms from the arc's start (camera keys) - the
 * caller offsets them into each clip's local clock ({@link applyChoreograph}).
 */
export function choreograph(stack: readonly ChoreoBox[], stage: ChoreoStage, opts: ChoreoOptions): ChoreoPlan {
  const id = SHOWCASE_IDS.includes(opts.showcase) ? opts.showcase : 'buildup';
  const arc = SHOWCASE_ARC[id];
  const T = Math.round(clamp(fin(opts.durationMs, SHOWCASE_MS[id]), CHOREO_MIN_MS, KF_MAX_TIME_MS));
  const boxes = stack.filter((b) => b && typeof b.id === 'string' && b.id);
  const plan: ChoreoPlan = { arc, durationMs: T, boxes: [], camera: null };
  if (!boxes.length) return plan;
  const float = opts.float !== false;
  const stagger = fin(opts.staggerMs, DEFAULT_STAGGER_MS);
  const rnd = mulberry32(fin(opts.seed, seedFor(boxes.map((b) => b.id))));
  const ranks = rankStack(boxes, opts.order ?? '', rnd);
  if (LAUNCH_RECIPES.includes(id as LaunchRecipe)) return launchChoreograph(boxes, ranks, id as LaunchRecipe, T, stagger, opts.camera !== false);
  // Drawn AFTER the ranks so a 'random' order and the nudges come from one stream.
  const nudge = boxes.map(() => (float ? rnd() * 2 - 1 : 0));
  const breath = boxes.map(() => (float ? r3(0.015 + rnd() * 0.015) : 0));
  // And the tumble AFTER those, for the same reason read the other way (P2.1): a draw
  // APPENDED to the stream leaves every number already drawn from it untouched, so a
  // float-off wire and a pre-tumble seeded output are byte for byte what they were.
  const wantTumble = float && opts.tumble === true;
  const tumble: Tumble[] = boxes.map(() => (wantTumble ? { rx: tumbleDeg(rnd()), ry: tumbleDeg(rnd()) } : null));
  const c = centroid(boxes);
  const zTop = Math.max(...boxes.map((b) => b.z));
  const zLo = Math.min(...boxes.map((b) => b.z));
  const W = Math.max(1, fin(stage.w, 1)), H = Math.max(1, fin(stage.h, 1));
  const st = { w: W, h: H };
  const sec = (f: number): number => Math.round(T * f);

  switch (id) {
    case 'buildup': {
      const win = dealWindow(0, sec(0.85), ranks, stagger, nudge);
      plan.boxes = boxes.map((b, i) => ({
        id: b.id,
        keys: settleKeys(win[i]!.from, win[i]!.to, explodedOf(b, c, LIFT_PX, 0.35, false, tumble[i]!), restOf(b, tumble[i]!), breath[i]!),
      }));
      if (opts.camera !== false) {
        // Drift: a shallow push that settles as the last box does - the camera never sits still.
        plan.camera = [{ t: 0, ease: 'eo', v: { ...CAM_REST, z: -60 } }, { t: T, v: { ...CAM_REST } }];
      }
      break;
    }
    case 'deconstruct': {
      const win = dealWindow(sec(0.15), T, ranks, stagger, nudge);
      plan.boxes = boxes.map((b, i) => ({
        id: b.id,
        keys: departKeys(win[i]!.from, win[i]!.to, restOf(b, tumble[i]!), explodedOf(b, c, LIFT_PX, 0.35, false, tumble[i]!)),
      }));
      if (opts.camera !== false) {
        plan.camera = [{ t: 0, ease: 'ei', v: { ...CAM_REST } }, { t: T, v: { ...CAM_REST, z: -60 } }];
      }
      break;
    }
    case 'loop': {
      const inWin = dealWindow(0, sec(0.42), ranks, stagger, nudge);
      const outWin = dealWindow(sec(0.58), T, ranks, stagger, nudge);
      plan.boxes = boxes.map((b, i) => {
        const ex = explodedOf(b, c, LIFT_PX, 0.35, false, tumble[i]!), rest = restOf(b, tumble[i]!);
        return {
          id: b.id,
          keys: [
            ...settleKeys(inWin[i]!.from, inWin[i]!.to, ex, rest, breath[i]!),
            ...departKeys(outWin[i]!.from, outWin[i]!.to, rest, ex),
          ],
        };
      });
      if (opts.camera !== false) {
        // Start state == end state, so the export cycles without a jump.
        plan.camera = [
          { t: 0, ease: 'eo', v: { ...CAM_REST, z: -40 } },
          { t: sec(0.5), ease: 'ei', v: { ...CAM_REST } },
          { t: T, v: { ...CAM_REST, z: -40 } },
        ];
      }
      break;
    }
    case 'hero': {
      const outWin = dealWindow(sec(0.06), sec(0.34), ranks, stagger, nudge);
      const backWin = dealWindow(sec(0.66), sec(0.96), ranks, stagger, nudge);
      plan.boxes = boxes.map((b, i) => {
        const ex = explodedOf(b, c, LIFT_PX, 0.3, true, tumble[i]!), rest = restOf(b, tumble[i]!);
        return {
          id: b.id,
          keys: [
            { t: outWin[i]!.from, ease: 'es', v: rest }, { t: outWin[i]!.to, v: ex },
            ...settleKeys(backWin[i]!.from, backWin[i]!.to, ex, rest, breath[i]!),
          ],
        };
      });
      if (opts.camera !== false) {
        // A fly-through at POV angles inside the exploded stack, home by the end. The
        // focus plane sits in the MIDDLE of the exploded range while the aperture is
        // open, and closes at rest. A single-plane stack has no depth to separate, so
        // its aperture stays shut - an open one there is a uniform softening, not DOF.
        const f = r2(clamp((zLo + zTop) / 2 + LIFT_PX, 0, 900));
        const a = zTop > zLo ? 0.3 : 0;
        plan.camera = [
          { t: 0, ease: 'es', v: { ...CAM_REST, f: 0, a: 0 } },
          { t: sec(0.3), ease: 'es', v: { x: r2(-0.16 * W), y: r2(-0.1 * H), z: -160, rx: -28, ry: 12, f, a } },
          { t: sec(0.56), ease: 'es', v: { x: r2(0.16 * W), y: r2(0.08 * H), z: -120, rx: -18, ry: -16, f, a } },
          { t: sec(0.78), ease: 'eo', v: { x: 0, y: r2(-0.04 * H), z: -60, rx: -8, ry: 0, f, a: a / 2 } },
          { t: T, v: { ...CAM_REST, f: 0, a: 0 } },
        ];
      }
      break;
    }
    case 'trench': {
      // The Corridor: a SMALL explode (the corridor works because the explode is small),
      // and a camera inside the stack's depth range drifting along it, lanes passing
      // above and below the frame, parallel edges converging as speed lines.
      const outWin = dealWindow(sec(0.04), sec(0.24), ranks, stagger, nudge);
      const backWin = dealWindow(sec(0.76), sec(0.96), ranks, stagger, nudge);
      plan.boxes = boxes.map((b, i) => {
        const ex = explodedOf(b, c, LIFT_PX * 0.4, 0.12, true, tumble[i]!), rest = restOf(b, tumble[i]!);
        return {
          id: b.id,
          keys: [
            { t: outWin[i]!.from, ease: 'es', v: rest }, { t: outWin[i]!.to, v: ex },
            ...settleKeys(backWin[i]!.from, backWin[i]!.to, ex, rest, breath[i]!),
          ],
        };
      });
      if (opts.camera !== false) {
        // INSIDE the stack: the midpoint of the exploded depth range, so the layers behind
        // the camera shrink and the ones in front grow and the lanes stream past. A
        // single-plane stack has no inside, so the camera sits just below the plane and
        // the parallax comes from the pan alone.
        const lift = LIFT_PX * 0.4;
        const inside = r2(clamp(zTop > zLo ? (zLo + zTop) / 2 + lift : zLo + lift - 60, KF_Z_FIELD_CLAMP[0], KF_Z_FIELD_CLAMP[1]));
        plan.camera = [
          { t: 0, ease: 'es', v: { ...CAM_REST } },
          { t: sec(0.18), ease: 'el', v: { x: r2(-0.3 * W), y: r2(0.08 * H), z: inside, rx: -14, ry: 0 } },
          { t: sec(0.82), ease: 'eo', v: { x: r2(0.3 * W), y: r2(-0.08 * H), z: inside, rx: -14, ry: 0 } },
          { t: T, v: { ...CAM_REST } },
        ];
      }
      break;
    }
    case 'scan': {
      // Elements hardly raised - the camera does everything. Zoomed-out and flat, a glide
      // in at an angle, flat-but-zoomed, then pans with drag inertia, and home.
      plan.boxes = float
        ? boxes.map((b) => {
            const rest = restOf(b);
            // Six px up - or down, for a box already at the field ceiling, where "up" would
            // clamp away and leave a track that animates nothing.
            const up = rest.z! + 6 <= KF_Z_FIELD_CLAMP[1] ? 6 : -6;
            const raised = { ...rest, z: r2(rest.z! + up) };
            return { id: b.id, keys: [{ t: 0, ease: 'el', v: raised }, { t: sec(0.86), ease: 'eo', v: raised }, { t: T, v: rest }] };
          })
        : [];
      if (opts.camera !== false) {
        const [A, B, C] = scanTargets(boxes);
        const pa = panTo(A!, st), pb = panTo(B!, st), pc = panTo(C!, st);
        plan.camera = [
          { t: 0, ease: 'es', v: { ...CAM_REST, z: 260 } },
          { t: sec(0.2), ease: INERTIA, v: { x: pa.x, y: pa.y, z: -120, rx: -16, ry: 6 } },
          { t: sec(0.35), ease: INERTIA, v: { x: pa.x, y: pa.y, z: -160, rx: 0, ry: 0 } },
          { t: sec(0.55), ease: INERTIA, v: { x: pb.x, y: pb.y, z: -160, rx: -3, ry: 4 } },
          { t: sec(0.72), ease: INERTIA, v: { x: pc.x, y: pc.y, z: -160, rx: 2, ry: -3 } },
          { t: sec(0.86), ease: 'eo', v: { x: r2(pc.x * 0.3), y: r2(pc.y * 0.3), z: -60, rx: 0, ry: 0 } },
          { t: T, v: { ...CAM_REST } },
        ];
      }
      break;
    }
  }
  // Every tilt a showcase writes stays inside the window its own inspector can show:
  // the camera's drift window, and for a box the tilt FIELD's range. Done here rather
  // than inline because a box tumble is a SUM (its authored tilt plus the amplitude),
  // so it can only be held once both halves are in the key.
  clampTilt(plan.camera, TILT_MAX);
  for (const e of plan.boxes) clampTilt(e.keys, TILT_BOX_MAX);
  return plan;
}

// ── the model write ──────────────────────────────────────────────────────────────

export interface ChoreoEnv {
  cfg: TimeCfg;
  /** The caller's rect reader (free-canvas's `boxRect`), stage-native px. */
  rect: (box: Box) => { x: number; y: number; w: number; h: number };
  stage: ChoreoStage;
  /** The manifest's `camera` add-kind seed, when the tool declares one. */
  cameraSeed?: Box | undefined;
  /** Mint a row id that cannot collide with anything in `rows`. */
  mint: (rows: Box[]) => string;
}

export interface ChoreoResult {
  rows: Box[];
  /** The boxes that received a track, in array order. */
  ids: string[];
  /** The scene camera's id, or '' when the showcase left the camera alone. */
  cameraId: string;
  plan: ChoreoPlan;
}

const isCamera = (b: Box | undefined): boolean => !!b && String(b.kind ?? '') === 'camera';

/** A box a showcase may pose: not the camera, not a frame page, not an audio clip. */
export function choreographable(b: Box | undefined): boolean {
  if (!b) return false;
  const kind = String(b.kind ?? '');
  return kind !== 'camera' && kind !== 'frame' && kind !== 'audio';
}

/**
 * Why a showcase over `ids` would be refused, or '' when it can go ahead. The picker
 * asks this to word its refusal; {@link applyChoreograph} asks it to refuse.
 *
 *   'frames'  the document has artboard pages: both evaluators opt out of depth and
 *             keyframe projection wholesale on a frames document (sequence-plan.ts
 *             `framesDoc`), so every track written would render as nothing.
 *   'few'     fewer than two posable boxes were named - a showcase over one box is a
 *             keyframe, not a choreography.
 */
export function whyNotChoreograph(boxes: Box[], ids: readonly string[], cfg: TimeCfg): '' | 'frames' | 'few' {
  if (!cfg.kfField) return 'few';
  const rows = Array.isArray(boxes) ? boxes : [];
  if (rows.some((b) => b && String(b.kind ?? '') === 'frame')) return 'frames';
  const want = new Set(ids.map(String));
  const members = rows.filter((b) => b && want.has(String(b[cfg.idField] ?? '')) && choreographable(b));
  return members.length < 2 ? 'few' : '';
}

/**
 * Write a showcase over `ids` in ONE new array - the caller commits it once, so the
 * whole arc (tracks, promotions, the camera) is a single undo step.
 *
 * Timing: on a board where NOTHING is timed there is no sequence at all (the hook emits
 * `data-sequence` only for a timed box), so every chosen box is promoted to a clip that
 * starts at 0 and runs the arc's length - chosen, not merely keyed: a showcase that
 * writes only a camera still needs a sequence for that camera to play in. A promoted
 * clip takes the arc's length by design, even over a video, because the arc IS the shot.
 * On a board that already has a sequence the arc starts at the earliest chosen clip's
 * start and runs, by default, to the last chosen clip's end (an open-ended or scenery
 * member runs to the scene's end). Each track is written in its own clip's LOCAL clock
 * by head-trimming the absolute arc at the clip's start (`kfTrackAfter`, the trim-in
 * rule), so a clip that enters late shows the pose the arc has reached rather than
 * replaying its opening; a clip that starts after the arc has finished is left alone
 * (a one-key track is a frozen pose, never an animation). Untimed members stay scenery
 * and are keyed on the sequence clock, which is what a scenery box's keyframes already
 * run on. The camera is keyed in absolute sequence time, offset by its own clip start
 * when it has one; an existing FIRST camera's track is REPLACED, as the presets replace
 * it (a later camera in the array still wins at render, exactly as it does for them).
 *
 * Returns null when {@link whyNotChoreograph} refuses, so the caller can say why rather
 * than spend an undo step.
 */
export function applyChoreograph(
  boxes: Box[], ids: readonly string[], opts: ChoreoOptions, env: ChoreoEnv,
): ChoreoResult | null {
  const { cfg } = env;
  if (whyNotChoreograph(boxes, ids, cfg)) return null;
  const rows0 = boxes;
  const want = new Set(ids.map(String));
  const members = rows0.filter((b) => b && want.has(String(b[cfg.idField] ?? '')) && choreographable(b));

  const sceneMs = deriveDuration(rows0, cfg);
  const timedScene = sceneMs > 0;
  const starts = members.map((b) => boxTiming(b, cfg).start).filter((s): s is number => s !== null);
  const t0Sec = timedScene && starts.length ? Math.min(...starts) : 0;
  // A timed scene's default length is the chosen clips' own span; a fresh board takes
  // the showcase's authored length.
  let durationMs = opts.durationMs;
  if (durationMs == null && timedScene) {
    let end = 0;
    for (const b of members) {
      const tm = boxTiming(b, cfg);
      end = Math.max(end, tm.start === null || tm.dur === null ? sceneMs / 1000 : tm.start + tm.dur);
    }
    if (end > t0Sec) durationMs = Math.round((end - t0Sec) * 1000);
  }

  const stack: ChoreoBox[] = members.map((b) => {
    const r = env.rect(b);
    return {
      id: String(b[cfg.idField]),
      z: cfg.zField ? num(b[cfg.zField], 0) : 0,
      // The box's own tilt, on the depth field's terms exactly (P2.1): a tool that
      // declares no tilt fields hands over 0, which is the flat card.
      rx: cfg.rxField ? num(b[cfg.rxField], 0) : 0,
      ry: cfg.ryField ? num(b[cfg.ryField], 0) : 0,
      cx: r.x + r.w / 2, cy: r.y + r.h / 2, w: r.w, h: r.h,
    };
  });
  const plan = choreograph(stack, env.stage, { ...opts, durationMs });
  const T = plan.durationMs;
  // The arc must fit under the wire's time cap, or every key past it collapses onto it.
  const t0Ms = Math.min(Math.round(t0Sec * 1000), KF_MAX_TIME_MS - T);

  let rows = rows0.map((b) => b);
  if (!timedScene) {
    for (const b of members) {
      const id = String(b[cfg.idField]);
      rows = moveOverlay(rows, cfg, id, 0);
      rows = setDuration(rows, cfg, id, T / 1000, null);
    }
  }
  const posed: string[] = [];
  for (const entry of plan.boxes) {
    const i = indexOfId(rows, cfg, entry.id);
    if (i < 0) continue;
    const tm = boxTiming(rows[i]!, cfg);
    const startMs = timedScene && tm.start !== null ? Math.round(tm.start * 1000) : 0;
    const shift = t0Ms - startMs;
    // On screen for the whole arc (it starts at or before the arc): a plain shift into
    // its clock. Entering late: head-trim the absolute arc at the clip's start.
    const local: readonly KfKeyInput[] = shift >= 0
      ? entry.keys.map((k) => ({ ...k, t: Math.round(fin(k.t, 0) + shift) }))
      : kfTrackAfter(parseKf(serialiseInput(entry.keys.map((k) => ({ ...k, t: Math.round(fin(k.t, 0) + t0Ms) })))), startMs);
    if (local.length < 2) continue;
    rows = setKfTrack(rows, cfg, entry.id, parseKf(serialiseInput(local)));
    posed.push(entry.id);
  }

  let cameraId = '';
  if (plan.camera) {
    const found = rows.find(isCamera);
    if (found) {
      cameraId = String(found[cfg.idField] ?? '');
    } else {
      cameraId = env.mint(rows);
      rows = [...rows, { ...(env.cameraSeed ?? {}), kind: 'camera', [cfg.idField]: cameraId } as Box];
    }
    const camStartMs = Math.round((boxTiming(rows[indexOfId(rows, cfg, cameraId)], cfg).start ?? 0) * 1000);
    const keys = plan.camera.map((k) => ({ ...k, t: Math.max(0, Math.round(fin(k.t, 0) + t0Ms - camStartMs)) }));
    rows = setKfTrack(rows, cfg, cameraId, parseKf(serialiseInput(keys)));
  }
  return { rows, ids: posed, cameraId, plan };
}

/**
 * `setKfTrack` takes the engine's frozen KfKey shape; the generator hands out
 * KfKeyInput (ease optional). A round trip through the wire is the one normaliser both
 * sides share - clamp, quantise, canonical ease, sort, dedupe.
 */
function serialiseInput(keys: readonly KfKeyInput[]): string { return serialiseKf(keys); }
