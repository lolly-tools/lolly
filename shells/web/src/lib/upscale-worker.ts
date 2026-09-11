// SPDX-License-Identifier: MPL-2.0
/**
 * On-device AI upscaler WORKER. A run is multi-second per tile on a phone, so it
 * must never touch the thread a tool is being typed into - everything heavy
 * (onnxruntime-web, the ONNX weights, the tiling/compose maths in lib/upscaler.ts)
 * loads and runs HERE, dynamically, so none of it reaches the boot chunk. Same
 * id-keyed request/reply protocol as lib/speech-kokoro-worker.ts, plus per-run
 * progress messages and a cooperative abort (checked between tiles - a tile
 * mid-inference can't be preempted in-wasm/gpu).
 *
 * IndexedDB (the model cache) and OffscreenCanvas both work in a worker, so the
 * model fetch/cache and all pixel work happen worker-side; the main-thread
 * bridge (bridge/upscale.ts) only marshals messages. The worker echoes the
 * resolved backend on every reply (and once unsolicited on spawn) so the bridge
 * can answer `UpscaleAPI.backend()` synchronously.
 */

import type {
  UpscaleFeasibility, UpscaleFrame, UpscaleModelId, UpscaleOpts, UpscaleProgress,
} from '@lolly-tools/core/host-v1';
import { abortError, canRun, currentBackend, modelCached, probeBackend, runUpscale, type RunContext } from './upscaler.ts';

/** Options that survive structured clone - no `signal`/`onProgress` (the bridge
 *  keeps those main-thread and translates them into abort messages + progress
 *  replies). */
export type SerializableUpscaleOpts = Omit<UpscaleOpts, 'signal' | 'onProgress'>;

export type UpscaleWorkerRequest =
  | { id: number; type: 'run'; frame: UpscaleFrame; opts?: SerializableUpscaleOpts }
  | { id: number; type: 'canRun'; src: { width: number; height: number }; opts?: SerializableUpscaleOpts }
  | { id: number; type: 'cached'; model: UpscaleModelId }
  | { id: number; type: 'abort' };

export interface UpscaleWorkerReply {
  id: number;
  /** The resolved execution backend, echoed so the bridge can latch it. */
  backend?: 'webgpu' | 'wasm';
  progress?: UpscaleProgress;
  /** Terminal - a run result (its buffer is transferred). */
  frame?: UpscaleFrame;
  /** Terminal - a canRun result. */
  feasibility?: UpscaleFeasibility;
  /** Terminal - a cached() result. */
  cached?: boolean;
  /** Terminal - a real failure. */
  error?: string;
  /** Terminal - the run was aborted (bridge rejects with AbortError). */
  aborted?: boolean;
}

// DedicatedWorkerGlobalScope postMessage overload (message, transfer).
const post = postMessage as (message: UpscaleWorkerReply, transfer?: Transferable[]) => void;

/** Requests the main thread has aborted; the run loop checks between tiles. */
const aborted = new Set<number>();
/** Requests currently running - an abort for an id not in here is stale. */
const inFlight = new Set<number>();

function checkAbort(id: number): void {
  if (aborted.has(id)) throw abortError();
}

addEventListener('message', (e: MessageEvent<UpscaleWorkerRequest>) => {
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
        const cached = await modelCached(msg.model);
        post({ id, cached, backend: currentBackend() ?? undefined });
      } else if (msg.type === 'canRun') {
        const feasibility = await canRun(msg.src, msg.opts ?? {});
        post({ id, feasibility, backend: currentBackend() ?? undefined });
      } else {
        const ctx: RunContext = {
          onProgress: (p) => post({ id, progress: p }),
          checkAbort: () => checkAbort(id),
        };
        const frame = await runUpscale(msg.frame, msg.opts ?? {}, ctx);
        post({ id, frame, backend: currentBackend() ?? undefined }, [frame.data.buffer]);
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

// Warm the backend probe on spawn so the bridge can answer backend() early.
void probeBackend().then((b) => post({ id: 0, backend: b ?? undefined }));
