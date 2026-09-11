// SPDX-License-Identifier: MPL-2.0
/**
 * Audio encoders - PCM in, a finished audio file out.
 *
 * Two callers today: the voice recorder's "MP3" download (blobToMp3, unchanged),
 * and the audio-only export formats (wav / mp3 / m4a / aac / opus / ogg) that
 * bridge/export.ts dispatches here. The seam is deliberately PCM-in / bytes-out, like
 * bridge/export-hdr-png.ts, so every encoder is testable under node with no DOM.
 *
 * ── The PCM shape ────────────────────────────────────────────────────────────
 * ONE shape throughout: `AudioPcm` = the engine's `WavAudio` - planar channels
 * (`Float32Array` per channel, samples in -1..1) plus a sample rate. Not an
 * `AudioBuffer`: that is a main-thread-only global and is not transferable, and
 * the engine's WAV writer already takes exactly this. `pcmFromAudioBuffer()`
 * converts at the boundary where a real `AudioBuffer` shows up.
 *
 * ── What each path does to the audio (the honesty rule) ──────────────────────
 *  - wav - engine `packWav`. LOSSLESS. `float32` writes the Float32 samples
 *            through untouched; the default `int16` quantises to 16-bit PCM.
 *            Pure JS, deterministic, always available.
 *  - mp3 - lamejs. A LOSSY re-encode of whatever PCM it is handed. Pure JS,
 *            deterministic, always available. Note the source is already decoded
 *            here, so an mp3-in/mp3-out request is generation loss: the caller
 *            (renderAudioExport) avoids it by passing the original bytes through
 *            when nothing was trimmed or mixed.
 *  - m4a - WebCodecs AudioEncoder (AAC-LC, mp4a.40.2) muxed by mediabunny into an
 *            audio-only MP4. LOSSY. Needs a platform encoder (see audioSupport).
 *  - aac - the SAME AAC-LC encoder as m4a, in a bare ADTS stream (.aac) rather
 *            than an MP4 box tree. LOSSY. Same platform encoder + probe as m4a.
 *  - opus - WebCodecs AudioEncoder (opus) muxed by mediabunny into an audio-only
 *            WebM. LOSSY. Needs a platform encoder.
 *  - ogg - the SAME Opus encoder as opus, in an Ogg container (.ogg) rather than
 *            WebM - the honest voice-memo shape, since opus-in-WebM looks like a
 *            video file. LOSSY. Same platform encoder + probe as opus.
 *  - flac - mediabunny's libFLAC WASM encoder (@mediabunny/flac-encoder, MPL-2.0),
 *            registered into mediabunny once and driven natively - NOT WebCodecs.
 *            LOSSLESS: the PCM is fed at its own rate/channels, never resampled.
 *            libFLAC only accepts a fixed set of sample rates, so encodeFlac
 *            re-probes canEncodeAudio('flac') at the clip's real rate and fails with
 *            a message rather than mid-encode. No C2PA placer exists for FLAC (see
 *            engine/src/c2pa-containers.ts), so a FLAC export ships UNSIGNED.
 *
 * Every LOSSY path is a genuine re-encode of the samples given, so a lossy source
 * that is neither trimmed nor mixed must NOT be routed through one when the
 * requested format already matches it - renderAudioExport enforces that.
 *
 * The muxer (mediabunny) and lamejs are lazy-imported so neither enters the
 * preload bundle; they load only when someone exports audio.
 */
import type { MetadataTags } from 'mediabunny';
import { concatBytes } from '../../../../engine/src/bytes.ts';
import { packWav, type WavAudio, type WavSampleFormat } from '../../../../engine/src/wav.ts';
import { audioChunkSchedule } from '../bridge/video-mime.ts';
import { buildMediabunnyMux } from '../bridge/mediabunny-mux.ts';

/** Planar PCM: one Float32Array per channel, samples in -1..1, plus its rate.
 *  Structurally the engine's WavAudio, so packWav takes it directly. */
export type AudioPcm = WavAudio;

/** The audio-only export formats, in the order the picker lists them. */
export const AUDIO_FORMATS = ['wav', 'mp3', 'm4a', 'aac', 'opus', 'ogg', 'flac'] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];

const AUDIO_MIME: Record<AudioFormat, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',    // bare ADTS AAC stream
  opus: 'audio/webm',
  ogg: 'audio/ogg',    // Opus in an Ogg container
  flac: 'audio/flac',  // lossless FLAC (mediabunny libFLAC encoder)
};

/** Container MIME for a finished file in `format`. */
export function audioMime(format: AudioFormat): string {
  return AUDIO_MIME[format];
}

export function isAudioFormat(format: string): format is AudioFormat {
  return (AUDIO_FORMATS as readonly string[]).includes(format);
}

/** Bitrate for the lossy encoders - the same 128 kbps the video export's audio
 *  track uses (export.ts AUDIO_BITRATE), so a bed sounds identical either way. */
export const AUDIO_BITRATE = 128_000;

/** Channels an audio export ever writes: mono stays mono, anything wider folds
 *  to the first two planes (the lossy encoders are configured stereo at most). */
const MAX_CHANNELS = 2;

/** The slice of `AudioBuffer` this module reads (spelled out so a worker-side
 *  planar buffer satisfies it too - same reasoning as video-encode-core's PcmSource). */
export interface PcmSource {
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

/** An AudioBuffer (or its planar stand-in) → the planar shape every encoder takes. */
export function pcmFromAudioBuffer(buffer: PcmSource): AudioPcm {
  const count = Math.max(1, Math.min(MAX_CHANNELS, buffer.numberOfChannels));
  const channels: Float32Array[] = [];
  for (let ch = 0; ch < count; ch++) channels.push(buffer.getChannelData(ch));
  return { channels, sampleRate: buffer.sampleRate };
}

// ── wav ───────────────────────────────────────────────────────────────────────

/** LOSSLESS RIFF/WAVE. `float32` keeps the samples bit-exact; `int16` (default)
 *  quantises to the form every player reads. */
export function encodeWav(pcm: AudioPcm, opts: { sampleFormat?: WavSampleFormat } = {}): Blob {
  const bytes = packWav(pcm, opts.sampleFormat ? { format: opts.sampleFormat } : {});
  return new Blob([bytes as BlobPart], { type: AUDIO_MIME.wav });
}

// ── mp3 (lamejs) ──────────────────────────────────────────────────────────────

/** LOSSY MP3 re-encode of `pcm` (lamejs). Deterministic: same PCM, same bytes.
 *  lamejs emits a bare MPEG stream with no metadata, so when `tags` carry anything
 *  a hand-built ID3v2.3 block (TIT2/TPE1/TALB/COMM) is prepended (id3v2Tag). */
export async function encodeMp3(
  pcm: AudioPcm, { bitrate = 160, tags }: { bitrate?: number; tags?: MetadataTags } = {},
): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const channels = Math.min(MAX_CHANNELS, pcm.channels.length) >= 2 ? 2 : 1;
  const enc = new Mp3Encoder(channels, pcm.sampleRate, bitrate);
  const left = floatToInt16(pcm.channels[0] ?? new Float32Array(0));
  const right = channels === 2 ? floatToInt16(pcm.channels[1]!) : null;

  const BLOCK = 1152; // lamejs works on 1152-sample frames
  const chunks: BlobPart[] = [];
  const id3 = tags ? id3v2Tag(tags) : null;
  if (id3) chunks.push(id3 as BlobPart);
  for (let i = 0; i < left.length; i += BLOCK) {
    const l = left.subarray(i, i + BLOCK);
    const buf = right ? enc.encodeBuffer(l, right.subarray(i, i + BLOCK)) : enc.encodeBuffer(l);
    if (buf.length) chunks.push(buf as BlobPart);
  }
  const tail = enc.flush();
  if (tail.length) chunks.push(tail as BlobPart);
  return new Blob(chunks, { type: AUDIO_MIME.mp3 });
}

// ── ID3v2.3 (hand-built - lamejs writes no metadata) ──────────────────────────
//
// A minimal tag block prepended to the bare MPEG stream: 'ID3' header + a text
// frame per present field. Deterministic (pure function of the strings, no clock).
// Text is UTF-16LE with a BOM (encoding byte 0x01) so a user-supplied artist name
// in any script survives - ID3v2.3 has no UTF-8 encoding (that is v2.4). Only the
// four frames the task names; `date` has no frame here (the mediabunny encoders
// carry it), and rights fold into `comment` upstream (buildAudioTags).

/** ID3v2.3 tag bytes for `tags`, or null when no mapped field is set (so an
 *  untagged export stays a bare MPEG stream, byte-identical to before). */
function id3v2Tag(tags: MetadataTags): Uint8Array | null {
  const frames: Uint8Array[] = [];
  if (tags.title) frames.push(id3Frame('TIT2', id3TextPayload(tags.title)));
  if (tags.artist) frames.push(id3Frame('TPE1', id3TextPayload(tags.artist)));
  if (tags.album) frames.push(id3Frame('TALB', id3TextPayload(tags.album)));
  if (tags.comment) frames.push(id3Frame('COMM', id3CommPayload(tags.comment)));
  if (!frames.length) return null;

  const body = concatBytes(frames);
  const header = new Uint8Array(10);
  header.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]);   // 'ID3', v2.3.0, flags 0
  // Tag size (excluding this 10-byte header) as a 28-bit syncsafe integer.
  header[6] = (body.length >>> 21) & 0x7f;
  header[7] = (body.length >>> 14) & 0x7f;
  header[8] = (body.length >>> 7) & 0x7f;
  header[9] = body.length & 0x7f;
  return concatBytes([header, body]);
}

/** UTF-16LE bytes with a leading BOM (ID3v2.3 encoding 0x01). */
function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(2 + s.length * 2);
  out[0] = 0xff; out[1] = 0xfe;                        // UTF-16LE BOM
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[2 + i * 2] = c & 0xff;
    out[3 + i * 2] = c >>> 8;
  }
  return out;
}

/** Text-frame payload: encoding byte 0x01 (UTF-16) + the BOM-led string. */
function id3TextPayload(value: string): Uint8Array {
  return concatBytes([new Uint8Array([0x01]), utf16le(value)]);
}

/** COMM payload: encoding 0x01, language 'eng', empty UTF-16 descriptor, then text. */
function id3CommPayload(comment: string): Uint8Array {
  return concatBytes([
    new Uint8Array([0x01, 0x65, 0x6e, 0x67]),          // encoding 0x01, language 'eng'
    new Uint8Array([0xff, 0xfe, 0x00, 0x00]),          // empty descriptor: BOM + UTF-16 terminator
    utf16le(comment),
  ]);
}

/** Wrap a frame payload in the 10-byte ID3v2.3 frame header (4-char id, 32-bit
 *  big-endian size - NOT syncsafe in v2.3 - and two zero flag bytes). */
function id3Frame(id: string, payload: Uint8Array): Uint8Array {
  const frame = new Uint8Array(10 + payload.length);
  for (let i = 0; i < 4; i++) frame[i] = id.charCodeAt(i);
  new DataView(frame.buffer).setUint32(4, payload.length, false);
  frame.set(payload, 10);
  return frame;
}

/** Decode any recorded audio Blob and re-encode it to an MP3 Blob (audio/mpeg).
 *  The voice recorder's MP3 download - MediaRecorder gives us opus/aac for free,
 *  MP3 is the universally-playable extra the browser cannot produce itself. */
export async function blobToMp3(blob: Blob, { bitrate = 160 }: { bitrate?: number } = {}): Promise<Blob> {
  const audio = await decodeAudioBlob(blob);
  return await encodeMp3(audio, { bitrate });
}

function floatToInt16(f32: Float32Array): Int16Array {
  const out = new Int16Array(f32.length);
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

// ── m4a / opus (WebCodecs + a muxer in audio-only mode) ───────────────────────

/** The slice of the muxer this module drives. finalize is async (mediabunny's
 *  Output is - see bridge/mediabunny-mux.ts); chunks are still added synchronously. */
interface AudioMuxerLike {
  addAudioChunk(chunk: unknown, metadata?: unknown): void;
  finalize(): Promise<void>;
  /** Set the container's metadata tags BEFORE the first chunk (Output.start()).
   *  Present only on the audio-only containers this module owns (Ogg/ADTS); the
   *  shared video/audio muxer (bridge/mediabunny-mux.ts) does NOT expose it, so
   *  m4a/opus tags are a followup blocked on that file. Optional so the WebCodecs
   *  path's `?.` call is a safe no-op there. */
  setMetadataTags?(tags: MetadataTags): void;
}
interface BuiltAudioMuxer { muxer: AudioMuxerLike; target: { buffer: ArrayBuffer } }

/** Factory for the audio-only muxer - swappable so the encode path is drivable
 *  under node without a real muxer or a real AudioEncoder. `mp4`/`webm` ride the
 *  shared video/audio muxer; `ogg`/`adts` are audio-only containers it doesn't
 *  cover, so they go through buildAudioOnlyMux below. */
export type AudioMuxerFactory = (
  container: 'mp4' | 'webm' | 'ogg' | 'adts',
  track: { codec: string; numberOfChannels: number; sampleRate: number },
) => Promise<BuiltAudioMuxer>;

/** An audio-only file: declare the audio track and no video. The channel count /
 *  sample rate arrive with the encoded chunks' metadata, so only the codec is
 *  needed here. */
export const defaultAudioMuxerFactory: AudioMuxerFactory = async (container, track) => {
  // Audio-only export always uses the in-memory BufferTarget (no step-A3 OPFS
  // streaming here), so the target is the `.buffer` kind.
  if (container === 'ogg' || container === 'adts') {
    return await buildAudioOnlyMux(container, track.codec);
  }
  const { muxer, target } = await buildMediabunnyMux({ container, audio: track.codec });
  return { muxer, target: target as { buffer: ArrayBuffer } };
};

/** mux-codec id (the encode path's spelling) → mediabunny codec, for the two
 *  audio-only containers. Deliberately the SAME spellings the shared muxer's
 *  AUDIO_CODEC map uses, so a caller can name a codec one way for either. */
const AUDIO_ONLY_CODEC: Record<string, 'opus' | 'aac'> = { A_OPUS: 'opus', aac: 'aac' };

/**
 * A minimal single-track mux for the audio-only containers buildMediabunnyMux
 * doesn't cover: Ogg (Opus) and ADTS (AAC). mediabunny is lazy-imported, as
 * everywhere here. No cross-stream interleave (one encoder, monotonic decode
 * order) and no OPFS - audio export is always the in-memory BufferTarget. Each
 * chunk's bytes are copied out of its (closeable) WebCodecs chunk synchronously by
 * fromEncodedChunk, and the async source.add()s are serialised onto one chain so
 * finalize() only has to await the settled tail. This mirrors the add/finalize
 * the structure of buildMediabunnyMux, minus the two-stream bounded merge it needs and
 * this one doesn't. (Ogg-Opus needs the encoder's OpusHead in the chunk metadata's
 * decoderConfig.description; the real AudioEncoder supplies it, and it flows
 * through unchanged.)
 */
async function buildAudioOnlyMux(
  container: 'ogg' | 'adts', muxCodec: string,
): Promise<BuiltAudioMuxer> {
  const MB = await import('mediabunny');
  const codec = AUDIO_ONLY_CODEC[muxCodec];
  if (!codec) throw new Error(`audio-encode: unknown audio-only mux codec '${muxCodec}'`);
  const target = new MB.BufferTarget();
  const format = container === 'ogg' ? new MB.OggOutputFormat() : new MB.AdtsOutputFormat();
  const output = new MB.Output({ format, target });
  const src = new MB.EncodedAudioPacketSource(codec);
  output.addAudioTrack(src);

  let started: Promise<void> | null = null;
  const ensureStarted = (): Promise<void> => (started ??= output.start());
  let chain: Promise<void> = Promise.resolve();
  let err: unknown = null;

  const muxer: AudioMuxerLike = {
    // Must be called before the first addAudioChunk (which triggers output.start());
    // mediabunny's setMetadataTags throws if called after start. Ogg writes them as
    // Vorbis comments; ADTS carries them in an ID3 header.
    setMetadataTags(tags) { output.setMetadataTags(tags); },
    addAudioChunk(chunk, meta) {
      const packet = MB.EncodedPacket.fromEncodedChunk(chunk as EncodedAudioChunk);
      chain = chain
        .then(async () => { await ensureStarted(); await src.add(packet, meta as EncodedAudioChunkMetadata | undefined); })
        .catch((e) => { err ??= e; });
    },
    async finalize() {
      await chain;
      if (err) throw err instanceof Error ? err : new Error(String(err));
      await output.finalize();
    },
  };
  return { muxer, target: target as unknown as { buffer: ArrayBuffer } };
}

/** Injection seam for the WebCodecs globals + the muxer (node has neither). */
export interface AudioEncodeDeps {
  AudioEncoder?: any;
  AudioData?: any;
  muxerFactory?: AudioMuxerFactory;
  /** FLAC Output builder override (tests). Default: lazy-import mediabunny +
   *  @mediabunny/flac-encoder, register the encoder, and re-probe at the real rate. */
  flacOutput?: FlacOutputFactory;
}

interface WebCodecsAudioOpts { bitrate?: number; tags?: MetadataTags }

/** The four WebCodecs-backed audio formats, keyed by format id. Two encoders
 *  (AAC-LC, Opus) across four containers: m4a/aac share the AAC encoder + its
 *  isConfigSupported probe (differing only in container), opus/ogg share Opus.
 *  That codec sharing is exactly why format-support.ts gates all four on the same
 *  two probes. */
const WEBCODECS_AUDIO: Record<'m4a' | 'aac' | 'opus' | 'ogg',
  { codec: string; muxCodec: string; container: 'mp4' | 'webm' | 'ogg' | 'adts' }> = {
  m4a:  { codec: 'mp4a.40.2', muxCodec: 'aac',    container: 'mp4' },
  aac:  { codec: 'mp4a.40.2', muxCodec: 'aac',    container: 'adts' },
  opus: { codec: 'opus',      muxCodec: 'A_OPUS', container: 'webm' },
  ogg:  { codec: 'opus',      muxCodec: 'A_OPUS', container: 'ogg' },
};

/** Encode + mux `pcm` as an audio-only file. Codec settings mirror export.ts's
 *  pickWebCodecsAudio (AAC-LC for mp4/adts, Opus for webm/ogg, 128 kbps) with ONE
 *  difference: the sample rate is the PCM's own, not a fixed 48 kHz. A video
 *  export renders its bed at 48 kHz on purpose; here the samples already exist,
 *  and declaring a rate they were not sampled at would play the file back at the
 *  wrong speed. */
async function encodeWebCodecsAudio(
  pcm: AudioPcm, format: 'm4a' | 'aac' | 'opus' | 'ogg', opts: WebCodecsAudioOpts = {}, deps: AudioEncodeDeps = {},
): Promise<Blob> {
  const g = globalThis as any;
  const AEnc = deps.AudioEncoder ?? g.AudioEncoder;
  const AData = deps.AudioData ?? g.AudioData;
  if (!AEnc || !AData) throw new Error(NO_WEBCODECS_MSG);

  const { codec, muxCodec, container } = WEBCODECS_AUDIO[format];
  const numberOfChannels = Math.max(1, Math.min(MAX_CHANNELS, pcm.channels.length));
  const sampleRate = pcm.sampleRate;
  const bitrate = opts.bitrate ?? AUDIO_BITRATE;

  // Probe the REAL configuration (not the nominal one format-support.ts caches),
  // so an unusual rate/channel count fails here with a message instead of
  // throwing out of encoder.configure mid-export.
  try {
    const s = await AEnc.isConfigSupported?.({ codec, sampleRate, numberOfChannels, bitrate });
    if (s && s.supported === false) throw new Error(NO_WEBCODECS_MSG);
  } catch (err) {
    throw err instanceof Error ? err : new Error(NO_WEBCODECS_MSG);
  }

  const { muxer, target } = await (deps.muxerFactory ?? defaultAudioMuxerFactory)(
    container, { codec: muxCodec, numberOfChannels, sampleRate },
  );

  // Metadata tags BEFORE the first chunk (which starts the Output). Only the
  // audio-only containers this module owns (Ogg/ADTS) expose setMetadataTags; for
  // mp4/webm the shared muxer hides its Output, so this is a no-op there (followup).
  if (opts.tags && Object.keys(opts.tags).length) muxer.setMetadataTags?.(opts.tags);

  let encErr: unknown = null;
  const enc = new AEnc({
    output: (chunk: unknown, metadata: unknown) => { try { muxer.addAudioChunk(chunk, metadata); } catch (e) { encErr ??= e; } },
    error: (e: unknown) => { encErr ??= e; },
  });
  enc.configure({ codec, sampleRate, numberOfChannels, bitrate });

  const total = pcm.channels[0]?.length ?? 0;
  const CHUNK = 4800;                                   // ~0.1s @ 48k, as the video path uses
  const planar = new Float32Array(CHUNK * numberOfChannels);
  for (const span of audioChunkSchedule(total, sampleRate, CHUNK)) {
    if (encErr) break;
    const n = span.numFrames;
    // f32-planar layout for this chunk: [ch0: n samples][ch1: n samples] (stride n).
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const plane = pcm.channels[Math.min(ch, pcm.channels.length - 1)]!;
      planar.set(plane.subarray(span.offsetFrames, span.offsetFrames + n), ch * n);
    }
    const data = new AData({
      format: 'f32-planar', sampleRate, numberOfFrames: n, numberOfChannels,
      timestamp: span.timestampUs,
      data: planar.subarray(0, n * numberOfChannels),   // AudioData copies the data
    });
    try { enc.encode(data); } finally { data.close?.(); }
    if (enc.encodeQueueSize > 20) await new Promise<void>((r) => setTimeout(r, 0));
  }
  await enc.flush();
  enc.close?.();
  if (encErr) throw encErr instanceof Error ? encErr : new Error('AudioEncoder error');

  await muxer.finalize();
  return new Blob([target.buffer as BlobPart], { type: AUDIO_MIME[format] });
}

const NO_WEBCODECS_MSG = 'This browser cannot encode that audio format. Try WAV or MP3.';

/** LOSSY AAC-LC in an MP4 container (.m4a). */
export function encodeM4a(pcm: AudioPcm, opts: WebCodecsAudioOpts = {}, deps: AudioEncodeDeps = {}): Promise<Blob> {
  return encodeWebCodecsAudio(pcm, 'm4a', opts, deps);
}

/** LOSSY AAC-LC in a bare ADTS stream (.aac) - the same encoder as m4a. */
export function encodeAac(pcm: AudioPcm, opts: WebCodecsAudioOpts = {}, deps: AudioEncodeDeps = {}): Promise<Blob> {
  return encodeWebCodecsAudio(pcm, 'aac', opts, deps);
}

/** LOSSY Opus in a WebM container (audio-only .webm). */
export function encodeOpus(pcm: AudioPcm, opts: WebCodecsAudioOpts = {}, deps: AudioEncodeDeps = {}): Promise<Blob> {
  return encodeWebCodecsAudio(pcm, 'opus', opts, deps);
}

/** LOSSY Opus in an Ogg container (.ogg) - the same encoder as opus. */
export function encodeOgg(pcm: AudioPcm, opts: WebCodecsAudioOpts = {}, deps: AudioEncodeDeps = {}): Promise<Blob> {
  return encodeWebCodecsAudio(pcm, 'ogg', opts, deps);
}

// ── flac (mediabunny + @mediabunny/flac-encoder, NOT WebCodecs) ───────────────

const NO_FLAC_MSG = 'This browser cannot encode FLAC audio. Try WAV or MP3.';

/** The mediabunny FLAC Output this module drives - the primitives encodeFlac needs,
 *  swappable so the tags path is drivable under node with a stub Output. */
export interface FlacBuild {
  output: { setMetadataTags(tags: MetadataTags): void; start(): Promise<void>; finalize(): Promise<void> };
  source: { add(sample: unknown): Promise<void> };
  target: { buffer: ArrayBuffer };
  AudioSample: new (init: { data: ArrayBufferView; format: string; numberOfChannels: number; sampleRate: number; timestamp: number }) => { close?(): void };
}
export type FlacOutputFactory = (spec: { numberOfChannels: number; sampleRate: number }) => Promise<FlacBuild>;

/** Registered once per realm. registerEncoder dedupes internally (same class ref),
 *  and canEncodeAudio short-circuits re-entry, but this avoids even the probe. */
let _flacRegistered = false;

/** Build the real mediabunny FLAC Output. Registers the libFLAC encoder (guarded so
 *  it never overrides a native FLAC encoder, and never double-registers), then
 *  re-probes canEncodeAudio at the CLIP's real rate/channels - libFLAC only accepts
 *  a fixed set of sample rates, so an odd decode rate fails HERE with a message,
 *  not mid-encode (mirrors encodeWebCodecsAudio's real-config probe). */
const defaultFlacOutputFactory: FlacOutputFactory = async ({ numberOfChannels, sampleRate }) => {
  const MB = await import('mediabunny');
  if (!_flacRegistered) {
    if (!(await MB.canEncodeAudio('flac'))) {
      const { registerFlacEncoder } = await import('@mediabunny/flac-encoder');
      registerFlacEncoder();
    }
    _flacRegistered = true;
  }
  if (!(await MB.canEncodeAudio('flac', { numberOfChannels, sampleRate }))) throw new Error(NO_FLAC_MSG);
  const target = new MB.BufferTarget();
  const output = new MB.Output({ format: new MB.FlacOutputFormat(), target });
  const source = new MB.AudioSampleSource({ codec: 'flac' });
  output.addAudioTrack(source);
  return {
    output,
    source,
    target: target as unknown as { buffer: ArrayBuffer },
    AudioSample: MB.AudioSample as unknown as FlacBuild['AudioSample'],
  };
};

/** LOSSLESS FLAC. Feeds `pcm` at its own rate/channels through mediabunny's
 *  registered libFLAC encoder - no resample, no reduce. Tags (if any) are written
 *  into the Vorbis comment block BEFORE start(). Ships UNSIGNED: there is no FLAC
 *  C2PA placer (engine/src/c2pa-containers.ts). */
export async function encodeFlac(
  pcm: AudioPcm, opts: { tags?: MetadataTags } = {}, deps: AudioEncodeDeps = {},
): Promise<Blob> {
  const numberOfChannels = Math.max(1, Math.min(MAX_CHANNELS, pcm.channels.length));
  const sampleRate = pcm.sampleRate;
  const { output, source, target, AudioSample } = await (deps.flacOutput ?? defaultFlacOutputFactory)(
    { numberOfChannels, sampleRate },
  );

  if (opts.tags && Object.keys(opts.tags).length) output.setMetadataTags(opts.tags);
  await output.start();

  const total = pcm.channels[0]?.length ?? 0;
  const CHUNK = 4800;                                   // ~0.1s @ 48k, as the WebCodecs path uses
  for (const span of audioChunkSchedule(total, sampleRate, CHUNK)) {
    const n = span.numFrames;
    // Fresh plane per chunk (not a reused scratch buffer): source.add() may queue the
    // sample past its await, so the bytes must stay owned by this sample.
    const planar = new Float32Array(n * numberOfChannels);
    for (let ch = 0; ch < numberOfChannels; ch++) {
      const plane = pcm.channels[Math.min(ch, pcm.channels.length - 1)]!;
      planar.set(plane.subarray(span.offsetFrames, span.offsetFrames + n), ch * n);
    }
    const sample = new AudioSample({
      format: 'f32-planar', numberOfChannels, sampleRate,
      timestamp: span.offsetFrames / sampleRate,        // AudioSample timestamps are in SECONDS
      data: planar,
    });
    try { await source.add(sample); } finally { sample.close?.(); }
  }

  await output.finalize();
  return new Blob([target.buffer as BlobPart], { type: AUDIO_MIME.flac });
}

/** Encode `pcm` to `format`. The one entry point the export dispatch needs. */
export function encodeAudio(
  format: AudioFormat, pcm: AudioPcm,
  opts: { bitrate?: number; sampleFormat?: WavSampleFormat; tags?: MetadataTags } = {}, deps: AudioEncodeDeps = {},
): Promise<Blob> {
  switch (format) {
    // wav tags are written by export.ts embedWavInfo (RIFF INFO), not here, so
    // encodeWav ignores opts.tags; mp3 carries them in a hand-built ID3v2.3 block.
    case 'wav': return Promise.resolve(encodeWav(pcm, opts));
    // lamejs takes kbps; every other encoder here (and AUDIO_BITRATE) is bits/s.
    case 'mp3': return encodeMp3(pcm, {
      ...(opts.bitrate ? { bitrate: Math.round(opts.bitrate / 1000) } : {}),
      ...(opts.tags ? { tags: opts.tags } : {}),
    });
    case 'm4a': return encodeM4a(pcm, opts, deps);
    case 'aac': return encodeAac(pcm, opts, deps);
    case 'opus': return encodeOpus(pcm, opts, deps);
    case 'ogg': return encodeOgg(pcm, opts, deps);
    case 'flac': return encodeFlac(pcm, opts.tags ? { tags: opts.tags } : {}, deps);
  }
}

// ── source resolution + the export entry point ────────────────────────────────

/**
 * What the export dispatch hands over. The audio SOURCE is tool-specific, so it
 * arrives one of two ways and this module never guesses:
 *
 *  1. `pcm` - PCM the tool already mixed (Sequence Studio: every clip's own
 *     sound plus the bed). Wins over `audio`, and is what a mix that cannot be
 *     named by a URL must use.
 *  2. `audio` - the export bar's selection (`ExportOpts.audio`): a fetchable
 *     `url` plus the in-point/envelope fields. With `duration` this is THE
 *     TRIMMED EXCERPT - [start, start + duration) of the source, which is what
 *     the Audiogram's "Start at" / clip length mean.
 *
 * With neither, there is nothing to export and the caller gets an error rather
 * than a file of silence.
 */
export interface AudioExportRequest {
  pcm?: AudioPcm | null;
  audio?: { url: string; start?: number; fadeIn?: number; fadeOut?: number; volume?: number } | null;
  /** Excerpt length in seconds. Absent = to the end of the source. */
  duration?: number;
  bitrate?: number;
  sampleFormat?: WavSampleFormat;
  /** Re-encode even when the source container already matches `format`.
   *  Download-as uses this when the user explicitly chose compression settings;
   *  absent/false keeps the normal byte-exact pass-through rule. */
  forceEncode?: boolean;
  /** Container metadata tags (buildAudioTags output). Written by the mediabunny-Output
   *  encoders (aac/ogg/flac; m4a/opus pending - see AudioMuxerLike.setMetadataTags)
   *  and by the mp3 path (a hand-built ID3v2.3 block). wav is tagged separately by
   *  export.ts embedWavInfo; a pass-through (untrimmed source already in `format`)
   *  returns the source bytes untagged. */
  tags?: MetadataTags;
  log?: (level: 'debug' | 'info' | 'warn' | 'error', msg: string) => void;
  /** Decode override (tests / non-DOM hosts). Default: AudioContext.decodeAudioData. */
  decode?: (bytes: ArrayBuffer) => Promise<AudioPcm>;
  /** Fetch override (tests). Default: global fetch. */
  fetchBytes?: (url: string) => Promise<ArrayBuffer>;
}

export const NO_AUDIO_MSG = 'There is no audio to export. Add a sound file first.';

/**
 * Produce an audio file for `format` from whatever source the request carries.
 *
 * PASS-THROUGH (the honesty rule): when the source is already `format`, is taken
 * whole (no trim), and carries no gain or fade change, the ORIGINAL BYTES are
 * returned untouched. Re-encoding an mp3 excerpt-that-is-not-an-excerpt into
 * another mp3 would throw away quality for nothing. Any trim, fade or volume
 * change means the samples genuinely changed, so a real encode is correct and
 * happens.
 */
export async function renderAudioExport(
  format: AudioFormat, req: AudioExportRequest, deps: AudioEncodeDeps = {},
): Promise<Blob> {
  const encodeOpts = {
    ...(req.bitrate ? { bitrate: req.bitrate } : {}),
    ...(req.sampleFormat ? { sampleFormat: req.sampleFormat } : {}),
    ...(req.tags ? { tags: req.tags } : {}),
  };
  if (req.pcm) return await encodeAudio(format, req.pcm, encodeOpts, deps);

  const url = req.audio?.url;
  if (!url) throw new Error(NO_AUDIO_MSG);

  const bytes = await (req.fetchBytes ?? defaultFetchBytes)(url);
  const decoded = await (req.decode ?? decodeAudioBytes)(bytes);

  const sampleRate = decoded.sampleRate;
  const totalFrames = decoded.channels[0]?.length ?? 0;
  const start = Math.max(0, req.audio?.start ?? 0);
  let from = Math.min(Math.round(start * sampleRate), totalFrames);
  if (from >= totalFrames && totalFrames > 0) {
    req.log?.('warn', `Audio starts at ${start}s but the track is only ${(totalFrames / sampleRate).toFixed(2)}s long; exporting from 0:00.`);
    from = 0;
  }
  const want = req.duration != null && req.duration > 0 ? Math.round(req.duration * sampleRate) : totalFrames - from;
  const to = Math.min(totalFrames, from + Math.max(0, want));

  const volume = req.audio?.volume ?? 1;
  const fadeIn = Math.max(0, req.audio?.fadeIn ?? 0);
  const fadeOut = Math.max(0, req.audio?.fadeOut ?? 0);
  const untouched = from === 0 && to === totalFrames && volume === 1 && !fadeIn && !fadeOut;

  if (untouched && !req.forceEncode && sniffAudioFormat(bytes) === format) {
    // The user asked for the file they already have. Hand back the source bytes.
    return new Blob([bytes as BlobPart], { type: AUDIO_MIME[format] });
  }

  const pcm = sliceWithEnvelope(decoded, from, to, { volume, fadeIn, fadeOut });
  if (!(pcm.channels[0]?.length ?? 0)) throw new Error(NO_AUDIO_MSG);
  return await encodeAudio(format, pcm, encodeOpts, deps);
}

/** Cut [from, to) out of `pcm` and apply the gain envelope, into fresh planes.
 *  Linear fades, matching the Web Audio graph the video export's bed uses. */
export function sliceWithEnvelope(
  pcm: AudioPcm, from: number, to: number,
  env: { volume?: number; fadeIn?: number; fadeOut?: number } = {},
): AudioPcm {
  const n = Math.max(0, to - from);
  const rate = pcm.sampleRate;
  const volume = env.volume ?? 1;
  const inFrames = Math.min(n, Math.round((env.fadeIn ?? 0) * rate));
  const outFrames = Math.min(n, Math.round((env.fadeOut ?? 0) * rate));
  const channels = pcm.channels.slice(0, MAX_CHANNELS).map((plane) => {
    const out = new Float32Array(n);
    out.set(plane.subarray(from, from + n));
    for (let i = 0; i < n; i++) {
      let g = volume;
      if (inFrames > 0 && i < inFrames) g *= i / inFrames;
      if (outFrames > 0 && i >= n - outFrames) g *= (n - i) / outFrames;
      if (g !== 1) out[i] = out[i]! * g;
    }
    return out;
  });
  return { channels: channels.length ? channels : [new Float32Array(n)], sampleRate: rate };
}

/** Container sniff on the leading bytes - enough to tell the six apart, so the
 *  pass-through above never claims a match it cannot see. */
export function sniffAudioFormat(bytes: ArrayBuffer | Uint8Array): AudioFormat | null {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length < 12) return null;
  const tag = (at: number, len: number): string => String.fromCharCode(...u8.subarray(at, at + len));
  if (tag(0, 4) === 'RIFF' && tag(8, 4) === 'WAVE') return 'wav';
  if (tag(0, 4) === 'fLaC') return 'flac';                                                 // FLAC stream marker (0x66 4C 61 43)
  if (tag(4, 4) === 'ftyp') return 'm4a';
  if (tag(0, 4) === 'OggS') return 'ogg';                                                  // Ogg (our Opus-in-Ogg)
  if (u8[0] === 0x1a && u8[1] === 0x45 && u8[2] === 0xdf && u8[3] === 0xa3) return 'opus';  // EBML (webm)
  if (tag(0, 3) === 'ID3') return 'mp3';
  // ADTS AAC before the looser MPEG sync: a 12-bit syncword (0xFFF) with the layer
  // bits zero. MP3's frame sync is only 11 bits and its layer bits are non-zero, so
  // (byte1 & 0xF6) === 0xF0 tells the two 0xFF-lead streams apart.
  if (u8[0] === 0xff && (u8[1]! & 0xf6) === 0xf0) return 'aac';
  if (u8[0] === 0xff && (u8[1]! & 0xe0) === 0xe0) return 'mp3';                             // MPEG frame sync
  return null;
}

async function defaultFetchBytes(url: string): Promise<ArrayBuffer> {
  return await (await fetch(url)).arrayBuffer();
}

/** Decode compressed bytes through Web Audio (the only decoder a browser has for
 *  mp3/aac/opus). Throws with the decoder's own reason. */
async function decodeAudioBytes(bytes: ArrayBuffer): Promise<AudioPcm> {
  const AC = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) throw new Error('Web Audio is not supported in this browser');
  const ctx = new AC();
  try {
    return pcmFromAudioBuffer(await ctx.decodeAudioData(bytes));
  } finally {
    ctx.close().catch(() => {});
  }
}

async function decodeAudioBlob(blob: Blob): Promise<AudioPcm> {
  return await decodeAudioBytes(await blob.arrayBuffer());
}
