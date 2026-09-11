// SPDX-License-Identifier: MPL-2.0
/**
 * DOM-free WebCodecs encode + mux core - the compute half of the video export's fast
 * path, extracted from bridge/export.ts so it runs UNCHANGED in either context:
 *   • the main thread (export.ts encodeVideoWithWebCodecs wraps it + adds provenance);
 *   • a Web Worker (video-encode.worker.ts), fed transferred ImageBitmaps + planar PCM,
 *     so the encode/mux runs off the main thread.
 *
 * Everything here is DOM-free: VideoEncoder / VideoFrame / AudioEncoder / AudioData are
 * globals in both window and worker scope, and the muxer (mediabunny, via
 * bridge/mediabunny-mux.ts) is pure-JS + lazily imported. Audio arrives as PLANAR
 * channel Float32Arrays (not an
 * AudioBuffer, which isn't transferable) so the worker path can transfer it. Returns the
 * muxed bytes + container type; the CALLER wraps them in a Blob and embeds provenance
 * (withVideoMeta) - kept on the main thread where the metadata writers already live.
 *
 * The per-frame timing + keyframe cadence and the audio chunking come from the pure
 * schedules in video-mime.ts, so the ordering is unit-tested and identical to before.
 */
import { videoFrameSchedule, audioChunkSchedule } from './video-mime.ts';
import { buildMediabunnyMux, type SeekableSinkFactory } from './mediabunny-mux.ts';
import { HDR_VF_COLORSPACE } from './video-shared.ts';

export interface EncodePick { container: 'mp4' | 'webm'; codec: string; muxCodec: string }

/** Audio for the encode as planar channels (worker-transferable), plus its codec. */
export interface EncodeAudio {
  channels: Float32Array[];
  sampleRate: number;
  numberOfChannels: number;
  codec: string;
  muxCodec: string;
  bitrate: number;
}

export interface EncodeOpts {
  width: number;
  height: number;
  fps: number;
  bitrate: number;
  audio?: EncodeAudio | null;
  /**
   * WP-A step A3. `'opfs'` streams the container to an OPFS-backed seekable writable
   * (MP4 `fastStart:false`) instead of accumulating it in memory; `'buffer'` (the
   * default) keeps the in-memory path and its exact bytes, so the goldens are
   * unchanged. finalize() returns a Blob either way (the OPFS `File` IS a Blob).
   */
  target?: 'buffer' | 'opfs';
  /** Test seam for `target:'opfs'` - the seekable sink factory (defaults to OPFS). */
  seekableSink?: SeekableSinkFactory;
  /** WP-B pro-settings, passed straight to the VideoEncoder config. `bitrateMode`
   *  picks CBR ('constant') vs the browser-default VBR ('variable'); omit to leave the
   *  encoder default. `hardwareAcceleration` is the HW/SW hint. Absent ⇒ unset, so an
   *  export that names neither is byte-for-byte what it was. */
  bitrateMode?: 'variable' | 'constant';
  hardwareAcceleration?: 'no-preference' | 'prefer-hardware' | 'prefer-software';
  /** Plan 154 WP-2 HDR. When set, each frame is built via the BUFFER VideoFrame ctor
   *  carrying this colorSpace (image-source VideoFrameInit has no colorSpace field), and
   *  the muxed track's decoderConfig.colorSpace is force-set to HDR_VF_COLORSPACE so the
   *  container gets a colr/nclx box. Absent ⇒ today's image-source path, byte-for-byte. */
  colorSpace?: VideoColorSpaceInit;
  /** Pixel layout of the buffer frames when colorSpace is set. Phase 1 ships 'RGBA'
   *  (8-bit-sourced PQ); the 'I420P10' seam is reserved for the Phase 2 float source. */
  frameFormat?: 'RGBA' | 'I420P10';
  /** WP-F soft subtitles. WebVTT to embed as a player-toggleable subtitle track, IN
   *  ADDITION to any burned-in captions (default-on when a transcript exists). Passed
   *  straight to the muxer, which adds the track only when this is a non-empty string
   *  AND the container supports webvtt. Absent/empty ⇒ no subtitle track, container
   *  bytes byte-for-byte unchanged (the determinism guard for the goldens). Only the
   *  WebCodecs mux path can carry it; the MediaRecorder fallback cannot (see export.ts
   *  renderVideo, which drops it there with a warning). */
  subtitlesVtt?: string;
}

// ── Muxer wiring (shared seam) ────────────────────────────────────────────────
// The lazy muxer import + Muxer construction, lifted verbatim out of
// encodeMuxWebCodecs so the streaming encoder below builds an IDENTICAL muxer
// instead of duplicating (and drifting from) the container config. The
// buffered and streaming paths differ only in how frames are supplied.

/** The slice of the muxer this module actually drives. finalize is async because
 *  mediabunny's Output is (see bridge/mediabunny-mux.ts); chunks are still added
 *  synchronously. */
export interface MuxerLike {
  addVideoChunk(chunk: unknown, metadata?: unknown): void;
  addAudioChunk(chunk: unknown, metadata?: unknown): void;
  finalize(): Promise<void>;
}

/** Where the finished container ends up: a BufferTarget exposes `.buffer` (in-memory);
 *  an OPFS StreamTarget a lazily-read `.blob()` (step A3). Both yield the bytes only
 *  after finalize. */
export type MuxTarget = { buffer: ArrayBuffer | null } | { blob(): Promise<Blob> };

/** A built muxer + the target it writes into + the container MIME. */
export interface BuiltMuxer { muxer: MuxerLike; target: MuxTarget; type: string }

/** Factory for the muxer - swappable so the encode paths are testable without a real muxer. */
export type MuxerFactory = (pick: EncodePick, o: EncodeOpts) => Promise<BuiltMuxer>;

/** Build the mediabunny-backed muxer for `pick`/`o`. Track dimensions / rate /
 *  decoder config come from each chunk's metadata, so only the codecs are needed
 *  here. */
export const defaultMuxerFactory: MuxerFactory = async (pick, o) => {
  const isMp4 = pick.container === 'mp4';
  const { muxer, target } = await buildMediabunnyMux({
    container: pick.container,
    video: pick.muxCodec,
    audio: o.audio ? o.audio.muxCodec : null,
    frameRate: o.fps,
    target: o.target ?? 'buffer',
    seekableSink: o.seekableSink,
    subtitlesVtt: o.subtitlesVtt,
  });
  return { muxer, target, type: isMp4 ? 'video/mp4' : 'video/webm' };
};

/** The finished container as a Blob, from either target kind (step A3). A
 *  BufferTarget wraps its in-memory buffer; an OPFS StreamTarget returns the file it
 *  streamed to, stamped with the container MIME (via a zero-copy slice, since an OPFS
 *  File's own `type` is empty). */
async function containerBlob(target: MuxTarget, type: string): Promise<Blob> {
  if ('blob' in target) {
    const b = await target.blob();
    return b.type === type ? b : b.slice(0, b.size, type);
  }
  return new Blob([target.buffer as ArrayBuffer], { type });
}

/** Encode frames (+ optional audio) and mux → { muxed bytes, container MIME }. Throws on
 *  any encoder error. Identical logic to the former inline loop in export.ts. */
export async function encodeMuxWebCodecs(
  frames: Array<ImageBitmap | { data: BufferSource }>, pick: EncodePick, o: EncodeOpts,
): Promise<{ buffer: ArrayBuffer; type: string }> {
  const { width, height, fps, bitrate } = o;
  const a = o.audio ?? null;
  const isMp4 = pick.container === 'mp4';
  const { muxer, target } = await defaultMuxerFactory(pick, o);

  let encErr: unknown = null;
  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      try {
        // HDR: force-set (not ??=) the full colorSpace struct so mediabunny's
        // colorSpaceIsComplete always fires and writes a colr/nclx box. Chromium omits
        // decoderConfig on non-keyframe chunks, so guard on it existing rather than
        // partial-filling a struct that isn't there.
        const m = metadata as { decoderConfig?: { colorSpace?: VideoColorSpaceInit } } | undefined;
        if (o.colorSpace && m?.decoderConfig) m.decoderConfig.colorSpace = { ...HDR_VF_COLORSPACE };
        muxer.addVideoChunk(chunk, metadata);
      } catch (e) { encErr = e; }
    },
    error: (e) => { encErr = e; },
  });
  const config: any = { codec: pick.codec, width, height, bitrate, framerate: fps };
  if (isMp4 && pick.codec.startsWith('avc')) config.avc = { format: 'avc' };   // length-prefixed avcC, which the mp4 container needs (H.264 only)
  if (o.bitrateMode) config.bitrateMode = o.bitrateMode;
  if (o.hardwareAcceleration) config.hardwareAcceleration = o.hardwareAcceleration;
  encoder.configure(config);

  for (const t of videoFrameSchedule(frames.length, fps)) {
    if (encErr) break;
    const src = frames[t.index]!;
    // HDR frames arrive as raw RGBA buffers: the buffer VideoFrame ctor is the only one
    // that takes a colorSpace (image-source VideoFrameInit has no such field). SDR frames
    // stay on the exact image-source ctor as before.
    const frame = o.colorSpace
      ? new VideoFrame((src as { data: BufferSource }).data, {
          // I420P10 (Phase 2) is a real WebCodecs pixel format the lib's VideoPixelFormat lacks.
          format: (o.frameFormat ?? 'RGBA') as VideoPixelFormat, codedWidth: width, codedHeight: height,
          timestamp: t.timestampUs, duration: t.durationUs, colorSpace: o.colorSpace,
        })
      : new VideoFrame(src as ImageBitmap, { timestamp: t.timestampUs, duration: t.durationUs });
    encoder.encode(frame, { keyFrame: t.keyFrame });
    frame.close();
    if (encoder.encodeQueueSize > 20) await new Promise<void>((r) => setTimeout(r, 0));
  }
  await encoder.flush();
  encoder.close();

  if (a && !encErr) {
    const { channels, sampleRate, numberOfChannels, bitrate: aBitrate } = a;
    const aEnc = new AudioEncoder({
      output: (chunk, metadata) => { try { muxer.addAudioChunk(chunk, metadata); } catch (e) { encErr = e; } },
      error: (e) => { encErr = e; },
    });
    aEnc.configure({ codec: a.codec, sampleRate, numberOfChannels, bitrate: aBitrate });
    const total = channels[0]?.length ?? 0;      // frames per channel
    const CHUNK = 4800;                           // ~0.1s @ 48k
    const planar = new Float32Array(CHUNK * numberOfChannels);
    for (const span of audioChunkSchedule(total, sampleRate, CHUNK)) {
      if (encErr) break;
      const n = span.numFrames;
      // f32-planar layout for this chunk: [ch0: n samples][ch1: n samples] (stride n).
      for (let ch = 0; ch < numberOfChannels; ch++) {
        const plane = channels[Math.min(ch, channels.length - 1)]!;
        planar.set(plane.subarray(span.offsetFrames, span.offsetFrames + n), ch * n);
      }
      const audioData = new AudioData({
        format: 'f32-planar', sampleRate, numberOfFrames: n, numberOfChannels,
        timestamp: span.timestampUs,                       // microseconds
        data: planar.subarray(0, n * numberOfChannels),    // AudioData copies the data
      });
      aEnc.encode(audioData);
      audioData.close();
      if (aEnc.encodeQueueSize > 20) await new Promise<void>((r) => setTimeout(r, 0));
    }
    await aEnc.flush();
    aEnc.close();
  }

  if (encErr) throw encErr instanceof Error ? encErr : new Error('VideoEncoder error');
  await muxer.finalize();
  const type = isMp4 ? 'video/mp4' : 'video/webm';
  // The buffered path is BufferTarget by default (whole clip in memory already), so
  // read its buffer directly; honour an OPFS target too for completeness.
  if ('blob' in target) return { buffer: await (await target.blob()).arrayBuffer(), type };
  return { buffer: target.buffer as ArrayBuffer, type };
}

// ── Streaming encode + mux ────────────────────────────────────────────────────
// encodeMuxWebCodecs above needs EVERY frame up front as an ImageBitmap, which is
// why the callers cap a clip at maxVideoFrames(): memory grows with duration. A
// sequence export can't work that way - it draws one frame, hands it over, and
// reuses the same canvas. createStreamingMux is that shape: push a frame, push
// audio, finalize. Memory is O(1) in duration because at most HIGH_WATER + 1
// VideoFrames are ever alive, each closed in the same tick it was encoded.
//
// Backpressure waits on the encoder's own 'dequeue' event rather than polling a
// timer, so a slow hardware encoder throttles the producer precisely (the spike
// measured a peak queue of 7 against a `> 6` gate). A short timer runs alongside
// purely as a liveness net for an encoder that doesn't emit 'dequeue'.

/** Queue depth above which addFrame/addAudio await the encoder draining. */
export const HIGH_WATER = 6;

/** Poll interval (ms) backing up the 'dequeue' event, for encoders that don't fire it. */
const DEQUEUE_FALLBACK_MS = 25;

/**
 * The slice of `AudioBuffer` addAudio actually reads.
 *
 * A real `AudioBuffer` satisfies this by shape, so every existing caller is
 * unchanged. It is spelled out because `AudioBuffer` is a main-thread-only
 * global: the sequence-render worker receives planar `Float32Array`s over
 * postMessage and wraps them in this shape, and there is no other way to feed
 * the same PCM to the same encoder from worker scope.
 */
export interface PcmSource {
  /** Sample frames per channel. */
  length: number;
  numberOfChannels: number;
  getChannelData(channel: number): Float32Array;
}

/** A push-based encode+mux session. Frames stream in; memory stays O(1) in duration. */
export interface StreamingMux {
  /** Encode one frame at `tsUs` (µs). Resolves once the encoder has room for the next.
   *  An HDR session (opts.colorSpace set) takes a raw RGBA `{ data }` buffer instead of a
   *  CanvasImageSource - the only VideoFrame ctor that carries a colorSpace. */
  addFrame(src: CanvasImageSource | { data: BufferSource }, tsUs: number): Promise<void>;
  /** Encode one buffer's PCM (an AudioBuffer, or its planar equivalent in a
   *  worker), appended after everything added so far. */
  addAudio(buffer: PcmSource): Promise<void>;
  /** Flush both encoders, finalize the muxer, and return the container. */
  finalize(): Promise<Blob>;
  /** Tear everything down without producing output. Safe to call more than once. */
  abort(reason?: unknown): Promise<void>;
}

/** Injection seam: the WebCodecs globals + the muxer factory, so the streaming
 *  encoder is drivable by stubs in node (no WebCodecs there). Every field
 *  defaults to the real global / the real lazy muxer import. */
export interface StreamingDeps {
  muxerFactory?: MuxerFactory;
  VideoEncoder?: any;
  AudioEncoder?: any;
  VideoFrame?: any;
  AudioData?: any;
}

/** Wait until `enc.encodeQueueSize <= HIGH_WATER`, yielding to 'dequeue'. */
async function drain(enc: any): Promise<void> {
  while (enc.encodeQueueSize > HIGH_WATER) {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try { enc.removeEventListener?.('dequeue', done); } catch { /* stub without listeners */ }
        resolve();
      };
      const timer = setTimeout(done, DEQUEUE_FALLBACK_MS);
      try { enc.addEventListener?.('dequeue', done); } catch { done(); }
    });
  }
}

/**
 * Open a streaming encode+mux session for `pick`/`opts`.
 *
 * `opts.audio` DECLARES the audio track (codec / sampleRate / numberOfChannels /
 * bitrate) so the muxer can be constructed with it; its `channels` payload is
 * ignored here - PCM arrives incrementally through addAudio().
 */
export async function createStreamingMux(
  pick: EncodePick, opts: EncodeOpts, deps: StreamingDeps = {},
): Promise<StreamingMux> {
  const { width, height, fps, bitrate } = opts;
  const a = opts.audio ?? null;
  const isMp4 = pick.container === 'mp4';
  const g = globalThis as any;
  const VEnc = deps.VideoEncoder ?? g.VideoEncoder;
  const AEnc = deps.AudioEncoder ?? g.AudioEncoder;
  const VFrame = deps.VideoFrame ?? g.VideoFrame;
  const AData = deps.AudioData ?? g.AudioData;

  const { muxer, target, type } = await (deps.muxerFactory ?? defaultMuxerFactory)(pick, opts);

  let encErr: unknown = null;
  const fail = (e: unknown): void => { encErr ??= e; };
  const asError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e ?? 'encoder error')));

  // Deterministic interleave. The two encoders' output callbacks fire on their
  // own schedule, and an audio chunk arrives every 100000µs - a timestamp every
  // third 30fps video frame TIES exactly - so feeding the muxer in arrival
  // order made the interleave (and therefore the file's bytes) depend on
  // scheduler load: same render, same pixels, same size, different sha. The
  // callbacks queue per stream instead; a BOUNDED merge (drainBounded, below)
  // hands the muxer both streams in one canonical order (ascending timestamp,
  // video first on a tie) AS THE RENDER PROCEEDS, so the interleave never
  // depends on callback timing and the queues stop accumulating the whole
  // encoded stream. The muxer adapter applies the same rule again downstream.
  const vQ: Array<{ chunk: unknown; metadata: unknown }> = [];
  const aQ: Array<{ chunk: unknown; metadata: unknown }> = [];
  const tsOf = (c: unknown): number => Number((c as { timestamp?: number } | null)?.timestamp ?? 0);

  // ── Bounded interleave (WP-A step A2) ──────────────────────────────────────
  // The whole-clip drain that used to run once at finalize now runs
  // INCREMENTALLY: whenever a frame or an audio window advances a stream's
  // timestamp, every packet whose canonical position is now settled is flushed to
  // the muxer, and the rest waits. A packet is settled once no not-yet-emitted
  // packet from the OTHER stream could sort before it. Both encoders emit in
  // monotonic ascending order (none of these codecs produces B-frames), so a
  // stream's highest emitted timestamp is a watermark below which nothing new can
  // appear:
  //   • a VIDEO packet is safe once its ts <= the audio watermark - a future audio
  //     packet is strictly later, and one at the same ts loses the tie to video;
  //   • an AUDIO packet is safe once its ts <= the video watermark - a future video
  //     packet at the same ts WINS the tie, so the audio must wait for the video
  //     watermark to pass its ts.
  // A finished (flushed) or absent stream has an infinite watermark. finalize
  // drains with BOTH infinite, so it emits exactly what the old whole-clip merge
  // did: vi/ai only advance and only ever release the true next element of the
  // canonical merge, so the full sequence of muxer.add* calls is byte-for-byte the
  // ascending/video-first-on-tie merge, no matter when each release fires.
  let vi = 0;
  let ai = 0;
  let vHigh = Number.NEGATIVE_INFINITY;
  let aHigh = Number.NEGATIVE_INFINITY;
  let videoDone = false;
  let audioDone = a === null;                        // no audio track ⇒ nothing will ever arrive
  const drainBounded = (final: boolean): void => {
    const aCeil = (final || audioDone) ? Number.POSITIVE_INFINITY : aHigh;
    const vCeil = (final || videoDone) ? Number.POSITIVE_INFINITY : vHigh;
    while (vi < vQ.length || ai < aQ.length) {
      const haveV = vi < vQ.length;
      const haveA = ai < aQ.length;
      const takeVideo = haveV && (!haveA || tsOf(vQ[vi]!.chunk) <= tsOf(aQ[ai]!.chunk));
      if (takeVideo) {
        if (tsOf(vQ[vi]!.chunk) > aCeil) break;      // a later audio window could still undercut it
        muxer.addVideoChunk(vQ[vi]!.chunk, vQ[vi]!.metadata);
        vi++;
      } else {
        if (tsOf(aQ[ai]!.chunk) > vCeil) break;      // a later video frame could still tie/precede it
        muxer.addAudioChunk(aQ[ai]!.chunk, aQ[ai]!.metadata);
        ai++;
      }
    }
  };

  const encoder = new VEnc({
    output: (chunk: unknown, metadata: unknown) => {
      // HDR: force-set (not ??=) the full colorSpace struct so mediabunny's
      // colorSpaceIsComplete always fires and writes a colr/nclx box - identical to
      // encodeMuxWebCodecs. Chromium omits decoderConfig on non-keyframe chunks, so guard
      // on it existing. Guarded on opts.colorSpace, so the SDR path is byte-for-byte
      // untouched (the goldens set no colorSpace).
      const m = metadata as { decoderConfig?: { colorSpace?: VideoColorSpaceInit } } | undefined;
      if (opts.colorSpace && m?.decoderConfig) m.decoderConfig.colorSpace = { ...HDR_VF_COLORSPACE };
      vQ.push({ chunk, metadata });
      const t = tsOf(chunk); if (t > vHigh) vHigh = t;
    },
    error: (e: unknown) => { fail(e); },
  });
  const config: any = { codec: pick.codec, width, height, bitrate, framerate: fps };
  if (isMp4 && pick.codec.startsWith('avc')) config.avc = { format: 'avc' };   // length-prefixed avcC, which the mp4 container needs (H.264 only)
  if (opts.bitrateMode) config.bitrateMode = opts.bitrateMode;
  if (opts.hardwareAcceleration) config.hardwareAcceleration = opts.hardwareAcceleration;
  encoder.configure(config);

  let aEnc: any = null;
  if (a) {
    aEnc = new AEnc({
      output: (chunk: unknown, metadata: unknown) => { aQ.push({ chunk, metadata }); const t = tsOf(chunk); if (t > aHigh) aHigh = t; },
      error: (e: unknown) => { fail(e); },
    });
    aEnc.configure({ codec: a.codec, sampleRate: a.sampleRate, numberOfChannels: a.numberOfChannels, bitrate: a.bitrate });
  }

  const f = Math.max(1, fps);
  const keyEvery = Math.max(1, Math.round(f * 2));   // same ~2s cadence as videoFrameSchedule
  const durationUs = Math.round(1e6 / f);
  let frameIndex = 0;
  let audioFrames = 0;                                // running PCM position, in sample frames
  let state: 'open' | 'closed' = 'open';

  /** Close an encoder without letting a double-close mask the real failure. */
  const shut = (e: any): void => { try { e?.close?.(); } catch { /* already closed */ } };

  const guard = (): void => {
    if (state === 'closed') throw new Error('streaming mux is closed');
    if (encErr) throw asError(encErr);
  };

  return {
    async addFrame(src: CanvasImageSource | { data: BufferSource }, tsUs: number): Promise<void> {
      guard();
      // HDR frames arrive as raw RGBA buffers: the buffer VideoFrame ctor is the only one
      // that takes a colorSpace (image-source VideoFrameInit has no such field). SDR frames
      // stay on the exact image-source ctor as before - identical to encodeMuxWebCodecs.
      const frame = opts.colorSpace
        ? new VFrame((src as { data: BufferSource }).data, {
            format: (opts.frameFormat ?? 'RGBA') as VideoPixelFormat, codedWidth: width, codedHeight: height,
            timestamp: Math.round(tsUs), duration: durationUs, colorSpace: opts.colorSpace,
          })
        : new VFrame(src as CanvasImageSource, { timestamp: Math.round(tsUs), duration: durationUs });
      try {
        encoder.encode(frame, { keyFrame: frameIndex % keyEvery === 0 });
      } finally {
        frame.close();                                // exactly one close, same tick as the encode
        frameIndex++;
      }
      await drain(encoder);
      if (encErr) throw asError(encErr);
      drainBounded(false);                            // flush any video the audio watermark now settles
    },

    async addAudio(buffer: PcmSource): Promise<void> {
      guard();
      if (!aEnc) throw new Error('streaming mux has no audio track (opts.audio was not set)');
      const sampleRate = a!.sampleRate;
      const numberOfChannels = a!.numberOfChannels;
      const total = buffer.length ?? 0;
      if (!total) return;
      const CHUNK = 4800;                             // ~0.1s @ 48k, as the buffered path uses
      const planes: Float32Array[] = [];
      for (let ch = 0; ch < numberOfChannels; ch++) {
        planes.push(buffer.getChannelData(Math.min(ch, buffer.numberOfChannels - 1)));
      }
      const planar = new Float32Array(CHUNK * numberOfChannels);
      for (const span of audioChunkSchedule(total, sampleRate, CHUNK)) {
        if (encErr) throw asError(encErr);
        const n = span.numFrames;
        for (let ch = 0; ch < numberOfChannels; ch++) {
          planar.set(planes[ch]!.subarray(span.offsetFrames, span.offsetFrames + n), ch * n);
        }
        const audioData = new AData({
          format: 'f32-planar', sampleRate, numberOfFrames: n, numberOfChannels,
          // Timestamps continue from everything already pushed - the spans are
          // buffer-relative, the session's clock is not.
          timestamp: Math.round(((audioFrames + span.offsetFrames) / Math.max(1, sampleRate)) * 1e6),
          data: planar.subarray(0, n * numberOfChannels),
        });
        try { aEnc.encode(audioData); } finally { audioData.close(); }
        await drain(aEnc);
      }
      audioFrames += total;
      if (encErr) throw asError(encErr);
      drainBounded(false);                            // flush any audio the video watermark now settles
    },

    async finalize(): Promise<Blob> {
      guard();
      state = 'closed';
      try {
        await encoder.flush();
        videoDone = true;
        shut(encoder);
        if (aEnc) { await aEnc.flush(); shut(aEnc); }
        audioDone = true;
      } catch (e) {
        shut(encoder); shut(aEnc);
        throw asError(e);
      }
      if (encErr) throw asError(encErr);
      // Final drain - the tail the bounded merge could not settle mid-render.
      // With both streams flushed the watermarks are infinite, so this releases
      // whatever remains in one canonical order (ascending timestamp, video first
      // on a tie); the incremental releases plus this tail are byte-for-byte the
      // old whole-clip drain. Per-stream order is each encoder's emit order
      // (monotonic; neither codec path produces B-frames).
      try {
        drainBounded(true);
      } catch (e) {
        throw asError(e);
      }
      await muxer.finalize();
      // BufferTarget → Blob([buffer]) (byte-identical to before); OPFS StreamTarget
      // → the streamed file, read back as a Blob. finalize returns a Blob either way.
      return await containerBlob(target, type);
    },

    async abort(reason?: unknown): Promise<void> {
      if (state === 'closed') return;
      state = 'closed';
      if (reason !== undefined) fail(reason);
      // No flush: a flush would await work whose output we're discarding, and a
      // failing encoder may never settle it. Just release both encoders.
      shut(encoder);
      shut(aEnc);
    },
  };
}
