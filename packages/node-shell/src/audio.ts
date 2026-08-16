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

export function createNodeAudioAPI(opts: NodeAudioOptions): AudioAPI {
  const { repoRoot } = opts;

  /** A url/path/data-url/bytes source → raw encoded bytes. */
  async function bytesOf(src: AudioSource): Promise<Uint8Array> {
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

  async function songOf(src: AudioSource): Promise<ZzfxSong> {
    const bytes = await bytesOf(src);
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as ZzfxSong;
  }

  async function toPcm(src: AudioSource): Promise<{ channels: Float32Array[]; sampleRate: number }> {
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
      const { left, right, sampleRate } = renderZzfxm(await songOf(src));
      if (!left.length) throw new Error('audio: zzfxm song rendered empty');
      return { channels: [left, right], sampleRate };
    }

    if (NEEDS_PLATFORM_CODEC.test(url)) {
      throw new Error(
        `audio: ${url.split('.').pop()} needs a platform codec this shell does not have — `
        + 'analyse WAV or a ZzFXM song headlessly, or render in a browser shell',
      );
    }

    const { channels, sampleRate } = parseWav(await bytesOf(src));
    return { channels, sampleRate };
  }

  return {
    // There IS a decoder here (WAV + ZzFXM), so this is true. Per the contract it
    // never promised that a given file decodes. analyse() rejects by name for the
    // formats Node cannot read.
    isAvailable: () => true,

    async analyse(src: AudioSource, analyseOpts: AudioAnalyseOpts = {}): Promise<AudioAnalysis> {
      const { channels, sampleRate } = await toPcm(src);
      // Synchronous: there is no worker here, and a headless render is not competing
      // with a UI for the main thread.
      return analysePcm(channels, sampleRate, analyseOpts);
    },
  };
}
