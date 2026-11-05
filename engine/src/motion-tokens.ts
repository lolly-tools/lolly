// SPDX-License-Identifier: MPL-2.0
/**
 * A design system's motion tokens (plans/329): the durations, curves and springs a brand
 * names, read from a resolved DTCG token set into what Sequence can use.
 *
 * - `duration` tokens: `"200ms"`, `"0.2s"`, a number of ms, or DTCG's `{ value, unit }`.
 * - `cubicBezier` tokens: `[x1, y1, x2, y2]`, x inside 0..1.
 * - `transition` tokens: the `timingFunction` is the curve; the `duration` is kept as a
 *   hint next to the curve, never applied to keyframe times.
 * - Springs. DTCG has no spring type, so a spring rides the Lolly extension key on any
 *   token: `$extensions["com.suse.lolly"].spring = { stiffness, damping, mass }`, or
 *   `{ stiffness, dampingRatio, mass }` (damping = ratio × 2√(stiffness × mass)), mass 1
 *   when absent. The recommended host is a `transition` token whose `$value` carries a
 *   bezier approximation, so a tool that does not know springs still gets a curve.
 *
 * A curve or spring can be BOUND by a keyframe only when its path fits the kf wire
 * (`et(<path>)`: dot-separated letters, digits and hyphens, at most 64 characters).
 * Others are left out of the list rather than offered and silently broken.
 */
import type { HostV1, TokenEntry } from './bridge/host-v1.ts';
import { TOKEN_EXT } from './token-ext.ts';
import { kfBindEase, kfEaseToken } from './keyframes.ts';
import { kfSpring, kfSpringToken } from './kf-spring.ts';

/** One curve or spring the design system names. */
export interface MotionCurveToken {
  /** The token path, e.g. `motion.curve.standard`. */
  path: string;
  /** A readable name from the path's last segment, e.g. `Standard`. */
  label: string;
  kind: 'curve' | 'spring';
  /** The concrete kf ease it plays: a preset, an `eb(...)` or an `esp(...)`. */
  ease: string;
  /** A transition token's own duration, ms, shown as a hint. Null when it has none. */
  durationMs: number | null;
  description: string | null;
}

/** One duration the design system names. */
export interface MotionDurationToken {
  path: string;
  label: string;
  ms: number;
  description: string | null;
}

export interface MotionTokens {
  curves: MotionCurveToken[];
  durations: MotionDurationToken[];
}

const EMPTY = (): MotionTokens => ({ curves: [], durations: [] });

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function label(path: string): string {
  const leaf = path.split('.').pop() ?? path;
  return leaf.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, (c) => c.toUpperCase());
}

/** A DTCG duration as ms, or null. Accepts `"200ms"`, `"0.2s"`, a number (ms) and `{ value, unit }`. */
export function motionDurationMs(value: unknown): number | null {
  let n: number | null = null;
  let unit = 'ms';
  if (finite(value)) n = value;
  else if (typeof value === 'string') {
    const m = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(ms|s)\s*$/i.exec(value);
    if (m) { n = Number(m[1]); unit = (m[2] ?? 'ms').toLowerCase(); }
  } else if (isRecord(value) && finite(value.value) && (value.unit === 'ms' || value.unit === 's')) {
    n = value.value; unit = value.unit;
  }
  if (n === null || !(n >= 0)) return null;
  const ms = unit === 's' ? n * 1000 : n;
  return Number.isFinite(ms) && ms <= 3_600_000 ? Math.round(ms * 100) / 100 : null;
}

/** A `cubicBezier` value as a kf ease, or null when it is not a usable curve. */
function bezierEase(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every(finite)) return null;
  const [x1, y1, x2, y2] = value as [number, number, number, number];
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) return null;
  return kfEaseToken(`cubic-bezier(${x1},${y1},${x2},${y2})`);
}

/** The spring a token's Lolly extension declares, as a kf ease, or null. */
function springEase(ext: Record<string, unknown> | null): string | null {
  const own = ext?.[TOKEN_EXT];
  const sp = isRecord(own) ? own.spring : null;
  if (!isRecord(sp) || !finite(sp.stiffness) || !(sp.stiffness > 0)) return null;
  const mass = finite(sp.mass) && sp.mass > 0 ? sp.mass : 1;
  let damping: number | null = null;
  if (finite(sp.damping) && sp.damping >= 0) damping = sp.damping;
  else if (finite(sp.dampingRatio) && sp.dampingRatio >= 0) damping = sp.dampingRatio * 2 * Math.sqrt(sp.stiffness * mass);
  if (damping === null) return null;
  return kfSpringToken(kfSpring(sp.stiffness, damping, mass));
}

/** True when a path can be written in a bound ease. */
function bindable(path: string): boolean {
  return kfBindEase(path) !== null;
}

/** Read a resolved token set's motion tokens, in document order. */
export function readMotionTokens(set: { query(filter?: { type?: string }): TokenEntry[] } | null | undefined): MotionTokens {
  if (!set || typeof set.query !== 'function') return EMPTY();
  let entries: TokenEntry[];
  try { entries = set.query(); } catch { return EMPTY(); }
  const curves: MotionCurveToken[] = [];
  const durations: MotionDurationToken[] = [];
  for (const e of entries) {
    if (!e || typeof e.path !== 'string') continue;
    const description = typeof e.description === 'string' ? e.description : null;
    const spring = springEase(e.extensions);
    const transition = e.type === 'transition' && isRecord(e.value) ? e.value : null;
    if (spring || e.type === 'cubicBezier' || transition) {
      const ease = spring ?? (transition ? bezierEase(transition.timingFunction) : bezierEase(e.value));
      if (!ease || !bindable(e.path)) continue;
      curves.push({
        path: e.path, label: label(e.path), kind: spring ? 'spring' : 'curve', ease,
        durationMs: transition ? motionDurationMs(transition.duration) : null, description,
      });
      continue;
    }
    if (e.type === 'duration') {
      const ms = motionDurationMs(e.value);
      if (ms !== null) durations.push({ path: e.path, label: label(e.path), ms, description });
    }
  }
  return { curves, durations };
}

/** The bindable curves and springs as path → ease, the map `setKfEaseTokens` installs. */
export function motionEaseMap(tokens: MotionTokens): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of tokens.curves) out[c.path] = c.ease;
  return out;
}

/**
 * The host's motion tokens, or null when the host has no token API (so a caller can keep
 * whatever is installed rather than clearing the table). A read that fails counts as no tokens.
 */
export async function readHostMotionTokens(host: Pick<HostV1, 'tokens'>): Promise<MotionTokens | null> {
  const api = host.tokens;
  if (!api || typeof api.get !== 'function') return null;
  try { return readMotionTokens(await api.get()); } catch { return EMPTY(); }
}
