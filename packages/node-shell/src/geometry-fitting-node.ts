// SPDX-License-Identifier: MPL-2.0
/** Node shell loader for the import-free portable fitting module. */
import { createGeometryFitting } from './geometry-fitting.ts';
import { readGeometryWasm } from './geometry-wasm-node.ts';
export async function loadGeometryFitting() {
  return createGeometryFitting(await readGeometryWasm('geometry-fit-portable.wasm'));
}
