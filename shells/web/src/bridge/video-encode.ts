// SPDX-License-Identifier: MPL-2.0
/**
 * Main-thread client for the video-encode Worker (video-encode.worker.ts). Lazily spawns
 * one worker (respawned on error), keys concurrent encodes by id, and transfers the frames
 * + planar audio to it - the encode/mux then runs off the main thread. Modelled on
 * lib/zzfxm-render.ts.
 *
 * OPT-IN: gated behind the `lolly.workerEncode` localStorage flag (default OFF) so the
 * shipping in-thread path is unchanged until a run is field-verified. Transfer is one-way,
 * so the caller (export.ts renderVideo) treats the worker path as COMMITTED - the up-front
 * `supportsWorkerVideoEncode()` probe is what makes that safe.
 */
import type { EncodePick, EncodeAudio } from './video-encode-core.ts';

interface EncodeReply { id: number; buffer?: ArrayBuffer; type?: string; error?: string }

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (r: { buffer: ArrayBuffer; type: string }) => void; reject: (e: unknown) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./video-encode.worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<EncodeReply>): void => {
    const { id, buffer, type, error } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error || !buffer || !type) p.reject(new Error(error ?? 'worker video encode failed'));
    else p.resolve({ buffer, type });
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('video-encode worker error'));
    pending.clear();
    if (worker) { worker.onmessage = null; worker.onerror = null; }
    worker = null;   // next encode spawns a fresh one
  };
  return worker;
}

/** The opt-in flag (localStorage `lolly.workerEncode` === '1'). Off / unavailable → false. */
export function workerVideoEncodeEnabled(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem('lolly.workerEncode') === '1'; }
  catch { return false; }
}

/** Can (and should) the encode run in a Worker? Needs Worker + WebCodecs + the opt-in. */
export function supportsWorkerVideoEncode(): boolean {
  return typeof Worker !== 'undefined' && typeof VideoEncoder !== 'undefined' && workerVideoEncodeEnabled();
}

/**
 * Encode + mux in the Worker. The frames (and each audio channel's ArrayBuffer) are
 * TRANSFERRED - they are consumed and must not be used afterward. Resolves with the muxed
 * bytes + container MIME; the caller wraps them in a Blob and embeds provenance.
 */
export function encodeVideoInWorker(
  frames: ImageBitmap[],
  pick: EncodePick,
  o: { width: number; height: number; fps: number; bitrate: number; audio?: EncodeAudio | null; subtitlesVtt?: string },
): Promise<{ buffer: ArrayBuffer; type: string }> {
  const w = ensureWorker();
  const id = ++seq;
  const transfer: Transferable[] = [...frames];
  if (o.audio) for (const ch of o.audio.channels) transfer.push(ch.buffer);
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, frames, pick, o }, transfer);
  });
}
