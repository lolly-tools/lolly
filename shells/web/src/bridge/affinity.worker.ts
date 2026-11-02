// SPDX-License-Identifier: MPL-2.0
/** Reads a native Affinity file off the main thread. Cancelling terminates this worker. */
import { createAffinityKernel, AffinityError, type AffinityKernel } from '@lolly-tools/node-shell/affinity';
import wasmUrl from '@lolly-tools/node-shell/affinity.wasm?url';
import type { AffinityWorkerReply, AffinityWorkerRequest } from './affinity-protocol.ts';

const scope = globalThis;
let kernel: Promise<AffinityKernel> | undefined;
// Only the worker entry installs a message handler, in case a bundler shares this chunk.
if (typeof document === 'undefined') scope.onmessage = async ({ data }: MessageEvent<AffinityWorkerRequest>) => {
  let reply: AffinityWorkerReply;
  const transfer: ArrayBuffer[] = [];
  try {
    kernel ??= (async () => {
      const response = await fetch(wasmUrl);
      if (!response.ok) throw new Error('The Affinity reader could not be loaded.');
      return createAffinityKernel(new Uint8Array(await response.arrayBuffer()));
    })();
    const loaded = await kernel.catch(error => { kernel = undefined; throw error; });
    const inspection = loaded.inspect(data.bytes, data.name);
    reply = { id: data.id, ok: true, inspection };
    try {
      const { model, payload } = loaded.model(data.bytes);
      reply = { id: data.id, ok: true, inspection, model, payload };
      transfer.push(payload.buffer as ArrayBuffer);
    } catch (error) {
      // A crash retires the instance, so it is reported as a failure, not as a stage 1 result.
      if (error instanceof AffinityError && error.code === 'crashed') throw error;
      reply = { id: data.id, ok: true, inspection, modelError: error instanceof Error ? error.message : String(error) };
    }
    if (inspection.preview) transfer.push(inspection.preview.png.buffer as ArrayBuffer);
  } catch (error) {
    reply = { id: data.id, ok: false, code: error instanceof AffinityError ? error.code : 'failed', error: error instanceof Error ? error.message : String(error) };
  }
  scope.postMessage(reply, { transfer });
};
