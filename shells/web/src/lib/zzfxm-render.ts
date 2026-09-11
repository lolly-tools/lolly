// SPDX-License-Identifier: MPL-2.0
/**
 * Main-thread client for the ZzFXM render worker. Lazily spawns one worker, keys
 * concurrent renders by request id, and turns a song into an AudioBuffer on any
 * AudioContext. Shared by the Neurospicy player (live AudioContext) and the video
 * exporter (OfflineAudioContext for a music bed) so both take the identical
 * "zzfxm song → AudioBuffer" path.
 */
import type { ZzfxSong, RenderedPcm } from '../../../../engine/src/zzfxm.ts';
import { pcmToWavBlob } from './pcm-wav.ts';

interface WorkerReply {
  id: number;
  left?: Float32Array;
  right?: Float32Array;
  sampleRate?: number;
  error?: string;
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (p: RenderedPcm) => void; reject: (e: unknown) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./zzfxm-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerReply>): void => {
    const { id, error, left, right, sampleRate } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error || !left || !right || !sampleRate) {
      p.reject(new Error(error ?? 'zzfxm render failed'));
    } else {
      p.resolve({ left, right, sampleRate });
    }
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('zzfxm worker error'));
    pending.clear();
    // Drop the dead worker so the next renderSong() spawns a fresh one.
    if (worker) { worker.onmessage = null; worker.onerror = null; }
    worker = null;
  };
  return worker;
}

/** Render a song to stereo PCM in the worker. */
export function renderSong(song: ZzfxSong): Promise<RenderedPcm> {
  const w = ensureWorker();
  const id = ++seq;
  return new Promise<RenderedPcm>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, song });
  });
}

/**
 * Fetch a ZzFXM song JSON, render it, and return a WAV blob URL - the shape the
 * video-export music picker feeds to the muxer for a zzfxm-format track. The 16-bit
 * WAV encoder is shared with the tracker-module path (see pcm-wav.ts).
 */
export async function songUrlToWavBlobUrl(url: string): Promise<string> {
  const song = (await (await fetch(url)).json()) as ZzfxSong;
  const pcm = await renderSong(song);
  return URL.createObjectURL(pcmToWavBlob(pcm));
}

/**
 * Render a song and wrap it in a stereo AudioBuffer on the given context.
 * `createBuffer` accepts the song's native sample rate even when it differs from
 * the context's - playback resamples. Throws if the song renders empty.
 */
export async function renderSongToAudioBuffer(ctx: BaseAudioContext, song: ZzfxSong): Promise<AudioBuffer> {
  const { left, right, sampleRate } = await renderSong(song);
  if (!left.length) throw new Error('zzfxm song rendered empty');
  const buf = ctx.createBuffer(2, left.length, sampleRate);
  // `.set()` takes any ArrayLike<number>, avoiding the Float32Array<ArrayBuffer>
  // vs <ArrayBufferLike> generic mismatch that copyToChannel's signature imposes.
  buf.getChannelData(0).set(left);
  buf.getChannelData(1).set(right);
  return buf;
}
