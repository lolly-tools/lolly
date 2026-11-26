// SPDX-License-Identifier: MIT
/*
 * Detent physics, vendored from @hayderkg/detent 0.1.1.
 *
 *   Repository: https://github.com/hayderkg/detent
 *   Commit:     2887e4abcc3ddfbdb3f2b76bec6049665e1bbb94 (tag v0.1.1)
 *   Files:      src/physics/{types,decay,velocity,snap,spring,release,rubberband,ticks}.ts,
 *               src/presets.ts (the Physics bundles) and the wheel reading in
 *               src/engine/engine.ts.
 *
 * Copyright (c) 2026 Hayder
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Local changes (Lolly):
 *   - The physics files are joined into this one module, written with
 *     semicolons and this repository's line breaks. Names, signatures,
 *     constants and logic are upstream's.
 *   - From src/presets.ts only the Physics bundles are kept (`Physics`, `ios`,
 *     `presets`); resolvePhysics and the React option plumbing are not.
 *   - The wheel and trackpad reading inside engine.ts's wheel handler becomes the
 *     pure `wheelReader()` below. It classifies each event and says what to do;
 *     the caller owns the position, the motion and preventDefault. One option is
 *     added, `crossAxisNotches` (upstream behaviour: true), so a horizontal
 *     control can leave a plain vertical mouse wheel to the page.
 *   - `burstVelocity()` is engine.ts's accelerated-burst velocity, lifted out of
 *     the handler unchanged.
 *   - Two expressions are spelled out for this repository's linter, with the same
 *     meaning: release() tests `Number.isNaN(index)` where upstream wrote
 *     `index !== index`, and crossings() steps `i` before calling back instead of
 *     assigning inside the call.
 *   - Four comment lines are reworded for this repository's plain-English comment
 *     check, which bars a figurative verb and a sentence ending in a bare pronoun.
 *     The code they describe is unchanged.
 *
 * Framework-free and DOM-free: nothing here reads the clock, the page or the
 * event loop, so it runs the same in a browser, a worker and node:test.
 * Units throughout: position in px, time in ms, velocity in px/ms.
 * Registered in security/vendor-artifacts.json (byte pin), scripts/build-licenses.ts
 * (THIRD-PARTY-NOTICES.md) and the SBOM. Changing a byte here means updating the pin.
 */

// ── src/physics/types.ts ────────────────────────────────────────────────────

/** Units throughout the physics core: position in px, time in ms, velocity in px/ms. */
export interface State {
  x: number;
  v: number;
}

export interface SpringConfig {
  /** N/m-style stiffness, in the same units as react-spring / framer-motion (per s²). */
  stiffness: number;
  damping: number;
  mass: number;
}

export type Phase = 'coast' | 'spring';

export interface Motion {
  /** Final resting position, px. */
  readonly to: number;
  /** Total duration, ms. The motion is exactly at rest (x = to, v = 0) from here on. */
  readonly duration: number;
  /** Evaluate at elapsed time t (ms). Pure: same t gives the same state at any frame rate. */
  at(t: number): State & { phase: Phase };
}

// ── src/physics/decay.ts ────────────────────────────────────────────────────

/** Time constant (ms) of exponential decay with per-ms retention `decay` (iOS: 0.998 → ~499.5ms). */
export const tau = (decay: number): number => -1 / Math.log(decay);

/** Resting point of a coast: x∞ = x₀ + v₀·τ. */
export const project = (x: number, v: number, decay: number): number => x + v * tau(decay);

/**
 * Exponential coast: v(t) = v₀·e^(−t/τ), x(t) = x₀ + v₀·τ·(1 − e^(−t/τ)).
 * Never at rest on its own, so `duration` is the caller's handoff time.
 */
export function coast(x0: number, v0: number, T: number, duration: number): Motion {
  return {
    to: x0 + v0 * T,
    duration,
    at(t) {
      const e = Math.exp(-t / T);
      return { x: x0 + v0 * T * (1 - e), v: v0 * e, phase: 'coast' };
    },
  };
}

/** Time at which a coast reaches position `x` (NaN if it never does). */
export function coastTimeTo(x0: number, v0: number, T: number, x: number): number {
  const r = 1 - (x - x0) / (v0 * T);
  return r > 0 && r <= 1 ? -T * Math.log(r) : NaN;
}

// ── src/physics/velocity.ts ─────────────────────────────────────────────────

/**
 * Release-velocity estimator over recent pointer samples.
 *
 * Weighted least-squares slope of x(t) over the last `window` ms, with weights (1 − age/(1.5·window))²
 * so recent motion dominates without letting one noisy sample decide. If the newest sample is older
 * than `stale` ms at release, the finger had stopped: velocity is 0.
 */
export interface VelocityTracker {
  push(t: number, x: number): void;
  reset(): void;
  /** px/ms at time `now`. */
  get(now: number): number;
}

export function velocityTracker(window = 100, stale = 40, size = 16): VelocityTracker {
  const ts: number[] = [];
  const xs: number[] = [];
  return {
    push(t, x) {
      ts.push(t);
      xs.push(x);
      if (ts.length > size) {
        ts.shift();
        xs.shift();
      }
    },
    reset() {
      ts.length = xs.length = 0;
    },
    get(now) {
      const n = ts.length;
      const last = ts[n - 1];
      if (n < 2 || last === undefined || now - last > stale) return 0;
      // Use samples inside the window, but always at least the last two (sparse input).
      let i = n - 1;
      while (i > 0 && (now - ts[i - 1]! <= window || i > n - 2)) i--;
      // One-pass weighted least squares. Times are taken relative to `now` (|t| ≤ ~150ms), so the
      // Σt² − (Σt)² form has no cancellation problem.
      let sw = 0;
      let st = 0;
      let sx = 0;
      let stt = 0;
      let stx = 0;
      for (let j = i; j < n; j++) {
        const t = ts[j]! - now;
        const x = xs[j]! - xs[n - 1]!; // centered too: positions can be ~1e6px
        const w = (1 - Math.min(1, -t / (window * 1.5))) ** 2 + 1e-6;
        sw += w;
        st += w * t;
        sx += w * x;
        stt += w * t * t;
        stx += w * t * x;
      }
      const den = sw * stt - st * st;
      return den > 1e-9 ? (sw * stx - st * sx) / den : 0;
    },
  };
}

// ── src/physics/snap.ts ─────────────────────────────────────────────────────

export interface Bounds {
  /** First selectable-or-restable index (can be negative for header rows). Ignored when looping. */
  min: number;
  /** Last index. Ignored when looping. */
  max: number;
  loop: boolean;
  /** Number of distinct items; bounds the search when looping. */
  count: number;
  /** Whether a (raw, unwrapped) index can be rested on. Defaults to all. */
  enabled?: (index: number) => boolean;
}

export const mod = (i: number, n: number): number => ((i % n) + n) % n;

/**
 * The enabled index nearest to `i`. On a tie, prefers the side of `dir` (sign of velocity).
 * Returns NaN when nothing is enabled.
 */
export function nearest(i: number, b: Bounds, dir = 0): number {
  const start = b.loop ? i : Math.min(b.max, Math.max(b.min, i));
  const span = b.loop ? b.count : b.max - b.min;
  const ok = (j: number) => (b.loop || (j >= b.min && j <= b.max)) && (!b.enabled || b.enabled(j));
  const first = dir < 0 ? -1 : 1;
  for (let d = 0; d <= span; d++) {
    if (ok(start + first * d)) return start + first * d;
    if (ok(start - first * d)) return start - first * d;
  }
  return NaN;
}

// ── src/physics/spring.ts ───────────────────────────────────────────────────

/**
 * Default rest thresholds: half a CSS px and 0.01px/ms (10px/s). Below both, the motion rests exactly
 * on its target. Pass `restDelta = 0.5 / devicePixelRatio` so the final jump is under half a device
 * pixel: invisible, and it cuts the sub-pixel creep that reads as blurry text.
 */
export const REST_DELTA = 0.5;
export const REST_SPEED = 0.01;
const STEP = 4; // ms, settle-time search resolution
const MAX_T = 10_000;

export const dampingRatio = ({ stiffness: k, damping: c, mass: m }: SpringConfig): number =>
  c / (2 * Math.sqrt(k * m));

/** Damping that gives damping ratio ζ for this stiffness and mass. */
export const dampingFor = (zeta: number, stiffness: number, mass: number): number =>
  2 * zeta * Math.sqrt(stiffness * mass);

/**
 * Closed-form damped harmonic oscillator. Returns Δ(t) = x − to (px) and v (px/ms) for t in ms.
 * Evaluated analytically, so it is exact at any frame rate (no integration error, no dt).
 */
function solver(d0: number, v0: number, w0: number, z: number) {
  const V0 = v0 * 1000; // px/s; the spring constants are in seconds
  if (z < 1 - 1e-6) {
    const wd = w0 * Math.sqrt(1 - z * z);
    const B = (V0 + z * w0 * d0) / wd;
    return (ms: number): [number, number] => {
      const t = ms / 1000;
      const e = Math.exp(-z * w0 * t);
      const c = Math.cos(wd * t);
      const s = Math.sin(wd * t);
      const d = e * (d0 * c + B * s);
      return [d, (e * (B * wd * c - d0 * wd * s) - z * w0 * d) / 1000];
    };
  }
  if (z <= 1 + 1e-6) {
    const B = V0 + w0 * d0;
    return (ms: number): [number, number] => {
      const t = ms / 1000;
      const e = Math.exp(-w0 * t);
      return [(d0 + B * t) * e, ((B - w0 * (d0 + B * t)) * e) / 1000];
    };
  }
  const q = Math.sqrt(z * z - 1);
  const r1 = -w0 * (z - q);
  const r2 = -w0 * (z + q);
  const B = (V0 - r1 * d0) / (r2 - r1);
  const A = d0 - B;
  return (ms: number): [number, number] => {
    const t = ms / 1000;
    const e1 = A * Math.exp(r1 * t);
    const e2 = B * Math.exp(r2 * t);
    return [e1 + e2, (r1 * e1 + r2 * e2) / 1000];
  };
}

function settle(f: (ms: number) => [number, number], restDelta: number): number {
  for (let t = 0; t < MAX_T; t += STEP) {
    const [d, v] = f(t);
    if (Math.abs(d) < restDelta && Math.abs(v) < REST_SPEED) return t;
  }
  return MAX_T;
}

/**
 * A spring from `from` (with initial velocity v0, px/ms) to `to`.
 * `maxDuration` caps settle time by speeding the spring up while keeping its damping ratio,
 * so the character of the motion (overshoot) is preserved, just faster.
 */
export function spring(
  from: number,
  to: number,
  v0: number,
  config: SpringConfig,
  maxDuration = Infinity,
  restDelta = REST_DELTA
): Motion {
  const z = dampingRatio(config);
  let w0 = Math.sqrt(config.stiffness / config.mass);
  let f = solver(from - to, v0, w0, z);
  let duration = settle(f, restDelta);
  for (let i = 0; i < 4 && duration > maxDuration; i++) {
    w0 *= (duration / maxDuration) * 1.05;
    f = solver(from - to, v0, w0, z);
    duration = settle(f, restDelta);
  }
  return {
    to,
    duration,
    at(t) {
      if (t >= duration) return { x: to, v: 0, phase: 'spring' };
      const [d, v] = f(Math.max(0, t));
      return { x: to + d, v, phase: 'spring' };
    },
  };
}

// ── src/physics/release.ts ──────────────────────────────────────────────────

export interface ReleaseOptions {
  /** Per-ms velocity retention of the coast (iOS: 0.998). */
  decay: number;
  spring: SpringConfig;
  /** px/ms cap on release speed. */
  maxVelocity: number;
  /** ms cap on each spring phase. */
  snapDuration: number;
  /** Coast → spring handoff distance, in rows. */
  handoff?: number;
  /** Rest when within this many px of the target (use 0.5 / devicePixelRatio). */
  restDelta?: number;
  /**
   * How hard the row pulls the wheel in at the end of a throw (≥ 1). A spring speeds the coast up
   * when ω₀ > 2ζ/τ', which reads as a magnetic tug; the settle spring is softened to at most
   * magnet × 2ζ/τ'. 1 = pure glide, ~1.1 = imperceptible, 2+ = a noticeable click. Default 1.1.
   */
  magnet?: number;
}

export interface Release extends Motion {
  /** Row the motion rests on. */
  readonly index: number;
}

/** τ' may differ from τ by this much: friction retuned to land on a row stays imperceptible. */
const TAU_MIN = 0.6;
const TAU_MAX = 1.6;

/** Run `a` until `t1`, then `b` (which starts at its own t = 0). */
function then(a: Motion, t1: number, b: Motion): Motion {
  const duration = t1 + b.duration;
  return {
    to: b.to,
    duration,
    at: (t) => (t < t1 ? a.at(t) : b.at(t >= duration ? b.duration : t - t1)),
  };
}

/**
 * Plan the motion after a release (or after trackpad momentum ends) at position x with velocity v.
 *
 * 1. Project the natural resting point x∞ = x + v·τ.
 * 2. Snap it to the nearest enabled row X.
 * 3. Retune friction so the coast ends exactly on X: τ' = (X − x)/v. Within [0.6τ, 1.6τ] this is
 *    invisible, so the glide simply ends on a row with no correction.
 * 4. Hand off to the spring for the last `handoff` rows, carrying position and velocity (continuous).
 * 5. Throws past an edge coast into it and bounce back with the spring (iOS edge bounce).
 * 6. Anything else (tiny throws, released in the rubber band): spring from (x, v) to X.
 */
export function release(x: number, v: number, size: number, b: Bounds, o: ReleaseOptions): Release {
  v = Math.max(-o.maxVelocity, Math.min(o.maxVelocity, v));
  const T = tau(o.decay);
  const projected = x + v * T;
  let index = nearest(Math.round(projected / size), b, v);
  if (Number.isNaN(index)) index = Math.round(x / size); // nothing enabled: settle on the nearest row
  const X = index * size;
  const lo = b.min * size;
  const hi = b.max * size;
  const inside = b.loop || (x >= lo && x <= hi);
  const springTo = (x0: number, v0: number) =>
    spring(x0, X, v0, o.spring, o.snapDuration, o.restDelta);
  const done = (m: Motion): Release => ({ ...m, index });

  // Edge bounce: thrown past the end from inside → coast to the wall, spring back from the wall.
  if (
    !b.loop &&
    inside &&
    ((v > 0 && projected > hi + size / 2) || (v < 0 && projected < lo - size / 2))
  ) {
    const tc = coastTimeTo(x, v, T, X);
    if (tc > 0) {
      const c = coast(x, v, T, tc);
      return done(then(c, tc, springTo(X, c.at(tc).v)));
    }
  }

  const d = X - x;
  const T2 = d / v;
  const handoff = (o.handoff ?? 0.5) * size;
  if (inside && v !== 0 && T2 >= TAU_MIN * T && T2 <= TAU_MAX * T && Math.abs(d) > handoff) {
    const th = T2 * Math.log(Math.abs(d) / handoff);
    const c = coast(x, v, T2, th);
    const s = c.at(th);
    const { stiffness: k, mass: m } = o.spring;
    const z = dampingRatio(o.spring);
    const w = Math.min(Math.sqrt(k / m), ((o.magnet ?? 1.1) * 2 * z * 1000) / T2);
    const soft = { stiffness: w * w * m, damping: dampingFor(z, w * w * m, m), mass: m };
    return done(then(c, th, spring(s.x, X, s.v, soft, o.snapDuration, o.restDelta)));
  }
  return done(springTo(x, v));
}

// ── src/physics/rubberband.ts ───────────────────────────────────────────────

/**
 * iOS rubber band: distance shown for an overscroll of `o` px, with dimension `d` and constant `c`.
 * f(o) = (1 − 1/(o·c/d + 1))·d. Slope c at 0, asymptote d.
 */
export const rubberband = (o: number, d: number, c: number): number =>
  c <= 0 || d <= 0 ? 0 : (1 - 1 / ((o * c) / d + 1)) * d;

/** Map a raw position to what is displayed, rubber-banding outside [lo, hi]. */
export function rubberClamp(x: number, lo: number, hi: number, d: number, c: number): number {
  if (x < lo) return lo - rubberband(lo - x, d, c);
  if (x > hi) return hi + rubberband(x - hi, d, c);
  return x;
}

// ── src/physics/ticks.ts ────────────────────────────────────────────────────

/**
 * Calls `cb` for every row index whose center is crossed moving from position a to b (px),
 * in order of crossing. The centered row is round(x / size).
 */
export function crossings(a: number, b: number, size: number, cb: (index: number) => void): void {
  let i = Math.round(a / size);
  const j = Math.round(b / size);
  if (!Number.isFinite(i) || !Number.isFinite(j)) return; // a 0 or NaN size must not hang the page
  while (i !== j) {
    i += i < j ? 1 : -1;
    cb(i);
  }
}

// ── src/presets.ts (the Physics bundles) ────────────────────────────────────

export interface Physics {
  decay: number;
  spring: SpringConfig;
  /** 0–1 resistance past the ends (0 = hard stop). */
  rubberBand: number;
  maxVelocity: number;
  snapDuration: number;
  /** Rows before the target where the coast hands off to the spring. Larger = more spring character. */
  handoff: number;
  /** How hard the row pulls the wheel in at the end of a throw (≥ 1; 1 = pure glide). */
  magnet: number;
}

export type PresetName = 'ios' | 'scroll' | 'snappy' | 'heavy' | 'elastic' | 'linear';

const s = (stiffness: number, zeta: number, mass = 1): SpringConfig => ({
  stiffness,
  damping: dampingFor(zeta, stiffness, mass),
  mass,
});

/**
 * The default: a picker that feels like iOS. Heavier than a scroll view (between UIScrollView's .fast 0.99
 * and .normal 0.998 deceleration), with a slightly underdamped settle.
 */
export const ios: Physics = {
  decay: 0.995,
  spring: s(450, 0.85),
  rubberBand: 1,
  maxVelocity: 8,
  snapDuration: 900,
  handoff: 1,
  magnet: 1.1,
};

/** Tuned bundles. Pass one as `preset` (e.g. `preset: presets.snappy`); unused ones are tree-shaken. */
export const presets: Record<PresetName, Physics> = /* @__PURE__ */ (() => ({
  ios,
  /** UIScrollView .normal deceleration: long, list-like glides. */
  scroll: {
    decay: 0.998,
    spring: s(450, 0.85),
    rubberBand: 1,
    maxVelocity: 8,
    snapDuration: 900,
    handoff: 1,
    magnet: 1.1,
  },
  snappy: {
    decay: 0.993,
    spring: s(600, 0.85),
    rubberBand: 0.8,
    maxVelocity: 7,
    snapDuration: 500,
    handoff: 0.5,
    magnet: 1.6,
  },
  heavy: {
    decay: 0.9985,
    spring: s(140, 1, 1.6),
    rubberBand: 0.6,
    maxVelocity: 5,
    snapDuration: 1200,
    handoff: 0.5,
    magnet: 1,
  },
  elastic: {
    decay: 0.998,
    spring: s(220, 0.55),
    rubberBand: 1,
    maxVelocity: 8,
    snapDuration: 1400,
    handoff: 2,
    magnet: 100,
  },
  linear: {
    decay: 0.99,
    spring: s(500, 1),
    rubberBand: 0.4,
    maxVelocity: 6,
    snapDuration: 300,
    handoff: 0.5,
    magnet: 3,
  },
}))();

// ── src/engine/engine.ts (the wheel and trackpad reading) ───────────────────

/**
 * How the mouse wheel and trackpad drive the wheel.
 * - `'auto'` (default): each gesture is read from its first event. A notched mouse wheel steps one row per notch
 *   (`wheelStep`); its fast, accelerated bursts become velocity instead, so the wheel moves continuously while they
 *   come and coasts briefly (≈200 ms) once they stop. A trackpad is followed 1:1, momentum included.
 * - `'step'`: every wheel event is a notch: `wheelStep` rows (a page for page-mode deltas), whatever its size.
 *   Never a throw; a fast spin is one row per event.
 * - `'smooth'`: every delta is followed 1:1 in pixels, like native scrolling, mouse wheels included.
 * In every mode the wheel comes to rest on a row once the events stop.
 */
export type WheelMode = 'auto' | 'step' | 'smooth';

/** ms without wheel events that ends a wheel gesture. */
export const WHEEL_IDLE = 80;
/** Rows per px of accelerated mouse-wheel delta (macOS deltas are document pixels, far larger than rows). */
export const WHEEL_GAIN = 0.005;
/** Coast retention for mouse-wheel flings (τ ≈ 200ms): a short, natural glide after the wheel stops. */
export const WHEEL_DECAY = 0.995;

/** The fields of a WheelEvent the reader looks at (`wheelDeltaX/Y` are the legacy, non-standard pair). */
export interface WheelSample {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  timeStamp: number;
  wheelDeltaX?: number;
  wheelDeltaY?: number;
}

export interface WheelReaderOptions {
  orientation?: 'vertical' | 'horizontal';
  /** Right-to-left: horizontal deltas map to the wheel reversed. */
  rtl?: boolean;
  wheelMode?: WheelMode;
  /**
   * Whether a notched mouse wheel turning on the other axis (a plain vertical wheel over a
   * horizontal control) drives the control. Upstream: always. Default true.
   */
  crossAxisNotches?: boolean;
}

/**
 * What one wheel event asks for. `ignore`: not this control's gesture, leave the event to the
 * page (no preventDefault). Every other kind means the caller should preventDefault.
 * - `step`: a notch. Move `direction` rows by the caller's wheel step, or a page when `page`
 *   (deltaMode 2). Repeated notches accumulate on the target.
 * - `burst`: an accelerated mouse-wheel burst. `rate` is the smoothed wheel speed in px/ms;
 *   turn it into a velocity with `burstVelocity()` and fling with `WHEEL_DECAY`.
 * - `follow`: a trackpad (or a smooth wheel). Move the position by `delta` px, 1:1, and plan a
 *   release once `WHEEL_IDLE` ms pass with no events.
 */
export type WheelRead =
  | { kind: 'ignore' }
  | { kind: 'step'; direction: 1 | -1; page: boolean }
  | { kind: 'burst'; direction: 1 | -1; rate: number }
  | { kind: 'follow'; delta: number };

export interface WheelReader {
  read(e: WheelSample): WheelRead;
  /** Forget the current gesture (for instance when a pointer grabs the control). */
  reset(): void;
}

/**
 * A wheel *gesture* is a run of events with gaps < WHEEL_IDLE, classified once from its first event:
 * - mouse (notches): it starts with a whole notch. macOS reports 12–13px per notch (and wheelDelta = −3 ×
 *   delta, exactly like a trackpad, so that signal can't tell them apart); Windows 100px with wheelDelta
 *   ±120; Firefox uses line mode. Trackpads always start at 1–3px, because fingers start slowly.
 * - ours or the page's: its dominant axis must match the wheel's (mouse notches always drive the wheel,
 *   unless `crossAxisNotches` is false).
 */
export function wheelReader(options: WheelReaderOptions = {}): WheelReader {
  let wheelAt = -1e9;
  let notched = false;
  /** wheelMode 'step': every event is one notch, whatever its size (never a throw). */
  let stepping = false;
  let ours = false;
  let rate = 0;
  const IGNORE: WheelRead = { kind: 'ignore' };

  return {
    reset() {
      wheelAt = -1e9;
      rate = 0;
    },
    read(e) {
      const h = options.orientation === 'horizontal';
      const sign = options.rtl && h ? -1 : 1;
      const x = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const d = x ? e.deltaX : e.deltaY;
      if (!d) return IGNORE;
      const a = Math.abs(d);
      const wd = x ? e.wheelDeltaX : e.wheelDeltaY;
      const classic = e.deltaMode !== 0 || (!!wd && wd % 120 === 0 && wd !== -3 * d); // line mode, or Windows-style
      const gap = e.timeStamp - wheelAt;
      if (gap > WHEEL_IDLE) {
        const wm = options.wheelMode ?? 'auto';
        stepping = wm === 'step';
        notched = stepping || (wm === 'auto' && (classic || a >= 10));
        // A plain mouse wheel (vertical notches) also drives horizontal wheels.
        ours = (notched && options.crossAxisNotches !== false) || x === h;
        rate = 0;
      }
      wheelAt = e.timeStamp;
      if (!ours) return IGNORE; // a vertical trackpad gesture over a horizontal wheel scrolls the page
      // Horizontal deltas follow screen direction (mirrored in RTL); vertical notches mean "next".
      const delta = x ? d * sign : d;
      const direction: 1 | -1 = delta < 0 ? -1 : 1;
      if (notched) {
        // One notch, one row (repeated notches accumulate on the target).
        if (classic || a < 50 || stepping)
          return { kind: 'step', direction, page: e.deltaMode === 2 };
        // An accelerated burst (macOS: 100–1800px every ~15ms when the wheel spins fast or free): following those
        // pixels would teleport dozens of rows per event. Turn the wheel's rate into velocity instead, and let the
        // physics glide and land, with a shorter coast than a throw (when the mouse wheel stops, so should we).
        const r = a / Math.max(8, Math.min(100, gap));
        rate = rate ? rate + (r - rate) * 0.5 : r;
        return { kind: 'burst', direction, rate };
      }
      // Smooth (trackpad, incl. OS momentum): follow it 1:1 along our axis only (a two-finger swipe always
      // carries some cross-axis motion, which must not leak in), settle once it goes quiet.
      return { kind: 'follow', delta: h ? e.deltaX * sign : e.deltaY };
    },
  };
}

/**
 * The velocity (px/ms) an accelerated burst asks for, blended with the current velocity `v` when
 * both point the same way. `size` is the row size in px; `maxVelocity` the physics cap.
 */
export function burstVelocity(
  rate: number,
  direction: number,
  v: number,
  size: number,
  maxVelocity: number
): number {
  const target = Math.sign(direction) * Math.min(maxVelocity, WHEEL_GAIN * rate * size);
  return v * target > 0 ? v + (target - v) * 0.5 : target;
}
