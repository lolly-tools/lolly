// SPDX-License-Identifier: MPL-2.0
/**
 * Does `ctx.filter` actually FILTER? - the functional probe (plan 104 section 11 S1).
 *
 * The depth/DOF compositor wants to blur a plate per frame with one property write
 * (`ctx.filter = 'blur(Npx)'`) instead of a mip-chain of downscale/upscale passes.
 * Whether it may is not a question `'filter' in ctx` can answer: presence is not
 * function. Safari shipped the property on BOTH the main-thread and the OffscreenCanvas
 * 2D contexts while ignoring the value through 17.x, and the existing guard at
 * `bridge/export.ts:7277` (`if (!ctx || !('filter' in ctx)) return dataUrl`) is a
 * jsdom/old-browser guard, not a support test - it would have said yes there.
 *
 * So this module DRAWS and LOOKS. On a scratch canvas of the caller's own kind:
 *
 *     control pass    filter = 'none',      fill a small square, sample a pixel that
 *                     is definitively OUTSIDE it  -> must be empty
 *     probe pass      filter = 'blur(2px)', fill the SAME square, sample the SAME
 *                     pixel                       -> must have ink
 *
 * Ink at a pixel the square does not cover can only have arrived by the filter
 * spreading it. Both directions are asserted because "the neighbour has ink" alone
 * would also be true if the geometry assumption broke; and a verdict of `false` is
 * always the safe one - it only routes the caller to the slower fallback lane.
 *
 * KIND, NOT THREAD. section 11 S1's finding is that support is per-ENGINE: a worker's
 * OffscreenCanvas and the main thread's canvas answer the same way on a given
 * browser. The cache is keyed by context kind anyway, because the two kinds are
 * separate implementations in every engine and because module state is per-realm - 
 * a worker gets its own cache regardless of what the window decided.
 *
 * Nothing here touches the caller's canvas: the probe always runs on a 16x16 scratch
 * of the matching kind, so calling it mid-composite is safe.
 *
 * Dependency-free and DOM-free at import (every global is reached behind a `typeof`
 * guard inside a function), so `lib/canvas-filter-probe.test.ts` can exercise the
 * whole decision table in Node against stub contexts.
 */

/** Which 2D implementation was asked about. */
export type CanvasKind = 'canvas' | 'offscreen';

/** The structural slice of a 2D context the probe uses - stub-able in a test. */
export interface ProbeContext2D {
  filter: string;
  fillStyle: unknown;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> };
}

/** Anything the public entry point accepts: a real 2D context, or nothing. */
export type FilterProbeTarget =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D
  | ProbeContext2D
  | null
  | undefined;

/** Scratch geometry. The square is [SQ, SQ+SQ_SIZE) on both axes; the sample pixel
 *  sits SAMPLE_GAP px clear of its right edge, on its vertical centre line. */
const PROBE_SIZE = 16;
const SQ = 6;
const SQ_SIZE = 4;
const SAMPLE_X = SQ + SQ_SIZE + 1;          // 11 - one clear pixel past the edge
const SAMPLE_Y = SQ + SQ_SIZE / 2;          // 8 - the square's centre line
/** The blur the probe asks for. sigma = 2px, so the sample pixel lands ~0.75 sigma
 *  out and picks up tens of levels - no engine-specific tuning needed. */
const PROBE_FILTER = 'blur(2px)';
/** Ink at or above this counts as spread. Low enough to survive a stricter blur
 *  interpretation (some engines read blur(2px) as radius, i.e. sigma 1: still ~15),
 *  high enough that a stray rounding bit is not "support". */
const MIN_SPREAD = 2;

/** Peak channel of a 1x1 read - alpha first, then RGB, so an opaque white dot reads
 *  the same whether the backing store is premultiplied or not. */
function ink(ctx: ProbeContext2D, x: number, y: number): number {
  const d = ctx.getImageData(x, y, 1, 1).data;
  if (!d || d.length < 4) return 0;
  return Math.max(d[3] ?? 0, d[0] ?? 0, d[1] ?? 0, d[2] ?? 0);
}

/**
 * The verdict for ONE context, uncached and non-destructive to nothing but the
 * context it is handed - pass a scratch, never a live compositor target.
 *
 * Returns false for every failure mode (no property, assignment rejected, readback
 * throws, geometry assumption broken), because false is the lane that always works.
 */
export function probeCanvasFilter(ctx: ProbeContext2D | null | undefined): boolean {
  if (!ctx) return false;
  try {
    if (!('filter' in (ctx as object))) return false;      // jsdom / pre-2019 engines
    ctx.filter = 'none';
    ctx.clearRect(0, 0, PROBE_SIZE, PROBE_SIZE);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(SQ, SQ, SQ_SIZE, SQ_SIZE);
    // The pixel must be empty unfiltered, or "it has ink" proves nothing.
    if (ink(ctx, SAMPLE_X, SAMPLE_Y) !== 0) return false;

    ctx.filter = PROBE_FILTER;
    // An engine that does not implement the value keeps 'none' here. Cheap early-out;
    // NOT the verdict - Safari <=17 stored the string and still ignored it.
    if (ctx.filter === 'none' || ctx.filter === '') return false;
    ctx.clearRect(0, 0, PROBE_SIZE, PROBE_SIZE);
    ctx.fillRect(SQ, SQ, SQ_SIZE, SQ_SIZE);
    const spread = ink(ctx, SAMPLE_X, SAMPLE_Y);
    ctx.filter = 'none';
    return spread >= MIN_SPREAD;
  } catch {
    return false;                                          // tainted / unsupported readback
  }
}

const verdicts = new Map<CanvasKind, boolean>();

/** Forget every cached verdict. Tests only. */
export function resetCanvasFilterProbeCache(): void {
  verdicts.clear();
}

/** The cached verdicts so far, for logging a support matrix. */
export function canvasFilterVerdicts(): Readonly<Record<string, boolean>> {
  return Object.fromEntries(verdicts);
}

/**
 * Cached verdict for a kind, with the scratch-context factory injected - the seam
 * the test drives, and the entry point a caller uses when it knows the kind but has
 * no context yet.
 */
export function canvasFilterWorksForKind(
  kind: CanvasKind,
  make: () => ProbeContext2D | null | undefined,
): boolean {
  const cached = verdicts.get(kind);
  if (cached !== undefined) return cached;
  let verdict = false;
  try {
    verdict = probeCanvasFilter(make());
  } catch {
    verdict = false;                                       // canvas allocation refused
  }
  verdicts.set(kind, verdict);
  return verdict;
}

/** Which implementation a context belongs to; without one, whatever this realm has
 *  (a worker has OffscreenCanvas and no document). */
export function canvasKindOf(ctx?: FilterProbeTarget): CanvasKind {
  const canvas = (ctx as { canvas?: unknown } | null | undefined)?.canvas;
  if (canvas) {
    if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) return 'offscreen';
    if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) return 'canvas';
  }
  return typeof document === 'undefined' && typeof OffscreenCanvas !== 'undefined' ? 'offscreen' : 'canvas';
}

/** A scratch 2D context of the given kind, or null where the realm has none. */
function makeScratch(kind: CanvasKind): ProbeContext2D | null {
  if (kind === 'offscreen') {
    if (typeof OffscreenCanvas === 'undefined') return null;
    return new OffscreenCanvas(PROBE_SIZE, PROBE_SIZE)
      .getContext('2d', { willReadFrequently: true }) as ProbeContext2D | null;
  }
  if (typeof document === 'undefined') return null;
  const el = document.createElement('canvas');
  el.width = PROBE_SIZE;
  el.height = PROBE_SIZE;
  return el.getContext('2d', { willReadFrequently: true }) as ProbeContext2D | null;
}

/**
 * THE call site's question: may I blur with `ctx.filter` on this context?
 *
 * Probes once per context kind per realm and caches; the caller's own canvas is
 * never drawn on. Pass nothing to ask about the realm's default kind.
 */
export function canvasFilterWorks(ctx?: FilterProbeTarget): boolean {
  const kind = canvasKindOf(ctx);
  return canvasFilterWorksForKind(kind, () => makeScratch(kind));
}
