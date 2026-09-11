// SPDX-License-Identifier: MPL-2.0
/**
 * On-device OCR WORKER (plans/125) - the twin of lib/matte-worker.ts. A read is a
 * multi-second two-graph ONNX pass, so it never touches the thread a tool is on:
 * onnxruntime-web, the weights and all pixel work load and run HERE (lib/ocr.ts),
 * off the boot chunk. Same id-keyed request/reply protocol, per-stage progress,
 * cooperative abort. The worker echoes the resolved backend on every reply (and
 * once unsolicited on spawn) so the bridge can answer backend() synchronously.
 */

import type { OcrFeasibility, OcrFrame, OcrModelId, OcrOpts, OcrProgress, OcrResult } from '@lolly-tools/core/host-v1';
import { abortError, canRunOcr, currentBackend, modelCached, probeBackend, runOcr, type OcrRunCtx } from './ocr.ts';

/** Options that survive structured clone - no `signal`/`onProgress`. */
export type SerializableOcrOpts = Omit<OcrOpts, 'signal' | 'onProgress'>;

export type OcrWorkerRequest =
  | { id: number; type: 'run'; frame: OcrFrame; opts?: SerializableOcrOpts }
  | { id: number; type: 'canRun'; src: { width: number; height: number }; opts?: SerializableOcrOpts }
  | { id: number; type: 'cached'; model: OcrModelId }
  | { id: number; type: 'abort' };

export interface OcrWorkerReply {
  id: number;
  backend?: 'wasm';
  progress?: OcrProgress;
  /** Terminal - a run result (plain object, no transfer). */
  result?: OcrResult;
  /** Terminal - a canRun result. */
  feasibility?: OcrFeasibility;
  /** Terminal - a cached() result. */
  cached?: boolean;
  /** Terminal - a real failure. */
  error?: string;
  /** Terminal - the run was aborted. */
  aborted?: boolean;
}

const post = postMessage as (message: OcrWorkerReply, transfer?: Transferable[]) => void;

const aborted = new Set<number>();
const inFlight = new Set<number>();

function checkAbort(id: number): void {
  if (aborted.has(id)) throw abortError();
}

addEventListener('message', (e: MessageEvent<OcrWorkerRequest>) => {
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
      } else if (msg.type === 'canRun') {
        post({ id, feasibility: canRunOcr(msg.src), backend: currentBackend() ?? undefined });
      } else {
        const ctx: OcrRunCtx = {
          onProgress: (p) => post({ id, progress: p }),
          checkAbort: () => checkAbort(id),
        };
        const result = await runOcr(msg.frame, msg.opts ?? {}, ctx);
        post({ id, result, backend: currentBackend() ?? undefined });
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
