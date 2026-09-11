// SPDX-License-Identifier: MPL-2.0
/**
 * The visualizer's capability probe, deliberately alone in its own module with no
 * imports (neuro-demo-peek.ts, the one exception, is itself import-free at top level):
 * the dock has to decide SYNCHRONOUSLY whether to render its visualizer
 * button, and everything else in the feature (butterchurn itself, the presets, the
 * palette derivation, the overlay chrome) should stay out of the main bundle until
 * someone actually presses it. Importing this costs nothing; importing the engine
 * wrapper would drag the whole graph in.
 */

import { neuroDemoActive } from './neuro-demo-peek.ts';

let cached: boolean | null = null;
let cachedLax: boolean | null = null;

/**
 * Is a MilkDrop visualizer possible here? butterchurn 2.x is WebGL2-or-nothing - 
 * a single `getContext('webgl2')` with no WebGL1 fallback path.
 *
 * `failIfMajorPerformanceCaveat` additionally rules out software rasterisers, where
 * a full-screen mesh render crawls badly enough to read as a broken feature rather
 * than a slow one. Cached: the answer can't change within a session, and creating
 * throwaway GL contexts to re-ask is not free.
 */
export function vizSupported(): boolean {
  // A ?neuro demo capture runs on headless SwiftShader, which fails the strict
  // failIfMajorPerformanceCaveat probe by definition (it IS a software rasteriser)
  // - so the demo takes the lax answer instead. neuro-demo-peek.ts is import-free at
  // module level, so this module's "no imports" cheapness holds.
  if (neuroDemoActive()) return vizPossible();
  return strictProbe();
}

function strictProbe(): boolean {
  if (cached !== null) return cached;
  if (typeof document === 'undefined') return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    cached = gl !== null;
  } catch {
    cached = false;
  }
  return cached;
}

/**
 * The same question, without the performance-caveat requirement.
 *
 * `vizSupported` deliberately refuses a software rasteriser, because the DOCK renders
 * its visualizer ambiently and a crawling full-screen mesh reads as a broken feature.
 * That is the wrong test for a surface the user has explicitly asked for: on a machine
 * where the strict probe fails - a laptop on integrated graphics, a browser with partial
 * hardware acceleration - the strict answer turns a deliberate tap into nothing
 * happening at all, which is worse than a slow visualiser.
 *
 * So: strict where it is ambient, lax where it was asked for.
 */
export function vizPossible(): boolean {
  if (strictProbe()) return true;
  if (cachedLax !== null) return cachedLax;
  if (typeof document === 'undefined') return false;
  try {
    cachedLax = document.createElement('canvas').getContext('webgl2') !== null;
  } catch {
    cachedLax = false;
  }
  return cachedLax;
}
