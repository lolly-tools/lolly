// SPDX-License-Identifier: MPL-2.0
/**
 * On-device MONOCULAR DEPTH worker (plans/160 WP-A) - the twin of
 * lib/matte-worker.ts + lib/matter.ts folded into one file, because depth has no
 * native-backend override to share its geometry with (matte splits matter.ts out
 * only so shells/tauri-desktop/bridge-overrides/matte.ts can reuse it verbatim).
 *
 * A depth run is a multi-second ONNX forward pass, so it never touches the thread
 * a tool is being used on: onnxruntime-web, the weights and the resampling all
 * load and run HERE, dynamically, off the boot chunk. Same id-keyed
 * request/reply protocol as the matte worker, same per-run progress, same
 * cooperative abort checked at phase boundaries (a single session.run() cannot be
 * preempted mid-flight).
 *
 * PRIVACY: the weights come from `${MODELS_BASE}/models/depth/<file>` and nowhere
 * else - createModelFetcher owns that URL and there is no other fetch in this
 * module. Asserted by depth-worker.test.ts's source scan, the ai-detect-privacy
 * idiom.
 *
 * NO CANVAS, unlike matter.ts. Every resample below is a plain typed-array loop:
 * it keeps the whole pipeline except `session.run()` pure, so the fixture test
 * drives image-in → normalised-map-out through the real module in node, and the
 * worker stops depending on OffscreenCanvas being present.
 *
 * The verified quantised graph is served from the shared models host. A missing
 * file or unavailable runtime still surfaces a classified error to the job.
 */

import { createDebugLogger, createModelFetcher, loadOrt, serializeSessionCreate, type FetchProgress } from './ort.ts';
import { abortError as makeAbortError } from './util/abort.ts';
import {
  DEPTH_DEFAULT_MODEL, DEPTH_MODEL_CACHE_VERSION, DEPTH_MODEL_DIR, DEPTH_MODEL_FILES,
  DEPTH_MODEL_SPEC, DEPTH_MODEL_STORE,
  type DepthFrame, type DepthMap, type DepthModelId, type DepthOpts, type DepthProgress,
} from './depth-models.ts';
import {
  postprocessDepth, preprocessDepth,
} from '@lolly-tools/node-shell/ml/depth-math';

type OrtModule = typeof import('onnxruntime-web');
type InferenceSession = Awaited<ReturnType<OrtModule['InferenceSession']['create']>>;

const dbg = createDebugLogger({ tag: 'depth', storageKey: 'lolly:depth:debug', globalFlag: '__DEPTH_DEBUG__' });
const fetchModelBytes = createModelFetcher({
  store: DEPTH_MODEL_STORE, dir: DEPTH_MODEL_DIR, version: DEPTH_MODEL_CACHE_VERSION, dbg,
});

// ─── backend ─────────────────────────────────────────────────────────────────
//
// WASM only, like matte and for the same unverified-graph reason: ort-web's
// WebGPU (JSEP) kernels throw at run() - AFTER a clean create, so a create-time
// EP fallback cannot catch it - on op shapes this family may well use. Claiming
// webgpu before anyone has run the real graph would promise a path that fails at
// inference. Re-probe per-model once the weights exist (plans/160 WP-F).

let backendProbed: 'webgpu' | 'wasm' | null | undefined;

export async function probeBackend(): Promise<'webgpu' | 'wasm' | null> {
  if (backendProbed !== undefined) return backendProbed;
  backendProbed = typeof WebAssembly !== 'undefined' ? 'wasm' : null;
  return backendProbed;
}
/** The resolved backend without re-probing (null until probeBackend ran). */
export function currentBackend(): 'webgpu' | 'wasm' | null {
  return backendProbed ?? null;
}

/** A DOMException-shaped AbortError (with a plain-Error fallback for old runtimes), carrying this path's message. */
export const abortError = (msg = 'The depth run was aborted.'): Error => makeAbortError(msg);

/** Raised when a run is requested but the model's weights aren't on device -
 *  which is EVERY run until the weights are published. A clean, classifiable
 *  failure, never a hang. */
export class ModelNotInstalledError extends Error {
  readonly model: DepthModelId;
  constructor(model: DepthModelId) {
    super(`The ${model} depth model isn't downloaded on this device yet.`);
    this.name = 'ModelNotInstalledError';
    this.model = model;
  }
}

// ─── PURE math (unit-tested; no DOM, no ORT) ─────────────────────────────────
//
// The two resamplers, the channel packing, the min-max normalisation and the
// pre/post pair MOVED to packages/node-shell/src/ml/depth-math.ts (2026-09-03,
// plans/183 WS2) so the Node depth runner reuses the exact same numbers instead
// of carrying a second copy. They are re-exported here unchanged:
// lib/depth-worker.test.ts and every call site below still import them from this
// module.
export {
  normaliseDepth, packNchwNormalized, postprocessDepth, preprocessDepth, resampleFloat, resampleRgba,
} from '@lolly-tools/node-shell/ml/depth-math';
export type { DepthPre } from '@lolly-tools/node-shell/ml/depth-math';

// ─── session ─────────────────────────────────────────────────────────────────

const sessionCache = new Map<string, Promise<InferenceSession | null>>();

/** Load (once) the ONNX session for a model file, or null when its bytes aren't
 *  on device. Never throws - a missing/failed model is 'not-installed'. Note the
 *  bytes are fetched BEFORE onnxruntime is imported, so the
 *  no-weights case never pays for the runtime and never hangs on it. */
function loadSession(fileName: string, onDownload?: (p: FetchProgress) => void): Promise<InferenceSession | null> {
  let entry = sessionCache.get(fileName);
  if (entry) return entry;
  entry = (async (): Promise<InferenceSession | null> => {
    const bytes = await fetchModelBytes(fileName, false, onDownload);
    if (!bytes) return null;
    const ort: OrtModule = await loadOrt();
    await probeBackend();
    try {
      return await serializeSessionCreate(() =>
        ort.InferenceSession.create(new Uint8Array(bytes), {
          executionProviders: ['wasm'] as never,
          // GPU-resident output tensors read back empty; force CPU (the upscaler's lesson).
          preferredOutputLocation: 'cpu' as never,
        }));
    } catch (e) {
      dbg('session', { file: fileName, error: String(e) });
      return null;
    }
  })();
  sessionCache.set(fileName, entry);
  entry.then((s) => { if (!s) sessionCache.delete(fileName); }, () => sessionCache.delete(fileName));
  return entry;
}

/** Are a model's bytes already on device? Never downloads. */
export async function modelCached(id: DepthModelId): Promise<boolean> {
  const bytes = await fetchModelBytes(DEPTH_MODEL_FILES[id], true);
  return !!bytes;
}

// ─── the run ─────────────────────────────────────────────────────────────────

export interface DepthRunCtx {
  checkAbort(): void;
  onProgress?: (p: DepthProgress) => void;
}

/** Run depth estimation on the WASM (ort-web) path. Rejects on abort; throws
 *  ModelNotInstalledError when the weights aren't on device (the caller shows the
 *  download path). Abort is COOPERATIVE and polled at phase boundaries only - a
 *  single session.run() cannot be interrupted. */
export async function runDepth(frame: DepthFrame, opts: DepthOpts, ctx: DepthRunCtx): Promise<DepthMap> {
  ctx.checkAbort();
  const id = opts.model ?? DEPTH_DEFAULT_MODEL;
  const spec = DEPTH_MODEL_SPEC[id];

  const session = await loadSession(DEPTH_MODEL_FILES[id], (p) =>
    ctx.onProgress?.({ phase: 'download', loaded: p.loaded, total: p.total }));
  if (!session) throw new ModelNotInstalledError(id);
  ctx.checkAbort();
  ctx.onProgress?.({ phase: 'inference', fraction: 0 });

  const pre = preprocessDepth(frame, spec, opts);
  ctx.checkAbort();

  const ort = await loadOrt();
  const tensor = new ort.Tensor('float32', pre.input, [1, 3, pre.inputH, pre.inputW]);
  const result = await session.run({ [session.inputNames[0]!]: tensor });
  ctx.checkAbort();
  const out = result[session.outputNames[0]!]!;
  // getData() defends against a GPU-resident buffer (runModel's lesson in upscaler.ts).
  const raw = (typeof out.getData === 'function' ? await out.getData(false) : out.data) as unknown as Float32Array;
  ctx.onProgress?.({ phase: 'inference', fraction: 0.85 });

  const map = postprocessDepth(raw, pre);
  ctx.onProgress?.({ phase: 'inference', fraction: 1 });
  return map;
}

// ─── worker message protocol ─────────────────────────────────────────────────

/** Options that survive structured clone - no `signal`/`onProgress`. */
export type SerializableDepthOpts = Omit<DepthOpts, 'signal' | 'onProgress'>;

export type DepthWorkerRequest =
  | { id: number; type: 'run'; frame: DepthFrame; opts?: SerializableDepthOpts }
  | { id: number; type: 'cached'; model: DepthModelId }
  | { id: number; type: 'abort' };

export interface DepthWorkerReply {
  id: number;
  backend?: 'webgpu' | 'wasm';
  progress?: DepthProgress;
  /** Terminal - a run result (its buffer is transferred). */
  map?: DepthMap;
  /** Terminal - a cached() result. */
  cached?: boolean;
  /** Terminal - a real failure. */
  error?: string;
  /** Terminal - the run was aborted (the client rejects with AbortError). */
  aborted?: boolean;
}

const aborted = new Set<number>();
const inFlight = new Set<number>();

function checkAbort(id: number): void {
  if (aborted.has(id)) throw abortError();
}

/** Wire the protocol to a worker scope's postMessage/addEventListener. Called
 *  unconditionally below IN A WORKER; exported and guarded so importing this
 *  module in a test runner (no addEventListener) does not throw. */
export function installDepthWorker(scope: {
  postMessage: (msg: DepthWorkerReply, transfer?: Transferable[]) => void;
  addEventListener: (type: 'message', fn: (e: MessageEvent<DepthWorkerRequest>) => void) => void;
}): void {
  const post = scope.postMessage.bind(scope);
  scope.addEventListener('message', (e: MessageEvent<DepthWorkerRequest>) => {
    const msg = e.data;
    if (msg.type === 'abort') {
      if (inFlight.has(msg.id)) aborted.add(msg.id);
      return;
    }
    const { id } = msg;
    inFlight.add(id);
    void (async (): Promise<void> => {
      try {
        if (msg.type === 'cached') {
          post({ id, cached: await modelCached(msg.model), backend: currentBackend() ?? undefined });
        } else {
          const ctx: DepthRunCtx = {
            onProgress: (p) => post({ id, progress: p }),
            checkAbort: () => checkAbort(id),
          };
          const map = await runDepth(msg.frame, msg.opts ?? {}, ctx);
          post({ id, map, backend: currentBackend() ?? undefined }, [map.data.buffer]);
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') post({ id, aborted: true });
        else post({ id, error: err instanceof Error ? err.message : String(err) });
      } finally {
        inFlight.delete(id);
        aborted.delete(id);
      }
    })();
  });
  // Warm the backend probe on spawn so the client can answer backend() early.
  void probeBackend().then((b) => post({ id: 0, backend: b ?? undefined }));
}

// Worker scope only. `window` has both methods too, so a bare typeof check would
// install a message listener on the page if anything ever imported this module on
// the main thread; a test runner has neither.
const scope = globalThis as unknown as Record<string, unknown>;
if (typeof scope.WorkerGlobalScope !== 'undefined' && typeof scope.document === 'undefined') {
  installDepthWorker(globalThis as unknown as Parameters<typeof installDepthWorker>[0]);
}
