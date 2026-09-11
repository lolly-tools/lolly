// SPDX-License-Identifier: MPL-2.0
/**
 * Numeric helpers shared across the web shell.
 *
 * The numeric clamp itself is the engine's (`clamp` in engine/src/clamp.ts) - import it
 * from there rather than re-declaring it here. This module only adds the 0..1
 * shorthand that a dozen modules each used to define for themselves.
 *
 * Callers that need a non-finite input to read as 0 or 1 instead of passing NaN through
 * keep their own guard; those are a different function, not a copy.
 */
// The engine LEAF, not the barrel: this helper sits on the boot path of light modules
// (bridge/audio-envelope.ts), and the barrel would drag the engine-colour chunk with it.
import { clamp } from '../../../../../engine/src/clamp.ts';

/** `v` held within `[0, 1]`. NaN passes through as NaN, exactly as `clamp` does. */
export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}
