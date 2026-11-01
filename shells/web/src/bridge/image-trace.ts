// SPDX-License-Identifier: MPL-2.0
import { createImageTraceKernel, type ImageTraceKernel } from '@lolly-tools/node-shell/image-trace';
import type { ImageTracePreset, ImageTraceResult } from '../../../../engine/src/image-trace.ts';
import { createImageTraceWorkerClient, type ImageTraceStage } from './image-trace-worker-client.ts';

let client: ReturnType<typeof createImageTraceWorkerClient> | undefined;

/**
 * Trace on a module worker so a large image never blocks the page. The pixel buffer is
 * transferred and detached for the caller. Aborting the signal, or calling cancelImageTrace,
 * terminates the worker; the next call starts a new one. Without Worker support it runs on the
 * main thread.
 */
export function traceImageOffThread(
  rgba: Uint8Array, width: number, height: number, preset: ImageTracePreset, signal?: AbortSignal, onStage?: (stage: ImageTraceStage) => void,
): Promise<ImageTraceResult> {
  if (typeof Worker === 'undefined') return traceImageOnMainThread(rgba, width, height, preset);
  client ??= createImageTraceWorkerClient({
    createWorker: () => new Worker(new URL('./image-trace.worker.ts', import.meta.url), { type: 'module' }),
  });
  return client.trace(rgba, width, height, preset, signal, onStage);
}

/** Terminate any running trace, for example when the user cancels. */
export function cancelImageTrace(): void { client?.cancel(); }

let pending: Promise<ImageTraceKernel> | undefined;
/** The main-thread fallback for environments with no Worker. */
export async function traceImageOnMainThread(rgba: Uint8Array, width: number, height: number, preset: ImageTracePreset): Promise<ImageTraceResult> {
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/image-trace/image-trace.wasm', import.meta.url));
    if (!response.ok) throw new Error('The image tracer could not be loaded.');
    return createImageTraceKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  return (await pending).trace(rgba, width, height, preset);
}
