// SPDX-License-Identifier: MPL-2.0
/**
 * The trusted render bundle's entry. Bundled by scripts/build-rondo.ts into
 * generated/render.mjs, which the web worker and the Node shell import.
 *
 * Only upstream's fixed DSP interpreter and the graph checks reach this bundle.
 * The evaluation core (evalCode, acorn, the scope) stays in the vm bundle: the
 * build marks upstream modules side-effect free so an unused import is dropped,
 * and scripts/build-rondo.ts refuses a render bundle that contains `new Function`.
 */
export { renderMix } from '../upstream/packages/server/src/render-runner';
export { validateGraph } from '../upstream/packages/engine/src/graph';
export { sampleNamesIn, usesMicIn } from '../upstream/packages/engine/src/samples';
export { validateWavetableFrames } from '../upstream/packages/engine/src/dsp/wavetable';
import { builtInSamples } from '../upstream/packages/engine/src/demo-samples';

let names: readonly string[] | null = null;

/** The built-in samples every render has without a bank of its own (upstream synthesises them). */
export function builtInSampleNames(): readonly string[] {
  // A low rate keeps the one-off synthesis cheap; only the names are read.
  names ??= Object.freeze(Object.keys(builtInSamples(8000)).sort());
  return names;
}
