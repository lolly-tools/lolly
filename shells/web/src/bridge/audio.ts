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
  AudioDecodeOpts, AudioDecoded, AudioFinding,
} from '@lolly-tools/core/host-v1';
import type { ZzfxSong } from '../../../../engine/src/zzfxm.ts';
import { renderSong } from '../lib/zzfxm-render.ts';
import { audioSourceBytes } from '../lib/util/bytes.ts';
import { isZzfxmRef, parseZzfxmRef } from '../../../../engine/src/zzfxm-ref.ts';
import { isModuleFormat, renderMod } from '../lib/mod-render.ts';
import { isRondoUrl, sniffRondoSource } from '../lib/media-source.ts';
// Types only: the rondocode client is imported at the point of use, so its worker
// (QuickJS and the staging bundle) loads only when a song is first analysed.
import type { RondoSong } from '../lib/rondo-render.ts';

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
 * Three source kinds are SONG DATA rather than encoded audio, and each would fail at
 * `decodeAudioData` - no browser has a decoder for any of them. They are rendered instead,
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
 *
 *   RONDOCODE SONGS - code that computes audio, rendered in the `vm` class; see
 *   `rondoDecoded` below.
 */
export async function toPcm(src: AudioSource): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  return decodeSource(src);
}

/** PCM plus what a computed source could not play and how it ran: `decode()`'s shape. */
interface Decoded {
  channels: Float32Array[];
  sampleRate: number;
  findings: AudioFinding[];
  run?: AudioDecoded['run'];
}

/**
 * A RONDOCODE SONG (plan 301) is a third kind of song data, and the only one whose
 * source is CODE. It never runs here: lib/rondo-render.ts runs it in the `vm`
 * execution class inside its own Worker. Three forms reach this file: an asset
 * whose `format` is `rondo` (canonical `.rondo.json` bytes), a song url (a share
 * link, decoded in place, or a `.rondo` / `.rondo.json` path) and raw bytes or a
 * `blob:` url whose bytes sniff as a stored song. `seconds` is the length asked
 * of `decode()`; omitted, the song plays its own arrangement.
 */
async function rondoDecoded(song: RondoSong, seconds: number | undefined): Promise<Decoded> {
  const [{ renderRondoSong }, { RONDO_EXTENSION }] = await Promise.all([
    import('../lib/rondo-render.ts'),
    import('@lolly-tools/rondo/extension'),
  ]);
  const r = await renderRondoSong(song, seconds === undefined ? {} : { seconds });
  if (!r.left.length) throw new Error('rondocode song rendered empty');
  // Copies: the render is shared with the client's cache, and analyse() TRANSFERS
  // its channels to the analysis worker, which would detach the cached arrays.
  return {
    channels: [r.left.slice(), r.right.slice()],
    sampleRate: r.sampleRate,
    findings: r.findings.map((f) => ({ code: f.code, message: f.message, parts: [...f.parts] })),
    run: { executionClass: r.run.executionClass, source: 'rondocode', version: RONDO_EXTENSION.version, seed: r.run.seed },
  };
}

/** The song in a source that names itself one, or null when it does not. */
async function namedRondoSong(src: AudioSource): Promise<RondoSong | null> {
  const url = typeof src === 'string' ? src : isRef(src) ? src.url : '';
  const declared = isRef(src) && src.format === 'rondo';
  if (!declared && !(url && isRondoUrl(url))) return null;
  const r = await import('../lib/rondo-render.ts');
  if (declared) {
    const song = r.songFromBytes(new Uint8Array(await audioSourceBytes(src)));
    if (!song) throw new Error('this asset is not a readable rondocode song');
    return song;
  }
  return r.songFromUrl(url);
}

async function decodeSource(src: AudioSource, seconds?: number): Promise<Decoded> {
  if (isRef(src) && src.format === 'zzfxm') {
    const song = isZzfxmRef(src.url) ? await composeProceduralSong(src.url, seconds) : await fetchSong(src.url);
    const { left, right, sampleRate } = await renderSong(song);
    if (!left.length) throw new Error('zzfxm song rendered empty');
    return { channels: [left, right], sampleRate, findings: [] };
  }
  if (typeof src === 'string' && isZzfxmRef(src)) {
    const { left, right, sampleRate } = await renderSong(await composeProceduralSong(src, seconds));
    if (!left.length) throw new Error('zzfxm song rendered empty');
    return { channels: [left, right], sampleRate, findings: [] };
  }
  const named = await namedRondoSong(src);
  if (named) return rondoDecoded(named, seconds);

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
    return { channels: [left, right], sampleRate, findings: [] };
  }

  const bytes = await audioSourceBytes(src);
  // A stored song behind a `blob:` url, or handed over as raw bytes: the bytes say
  // so. Checked BEFORE decodeAudioData, which detaches the buffer it is given.
  if (sniffRondoSource(bytes)) {
    const { songFromBytes } = await import('../lib/rondo-render.ts');
    const song = songFromBytes(new Uint8Array(bytes));
    if (song) return rondoDecoded(song, seconds);
  }
  // A 1-frame context: the rate and channel count here don't constrain the decode - 
  // decodeAudioData reports the file's own - this context exists only to own the call.
  const OAC = window.OfflineAudioContext ?? (window as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!OAC) throw new Error('no audio decoder in this browser');
  const buf = await new OAC(1, 1, 44100).decodeAudioData(bytes);
  const channels: Float32Array[] = [];
  for (let c = 0; c < buf.numberOfChannels; c++) channels.push(buf.getChannelData(c));
  return { channels, sampleRate: buf.sampleRate, findings: [] };
}

async function fetchSong(url: string): Promise<ZzfxSong> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`song fetch failed: ${res.status}`);
  return (await res.json()) as ZzfxSong;
}

async function composeProceduralSong(id: string, seconds?: number): Promise<ZzfxSong> {
  const ref = parseZzfxmRef(id);
  if (!ref) throw new Error(`malformed procedural audio ref: ${id}`);
  const [{ generatedSongSpec, zzfxmTargetSec }, { composeSong }] = await Promise.all([
    import('./sequence-providers.ts'),
    import('../../../../engine/src/zzfx-compose.ts'),
  ]);
  // 30s is the seeded generator's own house length; a longer window than the song
  // simply analyses the song. A decode() that asks for a length composes to fit it,
  // on the same grid the timeline uses.
  return composeSong(generatedSongSpec(ref.seed, seconds === undefined ? 30 : zzfxmTargetSec(seconds), ref.style));
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

    /**
     * PCM for any source this shell can play (v1.246). Recorded audio decodes
     * through the platform; ZzFXM songs and tracker modules render through their
     * workers; a rondocode song renders in the `vm` class, exactly `seconds` long
     * when asked, and reports what it could not play in `findings` and how it ran
     * in `run`. Not cached here: the song client caches its own renders, and a
     * decoded file is the caller's to keep.
     */
    async decode(src: AudioSource, opts: AudioDecodeOpts = {}): Promise<AudioDecoded> {
      const d = await decodeSource(src, opts.seconds);
      const frames = d.channels[0]?.length ?? 0;
      return {
        sampleRate: d.sampleRate,
        channels: d.channels,
        seconds: d.sampleRate > 0 ? frames / d.sampleRate : 0,
        findings: d.findings,
        ...(d.run ? { run: d.run } : {}),
      };
    },
  };
}
