// SPDX-License-Identifier: MPL-2.0
import { createAffinityKernel, type AffinityKernel } from '@lolly-tools/node-shell/affinity';
import { createAffinityWorkerClient } from './affinity-worker-client.ts';
import type { AffinityRead } from './affinity-protocol.ts';

let client: ReturnType<typeof createAffinityWorkerClient> | undefined;

/**
 * Read a native Affinity file on a module worker so a large file never blocks the page. The input
 * buffer is transferred and detached for the caller. Aborting the signal, or calling
 * cancelAffinityRead, terminates the worker; the next call starts a new one. Without Worker
 * support it falls back to readAffinityOnMainThread.
 */
export function readAffinityOffThread(bytes: Uint8Array, name: string, signal?: AbortSignal): Promise<AffinityRead> {
  if (typeof Worker === 'undefined') return readAffinityOnMainThread(bytes, name);
  client ??= createAffinityWorkerClient({
    createWorker: () => new Worker(new URL('./affinity.worker.ts', import.meta.url), { type: 'module' }),
  });
  return client.read(bytes, name, signal);
}

/** Terminate any running read, for example when the import dialog closes. */
export function cancelAffinityRead(): void { client?.cancel(); }

let pending: Promise<AffinityKernel> | undefined;
/** The main-thread fallback for environments with no Worker. A crashed instance is replaced on the next call. */
export async function readAffinityOnMainThread(bytes: Uint8Array, name: string): Promise<AffinityRead> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (!kernel || kernel.dead) pending = undefined;
  }
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/affinity/affinity.wasm', import.meta.url));
    if (!response.ok) throw new Error('The Affinity reader could not be loaded.');
    return createAffinityKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  const kernel = await pending;
  const inspection = kernel.inspect(bytes, name);
  try {
    const { model, payload } = kernel.model(bytes);
    return { inspection, model, payload };
  } catch (error) {
    if (kernel.dead) throw error;
    return { inspection, modelError: error instanceof Error ? error.message : String(error) };
  }
}
