// SPDX-License-Identifier: MPL-2.0
/** The shell loads bytes once before constructing synchronous operation owners. */
import { createGeometryClipping } from '../../packages/node-shell/src/geometry-clipping.ts';
import { createGeometryFitting } from '../../packages/node-shell/src/geometry-fitting.ts';
import { qualifyGeometryOperations } from './geometry-operation-qualification.ts';
export async function probeGeometryOperations() {
  const load = async (name: string) => {
    const response = await fetch('/' + name);
    if (!response.ok) throw Error('Geometry module loading failed.');
    return new Uint8Array(await response.arrayBuffer());
  };
  const [clipping, fitting] = await Promise.all([
    load('geometry-clip.wasm').then(createGeometryClipping),
    load('geometry-fit.wasm').then(bytes => createGeometryFitting(bytes, 'host')),
  ]);
  return qualifyGeometryOperations({ clipping, fitting });
}
