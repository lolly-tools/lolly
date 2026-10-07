// SPDX-License-Identifier: MPL-2.0
/** Node shell loader for the separately qualified complete clipping pilot. */
import { readFile } from 'node:fs/promises';
import { createGeometryClipping, type GeometryClippingMath } from './geometry-clipping.ts';
export async function loadGeometryClipping(mathBackend: GeometryClippingMath = 'retained') {
  return createGeometryClipping(
    await readFile(new URL(mathBackend === 'host-norm' ? '../wasm/geometry-kernel/geometry-clip-host-norm.wasm' : '../wasm/geometry-kernel/geometry-clip.wasm', import.meta.url)), mathBackend
  );
}
