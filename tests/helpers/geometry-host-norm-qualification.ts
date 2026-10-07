// SPDX-License-Identifier: MPL-2.0
/** Exact local reference checks keep browser arithmetic differences visible. */
import type { createGeometryClipping } from '../../packages/node-shell/src/geometry-clipping.ts';
import type { createGeometryFitting } from '../../packages/node-shell/src/geometry-fitting.ts';
import type { ClipWireCase } from './geometry-clip-cases.ts';
import type { OffsetFitCase } from './geometry-offset-fit-cases.ts';
import { qualifyClipping } from './geometry-clip-qualification.ts';
import { getOffsetFitReference } from './geometry-offset-fit-control.ts';
import { qualifyGeometryOperations } from './geometry-operation-qualification.ts';
import { pieceBits } from './geometry-portable-fit-compatibility.ts';
import { floatBits } from './geometry-portable-math-cases.ts';

export interface HostNormInputs { clipping: ClipWireCase[]; fitting: OffsetFitCase[] }
export function qualifyHostNorm(clipping: Awaited<ReturnType<typeof createGeometryClipping>>, fitting: Awaited<ReturnType<typeof createGeometryFitting>>, inputs: HostNormInputs) {
  const reference = getOffsetFitReference(), workspace = fitting.createOffsetFitWorkspace();
  const fits = (() => {
    try { return inputs.fitting.map(row => ({ name: row.name, reference: pieceBits(reference(row.src, row.distance, row.tol)), actual: pieceBits(workspace.fit(row.src, row.distance, row.tol)) })); }
    finally { workspace.dispose(); }
  })();
  const pairs = qualifyClipping(clipping, inputs.clipping), operations = qualifyGeometryOperations({ clipping, fitting });
  // The first pair is the start derivative of the smooth fitting fixture.
  const witnesses = [[180, 600], [80, 30], [1, 2], [3, 4], [92.5, -73.25], [1e-12, 1e3], [-0, 0]].map(([x, y]) => {
    const ax = Math.abs(x!), ay = Math.abs(y!), largest = Math.max(ax, ay);
    const a = ax / largest, b = ay / largest;
    const scaled = largest === 0 ? 0 : Math.sqrt(a * a + b * b) * largest;
    return { inputs: [floatBits(x!), floatBits(y!)], host: floatBits(Math.hypot(x!, y!)), retained: floatBits(scaled) };
  });
  return { fits, pairs, operations, witnesses };
}

export async function probeHostNorm(inputs: HostNormInputs) {
  const [{ createGeometryClipping }, { createGeometryFitting }] = await Promise.all([
    import('../../packages/node-shell/src/geometry-clipping.ts'), import('../../packages/node-shell/src/geometry-fitting.ts'),
  ]);
  const [clip, fit] = await Promise.all(['clip', 'fit'].map(async name => new Uint8Array(await (await fetch(`/geometry-${name}-host-norm.wasm`)).arrayBuffer())));
  return qualifyHostNorm(await createGeometryClipping(clip!, 'host-norm'), await createGeometryFitting(fit!, 'host-norm'), inputs);
}
