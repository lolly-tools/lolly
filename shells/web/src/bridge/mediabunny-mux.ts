// SPDX-License-Identifier: MPL-2.0
/**
 * mediabunny-backed muxer - the write half of the WebCodecs video/audio export.
 *
 * Replaces the deprecated mp4-muxer / webm-muxer. Their author retired both in
 * favour of mediabunny, which supersedes them: one library (already loaded on the
 * decode side, so a smaller net footprint here), an actively-maintained MP4/WebM
 * writer, and more formats. The encode paths are otherwise UNCHANGED - they still
 * drive the WebCodecs VideoEncoder / AudioEncoder themselves and hand us the
 * resulting EncodedVideo/AudioChunks; this module only turns those chunks into a
 * finished container.
 *
 * ── The one shape change ──────────────────────────────────────────────────────
 * The old muxers exposed a SYNCHRONOUS addVideoChunk / addAudioChunk / finalize;
 * mediabunny's Output is async end-to-end (it awaits writer + encoder
 * backpressure). To keep the callers' shape, chunks are converted to mediabunny
 * EncodedPackets and BUFFERED synchronously on add (their bytes are copied out
 * there and then), and the whole Output is built and written at finalize - the
 * one method that had to become async.
 *
 * finalize() replays the buffered packets in a single canonical order (ascending
 * presentation timestamp, video winning a tie), so a given render always produces
 * the same bytes regardless of the order the two encoders' output callbacks
 * happened to fire in. Per-track order is each encoder's own emit order (decode
 * order; none of these codecs produce B-frames), so only the cross-stream
 * interleave is decided here - and it is decided identically every run. Memory is
 * unchanged from before: mp4-muxer's `fastStart: 'in-memory'` and webm-muxer both
 * already accumulated the whole encoded stream.
 *
 * A track is created only if it actually received packets, so a declared-but-empty
 * audio track (switched on, never fed) is dropped rather than written as a silent
 * stream.
 *
 * mediabunny is `import()`ed lazily (as the old muxers were), so it never enters
 * the preload bundle - it loads only when someone exports.
 */
import type { AudioCodec, EncodedPacket, MetadataTags, Rotation, StreamTargetChunk, VideoCodec, VideoTrackMetadata } from 'mediabunny';

/**
 * A seekable byte sink for step A3's StreamTarget path: a WritableStream of
 * POSITIONED writes (an OPFS `FileSystemWritableFileStream` is exactly one) plus a
 * way to read the finished container back once mediabunny has closed the stream. A
 * mediabunny `StreamTargetChunk` `{type:'write',data,position}` maps 1:1 onto the
 * OPFS writable's `write({type,position,data})`, and MP4 `fastStart:false` needs the
 * seek to backpatch the trailing `moov`.
 */
export interface SeekableSink {
  writable: WritableStream<StreamTargetChunk>;
  /** The finished container as a Blob (an OPFS `File` IS a Blob), valid once the
   *  writable has been closed - which mediabunny does inside `output.finalize()`. */
  result(): Promise<Blob>;
}

/** Acquire a seekable sink for a container. Defaults to OPFS; injectable for tests. */
export type SeekableSinkFactory = (container: 'mp4' | 'webm') => Promise<SeekableSink>;

/** The temp-file prefix every OPFS mux file carries, so a crashed export's orphan is
 *  recognisable and sweepable. `${prefix}${Date.now()}-${rand}.${ext}`. */
const OPFS_MUX_PREFIX = 'lolly-mux-';

/** How old a `lolly-mux-*` file must be to count as a CRASHED-run orphan rather than a
 *  live concurrent export's in-flight file (the client can run two exports at once). A
 *  minute is far longer than any real export's finalize gap, so the sweep never deletes
 *  a sibling export's active file. */
const OPFS_MUX_STALE_MS = 60_000;

/** Delete `lolly-mux-*` temp files a crashed prior export left in the OPFS root. Runs
 *  best-effort when a new sink is acquired (plans/156 WP-A part 2). Only files older
 *  than `OPFS_MUX_STALE_MS` (by their `Date.now()` name stamp) are removed, so a
 *  concurrent export's live file is never touched; an unparseable stamp is treated as
 *  stale. Uses the directory async iterator when present (every shipping OPFS has it). */
async function sweepStaleOpfsMux(root: FileSystemDirectoryHandle): Promise<void> {
  const dir = root as unknown as { keys?: () => AsyncIterableIterator<string> };
  if (typeof dir.keys !== 'function') return;
  const now = Date.now();
  const stale: string[] = [];
  for await (const key of dir.keys()) {
    if (!key.startsWith(OPFS_MUX_PREFIX)) continue;
    const stamp = Number(key.slice(OPFS_MUX_PREFIX.length).split('-')[0]);
    if (!Number.isFinite(stamp) || now - stamp > OPFS_MUX_STALE_MS) stale.push(key);
  }
  for (const key of stale) { try { await root.removeEntry(key); } catch { /* raced / in use */ } }
}

/** The default seekable sink: a fresh OPFS file behind a `FileSystemWritableFileStream`.
 *  Browser-only (`navigator.storage.getDirectory`).
 *
 *  The file is TRANSIENT and never survives the export (plans/156 WP-A part 2): `result()`
 *  reads the finished container into an in-memory Blob (one bounded read - the C2PA digest
 *  reads the whole file at finalize anyway, so this adds no peak), then `removeEntry()`s
 *  the OPFS file and returns the in-memory Blob, which stays valid after the file is gone.
 *  An aborted writable removes the file too, and a fresh sink first sweeps any orphan a
 *  crashed prior export left behind - so no `lolly-mux-*` file ever leaks. */
export const opfsSeekableSink: SeekableSinkFactory = async (container) => {
  const root = await navigator.storage.getDirectory();
  // Reap a crashed prior export's orphan(s) before adding our own. Best-effort: a sweep
  // failure must never block a healthy export.
  await sweepStaleOpfsMux(root).catch(() => { /* best-effort */ });
  const name = `${OPFS_MUX_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}.${container === 'mp4' ? 'mp4' : 'webm'}`;
  const handle = await root.getFileHandle(name, { create: true });
  const opfs = await handle.createWritable();          // seekable: honours {position}
  const removeFile = async (): Promise<void> => { try { await root.removeEntry(name); } catch { /* already gone */ } };
  const writable = new WritableStream<StreamTargetChunk>({
    async write(chunk) { await opfs.write({ type: 'write', position: chunk.position, data: chunk.data }); },
    async close() { await opfs.close(); },              // commit the OPFS file
    async abort() { try { await opfs.abort(); } catch { /* already gone */ } await removeFile(); },
  });
  return {
    writable,
    result: async (): Promise<Blob> => {
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();            // one bounded read into memory
      await removeFile();                              // then delete: nothing survives the export
      return file.type ? new Blob([buf], { type: file.type }) : new Blob([buf]);
    },
  };
};

/** mux-codec ids the encode paths emit (mp4-muxer/webm-muxer spelling) → mediabunny codec ids. */
const VIDEO_CODEC: Record<string, VideoCodec> = { avc: 'avc', V_VP9: 'vp9', V_VP8: 'vp8', av1: 'av1', V_AV1: 'av1', hevc: 'hevc' };
const AUDIO_CODEC: Record<string, AudioCodec> = { aac: 'aac', A_OPUS: 'opus' };

export function mapVideoCodec(muxCodec: string): VideoCodec {
  const c = VIDEO_CODEC[muxCodec];
  if (!c) throw new Error(`mediabunny-mux: unknown video mux codec '${muxCodec}'`);
  return c;
}
export function mapAudioCodec(muxCodec: string): AudioCodec {
  const c = AUDIO_CODEC[muxCodec];
  if (!c) throw new Error(`mediabunny-mux: unknown audio mux codec '${muxCodec}'`);
  return c;
}

/** The sync-add / async-finalize surface the encode paths drive. Effectively a
 *  drop-in for the old muxers, except finalize is now a Promise. */
export interface MediabunnyMuxer {
  addVideoChunk(chunk: unknown, metadata?: unknown): void;
  addAudioChunk(chunk: unknown, metadata?: unknown): void;
  /** Container metadata tags (title/artist/…). Must run before the first packet
   *  (mediabunny rejects a tag change after start); the audio-only m4a/opus export
   *  path calls it up front. A no-op once started, so video callers never regress. */
  setMetadataTags(tags: MetadataTags): void;
  finalize(): Promise<void>;
}

/** A built muxer plus its target - where the finished bytes land. A BufferTarget
 *  exposes `.buffer` (valid after finalize); an OPFS StreamTarget a lazily-read
 *  `.blob()` (valid after finalize, which closes the writable). */
export interface BuiltMediabunnyMux {
  muxer: MediabunnyMuxer;
  target: { buffer: ArrayBuffer } | { blob(): Promise<Blob> };
}

/** What tracks a muxer should declare. A null codec means "no track of this kind". */
export interface MuxSpec {
  container: 'mp4' | 'webm';
  /** The video track's mux codec, or null for audio-only. */
  video?: string | null;
  /** The audio track's mux codec, or null for video-only. */
  audio?: string | null;
  /**
   * WP-A step A3. `'opfs'` streams the container to a `MB.StreamTarget` over a
   * seekable OPFS writable (MP4 `fastStart:false` - mdat first, moov backpatched at
   * the end via seek); `'buffer'` (the default) keeps the in-memory `BufferTarget`
   * and its exact byte layout, so every existing caller and golden is unchanged.
   * Never `'fragmented'`: it breaks the single-monolithic-mdat layout the C2PA
   * placer walks.
   */
  target?: 'buffer' | 'opfs';
  /** The seekable sink factory for `target:'opfs'` (defaults to `opfsSeekableSink`;
   *  injectable so the path is testable without a real browser OPFS). */
  seekableSink?: SeekableSinkFactory;
  /**
   * Constant frame rate of the video track, if known. Used two ways (see
   * buildMediabunnyMux): it fills any missing per-packet duration for BOTH
   * containers, and it is additionally declared on the MP4 track so mediabunny
   * records a DefaultDuration covering the last frame. It is deliberately NOT
   * declared on WebM, whose 1ms-rounded timecodes would then shift off the frame
   * grid; WebM leans on floored per-frame timecodes instead.
   */
  frameRate?: number;
  /**
   * Container rotation metadata, in degrees clockwise. MP4-ONLY: ISOBMFF carries it,
   * but MkvOutputFormat.supportsVideoRotationMetadata is false and addVideoTrack THROWS
   * if a rotation is handed to a WebM output - so it is passed only on the isMp4 branch
   * and silently ignored for WebM. Absent/0 ⇒ no rotation box and byte-identical output
   * (the determinism guard for the rotation-free sequence-render goldens). This is what
   * a phone films: the pixels stay landscape and a 90/270 tag tells the player to turn
   * them - the element-seek export path relies on the browser applying that tag.
   */
  rotation?: Rotation;
  /**
   * WP-F soft subtitles. A WebVTT document to embed as a player-toggleable subtitle
   * track (mp4 `wvtt`, WebM `S_TEXT/WEBVTT`), IN ADDITION to any burned-in captions.
   * Added ONLY when this is a NON-EMPTY string AND the container's OutputFormat lists
   * 'webvtt' in getSupportedSubtitleCodecs() (both mp4 and WebM do). Absent/empty ⇒ no
   * subtitle track and the container bytes are byte-for-byte identical to today - the
   * determinism guard for the transcript-less sequence-render goldens.
   */
  subtitlesVtt?: string;
}

/** Build a mediabunny-backed muxer for `spec`. mediabunny is imported lazily. */
export async function buildMediabunnyMux(spec: MuxSpec): Promise<BuiltMediabunnyMux> {
  const MB = await import('mediabunny');
  const isMp4 = spec.container === 'mp4';
  // Step A3: an OPFS StreamTarget streams the container out as it is written; the
  // default BufferTarget keeps the whole file in memory (its exact bytes unchanged).
  //
  // plans/156 WP-A part 1 - requesting `target:'opfs'` is ALWAYS SAFE: if no seekable
  // sink was injected AND this environment has no OPFS, fall back to BufferTarget rather
  // than throwing. An injected sink is honoured regardless (that IS the sink); otherwise
  // the real OPFS sink needs `navigator.storage.getDirectory`. So a browser without OPFS,
  // a worker without it, or a headless context all silently keep the in-memory path.
  const opfsUsable = spec.seekableSink != null
    || (typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory);
  const useOpfs = spec.target === 'opfs' && opfsUsable;
  const sink = useOpfs ? await (spec.seekableSink ?? opfsSeekableSink)(spec.container) : null;
  const target = sink ? new MB.StreamTarget(sink.writable) : new MB.BufferTarget();
  const format = isMp4
    ? new MB.Mp4OutputFormat({ fastStart: useOpfs ? false : 'in-memory' })   // stream mdat, moov backpatched at end
    : new MB.WebMOutputFormat();                                             // WebM already streams
  const output = new MB.Output({ format, target });

  // Validate the declared codecs up front so an unknown one throws here, not
  // mid-drain. Track dimensions / rate / decoder config are NOT needed at
  // construction: they arrive with each chunk's metadata on the first add().
  const videoCodec = spec.video ? mapVideoCodec(spec.video) : null;
  const audioCodec = spec.audio ? mapAudioCodec(spec.audio) : null;

  const vQ: Array<{ packet: EncodedPacket; meta: unknown }> = [];
  const aQ: Array<{ packet: EncodedPacket; meta: unknown }> = [];

  // A single frame's duration, in seconds. Chromium's VideoEncoder does not carry
  // the source VideoFrame's `duration` onto the emitted EncodedVideoChunk, so
  // fromEncodedChunk gets 0 - and mediabunny's MP4 writer takes each sample's
  // duration from the packet, which without this leaves the FINAL frame with no
  // extent and shortens the file's computed duration by one frame. Our video is
  // CFR at frameRate, so every frame lasts exactly this; we stamp it on any packet
  // that arrived without one.
  const frameDurSec = spec.frameRate && spec.frameRate > 0 ? 1 / spec.frameRate : 0;

  // ── Sources + tracks declared UP FRONT (WP-A step A2) ──────────────────────
  // The bounded merge below adds packets to the sources AS THEY ARRIVE, so the
  // sources must exist and output.start() must have run before the first add. That
  // moves the empty-track drop from a finalize-time PACKET COUNT to a
  // construction-time DECLARATION: a track is created iff its codec was declared
  // (spec.video / spec.audio != null), not iff it later received a packet. Every
  // caller only declares audio when it will feed it, so a real export never writes
  // an empty track. (This is also what a StreamTarget Output will require in A3.)
  //
  // frameRate is declared on MP4 only. It gives mediabunny a DefaultDuration (so
  // `computeDuration` covers the last frame), and MP4's fine timescale stores the
  // exact grid times unshifted. On WebM the same option would snap timecodes onto
  // the frame grid and then round them to 1ms - reintroducing the very shift the
  // flooring below removes - so WebM is left frameRate-less and leans on the
  // floored per-frame timecodes instead.
  const vSrc = videoCodec ? new MB.EncodedVideoPacketSource(videoCodec) : null;
  const aSrc = audioCodec ? new MB.EncodedAudioPacketSource(audioCodec) : null;
  if (vSrc) {
    // MP4 (ISOBMFF) carries frameRate + rotation metadata; WebM (Matroska) supports
    // neither here - a declared frameRate would snap its 1ms timecodes off the frame
    // grid (see above), and addVideoTrack THROWS on a rotation. So both ride the isMp4
    // branch only, and a WebM track keeps its undefined metadata (bytes unchanged).
    const vMeta: VideoTrackMetadata = {};
    if (isMp4 && spec.frameRate) vMeta.frameRate = spec.frameRate;
    if (isMp4 && spec.rotation) vMeta.rotation = spec.rotation;
    output.addVideoTrack(vSrc, Object.keys(vMeta).length ? vMeta : undefined);
  }
  if (aSrc) output.addAudioTrack(aSrc);

  // ── WP-F soft subtitle track (default-on when a transcript exists) ──────────
  // Declared at CONSTRUCTION like the video/audio tracks above (addSubtitleTrack must
  // precede output.start()); its VTT text is fed once in finalize() below, after
  // start(). RED-TEAM TRAP 1: gate on the LOCAL `format`'s getSupportedSubtitleCodecs()
  // - `output.format` is NOT a public accessor. Added ONLY when subtitlesVtt is a
  // non-empty string, so a transcript-less render's bytes are byte-for-byte unchanged.
  const subtitlesVtt = typeof spec.subtitlesVtt === 'string' && spec.subtitlesVtt.length > 0 ? spec.subtitlesVtt : null;
  const subSrc = subtitlesVtt && format.getSupportedSubtitleCodecs().includes('webvtt')
    ? new MB.TextSubtitleSource('webvtt')
    : null;
  if (subSrc) output.addSubtitleTrack(subSrc);

  // output.start() must run once, before any packet reaches a source; the first
  // pump awaits it and every later pump sees the memoised promise.
  let startPromise: Promise<void> | null = null;
  const ensureStarted = (): Promise<void> => (startPromise ??= output.start());

  // The canonical interleave (see the file header), drained INCREMENTALLY as the
  // encode paths hand packets over rather than all at finalize. It is the same
  // bounded merge video-encode-core uses: ascending EncodedPacket.timestamp (in
  // seconds), video winning a tie (e.g. 0.1s at 30fps, where audio falls on every
  // third frame), gated by each stream's watermark - the highest timestamp seen so
  // far, below which nothing new can appear because both encoders emit monotonically
  // (no B-frames). A video packet is settled once its ts <= the audio watermark; an
  // audio packet once its ts <= the video watermark; a finalized or absent stream
  // has an infinite watermark. vi/ai only advance, so the full add() sequence is
  // byte-for-byte the old whole-clip merge regardless of when each add fires.
  let vi = 0;
  let ai = 0;
  let vHigh = Number.NEGATIVE_INFINITY;
  let aHigh = Number.NEGATIVE_INFINITY;
  let videoDone = false;
  let audioDone = aSrc === null;
  let pumpErr: unknown = null;
  let chain: Promise<void> = Promise.resolve();

  const pumpOnce = async (): Promise<void> => {
    const aCeil = audioDone ? Number.POSITIVE_INFINITY : aHigh;
    const vCeil = videoDone ? Number.POSITIVE_INFINITY : vHigh;
    while (vi < vQ.length || ai < aQ.length) {
      const haveV = vi < vQ.length;
      const haveA = ai < aQ.length;
      const takeVideo = haveV && (!haveA || vQ[vi]!.packet.timestamp <= aQ[ai]!.packet.timestamp);
      if (takeVideo) {
        if (vQ[vi]!.packet.timestamp > aCeil) break;
        const e = vQ[vi]!;
        vi++;
        await vSrc!.add(e.packet, e.meta as EncodedVideoChunkMetadata | undefined);
      } else {
        if (aQ[ai]!.packet.timestamp > vCeil) break;
        const e = aQ[ai]!;
        ai++;
        await aSrc!.add(e.packet, e.meta as EncodedAudioChunkMetadata | undefined);
      }
    }
  };

  // Serialise pump runs onto one chain so the add()s stay ordered and never
  // overlap; the sync add* calls kick it (fire-and-forget) and finalize awaits the
  // settled tail. Each run drains everything currently settled, so extra kicks are
  // cheap no-ops - the interleave order they produce is identical either way.
  const kick = (): void => {
    chain = chain.then(async () => {
      await ensureStarted();
      await pumpOnce();
    }).catch((e) => { pumpErr ??= e; });
  };

  const muxer: MediabunnyMuxer = {
    // Tags before start(): the m4a/opus audio export sets them up front, before any
    // packet. Guarded so a post-start call (or a video export that never sets tags)
    // is inert - the interleave/goldens are untouched.
    setMetadataTags(tags) {
      if (!startPromise) output.setMetadataTags(tags);
    },
    // fromEncodedChunk copies the chunk's bytes out immediately, so buffering the
    // packet does not pin the (closeable) WebCodecs chunk.
    addVideoChunk(chunk, meta) {
      let packet = MB.EncodedPacket.fromEncodedChunk(chunk as EncodedVideoChunk);
      const patch: { timestamp?: number; duration?: number } = {};
      // WebM block timecodes are stored at 1ms and mediabunny ROUNDS to nearest,
      // but the sequence/LUT pipelines sample sources at the exact grid time n/fps.
      // A frame whose true time (e.g. 2/30s = 66.667ms) rounds UP then sits just
      // after the query, so the sampler returns the PREVIOUS frame. The old
      // webm-muxer avoided this by TRUNCATING; match it by flooring WebM video
      // timecodes to the ms grid, keeping every stored time <= its grid point.
      // (MP4 keeps sub-ms precision - a fine timescale, no rounding - so it needs
      // no flooring and takes the track frameRate above instead.)
      if (!isMp4) {
        const floored = Math.floor(packet.timestamp * 1000) / 1000;
        if (floored !== packet.timestamp) patch.timestamp = floored;
      }
      if (frameDurSec && !packet.duration) patch.duration = frameDurSec;
      if (patch.timestamp !== undefined || patch.duration !== undefined) packet = packet.clone(patch);
      vQ.push({ packet, meta });
      if (packet.timestamp > vHigh) vHigh = packet.timestamp;
      kick();
    },
    addAudioChunk(chunk, meta) {
      const packet = MB.EncodedPacket.fromEncodedChunk(chunk as EncodedAudioChunk);
      aQ.push({ packet, meta });
      if (packet.timestamp > aHigh) aHigh = packet.timestamp;
      kick();
    },
    async finalize() {
      // Both streams are complete: infinite watermarks release whatever the bounded
      // merge is still holding, in the same canonical order.
      videoDone = true;
      audioDone = true;
      kick();
      await chain;
      if (pumpErr) throw pumpErr instanceof Error ? pumpErr : new Error(String(pumpErr));
      // WP-F: feed the whole WebVTT document once, AFTER start() (ensured by the pumps,
      // or forced here for a packet-less track) and after every A/V packet is muxed.
      if (subSrc) { await ensureStarted(); await subSrc.add(subtitlesVtt!); }
      await output.finalize();
    },
  };

  // The target the caller reads AFTER awaiting finalize: BufferTarget.buffer is
  // populated by then (the non-null cast holds); the OPFS sink is committed by
  // output.finalize() closing its writable, so result() reads the finished file.
  return {
    muxer,
    target: sink
      ? { blob: (): Promise<Blob> => sink.result() }
      : (target as unknown as { buffer: ArrayBuffer }),
  };
}
