// SPDX-License-Identifier: MPL-2.0
/** Geometry modules are loaded before publishing a selected synchronous host API. */
import { createGeometryHost, geometryBackendModules, geometryBackendOf, isGeometryBackend, type GeometryBackend } from '@lolly-tools/node-shell/geometry-host';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createGeometryClipping } from '@lolly-tools/node-shell/geometry-clipping';
import { createGeometryFitting } from '@lolly-tools/node-shell/geometry-fitting';
export type { GeometryBackend } from '@lolly-tools/node-shell/geometry-host';
export { geometryBackendOf } from '@lolly-tools/node-shell/geometry-host';
const installations = new WeakMap<HostV1, { backend: GeometryBackend; promise: Promise<void> }>();

async function bytes(url: URL): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw Error(`Geometry module loading failed (${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > 512 * 1024) throw Error('Geometry module size is outside the supported range.');
  return new Uint8Array(buffer);
}
export async function loadWebGeometryHost(backend: GeometryBackend = 'typescript') {
  if (!isGeometryBackend(backend)) throw Error('Unknown geometry backend.');
  if (backend === 'typescript') return createGeometryHost();
  const { norm, fitting: useFitting, curvesOnly } = geometryBackendModules(backend);
  const clipping = await createGeometryClipping(await bytes(norm
    ? new URL('../../../../packages/node-shell/wasm/geometry-kernel/geometry-clip-host-norm.wasm', import.meta.url)
    : new URL('../../../../packages/node-shell/wasm/geometry-kernel/geometry-clip.wasm', import.meta.url)), norm ? 'host-norm' : 'retained');
  const fitting = useFitting && norm
    ? await createGeometryFitting(await bytes(new URL('../../../../packages/node-shell/wasm/geometry-kernel/geometry-fit-host-norm.wasm', import.meta.url)), 'host-norm') : useFitting
    ? await createGeometryFitting(await bytes(new URL('../../../../packages/node-shell/wasm/geometry-kernel/geometry-fit.wasm', import.meta.url)), 'host') : undefined;
  return createGeometryHost({ clipping, fitting }, curvesOnly ? 'curves' : 'all');
}

export async function installWebGeometryApi(host: HostV1, backend: GeometryBackend): Promise<void> {
  if (!isGeometryBackend(backend)) throw Error('Unknown geometry backend.');
  if (host.geom) {
    if (geometryBackendOf(host.geom) !== backend) throw Error('Geometry selection must precede installation on this host.');
    return;
  }
  let pending = installations.get(host);
  if (pending && pending.backend !== backend) throw Error('This host is already installing a different geometry backend.');
  if (!pending) {
    pending = { backend, promise: loadWebGeometryHost(backend).then(owner => {
      if (host.geom && geometryBackendOf(host.geom) !== backend) { owner.dispose(); throw Error('Geometry selection changed while loading.'); }
      host.geom ??= owner.api;
    }) };
    installations.set(host, pending);
  }
  try { await pending.promise; }
  finally { if (installations.get(host) === pending) installations.delete(host); }
}
