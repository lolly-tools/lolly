// SPDX-License-Identifier: MPL-2.0
/**
 * PDF shading colour sampling + the ShadingType 1 (function-based) classifier.
 *
 * The SHELL half of gradient import. The pure engine never evaluates a PDF
 * /Function and never sees a PostScript program - it receives a pre-sampled colour
 * ramp, a flat colour, or an opaque raster-tile key. Everything that decides WHICH
 * of those three a shading becomes lives here.
 *
 * Why a classifier at all: Chromium's print backend does not emit an axial shading
 * for a CSS `oklch()` colour, a `conic-gradient()` or a wide-gamut interpolated
 * gradient. It emits a **ShadingType 1** - a colour function over a 2-D domain
 * rectangle (PDF 32000-1 section 8.7.4.5.3) - usually driven by a FunctionType 4
 * PostScript calculator. Most of those are not actually 2-D:
 *
 *   rung 1 "flat"      the function is CONSTANT. Chromium routes a solid `oklch()`
 *                      through this machinery because the colour is out of sRGB,
 *                      not because it varies. Emits one hex colour, no shading.
 *                      This is the rung that recovers a wall of palette swatches.
 *   rung 2 "axialised" the function is near-linear in (u,v). Re-expressed as an
 *                      ordinary ShadingType 2 along the fitted direction - real
 *                      vector output, no raster. This recovers slider tracks.
 *   rung 3 "tiled"     genuinely 2-D (a hue wheel). Keeps the domain + a tile key
 *                      the caller rasterises, AND an area-weighted mean colour as
 *                      the back-stop if it can't.
 *
 * No radial rung: a function-based RADIAL field is not something Chromium emits (a
 * real CSS `radial-gradient` prints as ShadingType 3, which is already supported),
 * so guessing at one would buy a heuristic and its failure modes for no observed
 * input. Deliberately unbuilt.
 *
 * KNOWN LIMITATION - the thresholds below are tuned against one page. Too loose and
 * a real gradient silently flattens; the caller's `shading.type1.*` warning census
 * is the only detector, and a warning nobody reads is a weak defence.
 *
 * DOM-free and dependency-free, so it is directly unit-testable.
 */

import type { PdfGradientStop } from '../../../../engine/src/pdf-map.ts';

/** A parsed PDF function: input value(s) → colour components (each in [0,1]).
 *  Returns null when the function faulted (e.g. a Type 4 program that divided by
 *  zero) - a null must never be silently read as black. */
export type ColorFn = (...inputs: number[]) => number[] | null;

const chan = (v: number): number => Math.round((v < 0 ? 0 : v > 1 ? 1 : v) * 255);
const hex2 = (v: number): string => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v)).toString(16).padStart(2, '0');

/**
 * Shading colour components → 8-bit RGB, bucketed by component count
 * (1 = Gray, 4 = CMYK naive, else RGB).
 *
 * KNOWN LIMITATION: a /Separation, /Indexed, /Lab or /DeviceN shading produces a
 * CONFIDENTLY WRONG colour here rather than none - the component count can't tell
 * those apart from a device space. Narrow, and it is part of why the classifier's
 * warnings matter.
 */
export function componentsToRgb(vals: number[], comps: number): [number, number, number] | null {
  if (!Array.isArray(vals) || !vals.length || vals.some((v) => typeof v !== 'number' || !isFinite(v))) return null;
  if (comps === 1) { const g = chan(vals[0] ?? 0); return [g, g, g]; }
  if (comps === 4) {
    const c = vals[0] ?? 0, m = vals[1] ?? 0, y = vals[2] ?? 0, k = vals[3] ?? 0;
    return [chan((1 - c) * (1 - k)), chan((1 - m) * (1 - k)), chan((1 - y) * (1 - k))];
  }
  return [chan(vals[0] ?? 0), chan(vals[1] ?? 0), chan(vals[2] ?? 0)];
}

export function rgbToHex(rgb: [number, number, number]): string {
  return '#' + hex2(rgb[0]) + hex2(rgb[1]) + hex2(rgb[2]);
}

/** Shading colour components → #rrggbb, or '' when the function faulted. */
export function componentsToHex(vals: number[], comps: number): string {
  const rgb = componentsToRgb(vals, comps);
  return rgb ? rgbToHex(rgb) : '';
}

/** Uniformly sample a 1-D colour ramp into N+1 8-bit RGB triples, or null if any
 *  sample faulted (a partially-evaluable ramp is not one we should guess at). */
export function rampSamples(fn: (t: number) => number[] | null, comps: number, t0: number, t1: number, N = 16):
Array<[number, number, number]> | null {
  const span = (t1 - t0) || 1;
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i <= N; i++) {
    let vals: number[] | null;
    try { vals = fn(t0 + (span * i) / N); } catch { return null; }
    if (!vals) return null;
    const rgb = componentsToRgb(vals, comps);
    if (!rgb) return null;
    out.push(rgb);
  }
  return out;
}

/** Ramp samples → gradient stops: interior stops that add nothing (a flat run) are
 *  collapsed; the endpoints are always kept. SVG linearly interpolates between
 *  stops, so 17 uniform samples render a smooth gradient faithfully. */
export function collapseStops(ramp: Array<[number, number, number]>): PdfGradientStop[] {
  const raw = ramp.map((rgb, i) => ({ offset: i / (ramp.length - 1 || 1), color: rgbToHex(rgb) }));
  const out: PdfGradientStop[] = [];
  for (let i = 0; i < raw.length; i++) {
    const keep = i === 0 || i === raw.length - 1 || raw[i]!.color !== raw[i - 1]!.color || raw[i]!.color !== raw[i + 1]!.color;
    if (keep) out.push(raw[i]!);
  }
  return out;
}

/** Sample a 1-in colour function across its domain into gradient stops ([] on a
 *  fault, which the caller treats as "drop this shading"). */
export function sampleStops(fn: ColorFn, domain: number[], comps: number): PdfGradientStop[] {
  const ramp = rampSamples((t) => fn(t), comps, domain[0] ?? 0, domain[1] ?? 1);
  return ramp ? collapseStops(ramp) : [];
}

// ── ShadingType 1 classification ─────────────────────────────────────────────

/** The classifier's verdict. `flat` is populated on every successful rung - it is
 *  the last rung of the fidelity ladder and back-stops anything the serializer
 *  ultimately refuses to emit. */
export interface Type1Classification {
  rung: 'flat' | 'axial' | 'tiled' | 'failed';
  /** '' only when rung is 'failed'. */
  flat: string;
  /** rung 'axial' only: the fitted axis endpoints, in DOMAIN space (the shading's
   *  own coordinate system, which the shading /Matrix maps onward). */
  coords?: [number, number, number, number];
  /** rung 'axial' only. */
  stops?: PdfGradientStop[];
  /** Diagnostic: the worst per-channel residual of the axial fit, in 8-bit units.
   *  Undefined when the fit was never attempted. */
  axialResidual?: number;
}

// Thresholds, in 8-bit channel units. FLAT_SPREAD is post-quantisation on purpose:
// the emitter is 8-bit, so a difference smaller than this is one we could not have
// emitted anyway.
const FLAT_SPREAD = 2;
const AXIAL_MAX_RESID = 4;
const AXIAL_MEAN_RESID = 2;

// 17×17 on the domain, plus a 16×16 mid-cell offset pass. The offset pass exists
// specifically to REDUCE - not eliminate - the risk that a periodic field reads as
// constant on the primary grid. 545 evaluations, sub-millisecond.
const GRID = 16;

interface Sample { p: number; q: number; rgb: [number, number, number]; }

/**
 * Classify a function-based (ShadingType 1) colour field.
 * @param evaluate (u,v) in DOMAIN space → colour components in [0,1].
 * @param comps    colour-space component count.
 * @param domain   [x0, x1, y0, y1] (PDF 32000-1 Table 78 ordering).
 */
export function classifyFunctionShading(
  evaluate: ColorFn,
  comps: number,
  domain: [number, number, number, number],
): Type1Classification {
  const [x0, x1, y0, y1] = domain;
  const dx = x1 - x0, dy = y1 - y0;
  if (![x0, x1, y0, y1].every((v) => typeof v === 'number' && isFinite(v))) return { rung: 'failed', flat: '' };

  const at = (p: number, q: number): [number, number, number] | null => {
    let vals: number[] | null;
    try { vals = evaluate(x0 + dx * p, y0 + dy * q); } catch { return null; }
    return vals ? componentsToRgb(vals, comps) : null;
  };

  const samples: Sample[] = [];
  for (let i = 0; i <= GRID; i++) {
    for (let j = 0; j <= GRID; j++) {
      const p = i / GRID, q = j / GRID;
      const rgb = at(p, q);
      if (rgb) samples.push({ p, q, rgb });
    }
  }
  for (let i = 0; i < GRID; i++) {
    for (let j = 0; j < GRID; j++) {
      const p = (i + 0.5) / GRID, q = (j + 0.5) / GRID;
      const rgb = at(p, q);
      if (rgb) samples.push({ p, q, rgb });
    }
  }
  // A field we can only partially evaluate is one we should not guess at.
  if (samples.length < ((GRID + 1) * (GRID + 1)) * 0.8) return { rung: 'failed', flat: '' };

  // ── rung 1: constant ───────────────────────────────────────────────────────
  const lo: [number, number, number] = [255, 255, 255];
  const hi: [number, number, number] = [0, 0, 0];
  const sum: [number, number, number] = [0, 0, 0];
  for (const s of samples) {
    for (let c = 0; c < 3; c++) {
      const v = s.rgb[c]!;
      if (v < lo[c]!) lo[c] = v;
      if (v > hi[c]!) hi[c] = v;
      sum[c] = sum[c]! + v;
    }
  }
  const mean: [number, number, number] = [sum[0] / samples.length, sum[1] / samples.length, sum[2] / samples.length];
  const meanHex = rgbToHex(mean);
  const spread = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
  if (spread <= FLAT_SPREAD) {
    const centre = at(0.5, 0.5);
    return { rung: 'flat', flat: centre ? rgbToHex(centre) : meanHex };
  }

  // ── rung 2: near-linear in (u,v) → an axial shading ───────────────────────
  // Least-squares fit c ≈ a·p + b·q + k per channel over the whole grid, then take
  // the summed principal direction (summed with each channel's gradient SIGN-ALIGNED
  // to the strongest channel's, so a field where R rises with u while B falls still
  // yields one coherent axis rather than a cancelled-out one).
  const fit = fitPlanes(samples);
  if (fit) {
    const { grads } = fit;
    let ref = 0;
    for (let c = 1; c < 3; c++) if (mag(grads[c]!) > mag(grads[ref]!)) ref = c;
    let dxs = 0, dys = 0;
    for (let c = 0; c < 3; c++) {
      const g = grads[c]!;
      const sign = (g[0] * grads[ref]![0] + g[1] * grads[ref]![1]) < 0 ? -1 : 1;
      dxs += sign * g[0]; dys += sign * g[1];
    }
    const dmag = Math.hypot(dxs, dys);
    if (dmag > 1e-9) {
      const ux = dxs / dmag, uy = dys / dmag;
      let tmin = Infinity, tmax = -Infinity;
      for (const s of samples) {
        const t = s.p * ux + s.q * uy;
        if (t < tmin) tmin = t;
        if (t > tmax) tmax = t;
      }
      if (tmax - tmin > 1e-9) {
        // The axis: the line through the grid centroid along d̂, cut to the extent
        // the samples actually span. Its endpoints may land OUTSIDE the domain rect
        // (they do for any oblique direction, since a segment of the projected
        // extent along d̂ need not fit inside the box) - which is fine for an SVG
        // gradient axis, but means we must NOT evaluate the function there: a real
        // PDF function clamps its inputs to /Domain, so sampling off the edge would
        // return a plateau and the fit would reject its own gradient. So the ramp
        // is built by BINNING the grid samples we already have along t instead.
        const tm = 0.5 * ux + 0.5 * uy;
        const Ap = 0.5 + (tmin - tm) * ux, Aq = 0.5 + (tmin - tm) * uy;
        const Bp = 0.5 + (tmax - tm) * ux, Bq = 0.5 + (tmax - tm) * uy;
        const ramp = binRamp(samples, ux, uy, tmin, tmax);
        if (ramp) {
          let worst = 0, total = 0;
          for (const s of samples) {
            const t = ((s.p * ux + s.q * uy) - tmin) / (tmax - tmin);
            const pred = rampAt(ramp, t);
            for (let c = 0; c < 3; c++) {
              const e = Math.abs(pred[c]! - s.rgb[c]!);
              if (e > worst) worst = e;
              total += e;
            }
          }
          const meanResid = total / (samples.length * 3);
          if (worst <= AXIAL_MAX_RESID && meanResid <= AXIAL_MEAN_RESID) {
            return {
              rung: 'axial',
              flat: meanHex,
              coords: [x0 + dx * Ap, y0 + dy * Aq, x0 + dx * Bp, y0 + dy * Bq],
              stops: collapseStops(ramp),
              axialResidual: worst,
            };
          }
          return { rung: 'tiled', flat: meanHex, axialResidual: worst };
        }
      }
    }
  }

  // ── rung 3: irreducibly 2-D ────────────────────────────────────────────────
  return { rung: 'tiled', flat: meanHex };
}

function mag(g: [number, number]): number { return Math.hypot(g[0], g[1]); }

/**
 * Reconstruct a 17-entry colour ramp from the grid samples, indexed by their
 * projection onto d̂. Each ramp node is a LOCAL LINEAR REGRESSION over the samples
 * within ±1 node of it, not a bucket average.
 *
 * The distinction matters and is not cosmetic: the offset sampling pass lands
 * samples exactly half-way between nodes, so bucket averaging biases every node by
 * half a step - ~8/255 on a full black→white ramp, which is twice the axial
 * residual threshold. A textbook gradient would then be rejected as "irreducibly
 * 2-D" and rasterised. Local linear regression is unbiased for a linear field
 * including at the two end nodes, where a one-sided window would otherwise skew.
 */
function binRamp(samples: Sample[], ux: number, uy: number, tmin: number, tmax: number):
Array<[number, number, number]> | null {
  const NB = 16;
  const buckets: Array<Array<{ d: number; rgb: [number, number, number] }>> =
    Array.from({ length: NB + 1 }, () => []);
  for (const s of samples) {
    const x = (((s.p * ux + s.q * uy) - tmin) / (tmax - tmin)) * NB;
    // Deposit into every node whose ±1 window contains this sample.
    for (let i = Math.max(0, Math.ceil(x - 1)); i <= Math.min(NB, Math.floor(x + 1)); i++) {
      buckets[i]!.push({ d: x - i, rgb: s.rgb });
    }
  }
  const out: Array<[number, number, number]> = [];
  for (let i = 0; i <= NB; i++) {
    const b = buckets[i]!;
    if (!b.length) return null;   // a hole in the projection: not a clean axis
    let Sd = 0, Sdd = 0;
    for (const s of b) { Sd += s.d; Sdd += s.d * s.d; }
    const n = b.length;
    const det = n * Sdd - Sd * Sd;
    const node: [number, number, number] = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      let Sc = 0, Scd = 0;
      for (const s of b) { Sc += s.rgb[c]!; Scd += s.rgb[c]! * s.d; }
      // The intercept of c ≈ a + b·d is the value AT the node; fall back to the
      // plain mean when the window has no spread to fit against.
      node[c] = Math.abs(det) < 1e-9 ? Sc / n : (Sc * Sdd - Scd * Sd) / det;
    }
    out.push(node);
  }
  return out;
}

/** Linear lookup into a uniform 0..1 ramp. */
function rampAt(ramp: Array<[number, number, number]>, t: number): [number, number, number] {
  const n = ramp.length - 1;
  const x = (t < 0 ? 0 : t > 1 ? 1 : t) * n;
  const i0 = Math.floor(x), i1 = Math.min(n, i0 + 1), f = x - i0;
  const a = ramp[i0]!, b = ramp[i1]!;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

/** Least-squares plane fit per channel: c ≈ a·p + b·q + k. Returns each channel's
 *  gradient (a, b); null if the normal equations are singular. */
function fitPlanes(samples: Sample[]): { grads: Array<[number, number]> } | null {
  let Spp = 0, Spq = 0, Sqq = 0, Sp = 0, Sq = 0;
  const Scp = [0, 0, 0], Scq = [0, 0, 0], Sc = [0, 0, 0];
  for (const s of samples) {
    Spp += s.p * s.p; Spq += s.p * s.q; Sqq += s.q * s.q; Sp += s.p; Sq += s.q;
    for (let c = 0; c < 3; c++) { Scp[c]! += s.rgb[c]! * s.p; Scq[c]! += s.rgb[c]! * s.q; Sc[c]! += s.rgb[c]!; }
  }
  const N = samples.length;
  const A = [[Spp, Spq, Sp], [Spq, Sqq, Sq], [Sp, Sq, N]];
  const grads: Array<[number, number]> = [];
  for (let c = 0; c < 3; c++) {
    const sol = solve3(A, [Scp[c]!, Scq[c]!, Sc[c]!]);
    if (!sol) return null;
    grads.push([sol[0]!, sol[1]!]);
  }
  return { grads };
}

/** 3×3 solve by Gaussian elimination with partial pivoting. */
function solve3(A: number[][], v: number[]): number[] | null {
  const m = [[...A[0]!, v[0]!], [...A[1]!, v[1]!], [...A[2]!, v[2]!]];
  for (let col = 0; col < 3; col++) {
    let piv = col;
    for (let r = col + 1; r < 3; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[piv]![col]!)) piv = r;
    if (Math.abs(m[piv]![col]!) < 1e-12) return null;
    if (piv !== col) { const t = m[piv]!; m[piv] = m[col]!; m[col] = t; }
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / m[col]![col]!;
      for (let k = col; k < 4; k++) m[r]![k]! -= f * m[col]![k]!;
    }
  }
  const out = [m[0]![3]! / m[0]![0]!, m[1]![3]! / m[1]![1]!, m[2]![3]! / m[2]![2]!];
  return out.every((x) => isFinite(x)) ? out : null;
}

// ── raster tiles (rung 3) ────────────────────────────────────────────────────

/** Everything a caller needs to rasterise one function-based shading into a tile.
 *  Registered by the classifier's caller and consumed lazily, so a page that never
 *  paints a given shading never pays for its pixels. */
export interface TileSource {
  evaluate: ColorFn;
  comps: number;
  domain: [number, number, number, number];
}

/**
 * Evaluate a tile source into RGBA pixels, row 0 = the domain's MINIMUM v.
 *
 * No flip: the shading /Matrix (and the page's own y-flip) rides on the SVG
 * `patternTransform`, so flipping here too would cancel it out and turn every
 * wheel upside down. Pure - the caller owns the canvas.
 */
export function renderTilePixels(src: TileSource, size: number): Uint8ClampedArray {
  const [x0, x1, y0, y1] = src.domain;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let j = 0; j < size; j++) {
    const v = y0 + ((j + 0.5) / size) * (y1 - y0);
    for (let i = 0; i < size; i++) {
      const u = x0 + ((i + 0.5) / size) * (x1 - x0);
      let rgb: [number, number, number] | null = null;
      try { const vals = src.evaluate(u, v); rgb = vals ? componentsToRgb(vals, src.comps) : null; } catch { rgb = null; }
      const o = (j * size + i) * 4;
      if (rgb) { data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255; }
      // A faulting pixel stays fully transparent, so the node's flat back-stop
      // shows through rather than a black hole.
    }
  }
  return data;
}
