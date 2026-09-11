// SPDX-License-Identifier: MPL-2.0
import { modelCapability, runAi } from './ai-policy.ts';
// ─── Shared onnxruntime-web loader (deep-scan watermark detectors) ────────────
//
// ONE onnxruntime-web module + ONE wasm init, shared by every deep-scan detector
// (lib/trustmark.ts, lib/contentseal.ts). This exists because those detectors
// used to each `import('onnxruntime-web')` and configure it independently, and
// when /verify ran them together the two first `InferenceSession.create()` calls
// raced ORT's one-time `initWasm()` → "multiple calls to 'initWasm()' detected"
// and every session failed. A single memoised module + a single init mutex makes
// that race impossible no matter how many detectors run concurrently.
//
// Config choices, all deliberate:
//  - `wasmPaths = '/ort/'` - the WASM runtime is served SAME-ORIGIN from
//    shells/web/public/ort/ (populated once at setup from
//    node_modules/onnxruntime-web/dist/*.{wasm,mjs}). NEVER a CDN: offline-first
//    is a hard project rule and the CSP + service worker refuse cross-origin.
//  - `numThreads = 1`, `proxy = false` - single-threaded, no worker proxy.
//    Threaded ORT needs cross-origin isolation (COOP/COEP) we don't set, and the
//    worker proxy pulls in yet another dynamically-imported .mjs; a deep scan is
//    a one-shot user action where simplicity beats the marginal speed.
//
// The detectors pass `executionProviders: ['wasm']` (not webgpu): the WebGPU
// (jsep) build needs a GPU adapter AND its own `*.jsep.mjs` glue, more surface
// for no benefit on a one-off scan. Re-add 'webgpu' once the wasm path is proven.

// Beyond the runtime itself this module owns the plumbing BOTH detectors need
// verbatim: the gated debug tracer, the fetch-once/IndexedDB-forever model cache,
// and the two canvas/tensor helpers their preprocessing shares. Those used to be
// copy-pasted per detector (identical bodies, different log tag and IDB store);
// they now live here, parameterised, so a fix lands once. Each detector keeps its
// OWN documented developer switches (localStorage key + global flag) - those are
// deliberately NOT unified, they're how you trace one detector without the other.

import { openDB } from '../bridge/db.ts';
import { MODELS_BASE } from './models-base.ts';

type OrtModule = typeof import('onnxruntime-web');

let ortPromise: Promise<OrtModule> | null = null;

// ─── Streamed fetch progress (deep-scan model downloads) ──────────────────────
//
// Both detectors fetch same-origin .onnx files tens of MB in size. This reads a
// Response's body via its stream reader instead of the one-shot
// `resp.arrayBuffer()`, reporting {loaded,total} as chunks arrive so the /verify
// banner (views/valid.ts's enableDeepScan) can show a real download bar instead
// of a static "downloading…" string. `total` is the Content-Length header when
// present and parseable, else null - an INDETERMINATE download (chunked
// transfer, or a proxy that strips the header), never a guessed number.
//
// Caveat: if these files were ever served content-encoded (gzip/br), the header
// reflects the on-wire (compressed) size while the reader yields decoded bytes,
// so `loaded` could transiently exceed `total`. Callers must clamp any
// percentage they render - `total` is a best-effort denominator, not a hard cap.
export interface FetchProgress { loaded: number; total: number | null }

/** Reads `resp`'s body to a single ArrayBuffer, calling `onProgress` after each
 *  chunk. Falls back to a plain `resp.arrayBuffer()` (no progress) when the body
 *  isn't a readable stream - e.g. an older browser, or a response already
 *  consumed - so callers always get the same bytes either way. */
export async function readResponseWithProgress(
  resp: Response, onProgress?: (p: FetchProgress) => void,
): Promise<ArrayBuffer> {
  const reader = resp.body?.getReader();
  if (!reader) return resp.arrayBuffer();
  const totalHeader = Number(resp.headers.get('content-length'));
  const total = Number.isFinite(totalHeader) && totalHeader > 0 ? totalHeader : null;
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value || !value.byteLength) continue;
    chunks.push(value);
    loaded += value.byteLength;
    onProgress?.({ loaded, total });
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

/** Lazily import + configure onnxruntime-web exactly once. Every caller shares
 *  the same module instance and the same one-time wasm setup. */
export function loadOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = import('onnxruntime-web').then((ort) => {
      ort.env.wasm.wasmPaths = '/ort/';
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      return ort;
    });
  }
  return ortPromise;
}

// Serialises the FIRST session creation across all detectors. ORT's initWasm
// runs on the first `InferenceSession.create()`; two concurrent first-creates
// trip the "multiple calls" error. Every detector wraps its create() in this so
// only one create is ever in flight at a time (cheap - deep scan is one-shot).
let sessionGate: Promise<unknown> = Promise.resolve();
export function serializeSessionCreate<T>(create: () => Promise<T>): Promise<T> {
  const run = sessionGate.then(create, create);
  // Keep the chain alive regardless of this create's outcome.
  sessionGate = run.then(() => undefined, () => undefined);
  return run;
}

// ─── Gated diagnostics ────────────────────────────────────────────────────────
//
// `host.log` isn't in scope in these lazy modules, so detectors trace via
// console.debug - GATED so a normal deep scan is silent. Each detector declares
// its own switch pair, e.g. for TrustMark:
//   localStorage.setItem('lolly:trustmark:debug', '1')
//   window.__TRUSTMARK_DEBUG__ = true
// and Content Seal's are 'lolly:contentseal:debug' / __CONTENTSEAL_DEBUG__.
// Separate on purpose: turning one on must not flood the console with the other.

/** Builds a detector's `dbg(stage, ctx)` tracer, gated on either switch. */
export function createDebugLogger(
  { tag, storageKey, globalFlag }: { tag: string; storageKey: string; globalFlag: string },
): (stage: string, ctx?: object) => void {
  const enabled = (): boolean => {
    try {
      if (typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1') return true;
    } catch {
      // localStorage can throw in a sandboxed/partitioned context - ignore.
    }
    return typeof globalThis !== 'undefined'
      && (globalThis as Record<string, unknown>)[globalFlag] === true;
  };
  return (stage: string, ctx?: object): void => {
    if (enabled()) console.debug(`[${tag}] ${stage}`, ctx ?? '');
  };
}

// ─── Model bytes: fetch-once, IndexedDB-forever ───────────────────────────────
//
// Same pattern lib/google-fonts.ts + user-fonts.ts use for font files, applied to
// a much larger binary: fetch same-origin `/models/<dir>/<file>` exactly once,
// then serve from IndexedDB forever. The service worker bypasses `/models/`
// (public/sw.js) so there is only ONE on-device copy of the bytes.

interface CachedModel { bytes: ArrayBuffer; version: number; cachedAt: number }

export interface ModelCacheOptions {
  /** IndexedDB object store holding this detector's model bytes (bridge/db.ts). */
  store: string;
  /** URL directory under `/models/` the bytes are fetched from. */
  dir: string;
  /** Bump to invalidate every cached entry (a retrained/reconverted model, or a
   *  poisoned cache - see the HTML guard below). */
  version: number;
  /** This detector's tracer (createDebugLogger). */
  dbg: (stage: string, ctx?: object) => void;
  /** Ran after a successful cache write, inside the same best-effort try - lets a
   *  detector stamp extra bookkeeping (TrustMark's readiness marker) without
   *  duplicating the whole fetch. */
  afterCache?: (fileName: string, db: Awaited<ReturnType<typeof openDB>>) => Promise<void>;
}

/**
 * Builds this detector's `fetchModelBytes(fileName, cacheOnly?, onProgress?)`.
 * Returns null - never throws - for every "no bytes on device" case, which the
 * callers turn into 'not-installed' (NEVER "no watermark found"):
 *   - `cacheOnly` (the passive background scan) and nothing cached: a multi-MB
 *     model download is opt-in, gated behind the explicit "Deep scan" button.
 *   - the file isn't vendored/converted yet (404), or we're offline.
 *   - the response is HTML, not a model (see the guard below).
 */
export function createModelFetcher(
  { store, dir, version, dbg, afterCache }: ModelCacheOptions,
): (fileName: string, cacheOnly?: boolean, onProgress?: (p: FetchProgress) => void) => Promise<ArrayBuffer | null> {
  return async function fetchModelBytes(fileName, cacheOnly = false, onProgress) {
    return runAi(modelCapability(dir) ?? 'unclassified', async (signal) => {
    try {
      const db = await openDB();
      const cached = await db.get(store, fileName) as CachedModel | undefined;
      if (cached && cached.version === version && cached.bytes?.byteLength) {
        dbg('fetch', { file: fileName, source: 'idb-cache', bytes: cached.bytes.byteLength });
        return cached.bytes;
      }
    } catch {
      // IDB unavailable - fall through to a network-only (uncached) fetch below.
    }

    if (cacheOnly) { dbg('fetch', { file: fileName, source: 'cache-only-miss' }); return null; }

    const url = `${MODELS_BASE}/models/${dir}/${fileName}`;
    let resp: Response;
    try {
      resp = await fetch(url, { signal });
    } catch (err) {
      dbg('fetch', { file: fileName, url, status: 'network-error', error: (err as Error)?.message });
      return null; // offline, or the dev server has nothing mounted at /models/
    }
    // Not vendored yet (the fetch/convert script hasn't been run) - a plain 404,
    // never an error surfaced to the user.
    if (!resp.ok) {
      dbg('fetch', { file: fileName, url, status: resp.status });
      return null;
    }
    const bytes = await readResponseWithProgress(resp, onProgress);
    // Vite's dev server answers a MISSING model with the SPA fallback index.html - 
    // a 200, so resp.ok above is true. Handing that HTML to ORT yields "protobuf
    // parsing failed"; caching it poisons every later run. Reject anything that
    // isn't the binary model: an HTML content-type, or a body starting with '<'
    // ('<!doctype…'). A real ONNX protobuf never begins with 0x3c. (No minimum-size
    // check: TrustMark's resizer.onnx is a legitimate 454 bytes.)
    const contentType = resp.headers.get('content-type') || '';
    const head = bytes.byteLength ? new Uint8Array(bytes, 0, 1)[0] : 0;
    if (contentType.includes('text/html') || head === 0x3c /* '<' */) {
      dbg('fetch', { file: fileName, url, status: 'not-a-model (SPA fallback?)', contentType, bytes: bytes.byteLength });
      return null; // treated as not-installed, never cached
    }
    dbg('fetch', { file: fileName, url, status: 200, bytes: bytes.byteLength });

    try {
      const db = await openDB();
      signal.throwIfAborted();
      await db.put(store, { bytes, version, cachedAt: Date.now() }, fileName);
      await afterCache?.(fileName, db);
    } catch {
      // Best-effort cache write - a failed put just means re-fetching next time.
    }
    signal.throwIfAborted();
    return bytes;
    });
  };
}

// ─── Shared pixel plumbing (all canvas/DOM - the engine stays DOM-free) ───────

/** An OffscreenCanvas where available, else a detached <canvas>. */
export function makeCanvas(w: number, h: number): OffscreenCanvas | HTMLCanvasElement {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** RGBA → NCHW [1,3,h,w] float32 in [0,1]: R plane, G plane, B plane; alpha
 *  dropped. Verbatim layout of Adobe's loadImageAsTensor packing; Content Seal's
 *  converted graph applies its own [0,1]→[−1,1] scale on top. */
export function packNchw01(rgba: ArrayLike<number>, w: number, h: number): Float32Array {
  const total = w * h;
  const tensor = new Float32Array(total * 3);
  const page = total, twopage = 2 * total;
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    tensor[i] = (rgba[idx] as number) / 255;
    tensor[i + page] = (rgba[idx + 1] as number) / 255;
    tensor[i + twopage] = (rgba[idx + 2] as number) / 255;
  }
  return tensor;
}
