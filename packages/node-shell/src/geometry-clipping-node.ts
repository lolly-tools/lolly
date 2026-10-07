// SPDX-License-Identifier: MPL-2.0
/** Node shell loader for the import-free clipping module. */
import { createGeometryClipping } from './geometry-clipping.ts';
import { readGeometryWasm } from './geometry-wasm-node.ts';
export async function loadGeometryClipping() {
  return createGeometryClipping(await readGeometryWasm('geometry-clip.wasm'));
}
