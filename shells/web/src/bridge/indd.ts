// SPDX-License-Identifier: MPL-2.0
import { createInddKernel, type InddConversion, type InddKernel } from '@lolly-tools/node-shell/indd';
import { createInddWorkerClient } from './indd-worker-client.ts';

let client: ReturnType<typeof createInddWorkerClient> | undefined;

/**
 * Convert on a module worker so a large file never blocks the page. The input buffer is
 * transferred and detached for the caller. Aborting the signal, or calling cancelInddConversion,
 * terminates the worker; the next call starts a new one. Without Worker support it falls back to
 * convertInddOnMainThread.
 */
export function convertInddOffThread(bytes: Uint8Array, name: string, signal?: AbortSignal): Promise<InddConversion> {
  if (typeof Worker === 'undefined') return convertInddOnMainThread(bytes, name);
  client ??= createInddWorkerClient({
    createWorker: () => new Worker(new URL('./indd.worker.ts', import.meta.url), { type: 'module' }),
  });
  return client.convert(bytes, name, signal);
}

/** Terminate any running conversion, for example when the import dialog closes. */
export function cancelInddConversion(): void { client?.cancel(); }

let pending: Promise<InddKernel> | undefined;
/** The main-thread fallback for environments with no Worker. A crashed instance is replaced on the next call. */
export async function convertInddOnMainThread(bytes: Uint8Array, name: string): Promise<InddConversion> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (!kernel || kernel.dead) pending = undefined;
  }
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/indd/indd.wasm', import.meta.url));
    if (!response.ok) throw new Error('The InDesign converter could not be loaded.');
    return createInddKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  return (await pending).convert(bytes, name);
}
