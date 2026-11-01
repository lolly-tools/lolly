// SPDX-License-Identifier: MPL-2.0
/** Traces an image off the main thread. Cancelling terminates this worker. */
import { createImageTraceKernel, type ImageTraceKernel } from '@lolly-tools/node-shell/image-trace';
import wasmUrl from '@lolly-tools/node-shell/image-trace.wasm?url';
import { ImageTraceError } from '../../../../engine/src/image-trace.ts';
import type { ImageTraceWorkerReply, ImageTraceWorkerRequest } from './image-trace-protocol.ts';

const scope = globalThis;
let kernel: Promise<ImageTraceKernel> | undefined;
// Only the worker entry installs a message handler, in case a bundler shares this chunk.
if (typeof document === 'undefined') scope.onmessage = async ({ data }: MessageEvent<ImageTraceWorkerRequest>) => {
  let reply: ImageTraceWorkerReply;
  try {
    kernel ??= (async () => {
      const response = await fetch(wasmUrl);
      if (!response.ok) throw new ImageTraceError('failed', 'The image tracer could not be loaded.');
      return createImageTraceKernel(new Uint8Array(await response.arrayBuffer()));
    })();
    const loaded = await kernel.catch(error => { kernel = undefined; throw error; });
    scope.postMessage({ id: data.id, stage: 'tracing' } satisfies ImageTraceWorkerReply);
    reply = { id: data.id, ok: true, json: loaded.traceBytes(data.rgba, data.width, data.height, data.preset) };
  } catch (error) {
    const code = error instanceof ImageTraceError && error.code !== 'cancelled' ? error.code : 'failed';
    reply = { id: data.id, ok: false, code, error: error instanceof Error ? error.message : String(error) };
  }
  scope.postMessage(reply, { transfer: reply.ok ? [reply.json.buffer as ArrayBuffer] : [] });
};
