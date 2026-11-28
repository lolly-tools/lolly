// SPDX-License-Identifier: MPL-2.0
/**
 * Worker-thread entry for one WOFF2 decode in Node (see woff2-node.ts). The thread gets
 * the compiled decoder module and the one font in `workerData`, decodes the font in a
 * fresh instance and exits, so nothing left in that instance's memory reaches the next font.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { decodeWithWoff2Kernel } from './woff2-kernel.ts';
import type { Woff2WorkerReply, Woff2WorkerRequest } from './woff2.ts';

const port = parentPort;
if (port) {
  try {
    const { module, bytes } = workerData as Woff2WorkerRequest;
    const out = await decodeWithWoff2Kernel(module, bytes);
    port.postMessage({ out } satisfies Woff2WorkerReply, [out.buffer as ArrayBuffer]);
  } catch (error) {
    port.postMessage({ error: error instanceof Error ? error.message : String(error) } satisfies Woff2WorkerReply);
  }
}
