// SPDX-License-Identifier: MPL-2.0
/**
 * The shared transition vocabulary - one definition of what "pop" or "slide-left"
 * MEANS, consumed by both the video compositor (bridge/export.ts renderRecord) and
 * the timeline editing chrome that lets a user pick a kind per object.
 *
 * The maths moved here VERBATIM out of bridge/export.ts so exports stay byte-identical;
 * this module adds only the vocabulary around it (the kind union, the labelled registry,
 * and a prototype-safe membership test).
 *
 * The registry's keys are the wire values stored in a design box's enter/exit
 * fields, so they are a permanent contract: add kinds, never rename or reuse one.
 */

/** Every transition the compositor implements, in the order the sidebar offers them. */
export const TRANSITIONS = Object.freeze({
  fade: 'Fade',
  pop: 'Pop',
  grow: 'Grow',
  rise: 'Rise',
  drop: 'Drop',
  'slide-left': 'Slide from right',
  'slide-right': 'Slide from left',
  'slide-up': 'Slide from below',
  'slide-down': 'Slide from above',
  'zoom-in': 'Zoom in',
  'zoom-out': 'Zoom out',
  tilt: 'Tilt',
  swoop: 'Swoop',
  spin: 'Spin',
  drift: 'Drift',
  none: 'Cut (no animation)',
} as const);

export type TransitionKind = keyof typeof TRANSITIONS;

/** The kinds in registry order - for building a `<select>` or a picker grid. */
export const TRANSITION_KINDS = Object.freeze(Object.keys(TRANSITIONS) as TransitionKind[]);

/**
 * The kind a TIMELINE box animates with when its enter/exit field is empty - 'none',
 * matching the manifest default of those fields (design / sequence-studio).
 *
 * Deliberately NOT the same as the video compositor's `el.dataset.transition || 'fade'`
 * fallback in bridge/export.ts: that one reads a top-tail record stage, where an
 * overlay with no declared transition is meant to fade in. Two different data sources,
 * two different "nothing stored" answers - which is why this constant is named for the
 * one it serves rather than being shared.
 */
export const DEFAULT_TRANSITION: TransitionKind = 'none';

/**
 * How long an enter or exit runs when the box DECLARES a kind but no length, ms.
 *
 * Every reader already agreed on 400: the Design hook writes `data-t-enter-ms="400"` for
 * an unset field, bridge/sequence-dom.ts reads the attribute with the same fallback, and
 * bridge/sequence-plan.ts re-exports this constant. It lives here because a reader that
 * defaulted it to 0 instead - the dwell solver did - sizes a narrated slide 400 ms short
 * and starts its exit under the last words (plans/180 T2, T3).
 */
export const DEFAULT_TRANSITION_MS = 400;

/**
 * Prototype-safe membership test: hasOwnProperty, never `TRANSITIONS[v]` - a bare
 * lookup answers truthy for 'constructor'/'toString'/'valueOf' and would let inherited
 * Object.prototype keys through as valid kinds.
 */
export function isTransitionKind(v: unknown): v is TransitionKind {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(TRANSITIONS, v);
}

/** The human label for a kind, or the raw value back if it isn't one we implement. */
export function transitionLabel(v: unknown): string {
  return isTransitionKind(v) ? TRANSITIONS[v] : String(v ?? '');
}

/** One object's animated offset at a moment in its entrance. */
export interface TransitionOffset { dx: number; dy: number; sc: number; alpha: number; rot: number }

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;
function easeOutBack(t: number): number {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/* ── Authored easing ─────────────────────────────────────────────────────────
   The curve above is the one every kind was BORN with, and it stays the answer
   when nothing is authored - `recTransition` with no ease argument returns the
   numbers it always returned, byte for byte, which is the property that lets the
   compositor keep its existing output.

   What an authored ease governs is GEOMETRY ONLY: dx, dy, sc, rot. Alpha keeps
   its own fixed ramp (`pc / 0.6`, or `pc / 0.4` for the slides) because that ramp
   is not a stylistic choice - a fade that tracks a slow curve turns to mud once
   the frame has been through video compression, which is what the `aFast` comment
   below has always been about. Opacity therefore has no curve control anywhere in
   the UI, by design, not by omission.

   The wire format is a string, and it is a PERMANENT CONTRACT like the kind keys:
   either a preset name from `EASINGS` or a CSS `cubic-bezier(a,b,c,d)`. CSS's own
   spelling, so it is readable in a URL, familiar to anyone who has written a
   transition, and needs no bespoke serialisation. */

/** The named curves offered before anyone reaches for a custom one. */
export const EASINGS = Object.freeze({
  linear: 'Linear',
  'ease-out': 'Ease out',
  'ease-in': 'Ease in',
  'ease-in-out': 'Ease in and out',
  overshoot: 'Overshoot',
  anticipate: 'Anticipate',
  // Added with the keyframe grammar (plan 104 section 5.1), which names eight presets and
  // round-trips every one of them BY NAME through `engine/src/keyframes.ts`. Adding
  // them here rather than only in the engine is what keeps ONE vocabulary: a curve
  // authored on a transition and one authored on a keyframe are the same curve, and
  // `kfEaseName` hands back exactly these names. Strictly additive - the six above
  // keep their spelling, their order and their points, so every authored ease and
  // every unauthored transition renders byte-identically to before.
  smooth: 'Smooth',
  snappy: 'Snappy',
} as const);

export type EasingName = keyof typeof EASINGS;

/** The preset curves as bezier control points, in CSS order (x1, y1, x2, y2). */
const EASING_POINTS: Readonly<Record<EasingName, readonly [number, number, number, number]>> = Object.freeze({
  linear: [0, 0, 1, 1],
  'ease-out': [0.33, 1, 0.68, 1],
  'ease-in': [0.32, 0, 0.67, 0],
  'ease-in-out': [0.65, 0, 0.35, 1],
  // y > 1 overshoots the resting value and settles back; y < 0 pulls away first.
  // Both are legal CSS and both are what people mean by "with a bit of life".
  overshoot: [0.34, 1.56, 0.64, 1],
  anticipate: [0.36, -0.4, 0.66, 1],
  // The two the keyframe grammar adds. `smooth` is the standard accelerate-decelerate
  // curve; `snappy` shares its in-ramp but holds the out-handle much later, so it
  // leaves at the same rate and arrives abruptly - a deliberate sibling of smooth
  // rather than a second overshoot. Byte-identical to KF_EASE_PRESETS.es/.ek in
  // engine/src/keyframes.ts; transitions.test.ts pins the two tables together.
  smooth: [0.4, 0, 0.2, 1],
  snappy: [0.4, 0, 0.6, 1],
});

export function isEasingName(v: unknown): v is EasingName {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(EASINGS, v);
}

/** The four control points of an authored ease, or null if it isn't one. */
export function easingPoints(v: unknown): [number, number, number, number] | null {
  if (isEasingName(v)) return [...EASING_POINTS[v]];
  if (typeof v !== 'string') return null;
  const m = /^\s*cubic-bezier\(([^)]*)\)\s*$/i.exec(v);
  if (!m) return null;
  const n = m[1]!.split(',').map((s) => Number(s.trim()));
  if (n.length !== 4 || n.some((x) => !Number.isFinite(x))) return null;
  // x is TIME and must stay inside the unit interval or the curve is not a
  // function of progress - CSS rejects the same thing. y is unbounded on purpose:
  // that is the whole overshoot family.
  if (n[0]! < 0 || n[0]! > 1 || n[2]! < 0 || n[2]! > 1) return null;
  return [n[0]!, n[1]!, n[2]!, n[3]!];
}

/** Round-trip an authored ease back to its canonical wire string. */
export function easingToWire(v: unknown): string {
  if (isEasingName(v)) return v;
  const p = easingPoints(v);
  return p ? `cubic-bezier(${p.map((x) => Math.round(x * 1000) / 1000).join(',')})` : '';
}

/**
 * y at time x on a unit cubic bezier with endpoints (0,0) and (1,1).
 *
 * Newton-Raphson first, because it converges in two or three steps for the curves
 * anyone actually authors, then bisection as the guaranteed fallback - the same
 * shape as every browser's own implementation. A near-zero derivative is where
 * Newton diverges (a curve with a flat spot, e.g. an x1 of 0 against an x2 of 1),
 * so that case bails to bisection rather than dividing by it.
 */
export function cubicBezierAt(x1: number, y1: number, x2: number, y2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = sampleX(t) - x;
    if (Math.abs(dx) < 1e-6) return sampleY(t);
    const d = slopeX(t);
    if (Math.abs(d) < 1e-6) break;
    t -= dx / d;
  }
  let lo = 0, hi = 1;
  t = x;
  for (let i = 0; i < 24 && Math.abs(sampleX(t) - x) > 1e-6; i++) {
    if (sampleX(t) < x) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return sampleY(t);
}

/**
 * The geometry curve for one transition: the authored ease if there is a valid one,
 * otherwise the kind's own - which is `easeOutBack` for `pop` and `easeOutCubic` for
 * everything else, exactly as before this control existed.
 */
function geometryEase(kind: string, ease: unknown): (t: number) => number {
  const p = easingPoints(ease);
  if (p) return (t: number) => cubicBezierAt(p[0], p[1], p[2], p[3], t);
  return kind === 'pop' ? easeOutBack : easeOutCubic;
}

// One object's animated offset at progress p∈[0,1] (0 = entrance start, 1 = at rest).
// Distances scale with the object's own size so a small lower-third slides a small way.
//
// `ease` is optional and governs GEOMETRY ONLY (see the easing section above). Omit it
// - as every caller did before the control existed, and as every unauthored box still
// does - and the numbers are identical to the ones this returned when the maths first
// moved out of the compositor.
function recTransition(kind: string, p: number, w: number, h: number, ease?: unknown): { dx: number; dy: number; sc: number; alpha: number; rot: number } {
  if (kind === 'none') return { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 };
  const pc = Math.max(0, Math.min(1, p));
  const curve = geometryEase(kind, ease);
  // `ep` and `eb` are the SAME curve now - a kind picks its default through
  // `geometryEase`, and an authored ease overrides whichever it would have used. The
  // two names are kept because the cases below read as the shapes they always were.
  const ep = curve(pc);
  const eb = kind === 'pop' ? ep : easeOutBack(pc);
  const aFast = Math.min(1, pc / 0.6);   // opacity ramps in fast → crisp video/gif
  const aSlide = Math.min(1, pc / 0.4);
  let dx = 0, dy = 0, sc = 1, alpha = aFast, rot = 0;
  switch (kind) {
    case 'fade': break;
    case 'pop': sc = 0.7 + 0.3 * eb; break;
    case 'grow': sc = Math.max(0.02, ep); break;
    case 'rise': dy = (1 - ep) * (h * 0.6 + 48); break;
    case 'drop': dy = -(1 - ep) * (h * 0.6 + 48); break;
    case 'slide-left':  dx = (1 - ep) * (w * 0.9 + 140); alpha = aSlide; break; // from the right
    case 'slide-right': dx = -(1 - ep) * (w * 0.9 + 140); alpha = aSlide; break; // from the left
    case 'slide-up':    dy = (1 - ep) * (h * 0.9 + 140); alpha = aSlide; break; // from below
    case 'slide-down':  dy = -(1 - ep) * (h * 0.9 + 140); alpha = aSlide; break; // from above
    case 'zoom-in': sc = 0.6 + 0.4 * ep; break;
    case 'zoom-out': sc = 1.5 - 0.5 * ep; break;
    case 'tilt': rot = (1 - ep) * -14; dy = (1 - ep) * 36; break;
    case 'swoop': dx = (1 - ep) * (w * 0.6 + 140); rot = (1 - ep) * 10; break;
    case 'spin': rot = (1 - ep) * -200; sc = 0.5 + 0.5 * ep; break;
    case 'drift': dx = (1 - ep) * (w * 0.25); dy = (1 - ep) * (h * 0.12); alpha = Math.min(1, pc / 0.9); break;
    default: break; // unknown → plain fade
  }
  return { dx, dy, sc, alpha, rot };
}

export { easeOutCubic, easeOutBack, recTransition, geometryEase };

/* ── Split text animation (plans/175 WP-A) ───────────────────────────────────
   A text box whose `split` field names a tier animates its enter/exit PER UNIT
   (word, authored line, or letter) instead of as one block: each unit runs the
   box's own transition kind for the box's own enterMs/exitMs, offset by its
   rank × stagger. The maths lives here - beside the transition vocabulary it
   composes with - because three evaluators consume it (the DOM applier, the
   export planner via the live-raster tier, and the worker through the wire)
   and they must agree to the millisecond.

   Like the kind keys and the ease strings, the tier and order values are wire
   contracts: add members, never rename or reuse one. */

/** The split tiers, in the order the inspector offers them. '' (whole text) is the absence. */
export const SPLIT_TIERS = Object.freeze({
  word: 'Word',
  line: 'Line',
  letter: 'Letter',
} as const);

export type SplitTier = keyof typeof SPLIT_TIERS;

export function isSplitTier(v: unknown): v is SplitTier {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SPLIT_TIERS, v);
}

/** Unit orderings. '' - the default - is first-to-last. */
export const SPLIT_ORDERS = Object.freeze({
  '': 'First to last',
  reverse: 'Last to first',
  center: 'From the centre',
  random: 'Random',
} as const);

export type SplitOrder = keyof typeof SPLIT_ORDERS;

export function isSplitOrder(v: unknown): v is SplitOrder {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(SPLIT_ORDERS, v);
}

/** Wire clamp on the per-unit gap - matches the manifest field's max. */
export const MAX_SPLIT_STAGGER_MS = 2000;

/**
 * The most units one box may animate. The hook stops wrapping past this count
 * (the remainder of the text becomes one final unit), so a pasted novel cannot
 * schedule ten thousand spans - the untrusted-input posture, applied to markup.
 * Mirrored as a literal in design/hooks.js (tool data imports nothing).
 */
export const MAX_SPLIT_UNITS = 240;

/**
 * Deterministic seed for the `random` order - FNV-1a over the box's id string,
 * folded with the unit count so an edited text reshuffles. Both DOM evaluators
 * hash the SAME `data-box-id`; the worker receives the result on the wire.
 * Never Math.random: preview, export and CLI must deal the same shuffle.
 */
export function splitSeedOf(boxId: string, n: number): number {
  let h = 0x811c9dc5;
  const s = String(boxId ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h ^ n) >>> 0;
}

/** mulberry32 - tiny, seeded, good enough to shuffle a caption. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Each unit's delay RANK (0..n-1) in DOM order: unit i starts `ranks[i] × stagger`
 * into the phase. Pure function of (order, n, seed) so every evaluator deals the
 * same permutation; callers may cache the array per box.
 */
export function splitRanks(order: SplitOrder | string, n: number, seed = 0): number[] {
  const count = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  const ranks = new Array<number>(count);
  if (count === 0) return ranks;
  if (order === 'reverse') {
    for (let i = 0; i < count; i++) ranks[i] = count - 1 - i;
  } else if (order === 'center') {
    // Units nearest the centre lead; ties break toward the earlier unit.
    const byCloseness = Array.from({ length: count }, (_, i) => i)
      .sort((a, b) => Math.abs(a - (count - 1) / 2) - Math.abs(b - (count - 1) / 2) || a - b);
    byCloseness.forEach((unit, rank) => { ranks[unit] = rank; });
  } else if (order === 'random') {
    const perm = Array.from({ length: count }, (_, i) => i);
    const rnd = mulberry32(seed);
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = perm[i] as number; perm[i] = perm[j] as number; perm[j] = t;
    }
    perm.forEach((unit, rank) => { ranks[unit] = rank; });
  } else {
    for (let i = 0; i < count; i++) ranks[i] = i;
  }
  return ranks;
}

/**
 * How long a split phase runs, ms: the stagger span plus one unit's own
 * animation. `phaseMs` is 0 when the phase has no authored kind - the cut-in
 * case, where each unit simply appears at its offset (typewriter).
 */
export function splitPhaseWindowMs(staggerMs: number, n: number, phaseMs: number): number {
  const stag = clampNum(staggerMs, 0, MAX_SPLIT_STAGGER_MS);
  const units = Number.isFinite(n) && n > 1 ? Math.floor(n) : 1;
  const phase = Number.isFinite(phaseMs) && phaseMs > 0 ? phaseMs : 0;
  return stag * (units - 1) + phase;
}

/**
 * One unit's progress toward rest during a phase. `localMs` is time into the
 * phase window (enter: t − start; exit: end − t, both in box-local ms), `rank`
 * the unit's dealt delay rank. 0 = fully out, 1 = at rest - recTransition's own
 * convention. A zero `phaseMs` is a step: out until the unit's offset passes.
 */
export function splitUnitP(localMs: number, rank: number, staggerMs: number, phaseMs: number): number {
  const at = localMs - rank * clampNum(staggerMs, 0, MAX_SPLIT_STAGGER_MS);
  if (!(phaseMs > 0)) return at > 0 ? 1 : 0;
  return clampNum(at / phaseMs, 0, 1);
}

function clampNum(v: number, lo: number, hi: number): number {
  return Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : lo;
}

/* ── Hold effects (plans/175 WP-B) ────────────────────────────────────────────
   The third bucket every benchmarked tool ships beside In and Out - CapCut calls
   it Loop, PowerPoint Emphasis, animate.css "attention seekers": a small looping
   motion while the box is ON screen. A deterministic sinusoid of box-local time,
   composed with the transition offset (`withHold`) in BOTH evaluators, so preview
   and export read identical numbers - no RNG, no keyframes, no plate re-shots
   (the compositor's per-frame transform animates a static plate).

   Every pose is AT REST at t = 0 and periodic, so a hold is continuous with the
   enter it follows whatever the timing. Amplitudes are fixed house values - the
   one authored knob is the RATE, exactly as the plan scoped it. Like the kinds
   and tiers above, the names are wire contracts: add members, never rename. */

/** The hold kinds, in the order the inspector offers them. '' (none) is the absence. */
export const HOLD_FX = Object.freeze({
  pulse: 'Pulse',
  bob: 'Bob',
  sway: 'Sway',
  flicker: 'Flicker',
} as const);

export type HoldFx = keyof typeof HOLD_FX;

export function isHoldFx(v: unknown): v is HoldFx {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(HOLD_FX, v);
}

/** Rate clamps, cycles per second. Sub-0.2 reads as stuck; past 4 reads as a bug. */
export const MIN_HOLD_RATE = 0.2;
export const MAX_HOLD_RATE = 4;
export const DEFAULT_HOLD_RATE = 1;

/**
 * One box's hold pose at `localMs` into its life. recTransition's own offset
 * convention ({dx, dy, sc, alpha, rot}), so the two compose without adapters.
 */
export function holdPose(kind: HoldFx | string, localMs: number, rateHz: number, w: number, h: number): TransitionOffset {
  const f = clampNum(rateHz, MIN_HOLD_RATE, MAX_HOLD_RATE);
  const t = (Number.isFinite(localMs) ? Math.max(0, localMs) : 0) / 1000;
  const wave = Math.sin(2 * Math.PI * f * t);
  switch (kind) {
    case 'pulse': return { dx: 0, dy: 0, sc: 1 + 0.04 * wave, alpha: 1, rot: 0 };
    // Drift scales with the box so a small sticker bobs a small way (the
    // recTransition distance rule), with a floor so a tiny chip still moves.
    case 'bob': return { dx: 0, dy: (Math.max(0, h) * 0.02 + 4) * wave, sc: 1, alpha: 1, rot: 0 };
    case 'sway': return { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 2.5 * wave };
    // |sin(π·f·t)| keeps the period at 1/f and the dips shallow (0.7 floor) -
    // a fast shimmer, never a slow alpha ramp that muddies under video compression.
    case 'flicker': return { dx: 0, dy: 0, sc: 1, alpha: 1 - 0.3 * Math.abs(Math.sin(Math.PI * f * t)), rot: 0 };
    default: return { dx: 0, dy: 0, sc: 1, alpha: 1, rot: 0 };
  }
}

/** Compose a transition offset with a hold pose: displacements add, factors multiply. */
export function withHold(off: TransitionOffset, hold: TransitionOffset): TransitionOffset {
  return {
    dx: off.dx + hold.dx,
    dy: off.dy + hold.dy,
    sc: off.sc * hold.sc,
    alpha: clampNum(off.alpha * hold.alpha, 0, 1),
    rot: off.rot + hold.rot,
  };
}
