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
  analysePcm, parseWav, renderZzfxm, isZzfxmRef, parseZzfxmRef, composeSong, generatedSongSpec,
} from '@lolly/engine';
import type { ZzfxSong } from '@lolly/engine';
import type {
  AudioAPI, AudioSource, AudioAnalyseOpts, AudioAnalysis, AssetRef,
} from '@lolly-tools/core/host-v1';

export interface NodeAudioOptions {
  /** Repo root, for resolving a catalog asset's site-absolute `/catalog/...` url. */
  repoRoot: string;
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
  // A site-absolute catalog path (`/catalog/assets/...`) or a plain filesystem path.
  const path = isAbsolute(url) && !url.startsWith('/catalog/') && !url.startsWith('/community/')
    ? url
    : join(repoRoot, url.replace(/^\//, ''));
  return new Uint8Array(await readFile(path));
}

async function songOf(src: AudioSource, repoRoot: string): Promise<ZzfxSong> {
  const bytes = await bytesOf(src, repoRoot);
  return JSON.parse(Buffer.from(bytes).toString('utf8')) as ZzfxSong;
}

/**
 * Decode one source to PCM: the WAV parser and the ZzFXM renderer, nothing else.
 *
 * `analyse` below is one caller; the headless sequence mix (`sequence-audio.ts`, driven
 * by `lolly mix`) is the other, and both must read the same samples or a mixed WAV
 * would not match the analysis a tool's own hook saw. Rejects BY NAME for anything
 * needing a platform codec, rather than returning silence.
 */
export async function decodeAudioPcm(
  src: AudioSource, opts: NodeAudioOptions,
): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const { repoRoot } = opts;
  const url = isRef(src) ? src.url : typeof src === 'string' ? src : '';

  // The PROCEDURAL `zzfxm:<seed>` scheme: composed here from the seed, through the
  // engine's own draw, so the terminal analyses the SAME song the browser plays.
  if (isZzfxmRef(url)) {
    const ref = parseZzfxmRef(url);
    if (!ref) throw new Error(`audio: malformed procedural song ref (${url})`);
    // 30s is the seeded generator's own house length, matching the web shell's
    // procedural path. Analysis of the same ref must not depend on the shell.
    const { left, right, sampleRate } = renderZzfxm(
      composeSong(generatedSongSpec(ref.seed, 30, ref.style)),
    );
    if (!left.length) throw new Error('audio: zzfxm song rendered empty');
    return { channels: [left, right], sampleRate };
  }

  if ((isRef(src) && src.format === 'zzfxm') || /\.zzfxm\.json$/i.test(url)) {
    const { left, right, sampleRate } = renderZzfxm(await songOf(src, repoRoot));
    if (!left.length) throw new Error('audio: zzfxm song rendered empty');
    return { channels: [left, right], sampleRate };
  }

  if (NEEDS_PLATFORM_CODEC.test(url)) {
    throw new Error(
      `audio: ${url.split('.').pop()} needs a platform codec this shell does not have - `
      + 'analyse WAV or a ZzFXM song headlessly, or render in a browser shell',
    );
  }

  const bytes = await bytesOf(src, repoRoot);
  // Name the container from its OWN bytes when the url could not. A design timeline
  // inlines an audio box as `data:application/octet-stream;base64,…`, which has no
  // extension for NEEDS_PLATFORM_CODEC to match, so an Ogg/Opus box used to come back
  // as "not a RIFF/WAVE file" - true, and useless. This says which format it is and
  // therefore what to do about it.
  const container = sniffContainer(bytes);
  if (container && container !== 'wav') {
    throw new Error(
      `audio: ${container} needs a platform codec this shell does not have - `
      + 'analyse WAV or a ZzFXM song headlessly, or render in a browser shell',
    );
  }
  const { channels, sampleRate } = parseWav(bytes);
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
  return {
    // There IS a decoder here (WAV + ZzFXM), so this is true. Per the contract it
    // never promised that a given file decodes. analyse() rejects by name for the
    // formats Node cannot read.
    isAvailable: () => true,

    async analyse(src: AudioSource, analyseOpts: AudioAnalyseOpts = {}): Promise<AudioAnalysis> {
      const { channels, sampleRate } = await decodeAudioPcm(src, opts);
      // Synchronous: there is no worker here, and a headless render is not competing
      // with a UI for the main thread.
      return analysePcm(channels, sampleRate, analyseOpts);
    },
  };
}
