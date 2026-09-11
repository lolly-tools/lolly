// SPDX-License-Identifier: MPL-2.0
/**
 * Web implementation of `host.audio` (v1.71) - decode a clip, then hand the PCM to
 * the engine's `analysePcm` for the per-frame reactivity track.
 *
 * The division of labour is the point of the API: the SHELL owns the decoder
 * (`decodeAudioData`, plus the ZzFXM renderer for our own procedural songs) and the
 * engine owns the maths, so this file has no analysis in it at all and the CLI's
 * implementation reads the same numbers off the same clip.
 *
 * Two things here that are not obvious:
 *
 *  - **Decoding happens on an OfflineAudioContext, not an AudioContext.** A live
 *    context is subject to autoplay policy and starts suspended until a gesture;
 *    `decodeAudioData` on an offline one works on page load, which matters because a
 *    tool analyses its audio while rendering, not in response to a click.
 *  - **Results are cached, and that is required rather than an optimisation.** A
 *    tool's template re-runs on every keystroke. Without a cache, typing a title
 *    would re-fetch and re-analyse a multi-megabyte track per character.
 */
import type {
  AudioAPI, AudioSource, AudioAnalyseOpts, AudioAnalysis, AssetRef, AudioCleanOpts,
} from '@lolly-tools/core/host-v1';
import type { ZzfxSong } from '../../../../engine/src/zzfxm.ts';
import { renderSong } from '../lib/zzfxm-render.ts';
import { audioSourceBytes } from '../lib/util/bytes.ts';
import { isZzfxmRef, parseZzfxmRef } from '../../../../engine/src/zzfxm-ref.ts';
import { isModuleFormat, renderMod } from '../lib/mod-render.ts';

interface WorkerReply {
  id: number;
  result?: AudioAnalysis;
  error?: string;
}

/**
 * Cache depth. Each entry can be tens of megabytes once sample windows are asked
 * for, so this is deliberately shallow: enough that switching a style or nudging a
 * title reuses the analysis, not enough to hold a session's worth of tracks in
 * memory. Least-recently-USED eviction, not insertion order - the track being
 * actively edited must not be evicted by a preview of three others.
 */
const CACHE_MAX = 4;

const cache = new Map<string, AudioAnalysis>();
/** In-flight analyses, so N synchronous callers for one clip share ONE decode. A
 *  tool re-rendering mid-decode is the normal case, not an edge one. */
const inflight = new Map<string, Promise<AudioAnalysis>>();

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, { resolve: (a: AudioAnalysis) => void; reject: (e: unknown) => void }>();

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('../lib/audio-analyse-worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = (e: MessageEvent<WorkerReply>): void => {
    const { id, error, result } = e.data;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (error || !result) p.reject(new Error(error ?? 'audio analysis failed'));
    else p.resolve(result);
  };
  worker.onerror = (): void => {
    for (const p of pending.values()) p.reject(new Error('audio analysis worker error'));
    pending.clear();
    // Drop the dead worker so the next analyse() spawns a fresh one.
    if (worker) { worker.onmessage = null; worker.onerror = null; }
    worker = null;
  };
  return worker;
}

function analyseInWorker(
  channels: Float32Array[],
  sampleRate: number,
  opts: AudioAnalyseOpts,
): Promise<AudioAnalysis> {
  const w = ensureWorker();
  const id = ++seq;
  return new Promise<AudioAnalysis>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    // Transfer the channel buffers: they are the largest thing crossing, and nothing
    // on this side reads them again (the decoded AudioBuffer is already discarded).
    w.postMessage({ id, channels, sampleRate, opts }, channels.map((c) => c.buffer));
  });
}

/** Every distinct source form reduced to something cacheable. Raw bytes get no key
 *  (there is no stable identity for an anonymous buffer), so they always re-analyse. */
function cacheKey(src: AudioSource, opts: AudioAnalyseOpts): string | null {
  const id = typeof src === 'string' ? src : isRef(src) ? src.id : null;
  if (id === null) return null;
  const o = opts;
  return [id, o.fps ?? 30, o.bands ?? 64, o.buckets ?? 128, o.start ?? 0, o.window ?? -1, o.samples ?? 0].join('|');
}

function isRef(src: AudioSource): src is AssetRef {
  return typeof src === 'object' && src !== null && 'url' in src && typeof (src as AssetRef).url === 'string';
}

/**
 * Source → decoded channel data.
 *
 * Two source kinds are SONG DATA rather than encoded audio, and both would fail at
 * `decodeAudioData` - no browser has a decoder for either. They are rendered instead,
 * which yields Float32 PCM directly, so encoding it to WAV just to hand it back to a
 * decoder would be pure waste:
 *
 *   ZzFXM - our own synthesised songs. Two shapes: a catalog `.zzfxm.json` asset
 *   (fetch the JSON) and the procedural `zzfxm:<seed>` scheme, which names a song no
 *   file stores and whose composer is imported lazily because it is a large module
 *   that most analyses never touch.
 *
 *   TRACKER MODULES (.mod/.xm/.s3m/.it/…) - sample-based song data, decoded by the
 *   libopenmpt worker the Neurospicy player and the video exporter already share
 *   (lib/mod-render.ts). Worth stating plainly because it is what makes the result
 *   honest: libopenmpt is a REAL decoder, so a module's waveform is that module's
 *   actual audio - not a lossy re-synthesis that would look like a measurement while
 *   being a guess. Without this branch a .mod reached decodeAudioData, threw, and the
 *   asset fell back to a music-note glyph forever.
 */
export async function toPcm(src: AudioSource): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  if (isRef(src) && src.format === 'zzfxm') {
    const song = isZzfxmRef(src.url) ? await composeProceduralSong(src.url) : await fetchSong(src.url);
    const { left, right, sampleRate } = await renderSong(song);
    if (!left.length) throw new Error('zzfxm song rendered empty');
    return { channels: [left, right], sampleRate };
  }
  if (typeof src === 'string' && isZzfxmRef(src)) {
    const { left, right, sampleRate } = await renderSong(await composeProceduralSong(src));
    if (!left.length) throw new Error('zzfxm song rendered empty');
    return { channels: [left, right], sampleRate };
  }

  // A module is identified by the ref's FORMAT, not by sniffing the bytes: libopenmpt
  // sniffs the real format itself, and an asset's `format` carries the true extension
  // (mod/xm/s3m/…) precisely so the badge and filename stay honest.
  if (isRef(src) && isModuleFormat(src.format)) {
    // `.slice()` because renderMod TRANSFERS the buffer to its worker, and
    // `audioSourceBytes` may hand back the caller's own ArrayBuffer - transferring
    // that would detach a buffer the caller still holds. A copy of a tracker module
    // is cheap; they are tiny by construction (sample-based song data, which is why
    // they are kept verbatim).
    const raw = await audioSourceBytes(src);
    const { left, right, sampleRate } = await renderMod(new Uint8Array(raw.slice(0)), 44100);
    if (!left.length) throw new Error('tracker module rendered empty');
    return { channels: [left, right], sampleRate };
  }

  const bytes = await audioSourceBytes(src);
  // A 1-frame context: the rate and channel count here don't constrain the decode - 
  // decodeAudioData reports the file's own - this context exists only to own the call.
  const OAC = window.OfflineAudioContext ?? (window as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OAC) throw new Error('no audio decoder in this browser');
  const buf = await new OAC(1, 1, 44100).decodeAudioData(bytes);
  const channels: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
  return { channels, sampleRate: buf.sampleRate };
}

async function fetchSong(url: string): Promise<ZzfxSong> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`song fetch failed: ${res.status}`);
  return (await res.json()) as ZzfxSong;
}

async function composeProceduralSong(id: string): Promise<ZzfxSong> {
  const ref = parseZzfxmRef(id);
  if (!ref) throw new Error(`malformed procedural audio ref: ${id}`);
  const [{ generatedSongSpec }, { composeSong }] = await Promise.all([
    import('./sequence-providers.ts'),
    import('../../../../engine/src/zzfx-compose.ts'),
  ]);
  // 30s is the seeded generator's own house length; a longer window than the song
  // simply analyses the song.
  return composeSong(generatedSongSpec(ref.seed, 30, ref.style));
}


export function createAudioAPI(): Required<AudioAPI> {
  return {
    isAvailable(): boolean {
      return typeof Worker === 'function'
        && (typeof window.OfflineAudioContext === 'function'
          || typeof (window as { webkitOfflineAudioContext?: unknown }).webkitOfflineAudioContext === 'function');
    },

    async analyse(src: AudioSource, opts: AudioAnalyseOpts = {}): Promise<AudioAnalysis> {
      const key = cacheKey(src, opts);
      if (key !== null) {
        const hit = cache.get(key);
        if (hit) {
          // Re-insert so eviction is least-recently-USED: a Map preserves insertion
          // order, and deleting before setting is what moves an entry to the back.
          cache.delete(key);
          cache.set(key, hit);
          return hit;
        }
        const running = inflight.get(key);
        if (running) return running;
      }

      const run = (async (): Promise<AudioAnalysis> => {
        const { channels, sampleRate } = await toPcm(src);
        return analyseInWorker(channels, sampleRate, opts);
      })();

      if (key === null) return run;

      inflight.set(key, run);
      try {
        const result = await run;
        cache.set(key, result);
        while (cache.size > CACHE_MAX) {
          const oldest = cache.keys().next().value;
          if (oldest === undefined) break;
          cache.delete(oldest);
        }
        return result;
      } finally {
        inflight.delete(key);
      }
    },

    async clean(src: AudioSource, opts: AudioCleanOpts = {}) {
      // The whole implementation (decode, DSP, encode, remux) is a user action, never
      // first paint, so it lives in its own chunk (scripts/check-bundle-budget.ts).
      const { runAudioClean } = await import('./audio-clean-run.ts');
      return runAudioClean(src, opts, toPcm);
    },
  };
}
