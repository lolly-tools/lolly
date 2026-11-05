// SPDX-License-Identifier: MPL-2.0
/**
 * Camera raw development for the web shell. The decoder is a WASM module on a worker; this file is
 * the only place the shell touches the decoder. Everything runs on the device.
 */
import { createCameraRawKernel, looksLikeCameraRaw, type CameraRawKernel, type CameraRawQuality } from '@lolly-tools/node-shell/camera-raw';
import { createCameraRawWorkerClient } from './camera-raw-worker-client.ts';
import type { CameraRawJob, CameraRawResult } from './camera-raw-protocol.ts';

export { looksLikeCameraRaw };
export type { CameraRawResult };

let client: ReturnType<typeof createCameraRawWorkerClient> | undefined;

/** Read the first bytes of a file and decide, with its name and type, whether it is a camera raw file. */
export async function isCameraRawFile(file: Blob & { name?: string }): Promise<boolean> {
  try { return looksLikeCameraRaw(new Uint8Array(await file.slice(0, 16).arrayBuffer()), file.name, file.type); }
  catch { return false; }
}

let pending: Promise<CameraRawKernel> | undefined;
async function mainThread(bytes: Uint8Array, job: CameraRawJob, quality: CameraRawQuality): Promise<CameraRawResult> {
  if (pending) {
    const kernel = await pending.catch(() => undefined);
    if (!kernel || kernel.dead) pending = undefined;
  }
  pending ??= (async () => {
    const response = await fetch(new URL('../../../../packages/node-shell/wasm/camera-raw/camera-raw.wasm', import.meta.url));
    if (!response.ok) throw new Error('The camera raw decoder could not be loaded.');
    return createCameraRawKernel(new Uint8Array(await response.arrayBuffer()));
  })().catch(error => { pending = undefined; throw error; });
  const kernel = await pending;
  if (job === 'probe') { const meta = kernel.probe(bytes); return { width: meta.width, height: meta.height, meta }; }
  const image = job === 'linear' ? kernel.developLinear(bytes, quality) : kernel.open(bytes, quality);
  return { width: image.width, height: image.height, meta: image.meta, ...(image.linear16 ? { linear16: image.linear16 as Uint16Array<ArrayBuffer> } : {}), ...(image.rgba8 ? { rgba8: image.rgba8 } : {}) };
}

/**
 * Develop a raw file on a worker. The input buffer is transferred and detached for the caller.
 * Aborting the signal, or calling cancelCameraRaw, terminates the worker; the next call starts a new one.
 * Without Worker support it runs on the main thread.
 */
export function developCameraRaw(bytes: Uint8Array, job: CameraRawJob = 'open', quality: CameraRawQuality = 'best', signal?: AbortSignal): Promise<CameraRawResult> {
  if (typeof Worker === 'undefined') return mainThread(bytes, job, quality);
  client ??= createCameraRawWorkerClient({
    createWorker: () => new Worker(new URL('./camera-raw.worker.ts', import.meta.url), { type: 'module' }),
  });
  return client.run(bytes, job, quality, signal);
}

/** Terminate any running development, for example when the import dialog closes. */
export function cancelCameraRaw(): void { client?.cancel(); }

/** The developed display picture as an ImageBitmap (orientation is already applied). */
export async function cameraRawBitmap(result: CameraRawResult): Promise<ImageBitmap> {
  if (!result.rgba8) throw new Error('This result has no display picture.');
  return createImageBitmap(new ImageData(result.rgba8, result.width, result.height));
}
