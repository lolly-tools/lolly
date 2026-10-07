// SPDX-License-Identifier: MPL-2.0
/** Comparison-only complete verifier substitution; never imported by production engine code. */
import type { offsetError } from '../../engine/src/geom/offset-error.ts';

export let offsetErrorProbe: typeof offsetError | undefined;
export function setOffsetErrorProbe(probe: typeof offsetErrorProbe): void {
  offsetErrorProbe = probe;
}
