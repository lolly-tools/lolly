// SPDX-License-Identifier: MPL-2.0
/**
 * Web Worker entry for one WOFF2 decode (see woff2.ts). The page starts one worker per
 * font and ends the worker after the reply, so every decode gets a fresh copy of the
 * decoder module and nothing left in its memory reaches the next font.
 */
import decompress from 'woff2-encoder/decompress';
import type { Woff2WorkerReply } from './woff2.ts';

interface DecodeScope {
  onmessage: ((event: MessageEvent<Uint8Array>) => void) | null;
  postMessage(message: Woff2WorkerReply, transfer?: Transferable[]): void;
}
const scope = self as unknown as DecodeScope;

// Assigned rather than added: WebKit can evaluate a worker entry twice, and a second
// evaluation then replaces the handler instead of answering a second time.
scope.onmessage = async ({ data }) => {
  try {
    const out = await decompress(data);
    scope.postMessage({ out }, [out.buffer]);
  } catch (error) {
    scope.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
