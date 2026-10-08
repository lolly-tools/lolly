// SPDX-License-Identifier: MPL-2.0
/**
 * host.audio (Node): the headless half of audio analysis for the CLI + TUI.
 *
 * The ANALYSIS is the engine's `analysePcm`, identical to the web shell's, so an
 * audiogram rendered in the terminal reads exactly the numbers the browser reads.
 * The only difference is the DECODER, and here it is honest about being narrow:
 *
 *   • **WAV** via the engine's dependency-free `parseWav`.
 *   • **ZzFXM**: our own procedural songs, rendered rather than decoded (both the
 *     catalog's `.zzfxm.json` files and the `zzfxm:<seed>` scheme).
 *   • **Rondocode** songs (plan 301): an asset of format `rondo`, a `.rondo` or
 *     `.rondo.json` file, its canonical bytes, or a rondocode share link. A song is
 *     code from someone else, so it is rendered by rondo.ts in a Worker, its code in
 *     the `vm` execution class, and never in this realm. `onRun` hears what ran and
 *     which parts were silent, because `analyse` has no field to carry that.
 *
 * Nothing else. Node has no MP3/AAC/Opus codec, and this deliberately does NOT shell
 * out to ffmpeg to pretend otherwise. A render that silently depends on whatever
 * binary happens to be on PATH is worse than one that says what it cannot read. So
 * `isAvailable()` is true (there IS a decoder) and `analyse` rejects by format name,
 * which is exactly the contract's stated behaviour: available never promised that any
 * particular file decodes.
 *
 * The practical upshot: an audiogram of a generated ZzFXM track, or of a WAV, renders
 * fully headlessly. That is what makes the tool testable and batch-renderable at
 * all. An MP3 needs a browser shell.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { isAbsolute, join } from 'node:path';
import {
  analysePcm, parseWav, packWav, cleanAudioPcm, resamplePcm, cleanAudioPreview,
  renderZzfxm, isZzfxmRef, parseZzfxmRef, composeSong, generatedSongSpec,
  RONDO_ASSET_FORMAT, RONDO_MAX_SOURCE_BYTES, RondoSourceError, isRondoFileName, isRondoShareLink,
  rondoFromBytes, rondoFromFile, rondoFromShareLink, rondoSourceBytes,
} from '@lolly/engine';
import type { RondoSourceV1, ZzfxSong } from '@lolly/engine';
import type {
  AudioAPI, AudioSource, AudioAnalyseOpts, AudioAnalysis, AssetRef, AudioCleanOpts,
  AudioDecodeOpts, AudioDecoded, AssetsAPI,
} from '@lolly-tools/core/host-v1';

import { contentRoots, contentUrlFile, type ContentRoots } from './content-roots.ts';
import {
  RondoAudioError, renderRondoSong, type ComputedAudioFailure, type ComputedAudioRun, type RondoBudget, type RondoCaps,
} from './rondo.ts';

export type { ComputedAudioFailure, ComputedAudioRun, RondoBudget, RondoCaps } from './rondo.ts';
export { HOSTED_RONDO_CAPS, LOCAL_RONDO_CAPS, RondoAudioError } from './rondo.ts';
// What a file records about the songs it holds (plan 301), built from the run reports.
export { recordedSongs, singleSongEssence, songIngredients, songIngredientsIn, songRunFacts } from './song-provenance.ts';

export interface NodeAudioOptions {
  /** Content root, for resolving a catalog asset's site-absolute `/catalog/...` url. */
  repoRoot: string;
  /** The limits a rondocode song renders under. Default `LOCAL_RONDO_CAPS`. */
  rondo?: RondoCaps;
  /** Told about every song render: what ran it and which parts were silent. */
  onRun?: (run: ComputedAudioRun) => void;
  /**
   * Told about a song that did not render, before the error is thrown. A tool's
   * hook may catch that error and draw a placeholder, so this is how a shell
   * still says what happened.
   */
  onRunFailed?: (failure: ComputedAudioFailure) => void;
  /**
   * Running total of song-render time against `rondo.budgetMs`. `createNodeAudioAPI`
   * makes one per audio host; pass one to share a total across several calls.
   */
  budget?: RondoBudget;
  /** The original file name, for raw bytes that carry none (`AudioCleanOpts.sourceName`). */
  sourceName?: string;
}

/** The content roots for a root, or undefined when none resolve there - a caller with
 *  a plain filesystem path needs no packs at all. */
function rootsFor(root: string): ContentRoots | undefined {
  try { return contentRoots({ root }); } catch { return undefined; }
}

/** Formats we can name but not decode. These get a specific message, since "unsupported"
 *  on an MP3 in a headless render is a confusing thing to hit. */
const NEEDS_PLATFORM_CODEC = /\.(mp3|m4a|aac|ogg|oga|opus|flac|weba|webm|mp4)$/i;

function isRef(src: AudioSource): src is AssetRef {
  return typeof src === 'object' && src !== null && 'url' in src && typeof (src as AssetRef).url === 'string';
}

/** A url/path/data-url/bytes source → raw encoded bytes. */
async function bytesOf(src: AudioSource, repoRoot: string): Promise<Uint8Array> {
  if (src instanceof Uint8Array) return src;
  if (src instanceof ArrayBuffer) return new Uint8Array(src);
  const url = isRef(src) ? src.url : src;

  if (url.startsWith('data:')) {
    const comma = url.indexOf(',');
    if (comma < 0) throw new Error('audio: malformed data URL');
    const head = url.slice(0, comma);
    const body = url.slice(comma + 1);
    return head.includes(';base64')
      ? new Uint8Array(Buffer.from(body, 'base64'))
      : new Uint8Array(Buffer.from(decodeURIComponent(body), 'binary'));
  }
  if (/^https?:/.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`audio: fetch failed (${res.status})`);
    return new Uint8Array(await res.arrayBuffer());
  }
  if (url.startsWith('file:')) return new Uint8Array(await readFile(fileURLToPath(url)));
  // A site-absolute content path (`/catalog/assets/...`, `/tools/<id>/...`) goes through
  // the content resolver, which knows which pack it lives in - it is not a directory
  // under the root. Anything else is a plain filesystem path.
  const roots = url.startsWith('/') ? rootsFor(repoRoot) : undefined;
  const content = roots ? contentUrlFile(url, roots) : null;
  const path = content
    ?? (isAbsolute(url) && !url.startsWith('/catalog/') && !url.startsWith('/community/')
      ? url
      : join(repoRoot, url.replace(/^\//, '')));
  return new Uint8Array(await readFile(path));
}

async function songOf(src: AudioSource, repoRoot: string): Promise<ZzfxSong> {
  const bytes = await bytesOf(src, repoRoot);
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as ZzfxSong;
}

/** The file name a url or path ends in, without a query or fragment. */
function fileNameOf(url: string): string {
  if (!url || url.startsWith('data:')) return '';
  return url.split(/[?#]/)[0]!.replace(/^.*[\\/]/, '');
}

/**
 * True for the canonical song record (`rondoSourceBytes`), recognised by content
 * alone. Only that form: a bare `{ name, code }` is rondocode's own export, and
 * without a `.rondo.json` name there is nothing to say it is a song.
 */
function looksLikeRondoRecord(b: Uint8Array): boolean {
  if (b.length > RONDO_MAX_SOURCE_BYTES * 2 + 4096) return false;
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i += 1;
  if (b[i] !== 0x7b) return false;
  try {
    const o = JSON.parse(new TextDecoder().decode(b)) as Record<string, unknown> | null;
    return !!o && typeof o === 'object' && o.format === 'rondocode' && typeof o.code === 'string';
  } catch {
    return false;
  }
}

/** Read a song, turning the reader's refusal into a named one. */
function readSong(read: () => RondoSourceV1): RondoSourceV1 {
  try {
    return read();
  } catch (e) {
    if (e instanceof RondoSourceError) throw new RondoAudioError(`The song could not be read: ${e.message}`, 'rondo.source.invalid');
    throw e;
  }
}

/** Render a song in its Worker and hand back the decoder's answer. */
async function renderSong(song: RondoSourceV1, opts: NodeAudioOptions, seconds: number | undefined): Promise<AudioDecoded> {
  let out: Awaited<ReturnType<typeof renderRondoSong>>;
  try {
    out = await renderRondoSong(song, {
      ...(seconds !== undefined ? { seconds } : {}),
      ...(opts.rondo ? { caps: opts.rondo } : {}),
      ...(opts.budget ? { budget: opts.budget } : {}),
    });
  } catch (e) {
    if (e instanceof RondoAudioError) opts.onRunFailed?.({ source: 'rondocode', name: song.name, code: e.code, message: e.message });
    throw e;
  }
  opts.onRun?.(out.report);
  return { sampleRate: out.sampleRate, channels: out.channels, seconds: out.seconds, findings: out.findings, run: out.run };
}

/** Recorded (or data-only) PCM as a decoder answer: nothing ran, nothing to report. */
const recorded = (channels: Float32Array[], sampleRate: number): AudioDecoded => ({
  sampleRate, channels, seconds: (channels[0]?.length ?? 0) / sampleRate, findings: [],
});

/**
 * Decode, or render, one source: the WAV parser, the ZzFXM renderer and the
 * rondocode renderer, nothing else. This is `host.audio.decode` (v1.246).
 *
 * `decodeOpts.seconds` sets a rondocode song's length; omitted, the song renders
 * its own arrangement (or 8 cycles). Recorded audio ignores it and comes back whole.
 * Rejects BY NAME for anything needing a platform codec, rather than returning
 * silence, and with a `RondoAudioError` (stable `code`) when a song cannot render.
 */
export async function decodeAudioSource(
  src: AudioSource, opts: NodeAudioOptions, decodeOpts: AudioDecodeOpts = {},
): Promise<AudioDecoded> {
  const { repoRoot } = opts;
  const ref = isRef(src) ? src : null;
  const url = ref ? ref.url : typeof src === 'string' ? src : '';

  // The PROCEDURAL `zzfxm:<seed>` scheme: composed here from the seed, through the
  // engine's own draw, so the terminal analyses the SAME song the browser plays.
  if (isZzfxmRef(url)) {
    const zref = parseZzfxmRef(url);
    if (!zref) throw new Error(`audio: malformed procedural song ref (${url})`);
    // 30s is the seeded generator's own house length, matching the web shell's
    // procedural path. Analysis of the same ref must not depend on the shell.
    const { left, right, sampleRate } = renderZzfxm(
      composeSong(generatedSongSpec(zref.seed, 30, zref.style)),
    );
    if (!left.length) throw new Error('audio: zzfxm song rendered empty');
    return recorded([left, right], sampleRate);
  }

  // A rondocode song. A share link carries the song in its fragment, so nothing is
  // fetched; a named file or a `rondo` asset is read, never fetched as audio.
  if (isRondoShareLink(url)) return renderSong(readSong(() => rondoFromShareLink(url)), opts, decodeOpts.seconds);
  const fileName = fileNameOf(url) || fileNameOf(opts.sourceName ?? '');
  if (ref?.format === RONDO_ASSET_FORMAT || isRondoFileName(fileName)) {
    const bytes = await bytesOf(src, repoRoot);
    // The name decides the reading: `.rondo` is rondo-language text, anything
    // else is a JSON record. A `rondo` asset with no telling name is read as
    // JSON when its bytes are an object, and as rondo text otherwise.
    const asName = isRondoFileName(fileName) ? fileName
      : looksLikeJsonObject(bytes) ? 'song.rondo.json' : 'song.rondo';
    return renderSong(readSong(() => rondoFromFile(bytes, asName)), opts, decodeOpts.seconds);
  }

  if ((ref && ref.format === 'zzfxm') || /\.zzfxm\.json$/i.test(url)) {
    const { left, right, sampleRate } = renderZzfxm(await songOf(src, repoRoot));
    if (!left.length) throw new Error('audio: zzfxm song rendered empty');
    return recorded([left, right], sampleRate);
  }

  if (NEEDS_PLATFORM_CODEC.test(url)) {
    throw new Error(
      `audio: ${url.split('.').pop()} needs a platform codec this shell does not have - `
      + 'analyse WAV, a ZzFXM song or a rondocode song headlessly, or render in a browser shell',
    );
  }

  const bytes = await bytesOf(src, repoRoot);
  // A song's canonical record arriving as bare bytes or a data: URL (a design
  // timeline inlines an audio box that way) is known by its own content.
  if (looksLikeRondoRecord(bytes)) return renderSong(readSong(() => rondoFromBytes(bytes)), opts, decodeOpts.seconds);
  // Name the container from its OWN bytes when the url could not. A design timeline
  // inlines an audio box as `data:application/octet-stream;base64,…`, which has no
  // extension for NEEDS_PLATFORM_CODEC to match, so an Ogg/Opus box used to come back
  // as "not a RIFF/WAVE file" - true, and useless. This says which format it is and
  // therefore what to do about it.
  const container = sniffContainer(bytes);
  if (container && container !== 'wav') {
    throw new Error(
      `audio: ${container} needs a platform codec this shell does not have - `
      + 'analyse WAV, a ZzFXM song or a rondocode song headlessly, or render in a browser shell',
    );
  }
  const { channels, sampleRate } = parseWav(bytes);
  return recorded(channels, sampleRate);
}

/** True when the first non-space byte opens a JSON object. */
function looksLikeJsonObject(b: Uint8Array): boolean {
  let i = b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf ? 3 : 0;
  while (i < b.length && (b[i] === 0x20 || b[i] === 0x09 || b[i] === 0x0a || b[i] === 0x0d)) i += 1;
  return b[i] === 0x7b;
}

/**
 * Decode one source to PCM: `decodeAudioSource` without the report.
 *
 * `analyse` below is one caller; the headless sequence mix (`sequence-audio.ts`, driven
 * by `lolly mix`) is the other, and both must read the same samples or a mixed WAV
 * would not match the analysis a tool's own hook saw. Rejects BY NAME for anything
 * needing a platform codec, rather than returning silence.
 */
export async function decodeAudioPcm(
  src: AudioSource, opts: NodeAudioOptions,
): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const { channels, sampleRate } = await decodeAudioSource(src, opts);
  return { channels, sampleRate };
}

/** The container a buffer's magic bytes name, or null when nothing matches. */
function sniffContainer(b: Uint8Array): string | null {
  const tag = (at: number, s: string): boolean =>
    b.length >= at + s.length && [...s].every((c, i) => b[at + i] === c.charCodeAt(0));
  if (tag(0, 'RIFF') && tag(8, 'WAVE')) return 'wav';
  if (tag(0, 'OggS')) return 'ogg/opus';
  if (tag(0, 'fLaC')) return 'flac';
  if (tag(0, 'ID3')) return 'mp3';
  if (b.length > 1 && b[0] === 0xff && (b[1]! & 0xe0) === 0xe0) return 'mp3';
  if (tag(4, 'ftyp')) return 'mp4/m4a';
  if (b.length > 3 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm/matroska';
  return null;
}


export function createNodeAudioAPI(opts: NodeAudioOptions): AudioAPI {
  // One song-render budget per audio host: one CLI run, one MCP request.
  const scoped: NodeAudioOptions = { ...opts, budget: opts.budget ?? { spentMs: 0 } };
  return {
    // There IS a decoder here (WAV, ZzFXM, rondocode), so this is true. Per the
    // contract it never promised that a given file decodes. analyse() rejects by
    // name for the formats Node cannot read.
    isAvailable: () => true,

    async analyse(src: AudioSource, analyseOpts: AudioAnalyseOpts = {}): Promise<AudioAnalysis> {
      // A song is analysed at the length `decode` gives it by default, its own
      // arrangement, so the analysis and a decode of the same song agree.
      const { channels, sampleRate } = await decodeAudioSource(src, scoped);
      // Synchronous: there is no worker here, and a headless render is not competing
      // with a UI for the main thread.
      return analysePcm(channels, sampleRate, analyseOpts);
    },

    async decode(src: AudioSource, decodeOpts: AudioDecodeOpts = {}): Promise<AudioDecoded> {
      return decodeAudioSource(src, scoped, decodeOpts);
    },

    async clean(src: AudioSource, cleanOpts: AudioCleanOpts = {}) {
      const format = cleanOpts.output ?? 'wav';
      if (format !== 'wav') {
        throw new Error(`audio clean: ${format} encoding needs a platform codec this shell does not have - choose WAV or use a browser shell`);
      }
      if ((cleanOpts.denoise ?? 'off') !== 'off') {
        throw new Error('audio clean: speech denoising needs the browser\'s on-device GTCRN model - choose Denoise off or use a browser shell');
      }
      const decoded = await decodeAudioSource(src, cleanOpts.sourceName ? { ...scoped, sourceName: cleanOpts.sourceName } : scoped);
      const channels = resamplePcm(decoded.channels, decoded.sampleRate);
      const result = cleanAudioPcm(channels, 48_000, cleanOpts);
      return {
        ...result,
        bytes: packWav({ channels: result.channels, sampleRate: result.sampleRate }, { format: 'int16' }),
        mime: 'audio/wav', format: 'wav' as const,
        preview: cleanAudioPreview(result),
      };
    },
  };
}

/** The input fields `prerenderSongInputs` reads from a tool manifest. */
interface SongInputDecl {
  id: string;
  type: string;
  assetType?: string;
}

/**
 * Render every rondocode song a tool's inputs name, before the tool mounts.
 *
 * A tool's hooks run under the engine's time budgets (`HOOK_BUDGET_MS`: 5 s for
 * `onInit`), and a song can take longer than that to render, so a hook that
 * analyses one would lose the race and the export would fail. Rendering first
 * puts the result in rondo.ts's short-lived cache, where the hook's own call finds
 * the finished samples. Nothing new runs: the same Worker, the same caps, the same
 * report. A song that fails here fails the same way for the hook, which decides
 * what to draw.
 *
 * Reads three shapes: an `asset` value that is a share link or a `rondo` ref (or,
 * for an `assetType: "audio"` input, a catalog id that resolves to one), and a
 * `file` value whose name is a song file.
 */
export async function prerenderSongInputs(
  inputs: readonly SongInputDecl[],
  values: Record<string, unknown>,
  host: { audio?: AudioAPI; assets?: Pick<AssetsAPI, 'get'> },
): Promise<void> {
  const decode = host.audio?.decode;
  if (!decode) return;
  for (const input of inputs) {
    const value = values[input.id];
    if (!value || typeof value !== 'object') continue;
    let src: AudioSource | null = null;
    if (input.type === 'asset') {
      const v = value as Partial<AssetRef> & { _unresolved?: boolean };
      if (typeof v.id === 'string' && isRondoShareLink(v.id)) src = v.id;
      else if (v.format === RONDO_ASSET_FORMAT && typeof v.url === 'string' && v.url) src = v as AssetRef;
      else if (v._unresolved && typeof v.id === 'string' && input.assetType === 'audio' && host.assets) {
        const ref = await host.assets.get(v.id).catch(() => null);
        if (ref?.format === RONDO_ASSET_FORMAT) src = ref;
      }
    } else if (input.type === 'file') {
      const f = value as { name?: unknown; bytes?: unknown };
      if (typeof f.name === 'string' && isRondoFileName(f.name) && f.bytes instanceof Uint8Array) {
        try {
          src = rondoSourceBytes(rondoFromFile(f.bytes, f.name));
        } catch {
          // An unreadable song is the tool's to report, with the reader's own words.
        }
      }
    }
    if (!src) continue;
    try {
      await decode.call(host.audio, src);
    } catch {
      // Reported through onRunFailed already; the hook meets the same answer.
    }
  }
}
