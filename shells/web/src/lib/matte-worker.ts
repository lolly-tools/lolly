// SPDX-License-Identifier: MPL-2.0
/**
 * On-device background-removal WORKER - the twin of lib/upscale-worker.ts. A
 * matte run is a multi-second ONNX forward pass, so it never touches the thread a
 * tool is being used on: onnxruntime-web, the weights, and the letterbox/compose
 * maths in lib/matter.ts all load and run HERE, dynamically, off the boot chunk.
 * Same id-keyed request/reply protocol, per-run progress, and a cooperative abort.
 *
 * IndexedDB (the model cache) and OffscreenCanvas both work in a worker, so the
 * fetch/cache and all pixel work happen worker-side; the bridge (bridge/matte.ts)
 * only marshals messages. The worker echoes the resolved backend on every reply
 * (and once unsolicited on spawn) so the bridge can answer backend() synchronously.
 */

import type {
  MatteFeasibility, MatteFrame, MatteModelId, MatteOpts, MatteProgress,
} from '@lolly-tools/core/host-v1';
import {
  abortError, canRun, currentBackend, modelCached, probeBackend, runMatte, type MatteRunCtx,
} from './matter.ts';

/** Options that survive structured clone - no `signal`/`onProgress`. */
export type SerializableMatteOpts = Omit<MatteOpts, 'signal' | 'onProgress'>;

export type MatteWorkerRequest =
  | { id: number; type: 'run'; frame: MatteFrame; opts?: SerializableMatteOpts }
  | { id: number; type: 'canRun'; src: { width: number; height: number }; opts?: SerializableMatteOpts }
  | { id: number; type: 'cached'; model: MatteModelId }
  | { id: number; type: 'abort' };

export interface MatteWorkerReply {
  id: number;
  backend?: 'webgpu' | 'wasm';
  progress?: MatteProgress;
  /** Terminal - a run result (its buffer is transferred). */
  frame?: MatteFrame;
  /** Terminal - a canRun result. */
  feasibility?: MatteFeasibility;
  /** Terminal - a cached() result. */
  cached?: boolean;
  /** Terminal - a real failure. */
  error?: string;
  /** Terminal - the run was aborted (bridge rejects with AbortError). */
  aborted?: boolean;
}

const post = postMessage as (message: MatteWorkerReply, transfer?: Transferable[]) => void;

const aborted = new Set<number>();
const inFlight = new Set<number>();

function checkAbort(id: number): void {
  if (aborted.has(id)) throw abortError();
}

addEventListener('message', (e: MessageEvent<MatteWorkerRequest>) => {
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
        const feasibility = canRun(msg.src, msg.opts ?? {});
        post({ id, feasibility, backend: currentBackend() ?? undefined });
      } else {
        const ctx: MatteRunCtx = {
          onProgress: (p) => post({ id, progress: p }),
          checkAbort: () => checkAbort(id),
        };
        const frame = await runMatte(msg.frame, msg.opts ?? {}, ctx);
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
