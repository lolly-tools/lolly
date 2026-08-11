// SPDX-License-Identifier: MPL-2.0
/**
 * Keyframe tracks, the `kf` wire grammar, and the depth-camera projection —
 * the shared, DOM-free maths every consumer of plans/104 trusts.
 *
 * Three separable pieces live here, and nothing else may:
 *
 * 1. **The `kf` wire** (plan §5.1, LOCKED 2026-08-11). One per-box text field
 *    holds a whole animation track: keyframes separated by `*`, tokens inside a
 *    keyframe by `_`, first token `t<ms>` (local box time). The charset is
 *    `A–Z a–z 0–9 - . _ * ( )` — every member is encodeURIComponent-unescaped
 *    and safe inside double quotes in bash/zsh, because "the CLI is URL mode
 *    under a different transport" is law. `!` is deliberately NOT in it (shell
 *    history expansion), which is why a custom bezier is paren-delimited
 *    (`eb(0.32)(0)(0.67)(1)`) and why the canonical CSS `cubic-bezier(a,b,c,d)`
 *    spelling — commas — can only reach the track through the ease adapter.
 *    The vocabulary is append-only: new channels and ease tokens may be ADDED,
 *    existing token meanings never change.
 *
 * 2. **Evaluation** (plan §5.2). Per-channel sparse interpolation: each channel
 *    interpolates between the nearest keyframes that MENTION it, using the
 *    earlier mentioning keyframe's ease, clamp-held outside the authored range.
 *    The segment ease governs every channel EXCEPT `o`, which always
 *    interpolates linearly (a fade that tracks a slow curve turns to mud once
 *    the frame has been through video compression) — `eh` still holds it, like
 *    any channel.
 *
 * 3. **The projection** (plan §4). A perspective projection of a
 *    screen-parallel plane is a uniform scale + translate — pure affine — so
 *    the camera never needs CSS `perspective`/`preserve-3d`: this module
 *    computes numbers and every consumer applies them. `projectLayer` is the
 *    §4.1 fold verbatim, `dofBlur` the §4.4 corrected blur, `resolveCamera` the
 *    §5.4 cuts rule.
 *
 * Zero dependencies, no DOM, no logging side effects (callers pass `onWarn`).
 * Everything a consumer needs to talk about the wire — clamps, quanta, caps,
 * the guard constants, `DOF_K` — is exported as a named constant so the DOM
 * path, the plan path, the worker and the goldens all read the same numbers
 * instead of re-deriving them.
 *
 * ## Sign conventions, stated once
 *
 * `eff = P / (P − (z − camZ))` (§4.1). A layer's `z` is px ABOVE the surface,
 * so raising a layer brings it toward the camera and magnifies it; raising
 * `camZ` moves the whole scene away and shrinks it. `eff(z = camZ) === 1` for
 * EVERY `p` — so `p` is perspective strength (FOV), never magnification, and a
 * dolly is `camZ` (§4.3).
 *
 * ## Relative vs absolute channels
 *
 * On a CONTENT box, `x/y/s/r/o/b` are relative (offsets/multipliers over the
 * authored + transition values — the consumer folds them, §5.2), and a keyed
 * `z` REPLACES the box's `z` field for that segment. On a CAMERA, that same
 * replace rule is generalised to the whole pose: a keyed channel replaces the
 * base pose, and the base is the value wherever no token is authored. There is
 * no sensible additive reading of a focal length.
 */

// ─── channels ────────────────────────────────────────────────────────────────

/** Every channel the grammar knows, in canonical serialisation order. */
export const KF_CHANNELS = ['x', 'y', 'z', 's', 'r', 'rx', 'ry', 'o', 'b', 'f', 'a', 'p'] as const;

export type KfChannel = (typeof KF_CHANNELS)[number];

/** The channels a camera box uses (`s`/`o`/`b` are meaningless on a camera). */
export type KfCameraChannel = 'x' | 'y' | 'z' | 'rx' | 'ry' | 'f' | 'a' | 'p';

export const KF_CAMERA_CHANNELS: readonly KfCameraChannel[] = Object.freeze(
  ['x', 'y', 'z', 'rx', 'ry', 'f', 'a', 'p'] as const,
);

/** A sparse set of channel values — what an evaluation returns. */
export type KfPose = Partial<Record<KfChannel, number>>;

const CHANNEL_SET: ReadonlySet<string> = new Set<string>(KF_CHANNELS);

export function isKfChannel(v: unknown): v is KfChannel {
  return typeof v === 'string' && CHANNEL_SET.has(v);
}

/**
 * Channel names longest-first: the §5.1 token rule is "longest channel name
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
 * These are the WIRE clamps — what a `kf` token may say — and the `z` row is
 * deliberately NOT the per-box field's −300…900 (that is `KF_Z_FIELD_CLAMP`,
 * below). One `kf` grammar carries both a content box's lift and the CAMERA's
 * dolly (§5.4: camera channels are `x y z rx ry f a p`), and `camZ` is the only
 * zoom control there is (§4.3: "Uniform zoom/dolly is `camZ` … there is
 * deliberately no separate zoom channel"). Held to the field's 900 ceiling the
 * whole flat-scene zoom range would be eff ∈ [0.571, 1.333] at P = 1200 — a
 * push-in past 1.33× would not be expressible, and §4.3's Vertigo recipe
 * (`camZ = P·(1/c − 1) + z_s`, so camZ = −600 to pin a 2× subject plane) would
 * clamp silently and desync the dolly from `p`. So `z` spans ±12000, matching
 * `p`'s own ceiling — a few multiples of any usable perspective.
 *
 * `p` stays well clear of 0 in both directions — the projection divides by it.
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
} as const) satisfies Readonly<Record<KfChannel, readonly [number, number]>>;

/**
 * The per-box `z` FIELD's own clamp (§5.3 / §12 Q1): slider 0–300, field and
 * scrub clamp −300…900 (mirrors shadowX/Y's ±300 house clamp; 900 keeps 180px
 * of margin under the 0.9P guard at the default P).
 *
 * This is the clamp on the NUMBER a box stores, applied where that number is
 * read (the hooks' `data-t-z`, the manifest field's min/max, the inspector
 * slider) — not on the `kf` wire, which has to be wide enough for a camera
 * dolly (see `KF_CLAMPS` above). Exported so the one number has one home.
 */
export const KF_Z_FIELD_CLAMP: readonly [number, number] = Object.freeze([-300, 900] as const);

/** Serialisation quanta (§4.6). Parse applies them too — that is the round-trip law. */
export const KF_QUANTA = Object.freeze({
  x: 0.01, y: 0.01, z: 0.01, b: 0.01,
  r: 0.01, rx: 0.01, ry: 0.01,
  s: 0.001, o: 0.001, a: 0.001,
  f: 0.01, p: 0.01,
} as const) satisfies Readonly<Record<KfChannel, number>>;

/** Bezier control points quantise finer than px (§4.6). */
export const KF_BEZIER_QUANTUM = 0.001;

/** Bezier y is unbounded in CSS; bound it here for the same reason as the channels. */
const KF_BEZIER_Y_MAX = 10;

// ─── parse caps ──────────────────────────────────────────────────────────────

/** Max keyframes in one track; the excess is dropped (§5.1 parse caps). */
export const KF_MAX_KEYS = 256;

/**
 * Max characters read from a `kf` field; the excess is ignored.
 *
 * This is the untrusted-input BACKSTOP, and it is deliberately derived from
 * `KF_MAX_KEYS` rather than picked: the two caps have to be mutually
 * satisfiable or the module produces a wire it then mangles. The widest a
 * single keyframe can serialise to is `t` at its cap + the widest custom bezier
 * + all 12 channels at the widest spelling their clamp and quantum allow + the
 * separators = 154 chars, so a full-density track is 256 × 154 + 255 = 39 679.
 * 40 960 clears that, which is what makes the §4.6 round-trip law
 * `parse(serialise(parse(s))) === parse(s)` hold BY CONSTRUCTION for every
 * input: the key cap dominates, so `serialiseKf` can never hand back a string
 * `parseKf` would truncate. `tests/keyframes.test.ts` re-derives the 154 from
 * `KF_CLAMPS`/`KF_QUANTA` and fails if a widened clamp ever eats the headroom —
 * re-derive this constant then, don't paper over it.
 *
 * (Plan §5.1 said 8 KB, written before anyone measured a full-pose track: at
 * 8 KB a 256-key camera track loses ~148 of its keyframes on the way out.)
 */
export const KF_MAX_CHARS = 40960;

/** `t` is clamped to this (MAX_TIME_S · 1000). */
export const KF_MAX_TIME_MS = 3_600_000;

/** DOF blur is capped at the `b` channel's own ceiling so a fly-past cannot hand the compositor an absurd radius. */
export const KF_MAX_BLUR = 300;

/** Every byte a serialised track may contain. Nothing else — never `~` or `,`. */
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
 * The last two are the additive names plan §3 adopts from the Depthfield menu:
 *
 * - `es` **smooth** = `cubic-bezier(0.4, 0, 0.2, 1)` — the standard
 *   accelerate-decelerate curve (Material's "standard"), specified by name in
 *   the plan.
 * - `ek` **snappy** = `cubic-bezier(0.4, 0, 0.6, 1)` — Material's "sharp"
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

/** The ease a keyframe with no ease token means (§5.1: "Absent = `eio`"). */
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
 * so this is `Math.round(v * 100) / 100` and friends — no float dust, and
 * `String()` of the result is the shortest round-tripping spelling.
 */
function quant(v: number, q: number): number {
  const inv = Math.round(1 / q);
  const n = Math.round(v * inv) / inv;
  return Object.is(n, -0) ? 0 : n;
}

/** Strict decimal parse — no exponents, no `NaN`, no `Infinity`, no `+`. */
function num(s: string): number | null {
  if (!NUM_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Bound how much untrusted text a warning may quote — a `kf` value can be 8 KB of anything. */
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
 * bisection as the guaranteed fallback — the shape every browser's own
 * implementation uses. A near-zero derivative is where Newton diverges (a curve
 * with a flat spot), so that case bails to bisection rather than dividing by it.
 * x is clamped to [0,1]; y is deliberately unbounded — that is the whole
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
  // function of progress — CSS rejects the same thing.
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
// key, never a compiled closure — a closure in a structured-cloned track would
// DataCloneError and silently kill worker offload (§5.1).
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
 * grammar's default rather than throwing — junk is skipped everywhere else too.
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
 * Always the `cubic-bezier(a,b,c,d)` spelling (commas — which is exactly why
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
 * the grammar's default — this adapter never throws and never emits a token the
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

// ─── the track ───────────────────────────────────────────────────────────────

/** One keyframe: a time, the ease OUT of it, and the channels it mentions. */
export interface KfKey {
  /** Local box time in ms, integer, 0…KF_MAX_TIME_MS. */
  readonly t: number;
  /** Canonical ease token governing the segment that STARTS here. */
  readonly ease: string;
  /** Only the channels this keyframe mentions — sparseness is a wire property (§5.1). */
  readonly v: Readonly<KfPose>;
}

/** A parsed track: keyframes ascending by `t`, deduped, frozen. */
export type KfTrack = readonly KfKey[];

/**
 * A key as a caller may hand it in — looser than the parsed form, so a `KfKey`
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
    // The truncated tail is parsed leniently under the ordinary junk rules —
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
        // Later tokens overwrite earlier ones within a keyframe — the wire is
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
 * hold their strict-emission rule (§5.1): parse, re-serialise, emit — raw user
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
  // The segment ease governs every channel EXCEPT `o`, which is always linear —
  // `eh` still holds it, like any channel (§5.2).
  const ease = ch === 'o' ? (a.ease === KF_HOLD_EASE ? KF_HOLD_EASE : KF_LINEAR_EASE) : a.ease;
  return av + (bv - av) * kfEaseAt(ease, u);
}

/**
 * The pose at local time `tMs`.
 *
 * Sparse by channel: a channel interpolates between the nearest keyframes that
 * MENTION it — a diamond in between that says nothing about it is transparent —
 * using the earlier mentioning keyframe's ease, and clamp-holds outside the
 * authored range. A channel the track never mentions is ABSENT from the result,
 * so a consumer can tell "not authored" from "authored 0".
 *
 * The per-track channel index is memoised against the track object, so a track
 * must not be mutated in place after its first evaluation — `parseKf` freezes
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

/** The authored camera channels. `p` is perspective strength (FOV), never magnification (§4.3). */
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
  /** Tilt, deg — parsed from day one, consumed at P2. */
  rx?: number;
  /** Tilt, deg — parsed from day one, consumed at P2. */
  ry?: number;
}

/**
 * The DEFAULT camera (§5.4): P = 1200, pose 0.
 *
 * This is what "no camera box" resolves to — never a literal identity, because
 * an identity would swallow z. It projects z = 0 layers at eff = 1, so every
 * existing document renders byte-identically.
 */
export const DEFAULT_CAMERA: Readonly<KfCameraPose> = Object.freeze({ x: 0, y: 0, z: 0, p: 1200, f: 0, a: 0 });

/** The default perspective strength, in px. */
export const DEFAULT_PERSPECTIVE = 1200;

/** A camera pose plus the stage it looks at — the principal point is the stage centre. */
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

/** u at which eff freezes and the alpha ramp reaches 0 (§4.5). */
export const KF_GUARD_U = 0.9;

/** Width of the alpha ramp below the guard, in u (so the ramp runs over [0.8, 0.9]). */
export const KF_GUARD_BAND = 0.1;

/**
 * eff at the clamp: 1/(1 − 0.9). Any fly-past hits the plate budget cap — a
 * designed path.
 *
 * `projectDepth` returns EXACTLY this at and beyond the guard — the naive
 * `1/(1 − 0.9)` is 10.000000000000002 in IEEE-754, which would put the number
 * consumers actually see above the maximum this constant declares (the §5.5
 * plate-resolution buckets and the λ budget are both computed from maxEff). See
 * the P-space form in `projectDepth`.
 */
export const KF_EFF_MAX = 10;

/** What the depth of one layer works out to under a camera. */
export interface KfDepth {
  /** (z − camZ)/P, unclamped — the diagnostic the guard is stated in. */
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
 * The behind-camera guard (§4.5), pinned as formula because it is part of the
 * byte-stable contract:
 *
 *   u = (z − camZ)/P;  eff uses min(u, 0.9)  →  eff_max = 10
 *   alphaGuard = clamp((0.9 − u)/0.1, 0, 1)
 *
 * eff FREEZES at its clamp value while alpha ramps, so the pole is unreachable
 * and the whole thing stays continuous.
 *
 * eff is computed in P-SPACE — `P/(P − min(dz, 0.9P))` rather than
 * `1/(1 − min(u, 0.9))` — and then held to `KF_EFF_MAX`. Same value everywhere
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
  /** Resolved depth: the box's `z` field unless a kf `z` token overrides it (§5.2). */
  z?: number;
}

/** What the caller folds into its own item. `scale` is eff and multiplies the transition/kf scale. */
export interface KfProjection {
  /** cx' − bx: the projected offset for the x axis, replacing the raw transition + kf offsets. */
  dx: number;
  /** cy' − by. */
  dy: number;
  /** eff — multiply the transition and keyframe scales by this (§4.1: scale = scT · sK · eff). */
  scale: number;
  /** Multiply the item's alpha by this; skip the layer entirely at 0. */
  alphaGuard: number;
}

/**
 * The §4.1 fold, exactly:
 *
 *   cx  = bx + dxT + dxK
 *   eff = P/(P − (z − camZ))
 *   cx' = W/2 + (cx − camX − W/2)·eff
 *   dx  = cx' − bx        scale = eff        (per axis for y/H)
 *
 * The transition and keyframe offsets are INSIDE the projection, so they scale
 * by eff — a slide enter on a lifted layer tracks the parallax instead of
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
  const { eff, alphaGuard } = projectDepth(cam, layer.z ?? 0);
  const w = Number.isFinite(cam.w) ? cam.w : 0;
  const h = Number.isFinite(cam.h) ? cam.h : 0;
  const camX = Number.isFinite(cam.x) ? cam.x : 0;
  const camY = Number.isFinite(cam.y) ? cam.y : 0;
  const px = w / 2 + (cx - camX - w / 2) * eff;
  const py = h / 2 + (cy - camY - h / 2) * eff;
  return { dx: px - bx, dy: py - by, scale: eff, alphaGuard };
}

/**
 * The aperture-to-pixels constant: max blur in px at a = 1 for a layer one
 * focal length out of focus at eff = 1. K = 40px at P = 1200 (§4.4), pinned in
 * the golden tables so both evaluators share it.
 */
export const DOF_K = 40;

/**
 * Depth-of-field blur for a layer at depth `z` (§4.4, corrected):
 *
 *   blur = a · K · |z − f| · eff(z) · eff(f) / P
 *
 * The `eff(z)·eff(f)` factor is the correction: without it, dollying toward an
 * out-of-focus layer SHARPENED it — the defocus circle is magnified by the same
 * projection as everything else, at both the layer and the focal plane.
 * Returned in stage-native px (×S at export), capped at KF_MAX_BLUR.
 */
export function dofBlur(cam: Pick<KfCameraPose, 'z' | 'p' | 'f' | 'a'>, z: number): number {
  const a = clamp(typeof cam.a === 'number' && Number.isFinite(cam.a) ? cam.a : 0, 0, 1);
  if (!(a > 0)) return 0;
  const P = sanePerspective(cam.p);
  const f = typeof cam.f === 'number' && Number.isFinite(cam.f) ? cam.f : 0;
  const zz = Number.isFinite(z) ? z : 0;
  const blur = (a * DOF_K * Math.abs(zz - f) * projectDepth(cam, zz).eff * projectDepth(cam, f).eff) / P;
  return clamp(blur, 0, KF_MAX_BLUR);
}

/**
 * The camera governing time `tMs` (§5.4): the LATEST-IN-ARRAY clip whose window
 * covers t, folded to a pose. Windows are half-open `[start, end)` so adjacent
 * clips cut cleanly; an untimed clip ("Always on") covers everything.
 *
 * With no camera at all — or none covering t — the result is the DEFAULT camera
 * (P = 1200, pose 0), which projects z = 0 at eff = 1. Never a literal identity:
 * an identity would swallow z, and the whole point is that lifted layers read as
 * lifted the moment the first z slider moves.
 *
 * Channels are ABSOLUTE on a camera: a keyed channel replaces the base pose for
 * that segment, and the base is the value wherever the track authors no token —
 * the §5.2 `z`-replaces-the-field rule, generalised (there is no sensible
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
      pick = c; // latest-in-array wins — cuts, not blends (§5.4)
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
  // keys leaves the range mid-flight — `t0_ea_a1*t1000_a0` peaks at a = 1.072,
  // and `KfCameraPose.a` is documented "Aperture 0–1". The resolved pose is this
  // module's public contract (the §8 camera panel and any plate-padding budget
  // read it directly), so the guarantee has to hold here rather than only inside
  // `dofBlur`'s own re-clamp. Clamped, NOT quantised: the quanta are a wire
  // property (§4.6) and rounding a per-frame camera position to 0.01px would
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
