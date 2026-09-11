// SPDX-License-Identifier: MPL-2.0
/**
 * Stream-copy (remux) an audio track out of a source file WITHOUT decoding it.
 *
 * This is the "copy, don't decode" path for Extract audio (lolly plan 153 WP-E).
 * Instead of decoding a video's sound track to PCM and re-encoding it (lossy and
 * slow), we read the source's ENCODED audio packets and write them, byte for byte,
 * into a fresh audio-only container that already speaks that codec. The samples are
 * never touched, so the copy is exactly lossless and near instant.
 *
 * The read + write both run through mediabunny (already a dependency; the video
 * side of the same idea is bridge/mediabunny-mux.ts). mediabunny is imported lazily
 * so it never enters the preload bundle. This module is DOM-free on purpose: it
 * imports no i18n and no components, so the packet plumbing can be tested under
 * plain node with no jsdom.
 *
 * When the source codec has no honest audio-only container in our set, or the
 * container the source rode cannot be re-created (an exotic PCM flavour WAV will not
 * hold, a codec mediabunny cannot demux), streamCopyAudio returns null. That null is
 * the caller's signal to fall back to the decode + re-encode path, which stays the
 * safety net for every case the copy cannot serve.
 *
 * A real user cancel (an aborted signal) is re-thrown as an AbortError so the caller
 * can stop; it is never turned into a fall-back, because the packet loop checks the
 * signal between packets and a cancel means "stop", not "try the slow path instead".
 */
import type { AudioCodec } from 'mediabunny';

/**
 * Which audio-only container a given source codec is copied into, chosen so the
 * encoded packets ride it untouched, plus the file extension, MIME type and the
 * C2PA container key the engine's stamper understands.
 */
export interface AudioContainerChoice {
  /** Which mediabunny audio-only OutputFormat to build. */
  format: 'mp4' | 'ogg' | 'mp3' | 'flac' | 'wav';
  /** The saved file's extension (no dot); also the asset record's `format`. */
  ext: string;
  /** The container's honest MIME type. */
  mime: string;
  /** The format key the C2PA stamper recognises for this container, or null when
   *  the engine has no placer for it (the copy still saves, just unsigned). */
  c2paFormat: string | null;
}

/**
 * Pick the honest audio-only container for a source codec, or null when no container
 * in our set can carry it verbatim. The families we copy are the broadly playable
 * ones a video sound track normally uses: AAC, Opus, Vorbis, MP3, FLAC and linear
 * PCM. Anything else (AC-3, E-AC-3, mu-law, a-law, or an unknown codec) returns null
 * and the caller decodes and re-encodes instead. This is a coarse family map; the
 * authoritative "can this exact codec ride this container" test happens in
 * streamCopyAudio against the built format's own supported-codec list, which also
 * rejects the PCM flavours WAV does not accept.
 */
export function pickAudioContainer(codec: AudioCodec | string): AudioContainerChoice | null {
  switch (codec) {
    case 'aac':
      // AAC in an ISO BMFF box, saved as .m4a (audio/mp4). Broadly playable and the
      // engine has a bmff C2PA placer for it.
      return { format: 'mp4', ext: 'm4a', mime: 'audio/mp4', c2paFormat: 'm4a' };
    case 'opus':
      // Opus in Ogg, saved as .opus (audio/ogg). The engine's Ogg placer signs it.
      return { format: 'ogg', ext: 'opus', mime: 'audio/ogg', c2paFormat: 'opus' };
    case 'vorbis':
      // Vorbis in Ogg, saved as .ogg (audio/ogg).
      return { format: 'ogg', ext: 'ogg', mime: 'audio/ogg', c2paFormat: 'ogg' };
    case 'mp3':
      return { format: 'mp3', ext: 'mp3', mime: 'audio/mpeg', c2paFormat: 'mp3' };
    case 'flac':
      // FLAC in a native FLAC container. The engine has no FLAC C2PA placer, so the
      // copy saves unsigned (stamping is best-effort anyway).
      return { format: 'flac', ext: 'flac', mime: 'audio/flac', c2paFormat: null };
    default:
      if (typeof codec === 'string' && codec.startsWith('pcm-')) {
        // Linear PCM into a WAV. Only the flavours WAV supports pass the verify in
        // streamCopyAudio; the rest return null there and fall back.
        return { format: 'wav', ext: 'wav', mime: 'audio/wav', c2paFormat: 'wav' };
      }
      return null;
  }
}

/** The finished lossless copy: the container bytes plus everything the caller needs
 *  to name, type, stamp and record the saved asset. */
export interface RemuxResult {
  blob: Blob;
  /** The source codec, carried through verbatim. */
  codec: AudioCodec;
  /** File extension (no dot); also the asset record's `format`. */
  ext: string;
  mime: string;
  /** The C2PA container key, or null when the engine cannot stamp this container. */
  c2paFormat: string | null;
  /** Track duration in seconds, read from the source metadata. */
  durationSec: number;
}

/** What the copy reports back and how it learns it should stop. Cancellation is
 *  observed between packets, so a cancel during a long copy is genuinely abortive
 *  (unlike a whole-file decodeAudioData, which cannot be interrupted at all). */
export interface RemuxCtx {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  /** `total <= 0` means indeterminate, matching lib/jobs.ts. */
  onProgress?: (done: number, total: number, note?: string) => void;
  /** The note the copy stage reports once it has committed to copying. Injected so
   *  this module needs no i18n of its own; null or absent reports nothing. */
  copyNote?: string;
}

function remuxCancelled(ctx: RemuxCtx): boolean {
  return ctx.isCancelled?.() === true || ctx.signal?.aborted === true;
}

function remuxAbortError(): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException('The audio extraction was cancelled.', 'AbortError')
    : Object.assign(new Error('The audio extraction was cancelled.'), { name: 'AbortError' });
}

/** Build the mediabunny audio-only OutputFormat named by an AudioContainerChoice. */
function makeOutputFormat(MB: typeof import('mediabunny'), name: AudioContainerChoice['format']): import('mediabunny').OutputFormat {
  switch (name) {
    case 'mp4': return new MB.Mp4OutputFormat();
    case 'ogg': return new MB.OggOutputFormat();
    case 'mp3': return new MB.Mp3OutputFormat();
    case 'flac': return new MB.FlacOutputFormat();
    case 'wav': return new MB.WavOutputFormat();
  }
}

/**
 * Stream-copy the primary audio track of `input` into a matching audio-only
 * container. Returns the finished RemuxResult, or null when the copy cannot be done
 * honestly (no matching container, an empty track, or any read/parse failure), in
 * which case the caller should fall back to decode + re-encode. Re-throws an
 * AbortError on a genuine cancel.
 *
 * The `input` Blob is read through mediabunny's BlobSource; nothing is decoded. Each
 * source packet is added to the output source exactly as read, so the encoded audio
 * bytes are preserved to the last byte.
 */
export async function streamCopyAudio(input: Blob, ctx: RemuxCtx = {}): Promise<RemuxResult | null> {
  let MB: typeof import('mediabunny');
  try {
    MB = await import('mediabunny');
  } catch {
    return null;
  }

  let inputFile: import('mediabunny').Input | null = null;
  try {
    inputFile = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(input) });
    const track = await inputFile.getPrimaryAudioTrack();
    if (!track) return null;

    const codec = await track.getCodec();
    if (!codec) return null;

    const choice = pickAudioContainer(codec);
    if (!choice) return null;

    // Authoritative check: build the target format and confirm it can actually carry
    // this exact codec (this is what rejects a PCM flavour WAV does not support).
    const format = makeOutputFormat(MB, choice.format);
    if (!format.getSupportedAudioCodecs().includes(codec)) return null;

    // The decoder config describes the codec to the new container's header. Passing it
    // with the first packet keeps the output well-formed. (AudioDecoderConfig is the
    // ambient WebCodecs DOM type, inferred from getDecoderConfig's return.)
    const decoderConfig = await track.getDecoderConfig();

    // Prefer the cheap metadata duration; fall back to a computed one only if needed.
    let durationSec = 0;
    try {
      const meta = await track.getDurationFromMetadata();
      durationSec = meta != null && meta > 0 ? meta : await track.computeDuration();
    } catch {
      durationSec = 0;
    }

    if (remuxCancelled(ctx)) throw remuxAbortError();

    // Committed to the copy now, so report the stage (indeterminate; a byte count
    // here would be a guess).
    if (ctx.copyNote) ctx.onProgress?.(0, 0, ctx.copyNote);

    const target = new MB.BufferTarget();
    const output = new MB.Output({ format, target });
    const source = new MB.EncodedAudioPacketSource(codec);
    output.addAudioTrack(source);
    await output.start();

    const sink = new MB.EncodedPacketSink(track);
    let first = true;
    let wroteAny = false;
    for await (const packet of sink.packets()) {
      // The one place a cancel can be observed mid-copy. A whole-file decode had no
      // such point; this loop does, so cancel stops the copy between packets.
      if (remuxCancelled(ctx)) throw remuxAbortError();
      await source.add(packet, first && decoderConfig ? { decoderConfig } : undefined);
      first = false;
      wroteAny = true;
    }
    // An audio track with no packets is not a real copy; let the decode path report
    // "no audio to extract" with its own message.
    if (!wroteAny) return null;

    await output.finalize();
    const buffer = target.buffer;
    if (!buffer) return null;
    const blob = new Blob([buffer], { type: choice.mime });
    return { blob, codec, ext: choice.ext, mime: choice.mime, c2paFormat: choice.c2paFormat, durationSec };
  } catch (err) {
    // A genuine cancel must propagate; anything else means "cannot copy this", which
    // is the caller's cue to decode and re-encode instead.
    if ((err as Error | null)?.name === 'AbortError') throw err;
    return null;
  } finally {
    try {
      inputFile?.dispose();
    } catch {
      // best-effort resource release
    }
  }
}
