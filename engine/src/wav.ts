// SPDX-License-Identifier: MPL-2.0
/**
 * WAV reader — RIFF bytes in, Float32 channel data out.
 *
 * Exists so `host.audio` has a decoder that needs no platform codec at all. The web
 * shell hands its audio to `decodeAudioData` and gets MP3/AAC/Opus for free; Node
 * has none of that, so the headless path (CLI, TUI, batch renders) can decode
 * exactly two things without dependencies: a WAV file, and a ZzFXM song it renders
 * itself. That is enough for the cases that matter headlessly — our own generated
 * music, and any clip a user is willing to hand over uncompressed.
 *
 * Supports the PCM forms that actually turn up: 8-bit unsigned, 16/24/32-bit signed
 * integer, and 32/64-bit IEEE float, including inside a `WAVE_FORMAT_EXTENSIBLE`
 * wrapper. Anything else (µ-law, ADPCM, a compressed payload in a RIFF skin) is
 * REFUSED by name rather than misread as PCM — reading an unknown encoding as
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

/** A sane ceiling on channel count — a malformed header claiming 65,535 channels
 *  would otherwise have us allocate 65,535 arrays before discovering there's no data. */
const MAX_CHANNELS = 32;

export interface WavAudio {
  /** One Float32Array per channel, samples in −1..1. */
  channels: Float32Array[];
  /** Sample rate in Hz, as declared by the file. */
  sampleRate: number;
}

/**
 * Decode a WAV file. Throws with a specific reason on anything it cannot read —
 * callers surface that to the user, so "24-bit ADPCM" is a better message than a
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
    if (at <= body) break; // a size that wrapped — refuse to walk backwards
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
      // No getInt24 — assemble little-endian and sign-extend from bit 23.
      const v = view.getUint8(at) | (view.getUint8(at + 1) << 8) | (view.getUint8(at + 2) << 16);
      return (v & 0x800000 ? v - 0x1000000 : v) / 8388608;
    };
    default: return (at) => view.getInt32(at, true) / 2147483648;
  }
}

function str(u8: Uint8Array, at: number, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(u8[at + i] ?? 0);
  return s;
}
