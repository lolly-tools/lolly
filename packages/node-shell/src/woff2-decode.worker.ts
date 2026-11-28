// SPDX-License-Identifier: MPL-2.0
/**
 * Web Worker entry for one WOFF2 decode (see woff2.ts). The page compiles the decoder
 * module once, starts one worker per font and ends the worker after the reply, so every
 * decode runs in a fresh instance and nothing left in its memory reaches the next font.
 */
import { decodeWithWoff2Kernel } from './woff2-kernel.ts';
import type { Woff2WorkerReply, Woff2WorkerRequest } from './woff2.ts';

interface DecodeScope {
  onmessage: ((event: MessageEvent<Woff2WorkerRequest>) => void) | null;
  postMessage(message: Woff2WorkerReply, transfer?: Transferable[]): void;
}
const scope = self as unknown as DecodeScope;

// Assigned rather than added: WebKit can evaluate a worker entry twice, and a second
// evaluation then replaces the handler instead of answering a second time.
scope.onmessage = async ({ data }) => {
  try {
    const out = await decodeWithWoff2Kernel(data.module, data.bytes);
    scope.postMessage({ out }, [out.buffer]);
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
