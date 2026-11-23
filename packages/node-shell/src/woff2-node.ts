// SPDX-License-Identifier: MPL-2.0
/**
 * Node's WOFF2 runner: each decode in its own worker thread, with its own copy of the
 * decoder module, ended after the one font or when the time limit passes. The Node-only
 * callers pass `nodeWoff2Runner` to `decodeWoff2`; `createNodeTextAPI` (text.ts) calls
 * `useNodeWoff2Runner()`, so the shared callers (page-text.ts, text-fonts.ts) get it
 * too in every Node host that outlines text. A call, not an import side effect: the
 * package declares `sideEffects: false`, so bundlers drop side-effect-only imports.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { setWoff2Runner, Woff2Error, type Woff2Runner, type Woff2WorkerReply } from './woff2.ts';

/**
 * The thread's entry. From source it is woff2-worker.ts beside this file; in a
 * bundled serverless function scripts/build-mcp-fn.ts writes it beside the bundle
 * as `_woff2-worker.js` (the underscore keeps it from becoming a route).
 */
function workerUrl(): URL {
  const candidates = [new URL('./woff2-worker.ts', import.meta.url), new URL('./_woff2-worker.js', import.meta.url)];
  for (const url of candidates) {
    if (url.protocol === 'file:' && existsSync(fileURLToPath(url))) return url;
  }
  throw new Woff2Error('decode-failed', 'The WOFF2 decoder is missing from this installation, so the font was not decoded.');
}

export const nodeWoff2Runner: Woff2Runner = (bytes, { timeoutMs, signal }) => new Promise((resolve, reject) => {
  signal?.throwIfAborted();
  const copy = bytes.slice();
  let worker: Worker;
  try {
    worker = new Worker(workerUrl(), {
      workerData: copy,
      transferList: [copy.buffer],
      env: {},
      execArgv: [],
      // Kept off this process's stdout, which is the payload (CLI) or the JSON-RPC
      // channel (MCP over stdio); the decoder prints to stderr when it aborts.
      stdout: true,
      stderr: true,
    });
  } catch (error) {
    reject(error instanceof Woff2Error ? error : new Woff2Error('decode-failed', 'The WOFF2 decoder could not start.', { cause: error }));
    return;
  }
  worker.stdout.resume();
  worker.stderr.resume();
  let settled = false;
  const finish = (error: unknown, out?: Uint8Array): void => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    void worker.terminate();
    if (out) resolve(out); else reject(error);
  };
  const abort = (): void => finish(signal?.reason ?? new Woff2Error('decode-failed', 'The WOFF2 decode was cancelled.'));
  const timer = setTimeout(() => finish(new Woff2Error('timed-out', 'This WOFF2 font took too long to decode.')), timeoutMs);
  signal?.addEventListener('abort', abort, { once: true });
  worker.once('message', (reply: Woff2WorkerReply) => finish(new Woff2Error('decode-failed', reply.error ?? 'The WOFF2 decoder returned nothing.'), reply.out));
  worker.once('error', (error) => finish(new Woff2Error('decode-failed', 'The WOFF2 decoder stopped.', { cause: error })));
  worker.once('exit', (code) => finish(new Woff2Error('decode-failed', `The WOFF2 decoder stopped (${code}).`)));
});

/** Make the worker-thread runner the default for every `decodeWoff2` in this process. */
export function useNodeWoff2Runner(): void {
  setWoff2Runner(nodeWoff2Runner);
}
