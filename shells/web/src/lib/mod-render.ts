// SPDX-License-Identifier: MPL-2.0
/**
 * Main-thread client for the tracker-module decode worker. Lazily spawns one worker,
 * keys concurrent decodes by request id, and turns module bytes into an AudioBuffer on
 * any AudioContext. Shared by the Neurospicy player (live AudioContext) and the video
 * exporter (WAV blob URL for the URL-driven muxer) so both take the identical
 * "module → PCM" path - a direct mirror of zzfxm-render.ts.
 */
import type { RenderedPcm } from '../../../../engine/src/zzfxm.ts';
import { pcmToWavBlob } from './pcm-wav.ts';

interface WorkerReply {
  id: number;
  left?: Float32Array;
  right?: Float32Array;
  sampleRate?: number;
  error?: string;
  /** A probe's answer: the wasm instantiated in the worker. */
  ok?: boolean;
}

/** The tracker-module formats libopenmpt decodes for us. An asset's `format` is its
 *  real extension (mod/xm/s3m/…); the player and video exporter route any of them
 *  through this worker. libopenmpt sniffs the actual format from the bytes, so the
 *  distinction is only cosmetic (the format badge / filename), not functional. */
export const MODULE_FORMATS = ['mod', 'xm', 's3m', 'it', 'stm', 'mtm'] as const;
export function isModuleFormat(format: string | undefined): boolean {
  return !!format && (MODULE_FORMATS as readonly string[]).includes(format);
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (p: RenderedPcm) => void; reject: (e: unknown) => void }>();
const probes = new Map<number, (ok: boolean) => void>();
let availability: Promise<boolean> | null = null;

/**
 * Can this browser decode tracker modules at all? Spawns the worker and asks it to
 * instantiate libopenmpt, once per page. Resolves false when there is no Worker or
 * WebAssembly, when the wasm fails to compile (a corrupted vendored build - it has
 * happened) or when the worker never answers. The catalog hides module assets on
 * false: a card that cannot play is worse than no card.
 */
export function modDecoderAvailable(): Promise<boolean> {
  if (availability) return availability;
  availability = new Promise<boolean>((resolve) => {
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') { resolve(false); return; }
    try {
      const w = ensureWorker();
      const id = ++seq;
      probes.set(id, resolve);
      w.postMessage({ id, probe: true });
      setTimeout(() => { if (probes.delete(id)) resolve(false); }, 20_000);
    } catch { resolve(false); }
  });
  return availability;
}

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./mod-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerReply>): void => {
    const { id, error, left, right, sampleRate, ok } = e.data;
    const probe = probes.get(id);
    if (probe) { probes.delete(id); probe(!error && !!ok); return; }
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error || !left || !right || !sampleRate) {
      p.reject(new Error(error ?? 'mod decode failed'));
    } else {
      p.resolve({ left, right, sampleRate });
    }
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('mod worker error'));
    pending.clear();
    for (const probe of probes.values()) probe(false);
    probes.clear();
    // Drop the dead worker so the next renderMod() spawns a fresh one.
    if (worker) { worker.onmessage = null; worker.onerror = null; }
    worker = null;
  };
  return worker;
}

/** Decode module bytes to stereo PCM in the worker, at the given sample rate. The bytes
 *  buffer is transferred - callers pass a fresh fetch() result each time. */
export function renderMod(bytes: Uint8Array, sampleRate: number): Promise<RenderedPcm> {
  const w = ensureWorker();
  const id = ++seq;
  return new Promise<RenderedPcm>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ id, bytes, sampleRate }, [bytes.buffer]);
  });
}

/**
 * Decode module bytes and wrap them in a stereo AudioBuffer on the given context.
 * Rendered at the context's own sample rate so playback needs no resampling. Throws
 * if the module decodes empty. (Neurospicy live path - see neurospicy.ts loadBuffer.)
 */
export async function renderModToAudioBuffer(ctx: BaseAudioContext, bytes: Uint8Array): Promise<AudioBuffer> {
  const { left, right, sampleRate } = await renderMod(bytes, Math.round(ctx.sampleRate) || 48000);
  if (!left.length) throw new Error('tracker module rendered empty');
  const buf = ctx.createBuffer(2, left.length, sampleRate);
  // `.set()` takes any ArrayLike<number>, avoiding the Float32Array generic mismatch
  // that copyToChannel's signature imposes.
  buf.getChannelData(0).set(left);
  buf.getChannelData(1).set(right);
  return buf;
}

/**
 * Fetch a tracker module, decode it, and return a WAV blob URL - the shape the
 * video-export music picker feeds to the muxer for a 'mod'-format track (mirrors
 * songUrlToWavBlobUrl for zzfxm). Rendered at 48 kHz to match the exporter's encoder.
 */
export async function modUrlToWavBlobUrl(url: string): Promise<string> {
  const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
  const pcm = await renderMod(bytes, 48000);
  return URL.createObjectURL(pcmToWavBlob(pcm));
}
