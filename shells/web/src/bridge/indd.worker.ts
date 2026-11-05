// SPDX-License-Identifier: MPL-2.0
/** Converts a native InDesign file to IDML off the main thread. Cancelling terminates this worker. */
import { createInddKernel, InddError, type InddKernel } from '@lolly-tools/node-shell/indd';
import wasmUrl from '@lolly-tools/node-shell/indd.wasm?url';
import type { InddWorkerReply, InddWorkerRequest } from './indd-protocol.ts';

const scope = globalThis;
let kernel: Promise<InddKernel> | undefined;
// Only the worker entry installs a message handler, in case a bundler shares this chunk.
if (typeof document === 'undefined') scope.onmessage = async ({ data }: MessageEvent<InddWorkerRequest>) => {
  let reply: InddWorkerReply;
  try {
    kernel ??= (async () => {
      const response = await fetch(wasmUrl);
      if (!response.ok) throw new Error('The InDesign converter could not be loaded.');
      return createInddKernel(new Uint8Array(await response.arrayBuffer()));
    })();
    const loaded = await kernel.catch(error => { kernel = undefined; throw error; });
    const result = loaded.convert(data.bytes, data.name);
    reply = { id: data.id, ok: true, idml: result.idml, warnings: result.warnings };
  } catch (error) {
    reply = { id: data.id, ok: false, code: error instanceof InddError ? error.code : 'failed', error: error instanceof Error ? error.message : String(error) };
  }
  scope.postMessage(reply, { transfer: reply.ok ? [reply.idml.buffer as ArrayBuffer] : [] });
};
