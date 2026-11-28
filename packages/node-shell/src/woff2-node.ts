// SPDX-License-Identifier: MPL-2.0
/**
 * Node's WOFF2 runner: each decode in its own worker thread, with a fresh instance of the
 * decoder module, ended after the one font or when the time limit passes. The module
 * (wasm/woff2-kernel/woff2-kernel.wasm) is compiled once per process and handed to each thread. The Node-only
 * callers pass `nodeWoff2Runner` to `decodeWoff2`; `createNodeTextAPI` (text.ts) calls
 * `useNodeWoff2Runner()`, so the shared callers (page-text.ts, text-fonts.ts) get it
 * too in every Node host that outlines text. A call, not an import side effect: the
 * package declares `sideEffects: false`, so bundlers drop side-effect-only imports.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { repoRoot } from './repo-root.ts';
import { compileWoff2Kernel } from './woff2-kernel.ts';
import { setWoff2Runner, Woff2Error, WOFF2_WORKER_LIMIT, woff2Slots, type Woff2Runner, type Woff2WorkerReply, type Woff2WorkerRequest } from './woff2.ts';

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

/**
 * The decoder module's bytes: beside the package (`../wasm/woff2-kernel/` from source, the CLI
 * package and the desktop sidecar), else under the checkout or deployed task root, which
 * is where the bundled MCP function finds it (vercel.json `includeFiles`).
 */
async function readKernel(): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(new URL('../wasm/woff2-kernel/woff2-kernel.wasm', import.meta.url)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return new Uint8Array(await readFile(join(repoRoot(), 'packages/node-shell/wasm/woff2-kernel/woff2-kernel.wasm')));
  }
}

let compiled: Promise<WebAssembly.Module> | undefined;
/** Compiled once per process; each decode instantiates the module afresh in its own thread. */
function kernelModule(): Promise<WebAssembly.Module> {
  compiled ??= readKernel().then(compileWoff2Kernel).catch((error: unknown) => {
    compiled = undefined;
    throw new Woff2Error('decode-failed', 'The WOFF2 decoder is missing from this installation, so the font was not decoded.', { cause: error });
  });
  return compiled;
}

const nodeSlot = woff2Slots(WOFF2_WORKER_LIMIT);

/** At most WOFF2_WORKER_LIMIT threads at once; each decodes one font and exits. */
export const nodeWoff2Runner: Woff2Runner = async (bytes, options) => {
  const module = await kernelModule();
  const release = await nodeSlot(options.signal);
  try { return await runInThread(module, bytes, options); } finally { release(); }
};

const runInThread = (module: WebAssembly.Module, bytes: Uint8Array, { timeoutMs, signal }: Parameters<Woff2Runner>[1]): Promise<Uint8Array> => new Promise((resolve, reject) => {
  signal?.throwIfAborted();
  const copy = bytes.slice();
  let worker: Worker;
  try {
    worker = new Worker(workerUrl(), {
      workerData: { module, bytes: copy } satisfies Woff2WorkerRequest,
      transferList: [copy.buffer],
      env: {},
      execArgv: [],
      // Kept off this process's stdout, which is the payload (CLI) or the JSON-RPC
      // channel (MCP over stdio).
      stdout: true,
      stderr: true,
    });
  } catch (error) {
    reject(error instanceof Woff2Error ? error : new Woff2Error('decode-failed', 'This WOFF2 font could not be decoded.', { cause: error }));
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
  worker.once('message', (reply: Woff2WorkerReply) => finish(new Woff2Error('decode-failed', 'This WOFF2 font could not be decoded.', { cause: reply.error ?? 'no reply' }), reply.out));
  worker.once('error', (error) => finish(new Woff2Error('decode-failed', 'This WOFF2 font could not be decoded.', { cause: error })));
  worker.once('exit', (code) => finish(new Woff2Error('decode-failed', 'This WOFF2 font could not be decoded.', { cause: `the decoder thread exited (${code})` })));
});

/** Make the worker-thread runner the default for every `decodeWoff2` in this process. */
export function useNodeWoff2Runner(): void {
  setWoff2Runner(nodeWoff2Runner);
}
