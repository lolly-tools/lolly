// SPDX-License-Identifier: MPL-2.0
/**
 * WAV reader/writer. RIFF bytes in, Float32 channel data out, and back again.
 *
 * Exists so `host.audio` has a decoder that needs no platform codec at all. The web
 * shell hands its audio to `decodeAudioData` and gets MP3/AAC/Opus for free; Node
 * has none of that, so the headless path (CLI, TUI, batch renders) can decode
 * exactly two things without dependencies: a WAV file, and a ZzFXM song it renders
 * itself. That covers the cases that matter headlessly: our own generated
 * music, and any clip a user is willing to hand over uncompressed.
 *
 * Supports the PCM forms that actually turn up: 8-bit unsigned, 16/24/32-bit signed
 * integer, and 32/64-bit IEEE float, including inside a `WAVE_FORMAT_EXTENSIBLE`
 * wrapper. Anything else (µ-law, ADPCM, a compressed payload in a RIFF skin) is
 * REFUSED by name rather than misread as PCM. Reading an unknown encoding as
 * samples produces full-scale noise, which as an audiogram would look like a
 * perfectly plausible loud track.
 *
 * Untrusted input: every field is bounds-checked against the actual byte length, and
 * chunk walking cannot run backwards or off the end regardless of what the declared
 * sizes claim. See tests/wav.test.ts for the truncation/garbage cases.
 */

/** Format tags from the WAVE spec. */
const FMT_PCM = 0x0001;
const FMT_FLOAT = 0x0003;
const FMT_ALAW = 0x0006;
const FMT_MULAW = 0x0007;
const FMT_EXTENSIBLE = 0xfffe;

/** A sane ceiling on channel count. Without it, a malformed header claiming 65,535
 *  channels would make us allocate 65,535 arrays before discovering there's no data. */
const MAX_CHANNELS = 32;

export interface WavAudio {
  /** One Float32Array per channel, samples in −1..1. */
  channels: Float32Array[];
  /** Sample rate in Hz, as declared by the file. */
  sampleRate: number;
}

/**
 * Decode a WAV file. Throws with a specific reason on anything it cannot read.
 * Callers surface that to the user, so "24-bit ADPCM" is a better message than a
 * silent wall of noise.
 */
export function parseWav(bytes: ArrayBuffer | Uint8Array): WavAudio {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const len = u8.byteLength;
  if (len < 44) throw new Error('wav: too short to be a RIFF/WAVE file');
  if (str(u8, 0, 4) !== 'RIFF' || str(u8, 8, 4) !== 'WAVE') throw new Error('wav: not a RIFF/WAVE file');

  let formatTag = 0;
  let channelCount = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataStart = -1;
  let dataLen = 0;

  // Walk the chunk list. The declared size is the file's claim, not a fact: clamp
  // every read to the real length, and step by at least the header size so a chunk
  // declaring size 0 (or a size that overflows) cannot loop forever.
  let at = 12;
  while (at + 8 <= len) {
    const id = str(u8, at, 4);
    const size = view.getUint32(at + 4, true);
    const body = at + 8;
    const avail = Math.max(0, Math.min(size, len - body));

    if (id === 'fmt ') {
      if (avail < 16) throw new Error('wav: truncated fmt chunk');
      formatTag = view.getUint16(body, true);
      channelCount = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
      // EXTENSIBLE moves the real format tag into the extension's GUID; its first
      // two bytes are the tag the rest of this function wants.
      if (formatTag === FMT_EXTENSIBLE) {
        if (avail < 26) throw new Error('wav: truncated extensible fmt chunk');
        formatTag = view.getUint16(body + 24, true);
      }
    } else if (id === 'data') {
      dataStart = body;
      dataLen = avail;
      // Keep walking rather than breaking: a `fmt ` chunk after `data` is unusual but
      // legal, and we need both before we can decode either.
    }

    // Chunks are word-aligned: an odd size carries a pad byte that is not counted.
    at = body + size + (size & 1);
    if (at <= body) break; // a size that wrapped - refuse to walk backwards
  }

  if (dataStart < 0) throw new Error('wav: no data chunk');
  if (!channelCount || channelCount > MAX_CHANNELS) throw new Error(`wav: unsupported channel count ${channelCount}`);
  if (!(sampleRate > 0)) throw new Error('wav: invalid sample rate');
  if (formatTag === FMT_MULAW || formatTag === FMT_ALAW) throw new Error('wav: companded (A-law/µ-law) audio is not supported');
  if (formatTag !== FMT_PCM && formatTag !== FMT_FLOAT) {
    throw new Error(`wav: unsupported format tag 0x${formatTag.toString(16)} (only PCM and IEEE float)`);
  }

  const bytesPerSample = bitsPerSample >> 3;
  if (!bytesPerSample || bitsPerSample % 8 !== 0) throw new Error(`wav: unsupported bit depth ${bitsPerSample}`);
  if (formatTag === FMT_FLOAT && bitsPerSample !== 32 && bitsPerSample !== 64) {
    throw new Error(`wav: unsupported float bit depth ${bitsPerSample}`);
  }
  if (formatTag === FMT_PCM && ![8, 16, 24, 32].includes(bitsPerSample)) {
    throw new Error(`wav: unsupported PCM bit depth ${bitsPerSample}`);
  }

  const frameBytes = bytesPerSample * channelCount;
  const frames = Math.floor(dataLen / frameBytes);
  if (frames <= 0) throw new Error('wav: data chunk holds no complete frames');

  const channels: Float32Array[] = [];
  for (let c = 0; c < channelCount; c++) channels.push(new Float32Array(frames));

  const read = sampleReader(view, formatTag, bitsPerSample);
  for (let f = 0; f < frames; f++) {
    const base = dataStart + f * frameBytes;
    for (let c = 0; c < channelCount; c++) channels[c]![f] = read(base + c * bytesPerSample);
  }

  return { channels, sampleRate };
}

/** One sample at a byte offset, normalised to −1..1. */
function sampleReader(view: DataView, tag: number, bits: number): (at: number) => number {
  if (tag === FMT_FLOAT) {
    // Float WAVs are already −1..1 by convention and may legitimately exceed it;
    // pass the value through rather than clamping, so a hot master still reads hot.
    return bits === 64 ? (at) => view.getFloat64(at, true) : (at) => view.getFloat32(at, true);
  }
  switch (bits) {
    // 8-bit PCM is the odd one out: UNSIGNED, with 128 as silence.
    case 8: return (at) => (view.getUint8(at) - 128) / 128;
    case 16: return (at) => view.getInt16(at, true) / 32768;
    case 24: return (at) => {
      // No getInt24: assemble little-endian and sign-extend from bit 23.
      const v = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getUint8(at + 2) << 16);
      return (v & 0x800000 ? v - 0x1000000 : v) / 8388608;
    };
    default: return (at) => view.getInt32(at, true) / 2147483648;
  }
}

/** How `packWav` stores each sample. */
export type WavSampleFormat = 'int16' | 'float32';

export interface PackWavOptions {
  /**
   * `int16` (default): signed 16-bit PCM, what every player reads.
   * `float32`: IEEE float, the lossless path. The pipeline is Float32 throughout,
   * so a "save the audio" export must not quantise unless the caller asks for it.
   */
  format?: WavSampleFormat;
}

/**
 * Encode Float32 channel data as a RIFF/WAVE file. The inverse of `parseWav`:
 * it takes exactly what `parseWav` returns, so `parseWav(packWav(x))` round-trips
 * (bit-exact for `float32`; for `int16`, exact for values already on the 1/32768
 * grid, quantised otherwise).
 *
 * DOM-free and deterministic: same input, same bytes, on every shell.
 *
 * Sample policy:
 *  - `int16` CLIPS. Out-of-range input is clamped to -1..1 before scaling, so a hot
 *    mix distorts the way an int master would rather than wrapping into noise.
 *    Scaling is symmetric (x32768, clamped to 32767), which is what makes the
 *    round-trip exact; the cost is that +1.0 writes 32767, i.e. 0.99997.
 *  - `float32` does NOT clip. Float WAVs may legitimately exceed -1..1 and the
 *    reader passes them through, so the writer must too.
 *
 * A zero-sample buffer produces a valid, complete header with an empty data chunk.
 * `parseWav` will REFUSE to read it back ("no complete frames"). This is deliberate:
 * a silent zero-length decode is a worse answer than an error.
 */
export function packWav(audio: WavAudio, opts: PackWavOptions = {}): Uint8Array {
  const format = opts.format ?? 'int16';
  const channels = audio.channels;
  const channelCount = channels.length;
  if (!channelCount || channelCount > MAX_CHANNELS) throw new Error(`wav: unsupported channel count ${channelCount}`);
  const sampleRate = audio.sampleRate;
  if (!Number.isInteger(sampleRate) || sampleRate <= 0 || sampleRate > 0xffffffff) {
    throw new Error('wav: invalid sample rate');
  }
  const frames = channels[0]!.length;
  for (const ch of channels) {
    if (ch.length !== frames) throw new Error('wav: channels differ in length');
  }

  const float = format === 'float32';
  const bytesPerSample = float ? 4 : 2;
  const blockAlign = bytesPerSample * channelCount;
  const dataLen = frames * blockAlign;
  // Non-PCM WAVE requires an extended fmt chunk (cbSize field => 18 bytes) and a
  // `fact` chunk carrying the sample-frame count. Our own reader doesn't need
  // either, but decoders that follow the spec do, so the float path emits both.
  const fmtLen = float ? 18 : 16;
  const factLen = float ? 12 : 0;
  const headerLen = 12 + 8 + fmtLen + factLen + 8;
  const total = headerLen + dataLen;

  const u8 = new Uint8Array(total);
  const view = new DataView(u8.buffer);
  const put = (at: number, s: string): void => {
    for (let i = 0; i < s.length; i++) u8[at + i] = s.charCodeAt(i);
  };

  // RIFF header (RIFF 1.0, "Multimedia Programming Interface and Data Specifications").
  put(0, 'RIFF');
  view.setUint32(4, total - 8, true); // ckSize: everything AFTER this field, i.e. file - 8
  put(8, 'WAVE');

  // fmt chunk (WAVEFORMATEX).
  let at = 12;
  put(at, 'fmt ');
  view.setUint32(at + 4, fmtLen, true);          // ckSize: 16 for PCM, 18 with cbSize
  view.setUint16(at + 8, float ? FMT_FLOAT : FMT_PCM, true); // wFormatTag
  view.setUint16(at + 10, channelCount, true);   // nChannels
  view.setUint32(at + 12, sampleRate, true);     // nSamplesPerSec
  view.setUint32(at + 16, sampleRate * blockAlign, true); // nAvgBytesPerSec
  view.setUint16(at + 20, blockAlign, true);     // nBlockAlign: bytes per frame
  view.setUint16(at + 22, bytesPerSample * 8, true); // wBitsPerSample
  if (float) view.setUint16(at + 24, 0, true);   // cbSize: no extension follows
  at += 8 + fmtLen;

  // fact chunk - required for non-PCM; dwSampleLength is frames per channel.
  if (float) {
    put(at, 'fact');
    view.setUint32(at + 4, 4, true);
    view.setUint32(at + 8, frames, true);
    at += factLen;
  }

  // data chunk: frames interleaved, channel order as given.
  put(at, 'data');
  view.setUint32(at + 4, dataLen, true);
  const dataStart = at + 8;

  for (let c = 0; c < channelCount; c++) {
    const src = channels[c]!;
    let off = dataStart + c * bytesPerSample;
    for (let f = 0; f < frames; f++, off += blockAlign) {
      const s = src[f] as number;
      if (float) view.setFloat32(off, s, true);
      else view.setInt16(off, toInt16(s), true);
    }
  }

  return u8;
}

/** −1..1 float to signed 16-bit, clipped. Non-finite input becomes silence. */
function toInt16(s: number): number {
  if (!Number.isFinite(s)) return 0;
  const v = Math.round((s > 1 ? 1 : s < -1 ? -1 : s) * 32768);
  return v > 32767 ? 32767 : v;
}

function str(u8: Uint8Array, at: number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(u8[at + i] ?? 0);
  return s;
}
