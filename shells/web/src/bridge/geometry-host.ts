// SPDX-License-Identifier: MPL-2.0
/** Geometry modules are loaded before publishing a selected synchronous host API. */
import { createGeometryHost, geometryBackendOf, isGeometryBackend, type GeometryBackend } from '@lolly-tools/node-shell/geometry-host';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createGeometryClipping } from '@lolly-tools/node-shell/geometry-clipping';
import { createGeometryFitting } from '@lolly-tools/node-shell/geometry-fitting';
import { createGeometryOperationScope } from '@lolly-tools/node-shell/geometry-operation-scope';
import type { GeometryOperations } from '../../../../engine/src/geom/operations.ts';
export type { GeometryBackend } from '@lolly-tools/node-shell/geometry-host';
export { geometryBackendOf, geometrySelectionIsStrict } from '@lolly-tools/node-shell/geometry-host';
const installations = new WeakMap<HostV1, { backend: GeometryBackend; promise: Promise<void> }>();

async function bytes(url: URL): Promise<Uint8Array<ArrayBuffer>> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw Error(`Geometry module loading failed (${response.status}).`);
  const buffer = await response.arrayBuffer();
  if (!buffer.byteLength || buffer.byteLength > 512 * 1024) throw Error('Geometry module size is outside the supported range.');
  return new Uint8Array(buffer);
}

type Kernels = { clipping: Awaited<ReturnType<typeof createGeometryClipping>>; fitting: Awaited<ReturnType<typeof createGeometryFitting>> };
// One compiled pair per realm: every host and editor operation shares it; each call owns its workspaces.
let kernels: Promise<Kernels> | undefined, loaded: Kernels | undefined;
function loadKernels(): Promise<Kernels> {
  kernels ??= Promise.all([
    bytes(new URL('../../../../packages/node-shell/wasm/geometry-kernel/geometry-clip.wasm', import.meta.url)).then(createGeometryClipping),
    bytes(new URL('../../../../packages/node-shell/wasm/geometry-kernel/geometry-fit-portable.wasm', import.meta.url)).then(createGeometryFitting),
  ]).then(([clipping, fitting]) => (loaded = { clipping, fitting }))
    .catch((error: unknown) => { kernels = undefined; throw error; });
  return kernels;
}

/** An explicit selection: loading failures and kernel refusals stay visible. */
export async function loadWebGeometryHost(backend: GeometryBackend = 'typescript') {
  if (!isGeometryBackend(backend)) throw Error('Unknown geometry backend.');
  if (backend === 'typescript') return createGeometryHost();
  return createGeometryHost(await loadKernels());
}

/**
 * The default: the portable kernels when they load, otherwise the TypeScript reference.
 * Both return the same bits, so the fallback changes speed only.
 */
export async function loadDefaultWebGeometryHost() {
  try { return { ...createGeometryHost(await loadKernels(), { strict: false }), loadError: undefined }; }
  catch (error) { return { ...createGeometryHost(), loadError: error instanceof Error ? error.message : String(error) }; }
}

/** Start loading the kernels for editor operations without waiting for them. */
export function preloadGeometryKernels(): void {
  void loadKernels().catch(() => { /* editor operations keep using the reference */ });
}

/**
 * Run one synchronous editor operation with the portable kernels when they have loaded.
 * A kernel's own buffer refusal reruns the operation on the reference, which returns the
 * same bits; before the kernels load, the reference runs directly.
 */
export function withGeometryOperations<T>(run: (operations?: GeometryOperations) => T): T {
  if (!loaded) return run(undefined);
  const owner = createGeometryOperationScope(loaded);
  let result: T;
  try { result = run(owner.operations); }
  finally { owner.dispose(); }
  return owner.stats().refusals ? run(undefined) : result;
}

async function install(host: HostV1, backend: GeometryBackend, load: () => Promise<ReturnType<typeof createGeometryHost>>): Promise<void> {
  if (host.geom) {
    if (geometryBackendOf(host.geom) !== backend) throw Error('Geometry selection must precede installation on this host.');
    return;
  }
  let pending = installations.get(host);
  if (pending && pending.backend !== backend) throw Error('This host is already installing a different geometry backend.');
  if (!pending) {
    pending = { backend, promise: load().then(owner => {
      if (host.geom && geometryBackendOf(host.geom) !== owner.backend) { owner.dispose(); throw Error('Geometry selection changed while loading.'); }
      host.geom ??= owner.api;
    }) };
    installations.set(host, pending);
  }
  try { await pending.promise; }
  finally { if (installations.get(host) === pending) installations.delete(host); }
}

export async function installWebGeometryApi(host: HostV1, backend: GeometryBackend): Promise<void> {
  if (!isGeometryBackend(backend)) throw Error('Unknown geometry backend.');
  await install(host, backend, () => loadWebGeometryHost(backend));
}

/** Install the default geometry; a kernel loading failure is logged and the reference is used. */
export async function installDefaultWebGeometryApi(host: HostV1): Promise<void> {
  if (host.geom) return;
  await install(host, 'wasm-portable', async () => {
    const owner = await loadDefaultWebGeometryHost();
    if (owner.loadError) host.log?.('warn', 'Geometry kernels did not load; the TypeScript reference returns the same results.', { message: owner.loadError });
    return owner;
  });
}
