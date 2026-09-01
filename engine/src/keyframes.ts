// SPDX-License-Identifier: MPL-2.0
/**
 * Keyframe tracks, the `kf` wire grammar, and the depth-camera projection - 
 * the shared, DOM-free maths every consumer of plans/104 trusts.
 *
 * Three separable pieces live here, and nothing else may:
 *
 * 1. **The `kf` wire** (plan section 5.1, LOCKED 2026-08-11). One per-box text field
 *    holds a whole animation track: keyframes separated by `*`, tokens inside a
 *    keyframe by `_`, first token `t<ms>` (local box time). The charset is
 *    `A–Z a–z 0–9 - . _ * ( )` - every member is encodeURIComponent-unescaped
 *    and safe inside double quotes in bash/zsh, because "the CLI is URL mode
 *    under a different transport" is law. `!` is deliberately NOT in it (shell
 *    history expansion), which is why a custom bezier is paren-delimited
 *    (`eb(0.32)(0)(0.67)(1)`) and why the canonical CSS `cubic-bezier(a,b,c,d)`
 *    spelling - commas - can only reach the track through the ease adapter.
 *    The vocabulary is append-only: new channels and ease tokens may be ADDED,
 *    existing token meanings never change.
 *
 * 2. **Evaluation** (plan section 5.2). Per-channel sparse interpolation: each channel
 *    interpolates between the nearest keyframes that MENTION it, using the
 *    earlier mentioning keyframe's ease, clamp-held outside the authored range.
 *    The segment ease governs every channel EXCEPT `o`, which always
 *    interpolates linearly (a fade that tracks a slow curve turns to mud once
 *    the frame has been through video compression) - `eh` still holds it, like
 *    any channel.
 *
 * 3. **The projection** (plan section 4). A perspective projection of a
 *    screen-parallel plane is a uniform scale + translate - pure affine - so
 *    the camera never needs CSS `perspective`/`preserve-3d`: this module
 *    computes numbers and every consumer applies them. `projectLayer` is the
 *    section 4.1 fold verbatim, `dofBlur` the section 4.4 corrected blur, `resolveCamera` the
 *    section 5.4 cuts rule.
 *
 * 4. **Tilt** (plan section 6.4, P2). The one thing that is NOT affine: pitch or yaw
 *    the camera and a screen-parallel plane's image becomes a homography. That
 *    tier lives beside the affine one rather than replacing it - `cameraTilted`
 *    is an exact zero test, and everything the affine tier ever computed is
 *    computed by the same expressions in the same order when it answers false.
 *    A tilted layer additionally gets `KfProjection.m`, an element-local 3×3 a
 *    DOM consumer spells as `matrix3d(...)` (per element, always FLAT - never a
 *    `perspective`/`preserve-3d` ancestor: that is the Cover Flow rule, and
 *    `parseCssMatrix` refuses a real 3D context, so a walker still of one comes
 *    out blank). The canvas compositor cannot draw a homography at all, which
 *    is why a tilted export is captured off the live DOM instead (section 6.4's P2a).
 *
 * Zero dependencies, no DOM, no logging side effects (callers pass `onWarn`).
 * Everything a consumer needs to talk about the wire - clamps, quanta, caps,
 * the guard constants, `DOF_K` - is exported as a named constant so the DOM
 * path, the plan path, the worker and the goldens all read the same numbers
 * instead of re-deriving them.
 *
 * ## Sign conventions, stated once
 *
 * `eff = P / (P − (z − camZ))` (section 4.1). A layer's `z` is px ABOVE the surface,
 * so raising a layer brings it toward the camera and magnifies it; raising
 * `camZ` moves the whole scene away and shrinks it. `eff(z = camZ) === 1` for
 * EVERY `p` - so `p` is perspective strength (FOV), never magnification, and a
 * dolly is `camZ` (section 4.3).
 *
 * ## Relative vs absolute channels
 *
 * On a CONTENT box, `x/y/s/r/o/b` are relative (offsets/multipliers over the
 * authored + transition values - the consumer folds them, section 5.2), and a keyed
 * `z` REPLACES the box's `z` field for that segment - as do `w`/`h`, which are
 * absolute px and replace the box's own size (a multiplier there would be `s`,
 * which already exists and does not reflow). On a CAMERA, that same
 * replace rule is generalised to the whole pose: a keyed channel replaces the
 * base pose, and the base is the value wherever no token is authored. There is
 * no sensible additive reading of a focal length.
 */

// ─── channels ────────────────────────────────────────────────────────────────

/**
 * Every channel the grammar knows, in canonical serialisation order.
 *
 * APPEND-ONLY. `w`/`h` joined at the tail (plans/104 section 5.2, the P1 reversal) rather
 * than beside `x`/`y` where they read better, because the order IS the serialisation
 * order: inserting one in the middle would re-spell every track already on the wire
 * and break the section 4.6 round-trip law for links that are already shared.
 *
 * `v` (plans/165 WP-3) is CLIP VOLUME, a 0..2 multiplier over the box's own gain
 * field. It is an AUDIO channel: the audio mix and the preview clock consume it,
 * and every visual fold ignores it - a keyed `v` on a video box never moves a
 * pixel. It rides this grammar (rather than its own field) so split/trim/join
 * rebase volume keys exactly as they rebase pose keys, with zero extra code.
 */
export const KF_CHANNELS = ['x', 'y', 'z', 's', 'r', 'rx', 'ry', 'o', 'b', 'f', 'a', 'p', 'w', 'h', 'v'] as const;

export type KfChannel = (typeof KF_CHANNELS)[number];

/** The channels a camera box uses (`s`/`o`/`b` are meaningless on a camera). */
export type KfCameraChannel = 'x' | 'y' | 'z' | 'rx' | 'ry' | 'f' | 'a' | 'p';

export const KF_CAMERA_CHANNELS: readonly KfCameraChannel[] = Object.freeze(
  ['x', 'y', 'z', 'rx', 'ry', 'f', 'a', 'p'] as const,
);

/** A sparse set of channel values - what an evaluation returns. */
export type KfPose = Partial<Record<KfChannel, number>>;

const CHANNEL_SET: ReadonlySet<string> = new Set<string>(KF_CHANNELS);

export function isKfChannel(v: unknown): v is KfChannel {
  return typeof v === 'string' && CHANNEL_SET.has(v);
}

/**
 * Channel names longest-first: the section 5.1 token rule is "longest channel name
 * whose suffix parses as a valid number", which is what makes `rx-8` the `rx`
 * channel at −8 and never `r` followed by junk.
 */
const CHANNELS_BY_LENGTH: readonly KfChannel[] = Object.freeze(
  [...KF_CHANNELS].sort((a, b) => b.length - a.length || (a < b ? -1 : 1)),
);

/**
 * Per-channel value clamps (untrusted-input posture: a `kf` field is free text
 * that can arrive from a hand-edited share URL).
 *
 * These are the WIRE clamps - what a `kf` token may say - and the `z` row is
 * deliberately NOT the per-box field's −300…900 (that is `KF_Z_FIELD_CLAMP`,
 * below). One `kf` grammar carries both a content box's lift and the CAMERA's
 * dolly (section 5.4: camera channels are `x y z rx ry f a p`), and `camZ` is the only
 * zoom control there is (section 4.3: "Uniform zoom/dolly is `camZ` … there is
 * deliberately no separate zoom channel"). Held to the field's 900 ceiling the
 * whole flat-scene zoom range would be eff ∈ [0.571, 1.333] at P = 1200 - a
 * push-in past 1.33× would not be expressible, and section 4.3's Vertigo recipe
 * (`camZ = P·(1/c − 1) + z_s`, so camZ = −600 to pin a 2× subject plane) would
 * clamp silently and desync the dolly from `p`. So `z` spans ±12000, matching
 * `p`'s own ceiling - a few multiples of any usable perspective.
 *
 * `p` stays well clear of 0 in both directions - the projection divides by it.
 */
export const KF_CLAMPS = Object.freeze({
  x: [-100000, 100000],
  y: [-100000, 100000],
  z: [-12000, 12000],
  s: [0.01, 100],
  r: [-3600, 3600],
  rx: [-180, 180],
  ry: [-180, 180],
  o: [0, 1],
  b: [0, 300],
  f: [-3000, 3000],
  a: [0, 1],
  p: [50, 12000],
  // ABSOLUTE px, and non-negative: a keyed `w`/`h` REPLACES the box's own size for
  // that segment (section 5.2), so there is no additive reading to allow a negative for.
  // 16384 is deliberately twice `PLATE_LONG_SIDE_LARGE`, the widest plate any shell
  // will actually capture: this is the untrusted-input backstop (a hand-edited share
  // URL), and the operative limit on a stretched layer is the plate budget's own
  // long-side cap, which is measured in device px and knows the export scale. A wire
  // clamp tighter than that would silently disagree with the budget on big boards.
  w: [0, 16384],
  h: [0, 16384],
  // Clip volume multiplier: silent to a 2x boost, the gain field's own range.
  v: [0, 2],
} as const) satisfies Readonly<Record<KfChannel, readonly [number, number]>>;

/**
 * The per-box `z` FIELD's own clamp (section 5.3 / section 12 Q1): slider 0–300, field and
 * scrub clamp −300…900 (mirrors shadowX/Y's ±300 house clamp; 900 keeps 180px
 * of margin under the 0.9P guard at the default P).
 *
 * This is the clamp on the NUMBER a box stores, applied where that number is
 * read (the hooks' `data-t-z`, the manifest field's min/max, the inspector
 * slider) - not on the `kf` wire, which has to be wide enough for a camera
 * dolly (see `KF_CLAMPS` above). Exported so the one number has one home.
 */
export const KF_Z_FIELD_CLAMP: readonly [number, number] = Object.freeze([-300, 900] as const);

/** Serialisation quanta (section 4.6). Parse applies them too - that is the round-trip law. */
export const KF_QUANTA = Object.freeze({
  x: 0.01, y: 0.01, z: 0.01, b: 0.01,
  r: 0.01, rx: 0.01, ry: 0.01,
  s: 0.001, o: 0.001, a: 0.001,
  f: 0.01, p: 0.01,
  w: 0.01, h: 0.01,
  v: 0.001,
} as const) satisfies Readonly<Record<KfChannel, number>>;

/** Bezier control points quantise finer than px (section 4.6). */
export const KF_BEZIER_QUANTUM = 0.001;

/** Bezier y is unbounded in CSS; bound it here for the same reason as the channels. */
const KF_BEZIER_Y_MAX = 10;

// ─── parse caps ──────────────────────────────────────────────────────────────

/** Max keyframes in one track; the excess is dropped (section 5.1 parse caps). */
export const KF_MAX_KEYS = 256;

/**
 * Max characters read from a `kf` field; the excess is ignored.
 *
 * This is the untrusted-input BACKSTOP, and it is deliberately derived from
 * `KF_MAX_KEYS` rather than picked: the two caps have to be mutually
 * satisfiable or the module produces a wire it then mangles. The widest a
 * single keyframe can serialise to is `t` at its cap (8) + the separator + the
 * widest custom bezier (32) + all 15 channels at the widest spelling their
 * clamp and quantum allow (125) + one separator per channel (15) = 181 chars,
 * so a full-density track is 256 × 181 + 255 = 46 591.
 * 49 152 (48 KiB) clears that, which is what makes the section 4.6 round-trip law
 * `parse(serialise(parse(s))) === parse(s)` hold BY CONSTRUCTION for every
 * input: the key cap dominates, so `serialiseKf` can never hand back a string
 * `parseKf` would truncate. `tests/keyframes.test.ts` re-derives the 174 from
 * `KF_CLAMPS`/`KF_QUANTA` and fails if a widened clamp ever eats the headroom - 
 * re-derive this constant then, don't paper over it. It has already happened
 * once, which is why the test exists: `w`/`h` (plans/104 section 5.2, P1) added two
 * channels worth 20 chars per key, i.e. 5 120 chars of full-density track, and
 * 40 960 stopped dominating. `v` (plans/165) later added 7 more per key and the
 * headroom absorbed it - 2 561 chars now remain under the 48 KiB cap.
 *
 * (Plan section 5.1 said 8 KB, written before anyone measured a full-pose track: at
 * 8 KB a 256-key camera track loses ~148 of its keyframes on the way out.)
 */
export const KF_MAX_CHARS = 49152;

/** `t` is clamped to this (MAX_TIME_S · 1000). */
export const KF_MAX_TIME_MS = 3_600_000;

/** DOF blur is capped at the `b` channel's own ceiling so a fly-past cannot hand the compositor an absurd radius. */
export const KF_MAX_BLUR = 300;

/** Every byte a serialised track may contain. Nothing else - never `~` or `,`. */
export const KF_CHARSET_RE = /^[A-Za-z0-9._*()-]*$/;

/** True when a string is safe to put on the wire as a `kf` value. */
export function isKfSafe(s: unknown): boolean {
  return typeof s === 'string' && KF_CHARSET_RE.test(s);
}

// ─── easing ──────────────────────────────────────────────────────────────────

/** The eight named preset tokens, all of which round-trip by name. */
export const KF_EASE_TOKENS = ['el', 'ei', 'eo', 'eio', 'ev', 'ea', 'es', 'ek'] as const;

export type KfEasePresetToken = (typeof KF_EASE_TOKENS)[number];

export interface KfEasePreset {
  /** The name the shell's easing menu uses on its own wire (`EASINGS` in transitions.ts). */
  readonly name: string;
  /** CSS control-point order: x1, y1, x2, y2. */
  readonly pts: readonly [number, number, number, number];
}

/**
 * The preset curves.
 *
 * The first six are byte-identical to the shell's `EASING_POINTS`, so an ease
 * authored on a transition and one authored on a keyframe are the same curve.
 * The last two are the additive names plan section 3 adopts from the Depthfield menu:
 *
 * - `es` **smooth** = `cubic-bezier(0.4, 0, 0.2, 1)` - the standard
 *   accelerate-decelerate curve (Material's "standard"), specified by name in
 *   the plan.
 * - `ek` **snappy** = `cubic-bezier(0.4, 0, 0.6, 1)` - Material's "sharp"
 *   curve: the same 0.4 in-ramp as smooth with a much later out-handle, so it
 *   leaves at the same rate and arrives abruptly. Chosen over the other
 *   "snappy" candidates because it is a documented standard curve and reads as
 *   a deliberate sibling of `smooth` rather than a second overshoot.
 */
export const KF_EASE_PRESETS = Object.freeze({
  el: { name: 'linear', pts: [0, 0, 1, 1] },
  ei: { name: 'ease-in', pts: [0.32, 0, 0.67, 0] },
  eo: { name: 'ease-out', pts: [0.33, 1, 0.68, 1] },
  eio: { name: 'ease-in-out', pts: [0.65, 0, 0.35, 1] },
  ev: { name: 'overshoot', pts: [0.34, 1.56, 0.64, 1] },
  ea: { name: 'anticipate', pts: [0.36, -0.4, 0.66, 1] },
  es: { name: 'smooth', pts: [0.4, 0, 0.2, 1] },
  ek: { name: 'snappy', pts: [0.4, 0, 0.6, 1] },
} as const) satisfies Readonly<Record<KfEasePresetToken, KfEasePreset>>;

/** Hold: the channel keeps the earlier keyframe's value until the next one. */
export const KF_HOLD_EASE = 'eh';

/** The ease a keyframe with no ease token means (section 5.1: "Absent = `eio`"). */
export const KF_DEFAULT_EASE = 'eio';

/** Referenced directly by the `o`-is-always-linear rule. */
export const KF_LINEAR_EASE = 'el';

/** The non-CSS sentinel `kfEaseCss` returns for `eh` (a hold is not a bezier). */
export const KF_HOLD_CSS = 'hold';

const EB_RE = /^eb\(([^()]*)\)\(([^()]*)\)\(([^()]*)\)\(([^()]*)\)$/;
const NUM_RE = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;
const T_RE = /^t(-?(?:\d+(?:\.\d+)?|\.\d+))$/;
const CSS_BEZIER_RE = /^\s*cubic-bezier\(([^()]*)\)\s*$/i;

// ─── small numeric helpers ───────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Round to a quantum. The inverse is always an exact integer power of ten here,
 * so this is `Math.round(v * 100) / 100` and friends - no float dust, and
 * `String()` of the result is the shortest round-tripping spelling.
 */
function quant(v: number, q: number): number {
  const inv = Math.round(1 / q);
  const n = Math.round(v * inv) / inv;
  return Object.is(n, -0) ? 0 : n;
}

/** Strict decimal parse - no exponents, no `NaN`, no `Infinity`, no `+`. */
function num(s: string): number | null {
  if (!NUM_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Bound how much untrusted text a warning may quote - a `kf` value can be 8 KB of anything. */
function snip(s: string): string {
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

/** Wire spelling of a quantised number. Values are clamped, so never exponent form. */
function fmt(v: number): string {
  return String(Object.is(v, -0) ? 0 : v);
}

// ─── the ease adapter ────────────────────────────────────────────────────────

/**
 * y at time x on a unit cubic bezier with endpoints (0,0) and (1,1).
 *
 * Newton-Raphson first (two or three steps for any curve anyone authors), then
 * bisection as the guaranteed fallback - the shape every browser's own
 * implementation uses. A near-zero derivative is where Newton diverges (a curve
 * with a flat spot), so that case bails to bisection rather than dividing by it.
 * x is clamped to [0,1]; y is deliberately unbounded - that is the whole
 * overshoot family.
 *
 * This is a deliberate local copy of the web shell's `cubicBezierAt`
 * (shells/web/src/lib/transitions.ts): the engine must not import from a shell,
 * and the two are pinned to each other by the golden tables on both sides.
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

/** Canonical token for four control points: a preset's name when they match one, else `eb(...)`. */
function easeFromPoints(x1: number, y1: number, x2: number, y2: number): string {
  // x is TIME and must stay inside the unit interval or the curve is not a
  // function of progress - CSS rejects the same thing.
  const p: [number, number, number, number] = [
    quant(clamp(x1, 0, 1), KF_BEZIER_QUANTUM),
    quant(clamp(y1, -KF_BEZIER_Y_MAX, KF_BEZIER_Y_MAX), KF_BEZIER_QUANTUM),
    quant(clamp(x2, 0, 1), KF_BEZIER_QUANTUM),
    quant(clamp(y2, -KF_BEZIER_Y_MAX, KF_BEZIER_Y_MAX), KF_BEZIER_QUANTUM),
  ];
  for (const tok of KF_EASE_TOKENS) {
    const q = KF_EASE_PRESETS[tok].pts;
    if (q[0] === p[0] && q[1] === p[1] && q[2] === p[2] && q[3] === p[3]) return tok;
  }
  return `eb(${fmt(p[0])})(${fmt(p[1])})(${fmt(p[2])})(${fmt(p[3])})`;
}

/**
 * A token in its canonical spelling, or null when it is not an ease at all.
 * A custom bezier that happens to equal a preset normalises to the preset name.
 */
export function normaliseKfEase(tok: unknown): string | null {
  if (typeof tok !== 'string' || tok === '') return null;
  if (tok === KF_HOLD_EASE) return KF_HOLD_EASE;
  if (Object.hasOwn(KF_EASE_PRESETS, tok)) return tok;
  const m = EB_RE.exec(tok);
  if (!m) return null;
  const a = num(m[1] ?? ''), b = num(m[2] ?? ''), c = num(m[3] ?? ''), d = num(m[4] ?? '');
  if (a === null || b === null || c === null || d === null) return null;
  return easeFromPoints(a, b, c, d);
}

// Bounded so a track full of junk cannot grow it without limit. Module-level and
// therefore per-thread, which is the point: the cached form is a plain string
// key, never a compiled closure - a closure in a structured-cloned track would
// DataCloneError and silently kill worker offload (section 5.1).
const EASE_PTS_CACHE = new Map<string, readonly [number, number, number, number] | null>();

function easePts(ease: string): readonly [number, number, number, number] | null {
  if (Object.hasOwn(KF_EASE_PRESETS, ease)) return KF_EASE_PRESETS[ease as KfEasePresetToken].pts;
  const hit = EASE_PTS_CACHE.get(ease);
  if (hit !== undefined) return hit;
  const norm = normaliseKfEase(ease);
  let pts: readonly [number, number, number, number] | null = null;
  if (norm !== null && norm !== KF_HOLD_EASE) {
    if (Object.hasOwn(KF_EASE_PRESETS, norm)) pts = KF_EASE_PRESETS[norm as KfEasePresetToken].pts;
    else {
      const m = EB_RE.exec(norm);
      if (m) {
        const a = num(m[1] ?? ''), b = num(m[2] ?? ''), c = num(m[3] ?? ''), d = num(m[4] ?? '');
        if (a !== null && b !== null && c !== null && d !== null) pts = Object.freeze([a, b, c, d] as [number, number, number, number]);
      }
    }
  }
  if (EASE_PTS_CACHE.size >= 256) EASE_PTS_CACHE.clear();
  EASE_PTS_CACHE.set(ease, pts);
  return pts;
}

/** The four control points of an ease token, or null for `eh` / anything unparseable. */
export function kfEasePoints(ease: unknown): [number, number, number, number] | null {
  if (typeof ease !== 'string') return null;
  const p = easePts(ease);
  return p ? [p[0], p[1], p[2], p[3]] : null;
}

/**
 * Eased progress at raw progress `u ∈ [0,1]`.
 *
 * `eh` holds: 0 until the segment ends. An unrecognised token falls back to the
 * grammar's default rather than throwing - junk is skipped everywhere else too.
 */
export function kfEaseAt(ease: string, u: number): number {
  if (!(u > 0)) return 0;
  if (u >= 1) return 1;
  if (ease === KF_HOLD_EASE) return 0;
  const p = easePts(ease) ?? KF_EASE_PRESETS[KF_DEFAULT_EASE as KfEasePresetToken].pts;
  return cubicBezierAt(p[0], p[1], p[2], p[3], u);
}

/**
 * kf token → the canonical CSS wire the easing editor speaks.
 *
 * Always the `cubic-bezier(a,b,c,d)` spelling (commas - which is exactly why
 * this adapter exists: they are banned from the kf charset). `eh` has no CSS
 * equivalent and returns the documented `'hold'` sentinel; anything
 * unrecognised returns the default ease's CSS.
 */
export function kfEaseCss(ease: unknown): string {
  if (ease === KF_HOLD_EASE) return KF_HOLD_CSS;
  const p = (typeof ease === 'string' ? easePts(ease) : null)
    ?? KF_EASE_PRESETS[KF_DEFAULT_EASE as KfEasePresetToken].pts;
  return `cubic-bezier(${p.map((n) => fmt(quant(n, KF_BEZIER_QUANTUM))).join(',')})`;
}

/** kf token → the shell's preset NAME (`'smooth'`, `'ease-out'`, …), or '' for a custom bezier / hold. */
export function kfEaseName(ease: unknown): string {
  if (typeof ease !== 'string') return '';
  const norm = normaliseKfEase(ease);
  if (norm === null || norm === KF_HOLD_EASE) return '';
  return Object.hasOwn(KF_EASE_PRESETS, norm) ? KF_EASE_PRESETS[norm as KfEasePresetToken].name : '';
}

const NAME_TO_TOKEN: ReadonlyMap<string, string> = new Map(
  KF_EASE_TOKENS.map((tok) => [KF_EASE_PRESETS[tok].name, tok as string]),
);

/**
 * The other direction: anything the easing editor might hand us → a kf token.
 *
 * Accepts a kf token, a preset NAME from the shell's `EASINGS`, a CSS
 * `cubic-bezier(a,b,c,d)`, or the `'hold'` sentinel. Unrecognised input becomes
 * the grammar's default - this adapter never throws and never emits a token the
 * charset would reject.
 */
export function kfEaseToken(v: unknown): string {
  if (typeof v !== 'string') return KF_DEFAULT_EASE;
  const s = v.trim();
  if (s === KF_HOLD_CSS || s === KF_HOLD_EASE) return KF_HOLD_EASE;
  const byName = NAME_TO_TOKEN.get(s);
  if (byName) return byName;
  const direct = normaliseKfEase(s);
  if (direct !== null) return direct;
  const m = CSS_BEZIER_RE.exec(s);
  if (m) {
    const parts = (m[1] ?? '').split(',').map((x) => num(x.trim()));
    if (parts.length === 4 && parts.every((n) => n !== null)) {
      return easeFromPoints(parts[0] as number, parts[1] as number, parts[2] as number, parts[3] as number);
    }
  }
  return KF_DEFAULT_EASE;
}

// ─── segment subdivision (the trim/split/join rebase, section 5.6) ──────────────────

/** The two eases a subdivided segment needs (see {@link subdivideKfEase}). */
export interface KfEaseSubdivision {
  /** Ease for the part BEFORE the cut, renormalised to its own unit square. */
  readonly left: string;
  /** Ease for the part AFTER the cut. */
  readonly right: string;
}

/**
 * The curve parameter `s` at which the easing cubic's x reaches `x`.
 *
 * `cubicBezierAt` needs y at x and throws the parameter away; a subdivision
 * needs the parameter itself, because de Casteljau splits in PARAMETER space.
 * Same solver shape (Newton, then bisection as the guaranteed fallback), and
 * the same reason it terminates: for control x in [0,1] the cubic's x(s) is
 * monotone, so the bisection bracket is always valid.
 */
function easeParamAtX(x1: number, x2: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const sampleX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const slopeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const dx = sampleX(t) - x;
    if (Math.abs(dx) < 1e-9) return t;
    const d = slopeX(t);
    if (Math.abs(d) < 1e-9) break;
    t -= dx / d;
    if (!(t >= 0 && t <= 1)) break;
  }
  let lo = 0, hi = 1;
  t = x;
  for (let i = 0; i < 60 && Math.abs(sampleX(t) - x) > 1e-12; i++) {
    if (sampleX(t) < x) lo = t; else hi = t;
    t = (lo + hi) / 2;
  }
  return clamp(t, 0, 1);
}

/**
 * Below this the renormalisation divides by (almost) nothing - see the
 * degenerate case in {@link subdivideKfEase}.
 */
const SUBDIVIDE_EPS = 1e-4;

/**
 * A subdivided half, as a token - with the one canonicalisation `easeFromPoints`
 * cannot make on its own.
 *
 * `easeFromPoints` recognises a preset by exact control-point equality, and a
 * subdivision re-parametrises: splitting LINEAR at the midpoint yields the
 * control net (0,0)(0.5,0.5), which is the identity curve spelled differently.
 * Same function, but it would come back as `eb(0)(0)(0.5)(0.5)` - so the halves
 * of a linear move would each read "Custom" in the easing menu, and the wire
 * would grow, for a segment nobody eased. `y1 === x1 && y2 === x2` makes
 * `y(t) === x(t)` identically, so that net IS `el` and is named as such.
 *
 * Kept local to the subdivision rather than folded into `easeFromPoints`: the
 * adapter's job is to round-trip what the easing editor says, and an author who
 * types `cubic-bezier(0.5,0.5,1,1)` gets that back verbatim.
 */
function subdividedEaseToken(x1: number, y1: number, x2: number, y2: number): string | null {
  // OUT OF RANGE IS NOT A CURVE. `easeFromPoints` CLAMPS y to ±KF_BEZIER_Y_MAX, which
  // is right for an author typing a wild bezier and catastrophic here: a renormalised
  // half whose control y is 40 comes back spelled `10`, i.e. a completely different
  // motion, silently. Null instead, so the caller can keep the original token and say
  // so. (x is clamped to [0,1] too, but a de Casteljau half of a curve with control x
  // in [0,1] cannot leave it, so only y can trip this.)
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) return null;
  if (Math.abs(y1) > KF_BEZIER_Y_MAX || Math.abs(y2) > KF_BEZIER_Y_MAX) return null;
  const q = KF_BEZIER_QUANTUM;
  if (quant(x1, q) === quant(y1, q) && quant(x2, q) === quant(y2, q)) return 'el';
  return easeFromPoints(x1, y1, x2, y2);
}

/**
 * Split one segment's ease at `lambda` - the fraction of the segment's TIME at
 * which a cut lands - into the ease each half needs to reproduce the original
 * motion. This is what makes a split/trim/join rebase honest rather than
 * approximately honest (plan section 5.6).
 *
 * The algebra, once. A segment interpolates `av → bv` through the eased
 * progress `E(u)`. Cutting at `λ` gives the first half endpoints `av → av +
 * (bv − av)·E(λ)`, so its own evaluator computes `av + (bv − av)·E(λ)·E_L(u)`
 * and needs
 *
 *     E_L(u) = E(u·λ) / E(λ)
 *
 * while the second half runs from that value to `bv` and needs
 *
 *     E_R(u) = (E(λ + (1 − λ)·u) − E(λ)) / (1 − E(λ))
 *
 * Both are exactly the de Casteljau halves of the cubic at the parameter where
 * x = λ, each rescaled back into the unit square - which is why this is a
 * subdivision and not a fit. Returned as canonical tokens (a half that lands on
 * a preset comes back BY NAME), so the caller can splice them straight into a
 * track.
 *
 * Exactness, stated: the halves reproduce the original to the section 4.6 bezier
 * quantum (0.001 on each control point). Three cases cannot be expressed at all
 * and keep the original token instead - documented approximations, not silent
 * ones:
 *
 * - `eh` (hold) has no bezier to split; both halves hold.
 * - `E(λ) → 0` or `E(λ) → 1`: the half's two endpoints coincide, so the
 *   renormalisation `E(u·λ)/E(λ)` divides by (almost) nothing and a two-point
 *   segment is constant no matter which curve it carries.
 * - the renormalised half is OUT OF RANGE: its control y leaves ±10, the bound
 *   the wire's bezier spelling can hold, so no token can express it.
 *
 * THE RESIDUAL, MEASURED (and it is not what the first version of this comment
 * claimed). Only the overshoot family can reach its own start/end value in
 * flight - `ev` crosses E = 1 at λ ≈ 0.3691, `ea` returns to E = 0 at
 * λ ≈ 0.2735 - and the earlier justification ("the excursion is bounded by the
 * endpoints' separation") is false exactly there: the endpoints COINCIDE while
 * `ev`'s excursion is 56 % of travel. Around each crossing there is a band - 
 * λ ∈ [0.348, 0.387] for `ev`, λ ∈ [0.264, 0.284] for `ea` - where the halves
 * are an approximation with up to ~0.10 of error in E, i.e. ~10 px on a 100 px
 * move, mid-segment; it falls to zero at each edge of the band. That is an
 * expressive limit, not a bug to fix: a segment whose two endpoint VALUES are
 * equal cannot carry an excursion in any easing vocabulary, ours or CSS's. The
 * only thing that was a bug is emitting a clamped, wrong-motion bezier instead
 * of saying so, which the range check above ends.
 *
 * `lambda` outside (0, 1) means the cut is not inside the segment: both halves
 * keep the original ease.
 */
export function subdivideKfEase(ease: unknown, lambda: number): KfEaseSubdivision {
  const tok = (typeof ease === 'string' ? normaliseKfEase(ease) : null) ?? KF_DEFAULT_EASE;
  if (tok === KF_HOLD_EASE) return { left: KF_HOLD_EASE, right: KF_HOLD_EASE };
  const lam = typeof lambda === 'number' && Number.isFinite(lambda) ? lambda : 0;
  if (!(lam > 0) || !(lam < 1)) return { left: tok, right: tok };
  const p = easePts(tok) ?? KF_EASE_PRESETS[KF_DEFAULT_EASE as KfEasePresetToken].pts;
  const [x1, y1, x2, y2] = p;
  const s = easeParamAtX(x1, x2, lam);
  // de Casteljau at s over the control net (0,0) (x1,y1) (x2,y2) (1,1).
  const ax = s * x1, ay = s * y1;                          // lerp(P0, P1)
  const bx = x1 + (x2 - x1) * s, by = y1 + (y2 - y1) * s;  // lerp(P1, P2)
  const cx = x2 + (1 - x2) * s, cy = y2 + (1 - y2) * s;    // lerp(P2, P3)
  const dx = ax + (bx - ax) * s, dy = ay + (by - ay) * s;  // left  inner
  const ex = bx + (cx - bx) * s, ey = by + (cy - by) * s;  // right inner
  const fx = dx + (ex - dx) * s, fy = dy + (ey - dy) * s;  // the split point, ≈ (λ, E(λ))
  const left = (Math.abs(fy) < SUBDIVIDE_EPS || !(fx > 0)
    ? null
    : subdividedEaseToken(ax / fx, ay / fy, dx / fx, dy / fy)) ?? tok;
  const right = (Math.abs(1 - fy) < SUBDIVIDE_EPS || !(fx < 1)
    ? null
    : subdividedEaseToken((ex - fx) / (1 - fx), (ey - fy) / (1 - fy), (cx - fx) / (1 - fx), (cy - fy) / (1 - fy))) ?? tok;
  return { left, right };
}

// ─── the track ───────────────────────────────────────────────────────────────

/** One keyframe: a time, the ease OUT of it, and the channels it mentions. */
export interface KfKey {
  /** Local box time in ms, integer, 0…KF_MAX_TIME_MS. */
  readonly t: number;
  /** Canonical ease token governing the segment that STARTS here. */
  readonly ease: string;
  /** Only the channels this keyframe mentions - sparseness is a wire property (section 5.1). */
  readonly v: Readonly<KfPose>;
}

/** A parsed track: keyframes ascending by `t`, deduped, frozen. */
export type KfTrack = readonly KfKey[];

/**
 * A key as a caller may hand it in - looser than the parsed form, so a `KfKey`
 * (or anything a rebase builds by hand) is accepted by `serialiseKf` unchanged.
 */
export interface KfKeyInput {
  t?: number;
  ease?: string;
  v?: Readonly<KfPose> | null;
}

export interface KfParseOptions {
  /** Called once per cap hit / dropped construct. No console dependency in the engine. */
  onWarn?: (message: string) => void;
}

const EMPTY_TRACK: KfTrack = Object.freeze([]);

/** Clamp + quantise one channel value; null when it is not a usable number. */
function channelValue(ch: KfChannel, raw: number): number | null {
  if (!Number.isFinite(raw)) return null;
  const [lo, hi] = KF_CLAMPS[ch];
  return quant(clamp(raw, lo, hi), KF_QUANTA[ch]);
}

/**
 * The one normalisation both `parseKf` and `serialiseKf` run: clamp + quantise
 * every value, canonicalise the ease, cap the key count, sort by time, dedupe
 * (last write at a given `t` wins), freeze.
 *
 * Running it on BOTH sides is what makes the round-trip law
 * `parse(serialise(parse(s)))` deep-equal `parse(s)` true by construction
 * rather than by luck.
 */
function normaliseTrack(keys: readonly KfKeyInput[], onWarn?: (m: string) => void): KfTrack {
  let src = keys;
  if (src.length > KF_MAX_KEYS) {
    onWarn?.(`kf: track has ${src.length} keyframes; keeping the first ${KF_MAX_KEYS}`);
    src = src.slice(0, KF_MAX_KEYS);
  }
  const out: KfKey[] = [];
  for (const k of src) {
    if (!k || typeof k !== 'object') continue;
    const rawT = typeof k.t === 'number' && Number.isFinite(k.t) ? k.t : 0;
    const t = Math.round(clamp(rawT, 0, KF_MAX_TIME_MS));
    const v: KfPose = {};
    const kv = (k.v ?? {}) as Record<string, unknown>;
    for (const ch of KF_CHANNELS) {
      if (!Object.hasOwn(kv, ch)) continue;
      const raw = kv[ch];
      if (typeof raw !== 'number') continue;
      const val = channelValue(ch, raw);
      if (val !== null) v[ch] = val;
    }
    out.push({ t, ease: normaliseKfEase(k.ease) ?? KF_DEFAULT_EASE, v: Object.freeze(v) });
  }
  // Stable sort by time, then last-wins at equal times: a re-keyed pose replaces
  // the one it was written over instead of leaving an unreachable twin behind.
  out.sort((a, b) => a.t - b.t);
  const deduped: KfKey[] = [];
  for (const k of out) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.t === k.t) deduped[deduped.length - 1] = k;
    else deduped.push(k);
  }
  for (const k of deduped) Object.freeze(k);
  return Object.freeze(deduped);
}

/**
 * Parse a `kf` field value into a track.
 *
 * Never throws. Junk tokens are skipped; a keyframe whose first token is not
 * `t<number>` is skipped whole (the grammar puts time first, always). Caps are
 * enforced silently unless `onWarn` is supplied.
 */
export function parseKf(s: unknown, opts?: KfParseOptions): KfTrack {
  if (typeof s !== 'string' || s === '') return EMPTY_TRACK;
  const warn = opts?.onWarn;
  let src = s;
  if (src.length > KF_MAX_CHARS) {
    warn?.(`kf: value is ${src.length} chars; reading the first ${KF_MAX_CHARS}`);
    // The truncated tail is parsed leniently under the ordinary junk rules - 
    // a half-written token is simply a token that does not parse.
    src = src.slice(0, KF_MAX_CHARS);
  }
  const keys: KfKeyInput[] = [];
  for (const seg of src.split('*')) {
    if (seg === '') continue;
    if (keys.length >= KF_MAX_KEYS) {
      warn?.(`kf: more than ${KF_MAX_KEYS} keyframes; the excess is ignored`);
      break;
    }
    const toks = seg.split('_').filter((x) => x !== '');
    const head = toks[0];
    if (head === undefined) continue;
    const tm = T_RE.exec(head);
    if (!tm) {
      warn?.(`kf: keyframe "${snip(seg)}" does not start with t<ms>; skipped`);
      continue;
    }
    const tRaw = num(tm[1] ?? '');
    if (tRaw === null) continue;
    const v: KfPose = {};
    let ease: string | undefined;
    for (let i = 1; i < toks.length; i++) {
      const tok = toks[i] as string;
      if (tok.charCodeAt(0) === 101 /* e */) {
        const norm = normaliseKfEase(tok);
        // Later tokens overwrite earlier ones within a keyframe - the wire is
        // read as a sequence of assignments.
        if (norm !== null) { ease = norm; continue; }
      }
      let matched = false;
      for (const ch of CHANNELS_BY_LENGTH) {
        if (!tok.startsWith(ch)) continue;
        const n = num(tok.slice(ch.length));
        if (n === null) continue;
        v[ch] = n;
        matched = true;
        break;
      }
      if (!matched) warn?.(`kf: junk token "${snip(tok)}" skipped`);
    }
    keys.push({ t: tRaw, ease, v });
  }
  return normaliseTrack(keys, warn);
}

/** One keyframe back to the wire. */
function keyToWire(k: KfKey): string {
  const parts: string[] = [`t${fmt(k.t)}`];
  if (k.ease !== KF_DEFAULT_EASE) parts.push(k.ease);
  for (const ch of KF_CHANNELS) {
    if (!Object.hasOwn(k.v, ch)) continue;
    const val = k.v[ch];
    if (typeof val !== 'number') continue;
    parts.push(`${ch}${fmt(val)}`);
  }
  return parts.join('_');
}

/**
 * Serialise a track back to a `kf` field value.
 *
 * Output is always charset-clean and quantised, which is what lets the hooks
 * hold their strict-emission rule (section 5.1): parse, re-serialise, emit - raw user
 * text never reaches an attribute.
 */
export function serialiseKf(track: readonly KfKeyInput[] | null | undefined, opts?: KfParseOptions): string {
  if (!Array.isArray(track) || track.length === 0) return '';
  return normaliseTrack(track, opts?.onWarn).map(keyToWire).join('*');
}

// ─── evaluation ──────────────────────────────────────────────────────────────

// Per-track channel index (which keys mention which channel), derived once.
// A WeakMap keyed on the frozen track: never part of the cloned wire data, and
// collected with the track it belongs to.
const CHANNEL_INDEX = new WeakMap<object, Map<KfChannel, number[]>>();

function channelIndex(track: KfTrack): Map<KfChannel, number[]> {
  const hit = CHANNEL_INDEX.get(track as unknown as object);
  if (hit) return hit;
  const m = new Map<KfChannel, number[]>();
  for (let i = 0; i < track.length; i++) {
    const k = track[i];
    if (!k) continue;
    for (const ch of KF_CHANNELS) {
      if (!Object.hasOwn(k.v, ch)) continue;
      const list = m.get(ch);
      if (list) list.push(i);
      else m.set(ch, [i]);
    }
  }
  CHANNEL_INDEX.set(track as unknown as object, m);
  return m;
}

/** Every channel the track mentions anywhere, in canonical order. */
export function kfChannelsUsed(track: KfTrack | null | undefined): KfChannel[] {
  if (!track || track.length === 0) return [];
  const idx = channelIndex(track);
  return KF_CHANNELS.filter((ch) => (idx.get(ch)?.length ?? 0) > 0);
}

function sampleChannel(track: KfTrack, ks: readonly number[], ch: KfChannel, t: number): number {
  const first = track[ks[0] as number] as KfKey;
  if (t <= first.t) return first.v[ch] as number;
  const last = track[ks[ks.length - 1] as number] as KfKey;
  if (t >= last.t) return last.v[ch] as number;
  // Greatest i with key time <= t. Both ends are already handled, so lo lands
  // on a real segment start.
  let lo = 0, hi = ks.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((track[ks[mid] as number] as KfKey).t <= t) lo = mid; else hi = mid - 1;
  }
  const a = track[ks[lo] as number] as KfKey;
  const b = track[ks[lo + 1] as number] as KfKey;
  const av = a.v[ch] as number;
  const bv = b.v[ch] as number;
  const span = b.t - a.t;
  if (!(span > 0)) return bv;
  const u = (t - a.t) / span;
  // The segment ease governs every channel EXCEPT `o`, which is always linear - 
  // `eh` still holds it, like any channel (section 5.2).
  const ease = ch === 'o' ? (a.ease === KF_HOLD_EASE ? KF_HOLD_EASE : KF_LINEAR_EASE) : a.ease;
  return av + (bv - av) * kfEaseAt(ease, u);
}

/**
 * The pose at local time `tMs`.
 *
 * Sparse by channel: a channel interpolates between the nearest keyframes that
 * MENTION it - a diamond in between that says nothing about it is transparent - 
 * using the earlier mentioning keyframe's ease, and clamp-holds outside the
 * authored range. A channel the track never mentions is ABSENT from the result,
 * so a consumer can tell "not authored" from "authored 0".
 *
 * The per-track channel index is memoised against the track object, so a track
 * must not be mutated in place after its first evaluation - `parseKf` freezes
 * what it returns, and anything built by hand should be handed over as a fresh
 * array (which is what a rebase produces anyway).
 *
 * @param channels restrict the evaluation (e.g. `KF_CAMERA_CHANNELS`); default: all.
 */
export function evaluateKf(
  track: KfTrack | null | undefined,
  tMs: number,
  channels?: readonly KfChannel[],
): KfPose {
  const out: KfPose = {};
  if (!track || track.length === 0) return out;
  const t = Number.isFinite(tMs) ? tMs : 0;
  const idx = channelIndex(track);
  for (const ch of channels ?? KF_CHANNELS) {
    if (!isKfChannel(ch)) continue;
    const ks = idx.get(ch);
    if (!ks || ks.length === 0) continue;
    out[ch] = sampleChannel(track, ks, ch, t);
  }
  return out;
}

// ─── the camera ──────────────────────────────────────────────────────────────

/** The authored camera channels. `p` is perspective strength (FOV), never magnification (section 4.3). */
export interface KfCameraPose {
  /** Pan, px. */
  x: number;
  /** Pan, px. */
  y: number;
  /** Dolly, px in the same axis as a layer's `z`. */
  z: number;
  /** Perspective strength / focal length, px. `eff(z = camZ) === 1` for every value. */
  p: number;
  /** Focus plane, absolute z in px (0 = the surface). */
  f: number;
  /** Aperture 0–1. 0 = everything sharp. */
  a: number;
  /** Tilt, deg - parsed from day one, consumed at P2. */
  rx?: number;
  /** Tilt, deg - parsed from day one, consumed at P2. */
  ry?: number;
}

/**
 * The DEFAULT camera (section 5.4): P = 1200, pose 0.
 *
 * This is what "no camera box" resolves to - never a literal identity, because
 * an identity would swallow z. It projects z = 0 layers at eff = 1, so every
 * existing document renders byte-identically.
 */
export const DEFAULT_CAMERA: Readonly<KfCameraPose> = Object.freeze({ x: 0, y: 0, z: 0, p: 1200, f: 0, a: 0 });

/** The default perspective strength, in px. */
export const DEFAULT_PERSPECTIVE = 1200;

/** A camera pose plus the stage it looks at - the principal point is the stage centre. */
export interface KfCameraView extends KfCameraPose {
  /** Stage width, stage-native px (BEFORE export scale S). */
  w: number;
  /** Stage height, stage-native px. */
  h: number;
}

/** One camera box on the timeline. */
export interface KfCameraClip {
  /** Window start, ms on the sequence timeline. Null/undefined = untimed ("Always on"). */
  start?: number | null;
  /** Window end, ms, EXCLUSIVE. Null/undefined = never ends. */
  end?: number | null;
  /** The scene-defaults pose: the value wherever the track authors no token. */
  base?: Partial<KfCameraPose> | null;
  /** The camera's own keyframes, in LOCAL time (t − start). */
  track?: KfTrack | null;
}

/** u at which eff freezes and the alpha ramp reaches 0 (section 4.5). */
export const KF_GUARD_U = 0.9;

/** Width of the alpha ramp below the guard, in u (so the ramp runs over [0.8, 0.9]). */
export const KF_GUARD_BAND = 0.1;

/**
 * eff at the clamp: 1/(1 − 0.9). Any fly-past hits the plate budget cap - a
 * designed path.
 *
 * `projectDepth` returns EXACTLY this at and beyond the guard - the naive
 * `1/(1 − 0.9)` is 10.000000000000002 in IEEE-754, which would put the number
 * consumers actually see above the maximum this constant declares (the section 5.5
 * plate-resolution buckets and the λ budget are both computed from maxEff). See
 * the P-space form in `projectDepth`.
 */
export const KF_EFF_MAX = 10;

/** What the depth of one layer works out to under a camera. */
export interface KfDepth {
  /** (z − camZ)/P, unclamped - the diagnostic the guard is stated in. */
  u: number;
  /** P/(P − (z − camZ)), with u clamped at KF_GUARD_U. */
  eff: number;
  /** 1 outside the guard band, ramping to 0 at u = KF_GUARD_U. A layer at 0 is skipped entirely. */
  alphaGuard: number;
}

function sanePerspective(p: unknown): number {
  const [lo, hi] = KF_CLAMPS.p;
  return typeof p === 'number' && Number.isFinite(p) ? clamp(p, lo, hi) : DEFAULT_PERSPECTIVE;
}

/**
 * The behind-camera guard (section 4.5), pinned as formula because it is part of the
 * byte-stable contract:
 *
 *   u = (z − camZ)/P;  eff uses min(u, 0.9)  →  eff_max = 10
 *   alphaGuard = clamp((0.9 − u)/0.1, 0, 1)
 *
 * eff FREEZES at its clamp value while alpha ramps, so the pole is unreachable
 * and the whole thing stays continuous.
 *
 * eff is computed in P-SPACE - `P/(P − min(dz, 0.9P))` rather than
 * `1/(1 − min(u, 0.9))` - and then held to `KF_EFF_MAX`. Same value everywhere
 * it matters, but the division happens once instead of twice, so the clamp
 * lands on exactly 10 instead of 10.000000000000002: `KF_EFF_MAX` is a declared
 * maximum that downstream code buckets and budgets against, and a maximum the
 * function can exceed is not one.
 */
export function projectDepth(cam: Pick<KfCameraPose, 'z' | 'p'>, z: number): KfDepth {
  const P = sanePerspective(cam.p);
  const camZ = typeof cam.z === 'number' && Number.isFinite(cam.z) ? cam.z : 0;
  const zz = Number.isFinite(z) ? z : 0;
  const dz = zz - camZ;
  const u = dz / P;
  const eff = Math.min(P / (P - Math.min(dz, KF_GUARD_U * P)), KF_EFF_MAX);
  const alphaGuard = clamp((KF_GUARD_U - u) / KF_GUARD_BAND, 0, 1);
  return { u, eff, alphaGuard };
}

/**
 * {@link projectDepth} run backwards: the depth that magnifies a layer by `eff`.
 *
 * `eff = P/(P − (z − camZ))` solves to `z = camZ + P·(1 − 1/eff)`, exactly. It
 * exists because DEPTH is the wire and MAGNIFICATION is the taste: "a layer
 * 2 % bigger than the page" is a judgement anyone can make, while "z = 23.5" is
 * one nobody can, and the two are only the same sentence at one perspective.
 * Callers that pick a look (the lift ladder's eff band, plans/104 section 5.3's
 * "tasteful 1.05–1.2") state it in eff and come here for the number to store.
 *
 * `eff ≤ 1` is not an error - it is the far side of the surface, and returns a
 * negative (sunken) z, which the field's own clamp then has an opinion about.
 * The perspective is clamped like everywhere else, and eff is held under
 * {@link KF_EFF_MAX} so the inverse can never be asked for the pole.
 */
export function depthForEff(eff: number, cam: Pick<KfCameraPose, 'z' | 'p'> = DEFAULT_CAMERA): number {
  const P = sanePerspective(cam.p);
  const camZ = typeof cam.z === 'number' && Number.isFinite(cam.z) ? cam.z : 0;
  if (!Number.isFinite(eff) || eff <= 0) return camZ;
  return camZ + P * (1 - 1 / Math.min(eff, KF_EFF_MAX));
}

/** The layer's surface-space inputs to the fold (stage-native px, BEFORE export scale S). */
export interface KfLayerPose {
  /** Authored centre x. */
  bx: number;
  /** Authored centre y. */
  by: number;
  /** Transition offset x. */
  dxT?: number;
  /** Transition offset y. */
  dyT?: number;
  /** Keyframe `x` offset. */
  dxK?: number;
  /** Keyframe `y` offset. */
  dyK?: number;
  /** Resolved depth: the box's `z` field unless a kf `z` token overrides it (section 5.2). */
  z?: number;
  /**
   * The layer's EXTENT in surface px at this instant - its drawn width/height times
   * whatever scale the transition and the track put on it, BEFORE the projection.
   *
   * Read only by the TILTED branch (P2), where the guard stops being a property of the
   * layer's plane and becomes a property of its nearest CORNER: a pitched camera puts
   * one edge of a screen-parallel layer closer than the other, and it is that edge
   * which reaches the near plane first. Absent (and on every untilted camera) the
   * layer is treated as a point and the guard is exactly the section 4.5 plane formula it has
   * always been.
   *
   * The AUTHORED rotation is deliberately not folded in - neither evaluator parses it
   * out of the element's own transform, and the guard is a soft ramp over 0.1·P rather
   * than a clip, so a rotated box's near corner is estimated from its unrotated extent
   * and the error is bounded by √2 of a ramp width.
   */
  w?: number;
  h?: number;
  /**
   * The BOX's OWN tilt, degrees, resolved base-field-then-keyed exactly as `z` is
   * (P2.1): the box's `rx`/`ry` field unless an `rx`/`ry` token in the track replaces
   * it for that segment. Absent or zero is the byte-identity floor.
   *
   * **A box tilt is authored in the BOX'S OWN FRAME**, pivoting on the box centre at the
   * scene perspective. It is exactly what CSS's `perspective(P) rotateY(ry) rotateX(rx)`
   * does to a card, angle for angle and sign for sign, because that string IS the other
   * consumer: a design tool bakes it into the box's own inline transform so an UNTIMED
   * board poses without an engine anywhere in the picture. The two have to be the same
   * matrix or adding a timeline would flip every tilted box.
   *
   * So a box `rx` and a CAMERA `rx` move the picture in OPPOSITE directions, and that is
   * not an oversight: rotating an object one way is rotating the rig the other. The
   * camera's matrix is `Rᵀ` (world → camera, {@link camRotationT}); a box's is `R`.
   *
   * Composed with a TILTED camera it is a homography PRODUCT, not a plate rotated in
   * world space: the camera sees an already-flattened trapezoid. Under a tilted rig a
   * box therefore keeps the foreshortening that was authored instead of responding to
   * it. That is the model, stated so nobody has to rediscover it.
   *
   * The tilt is SCREEN-AXIS: the matrix sits to the LEFT of the authored
   * `rotate()`/`scale(±1)` in a DOM consumer's list, so `rx` always pitches about the
   * horizontal screen axis whatever the box's own rotation is.
   */
  rx?: number;
  ry?: number;
}

/** What the caller folds into its own item. `scale` is eff and multiplies the transition/kf scale. */
export interface KfProjection {
  /** cx' − bx: the projected offset for the x axis, replacing the raw transition + kf offsets. */
  dx: number;
  /** cy' − by. */
  dy: number;
  /** eff - multiply the transition and keyframe scales by this (section 4.1: scale = scT · sK · eff). */
  scale: number;
  /** Multiply the item's alpha by this; skip the layer entirely at 0. */
  alphaGuard: number;
  /**
   * P2 - the ELEMENT-LOCAL homography a tilted camera OR a tilted box needs, or null
   * on the screen-parallel path (nothing tilted, i.e. everything P0/P1 ships).
   *
   * Null is the byte-identity floor: a consumer that sees null writes exactly the
   * `translate(dx,dy) … scale(scale)` it always wrote. When it is present, it REPLACES
   * the leading translate and nothing else - `scale` still carries eff and `rot` is
   * still applied after it, because the matrix has the centre magnification divided
   * back out (see {@link projectLayerMatrix}).
   */
  m: KfMatrix3 | null;
}

// ─── tilt: the homography tier (P2, plan section 4 / section 6.4) ──────────────────────────

/**
 * A 2D homography, ROW-MAJOR: `[a,b,c, d,e,f, g,h,i]` maps `[x,y,1]ᵀ` to
 * `[X,Y,W]ᵀ`, and the point is `(X/W, Y/W)`.
 *
 * Row-major because that is how the two derivations in this file are written on
 * paper; `kfMatrix3dCss` is the one place the column-major CSS spelling appears, so
 * the transposition happens once instead of at every call site.
 */
export type KfMatrix3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

// NO `KF_MATRIX3_IDENTITY` HERE, deliberately. 1.121 exported one from the barrel and
// nothing in `engine/`, `shells/`, `tests/` or `packages/` ever read it - and the engine's
// own rule is that a minor's additions are permanent ("added in minor versions, never
// removed"), so an unused export is a forever commitment made by accident. The untilted
// tier returns `m: null` rather than an identity matrix (that IS the byte-identity gate),
// so there is no caller to give it. Add it back the day something needs one.

/**
 * Is this camera TILTED - i.e. does it need the homography tier at all?
 *
 * An EXACT zero test on both angles, with no epsilon, and that is deliberate: this
 * predicate is the byte-identity gate. Everything written before P2 authors no `rx`
 * and no `ry`, so it answers false and every one of those documents takes the exact
 * screen-parallel path it took before this function existed. An epsilon here would
 * mean a track that keyframes rx from 0 to 40 spends its first frames on the affine
 * path and then switches - a discontinuity in the picture at whatever threshold was
 * chosen. Zero or not zero; the maths is continuous across it (at rx = ry = 0 the
 * homography reduces algebraically to the affine fold, which is a golden).
 */
export function cameraTilted(cam: { rx?: number | null; ry?: number | null } | null | undefined): boolean {
  if (!cam) return false;
  const rx = cam.rx;
  const ry = cam.ry;
  return (typeof rx === 'number' && Number.isFinite(rx) && rx !== 0)
    || (typeof ry === 'number' && Number.isFinite(ry) && ry !== 0);
}

const DEG = Math.PI / 180;

/**
 * `Rᵀ`, the world → camera rotation, ROW-MAJOR, for `R = Ry(ry)·Rx(rx)`.
 *
 * The two elementary matrices are CSS's own `rotateX`/`rotateY` in CSS's own axes
 * (x right, y DOWN, z toward the viewer), so a reader can check the sign of a tilt
 * against a transform they can type into a stylesheet. Composed pitch-then-yaw - the
 * pan/tilt head - so a camera with both angles never acquires roll, which is a third
 * channel the wire does not have.
 */
function camRotationT(rxDeg: number, ryDeg: number): KfMatrix3 {
  const t = rxDeg * DEG;
  const f = ryDeg * DEG;
  const ct = Math.cos(t), st = Math.sin(t);
  const cf = Math.cos(f), sf = Math.sin(f);
  return [
    cf, 0, -sf,
    sf * st, ct, cf * st,
    sf * ct, -st, cf * ct,
  ];
}

/** `a · b`, both row-major 3×3. */
function mul3(a: KfMatrix3, b: KfMatrix3): KfMatrix3 {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out[r * 3 + c] = (a[r * 3] as number) * (b[c] as number)
        + (a[r * 3 + 1] as number) * (b[3 + c] as number)
        + (a[r * 3 + 2] as number) * (b[6 + c] as number);
    }
  }
  return out as unknown as KfMatrix3;
}

/**
 * The BOX-LOCAL tilt homography (P2.1) - CSS's own
 * `perspective(P) rotateY(ry) rotateX(rx)` about the element's centre, written as one
 * 3x3 over element-local `[u, v, 1]`.
 *
 * The rotation is `R = Ry(ry)·Rx(rx)`, the OBJECT rotation - which is the TRANSPOSE of
 * what {@link camRotationT} returns, since that function is `Rᵀ`, the world → camera
 * rotation. Reading its rows back as columns is the whole difference between the two
 * readings, and it is the reason a box `rx` and a camera `rx` tip the picture opposite
 * ways. Getting it wrong is not subtle and it is not detectable from a still: a board
 * posed with no timeline renders through the CSS string alone, and the first frame of
 * a timeline would flip it.
 *
 * The rotated point's z then divides through the box's own perspective, giving
 * `W = 1 − (R20·u + R21·v)/P`. The centre maps to itself, so `dx`/`dy` - and every
 * consumer that reads a position rather than a shape - are untouched by a tilt.
 *
 * Null on the EXACT zero test, {@link cameraTilted}'s own: it is structurally typed and
 * nothing about it is camera-specific, and reusing it is what keeps the byte-identity
 * floor one predicate instead of two that can drift apart.
 *
 * Private on purpose. It is fully exercised through {@link projectLayer} under an
 * untilted camera, and the rule stated above `KF_MATRIX3_IDENTITY`'s absence applies
 * here too - an export is a forever commitment, so it waits for a caller.
 */
function boxTiltMatrix(rx: number, ry: number, p: unknown): KfMatrix3 | null {
  if (!cameraTilted({ rx, ry })) return null;
  const P = sanePerspective(p);
  // `t` is Rᵀ, row-major; `R = (Rᵀ)ᵀ`, so R's row r is t's column r.
  const t = camRotationT(rx, ry);
  const r00 = t[0], r01 = t[3];
  const r10 = t[1], r11 = t[4];
  const r20 = t[2], r21 = t[5];
  return [r00, r01, 0, r10, r11, 0, -r20 / P, -r21 / P, 1];
}

/**
 * A tilted camera's SURFACE → SCREEN homography for one layer plane, plus the two
 * scalars the guard and the depth-of-field need. Null when the camera is not tilted - 
 * callers take the affine path.
 *
 * ## The model, and why the camera ORBITS rather than swivels
 *
 * The untilted camera sits at `C = (camX + W/2, camY + H/2, camZ + P)` looking along
 * −z, which is what makes `eff = P/(P − (z − camZ))` (section 4.1). Tilting it has to pick a
 * PIVOT, and the two candidates are not close:
 *
 * - swivel in place (rotate about `C`): pointing the camera up sends the artwork out
 *   of the bottom of the frame, exactly as a real camera does. Physically honest and
 *   useless as a control - the first degree of tilt loses the subject.
 * - ORBIT the aim point (rotate about `Q = (camX + W/2, camY + H/2, camZ)`, the point
 *   the camera was already looking at, keeping the distance `P`): the aim point stays
 *   dead centre and the plane pitches around it. This is what every "camera angle"
 *   control in every reference tool actually does, and it is what makes `rx` a dial a
 *   designer can turn.
 *
 * We orbit. `C = Q + R·(0,0,P)`, so at `rx = ry = 0` the camera is where it always
 * was and every formula below reduces to the affine one algebraically.
 *
 * ## Signs
 *
 * `rx` and `ry` are CAMERA rotations in degrees, in CSS's axis convention, and the
 * honest way to state their sign is by the PICTURE rather than by where the rig ends
 * up - the artwork is a plane with no gravity, so "the camera is below looking up" and
 * "the camera is above looking down at a floor" are the same photograph, and only one
 * of those sentences is useful.
 *
 * **`rx < 0`: the near edge of a layer moves to the BOTTOM of the frame and the far
 * edge recedes toward a horizon at the top.** That is the POV / "surface glide" shot,
 * and it is why the preset asks for −40 rather than +40 (+40 is the same picture the
 * other way up: a ceiling). **`ry > 0` brings the RIGHT-hand edge nearer.** Both are
 * pinned by hand-computed goldens in `tests/keyframes-tilt.test.ts`.
 *
 * One consequence to know before using a dolly under tilt: `camZ` moves the aim
 * point along the WORLD z axis, not along the camera's own view axis. On a
 * pitched camera this displaces the picture vertically as well as magnifying it.
 * That is consistent (the rig is looking at a plane further back), but it is not
 * what "push in" means to a user, which is why the shipped Surface glide preset
 * does not dolly.
 *
 * ## The algebra
 *
 * With `v = p − Q` for a surface point `p` at depth `z` (so `v = (x − cx0, y − cy0,
 * z − camZ)`) and `g = Rᵀ v`, the camera-space point is `(g₀, g₁, g₂ − P)`, the
 * distance along the view axis is `D = P − g₂`, and the screen point is
 * `(W/2 + P·g₀/D, H/2 + P·g₁/D)`. Written as a homography over `[x, y, 1]` that is
 * the matrix below, and at `R = I` it is `W/2 + (x − camX − W/2)·P/d` - the section 4.1 fold,
 * exactly.
 */
function surfaceMatrix(cam: KfCameraView, z: number): {
  m: KfMatrix3;
  /** Row 2 of `Rᵀ`, the only row the per-corner depth needs. */
  m2: readonly [number, number, number];
  /** `cx0`, `cy0` - the aim point in surface coords. */
  cx0: number;
  cy0: number;
  /** `z − camZ`. */
  zeta: number;
  /** `cos(rx)·cos(ry)`: the view axis's z-component, and the DOF's on-axis factor. */
  kappa: number;
  P: number;
} | null {
  if (!cameraTilted(cam)) return null;
  const P = sanePerspective(cam.p);
  const camZ = Number.isFinite(cam.z) ? cam.z : 0;
  const zz = Number.isFinite(z) ? z : 0;
  const W = Number.isFinite(cam.w) ? cam.w : 0;
  const H = Number.isFinite(cam.h) ? cam.h : 0;
  const cx0 = (Number.isFinite(cam.x) ? cam.x : 0) + W / 2;
  const cy0 = (Number.isFinite(cam.y) ? cam.y : 0) + H / 2;
  const zeta = zz - camZ;
  const rx = typeof cam.rx === 'number' && Number.isFinite(cam.rx) ? cam.rx : 0;
  const ry = typeof cam.ry === 'number' && Number.isFinite(cam.ry) ? cam.ry : 0;
  const M = camRotationT(rx, ry);
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = M;
  // D = P − g₂ = P − (m20·(x−cx0) + m21·(y−cy0) + m22·ζ)
  const h6 = -m20;
  const h7 = -m21;
  const h8 = P + m20 * cx0 + m21 * cy0 - m22 * zeta;
  // X = P·g₀ + (W/2)·D, Y = P·g₁ + (H/2)·D - the principal point is the stage centre.
  const gx0 = -(m00 * cx0) - m01 * cy0 + m02 * zeta;
  const gy0 = -(m10 * cx0) - m11 * cy0 + m12 * zeta;
  const m: KfMatrix3 = [
    P * m00 + (W / 2) * h6, P * m01 + (W / 2) * h7, P * gx0 + (W / 2) * h8,
    P * m10 + (H / 2) * h6, P * m11 + (H / 2) * h7, P * gy0 + (H / 2) * h8,
    h6, h7, h8,
  ];
  return { m, m2: [m20, m21, m22], cx0, cy0, zeta, kappa: m22, P };
}

/**
 * The element-local homography for a tilted layer - what a DOM consumer writes as
 * `matrix3d(...)` in place of the affine `translate(dx, dy)`.
 *
 * `hs` maps SURFACE points to SCREEN points; a CSS transform maps points in the
 * element's own space, relative to its transform-origin, and is applied AFTER the
 * rest of the transform list has already rotated and scaled the content. So the
 * matrix a browser wants is
 *
 *     M = T(−O) · hs · T(cp) · S(1/effc)
 *
 * where `O` is the element's origin (its authored centre), `cp` the posed centre in
 * surface space, and `effc` the centre magnification - which is divided back out
 * precisely so that `scale` on `KfProjection` keeps meaning what it has always meant
 * (`scT · sK · eff`) and every consumer that is not writing the matrix reads the same
 * numbers it read before P2. At `rx = ry = 0` this product collapses to
 * `translate(dx, dy)`; that identity is a golden.
 */
function localMatrix(hs: KfMatrix3, ox: number, oy: number, cpx: number, cpy: number, effc: number): KfMatrix3 {
  const e = effc > 0 && Number.isFinite(effc) ? effc : 1;
  const inv = 1 / e;
  // B = T(cp) · S(1/effc)
  const B: KfMatrix3 = [inv, 0, cpx, 0, inv, cpy, 0, 0, 1];
  // A = T(−O), applied in PROJECTIVE space (X − Ox·W, Y − Oy·W, W) - a translation
  // after the divide, which is what "the element paints at its own origin" means.
  const A: KfMatrix3 = [1, 0, -ox, 0, 1, -oy, 0, 0, 1];
  return mul3(A, mul3(hs, B));
}

/** Round hard to a stable spelling; the wire is a style string a diff has to be able to read. */
function fmt9(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const n = Math.round(v * 1e9) / 1e9;
  return String(Object.is(n, -0) ? 0 : n);
}

/**
 * A 2D homography as a CSS `matrix3d(...)`, normalised so its bottom-right entry is 1.
 *
 * The 3D form is the only CSS transform that performs a perspective divide, which is
 * the only way to put a homography on an element - a 2D `matrix()` is affine by
 * definition. The z row is the identity's (`0,0,1,0`) and the z output is 0, so the
 * element stays FLAT: this must never be paired with a `perspective` or
 * `transform-style: preserve-3d` ancestor. That is the Cover Flow rule, and it is not
 * an aesthetic one - `parseCssMatrix` (engine/src/css-box.ts) refuses a real 3D
 * context, so a walker-captured still of a preserve-3d scene comes out mis-scaled or
 * blank. Per-element and flattened, every layer's geometry is recoverable.
 *
 * Normalising by `i` is free (a homography is scale-invariant) and is what keeps the
 * printed numbers in a readable range: unnormalised, the w row is ~1e-4 while the
 * translation row is ~1e3, and any fixed rounding destroys one of them.
 */
export function kfMatrix3dCss(m: KfMatrix3): string {
  const i = m[8];
  const k = Number.isFinite(i) && i !== 0 ? 1 / i : 1;
  const n = m.map((v) => v * k);
  // Column-major: each group of four is the image of one basis vector, w last.
  return `matrix3d(${[
    n[0], n[3], 0, n[6],
    n[1], n[4], 0, n[7],
    0, 0, 1, 0,
    n[2], n[5], 0, n[8],
  ].map((v) => fmt9(v as number)).join(', ')})`;
}

/**
 * Map one surface point through a tilted camera - the chrome's route (handles, motion
 * paths, hit-testing) and the reference implementation the goldens check the matrix
 * against. Null when the camera is not tilted, or when the point is at/behind the
 * near plane (there is no honest screen position for it).
 */
export function projectSurfacePoint(
  cam: KfCameraView, x: number, y: number, z = 0,
): { x: number; y: number; d: number } | null {
  const s = surfaceMatrix(cam, z);
  if (!s) return null;
  const [a, b, c, d, e, f, g, h, i] = s.m;
  const w = g * x + h * y + i;
  if (!(w > 0)) return null;
  return { x: (a * x + b * y + c) / w, y: (d * x + e * y + f) / w, d: w };
}

/**
 * The section 4.1 fold, exactly:
 *
 *   cx  = bx + dxT + dxK
 *   eff = P/(P − (z − camZ))
 *   cx' = W/2 + (cx − camX − W/2)·eff
 *   dx  = cx' − bx        scale = eff        (per axis for y/H)
 *
 * The transition and keyframe offsets are INSIDE the projection, so they scale
 * by eff - a slide enter on a lifted layer tracks the parallax instead of
 * landing short. The naive reading (adding the camera displacement to an
 * unscaled offset) is the defect the parity suite's transition × camera case
 * exists to catch.
 *
 * Rotation is untouched: eff is a scalar, so a uniform scale commutes with the
 * authored rotate.
 */
export function projectLayer(cam: KfCameraView, layer: KfLayerPose): KfProjection {
  const bx = Number.isFinite(layer.bx) ? layer.bx : 0;
  const by = Number.isFinite(layer.by) ? layer.by : 0;
  const cx = bx + (layer.dxT ?? 0) + (layer.dxK ?? 0);
  const cy = by + (layer.dyT ?? 0) + (layer.dyK ?? 0);
  // P2.1. The box's own tilt, on the same exact-zero terms: null here means every line
  // below is the expression that shipped, and `m` stays null unless something tilts.
  // Pivoted at the DEFAULT perspective, never the camera's `p`: a box tilt is authored
  // in the box's own frame, and the hook's static bake is a fixed 1200 - pivoting at a
  // live camera channel would re-angle every still the moment the FOV slider moved,
  // and the untimed board (which renders with no engine at all) could never follow.
  const B = boxTiltMatrix(layer.rx ?? 0, layer.ry ?? 0, DEFAULT_PERSPECTIVE);
  // P2. The branch is `cameraTilted`, an exact zero test, so a camera that authors no
  // angle never reaches a line of the homography tier and the screen-parallel path
  // below is the one that shipped - same expressions, same order, same bits.
  if (cameraTilted(cam)) {
    const t = projectLayerTilted(cam, layer, cx, cy, bx, by);
    // The camera's matrix already carries the projected translation, so the box's own
    // plane composes on its RIGHT - the camera photographs a card that has already been
    // pitched in its own frame. A layer the guard has faded out has no matrix and gets
    // none: a box tilt does not resurrect something that is past the near plane.
    if (t) return B && t.m ? { ...t, m: mul3(t.m, B) } : t;
  }
  const { eff, alphaGuard } = projectDepth(cam, layer.z ?? 0);
  const w = Number.isFinite(cam.w) ? cam.w : 0;
  const h = Number.isFinite(cam.h) ? cam.h : 0;
  const camX = Number.isFinite(cam.x) ? cam.x : 0;
  const camY = Number.isFinite(cam.y) ? cam.y : 0;
  const px = w / 2 + (cx - camX - w / 2) * eff;
  const py = h / 2 + (cy - camY - h / 2) * eff;
  const dx = px - bx;
  const dy = py - by;
  // With no camera matrix to compose onto, the leading `translate(dx, dy)` a consumer
  // would otherwise emit becomes the left factor - so the "m3 REPLACES the leading
  // translate and nothing else" contract stays true for a box tilt under an untilted
  // camera, with no third branch anywhere downstream.
  return { dx, dy, scale: eff, alphaGuard, m: B ? mul3([1, 0, dx, 0, 1, dy, 0, 0, 1], B) : null };
}

/**
 * The tilted half of {@link projectLayer} (P2). Null when the camera turns out not to
 * be tilted after all, so the caller falls through to the affine path.
 *
 * Three numbers come out of it, and each one is the generalisation of an affine one:
 *
 * - **`scale`** - the magnification at the layer's posed CENTRE, `P/D` with `D` the
 *   distance along the view axis, clamped exactly as `projectDepth` clamps eff. At
 *   `rx = ry = 0`, `D = d` and this IS eff.
 * - **`alphaGuard`** - the section 4.5 ramp, moved from the layer's PLANE to its nearest
 *   CORNER. A pitched camera puts one edge of a screen-parallel layer nearer than the
 *   other, and it is that edge which reaches the near plane first; ramping on the
 *   plane would let a corner cross `w = 0` while the layer was still fully opaque,
 *   which is not a soft failure - a homography with a sign change in its denominator
 *   paints garbage. Ramping on the nearest corner means the layer is already invisible
 *   before any part of it can get there, so the matrix handed out is always one whose
 *   denominator is positive over the whole box. Written as
 *   `clamp(Dmin/(band·P) − 1, 0, 1)`, which is the same expression as
 *   `clamp((0.9 − u)/0.1, 0, 1)` with `u = 1 − D/P` - identical in ℝ, and the untilted
 *   path still evaluates the original spelling so it stays identical in IEEE-754 too.
 * - **`m`** - the element-local homography (see {@link localMatrix}).
 */
function projectLayerTilted(
  cam: KfCameraView, layer: KfLayerPose, cx: number, cy: number, bx: number, by: number,
): KfProjection | null {
  const s = surfaceMatrix(cam, layer.z ?? 0);
  if (!s) return null;
  const [m20, m21, m22] = s.m2;
  const zTerm = m22 * s.zeta;
  /** Distance along the view axis for a surface point - `D = P − g₂`. */
  const depthAt = (px: number, py: number): number =>
    s.P - (m20 * (px - s.cx0) + m21 * (py - s.cy0) + zTerm);
  const dC = depthAt(cx, cy);
  // The same clamp `projectDepth` applies, expressed on the distance: eff freezes at
  // KF_EFF_MAX while alpha ramps, so the pole is unreachable from either branch.
  const eff = Math.min(s.P / Math.max(dC, (1 - KF_GUARD_U) * s.P), KF_EFF_MAX);
  const hw = Math.max(0, Number.isFinite(layer.w) ? (layer.w as number) : 0) / 2;
  const hh = Math.max(0, Number.isFinite(layer.h) ? (layer.h as number) : 0) / 2;
  let dMin = dC;
  if (hw > 0 || hh > 0) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        const d = depthAt(cx + sx * hw, cy + sy * hh);
        if (d < dMin) dMin = d;
      }
    }
  }
  const alphaGuard = clamp(dMin / (KF_GUARD_BAND * s.P) - 1, 0, 1);
  // The projected CENTRE, off the matrix already in hand rather than through
  // `projectSurfacePoint` - this runs per layer per frame in the DOM applier, and that
  // call would rebuild the whole surface matrix a second time to answer one point.
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = s.m;
  const wC = h6 * cx + h7 * cy + h8;
  const ok = wC > 0;
  return {
    dx: ok ? (h0 * cx + h1 * cy + h2) / wC - bx : 0,
    dy: ok ? (h3 * cx + h4 * cy + h5) / wC - by : 0,
    scale: eff,
    alphaGuard,
    // A layer the guard has already faded out gets no matrix: its denominator may have
    // changed sign somewhere across the box, and there is nothing to look at anyway.
    m: alphaGuard > 0 ? localMatrix(s.m, bx, by, cx, cy, eff) : null,
  };
}

/**
 * The aperture-to-pixels constant: max blur in px at a = 1 for a layer one
 * focal length out of focus at eff = 1. K = 40px at P = 1200 (section 4.4), pinned in
 * the golden tables so both evaluators share it.
 */
export const DOF_K = 40;

/**
 * Depth-of-field blur for a layer at depth `z` (section 4.4, corrected):
 *
 *   blur = a · K · |z − f| · eff(z) · eff(f) / P
 *
 * The `eff(z)·eff(f)` factor is the correction: without it, dollying toward an
 * out-of-focus layer SHARPENED it - the defocus circle is magnified by the same
 * projection as everything else, at both the layer and the focal plane.
 * Returned in stage-native px (×S at export), capped at KF_MAX_BLUR.
 */
export function dofBlur(cam: Pick<KfCameraPose, 'z' | 'p' | 'f' | 'a' | 'rx' | 'ry'>, z: number): number {
  const a = clamp(typeof cam.a === 'number' && Number.isFinite(cam.a) ? cam.a : 0, 0, 1);
  if (!(a > 0)) return 0;
  const P = sanePerspective(cam.p);
  const f = typeof cam.f === 'number' && Number.isFinite(cam.f) ? cam.f : 0;
  const zz = Number.isFinite(z) ? z : 0;
  // P2 - DISTANCE ALONG THE VIEW AXIS, which is what defocus has always been a
  // function of. The affine tier can use `z` as a proxy because the two agree there:
  // an untilted camera's view axis IS the z axis, so `d = P − (z − camZ)`. Orbit the
  // camera (see `surfaceMatrix`) and they part company - down the centre of frame the
  // depth becomes `D = P − κ·(z − camZ)` with `κ = cos(rx)·cos(ry)`, because the camera
  // has swung to a shallower height above the surface. Both the layer's and the focal
  // plane's depths move, so the two eff factors are re-read at the tilted distance and
  // the separation picks up its own κ:
  //
  //     |D_f − D_z| = κ·|z − f|   ⇒   blur = a·K·|z−f|·effᴰ(z)·effᴰ(f)·κ / P
  //
  // At κ = 1 every term is the affine one it replaces and this is the expression that
  // shipped, evaluated in the same order - which is why the branch is on `cameraTilted`
  // rather than on a κ that merely happens to be 1.
  //
  // ⚑ UNDER TILT THIS IS THE ON-AXIS NUMBER, deliberately, and the limit is worth
  // knowing before reading `D` as "the layer's depth". The signature is `(cam, z)`: a
  // depth and no position, so `D = P − κ(z − camZ)` is the view-axis depth of the AIM
  // COLUMN, not of wherever the layer sits in frame. A pitched camera makes those
  // differ - at `rx = −40`, `f = 600`, `a = 1`, P = 1200, a layer centred at the frame
  // centre is at D = 1200 and gets 24.83 px, while the same layer down in the near
  // field (centre y 918) is really at D = 957 and wants 46.35 px, and up in the far
  // field (centre y 162) at D = 1443 wants 15.55 px. So an off-centre layer's defocus
  // is out by up to ~1.9× on the near side and ~0.6× on the far side; every layer gets
  // the on-axis figure. Surface glide is exactly this configuration (`a 0.8`, `f 160`,
  // cropped rows scattered across frame), so the near/far split the shot is named for
  // is the term that is missing.
  //
  // It is an approximation rather than a defect because the correction has a price
  // this module is not the right place to pay: a per-layer depth means passing the
  // layer's posed centre (or its whole `KfProjection`) into every DOF read, and
  // `foldKfPose` then must NOT divide the result by `proj.scale` - the two eff factors
  // would already be at the layer's own column. That is a signature change on a
  // published minor plus a matching change in both evaluators, so it belongs in a
  // measured pass with goldens of its own, not in a corrective. Recorded here rather
  // than in a plan file so the next reader of this branch sees it.
  if (cameraTilted(cam)) {
    const kappa = Math.cos((cam.rx ?? 0) * DEG) * Math.cos((cam.ry ?? 0) * DEG);
    const camZ = typeof cam.z === 'number' && Number.isFinite(cam.z) ? cam.z : 0;
    const near = (1 - KF_GUARD_U) * P;
    const effAt = (v: number): number => Math.min(P / Math.max(P - kappa * (v - camZ), near), KF_EFF_MAX);
    return clamp((a * DOF_K * Math.abs(zz - f) * effAt(zz) * effAt(f) * Math.abs(kappa)) / P, 0, KF_MAX_BLUR);
  }
  const blur = (a * DOF_K * Math.abs(zz - f) * projectDepth(cam, zz).eff * projectDepth(cam, f).eff) / P;
  return clamp(blur, 0, KF_MAX_BLUR);
}

/**
 * The camera governing time `tMs` (section 5.4): the LATEST-IN-ARRAY clip whose window
 * covers t, folded to a pose. Windows are half-open `[start, end)` so adjacent
 * clips cut cleanly; an untimed clip ("Always on") covers everything.
 *
 * With no camera at all - or none covering t - the result is the DEFAULT camera
 * (P = 1200, pose 0), which projects z = 0 at eff = 1. Never a literal identity:
 * an identity would swallow z, and the whole point is that lifted layers read as
 * lifted the moment the first z slider moves.
 *
 * Channels are ABSOLUTE on a camera: a keyed channel replaces the base pose for
 * that segment, and the base is the value wherever the track authors no token - 
 * the section 5.2 `z`-replaces-the-field rule, generalised (there is no sensible
 * additive reading of a focal length).
 */
export function resolveCamera(cameras: readonly KfCameraClip[] | null | undefined, tMs: number): KfCameraPose {
  const t = Number.isFinite(tMs) ? tMs : 0;
  let pick: KfCameraClip | null = null;
  if (Array.isArray(cameras)) {
    for (const c of cameras) {
      if (!c || typeof c !== 'object') continue;
      const start = typeof c.start === 'number' && Number.isFinite(c.start) ? c.start : null;
      const end = typeof c.end === 'number' && Number.isFinite(c.end) ? c.end : null;
      if (start !== null && t < start) continue;
      if (end !== null && t >= end) continue;
      pick = c; // latest-in-array wins - cuts, not blends (section 5.4)
    }
  }
  const pose: KfCameraPose = { ...DEFAULT_CAMERA };
  if (!pick) return pose;
  const base = pick.base;
  if (base && typeof base === 'object') {
    for (const ch of KF_CAMERA_CHANNELS) {
      if (!Object.hasOwn(base, ch)) continue;
      const raw = (base as Record<string, unknown>)[ch];
      if (typeof raw !== 'number') continue;
      const val = channelValue(ch, raw);
      if (val !== null) pose[ch] = val;
    }
  }
  const track = pick.track;
  if (track && track.length > 0) {
    const start = typeof pick.start === 'number' && Number.isFinite(pick.start) ? pick.start : 0;
    const local = t - start;
    const keyed = evaluateKf(track, local, KF_CAMERA_CHANNELS);
    for (const ch of KF_CAMERA_CHANNELS) {
      const val = keyed[ch];
      if (typeof val === 'number') pose[ch] = val;
    }
  }
  // EVERY channel is re-held to its declared range on the way out, not just `p`.
  // The `ev`/`ea` presets overshoot by design, so a segment between two in-range
  // keys leaves the range mid-flight - `t0_ea_a1*t1000_a0` peaks at a = 1.072,
  // and `KfCameraPose.a` is documented "Aperture 0–1". The resolved pose is this
  // module's public contract (the section 8 camera panel and any plate-padding budget
  // read it directly), so the guarantee has to hold here rather than only inside
  // `dofBlur`'s own re-clamp. Clamped, NOT quantised: the quanta are a wire
  // property (section 4.6) and rounding a per-frame camera position to 0.01px would
  // stair-step a slow pan for nothing.
  for (const ch of KF_CAMERA_CHANNELS) {
    const val = pose[ch];
    if (typeof val !== 'number' || !Number.isFinite(val)) continue;
    const [lo, hi] = KF_CLAMPS[ch];
    pose[ch] = clamp(val, lo, hi);
  }
  pose.p = sanePerspective(pose.p);
  return pose;
}
