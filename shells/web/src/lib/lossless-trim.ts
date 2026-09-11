// SPDX-License-Identifier: MPL-2.0
/**
 * Lossless keyframe-aligned trim: cut a [inSec, outSec) window out of a video by
 * PACKET-COPYING it, not by decoding and re-encoding.
 *
 * The catalog trim path (plan 130 WP-C) re-encodes every frame in the window, which
 * is slow and costs a generation of quality. When the cut can start on a keyframe the
 * window can instead be lifted out of the source container packet by packet and
 * written, byte for byte, into a fresh container that speaks the same codecs. Nothing
 * is decoded and nothing is re-encoded, so the trim is near instant, adds no quality
 * loss, and every codec-config signal (including the HDR colour space, primaries,
 * transfer function and range that ride a decoder config) is passed onto the output
 * track unchanged. This is the same verbatim-packet-copy engine as lib/transmux.ts and
 * lib/audio-remux.ts, restricted to a time window.
 *
 * The catch a lossless trim has to respect: a decoder can only begin at a keyframe (a
 * packet that decodes without earlier packets). So the cut-in is moved back to the
 * keyframe at or before the requested inSec, and the OUTPUT's first video packet is
 * always that keyframe. The out point can fall on any packet boundary, because every
 * delta packet in the window depends only on packets that are also in the window (the
 * copy is contiguous from the keyframe forward). Audio can cut anywhere, so it is
 * trimmed to the same window, starting at the first audio packet at or after the video
 * cut-in.
 *
 * losslessTrim returns null when the fast path cannot be taken honestly (no video
 * track, an unparseable input, an empty window, or exactBounds requested on an
 * off-keyframe cut). Null is the caller's signal to fall back to the transcoding trim,
 * which stays the safety net for a mid-GOP cut. A genuine cancel is abortive, not a
 * fall-back: the signal is checked between packets and re-thrown as an AbortError.
 *
 * mediabunny is imported lazily so it never enters the preload bundle. This module is
 * DOM-free on purpose: it imports no i18n and no components, so the packet plumbing is
 * testable under plain node with no jsdom, and its losslessness is provable with
 * mediabunny alone.
 *
 * This is a standalone engine for now. There is no clean existing trim function to add
 * the fast path to: lib/video-jobs.ts drives the trim op through the full decode +
 * re-encode renderer (its TrimVideoParams carry an fps and bitrate, which a packet copy
 * never uses), so wiring the fast path in front of that renderer, and offering the
 * keyframe-snapping choice in the trim UI, are a WP-H follow-on. See the note at the
 * foot of this file.
 */
import type { AudioCodec, VideoCodec } from 'mediabunny';
import { TRANSMUX_CONTAINERS, type TransmuxSource, type TransmuxTarget } from './transmux.ts';

/** The container a lossless trim can write into: the same set lib/transmux.ts rewrites
 *  among. When no target is given the output keeps the source's own container. */
export type LosslessTrimTarget = TransmuxTarget;

/** A mediabunny source to read from (a BlobSource for an in-memory or picked file, a
 *  UrlSource for a remote one), reusing lib/transmux.ts's source type. */
export type LosslessTrimSource = TransmuxSource;

/** What a trim reports back, how it learns it should stop, and the two policy knobs.
 *  Cancellation is observed between packets, so a cancel during a long copy is genuinely
 *  abortive. */
export interface LosslessTrimCtx {
  signal?: AbortSignal;
  isCancelled?: () => boolean;
  /** `total <= 0` means indeterminate, matching lib/jobs.ts. */
  onProgress?: (done: number, total: number, note?: string) => void;
  /** The note the copy stage reports once it has committed to copying. Injected so this
   *  module needs no i18n of its own; null or absent reports nothing. */
  copyNote?: string;
  /** When true, refuse (return null) a cut whose bounds are NOT already keyframe/packet
   *  aligned, so the caller falls back to a transcoding trim rather than the fast path
   *  silently moving the cut-in back to the previous keyframe. When false (the default)
   *  the cut-in is snapped back to the previous keyframe and the snap is reported. */
  exactBounds?: boolean;
  /** How close a requested bound must sit to a real boundary to count as already
   *  aligned, in seconds. Absorbs container timescale rounding and float noise without
   *  reaching a neighbouring frame. Defaults to one millisecond. */
  snapEpsilonSec?: number;
}

/** The finished trim: the container bytes plus the window that was actually copied and
 *  whether the cut-in had to be snapped back to a keyframe. */
export interface LosslessTrimResult {
  blob: Blob;
  /** Which container was written. */
  container: LosslessTrimTarget;
  /** File extension (no dot). */
  ext: string;
  /** The container's honest MIME type. */
  mime: string;
  /** The copied video codec (a lossless trim always keeps the video). */
  videoCodec: VideoCodec | null;
  /** The copied audio codec, or null when the source had no audio in the window or its
   *  codec was illegal in the target and got dropped. */
  audioCodec: AudioCodec | null;
  /** How many source tracks were dropped (a secondary video track, a subtitle track, or
   *  an audio track whose codec the target cannot carry). */
  droppedTracks: number;
  /** The window the caller asked for, in source time (seconds). */
  requestedInSec: number;
  requestedOutSec: number;
  /** The window actually copied, in source time (seconds). snappedInSec is the keyframe
   *  the cut begins on; snappedOutSec is the packet boundary at or after outSec. */
  snappedInSec: number;
  snappedOutSec: number;
  /** True when snappedInSec was moved back from the requested inSec (the cut-in was not
   *  already on a keyframe). A UI can show "snapped to keyframe" when this is set. */
  snapped: boolean;
  /** Output duration in seconds (snappedOutSec minus snappedInSec). The output's
   *  timestamps are rebased so it starts at 0. */
  durationSec: number;
}

function trimCancelled(ctx: LosslessTrimCtx): boolean {
  return ctx.isCancelled?.() === true || ctx.signal?.aborted === true;
}

function trimAbortError(): Error {
  return typeof DOMException !== 'undefined'
    ? new DOMException('The trim was cancelled.', 'AbortError')
    : Object.assign(new Error('The trim was cancelled.'), { name: 'AbortError' });
}

/** Build the mediabunny OutputFormat for a target container. mp4 and mov are the two
 *  ISO base media brands; mkv and webm are Matroska and its codec subset. */
function makeOutputFormat(MB: typeof import('mediabunny'), target: LosslessTrimTarget): import('mediabunny').OutputFormat {
  switch (target) {
    case 'mp4': return new MB.Mp4OutputFormat();
    case 'mov': return new MB.MovOutputFormat();
    case 'mkv': return new MB.MkvOutputFormat();
    case 'webm': return new MB.WebMOutputFormat();
  }
}

/** Map the source's detected input format to a target id, so a trim with no explicit
 *  target keeps the source's own container. WebM and MKV are distinct singletons even
 *  though WebM is a Matroska subset, so a webm source and an mkv source are told apart.
 *  Returns null for a container this module does not name. */
function sourceContainerId(MB: typeof import('mediabunny'), format: import('mediabunny').InputFormat): LosslessTrimTarget | null {
  if (format === MB.MP4) return 'mp4';
  if (format === MB.QTFF) return 'mov';
  if (format === MB.WEBM) return 'webm';
  if (format === MB.MATROSKA) return 'mkv';
  return null;
}

/** One track queued for copying: its encoded-packet reader, the packet iteration should
 *  begin at, the output source it feeds, and the decoder config to hand over with its
 *  first written packet. */
interface CopyPlan {
  kind: 'video' | 'audio';
  sink: import('mediabunny').EncodedPacketSink;
  startPacket: import('mediabunny').EncodedPacket;
  source: import('mediabunny').EncodedVideoPacketSource | import('mediabunny').EncodedAudioPacketSource;
  meta: EncodedVideoChunkMetadata | EncodedAudioChunkMetadata | undefined;
}

/**
 * Cut the window [inSec, outSec) out of `source` as a lossless packet copy. `target`
 * picks the output container; when omitted the source's own container is kept. Returns
 * the finished LosslessTrimResult, or null when the fast path cannot be taken (no video
 * track, an unparseable input, an empty window, exactBounds requested on an off-keyframe
 * cut, or a required video codec the target cannot carry). Re-throws an AbortError on a
 * genuine cancel.
 *
 * No sample is ever decoded. The cut-in is moved back to the keyframe at or before
 * inSec, so the output's first video packet is a keyframe and decodes standalone. Every
 * copied packet's timestamp is rebased by subtracting the cut-in, so the output starts
 * at 0, while its coded bytes, type and duration are copied unchanged. The first packet
 * of each track carries that track's decoder config, so the new container header (codec
 * config, and the HDR colour signalling it carries) matches the source's.
 */
export async function losslessTrim(
  source: LosslessTrimSource, inSec: number, outSec: number,
  target?: LosslessTrimTarget, ctx: LosslessTrimCtx = {},
): Promise<LosslessTrimResult | null> {
  // A window with no positive extent, or a negative in point, has nothing to copy.
  if (!(inSec >= 0) || !(outSec > inSec)) return null;
  const eps = ctx.snapEpsilonSec != null && ctx.snapEpsilonSec >= 0 ? ctx.snapEpsilonSec : 1e-3;

  let MB: typeof import('mediabunny');
  try {
    MB = await import('mediabunny');
  } catch {
    return null;
  }

  let inputFile: import('mediabunny').Input | null = null;
  try {
    // Read only the container set this module trims among, not ALL_FORMATS: the shared
    // video-container singletons (the same set video-jobs.ts and transmux.ts open with).
    inputFile = new MB.Input({ formats: [MB.MP4, MB.QTFF, MB.WEBM, MB.MATROSKA], source });
    if (!(await inputFile.canRead())) return null;

    // A lossless trim needs a video track to define the keyframe grid the cut snaps to.
    const videoTrack = await inputFile.getPrimaryVideoTrack();
    if (!videoTrack) return null;
    const videoCodec = await videoTrack.getCodec();
    if (!videoCodec) return null;

    // The output container: the caller's target, or the source's own when none is given.
    const srcFormat = await inputFile.getFormat();
    const container = target ?? sourceContainerId(MB, srcFormat);
    if (!container) return null;
    const outFormat = makeOutputFormat(MB, container);

    // The target format is the authority on which codecs it can carry. The video is the
    // picture, so a target that cannot hold the video codec means the fast path cannot
    // run at all (the caller must transcode).
    const legalVideo = new Set(outFormat.getSupportedVideoCodecs());
    if (!legalVideo.has(videoCodec)) return null;
    const legalAudio = new Set(outFormat.getSupportedAudioCodecs());

    const videoSink = new MB.EncodedPacketSink(videoTrack);

    // Find the cut-in keyframe: the last key packet at or before inSec. Without one the
    // window cannot begin on a keyframe, so the fast path cannot run.
    const prevKey = await videoSink.getKeyPacket(inSec);
    if (!prevKey) return null;

    // Is inSec already on a keyframe boundary? Check the keyframe at or before it, and
    // the one just after, so a cut requested a hair below a keyframe still counts as
    // aligned to that keyframe rather than snapping a whole GOP back.
    let startKey = prevKey;
    let alignedIn = Math.abs(prevKey.timestamp - inSec) <= eps;
    if (!alignedIn) {
      const nextKey = await videoSink.getNextKeyPacket(prevKey);
      if (nextKey && Math.abs(nextKey.timestamp - inSec) <= eps) {
        startKey = nextKey;
        alignedIn = true;
      }
    }
    const snappedInSec = startKey.timestamp;
    // snapped means the cut-in was moved back off the requested inSec (a real GOP snap),
    // not the sub-epsilon alignment above.
    const snapped = !alignedIn;

    // Find the out boundary: the packet boundary at or after outSec. getPacket returns
    // the last packet starting at or before outSec (the one whose display covers the
    // cut-out). If outSec sits on that packet's boundary the window ends there; otherwise
    // the window ends at the next packet's start, so the frame covering outSec is kept
    // whole. When there is no next packet the window runs to the end of the track.
    const outContaining = await videoSink.getPacket(outSec, { metadataOnly: true });
    if (!outContaining || outContaining.timestamp <= snappedInSec + eps) return null;
    let outEnd: number;
    let alignedOut: boolean;
    if (Math.abs(outContaining.timestamp - outSec) <= eps) {
      outEnd = outContaining.timestamp;
      alignedOut = true;
    } else {
      const outNext = await videoSink.getNextPacket(outContaining, { metadataOnly: true });
      if (outNext) {
        outEnd = outNext.timestamp;
        alignedOut = false;
      } else {
        // outSec is at or past the last packet: copy to the end of the track, which is
        // an exact cut (nothing was moved).
        outEnd = Number.POSITIVE_INFINITY;
        alignedOut = true;
      }
    }
    if (!(outEnd > snappedInSec + eps)) return null;

    // exactBounds refuses a cut that would move: the cut-in not already on a keyframe, or
    // the cut-out not on a packet boundary. The caller transcodes that window instead.
    if (ctx.exactBounds && (!alignedIn || !alignedOut)) return null;

    const info = TRANSMUX_CONTAINERS[container];
    const outTarget = new MB.BufferTarget();
    const output = new MB.Output({ format: outFormat, target: outTarget });

    // Plan the video track (always kept) plus every audio track legal in the target.
    const plans: CopyPlan[] = [];
    let dropped = 0;
    let keptAudioCodec: AudioCodec | null = null;

    const videoDecoderConfig = await videoTrack.getDecoderConfig();
    const videoSource = new MB.EncodedVideoPacketSource(videoCodec);
    {
      const rotation = await videoTrack.getRotation();
      const languageCode = videoTrack.languageCode;
      const metadata: import('mediabunny').VideoTrackMetadata = {};
      if (rotation) metadata.rotation = rotation;
      if (languageCode && languageCode !== 'und') metadata.languageCode = languageCode;
      output.addVideoTrack(videoSource, metadata);
      plans.push({
        kind: 'video', sink: videoSink, startPacket: startKey, source: videoSource,
        meta: videoDecoderConfig ? { decoderConfig: videoDecoderConfig } : undefined,
      });
    }

    const tracks = await inputFile.getTracks();
    for (const track of tracks) {
      if (track.isVideoTrack()) {
        // Only the primary video track defines the keyframe grid and can be started on a
        // keyframe honestly. A second video track is dropped rather than started mid-GOP.
        if (track.id !== videoTrack.id) dropped++;
        continue;
      }
      if (!track.isAudioTrack()) {
        // A subtitle or other track type with no verbatim encoded-packet reader.
        dropped++;
        continue;
      }
      const codec = await track.getCodec();
      if (!codec || !legalAudio.has(codec)) { dropped++; continue; }

      // Audio can cut anywhere, so it is trimmed to the same window: begin at the first
      // audio packet at or after the video cut-in. getPacket gives the last packet
      // starting at or before the cut; if that starts clearly before the cut, step to
      // the next one (the first at or after it).
      const audioSink = new MB.EncodedPacketSink(track);
      let audioStart = await audioSink.getPacket(snappedInSec);
      if (audioStart && audioStart.timestamp < snappedInSec - eps) {
        audioStart = await audioSink.getNextPacket(audioStart);
      } else if (!audioStart) {
        // Every audio packet starts after the cut-in.
        audioStart = await audioSink.getFirstPacket();
      }
      // No audio packet falls inside the window: drop this track rather than add an empty
      // one to the output.
      if (!audioStart || !(audioStart.timestamp < outEnd - eps)) { dropped++; continue; }

      const decoderConfig = await track.getDecoderConfig();
      const audioSource = new MB.EncodedAudioPacketSource(codec);
      const languageCode = track.languageCode;
      const metadata: import('mediabunny').AudioTrackMetadata = {};
      if (languageCode && languageCode !== 'und') metadata.languageCode = languageCode;
      output.addAudioTrack(audioSource, metadata);
      if (keptAudioCodec === null) keptAudioCodec = codec;
      plans.push({
        kind: 'audio', sink: audioSink, startPacket: audioStart, source: audioSource,
        meta: decoderConfig ? { decoderConfig } : undefined,
      });
    }

    if (trimCancelled(ctx)) throw trimAbortError();

    // Committed to the copy now, so report the stage (indeterminate; a byte count here
    // would be a guess).
    if (ctx.copyNote) ctx.onProgress?.(0, 0, ctx.copyNote);

    await output.start();

    // Interleave the kept tracks by presentation timestamp: a k-way merge over each
    // track's decode-order packet iterator, always adding the packet with the smallest
    // timestamp next, exactly like lib/transmux.ts. Each track begins at its own window
    // start and ends when a packet reaches outEnd, so only the packets inside
    // [snappedInSec, outEnd) are written. Every packet's timestamp is rebased by
    // subtracting snappedInSec so the output starts at 0; its bytes, type and duration
    // are copied unchanged.
    interface Cursor {
      plan: CopyPlan;
      iter: AsyncIterator<import('mediabunny').EncodedPacket>;
      next: import('mediabunny').EncodedPacket | null;
      done: boolean;
      first: boolean;
    }
    const cursors: Cursor[] = plans.map((plan) => ({
      plan, iter: plan.sink.packets(plan.startPacket)[Symbol.asyncIterator](), next: null, done: false, first: true,
    }));

    // Pull the next in-window packet for a cursor, marking it done at the window's end.
    const pull = async (c: Cursor): Promise<void> => {
      const r = await c.iter.next();
      if (r.done || r.value.timestamp >= outEnd - eps) { c.done = true; c.next = null; return; }
      c.next = r.value;
    };
    // Prime each track with its first in-window packet.
    for (const c of cursors) await pull(c);

    let lastVideoEnd = snappedInSec;
    let wroteAny = false;
    for (;;) {
      // The one place a cancel can be observed mid-copy. A cancel stops the copy between
      // packets and is re-thrown, never demoted to a null fall-back.
      if (trimCancelled(ctx)) throw trimAbortError();

      // Pick the live cursor whose next packet has the smallest presentation timestamp.
      let pick: Cursor | null = null;
      for (const c of cursors) {
        if (c.done || c.next === null) continue;
        if (pick === null || c.next.timestamp < pick.next!.timestamp) pick = c;
      }
      if (pick === null) break;

      const packet = pick.next!;
      // Rebase the timestamp so the output starts at 0; keep the coded bytes, packet type
      // and duration exactly. A key packet stays a key packet, so the first video packet
      // written (the cut-in keyframe, rebased to 0) is decodable standalone.
      const rebased = packet.clone({ timestamp: packet.timestamp - snappedInSec });
      const meta = pick.first ? pick.plan.meta : undefined;
      if (pick.plan.kind === 'video') {
        await (pick.plan.source as import('mediabunny').EncodedVideoPacketSource).add(rebased, meta as EncodedVideoChunkMetadata | undefined);
        const end = packet.timestamp + packet.duration;
        if (end > lastVideoEnd) lastVideoEnd = end;
      } else {
        await (pick.plan.source as import('mediabunny').EncodedAudioPacketSource).add(rebased, meta as EncodedAudioChunkMetadata | undefined);
      }
      pick.first = false;
      wroteAny = true;

      await pull(pick);
    }

    // The window held no packets (the video cursor was empty). Fall back rather than
    // write an empty file.
    if (!wroteAny) return null;

    await output.finalize();
    const buffer = outTarget.buffer;
    if (!buffer) return null;

    // The window end in source time: the packet boundary for a finite outEnd, or the
    // last copied video packet's end when the copy ran to the track's end.
    const snappedOutSec = Number.isFinite(outEnd) ? outEnd : lastVideoEnd;
    const blob = new Blob([buffer], { type: info.mime });
    return {
      blob, container, ext: info.ext, mime: info.mime,
      videoCodec, audioCodec: keptAudioCodec, droppedTracks: dropped,
      requestedInSec: inSec, requestedOutSec: outSec,
      snappedInSec, snappedOutSec, snapped,
      durationSec: snappedOutSec - snappedInSec,
    };
  } catch (err) {
    // A genuine cancel must propagate; anything else means this source cannot be trimmed
    // losslessly, which is the caller's cue to fall back to the transcoding trim.
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

// Where a trim UI or flow would hook this fast path:
//
// The user-facing trim today is lib/video-jobs.ts's 'trim' op, which runs the window
// through the decode + re-encode renderer (TrimVideoParams carry fps and bitrate that a
// packet copy has no use for). A caller wanting the fast path would, before starting
// that renderer, call losslessTrim(source, inSec, outSec) with exactBounds off; if it
// returns a result, save result.blob and, when result.snapped is set, show the snapped
// bounds so the user can accept or nudge the cut ("snapped to keyframe" is a UI offer,
// not done here). If it returns null, run the existing transcoding trim unchanged. That
// wiring, and the keyframe-snapping offer in the trim UI, are a WP-H follow-on; this
// module stays standalone and DOM-free so both the web trim flow and the CLI can reuse
// the same engine.
