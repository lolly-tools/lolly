// SPDX-License-Identifier: MPL-2.0
/**
 * Dash fitting: manual dash entry, and Illustrator-style corner-fit dashes (plan 96).
 *
 * Two things a stroked path needs that a plain `stroke-dasharray` cannot give you:
 *
 * 1. **Manual entry** (`parseDashArray`). A power user types `6 4` / `6,4,2,4` and gets a
 *    canonical, even-length array of NUMBERS. Numbers only: that is the injection-safety
 *    contract: nothing here ever returns the user's string, so a pack hook can refuse raw
 *    text on `stroke-dasharray` and serialize this array itself.
 * 2. **Corner fit** (`cornerFitDashArray` / `dashSegments`). Illustrator's "align dashes to
 *    corners and path ends": the pattern is grown or shrunk SLIGHTLY, per span, so a dash
 *    lands centred on every corner instead of a gap swallowing it. A span is a
 *    corner-to-corner stretch of the path. For a closed shape, every corner including the
 *    closing one; for an open one, the first and last points count as span boundaries too.
 *
 * Both fit entry points run the SAME per-span solver (`planSpan`) over the SAME assembled
 * run list (`fitRuns`), so the dasharray a live preview sets and the real `<line>` segments
 * the committed/export render draws (plan 96's invariant: never `stroke-dasharray` in the
 * committed output) describe the same ink, to 2dp.
 *
 * DOM-free and pure, like the rest of the connector geometry it sits beside.
 *
 * ── the per-span layout ──────────────────────────────────────────────────────────
 * A span of length `L`, pattern `p` (dash, gap, dash, gap, …), `cycle = Σp`:
 *
 *   [d₀/2] [p₁ … p_{k-1}] [d₀] [p₁ … p_{k-1}] [d₀] … [p₁ … p_{k-1}] [d₀/2]
 *   └ half a dash at each END of the span, so the two halves either side of a corner
 *     join into ONE full dash centred exactly on it (a closed path's wrap-around start
 *     joins the same way: the array's first and last entries are both dashes).
 *
 * That layout is exactly `n · cycle` long unscaled, so the fit is a single scale
 * `s = L / (n · cycle)` with `n = max(1, round(L / cycle))`: the whole-cycle count
 * nearest to the span. Out of the [minScale, maxScale] band the span falls back to the
 * UNSCALED pattern, tiled from its start and cut at `L`: a 2px stub cannot be allowed to
 * mint a 2px dash pattern out of a 10px one.
 *
 * NOTE (deviation from the drafted spec, deliberate): `n` is `round(L / cycle)`, not
 * `round((L − d₀) / cycle)`. The half-dashes at the two ends are the two halves of ONE
 * dash, already counted inside the `n` cycles. Subtracting `d₀` again biases every span
 * to stretch (a span that already fits the pattern EXACTLY would be stretched by
 * `d₀/cycle`, e.g. +11% for `6 4`), and it pushes ordinary spans past `maxScale` into the
 * unscaled fallback (16 units of a 10-unit cycle would want s=1.6 and give up, instead of
 * fitting 2 cycles at s=0.8). With `round(L / cycle)` the scale lands in [0.75, 1.5) for
 * any span at least half a cycle long, which is precisely what the drafted 0.66/1.5
 * defaults describe, and a span that is already a whole number of cycles is left ALONE
 * at s = 1.
 */

/** A dash interval in absolute distance along the path, in native px (2dp). */
export interface DashSegment { start: number; end: number }

/** Scale band for the per-span corner fit. Outside it, the span keeps the authored pattern. */
export interface DashFitOpts {
  /** Most the pattern may shrink, default 0.66. Clamped into (0, 1]; s = 1 always fits. */
  minScale?: number;
  /** Most the pattern may grow, default 1.5. Clamped into [1, 16]. */
  maxScale?: number;
}

/** Manual entry: at most this many numbers may be typed (before the odd-list doubling). */
const MAX_ENTRIES = 16;
/** Manual entry: each value is a length in px, bounded so one field cannot mint a mile. */
const MAX_VALUE = 1000;
/** Manual entry: bound the scan before it is split (a text field, not a document). */
const MAX_TEXT = 200;
/** A programmatic pattern may already be a doubled odd list; allow for it, then stop. */
const MAX_PATTERN = 32;
/** Hard cap on emitted runs: a sub-pixel cycle over a huge path must not build a million. */
const MAX_RUNS = 4096;
const EPS = 1e-9;

/** 2dp: the same coordinate precision the connector geometry emits. */
const r2 = (v: number): number => Math.round(v * 100) / 100;
const numOr = (v: unknown, d: number): number => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);
/** Strict decimal: no sign, no exponent, no units, no hex. Anything else is not a length. */
const DASH_NUM_RE = /^(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * Parse a user-typed dash string into a canonical dash array, or `null` when it is not one.
 *
 * Accepts non-negative decimals separated by whitespace and/or commas (`6 4`, `6,4`,
 * `6, 4, 2, 4`); stray separators at either end are ignored. At most {@link MAX_ENTRIES}
 * numbers, each `0…1000`, at least one greater than zero. An ODD-length list is doubled,
 * the SVG rule ("the list is repeated to yield an even number of values"), applied HERE so
 * what comes back is already canonical and no caller has to know it.
 *
 * Returns NUMBERS ONLY: this is the injection boundary. A caller must never put the user's
 * text on an attribute; it serializes this array.
 */
export function parseDashArray(text: string): number[] | null {
  if (typeof text !== 'string') return null;
  const t = text.trim().replace(/^[,\s]+/, '').replace(/[,\s]+$/, '');
  if (!t || t.length > MAX_TEXT) return null;
  const parts = t.split(/[\s,]+/);
  if (parts.length > MAX_ENTRIES) return null;
  const out: number[] = [];
  for (const p of parts) {
    if (!DASH_NUM_RE.test(p)) return null;
    const n = Number(p);
    if (!Number.isFinite(n) || n < 0 || n > MAX_VALUE) return null;
    out.push(n);
  }
  if (!out.length || !out.some((v) => v > 0)) return null;
  if (out.length % 2 === 1) out.push(...out.slice());
  return out;
}

/** Sanitise a caller-supplied pattern: even length, finite, non-negative. `null` = solid. */
function normPattern(pattern: readonly number[]): number[] | null {
  if (!Array.isArray(pattern) || pattern.length === 0) return null;
  // A bad entry becomes 0 rather than being dropped: dropping one would swap every
  // following dash and gap.
  const out = pattern.slice(0, MAX_PATTERN).map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_VALUE) : 0;
  });
  if (out.length % 2 === 1) out.push(...out.slice());
  let sum = 0;
  for (const v of out) sum += v;
  return sum > EPS ? out : null;
}

/**
 * The per-span solver: the ONE place the corner-fit maths lives, shared by
 * `cornerFitDashArray` and `dashSegments`. Emits alternating run lengths (DASH first)
 * for one span, plus how much of the span they actually cover (less than `L` only when
 * the run budget ran out mid-span).
 */
function planSpan(
  L: number, pat: number[], cycle: number, minScale: number, maxScale: number, budget: number,
): { runs: number[]; covered: number } {
  const k = pat.length, d0 = pat[0]!;
  const n = Math.max(1, Math.round(L / cycle));
  const s = L / (n * cycle);
  if (s >= minScale && s <= maxScale && n * k + 1 <= budget) {
    const runs: number[] = [(d0 * s) / 2];
    for (let c = 0; c < n; c++) {
      if (c > 0) runs.push(d0 * s);                       // the full dash ON an interior cycle mark
      for (let i = 1; i < k; i++) runs.push(pat[i]! * s); // the rest of the cycle: gap, dash, … gap
    }
    runs.push((d0 * s) / 2);
    return { runs, covered: L };
  }
  // Out of band (or out of budget): the authored pattern, tiled from the span start and
  // cut at its end. Exact dash lengths, no corner guarantee: the honest fallback.
  const runs: number[] = [];
  let pos = 0, i = 0;
  while (pos < L - EPS && runs.length < budget) {
    const seg = Math.min(pat[i % k]!, L - pos);
    runs.push(seg);
    pos += seg;
    i++;
  }
  return { runs, covered: pos };
}

/** Append one span's runs, MERGING a dash that meets a dash across the corner. */
function appendRuns(out: number[], runs: number[]): void {
  if (!runs.length) return;
  if (out.length % 2 === 1) {           // odd length ⇒ `out` ends on a dash
    out[out.length - 1]! += runs[0]!;   // the two half-dashes become the corner's whole one
    for (let i = 1; i < runs.length; i++) out.push(runs[i]!);
    return;
  }
  for (const r of runs) out.push(r);
}

/**
 * Quantise to 2dp along CUMULATIVE positions, not per run: rounding each run
 * independently would let the error accumulate over thousands of entries and drift the
 * array off the end of the path. Differencing rounded positions bounds the total error at
 * half a hundredth, whatever the count, and every emitted number is still a clean 2dp one.
 */
function quantise(runs: number[]): number[] {
  const out: number[] = [];
  let pos = 0, prev = 0;
  for (const r of runs) {
    pos += r;
    const p = r2(pos);
    out.push(r2(p - prev));
    prev = p;
  }
  return out;
}

/**
 * The whole path's dash runs (dash first, alternating, even length, summing to the path
 * length). The single assembly both public entry points read.
 */
function fitRuns(spanLengths: readonly number[], pattern: readonly number[], opts?: DashFitOpts): number[] {
  const spans = (Array.isArray(spanLengths) ? spanLengths : []).map((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  let total = 0;
  for (const L of spans) total += L;
  if (!(total > EPS)) return [];
  const pat = normPattern(pattern);
  if (!pat) return [r2(total), 0];      // no usable pattern → one solid run, still even-length
  let cycle = 0;
  for (const v of pat) cycle += v;
  const minScale = clamp(numOr(opts?.minScale, 0.66), 0.01, 1);
  const maxScale = clamp(numOr(opts?.maxScale, 1.5), 1, 16);

  const out: number[] = [];
  let covered = 0;
  const budget = MAX_RUNS - 2;          // two held back for the uncovered-tail gap below
  for (const L of spans) {
    if (!(L > EPS)) continue;           // a zero-length span merges its two corners
    if (out.length >= budget) break;
    const span = planSpan(L, pat, cycle, minScale, maxScale, budget - out.length);
    appendRuns(out, span.runs);
    covered += span.covered;
    if (span.covered < L - EPS) break;  // budget ran out mid-span
  }
  // Anything the budget left uncovered stays blank, emitted as ONE gap, so the array still
  // spans the whole path and the renderer never wraps the pattern back to the start.
  const rest = total - covered;
  if (rest > EPS) {
    if (out.length % 2 === 0) out.push(0);
    out.push(rest);
  }
  if (out.length % 2 === 1) out.push(0);  // end on a gap: even length, as SVG wants
  return quantise(out);
}

/**
 * Illustrator-style corner fit as ONE explicit dash array for the WHOLE path: every span
 * scaled so a dash sits centred on each of its ends, concatenated (corner dashes merged),
 * even-length, and summing to exactly the path length so nothing ever cycles.
 *
 * `spanLengths` is the path's corner-to-corner run lengths in order. For a closed path
 * include the closing span, and the array's leading and trailing dashes then join at the
 * start point exactly as they do at every other corner. An empty/zero-length path yields
 * `[]`; a pattern with no ink yields a single solid run.
 */
export function cornerFitDashArray(
  spanLengths: readonly number[], pattern: readonly number[], opts?: DashFitOpts,
): number[] {
  return fitRuns(spanLengths, pattern, opts);
}

/**
 * The SAME fit, as absolute `[start, end]` dash intervals along the path: what the
 * committed/export render draws as real geometry (plan 96: never `stroke-dasharray` in the
 * committed output). Zero-length dashes are omitted; total inked length matches
 * {@link cornerFitDashArray}'s dash entries exactly, because both read one assembly.
 */
export function dashSegments(
  spanLengths: readonly number[], pattern: readonly number[], opts?: DashFitOpts,
): DashSegment[] {
  const runs = fitRuns(spanLengths, pattern, opts);
  const out: DashSegment[] = [];
  let pos = 0;
  for (let i = 0; i < runs.length; i++) {
    const len = runs[i]!;
    if (i % 2 === 0 && len > EPS) out.push({ start: r2(pos), end: r2(pos + len) });
    pos = r2(pos + len);
  }
  return out;
}
