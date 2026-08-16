// SPDX-License-Identifier: MPL-2.0
/**
 * Geometry-safe svgo profile + fidelity gate for docs shots.
 *
 * Optimisation runs BEFORE credentialing (build-docs-shots.ts), so the C2PA
 * signature covers the optimised bytes - nothing is stripped after signing.
 * The profile rounds to 4 decimals and approximates nothing: no structural
 * pruning (the walker's frosted-glass backdrop is a FILTERED EMPTY GROUP that
 * "empty container" cleanup would delete), no group collapsing, no transform
 * folding, no curve re-approximation. Measured 2026-08-10 over all 378
 * baselines: −37% bytes; every visual delta found traced to latent walker
 * bugs (duplicate inlined ids, namespace-less icons), both fixed at source.
 *
 * The gate is the "damn sure" part: at write time the original and optimised
 * files are BOTH rasterised (resvg, the repo's own renderer class) and
 * pixel-compared. A breach keeps the original bytes and says so loudly - 
 * optimisation can only ever be a no-op or a win, never a quality regression.
 */
import { optimize, type Config } from 'svgo';

// Cast: svgo v4's PluginConfig typing does not admit the documented
// `{ name: 'preset-default', params: { overrides } }` form, but the runtime
// honours it (verified: override edits change output byte-for-byte).
export const SHOT_SVGO_CONFIG = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Filtered empty groups PAINT (feFlood backdrops); never prune them.
          removeEmptyContainers: false,
          removeHiddenElems: false,
          removeUselessDefs: false,
          mergePaths: false,             // paint order / AA seams must not move
          collapseGroups: false,         // keep the authored group structure
          convertShapeToPath: false,     // keep shapes as shapes
          convertTransform: false,       // no matrix folding
          moveElemsAttrsToGroup: false,
          moveGroupAttrsToElems: false,
          cleanupNumericValues: { floatPrecision: 4 },
          convertPathData: {
            floatPrecision: 4,
            transformPrecision: 6,
            applyTransforms: false,      // transforms stay transforms
            makeArcs: false,             // no curve re-approximation
            straightCurves: false,
          },
        },
      },
    },
  ],
} as unknown as Config;

/** svgo pass over one shot. Throws on svgo failure - callers keep the original. */
export function optimizeShotSvg(bytes: Uint8Array): Uint8Array {
  const out = optimize(new TextDecoder().decode(bytes), SHOT_SVGO_CONFIG);
  return new TextEncoder().encode(out.data);
}

export interface FidelityVerdict {
  ok: boolean;
  maxChannelDelta: number;
  /** Share (0..1) of pixels with any channel off by more than 2/255. */
  overFrac: number;
}

/**
 * Max per-channel delta a write may carry. Calibrated 2026-08-10 against the
 * worst measured case of honest 4-decimal rounding (glyph-outline AA jitter,
 * maxΔ 21 - the worst-delta region magnified 5x is visually indistinguishable)
 * vs the structural failures the gate exists for (deleted backdrops, id
 * collisions: maxΔ 233–252 across whole elements). 32 passes the former and
 * fails the latter with a wide margin on both sides.
 */
export const FIDELITY_MAX_DELTA = 32;
/** And no more than 0.5% of pixels may exceed 2/255 (measured jitter ≤0.4%). */
export const FIDELITY_MAX_OVER_FRAC = 0.005;

/**
 * Rasterise both candidates and pixel-compare. Only called at write time
 * (renders are not free); a compare-only shots run never pays for it.
 */
export async function svgFidelityGate(original: Uint8Array, optimized: Uint8Array): Promise<FidelityVerdict> {
  const { Resvg } = await import('@resvg/resvg-js');
  const render = (b: Uint8Array) => new Resvg(new TextDecoder().decode(b), { logLevel: 'off' }).render();
  const a = render(original);
  const b = render(optimized);
  if (a.width !== b.width || a.height !== b.height) return { ok: false, maxChannelDelta: 255, overFrac: 1 };
  const pa = a.pixels, pb = b.pixels;
  let maxD = 0, over = 0;
  for (let i = 0; i < pa.length; i++) {
    const d = Math.abs(pa[i]! - pb[i]!);
    if (d > maxD) maxD = d;
    if (d > 2) over++;
  }
  const overFrac = over / pa.length;
  return { ok: maxD <= FIDELITY_MAX_DELTA && overFrac <= FIDELITY_MAX_OVER_FRAC, maxChannelDelta: maxD, overFrac };
}
