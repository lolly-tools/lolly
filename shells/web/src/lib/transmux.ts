// SPDX-License-Identifier: MPL-2.0
/**
 * Transmux (lossless container rewrite) a video file WITHOUT decoding it.
 *
 * mp4 to mov to mkv, and a compatible-codec source to webm, are CONTAINER REWRITES,
 * not transcodes. The encoded picture and sound packets are lifted out of the source
 * container and written, byte for byte, into a fresh container that already speaks
 * the same codecs. Nothing is decoded and nothing is re-encoded, so the copy is near
 * instant, costs no quality, and every codec-config signal (including the HDR colour
 * space, primaries, transfer function and range that ride a decoder config) is passed
 * onto the output track unchanged. This is the video twin of the audio stream copy in
 * lib/audio-remux.ts and shares its shape: read encoded packets from an
 * EncodedPacketSink, write them into a single mb.Output through the matching
 * EncodedVideoPacketSource / EncodedAudioPacketSource, and interleave the tracks by
 * presentation timestamp (the same idea as bridge/mediabunny-mux.ts).
 *
 * mediabunny is imported lazily so it never enters the preload bundle. This module is
 * DOM-free on purpose: it imports no i18n and no components, so the packet plumbing is
 * testable under plain node with no jsdom, and its losslessness is provable with
 * mediabunny alone.
 *
 * transmuxContainer returns null (the caller falls back to a transcode, or refuses)
 * when the rewrite cannot be done honestly:
 *   - the target container is the same as the source's (nothing to do),
 *   - the input cannot be parsed,
 *   - a codec that must be kept is not legal in the target. The video track is the
 *     picture, so a source that has video whose codec the target cannot carry returns
 *     null rather than quietly writing a soundtrack-only file. A secondary track whose
 *     codec is illegal (for example an AAC sound track into WebM, which only takes
 *     Opus or Vorbis) is DROPPED and counted, and the rewrite proceeds with the tracks
 *     that are legal.
 * A genuine cancel is abortive, not a fall-back: the signal is checked between packets
 * and re-thrown as an AbortError, because a cancel means stop, not try the slow path.
 *
 * This is the engine half of plan 153 WP-E for video. WP-H wires the user-facing
 * convert surface on top of it; nothing here touches the UI.
 *
 * Subtitles: mediabunny's demuxer surfaces only video and audio tracks as
 * encoded-packet sources, and its only subtitle output source takes parsed text
 * rather than verbatim packets, so a subtitle track cannot be copied byte for byte
 * through this path. Subtitle tracks are therefore dropped for now (WP-H can decide
 * whether to re-author them from text when a container carries them).
 */
import type { AudioCodec, BlobSource, UrlSource, VideoCodec } from 'mediabunny';

/** The container this module can rewrite into. mp4 and mov are both ISO base media
 *  boxes with different brands; mkv and webm are both Matroska with different codec
 *  allowances (webm is the vp8/vp9/av1 + opus/vorbis subset). */
export type TransmuxTarget = 'mp4' | 'mov' | 'mkv' | 'webm';

/** The saved file's extension (no dot) and honest MIME type for each target. */
export interface TransmuxContainerInfo {
  ext: string;
  mime: string;
}

/** File extension and MIME for each target container. */
export const TRANSMUX_CONTAINERS: Record<TransmuxTarget, TransmuxContainerInfo> = {
  mp4: { ext: 'mp4', mime: 'video/mp4' },
  mov: { ext: 'mov', mime: 'video/quicktime' },
  mkv: { ext: 'mkv', mime: 'video/x-matroska' },
  webm: { ext: 'webm', mime: 'video/webm' },
};

/** A mediabunny source to read from. Any mediabunny Source works; the two the callers
 *  use are a BlobSource (an in-memory or picked file) and a UrlSource (a remote file). */
export type TransmuxSource = UrlSource | BlobSource;

/** What a transmux reports back, and how it learns it should stop. Cancellation is
 *  observed between packets, so a cancel during a long copy is genuinely abortive. */
export interface TransmuxCtx {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  /** `total <= 0` means indeterminate, matching lib/jobs.ts. */
  onProgress?: (done: number, total: number, note?: string) => void;
  /** The note the copy stage reports once it has committed to copying. Injected so
   *  this module needs no i18n of its own; null or absent reports nothing. */
  copyNote?: string;
}

/** The finished rewrite: the container bytes plus what the caller needs to name, type
 *  and record the saved file. */
export interface TransmuxResult {
  blob: Blob;
  /** Which container was written. */
  container: TransmuxTarget;
  /** File extension (no dot). */
  ext: string;
  /** The container's honest MIME type. */
  mime: string;
  /** The copied video codec, or null when the source had no video track. */
  videoCodec: VideoCodec | null;
  /** The copied audio codec, or null when the source had no audio track or its audio
   *  codec was illegal in the target and got dropped. */
  audioCodec: AudioCodec | null;
  /** How many source tracks were dropped because their codec is not legal in the
   *  target container (subtitle tracks are always dropped, see the module note). */
  droppedTracks: number;
  /** Total duration in seconds, read from the source. */
  durationSec: number;
}

function transmuxCancelled(ctx: TransmuxCtx): boolean {
  return ctx.isCancelled?.() === true || ctx.signal?.aborted === true;
}

function transmuxAbortError(): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException('The conversion was cancelled.', 'AbortError')
    : Object.assign(new Error('The conversion was cancelled.'), { name: 'AbortError' });
}

/** Build the mediabunny OutputFormat for a target container. mp4 and mov are the two
 *  ISO base media brands; mkv and webm are Matroska and its codec subset. */
function makeOutputFormat(MB: typeof import('mediabunny'), target: TransmuxTarget): import('mediabunny').OutputFormat {
  switch (target) {
    case 'mp4': return new MB.Mp4OutputFormat();
    case 'mov': return new MB.MovOutputFormat();
    case 'mkv': return new MB.MkvOutputFormat();
    case 'webm': return new MB.WebMOutputFormat();
  }
}

/** Map the source's detected input format to a target id, so a rewrite into the same
 *  container can be refused (nothing to do). Compares against mediabunny's format
 *  singletons; WebM and MKV are distinct singletons even though WebM is a Matroska
 *  subset, so a webm source and an mkv source are told apart. Returns null for a
 *  container this module does not name (it will simply not match the target). */
function sourceContainerId(MB: typeof import('mediabunny'), format: import('mediabunny').InputFormat): TransmuxTarget | null {
  if (format === MB.MP4) return 'mp4';
  if (format === MB.QTFF) return 'mov';
  if (format === MB.WEBM) return 'webm';
  if (format === MB.MATROSKA) return 'mkv';
  return null;
}

/** One track queued for copying: its encoded-packet reader, the output source it feeds,
 *  and the decoder config to hand over with its first packet. */
interface CopyPlan {
  kind: 'video' | 'audio';
  sink: import('mediabunny').EncodedPacketSink;
  source: import('mediabunny').EncodedVideoPacketSource | import('mediabunny').EncodedAudioPacketSource;
  videoCodec: VideoCodec | null;
  audioCodec: AudioCodec | null;
  meta: EncodedVideoChunkMetadata | EncodedAudioChunkMetadata | undefined;
}

/**
 * Rewrite `source` into `target` as a lossless container copy. Returns the finished
 * TransmuxResult, or null when the rewrite cannot be done honestly (same container,
 * an unparseable input, or a required track's codec that the target cannot carry), in
 * which case the caller should fall back to a transcode or refuse. Re-throws an
 * AbortError on a genuine cancel.
 *
 * No sample is ever decoded. Each source packet is added to the matching output source
 * exactly as read, and the first packet of each track carries that track's decoder
 * config, so the new container header (codec config, and the HDR colour signalling it
 * carries) matches the source's. mediabunny writes the tracks interleaved by
 * presentation timestamp.
 */
export async function transmuxContainer(
  source: TransmuxSource, target: TransmuxTarget, ctx: TransmuxCtx = {},
): Promise<TransmuxResult | null> {
  let MB: typeof import('mediabunny');
  try {
    MB = await import('mediabunny');
  } catch {
    return null;
  }

  let inputFile: import('mediabunny').Input | null = null;
  try {
    // Read only the container set this module rewrites among, not ALL_FORMATS: the
    // shared video-container singletons (the same set video-jobs.ts opens with).
    inputFile = new MB.Input({ formats: [MB.MP4, MB.QTFF, MB.WEBM, MB.MATROSKA], source });
    if (!(await inputFile.canRead())) return null;

    // Refuse a rewrite into the container the source already is: there is nothing to
    // copy and the output would just be the input.
    const srcFormat = await inputFile.getFormat();
    if (sourceContainerId(MB, srcFormat) === target) return null;

    const tracks = await inputFile.getTracks();
    if (tracks.length === 0) return null;

    // The target format is the authority on which codecs it can carry. Verify every
    // track's codec against its own supported-codec lists rather than a hand-written
    // table, so an illegal codec/container pairing can never be written.
    const format = makeOutputFormat(MB, target);
    const legalVideo = new Set(format.getSupportedVideoCodecs());
    const legalAudio = new Set(format.getSupportedAudioCodecs());

    const info = TRANSMUX_CONTAINERS[target];
    const outTarget = new MB.BufferTarget();
    const output = new MB.Output({ format, target: outTarget });

    const plans: CopyPlan[] = [];
    let sourceHasVideo = false;
    let keptVideoCodec: VideoCodec | null = null;
    let keptAudioCodec: AudioCodec | null = null;
    let dropped = 0;

    for (const track of tracks) {
      if (track.isVideoTrack()) {
        sourceHasVideo = true;
        const codec = await track.getCodec();
        if (!codec || !legalVideo.has(codec)) { dropped++; continue; }
        const decoderConfig = await track.getDecoderConfig();
        const packetSource = new MB.EncodedVideoPacketSource(codec);
        // Preserve the display rotation the source recorded, so a phone video written
        // into a new container is still the right way up. The colour space and every
        // other codec signal ride the decoder config below.
        const rotation = await track.getRotation();
        const languageCode = track.languageCode;
        const metadata: import('mediabunny').VideoTrackMetadata = {};
        if (rotation) metadata.rotation = rotation;
        if (languageCode && languageCode !== 'und') metadata.languageCode = languageCode;
        output.addVideoTrack(packetSource, metadata);
        keptVideoCodec = codec;
        plans.push({
          kind: 'video', sink: new MB.EncodedPacketSink(track), source: packetSource,
          videoCodec: codec, audioCodec: null,
          meta: decoderConfig ? { decoderConfig } : undefined,
        });
      } else if (track.isAudioTrack()) {
        const codec = await track.getCodec();
        if (!codec || !legalAudio.has(codec)) { dropped++; continue; }
        const decoderConfig = await track.getDecoderConfig();
        const packetSource = new MB.EncodedAudioPacketSource(codec);
        const languageCode = track.languageCode;
        const metadata: import('mediabunny').AudioTrackMetadata = {};
        if (languageCode && languageCode !== 'und') metadata.languageCode = languageCode;
        output.addAudioTrack(packetSource, metadata);
        keptAudioCodec = codec;
        plans.push({
          kind: 'audio', sink: new MB.EncodedPacketSink(track), source: packetSource,
          videoCodec: null, audioCodec: codec,
          meta: decoderConfig ? { decoderConfig } : undefined,
        });
      } else {
        // A subtitle or other track type mediabunny does not expose as an encoded
        // packet reader. Nothing to copy verbatim, so it is dropped (see the note).
        dropped++;
      }
    }

    // A source that has a picture must keep its picture. If the video codec is not
    // legal in the target we refuse the whole rewrite rather than write an audio-only
    // file the user did not ask for; the caller can transcode instead.
    if (sourceHasVideo && keptVideoCodec === null) return null;
    // Nothing legal to write at all: fall back.
    if (plans.length === 0) return null;

    let durationSec = 0;
    try {
      durationSec = await inputFile.computeDuration();
    } catch {
      durationSec = 0;
    }

    if (transmuxCancelled(ctx)) throw transmuxAbortError();

    // Committed to the copy now, so report the stage (indeterminate; a byte count here
    // would be a guess).
    if (ctx.copyNote) ctx.onProgress?.(0, 0, ctx.copyNote);

    await output.start();

    // Interleave the kept tracks by presentation timestamp: a k-way merge over each
    // track's decode-order packet iterator, always adding the packet with the smallest
    // timestamp next. Each track's own packets stay in decode order (the sink yields
    // them that way), so only the cross-track order is decided here, exactly as
    // bridge/mediabunny-mux.ts interleaves the two encoder streams.
    interface Cursor {
      plan: CopyPlan;
      iter: AsyncIterator<import('mediabunny').EncodedPacket>;
      next: import('mediabunny').EncodedPacket | null;
      done: boolean;
      first: boolean;
    }
    const cursors: Cursor[] = plans.map((plan) => ({
      plan, iter: plan.sink.packets()[Symbol.asyncIterator](), next: null, done: false, first: true,
    }));
    // Prime each track with its first packet.
    for (const c of cursors) {
      const r = await c.iter.next();
      if (r.done) c.done = true; else c.next = r.value;
    }

    let wroteAny = false;
    for (;;) {
      // The one place a cancel can be observed mid-copy. A cancel stops the copy
      // between packets and is re-thrown, never demoted to a null fall-back.
      if (transmuxCancelled(ctx)) throw transmuxAbortError();

      // Pick the live cursor whose next packet has the smallest presentation timestamp.
      let pick: Cursor | null = null;
      for (const c of cursors) {
        if (c.done || c.next === null) continue;
        if (pick === null || c.next.timestamp < pick.next!.timestamp) pick = c;
      }
      if (pick === null) break;

      const packet = pick.next!;
      const meta = pick.first ? pick.plan.meta : undefined;
      if (pick.plan.kind === 'video') {
        await (pick.plan.source as import('mediabunny').EncodedVideoPacketSource).add(packet, meta as EncodedVideoChunkMetadata | undefined);
      } else {
        await (pick.plan.source as import('mediabunny').EncodedAudioPacketSource).add(packet, meta as EncodedAudioChunkMetadata | undefined);
      }
      pick.first = false;
      wroteAny = true;

      const r = await pick.iter.next();
      if (r.done) { pick.done = true; pick.next = null; } else { pick.next = r.value; }
    }

    // Every kept track was empty, so no real copy happened; fall back.
    if (!wroteAny) return null;

    await output.finalize();
    const buffer = outTarget.buffer;
    if (!buffer) return null;
    const blob = new Blob([buffer], { type: info.mime });
    return {
      blob, container: target, ext: info.ext, mime: info.mime,
      videoCodec: keptVideoCodec, audioCodec: keptAudioCodec,
      droppedTracks: dropped, durationSec,
    };
  } catch (err) {
    // A genuine cancel must propagate; anything else means this source cannot be
    // rewritten, which is the caller's cue to fall back or refuse.
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
