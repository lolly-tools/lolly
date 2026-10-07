// SPDX-License-Identifier: MPL-2.0
import {
  createGeometryKernel,
  GeometryKernelError,
  type GeometryPolynomial,
  type GeometryRoots,
} from '../../packages/node-shell/src/geometry-kernel.ts';
import { makeGeomApi } from '../../engine/src/geom-api.ts';
import type { Cubic } from '../../engine/src/geom/bezier.ts';
import { spatialCases } from './geometry-spatial-cases.ts';
import { referenceRoots } from './geometry-root-cases.ts';
import { castRay } from '../../engine/src/geom/ray-cast.ts';
import type { RayWire } from './geometry-ray-cases.ts';
import { createRayBackend } from './geometry-ray-backend.ts';
import { setRayProbe } from './geometry-ray-control.ts';
import { rayWorkflows } from './geometry-ray-workflows.ts';
import type { OffsetErrorCase } from './geometry-offset-error-cases.ts';
import { offsetError } from '../../engine/src/geom/offset-error.ts';
import { setOffsetErrorProbe } from './geometry-offset-error-control.ts';
import { createOffsetErrorBackend } from './geometry-offset-error-backend.ts';
import { geometryStageWorkflows } from './geometry-stage-workflows.ts';

export interface GeometryWorkload {
  curves: Cubic[];
  d: string;
  points: [number, number][];
}

/** The shell owns byte loading; both browser realms use the same prepared-query adapter. */
export async function probeGeometry(
  workloads: GeometryWorkload[],
  coefficients: GeometryPolynomial[],
  rayInputs: RayWire[],
  offsetInputs: OffsetErrorCase[]
) {
  const bytes = new Uint8Array(await (await fetch('/geometry-kernel.wasm')).arrayBuffer());
  const kernel = await createGeometryKernel(bytes),
    api = makeGeomApi();
  const rows = workloads.map(({ curves, d, points }) => {
    const path = kernel.prepare(curves);
    try {
      const results = path.nearestBatch(points);
      const individual = points.map(([x, y]) => path.nearest(x, y));
      const bridge = points.map(([x, y]) => api.nearest(d, x, y));
      let invalid = '';
      try {
        path.nearest(Number.NaN, 0);
      } catch (error) {
        if (!(error instanceof GeometryKernelError)) throw error;
        invalid = error.code;
      }
      return { results, individual, bridge, invalid };
    } finally {
      path.dispose();
    }
  });
  const spatial = spatialCases().map(({ name, curves, weld }) => {
    const path = kernel.prepare(curves);
    try {
      return { name, pairs: path.nearPairs(weld) };
    } finally {
      path.dispose();
    }
  });
  const rootWorkspace = kernel.createRootWorkspace();
  let roots: GeometryRoots[];
  try {
    roots = rootWorkspace.solve(coefficients);
  } finally {
    rootWorkspace.dispose();
  }
  const rays = rayInputs.map((row) => {
    const path = kernel.prepareRayIndex(row.index),
      budget = { work: row.work },
      referenceBudget = { work: row.work };
    const bundle = row.bundle ? new Map(row.bundle) : null;
    try {
      const reference = castRay(
        row.index,
        ...row.point,
        ...row.direction,
        row.ref,
        row.near,
        referenceBudget,
        row.complete,
        bundle
      );
      const actual = path.cast(
        ...row.point,
        ...row.direction,
        row.ref,
        row.near,
        budget,
        row.complete,
        bundle
      );
      return {
        name: row.name,
        actual,
        reference,
        work: budget.work,
        referenceWork: referenceBudget.work,
      };
    } finally {
      path.dispose();
    }
  });
  const workflows = rayWorkflows().map((row) => {
    setRayProbe(undefined);
    const reference = row.run(api),
      backend = createRayBackend(kernel);
    try {
      setRayProbe(backend.cast);
      const actual = row.run(api);
      return { name: row.name, actual, reference, backend: backend.stats() };
    } finally {
      setRayProbe(undefined);
      backend.dispose();
    }
  });
  const offsetWorkspace = kernel.createOffsetErrorWorkspace();
  let offsetErrors: {
    name: string;
    actual: ReturnType<typeof offsetError>;
    reference: ReturnType<typeof offsetError>;
  }[];
  try {
    offsetErrors = offsetInputs.map((row) => ({
      name: row.name,
      actual: offsetWorkspace.verify(row.src, row.approx, row.distance, row.tol),
      reference: offsetError(row.src, row.approx, row.distance, row.tol),
    }));
  } finally {
    offsetWorkspace.dispose();
  }
  const offsetWorkflows = geometryStageWorkflows()
    .filter((row) => row.kind === 'bridge')
    .map((row) => {
      setOffsetErrorProbe(undefined);
      const reference = row.run(),
        backend = createOffsetErrorBackend(kernel);
      try {
        setOffsetErrorProbe(backend.verify);
        return { name: row.id, reference, actual: row.run(), backend: backend.stats() };
      } finally {
        setOffsetErrorProbe(undefined);
        backend.dispose();
      }
    });
  return {
    rows,
    spatial,
    roots,
    referenceRoots: coefficients.map(referenceRoots),
    rays,
    workflows,
    offsetErrors,
    offsetWorkflows,
    afterDispose: kernel.stats(),
  };
}
