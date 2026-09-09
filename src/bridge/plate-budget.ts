// SPDX-License-Identifier: MPL-2.0
/**
 * THE PLATE BUDGET - how much memory a sequence export may spend on plates, and what
 * it gives back when it cannot afford what the camera asked for (plan 104 section 5.5).
 *
 * Layers are rasterised ONCE, before the frame loop, and re-drawn every frame. That is
 * cheap while every plate is shot at the export scale S. Depth changes the arithmetic:
 * a layer flown toward the camera is magnified by `eff`, and a plate shot at S and then
 * blown up by eff is a soft plate, so section 5.5 shoots it at `S·eff` instead. `eff` is
 * capped at KF_EFF_MAX = 10 by the behind-camera guard, and a six-layer 1080p job at
 * eff 2.5 is already ~311 MB of plates - doubled while the worker path has both the
 * originals and their transferred copies alive. Fly-pasts are EXPECTED to hit the cap.
 * That path is designed, not exceptional.
 *
 * So: a budget, and one degradation knob.
 *
 *   budget      = min(8, deviceMemory ?? 4)/8 × 512 MB   (the `maxVideoFrames`
 *                 deviceMemory-scaling precedent, sequence-render.ts)
 *   long side   ≤ 4096 px below 8 GB, 8192 px at or above it - Safari's canvas-area
 *                 caps are real, and `rasterBox`'s bare catch nulls a refused plate
 *                 SILENTLY, which is the worst possible way to find out
 *   over budget → ONE λ = sqrt(budget / need), applied to every layer's eff, floored
 *                 at 1, and ONE warn line naming the clamp
 *   pad - the OTHER multiplier on plate size (section 5.5's capture margin for a
 *                 blur/shadow spill). It gets its own cap against the same long side,
 *                 because eff floors at 1 and λ only scales eff: without one, a big
 *                 authored blur grows a plate ~90× with nothing able to take it back
 *
 * TWO RULES MAKE THIS SAFE TO SHIP AT P0, WHERE THERE IS NO CAMERA AND EVERY eff IS 1.
 *
 *  1. The floor is TODAY'S QUALITY. λ and the long-side cap only ever scale the eff
 *     multiplier, never below 1 - so a document that asked for no extra resolution
 *     cannot have resolution taken away, and its plates are the bytes they always were.
 *  2. Nothing is CLAMPED and nothing is LOGGED unless some layer actually asked for
 *     extra. A 4× export of a 4000 px board is over the long-side cap at eff 1 and must
 *     stay exactly as it is; warning about a clamp that did not happen is how a
 *     no-silent-caps rule turns into noise nobody reads.
 *
 * Pure arithmetic, no DOM, no canvas - so `plate-budget.test.ts` can drive it with
 * synthetic eff values that P0 cannot produce and P1 will.
 */

/** Plate kinds the budget prices. Mirrors `SeqLayer['kind']`, without importing it. */
export type PlateKind = 'static' | 'video' | 'lottie' | 'audio' | 'camera';

/** Bytes at 100 % deviceMemory. Half a gigabyte of plates is already a large export. */
export const PLATE_BUDGET_FULL_BYTES = 512 * 1024 * 1024;
/** deviceMemory (GB) assumed when the browser will not say. */
export const PLATE_BUDGET_DEFAULT_GB = 4;
/** deviceMemory (GB) at which the budget and the long-side cap stop growing. */
export const PLATE_BUDGET_CAP_GB = 8;
/** Per-plate long-side cap, below and at/above `PLATE_BUDGET_CAP_GB`. */
export const PLATE_LONG_SIDE_SMALL = 4096;
export const PLATE_LONG_SIDE_LARGE = 8192;
/** RGBA. */
export const PLATE_BYTES_PER_PIXEL = 4;
/**
 * The worker path holds a plate and its transferred copy at once, so its peak is
 * double. (Transferables would avoid it for ImageBitmaps; these are canvases.)
 */
export const PLATE_WORKER_FACTOR = 2;

/**
 * Plate resolution multipliers, bucketed so a layer that drifts between eff 1.83 and
 * 1.84 across a re-render keeps the SAME plate key - deterministic exports need
 * deterministic plate sizes, and a continuous eff would reshoot on every rounding bit.
 */
export const EFF_BUCKETS: readonly number[] = Object.freeze([1, 1.5, 2, 2.5, 3]);

/** The smallest bucket ≥ `eff` - quality is never rounded DOWN by bucketing alone. */
export function bucketEffUp(eff: number): number {
  if (!Number.isFinite(eff) || eff <= 1) return 1;
  for (const b of EFF_BUCKETS) if (eff <= b) return b;
  return EFF_BUCKETS[EFF_BUCKETS.length - 1] as number;
}

/** The largest bucket ≤ `eff` - how a clamp lands, so the result is never over budget. */
export function bucketEffDown(eff: number): number {
  if (!Number.isFinite(eff) || eff <= 1) return 1;
  let out = 1;
  for (const b of EFF_BUCKETS) if (b <= eff) out = b;
  return out;
}

/** How many plates a layer of this kind occupies. */
export function platesPerLayer(kind: PlateKind, needsLiveRaster = false): number {
  // A camera has no picture and an audio bed has none either (section 5.4).
  if (kind === 'audio' || kind === 'camera') return 0;
  // A video layer is shot twice - everything under the media, and everything over it.
  if (kind === 'video') return 2;
  // A live lottie keeps its static fallback AND a re-shot frame plate at once.
  if (kind === 'lottie' && needsLiveRaster) return 2;
  return 1;
}

/** `navigator.deviceMemory` in GB, or null. Isolated so the maths stays pure. */
export function deviceMemoryGb(): number | null {
  const nav = typeof navigator !== 'undefined' ? (navigator as { deviceMemory?: number }) : null;
  const gb = nav?.deviceMemory;
  return typeof gb === 'number' && gb > 0 ? gb : null;
}

/** The plate budget in bytes for a machine with `gb` of memory (null = unknown). */
export function plateBudgetBytes(gb: number | null = deviceMemoryGb()): number {
  const mem = Math.min(PLATE_BUDGET_CAP_GB, gb && gb > 0 ? gb : PLATE_BUDGET_DEFAULT_GB);
  return Math.round((mem / PLATE_BUDGET_CAP_GB) * PLATE_BUDGET_FULL_BYTES);
}

/** The per-plate long-side cap in px for a machine with `gb` of memory. */
export function plateLongSideCap(gb: number | null = deviceMemoryGb()): number {
  return (gb ?? 0) >= PLATE_BUDGET_CAP_GB ? PLATE_LONG_SIDE_LARGE : PLATE_LONG_SIDE_SMALL;
}

/** One layer as the budget sees it. */
export interface PlateLayerNeed {
  idx: number;
  kind: PlateKind;
  /** Stage-native box size, px, BEFORE the export scale. */
  w: number;
  h: number;
  /** Capture margin on all four sides, stage-native px (plans/104 section 5.5). */
  pad?: number;
  /** The largest projection magnification over this layer's active window. 1 = flat. */
  maxEff?: number;
  needsLiveRaster?: boolean;
}

export interface PlateBudgetInput {
  layers: readonly PlateLayerNeed[];
  /** Export pixels per authored px. */
  scale: number;
  /** True while the render will run on the worker path (both copies alive at once). */
  worker: boolean;
  budgetBytes?: number;
  longSideCap?: number;
  /**
   * Bytes this render will hold that are NOT plates but come out of the same pocket - 
   * today, the blur lanes' pooled scratch canvases (plans/104 P1 obligation 3).
   *
   * The scratches are individually capped (`scratchPadCap`, `BLUR_SCRATCH_MAX_PIXELS`)
   * but their POOL peak was never priced against the plate budget, so a job could sit
   * inside its plate allowance and then allocate the same again in scratches while it
   * ran. Subtracted from the budget before λ is computed, so the degradation knob is
   * turned by the whole memory picture instead of by half of it. Absent - every caller
   * that does not blur - leaves the arithmetic exactly as it was.
   */
  reserveBytes?: number;
}

export interface PlateBudgetPlan {
  /** Bucketed plate resolution multiplier per layer idx. 1 everywhere on a flat scene. */
  effOf: Map<number, number>;
  /**
   * The capture margin per layer idx, in stage-native px, AFTER the long-side cap has
   * had its say - the number the shot must actually use.
   *
   * `pad` is a multiplier on plate size that nothing else can take back: `eff` floors
   * at 1 by design, so neither λ nor `effUnderSideCap` can shrink a plate an authored
   * blur inflated. A 640×360 clip with a 300 px blur asks for a 2474×2194 plate at
   * S = 1 and 4948×4388 at S = 2 - ~90× the pixels, on a canvas Safari may simply
   * refuse (and `rasterBox`'s bare catch nulls a refused plate silently, which is the
   * layer disappearing from the video with no warning). Capped, the spill is clipped
   * at a stated distance instead - which is strictly better than pre-104, where it was
   * clipped at the box edge.
   */
  padOf: Map<number, number>;
  /** Bytes the plan actually spends. */
  bytes: number;
  /** Bytes the unclamped demand would have spent. */
  wantedBytes: number;
  /** The budget PLATES may spend: the machine's allowance less `reserveBytes`. */
  budgetBytes: number;
  /** What was held back for the blur lanes' pooled scratches (`reserveBytes`, floored). */
  reservedBytes: number;
  /** The single scale applied to every layer's extra resolution; 1 when nothing moved. */
  lambda: number;
  /** True when λ or the long-side cap actually reduced a layer's eff. */
  clamped: boolean;
  /** The ONE line to log, or '' when nothing was clamped. Never more than one. */
  warning: string;
}

/** Bytes one plate of a layer occupies at a given eff. */
function plateBytes(layer: PlateLayerNeed, scale: number, eff: number): number {
  const pad = Math.max(0, layer.pad ?? 0);
  const w = Math.max(1, (Math.max(0, layer.w) + pad * 2) * scale * eff);
  const h = Math.max(1, (Math.max(0, layer.h) + pad * 2) * scale * eff);
  return Math.ceil(w) * Math.ceil(h) * PLATE_BYTES_PER_PIXEL;
}

/** The largest eff whose plate keeps both sides inside the long-side cap. Floors at 1. */
function effUnderSideCap(layer: PlateLayerNeed, scale: number, cap: number): number {
  const pad = Math.max(0, layer.pad ?? 0);
  const side = Math.max((Math.max(0, layer.w) + pad * 2) * scale, (Math.max(0, layer.h) + pad * 2) * scale);
  if (!(side > 0) || !(cap > 0)) return Infinity;
  // Floored at 1 deliberately: an already-oversized plate is today's behaviour and
  // shrinking it would change a document that asked for nothing.
  return Math.max(1, cap / side);
}

/**
 * The largest capture margin that keeps a layer's plate inside the long-side cap at
 * the resolution it resolved to. Floors at 0.
 *
 * The counterpart to `effUnderSideCap`, and the reason both exist: eff floors at 1 (an
 * un-lifted plate is today's plate and must not shrink), so on a layer whose SIZE is
 * driven by `pad` rather than by eff there is otherwise no knob at all. A box already
 * over the cap on its own gets pad 0 - its plate stays exactly what it has always
 * been, and nothing new is added on top of it.
 */
function padUnderSideCap(layer: PlateLayerNeed, scale: number, eff: number, cap: number): number {
  const side = Math.max(Math.max(0, layer.w), Math.max(0, layer.h));
  const k = scale * (eff > 0 ? eff : 1);
  if (!(k > 0) || !(cap > 0)) return Infinity;
  return Math.max(0, (cap / k - side) / 2);
}

/**
 * Resolve every layer's plate resolution against the budget.
 *
 * The order is: bucket the demand up, cap each layer by the long side, price it, and
 * only if the total is over budget compute the ONE λ = sqrt(budget/need) and re-bucket
 * every layer DOWN through it. λ is a length ratio because plate cost is quadratic in
 * it - scaling every eff by λ scales the total bytes by λ², which is the point.
 */
export function planPlateBudget(input: PlateBudgetInput): PlateBudgetPlan {
  const scale = Number.isFinite(input.scale) && input.scale > 0 ? input.scale : 1;
  const cap = input.longSideCap ?? plateLongSideCap();
  const total = input.budgetBytes ?? plateBudgetBytes();
  // The scratch reserve comes off the top, and is itself capped at HALF the allowance:
  // a pathological blur could otherwise reserve the whole budget and drive λ toward
  // zero, i.e. degrade every plate to rescue scratches that the per-scratch caps were
  // always going to bound anyway. Half is the point at which "plates and scratches cost
  // about the same" stops being a plausible reading of the render.
  const reservedBytes = Math.min(
    Math.max(0, Number.isFinite(input.reserveBytes) ? (input.reserveBytes as number) : 0),
    Math.floor(total / 2),
  );
  const budgetBytes = Math.max(0, total - reservedBytes);
  const factor = input.worker ? PLATE_WORKER_FACTOR : 1;

  const counted = input.layers.map((L) => ({
    L,
    plates: platesPerLayer(L.kind, L.needsLiveRaster ?? false),
    want: Math.max(1, Number.isFinite(L.maxEff) ? (L.maxEff as number) : 1),
  }));
  // Rule 2: with nothing asking for extra resolution there is nothing to clamp, no λ to
  // compute and nothing to warn about - the export is byte-for-byte the one it was
  // before this machinery existed. `pad` is the SECOND thing a layer can ask for, and
  // it is priced and capped on its own account: λ only ever scales eff, so a run where
  // every eff is 1 but a pad is enormous would otherwise pass through unclamped.
  const anyExtraEff = counted.some((c) => c.plates > 0 && c.want > 1);
  const anyPad = counted.some((c) => c.plates > 0 && (c.L.pad ?? 0) > 0);

  const effOf = new Map<number, number>();
  const padOf = new Map<number, number>();
  let bytes = 0;
  let wantedBytes = 0;
  let sideClamped = false;
  let padClamped = false;
  for (const c of counted) {
    const wantEff = anyExtraEff ? bucketEffUp(c.want) : 1;
    const capped = anyExtraEff ? Math.min(wantEff, effUnderSideCap(c.L, scale, cap)) : 1;
    const eff = anyExtraEff ? bucketEffDown(capped) : 1;
    if (eff < wantEff) sideClamped = true;
    effOf.set(c.L.idx, eff);
    // The pad the shot may actually take, at the resolution this layer resolved to.
    // Priced with the CAPPED value so the budget below sees the bytes that will exist.
    const wantPad = Math.max(0, c.L.pad ?? 0);
    const pad = c.plates > 0 && anyPad ? Math.min(wantPad, padUnderSideCap(c.L, scale, eff, cap)) : wantPad;
    if (pad < wantPad) padClamped = true;
    padOf.set(c.L.idx, pad);
    const sized = { ...c.L, pad };
    bytes += plateBytes(sized, scale, eff) * c.plates * factor;
    wantedBytes += plateBytes(c.L, scale, wantEff) * c.plates * factor;
  }

  let lambda = 1;
  let budgetClamped = false;
  if (anyExtraEff && bytes > budgetBytes && budgetBytes > 0) {
    lambda = Math.sqrt(budgetBytes / bytes);
    bytes = 0;
    for (const c of counted) {
      const before = effOf.get(c.L.idx) ?? 1;
      const eff = bucketEffDown(Math.max(1, before * lambda));
      if (eff < before) budgetClamped = true;
      effOf.set(c.L.idx, eff);
      // A lower eff only ever leaves MORE room under the long-side cap, so the pad
      // granted above stays valid; it is deliberately not re-granted (the safe
      // direction for a memory budget is never to hand resolution back).
      bytes += plateBytes({ ...c.L, pad: padOf.get(c.L.idx) ?? 0 }, scale, eff) * c.plates * factor;
    }
  }

  const clamped = sideClamped || budgetClamped || padClamped;
  const mb = (n: number): string => `${Math.round(n / (1024 * 1024))}MB`;
  let warning = '';
  if (budgetClamped) {
    warning = `sequence: depth plates wanted ${mb(wantedBytes)} against a ${mb(budgetBytes)} plate budget`
      + (reservedBytes > 0 ? ` (${mb(reservedBytes)} of it reserved for blur scratches)` : '')
      + ` - every layer's extra resolution scaled by ${lambda.toFixed(2)} (now ${mb(bytes)}).`
      + ' Flown-past layers will look softer; nothing else changes.';
  } else if (sideClamped) {
    warning = `sequence: a depth plate would have exceeded the ${cap}px per-plate limit`
      + ' - that layer\'s extra resolution was capped. Flown-past layers will look softer.';
  } else if (padClamped) {
    warning = `sequence: a blur/shadow margin would have pushed a plate past the ${cap}px per-plate limit`
      + ' - the captured margin was trimmed, so a very large blur is clipped at that distance'
      + ' rather than losing the whole layer to a refused canvas.';
  }

  return { effOf, padOf, bytes, wantedBytes, budgetBytes, reservedBytes, lambda, clamped, warning };
}

// ── the blur lanes' pooled scratches (plans/104 P1 obligation 3) ─────────────

/**
 * Scratches held at once while ONE layer is composited through a blur lane.
 *
 * `drawItem` takes the padded stage, `renderFx` takes its output, and the mip lane
 * holds one level down and one level up beside them. Four is the peak the pool sees at
 * full size; the mip chain's own levels fall away geometrically (¼, 1/16, …) and sum to
 * under a third of one more, so four is the honest bound rather than a round number.
 */
export const BLUR_SCRATCH_PEAK_PER_LAYER = 4;

/** One layer as the scratch reserve sees it: its widest box, its pad, and who owns its fx. */
export interface BlurScratchNeed {
  /** Stage-native box size, px, BEFORE the export scale. */
  w: number;
  h: number;
  /** Capture margin on all four sides, stage-native px. */
  pad?: number;
  /** True when the COMPOSITOR owns this layer's filter - the only layers that blur here. */
  owned?: boolean;
}

/**
 * Peak bytes the pooled blur scratches will hold, for `planPlateBudget`'s `reserveBytes`.
 *
 * The pool is shared across layers and across frames (that is the whole reason it
 * exists), and `takeStage` RESIZES rather than reallocating - so the peak is set by the
 * single LARGEST filtered layer, not by their sum. A render with no compositor-owned
 * filter reserves nothing at all, which is every export written before plans/104.
 *
 * Deliberately an estimate of the scratch at PLATE resolution (`w + 2·pad`, ×S), not of
 * the exact `spillPad`-derived stage `drawItem` will ask for: the pad already carries
 * the spill the sigma implies (that is what `spillPad` computed it from), and the extra
 * `plateEff` factor is exactly the thing the budget is about to decide. Under-reserving
 * by the eff factor is the safe direction - λ only ever takes resolution away, so a
 * scratch sized off a degraded plate is smaller than this, never larger.
 */
export function blurScratchNeedBytes(
  layers: readonly BlurScratchNeed[], scale: number,
): number {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  let peak = 0;
  for (const L of layers) {
    if (!L?.owned) continue;
    const pad = Math.max(0, L.pad ?? 0);
    const w = Math.max(1, (Math.max(0, L.w) + pad * 2) * s);
    const h = Math.max(1, (Math.max(0, L.h) + pad * 2) * s);
    const bytes = Math.ceil(w) * Math.ceil(h) * PLATE_BYTES_PER_PIXEL;
    if (bytes > peak) peak = bytes;
  }
  return peak * BLUR_SCRATCH_PEAK_PER_LAYER;
}

// ── the fx-plate cache (plans/104 P3.1, failure 1) ──────────────────────────

/**
 * Share of the machine's plate allowance the compositor may RETAIN as cached fx
 * plates - a layer's filtered picture, rendered once and re-composited per frame
 * (`fxPlateKey` in the executor).
 *
 * Half, and the reasoning is that this is the same trade the plates themselves are:
 * a plate exists because rasterising a box per frame is unaffordable, and a cached fx
 * plate exists because re-blurring one per frame is unaffordable for exactly the same
 * reason. A lifted layer is a FULL-STAGE box, so its depth shadow is a full-frame
 * gaussian; eleven of them under a moving camera is eleven full-frame gaussians per
 * frame, measured at 854 ms/frame against 51 ms/frame with the shadows off.
 *
 * It is a CEILING, not a reservation: nothing is allocated until a layer actually
 * caches, a layer that does not fit simply keeps re-rendering its filter (identical
 * pixels, today's cost), and the executor logs ONE line naming what it refused. So it
 * is deliberately NOT subtracted from `planPlateBudget`'s allowance the way
 * `blurScratchNeedBytes` is - a reservation would degrade plate RESOLUTION, which is
 * quality, to buy back time, which is not the trade section 5.5 makes anywhere else.
 */
export const FX_CACHE_BUDGET_SHARE = 0.5;

/** Bytes of cached fx plates one render may retain on a machine with `gb` of memory. */
export function fxCacheBudgetBytes(gb: number | null = deviceMemoryGb()): number {
  return Math.round(plateBudgetBytes(gb) * FX_CACHE_BUDGET_SHARE);
}
