// SPDX-License-Identifier: MPL-2.0
/** Develops a camera raw file off the main thread. Cancelling terminates this worker. */
import { createCameraRawKernel, CameraRawError, type CameraRawKernel } from '@lolly-tools/node-shell/camera-raw';
import wasmUrl from '@lolly-tools/node-shell/camera-raw.wasm?url';
import type { CameraRawWorkerReply, CameraRawWorkerRequest } from './camera-raw-protocol.ts';

const scope = globalThis;
let kernel: Promise<CameraRawKernel> | undefined;
// Only the worker entry installs a message handler, in case a bundler shares this chunk.
if (typeof document === 'undefined') scope.onmessage = async ({ data }: MessageEvent<CameraRawWorkerRequest>) => {
  let reply: CameraRawWorkerReply;
  let transfer: Transferable[] = [];
  try {
    kernel ??= (async () => {
      const response = await fetch(wasmUrl);
      if (!response.ok) throw new Error('The camera raw decoder could not be loaded.');
      return createCameraRawKernel(new Uint8Array(await response.arrayBuffer()));
    })();
    const loaded = await kernel.catch(error => { kernel = undefined; throw error; });
    if (data.job === 'probe') {
      const meta = loaded.probe(data.bytes);
      reply = { id: data.id, ok: true, width: meta.width, height: meta.height, meta, pixels: null };
    } else {
      const image = data.job === 'linear' ? loaded.developLinear(data.bytes, data.quality) : loaded.open(data.bytes, data.quality);
      const pixels = (image.linear16 ?? image.rgba8)!.buffer as ArrayBuffer;
      transfer = [pixels];
      reply = { id: data.id, ok: true, width: image.width, height: image.height, meta: image.meta, pixels };
    }
  } catch (error) {
    reply = { id: data.id, ok: false, code: error instanceof CameraRawError ? error.code : 'failed', error: error instanceof Error ? error.message : String(error) };
  }
  scope.postMessage(reply, { transfer });
};
