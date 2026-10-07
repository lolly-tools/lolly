// SPDX-License-Identifier: MPL-2.0
/** Node shell loader for the import-free portable fitting module. */
import { readFile } from 'node:fs/promises';
import { createGeometryFitting } from './geometry-fitting.ts';
export async function loadGeometryFitting() {
  return createGeometryFitting(await readFile(new URL('../wasm/geometry-kernel/geometry-fit-portable.wasm', import.meta.url)));
}
