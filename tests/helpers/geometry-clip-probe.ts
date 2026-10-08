// SPDX-License-Identifier: MPL-2.0
/** Browser-owned loading, with the same bit-encoded controls in the window and worker. */
import { createGeometryClipping } from '../../packages/node-shell/src/geometry-clipping.ts';
import type { ClipWireCase } from './geometry-clip-cases.ts';
import { qualifyClipping } from './geometry-clip-qualification.ts';
export async function probeClipping(inputs: ClipWireCase[]) {
  const bytes = new Uint8Array(await (await fetch('/geometry-clip.wasm')).arrayBuffer());
  return qualifyClipping(await createGeometryClipping(bytes), inputs);
}
