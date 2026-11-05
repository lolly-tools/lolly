// SPDX-License-Identifier: MPL-2.0
/**
 * Spring easing for the `kf` wire (plans/329): the physics, the landing rule and the
 * wire spelling of one spring. DOM-free and dependency-free; keyframes.ts owns the
 * grammar that embeds it and calls in here to evaluate.
 *
 * ## The model
 *
 * A spring is real time, not a stretched curve. `x(τ)` solves
 *
 *     m·x'' = k·(1 − x) − c·x',   x(0) = 0,  x'(0) = 0,   τ in seconds
 *
 * for stiffness `k`, damping `c` and mass `m`, so Bouncy feels the same on a 400 ms
 * segment as on a 4 s one: it settles at its own pace and then rests.
 *
 * ## The arrival rule
 *
 * A segment of `T` ms must end exactly on the next key, settled or not:
 *
 *     S(u) = x(u·T) + (1 − x(T))·u
 *
 * Whatever distance the spring has not covered by the next key is spread evenly over
 * the segment. A spring that settles inside the segment adds nothing (x(T) is 1), and
 * one that is cut short still reaches the key. With no segment (a CSS readout, a plot with no
 * next key) `T` is the spring's own settle time.
 *
 * ## Determinism
 *
 * The output reaches SVG text, dotLottie JSON and pixel bytes, which must match on every
 * host. A closed form needs `exp`, `sin` and `cos`, which V8 and JavaScriptCore do not
 * round the same way (the emoji treatment avoids them for the same reason), plus three
 * damping regimes and a division by √(1 − ζ²) that blows up near critical damping. So the
 * spring is INTEGRATED: classical Runge-Kutta at a fixed 1 ms step, using only + − × ÷,
 * each of which IEEE 754 rounds exactly the same everywhere. The samples are cached per
 * spring as a table of x and x' (until the spring settles, then x is exactly 1), and a
 * time between two samples is a cubic Hermite blend of them, which is arithmetic too.
 * The integrator IS the definition of the curve, so there is no closed form for it to
 * drift from.
 */

/** The three physical parameters, in their wire order. */
export interface KfSpring {
  /** Stiffness k. */
  readonly stiffness: number;
  /** Damping c. At zero the spring never settles, and the arrival rule still brings it to the next key. */
  readonly damping: number;
  /** Mass m. */
  readonly mass: number;
}

/** A part of a spring fitted to a span, rescaled to fill its own segment (written by split and trim). */
export interface KfSpringWindow {
  /** The span, ms, the spring was fitted to. */
  readonly span: number;
  /** Window start and end, ms into that span. `to > from`. */
  readonly from: number;
  readonly to: number;
}

/** Wire clamps and quanta, by parameter: [min, max, quantum]. */
export const KF_SPRING_LIMITS = Object.freeze({
  stiffness: [1, 5000, 0.1],
  damping: [0, 500, 0.01],
  mass: [0.1, 100, 0.01],
  /** A window's span and ends, ms. */
  window: [0, 3_600_000, 0.01],
} as const);

/**
 * The named springs. They have no short tokens on the wire: each is its plain
 * `esp(k)(c)(m)` spelling, recognised by value like a bezier preset is.
 */
export const KF_SPRING_PRESETS = Object.freeze({
  gentle: Object.freeze({ stiffness: 100, damping: 15, mass: 1 }),
  quick: Object.freeze({ stiffness: 300, damping: 20, mass: 1 }),
  bouncy: Object.freeze({ stiffness: 600, damping: 15, mass: 1 }),
  slow: Object.freeze({ stiffness: 80, damping: 20, mass: 1 }),
} as const) satisfies Readonly<Record<string, KfSpring>>;

export type KfSpringPresetName = keyof typeof KF_SPRING_PRESETS;

/** The integration step, ms. One wire millisecond, so every key time falls on a sample. */
export const KF_SPRING_STEP_MS = 1;

/** The longest a spring is simulated, ms. One still moving after this is held where it is. */
export const KF_SPRING_MAX_MS = 30_000;

/** Settled: within this of the target, and moving slower than SETTLE_V per second. */
const SETTLE_X = 1e-7;
const SETTLE_V = 1e-5;

/** The settle time a segment-less spring is drawn over: within 0.1 % of the target. */
const SETTLE_SHOWN = 1e-3;

const SPRING_RE = /^esp\(([^()]*)\)\(([^()]*)\)\(([^()]*)\)(?:\(([^()]*)\)\(([^()]*)\)\(([^()]*)\))?$/;
const NUM_RE = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/;

function num(s: string | undefined): number | null {
  if (s === undefined || !NUM_RE.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function quant(v: number, q: number): number {
  const inv = Math.round(1 / q);
  const n = Math.round(v * inv) / inv;
  return Object.is(n, -0) ? 0 : n;
}

const clampTo = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

function limit(v: number, which: keyof typeof KF_SPRING_LIMITS): number {
  const [lo, hi, q] = KF_SPRING_LIMITS[which];
  return quant(clampTo(v, lo, hi), q);
}

/** A spring held to the wire's clamps and quanta. */
export function kfSpring(stiffness: number, damping: number, mass: number): KfSpring {
  return {
    stiffness: limit(Number.isFinite(stiffness) ? stiffness : 100, 'stiffness'),
    damping: limit(Number.isFinite(damping) ? damping : 15, 'damping'),
    mass: limit(Number.isFinite(mass) ? mass : 1, 'mass'),
  };
}

const fmt = (v: number): string => String(Object.is(v, -0) ? 0 : v);

/** The wire spelling of a spring, with its window when it has one. */
export function kfSpringToken(sp: KfSpring, win?: KfSpringWindow | null): string {
  const s = kfSpring(sp.stiffness, sp.damping, sp.mass);
  const head = `esp(${fmt(s.stiffness)})(${fmt(s.damping)})(${fmt(s.mass)})`;
  return win ? `${head}(${fmt(win.span)})(${fmt(win.from)})(${fmt(win.to)})` : head;
}

/** A parsed spring token. */
export interface KfSpringEase {
  readonly spring: KfSpring;
  readonly window: KfSpringWindow | null;
}

/**
 * Read a spring token, clamped and quantised, or null when the token is not one.
 *
 * A window whose end does not come after its start describes no motion at all, so the
 * whole token is junk rather than half of one. The tool hook (design-renderer.js) carries
 * a copy of this rule; tests/timeline-model.test.ts pins the two together.
 */
export function parseKfSpring(tok: string): KfSpringEase | null {
  const m = SPRING_RE.exec(tok);
  if (!m) return null;
  const k = num(m[1]), c = num(m[2]), ms = num(m[3]);
  if (k === null || c === null || ms === null) return null;
  const spring = kfSpring(k, c, ms);
  if (m[4] === undefined) return { spring, window: null };
  const T = num(m[4]), a = num(m[5]), b = num(m[6]);
  if (T === null || a === null || b === null) return null;
  const span = limit(T, 'window');
  if (!(span >= 1)) return null;
  const from = quant(clampTo(a, 0, span), KF_SPRING_LIMITS.window[2]);
  const to = quant(clampTo(b, 0, span), KF_SPRING_LIMITS.window[2]);
  if (!(to > from)) return null;
  return { spring, window: { span, from, to } };
}

/** The preset a plain spring is, by exact value, or ''. */
export function kfSpringPresetName(sp: KfSpring | null | undefined): KfSpringPresetName | '' {
  if (!sp) return '';
  for (const [name, p] of Object.entries(KF_SPRING_PRESETS)) {
    if (p.stiffness === sp.stiffness && p.damping === sp.damping && p.mass === sp.mass) return name as KfSpringPresetName;
  }
  return '';
}

/** The damping ratio ζ: below 1 the spring bounces, and at 1 or above the spring never passes its target. */
export function kfSpringDampingRatio(sp: KfSpring): number {
  return sp.damping / (2 * Math.sqrt(sp.stiffness * sp.mass));
}

// ─── the table ───────────────────────────────────────────────────────────────

interface SpringTable {
  /** x at every whole ms, from 0. */
  readonly x: Float64Array;
  /** dx/dτ at every whole ms, per ms. */
  readonly v: Float64Array;
  /** True when the spring settled inside the table; past its end x is then exactly 1. */
  readonly settled: boolean;
  /** First ms after which |1 − x| stays within SETTLE_SHOWN. */
  readonly settleMs: number;
}

// Bounded, and keyed by the spring's canonical parameters (never the segment), so every
// segment and every split half of one spring shares one table.
const TABLES = new Map<string, SpringTable>();
const TABLE_CACHE_MAX = 16;

function buildTable(sp: KfSpring): SpringTable {
  const { stiffness: k, damping: c, mass: m } = sp;
  const dt = KF_SPRING_STEP_MS / 1000;
  const half = dt / 2;
  const acc = (x: number, v: number): number => (k * (1 - x) - c * v) / m;
  const xs: number[] = [0];
  const vs: number[] = [0];
  let x = 0, v = 0;
  let settled = false;
  for (let i = 1; i <= KF_SPRING_MAX_MS; i++) {
    const a1 = acc(x, v);
    const x2 = x + half * v, v2 = v + half * a1;
    const a2 = acc(x2, v2);
    const x3 = x + half * v2, v3 = v + half * a2;
    const a3 = acc(x3, v3);
    const x4 = x + dt * v3, v4 = v + dt * a3;
    const a4 = acc(x4, v4);
    x = x + (dt / 6) * (v + 2 * v2 + 2 * v3 + v4);
    v = v + (dt / 6) * (a1 + 2 * a2 + 2 * a3 + a4);
    xs.push(x);
    vs.push(v / 1000);
    if (Math.abs(1 - x) <= SETTLE_X && Math.abs(v) <= SETTLE_V) { settled = true; break; }
  }
  let settleMs = xs.length - 1;
  while (settleMs > 0 && Math.abs(1 - (xs[settleMs - 1] as number)) <= SETTLE_SHOWN) settleMs--;
  return { x: Float64Array.from(xs), v: Float64Array.from(vs), settled, settleMs: Math.max(1, settleMs) };
}

function tableOf(sp: KfSpring): SpringTable {
  const key = `${sp.stiffness}|${sp.damping}|${sp.mass}`;
  const hit = TABLES.get(key);
  if (hit) return hit;
  const built = buildTable(sp);
  if (TABLES.size >= TABLE_CACHE_MAX) TABLES.delete(TABLES.keys().next().value as string);
  TABLES.set(key, built);
  return built;
}

/** x at `tMs` ms into the spring's own motion (0 before it starts). */
export function kfSpringPosition(sp: KfSpring, tMs: number): number {
  if (!(tMs > 0)) return 0;
  const tab = tableOf(sp);
  const last = tab.x.length - 1;
  if (tMs >= last) return tab.settled ? 1 : (tab.x[last] as number);
  const i = Math.floor(tMs);
  const s = tMs - i;
  const x0 = tab.x[i] as number, x1 = tab.x[i + 1] as number;
  if (s === 0) return x0;
  const v0 = tab.v[i] as number, v1 = tab.v[i + 1] as number;
  const s2 = s * s, s3 = s2 * s;
  // Cubic Hermite over one 1 ms step, slopes per ms.
  return (2 * s3 - 3 * s2 + 1) * x0 + (s3 - 2 * s2 + s) * v0 + (-2 * s3 + 3 * s2) * x1 + (s3 - s2) * v1;
}

/** How long the spring takes to come within 0.1 % of its target and stay there, ms. */
export function kfSpringSettleMs(sp: KfSpring): number {
  return tableOf(sp).settleMs;
}

/** The spring fitted to a span of `T` ms, read `tMs` ms after its start: S_T(τ). */
function landed(sp: KfSpring, T: number, tMs: number): number {
  const xT = kfSpringPosition(sp, T);
  return kfSpringPosition(sp, tMs) + (1 - xT) * (tMs / T);
}

/**
 * Eased progress of a spring segment at raw progress `u ∈ [0, 1]`.
 *
 * `spanMs` is the segment's length; absent or not positive, the spring's own settle time
 * is used. A window ignores it: the window carries the span it was cut from.
 */
export function kfSpringAt(ease: KfSpringEase, u: number, spanMs?: number): number {
  if (!(u > 0)) return 0;
  if (u >= 1) return 1;
  const { spring, window: cut } = ease;
  if (cut) {
    const T = cut.span;
    const a = landed(spring, T, cut.from);
    const b = landed(spring, T, cut.to);
    const d = b - a;
    if (d === 0) return u;
    return (landed(spring, T, cut.from + (cut.to - cut.from) * u) - a) / d;
  }
  const T = typeof spanMs === 'number' && spanMs > 0 && Number.isFinite(spanMs) ? spanMs : kfSpringSettleMs(spring);
  return landed(spring, T, u * T);
}

/** Below this the renormalisation of a split half divides by almost nothing. */
const SUBDIVIDE_EPS = 1e-4;

/**
 * Split a spring segment at `lambda` (a fraction of its time) into the two windows that
 * reproduce it exactly. A plain spring is first fitted to `spanMs` (its settle time
 * when absent). Null for a half whose two ends coincide: such a half is constant
 * whatever ease it carries, and the caller keeps the original token there.
 */
export function subdivideKfSpring(ease: KfSpringEase, lambda: number, spanMs?: number): { left: string | null; right: string | null } {
  const { spring } = ease;
  const win = ease.window ?? {
    span: limit(typeof spanMs === 'number' && spanMs > 0 && Number.isFinite(spanMs) ? spanMs : kfSpringSettleMs(spring), 'window'),
    from: 0,
    to: 0,
  };
  const span = Math.max(1, win.span);
  const from = ease.window ? win.from : 0;
  const to = ease.window ? win.to : span;
  const q = KF_SPRING_LIMITS.window[2];
  const cut = quant(from + (to - from) * lambda, q);
  const a = landed(spring, span, from), c = landed(spring, span, cut), b = landed(spring, span, to);
  const left = Math.abs(c - a) < SUBDIVIDE_EPS || !(cut > from) ? null : kfSpringToken(spring, { span, from, to: cut });
  const right = Math.abs(b - c) < SUBDIVIDE_EPS || !(to > cut) ? null : kfSpringToken(spring, { span, from: cut, to });
  return { left, right };
}

/**
 * The spring as CSS `linear()`: 61 evenly spaced stops over the segment, enough that the
 * piecewise line stays within a fraction of a percent of the curve for any preset.
 */
export function kfSpringCss(ease: KfSpringEase, spanMs?: number): string {
  const N = 60;
  const stops: string[] = [];
  for (let i = 0; i <= N; i++) {
    const y = i === 0 ? 0 : i === N ? 1 : kfSpringAt(ease, i / N, spanMs);
    stops.push(fmt(Math.round(y * 10000) / 10000));
  }
  return `linear(${stops.join(', ')})`;
}
