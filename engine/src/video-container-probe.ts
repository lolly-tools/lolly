// SPDX-License-Identifier: MPL-2.0
/**
 * Video container probe: says what a MOV, MP4 or MXF file holds without decoding
 * a single frame.
 *
 * It reads container structure only: the sample description of each track in an
 * ISO base media / QuickTime movie (ISO/IEC 14496-12, with the QuickTime file
 * format for the `tmcd` timecode track), and the header metadata of an MXF file
 * (SMPTE ST 377-1, with the OP1a and OP-Atom operational patterns). What comes
 * out is the codec family and profile, the frame size, the frame rate, the start
 * timecode and each audio track's codec, channels and sample rate.
 *
 * Why it exists: Lolly ships no codec implementation from a patent pool (ProRes,
 * DNx/VC-3, H.264, HEVC, AAC, AC-3). Identifying the codec is container structure and
 * carries no codec patent, so the app can say what a file holds and whether the
 * device's own licensed decoder can open it (see shells/web/src/lib/video-device-check.ts).
 * Nothing here decodes, and the table entries are published identifiers: sample
 * entry codes, MXF universal labels and the record fields the specifications name.
 *
 * Untrusted input. The source is read through `read(offset, length)` and every
 * read is bounded: a top-level box walk of at most MAX_TOP_BOXES boxes, a movie
 * box of at most MAX_MOOV_BYTES, an MXF header of at most MAX_MXF_HEADER_BYTES,
 * at most MAX_TRACKS tracks, and descriptor trees that cannot revisit a set. A
 * file that is recognisably a MOV, MP4 or MXF but is truncated or self-
 * contradictory throws a VideoProbeError with a code; bytes that are none of the
 * three answer null.
 */

/** Why a recognised container was refused. */
export type VideoProbeErrorCode = 'truncated' | 'malformed' | 'too-large';

export class VideoProbeError extends Error {
  readonly code: VideoProbeErrorCode;
  constructor(code: VideoProbeErrorCode, message: string) {
    super(message);
    this.name = 'VideoProbeError';
    this.code = code;
  }
}

/** Where the probe reads from. `read` may return fewer bytes only at the end of the source. */
export interface ProbeSource {
  size: number;
  read(offset: number, length: number): Promise<Uint8Array>;
}

/** A source over bytes already in memory (tests, the fuzz target, small files). */
export function bytesProbeSource(bytes: Uint8Array): ProbeSource {
  return {
    size: bytes.length,
    read: async (offset, length) => bytes.subarray(Math.max(0, offset), Math.min(bytes.length, offset + Math.max(0, length))),
  };
}

export type ProbedContainer = 'mov' | 'mp4' | 'mxf';

export type VideoFamily =
  | 'prores' | 'dnx' | 'h264' | 'hevc' | 'av1' | 'vp9' | 'vp8'
  | 'mpeg2' | 'mpeg4' | 'jpeg2000' | 'dv' | 'mjpeg' | 'uncompressed' | 'other';

export interface ProbedVideoTrack {
  family: VideoFamily;
  /** Plain name with the profile, such as "Apple ProRes 422 HQ". */
  label: string;
  /** The profile alone ("422 HQ", "High", "DNxHR HQ"), when the container gives one. */
  profile: string | null;
  /** The sample entry code (MOV/MP4) or the universal label in hex (MXF). */
  identifier: string;
  /** The string for VideoDecoder.isConfigSupported, or null when no registered form exists. */
  webcodecs: string | null;
  width: number;
  height: number;
  /** Frames per second, or null when the container does not give a usable rate. */
  frameRate: number | null;
  /** Bits per component, when the container gives a value. */
  bitDepth: number | null;
  /** True for the codecs Lolly never implements itself (ProRes, DNx, H.264, HEVC). */
  patentPool: boolean;
}

export interface ProbedAudioTrack {
  codec: string;
  label: string;
  identifier: string;
  /** The string for AudioDecoder.isConfigSupported, or null when no registered form exists. */
  webcodecs: string | null;
  channels: number | null;
  sampleRate: number | null;
  bitDepth: number | null;
  /** True for AAC and AC-3, null when the container does not say enough to tell. */
  patentPool: boolean | null;
}

export interface ContainerProbe {
  container: ProbedContainer;
  /** The ftyp major brand (MOV/MP4) or the operational pattern name (MXF). */
  brand: string | null;
  durationSeconds: number | null;
  /** Start timecode as HH:MM:SS:FF, with a semicolon before the frames when drop-frame. */
  timecode: string | null;
  video: ProbedVideoTrack[];
  audio: ProbedAudioTrack[];
}

/** Bounds. */
export const MAX_TOP_BOXES = 4096;
export const MAX_MOOV_BYTES = 32 * 1024 * 1024;
export const MAX_MXF_HEADER_BYTES = 16 * 1024 * 1024;
export const MAX_TRACKS = 64;
const MAX_CHILD_BOXES = 100_000;
const MAX_TIMING_ENTRIES = 1 << 20;
const MXF_RUN_IN = 65_536;
const MAX_KLV_ITEMS = 200_000;

// ── byte helpers ────────────────────────────────────────────────────────────

const fail = (code: VideoProbeErrorCode, message: string): never => { throw new VideoProbeError(code, message); };

function u16(b: Uint8Array, o: number): number {
  if (o < 0 || o + 2 > b.length) fail('truncated', 'read past the end');
  return (b[o]! << 8) | b[o + 1]!;
}
function u32(b: Uint8Array, o: number): number {
  if (o < 0 || o + 4 > b.length) fail('truncated', 'read past the end');
  return ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;
}
function i32(b: Uint8Array, o: number): number { return u32(b, o) | 0; }
/** A 64-bit value as a number; refuses anything above 2^53 rather than rounding. */
function u64(b: Uint8Array, o: number): number {
  const hi = u32(b, o);
  const lo = u32(b, o + 4);
  if (hi >= 0x200000) fail('malformed', 'a 64-bit value is too large');
  return hi * 4294967296 + lo;
}
function i64(b: Uint8Array, o: number): number {
  const hi = i32(b, o);
  const lo = u32(b, o + 4);
  if (hi >= 0x200000 || hi < -0x200000) fail('malformed', 'a 64-bit value is too large');
  return hi * 4294967296 + lo;
}
function fourcc(b: Uint8Array, o: number): string {
  if (o < 0 || o + 4 > b.length) fail('truncated', 'read past the end');
  return String.fromCharCode(b[o]!, b[o + 1]!, b[o + 2]!, b[o + 3]!);
}
const hex = (b: Uint8Array, from = 0, to = b.length): string =>
  Array.from(b.subarray(from, to), (x) => x.toString(16).padStart(2, '0')).join('');

async function readAt(src: ProbeSource, offset: number, length: number, cap: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0) fail('malformed', 'a read outside the file');
  if (length > cap) fail('too-large', 'a section is larger than the probe reads');
  if (offset + length > src.size) fail('truncated', 'a section runs past the end of the file');
  const out = await src.read(offset, length);
  if (out.length < length) fail('truncated', 'the file ended early');
  return out.subarray(0, length);
}

// ── timecode ────────────────────────────────────────────────────────────────

/** Frame count to HH:MM:SS:FF. Drop-frame skips two (30) or four (60) frame numbers a minute, except every tenth minute. */
export function formatTimecode(frames: number, base: number, dropFrame: boolean): string | null {
  if (!Number.isFinite(frames) || !Number.isInteger(base) || base < 1 || base > 120) return null;
  let n = Math.trunc(frames);
  if (n < 0) return null;
  if (dropFrame && (base === 30 || base === 60)) {
    const drop = base === 30 ? 2 : 4;
    const perMinute = base * 60 - drop;
    const perTenMinutes = base * 600 - drop * 9;
    const tens = Math.floor(n / perTenMinutes);
    const rest = n % perTenMinutes;
    n += drop * 9 * tens;
    if (rest >= drop) n += drop * Math.floor((rest - drop) / perMinute);
  }
  const ff = n % base;
  const total = Math.floor(n / base);
  const pad = (v: number): string => String(v).padStart(2, '0');
  const hh = Math.floor(total / 3600) % 24;
  return `${pad(hh)}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}${dropFrame ? ';' : ':'}${pad(ff)}`;
}

// ── ISO base media / QuickTime ──────────────────────────────────────────────

interface Box { type: string; payload: number; end: number }

/** Child boxes of `buf[from, to)`. A size of 0 runs to the parent end; a size of 1 reads a 64-bit size. */
function childBoxes(buf: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let o = from;
  while (o + 8 <= to) {
    if (out.length >= MAX_CHILD_BOXES) fail('too-large', 'too many boxes');
    let size = u32(buf, o);
    const type = fourcc(buf, o + 4);
    let head = 8;
    if (size === 1) { size = u64(buf, o + 8); head = 16; }
    else if (size === 0) size = to - o;
    if (size < head || o + size > to) fail('malformed', `box ${type} has an impossible size`);
    out.push({ type, payload: o + head, end: o + size });
    o += size;
  }
  return out;
}
const find = (boxes: Box[], type: string): Box | undefined => boxes.find((b) => b.type === type);

interface VisualEntry { code: string; width: number; height: number; depth: number; kids: Box[]; buf: Uint8Array }

const PRORES_PROFILES: Record<string, string> = {
  apco: 'Proxy', apcs: 'LT', apcn: '422', apch: '422 HQ', ap4h: '4444', ap4x: '4444 XQ',
};

function dnxHrProfile(cid: number): string | null {
  switch (cid) {
    case 1270: return 'DNxHR 444';
    case 1271: return 'DNxHR HQX';
    case 1272: return 'DNxHR HQ';
    case 1273: return 'DNxHR SQ';
    case 1274: return 'DNxHR LB';
    default: return null;
  }
}

const track = (
  family: VideoFamily, label: string, profile: string | null, identifier: string, webcodecs: string | null,
  extra: Partial<ProbedVideoTrack> = {},
): ProbedVideoTrack => ({
  family, label, profile, identifier, webcodecs, width: 0, height: 0, frameRate: null, bitDepth: null,
  patentPool: family === 'prores' || family === 'dnx' || family === 'h264' || family === 'hevc', ...extra,
});

const hexByte = (n: number): string => n.toString(16).toUpperCase().padStart(2, '0');

/** AVCDecoderConfigurationRecord: profile, compatibility and level bytes give the avc1 string. */
function avcString(prefix: string, rec: Uint8Array): { webcodecs: string | null; profile: string | null; depth: number | null } {
  if (rec.length < 4) return { webcodecs: null, profile: null, depth: null };
  const idc = rec[1]!;
  const names: Record<number, string> = { 66: 'Baseline', 77: 'Main', 88: 'Extended', 100: 'High', 110: 'High 10', 122: 'High 4:2:2', 244: 'High 4:4:4' };
  const depth = idc === 100 || idc === 77 || idc === 66 || idc === 88 ? 8 : idc === 110 || idc === 122 || idc === 244 ? null : null;
  return { webcodecs: `${prefix}.${hexByte(idc)}${hexByte(rec[2]!)}${hexByte(rec[3]!)}`, profile: names[idc] ?? null, depth };
}

/** HEVCDecoderConfigurationRecord to the hvc1.* string of ISO/IEC 14496-15 annex E. */
function hevcString(prefix: string, rec: Uint8Array): { webcodecs: string | null; profile: string | null; depth: number | null } {
  if (rec.length < 13) return { webcodecs: null, profile: null, depth: null };
  const space = (rec[1]! >> 6) & 3;
  const tier = (rec[1]! >> 5) & 1;
  const idc = rec[1]! & 31;
  let compat = u32(rec, 2);
  let reversed = 0;
  for (let i = 0; i < 32; i++) { reversed = ((reversed << 1) | (compat & 1)) >>> 0; compat >>>= 1; }
  const constraint = Array.from(rec.subarray(6, 12));
  while (constraint.length > 1 && constraint[constraint.length - 1] === 0) constraint.pop();
  const letter = ['', 'A', 'B', 'C'][space]!;
  const str = `${prefix}.${letter}${idc}.${reversed.toString(16).toUpperCase()}.${tier ? 'H' : 'L'}${rec[12]!}.${constraint.map((x) => x.toString(16).toUpperCase()).join('.')}`;
  const names: Record<number, string> = { 1: 'Main', 2: 'Main 10', 3: 'Main Still Picture', 4: 'Range Extensions' };
  return { webcodecs: str, profile: names[idc] ?? null, depth: rec.length > 17 ? (rec[17]! & 7) + 8 : null };
}

/** av1C: seq_profile, level and tier, then the bit-depth flags. */
function av1String(rec: Uint8Array): { webcodecs: string | null; profile: string | null; depth: number | null } {
  if (rec.length < 4) return { webcodecs: null, profile: null, depth: null };
  const profile = rec[1]! >> 5;
  const level = rec[1]! & 31;
  const tier = rec[2]! >> 7;
  const high = (rec[2]! >> 6) & 1;
  const twelve = (rec[2]! >> 5) & 1;
  const depth = profile === 2 && twelve ? 12 : high ? 10 : 8;
  const names = ['Main', 'High', 'Professional'];
  return {
    webcodecs: `av01.${profile}.${String(level).padStart(2, '0')}${tier ? 'H' : 'M'}.${String(depth).padStart(2, '0')}`,
    profile: names[profile] ?? null,
    depth,
  };
}

/** vpcC (full box): profile, level and bit depth. */
function vp9String(rec: Uint8Array): { webcodecs: string | null; profile: string | null; depth: number | null } {
  if (rec.length < 8) return { webcodecs: null, profile: null, depth: null };
  const profile = rec[4]!;
  const level = rec[5]!;
  const depth = rec[6]! >> 4;
  const pad = (v: number): string => String(v).padStart(2, '0');
  return { webcodecs: `vp09.${pad(profile)}.${pad(level)}.${pad(depth)}`, profile: `Profile ${profile}`, depth };
}

function describeVisual(e: VisualEntry): ProbedVideoTrack {
  const rec = (type: string): Uint8Array | null => {
    const b = find(e.kids, type);
    return b ? e.buf.subarray(b.payload, b.end) : null;
  };
  const size = { width: e.width, height: e.height };
  const code = e.code;
  const lower = code.toLowerCase();
  if (PRORES_PROFILES[lower]) {
    const profile = PRORES_PROFILES[lower]!;
    return track('prores', `Apple ProRes ${profile}`, profile, code, lower, size);
  }
  if (code === 'AVdn' || code === 'AVdh' || code === 'AVd1') {
    return track('dnx', code === 'AVdh' ? 'Avid DNxHR' : 'Avid DNxHD or DNxHR', null, code, null, size);
  }
  switch (lower) {
    case 'avc1': case 'avc3': {
      const a = avcString(lower, rec('avcC') ?? new Uint8Array(0));
      return track('h264', a.profile ? `H.264 ${a.profile}` : 'H.264', a.profile, code, a.webcodecs, { ...size, bitDepth: a.depth });
    }
    case 'hvc1': case 'hev1': case 'dvh1': case 'dvhe': {
      const h = hevcString(lower.startsWith('dv') ? 'hvc1' : lower, rec('hvcC') ?? new Uint8Array(0));
      const dv = lower.startsWith('dv');
      return track('hevc', dv ? 'HEVC (Dolby Vision)' : h.profile ? `HEVC ${h.profile}` : 'HEVC', h.profile, code, h.webcodecs, { ...size, bitDepth: h.depth });
    }
    case 'av01': {
      const a = av1String(rec('av1C') ?? new Uint8Array(0));
      return track('av1', a.profile ? `AV1 ${a.profile}` : 'AV1', a.profile, code, a.webcodecs, { ...size, bitDepth: a.depth });
    }
    case 'vp09': {
      const v = vp9String(rec('vpcC') ?? new Uint8Array(0));
      return track('vp9', 'VP9', v.profile, code, v.webcodecs, { ...size, bitDepth: v.depth });
    }
    case 'vp08': return track('vp8', 'VP8', null, code, 'vp8', size);
    case 'mp4v': return track('mpeg4', 'MPEG-4 Visual', null, code, null, size);
    case 'mpg2': case 'mx5n': case 'mx5p': case 'mx4n': case 'mx4p': case 'mx3n': case 'mx3p': case 'xdv1': case 'xdv2':
    case 'xdv3': case 'xdv4': case 'xdv5': case 'xdv6': case 'xdv7': case 'xdv8': case 'xdv9': case 'xdva': case 'xdvb':
    case 'xdvc': case 'xdvd': case 'xdve': case 'xdvf': case 'hdv1': case 'hdv2': case 'hdv3':
      return track('mpeg2', 'MPEG-2 video', null, code, null, size);
    case 'mjp2': return track('jpeg2000', 'JPEG 2000', null, code, null, size);
    case 'jpeg': case 'mjpa': case 'mjpb': return track('mjpeg', 'Motion JPEG', null, code, null, size);
    case 'dvc ': case 'dvcp': case 'dvpp': case 'dv5n': case 'dv5p': case 'dvhq': case 'dvh5': case 'dvh6': case 'dvh3': case 'dvh1_':
      return track('dv', 'DV', null, code, null, size);
    case 'raw ': case '2vuy': case 'yuv2': case 'v210': case 'v308': case 'v408': case 'r210': case 'rle ':
      return track('uncompressed', 'Uncompressed video', null, code, null, size);
    default:
      return track('other', `Video (${code.trim()})`, null, code, null, size);
  }
}

/** Frame rate from the time-to-sample table: samples over summed durations, times the media timescale. */
function rateFromStts(buf: Uint8Array, stts: Box, timescale: number): number | null {
  if (timescale <= 0 || stts.end - stts.payload < 8) return null;
  const n = Math.min(u32(buf, stts.payload + 4), MAX_TIMING_ENTRIES, Math.floor((stts.end - stts.payload - 8) / 8));
  let count = 0;
  let ticks = 0;
  for (let i = 0; i < n; i++) {
    const c = u32(buf, stts.payload + 8 + i * 8);
    const d = u32(buf, stts.payload + 12 + i * 8);
    count += c;
    ticks += c * d;
  }
  if (count < 2 || ticks <= 0) return null;
  const rate = (timescale * count) / ticks;
  return Number.isFinite(rate) && rate > 0 && rate < 1000 ? Math.round(rate * 1000) / 1000 : null;
}

interface MovTrack {
  kind: 'vide' | 'soun' | 'tmcd' | 'other';
  timescale: number;
  duration: number;
  video?: ProbedVideoTrack;
  audio?: ProbedAudioTrack;
  tmcd?: { flags: number; base: number; sampleOffset: number | null };
}

function esdsInfo(rec: Uint8Array): { oti: number; aot: number | null } | null {
  // Full box (4 bytes), then descriptors: tag, variable-length size. Tag 3 holds tag 4, which holds tag 5.
  let o = 4;
  const readLen = (): number | null => {
    let len = 0;
    for (let i = 0; i < 4; i++) {
      if (o >= rec.length) return null;
      const b = rec[o++]!;
      len = (len << 7) | (b & 0x7f);
      if (!(b & 0x80)) return len;
    }
    return null;
  };
  if (rec[o] !== 0x03) return null;
  o++;
  if (readLen() === null) return null;
  o += 2;
  const flags = rec[o++] ?? 0;
  if (flags & 0x80) o += 2;
  if (flags & 0x40) o += 1 + (rec[o] ?? 0);
  if (flags & 0x20) o += 2;
  if (rec[o] !== 0x04) return null;
  o++;
  if (readLen() === null) return null;
  const oti = rec[o];
  if (oti === undefined) return null;
  o += 13;
  let aot: number | null = null;
  if (rec[o] === 0x05) {
    o++;
    const len = readLen();
    if (len !== null && len >= 1 && o < rec.length) {
      aot = rec[o]! >> 3;
      if (aot === 31 && o + 1 < rec.length) aot = 32 + (((rec[o]! & 7) << 3) | (rec[o + 1]! >> 5));
    }
  }
  return { oti, aot };
}

function describeAudio(code: string, channels: number, rate: number, bits: number, rec: (t: string) => Uint8Array | null): ProbedAudioTrack {
  const base = { identifier: code, channels: channels > 0 && channels <= 255 ? channels : null, sampleRate: rate > 0 ? rate : null };
  const depth = bits > 0 && bits <= 64 ? bits : null;
  switch (code) {
    case 'mp4a': {
      const info = esdsInfo(rec('esds') ?? new Uint8Array(0));
      if (info && info.oti === 0x40) {
        const aot = info.aot ?? 2;
        return { ...base, codec: 'aac', label: 'AAC', webcodecs: `mp4a.40.${aot}`, bitDepth: null, patentPool: true };
      }
      if (info && (info.oti === 0x69 || info.oti === 0x6b)) {
        return { ...base, codec: 'mp3', label: 'MP3', webcodecs: 'mp3', bitDepth: null, patentPool: false };
      }
      return { ...base, codec: 'mpeg4-audio', label: 'MPEG-4 audio', webcodecs: null, bitDepth: null, patentPool: null };
    }
    case 'ac-3': return { ...base, codec: 'ac3', label: 'Dolby Digital (AC-3)', webcodecs: 'ac-3', bitDepth: null, patentPool: true };
    case 'ec-3': return { ...base, codec: 'eac3', label: 'Dolby Digital Plus', webcodecs: 'ec-3', bitDepth: null, patentPool: true };
    case 'alac': return { ...base, codec: 'alac', label: 'Apple Lossless', webcodecs: 'alac', bitDepth: null, patentPool: false };
    case 'Opus': return { ...base, codec: 'opus', label: 'Opus', webcodecs: 'opus', bitDepth: null, patentPool: false };
    case 'fLaC': return { ...base, codec: 'flac', label: 'FLAC', webcodecs: 'flac', bitDepth: depth, patentPool: false };
    case 'sowt': return { ...base, codec: 'pcm', label: 'PCM', webcodecs: depth === 16 ? 'pcm-s16' : null, bitDepth: depth, patentPool: false };
    case 'twos': case 'in24': case 'in32': case 'fl32': case 'fl64': case 'lpcm': case 'ipcm': case 'fpcm': case 'raw ':
      return { ...base, codec: 'pcm', label: 'PCM', webcodecs: null, bitDepth: depth, patentPool: false };
    case 'ulaw': return { ...base, codec: 'ulaw', label: 'u-law', webcodecs: 'ulaw', bitDepth: null, patentPool: false };
    case 'alaw': return { ...base, codec: 'alaw', label: 'A-law', webcodecs: 'alaw', bitDepth: null, patentPool: false };
    default: return { ...base, codec: code.trim().toLowerCase() || 'unknown', label: `Audio (${code.trim()})`, webcodecs: null, bitDepth: null, patentPool: null };
  }
}

function parseTrak(buf: Uint8Array, trak: Box): MovTrack | null {
  const kids = childBoxes(buf, trak.payload, trak.end);
  const mdia = find(kids, 'mdia');
  if (!mdia) return null;
  const m = childBoxes(buf, mdia.payload, mdia.end);
  const hdlr = find(m, 'hdlr');
  const mdhd = find(m, 'mdhd');
  const minf = find(m, 'minf');
  if (!hdlr || !mdhd || !minf) return null;
  const handler = hdlr.end - hdlr.payload >= 12 ? fourcc(buf, hdlr.payload + 8) : '';
  const kind = handler === 'vide' ? 'vide' : handler === 'soun' ? 'soun' : handler === 'tmcd' ? 'tmcd' : 'other';
  if (kind === 'other') return null;
  const version = buf[mdhd.payload]!;
  const timescale = version === 1 ? u32(buf, mdhd.payload + 20) : u32(buf, mdhd.payload + 12);
  const duration = version === 1 ? u64(buf, mdhd.payload + 24) : u32(buf, mdhd.payload + 16);
  const stbl = find(childBoxes(buf, minf.payload, minf.end), 'stbl');
  if (!stbl) return null;
  const st = childBoxes(buf, stbl.payload, stbl.end);
  const stsd = find(st, 'stsd');
  if (!stsd || stsd.end - stsd.payload < 16) return null;
  // First sample entry only: size, type, then the entry body.
  const entryStart = stsd.payload + 8;
  const entrySize = u32(buf, entryStart);
  const code = fourcc(buf, entryStart + 4);
  if (entrySize < 16 || entryStart + entrySize > stsd.end) fail('malformed', 'a sample entry runs past its box');
  const body = entryStart + 8;
  const entryEnd = entryStart + entrySize;
  const out: MovTrack = { kind, timescale, duration };

  if (kind === 'vide') {
    if (entryEnd - body < 78) fail('malformed', 'a video sample entry is too short');
    const entry: VisualEntry = {
      code, buf, width: u16(buf, body + 24), height: u16(buf, body + 26), depth: u16(buf, body + 74),
      kids: childBoxes(buf, body + 78, entryEnd),
    };
    const described = describeVisual(entry);
    const stts = find(st, 'stts');
    described.frameRate = stts ? rateFromStts(buf, stts, timescale) : null;
    out.video = described;
  } else if (kind === 'soun') {
    if (entryEnd - body < 28) fail('malformed', 'an audio sample entry is too short');
    const ver = u16(buf, body + 8);
    let kidsFrom = body + 28;
    let channels = u16(buf, body + 16);
    let bits = u16(buf, body + 18);
    let rate = u32(buf, body + 24) / 65536;
    if (ver === 1) kidsFrom = body + 44;
    else if (ver === 2) {
      kidsFrom = body + 72;
      if (entryEnd - body >= 72) {
        const view = new DataView(buf.buffer, buf.byteOffset + body + 32, 8);
        rate = view.getFloat64(0, false);
        channels = u32(buf, body + 40);
        bits = u32(buf, body + 48);
      }
    }
    if (kidsFrom > entryEnd) fail('malformed', 'an audio sample entry is too short');
    // QuickTime v0/v1 audio may nest its codec boxes in a `wave` box.
    let kids = childBoxes(buf, kidsFrom, entryEnd);
    const wave = find(kids, 'wave');
    if (wave) kids = kids.concat(childBoxes(buf, wave.payload, wave.end));
    const getRec = (t: string): Uint8Array | null => { const b = find(kids, t); return b ? buf.subarray(b.payload, b.end) : null; };
    out.audio = describeAudio(code, channels, Number.isFinite(rate) ? Math.round(rate) : 0, bits, getRec);
  } else if (code === 'tmcd' && entryEnd - body >= 26) {
    const flags = u32(buf, body + 12);
    const base = buf[body + 24]!;
    const stco = find(st, 'stco');
    const co64 = find(st, 'co64');
    let sampleOffset: number | null = null;
    if (stco && stco.end - stco.payload >= 12 && u32(buf, stco.payload + 4) > 0) sampleOffset = u32(buf, stco.payload + 8);
    else if (co64 && co64.end - co64.payload >= 16 && u32(buf, co64.payload + 4) > 0) sampleOffset = u64(buf, co64.payload + 8);
    out.tmcd = { flags, base, sampleOffset };
  }
  return out;
}

async function probeIsoBmff(src: ProbeSource): Promise<ContainerProbe | null> {
  let offset = 0;
  let brand: string | null = null;
  let moov: { start: number; size: number } | null = null;
  let seen = 0;
  while (offset + 8 <= src.size && seen < MAX_TOP_BOXES) {
    const head = await readAt(src, offset, Math.min(16, src.size - offset), 16);
    let size = u32(head, 0);
    const type = fourcc(head, 4);
    let hdr = 8;
    if (size === 1) {
      if (head.length < 16) fail('truncated', 'a box header is cut short');
      size = u64(head, 8);
      hdr = 16;
    } else if (size === 0) size = src.size - offset;
    if (seen === 0 && !['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot', 'uuid', 'styp'].includes(type)) return null;
    if (size < hdr || offset + size > src.size) fail('malformed', `box ${type} has an impossible size`);
    if (type === 'ftyp') {
      const f = await readAt(src, offset + hdr, Math.min(size - hdr, 8), 8);
      if (f.length >= 4) brand = fourcc(f, 0);
    } else if (type === 'moov') {
      moov = { start: offset + hdr, size: size - hdr };
      break;
    }
    seen++;
    offset += size;
  }
  if (!moov) {
    if (seen === 0) return null;
    return fail('malformed', 'no movie box');
  }
  const buf = await readAt(src, moov.start, moov.size, MAX_MOOV_BYTES);
  const top = childBoxes(buf, 0, buf.length);
  const mvhd = find(top, 'mvhd');
  let movieDuration: number | null = null;
  if (mvhd && mvhd.end - mvhd.payload >= 20) {
    const v1 = buf[mvhd.payload] === 1;
    const scale = v1 ? u32(buf, mvhd.payload + 20) : u32(buf, mvhd.payload + 12);
    const dur = v1 ? u64(buf, mvhd.payload + 24) : u32(buf, mvhd.payload + 16);
    if (scale > 0 && dur > 0 && dur < 0xffffffff) movieDuration = dur / scale;
  }
  const video: ProbedVideoTrack[] = [];
  const audio: ProbedAudioTrack[] = [];
  let tmcd: MovTrack['tmcd'] | undefined;
  let tracks = 0;
  for (const trak of top.filter((b) => b.type === 'trak')) {
    if (++tracks > MAX_TRACKS) fail('too-large', 'too many tracks');
    const t = parseTrak(buf, trak);
    if (!t) continue;
    if (t.video) video.push(t.video);
    else if (t.audio) audio.push(t.audio);
    else if (t.tmcd && !tmcd) tmcd = t.tmcd;
  }
  let timecode: string | null = null;
  if (tmcd && tmcd.sampleOffset !== null && tmcd.sampleOffset + 4 <= src.size) {
    const s = await readAt(src, tmcd.sampleOffset, 4, 4);
    timecode = formatTimecode(u32(s, 0), tmcd.base, (tmcd.flags & 1) === 1);
  }
  const isMov = brand === 'qt  ';
  return {
    container: isMov ? 'mov' : 'mp4',
    brand: brand ? brand.trim() : null,
    durationSeconds: movieDuration,
    timecode,
    video,
    audio,
  };
}

// ── MXF (SMPTE ST 377-1) ────────────────────────────────────────────────────

const MXF_PREFIX = [0x06, 0x0e, 0x2b, 0x34];
const PARTITION_KEY = [0x06, 0x0e, 0x2b, 0x34, 0x02, 0x05, 0x01, 0x01, 0x0d, 0x01, 0x02, 0x01, 0x01];

const hasPrefix = (b: Uint8Array, at: number, prefix: number[]): boolean => {
  if (at < 0 || at + prefix.length > b.length) return false;
  for (let i = 0; i < prefix.length; i++) if (b[at + i] !== prefix[i]) return false;
  return true;
};

/** BER length: short form, or 0x80+n followed by n bytes. */
function berLength(b: Uint8Array, o: number): { len: number; size: number } {
  const first = b[o];
  if (first === undefined) return fail('truncated', 'a length is cut short');
  if (first < 0x80) return { len: first, size: 1 };
  const n = first & 0x7f;
  if (n === 0 || n > 8) return fail('malformed', 'an unsupported length form');
  if (o + 1 + n > b.length) return fail('truncated', 'a length is cut short');
  let len = 0;
  for (let i = 0; i < n; i++) {
    len = len * 256 + b[o + 1 + i]!;
    if (len > Number.MAX_SAFE_INTEGER / 256) fail('malformed', 'a length is too large');
  }
  return { len, size: 1 + n };
}

interface Klv { key: Uint8Array; value: number; length: number; next: number }

/** One KLV triplet at `o` inside `buf`. */
function klvAt(buf: Uint8Array, o: number): Klv {
  if (o + 17 > buf.length) fail('truncated', 'a KLV key is cut short');
  const key = buf.subarray(o, o + 16);
  const { len, size } = berLength(buf, o + 16);
  const value = o + 16 + size;
  if (value + len > buf.length) fail('truncated', 'a KLV value runs past the end');
  return { key, value, length: len, next: value + len };
}

interface MxfSet { kind: number; uid: string; props: Map<number, Uint8Array> }

function parseLocalSet(buf: Uint8Array, start: number, length: number, kind: number): MxfSet {
  const props = new Map<number, Uint8Array>();
  let uid = '';
  let o = start;
  const end = start + length;
  while (o + 4 <= end) {
    const tag = u16(buf, o);
    const len = u16(buf, o + 2);
    if (o + 4 + len > end) fail('malformed', 'a local tag runs past its set');
    const value = buf.subarray(o + 4, o + 4 + len);
    if (tag === 0x3c0a && len === 16) uid = hex(value);
    else if (!props.has(tag)) props.set(tag, value);
    o += 4 + len;
  }
  return { kind, uid, props };
}

const propU = (s: MxfSet, tag: number): number | null => {
  const v = s.props.get(tag);
  if (!v) return null;
  if (v.length === 1) return v[0]!;
  if (v.length === 2) return u16(v, 0);
  if (v.length === 4) return u32(v, 0);
  if (v.length === 8) return u64(v, 0);
  return null;
};
const propI64 = (s: MxfSet, tag: number): number | null => { const v = s.props.get(tag); return v && v.length === 8 ? i64(v, 0) : null; };
const propRational = (s: MxfSet, tag: number): number | null => {
  const v = s.props.get(tag);
  if (v?.length !== 8) return null;
  const num = i32(v, 0);
  const den = i32(v, 4);
  return num > 0 && den > 0 ? num / den : null;
};
const propUl = (s: MxfSet, tag: number): Uint8Array | null => { const v = s.props.get(tag); return v?.length === 16 ? v : null; };

const SET_PICTURE = new Set([0x27, 0x28, 0x29, 0x51]);
const SET_SOUND = new Set([0x42, 0x47, 0x48]);

/** Decode a picture essence coding label (a universal label) into a video track. */
function mxfPicture(coding: Uint8Array | null, container: Uint8Array | null): ProbedVideoTrack {
  const id = coding ? hex(coding) : container ? hex(container) : 'none';
  if (coding && hasPrefix(coding, 0, MXF_PREFIX)) {
    // Bytes 8..11 select the registry branch; 12 onward are the coding family.
    const isPicture = coding[8] === 0x04 && coding[9] === 0x01 && coding[10] === 0x02;
    if (isPicture && coding[11] === 0x02 && coding[12] === 0x71) {
      const cid = coding[13]! > 0 ? 1234 + coding[13]! : 0;
      const hr = dnxHrProfile(cid);
      const profile = hr ?? (cid ? `DNxHD CID ${cid}` : null);
      return track('dnx', profile ? `Avid ${profile}` : 'Avid DNxHD or DNxHR', profile, id, null);
    }
    if (isPicture && coding[11] === 0x02 && coding[12] === 0x03 && coding[13] === 0x06) {
      const names = ['', 'Proxy', 'LT', '422', '422 HQ', '4444', '4444 XQ'];
      const p = names[coding[14]!] || null;
      return track('prores', p ? `Apple ProRes ${p}` : 'Apple ProRes', p, id, null);
    }
    if (isPicture && coding[11] === 0x02 && coding[12] === 0x01 && (coding[13] === 0x31 || coding[13] === 0x32)) {
      const names = ['', 'Baseline', 'Main', 'Extended', 'High', 'High 10', 'High 4:2:2', 'High 4:4:4'];
      const p = coding[13] === 0x32 ? 'Intra' : (names[coding[14]! >> 4] || null);
      return track('h264', p ? `H.264 ${p}` : 'H.264', p, id, null);
    }
    if (isPicture && coding[11] === 0x02 && coding[12] === 0x01 && coding[13]! >= 0x01 && coding[13]! <= 0x04) return track('mpeg2', 'MPEG-2 video', null, id, null);
    if (isPicture && coding[11] === 0x02 && coding[12] === 0x03 && coding[13] === 0x01) return track('jpeg2000', 'JPEG 2000', null, id, null);
    if (isPicture && coding[11] === 0x02 && coding[12] === 0x02) return track('dv', 'DV', null, id, null);
    if (isPicture && coding[11] === 0x01) return track('uncompressed', 'Uncompressed video', null, id, null);
  }
  // No usable coding label: the essence container label gives the mapping.
  if (container && hasPrefix(container, 0, MXF_PREFIX)) {
    switch (container[13]) {
      case 0x11: return track('dnx', 'Avid DNxHD or DNxHR', null, id, null);
      case 0x1c: return track('prores', 'Apple ProRes', null, id, null);
      case 0x10: return track('h264', 'H.264', null, id, null);
      case 0x04: return track('mpeg2', 'MPEG-2 video', null, id, null);
      case 0x0c: return track('jpeg2000', 'JPEG 2000', null, id, null);
      case 0x02: return track('dv', 'DV', null, id, null);
      case 0x05: return track('uncompressed', 'Uncompressed video', null, id, null);
      default: break;
    }
  }
  return track('other', 'Video (unrecognised coding)', null, id, null);
}

function mxfSound(s: MxfSet): ProbedAudioTrack {
  const coding = propUl(s, 0x3d06);
  const rate = propRational(s, 0x3d03);
  const bits = propU(s, 0x3d01);
  const channels = propU(s, 0x3d07);
  const compressed = coding && hasPrefix(coding, 0, MXF_PREFIX) && coding[8] === 0x04 && coding[9] === 0x02 && coding[10] === 0x02 && coding[11] === 0x02;
  return {
    codec: compressed ? 'compressed' : 'pcm',
    label: compressed ? 'Compressed audio' : 'PCM',
    identifier: coding ? hex(coding) : s.kind === 0x48 || s.kind === 0x47 ? 'pcm' : 'none',
    webcodecs: null,
    channels: channels !== null && channels > 0 && channels <= 255 ? channels : null,
    sampleRate: rate !== null ? Math.round(rate) : null,
    bitDepth: bits !== null && bits > 0 && bits <= 64 ? bits : null,
    patentPool: compressed ? null : false,
  };
}

function operationalPattern(label: Uint8Array | null): string | null {
  if (!label || !hasPrefix(label, 0, MXF_PREFIX)) return null;
  const a = label[12]!;
  const b = label[13]!;
  if (a === 0x10) return 'OP-Atom';
  if (a >= 1 && a <= 3 && b >= 1 && b <= 3) return `OP${a}${'abc'[b - 1]}`;
  return null;
}

interface MxfMeta { sets: MxfSet[]; pattern: Uint8Array | null }

/** Read the partition pack at `at` and walk the header metadata after the pack. */
async function readMxfPartition(src: ProbeSource, at: number): Promise<MxfMeta & { footer: number }> {
  const head = await readAt(src, at, Math.min(src.size - at, 4096), 4096);
  const pack = klvAt(head, 0);
  if (!hasPrefix(pack.key, 0, PARTITION_KEY)) fail('malformed', 'no partition pack where one was expected');
  const v = head.subarray(pack.value, pack.next);
  if (v.length < 88) fail('malformed', 'a partition pack is too short');
  const footer = u64(v, 24);
  const headerBytes = u64(v, 32);
  const pattern = v.subarray(64, 80);
  if (headerBytes > MAX_MXF_HEADER_BYTES) fail('too-large', 'the header metadata is larger than the probe reads');
  const start = at + pack.next;
  if (start + headerBytes > src.size) fail('truncated', 'the header metadata runs past the end of the file');
  const buf = headerBytes > 0 ? await readAt(src, start, headerBytes, MAX_MXF_HEADER_BYTES) : new Uint8Array(0);
  const sets: MxfSet[] = [];
  let o = 0;
  let items = 0;
  while (o + 17 <= buf.length) {
    if (++items > MAX_KLV_ITEMS) fail('too-large', 'too many KLV items');
    const k = klvAt(buf, o);
    const key = k.key;
    // Structural metadata sets: 06 0e 2b 34 02 53 01 01 0d 01 01 01 01 01 tt 00.
    if (hasPrefix(key, 0, [0x06, 0x0e, 0x2b, 0x34, 0x02, 0x53, 0x01, 0x01, 0x0d, 0x01, 0x01, 0x01, 0x01, 0x01])) {
      sets.push(parseLocalSet(buf, k.value, k.length, key[14]!));
    } else if (hasPrefix(key, 0, [0x06, 0x0e, 0x2b, 0x34, 0x01, 0x01, 0x01, 0x05, 0x0d, 0x01, 0x03, 0x01]) || hasPrefix(key, 0, [0x06, 0x0e, 0x2b, 0x34, 0x01, 0x02])) {
      break; // essence or index data: the metadata is over
    }
    o = k.next;
  }
  return { sets, pattern, footer };
}

async function probeMxf(src: ProbeSource): Promise<ContainerProbe | null> {
  const lead = await readAt(src, 0, Math.min(src.size, MXF_RUN_IN + 64), MXF_RUN_IN + 64);
  let at = -1;
  for (let i = 0; i <= Math.min(lead.length - 14, MXF_RUN_IN); i++) {
    if (lead[i] === 0x06 && hasPrefix(lead, i, PARTITION_KEY) && lead[i + 13] === 0x02) { at = i; break; }
  }
  if (at < 0) return null;
  let meta = await readMxfPartition(src, at);
  const hasEssenceDescriptors = (m: MxfMeta): boolean => m.sets.some((s) => SET_PICTURE.has(s.kind) || SET_SOUND.has(s.kind));
  if (!hasEssenceDescriptors(meta) && meta.footer > 0 && at + meta.footer + 17 < src.size) {
    // An open header partition can leave the metadata to the footer.
    const f = await readMxfPartition(src, at + meta.footer);
    if (hasEssenceDescriptors(f)) meta = { ...f, footer: meta.footer, pattern: meta.pattern };
  }
  const sets = meta.sets;
  if (sets.length > MAX_KLV_ITEMS) fail('too-large', 'too many metadata sets');

  const video: ProbedVideoTrack[] = [];
  const audio: ProbedAudioTrack[] = [];
  let duration: number | null = null;
  for (const s of sets) {
    if (video.length + audio.length >= MAX_TRACKS) fail('too-large', 'too many tracks');
    if (SET_PICTURE.has(s.kind)) {
      const t = mxfPicture(propUl(s, 0x3201), propUl(s, 0x3004));
      const layout = propU(s, 0x320c);
      const w = propU(s, 0x3209) ?? propU(s, 0x3203) ?? 0;
      let h = propU(s, 0x3208) ?? propU(s, 0x3202) ?? 0;
      if (layout === 1) h *= 2; // separate fields: the stored height is one field
      t.width = w > 0 && w < 100_000 ? w : 0;
      t.height = h > 0 && h < 100_000 ? h : 0;
      t.frameRate = propRational(s, 0x3001);
      const depth = propU(s, 0x3301);
      t.bitDepth = depth !== null && depth > 0 && depth <= 32 ? depth : null;
      video.push(t);
      const frames = propI64(s, 0x3002);
      if (duration === null && frames !== null && frames > 0 && t.frameRate) duration = frames / t.frameRate;
    } else if (SET_SOUND.has(s.kind)) {
      audio.push(mxfSound(s));
    }
  }

  // Start timecode: prefer the component the material package reaches, else the first one found.
  const tc = sets.find((s) => s.kind === 0x14);
  let timecode: string | null = null;
  if (tc) {
    const start = propI64(tc, 0x1501);
    const base = propU(tc, 0x1502);
    const drop = propU(tc, 0x1503);
    if (start !== null && base !== null) timecode = formatTimecode(start, base, drop === 1);
  }
  const pattern = operationalPattern(meta.pattern) ?? operationalPattern(sets.find((s) => s.kind === 0x2f) ? propUl(sets.find((s) => s.kind === 0x2f)!, 0x3b09) : null);
  return { container: 'mxf', brand: pattern, durationSeconds: duration, timecode, video, audio };
}

// ── entry point ─────────────────────────────────────────────────────────────

/**
 * Probe a MOV, MP4 or MXF. Answers null when the bytes are none of the three,
 * and throws VideoProbeError when they are one of the three but cannot be read.
 */
export async function probeVideoContainer(src: ProbeSource): Promise<ContainerProbe | null> {
  if (!Number.isSafeInteger(src.size) || src.size < 0) fail('malformed', 'the source has no usable size');
  if (src.size < 8) return null;
  const head = await readAt(src, 0, Math.min(src.size, 16), 16);
  if (head.length >= 4 && hasPrefix(head, 0, MXF_PREFIX)) return probeMxf(src);
  // MXF may also open with a run-in of up to 64 KiB before the header partition key.
  if (head.length >= 8 && !['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot', 'uuid', 'styp'].includes(fourcc(head, 4))) {
    return probeMxf(src);
  }
  return probeIsoBmff(src);
}
