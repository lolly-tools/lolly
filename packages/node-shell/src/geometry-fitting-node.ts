// SPDX-License-Identifier: MPL-2.0
/** Node shell loader for the separately qualified complete fitting pilot. */
import { readFile } from 'node:fs/promises';
import { createGeometryFitting, type GeometryFittingMath } from './geometry-fitting.ts';
export async function loadGeometryFitting(mathBackend: GeometryFittingMath = 'host') {
  const bytes = await readFile(
    new URL(
      mathBackend === 'host-norm'
        ? '../wasm/geometry-kernel/geometry-fit-host-norm.wasm'
        : mathBackend === 'portable'
        ? '../wasm/geometry-kernel/geometry-fit-portable.wasm'
        : '../wasm/geometry-kernel/geometry-fit.wasm',
      import.meta.url
    )
  );
  return createGeometryFitting(bytes, mathBackend);
}
