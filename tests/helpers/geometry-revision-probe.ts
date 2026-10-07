// SPDX-License-Identifier: MPL-2.0
/** Digests a realm computes for the pinned scalar set and the complete geometry workflows. */
import * as pmath from '../../engine/src/geom/portable-math.ts';
import { geometryRevisionRecord, portableMathResults } from './portable-math-cases.ts';

const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
export async function probeGeometryRevision(): Promise<{ scalar: string; workflows: string }> {
  const scalar = hex(await crypto.subtle.digest('SHA-256', portableMathResults(pmath).buffer));
  const workflows = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(await geometryRevisionRecord())));
  return { scalar, workflows };
}
