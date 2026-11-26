// SPDX-License-Identifier: MPL-2.0
/**
 * Worker-thread entry for one WOFF2 decode in Node (see woff2-node.ts). The thread
 * loads its own copy of the decoder module, decodes the one font in `workerData` and
 * exits, so nothing left in that module's memory reaches the next font.
 */
import { parentPort, workerData } from 'node:worker_threads';
import decompress from 'woff2-encoder/decompress';
import type { Woff2WorkerReply } from './woff2.ts';

const port = parentPort;
if (port) {
  try {
    const out = await decompress(workerData as Uint8Array);
    port.postMessage({ out } satisfies Woff2WorkerReply, [out.buffer as ArrayBuffer]);
  } catch (error) {
    port.postMessage({ error: error instanceof Error ? error.message : String(error) } satisfies Woff2WorkerReply);
  }
}
