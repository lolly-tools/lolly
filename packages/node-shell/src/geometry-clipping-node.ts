// SPDX-License-Identifier: MPL-2.0
/** Node shell loader for the import-free clipping module. */
import { readFile } from 'node:fs/promises';
import { createGeometryClipping } from './geometry-clipping.ts';
export async function loadGeometryClipping() {
  return createGeometryClipping(await readFile(new URL('../wasm/geometry-kernel/geometry-clip.wasm', import.meta.url)));
}
