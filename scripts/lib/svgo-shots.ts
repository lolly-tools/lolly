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
 * The gate is the "damn sure" part: the original and optimised files are BOTH
 * rasterised (resvg, the repo's own renderer class, in a child process so a
 * renderer crash cannot take the run down) and pixel-compared. A breach keeps the original bytes and says so loudly - 
 * optimisation can only ever be a no-op or a win, never a quality regression.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { optimize, type Config } from 'svgo';

const execFileAsync = promisify(execFile);

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
  /** Set when the renderer itself failed (a resvg panic, a timeout): the
   *  optimisation could not be checked, so the caller keeps the original. */
  renderError?: string;
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

/** Longest a pair of renders may take before the check gives up (large shots take ~2 s). */
const FIDELITY_TIMEOUT_MS = 60_000;

/**
 * Rasterise both candidates and pixel-compare, in a child process
 * (svg-fidelity-child.ts). resvg is native, and a malformed capture can make it
 * panic, which aborts whatever process it runs in; in-process that killed a whole
 * shots run. A child that dies, times out or prints nothing comes back as a failed
 * verdict with `renderError` set, which the caller already treats as "keep the
 * unoptimised bytes".
 */
export async function svgFidelityGate(original: Uint8Array, optimized: Uint8Array): Promise<FidelityVerdict> {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-fidelity-'));
  try {
    const a = join(dir, 'original.svg'), b = join(dir, 'optimised.svg');
    await Promise.all([writeFile(a, original), writeFile(b, optimized)]);
    const child = fileURLToPath(new URL('./svg-fidelity-child.ts', import.meta.url));
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync(process.execPath, [child, a, b], { timeout: FIDELITY_TIMEOUT_MS, maxBuffer: 1 << 20 }));
    } catch (e) {
      const err = e as { code?: unknown; signal?: unknown; stderr?: unknown; message?: string };
      const panic = String(err.stderr ?? '').split('\n').find(line => /panicked at/.test(line));
      const why = panic?.trim() || (err.signal ? `killed by ${String(err.signal)}` : `exit ${String(err.code ?? '?')}`);
      return { ok: false, maxChannelDelta: 255, overFrac: 1, renderError: why };
    }
    const v = JSON.parse(stdout.trim().split('\n').pop() ?? '{}') as { width?: number; maxChannelDelta?: number; overFrac?: number };
    if (typeof v.maxChannelDelta !== 'number' || typeof v.overFrac !== 'number') {
      return { ok: false, maxChannelDelta: 255, overFrac: 1, renderError: 'renderer printed no verdict' };
    }
    if (v.width === -1) return { ok: false, maxChannelDelta: 255, overFrac: 1 };
    return {
      ok: v.maxChannelDelta <= FIDELITY_MAX_DELTA && v.overFrac <= FIDELITY_MAX_OVER_FRAC,
      maxChannelDelta: v.maxChannelDelta,
      overFrac: v.overFrac,
    };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
