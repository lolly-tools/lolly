// SPDX-License-Identifier: MPL-2.0
/**
 * Small synthetic audio files for the audio metadata stripper's tests, built in
 * memory: M4A (ISO BMFF), WAV, MP3, FLAC and Ogg Opus. Each carries the tags and
 * Content Credentials a real writer puts in the same places, around a payload whose
 * bytes the tests compare before and after. No audio blob is committed.
 */
import { buildOggPage, buildOpusTags } from '../../engine/src/ogg.ts';

export const latin1 = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const zeros = (n: number): Uint8Array => new Uint8Array(n);

export function cat(...parts: (Uint8Array | number[])[]): Uint8Array {
  const arrs = parts.map((p) => (p instanceof Uint8Array ? p : Uint8Array.from(p)));
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.length; }
  return out;
}

export const u16be = (n: number): Uint8Array => Uint8Array.of((n >>> 8) & 0xff, n & 0xff);
export const u16le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
export const u24be = (n: number): Uint8Array => Uint8Array.of((n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
export const u32be = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
export const u32le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
export const u64be = (n: number): Uint8Array => cat(u32be(Math.floor(n / 2 ** 32)), u32be(n >>> 0));
export const u64le = (n: number): Uint8Array => cat(u32le(n >>> 0), u32le(Math.floor(n / 2 ** 32)));
export const syncsafe = (n: number): Uint8Array => Uint8Array.of((n >>> 21) & 0x7f, (n >>> 14) & 0x7f, (n >>> 7) & 0x7f, n & 0x7f);

/** A payload with a recognisable byte pattern; `seed` changes the bytes. */
export function pattern(n: number, seed = 1): Uint8Array {
  const out = new Uint8Array(n);
  let x = seed * 2654435761 >>> 0;
  for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) >>> 0; out[i] = x >>> 24; }
  return out;
}

export function indexOf(hay: Uint8Array, needle: Uint8Array, from = 0): number {
  outer: for (let i = from; i + needle.length <= hay.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

// ─── ISO BMFF ────────────────────────────────────────────────────────────────

export const C2PA_UUID = Uint8Array.of(0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c, 0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81);
export const XMP_UUID = Uint8Array.of(0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac);

export const box = (type: string, ...parts: (Uint8Array | number[])[]): Uint8Array => {
  const body = cat(...parts);
  return cat(u32be(8 + body.length), latin1(type), body);
};
export const fullBox = (type: string, version: number, flags: number, ...parts: (Uint8Array | number[])[]): Uint8Array =>
  box(type, [version, (flags >>> 16) & 0xff, (flags >>> 8) & 0xff, flags & 0xff], ...parts);

export interface BoxRef { type: string; off: number; size: number; end: number }

/** Sibling boxes in [start, end) of a test fixture (32-bit sizes only). */
export function walk(b: Uint8Array, start = 0, end = b.length): BoxRef[] {
  const out: BoxRef[] = [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  for (let o = start; o + 8 <= end;) {
    const size = dv.getUint32(o);
    out.push({ type: String.fromCharCode(...b.subarray(o + 4, o + 8)), off: o, size, end: o + size });
    if (size < 8) break;
    o += size;
  }
  return out;
}

/** The first box of `type` along a path of container types from the top level. */
export function find(b: Uint8Array, path: string[]): BoxRef | undefined {
  let start = 0;
  let end = b.length;
  let found: BoxRef | undefined;
  for (const type of path) {
    found = walk(b, start, end).find((x) => x.type === type);
    if (!found) return undefined;
    start = found.off + (type === 'meta' ? 12 : 8);
    end = found.end;
  }
  return found;
}

const ilstItem = (key: string, value: string): Uint8Array => box(key, box('data', u32be(1), u32be(0), utf8(value)));
export const MP4_SAMPLES = pattern(600, 7);

export interface Mp4Options {
  /** moov before mdat (the default), else mdat first. */
  faststart?: boolean;
  udta?: boolean;
  c2pa?: 'head' | 'tail' | null;
  xmp?: boolean;
  /** A top-level free box holding old text, before mdat. */
  freeData?: boolean;
  /** A top-level free box of zeros, before mdat (kept). */
  freeZeros?: boolean;
  co64?: boolean;
  times?: boolean;
  handlerName?: string;
  brand?: string;
}

/** An M4A whose two chunk offsets point at MP4_SAMPLES[0] and MP4_SAMPLES[300]. */
export function buildMp4(o: Mp4Options = {}): Uint8Array {
  const faststart = o.faststart ?? true;
  const t = o.times ? 0xe3a8b000 : 0;
  const offsets = (a: number, b: number) => (o.co64
    ? fullBox('co64', 0, 0, u32be(2), u64be(a), u64be(b))
    : fullBox('stco', 0, 0, u32be(2), u32be(a), u32be(b)));
  const moovWith = (a: number, b: number) => box('moov',
    fullBox('mvhd', 0, 0, u32be(t), u32be(t), u32be(1000), u32be(4000), zeros(80)),
    box('trak',
      fullBox('tkhd', 0, 3, u32be(t), u32be(t), u32be(1), zeros(4), u32be(4000), zeros(60)),
      box('mdia',
        fullBox('mdhd', 0, 0, u32be(t), u32be(t), u32be(44100), u32be(176400), u16be(0x55c4), u16be(0)),
        fullBox('hdlr', 0, 0, u32be(0), latin1('soun'), zeros(12), utf8(`${o.handlerName ?? ''}\0`)),
        box('minf', fullBox('smhd', 0, 0, zeros(4)), box('stbl', fullBox('stsd', 0, 0, u32be(0)), offsets(a, b))))),
    ...(o.udta ? [box('udta', fullBox('meta', 0, 0,
      fullBox('hdlr', 0, 0, u32be(0), latin1('mdir'), latin1('appl'), zeros(8), [0]),
      box('ilst', ilstItem('©nam', 'Ska demo'), ilstItem('©cmt', 'Made with Lolly'), ilstItem('©ART', 'Ada Lovelace'), ilstItem('©too', 'lolly.tools'))))] : []));
  const ftyp = box('ftyp', latin1(o.brand ?? 'M4A '), u32be(512), latin1('M4A isom'));
  const c2pa = box('uuid', C2PA_UUID, u32be(0), latin1('manifest\0'), zeros(8), utf8('jumbf-store-bytes'));
  const xmp = box('uuid', XMP_UUID, utf8('<x:xmpmeta xmlns:x="adobe:ns:meta/"/>'));
  const free = o.freeData ? box('free', utf8('old title here')) : o.freeZeros ? box('free', zeros(16)) : zeros(0);
  const mdat = box('mdat', MP4_SAMPLES);
  const head = cat(ftyp, o.c2pa === 'head' ? c2pa : zeros(0), o.xmp ? xmp : zeros(0));
  const tail = o.c2pa === 'tail' ? c2pa : zeros(0);
  if (faststart) {
    const probe = moovWith(0, 0);
    const base = head.length + probe.length + free.length + 8;
    return cat(head, moovWith(base, base + 300), free, mdat, tail);
  }
  const base = head.length + free.length + 8;
  return cat(head, free, mdat, moovWith(base, base + 300), tail);
}

/** Chunk offsets of the first stco/co64 table. */
export function chunkOffsets(b: Uint8Array): number[] {
  const stbl = find(b, ['moov', 'trak', 'mdia', 'minf', 'stbl'])!;
  const table = walk(b, stbl.off + 8, stbl.end).find((x) => x.type === 'stco' || x.type === 'co64')!;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const count = dv.getUint32(table.off + 12);
  const wide = table.type === 'co64';
  return Array.from({ length: count }, (_, i) => {
    const p = table.off + 16 + i * (wide ? 8 : 4);
    return wide ? dv.getUint32(p) * 2 ** 32 + dv.getUint32(p + 4) : dv.getUint32(p);
  });
}

/** The payload of the first top-level mdat. */
export function mdatPayload(b: Uint8Array): Uint8Array {
  const m = walk(b).find((x) => x.type === 'mdat')!;
  return b.subarray(m.off + 8, m.end);
}

/**
 * A fragmented M4A: a C2PA box after ftyp (where c2patool writes it), an empty-ish
 * moov with udta, two moof+mdat pairs whose tfhd carries an absolute base data
 * offset, and an mfra whose tfra (version 1) lists both moof offsets.
 */
export function buildFragmentedMp4(o: { udtaBetween?: boolean } = {}): Uint8Array {
  const ftyp = box('ftyp', latin1('iso6'), u32be(512), latin1('iso6mp41'));
  const c2pa = box('uuid', C2PA_UUID, u32be(0), latin1('manifest\0'), zeros(8), utf8('store'));
  const moov = box('moov', fullBox('mvhd', 0, 0, zeros(96)), box('mvex', fullBox('trex', 0, 0, zeros(20))),
    box('udta', fullBox('meta', 0, 0, fullBox('hdlr', 0, 0, u32be(0), latin1('mdir'), zeros(12), [0]), box('ilst', ilstItem('©nam', 'Fragmented')))));
  const moofWith = (base: number) => box('moof', fullBox('mfhd', 0, 0, u32be(1)),
    box('traf', fullBox('tfhd', 0, 0x000001, u32be(1), u64be(base)), fullBox('trun', 0, 0x000001, u32be(1), u32be(0))));
  const samples1 = pattern(120, 3);
  const samples2 = pattern(90, 4);
  const between = o.udtaBetween ? box('udta', box('©nam', utf8('x'))) : zeros(0);
  const lead = cat(ftyp, c2pa, moov);
  const m1 = lead.length;
  const moof1Size = moofWith(0).length;
  const m2 = m1 + moof1Size + 8 + samples1.length + between.length;
  const tfraWith = (a: number, b: number) => box('mfra',
    fullBox('tfra', 1, 0, u32be(1), u32be(0), u32be(2), u64be(0), u64be(a), [1, 1, 1], u64be(1000), u64be(b), [1, 1, 1]),
    fullBox('mfro', 0, 0, u32be(0)));
  return cat(lead, moofWith(m1), box('mdat', samples1), between, moofWith(m2), box('mdat', samples2), tfraWith(m1, m2));
}

// ─── WAV ─────────────────────────────────────────────────────────────────────

export const riffChunk = (id: string, body: Uint8Array): Uint8Array => cat(latin1(id), u32le(body.length), body, body.length & 1 ? [0] : []);
export const riff = (...chunks: Uint8Array[]): Uint8Array => {
  const body = cat(latin1('WAVE'), ...chunks);
  return cat(latin1('RIFF'), u32le(body.length), body);
};
export const WAV_PCM = pattern(1000, 11);
export const wavFmt = riffChunk('fmt ', cat(u16le(1), u16le(2), u32le(44100), u32le(176400), u16le(4), u16le(16)));
const padTo = (b: Uint8Array, n: number): Uint8Array => cat(b.subarray(0, n), zeros(Math.max(0, n - b.length)));

/** A WAV with LIST/INFO, bext, XMP, C2PA and id3 chunks, an odd-sized kept chunk, zero and dirty padding. */
export function buildWav(): Uint8Array {
  const info = riffChunk('LIST', cat(latin1('INFO'), riffChunk('INAM', utf8('Ska demo\0')), riffChunk('IART', utf8('Ada Lovelace\0')), riffChunk('ISFT', utf8('lolly.tools\0'))));
  const bext = riffChunk('bext', cat(padTo(utf8('Studio take'), 256), padTo(utf8('Ada Studio'), 32), zeros(32), latin1('2026-11-14'), latin1('10:00:00'), zeros(602 - 338)));
  return riff(wavFmt, riffChunk('JUNK', zeros(4)), info, riffChunk('cue ', Uint8Array.of(1, 2, 3)), riffChunk('data', WAV_PCM), bext,
    riffChunk('_PMX', utf8('<x:xmpmeta/>')), riffChunk('JUNK', utf8('old')), riffChunk('id3 ', id3v24(id3Text('TIT2', 'Ska'))), riffChunk('C2PA', utf8('store')));
}

// ─── ID3 and MP3 ─────────────────────────────────────────────────────────────

/** One MPEG-1 Layer III frame, 128 kbps at 44.1 kHz (417 bytes), body bytes below 0x80. */
export function mpegFrame(seed: number, body?: Uint8Array): Uint8Array {
  const f = new Uint8Array(417);
  f.set([0xff, 0xfb, 0x90, 0x00]);
  const fill = pattern(413, seed);
  for (let i = 0; i < 413; i++) f[4 + i] = fill[i]! & 0x7f;
  if (body) f.set(body, 36);
  return f;
}
export const MP3_FRAMES = cat(mpegFrame(1), mpegFrame(2), mpegFrame(3));
/** A first frame carrying a Xing header and a LAME version string. */
export const XING_FRAMES = cat(mpegFrame(1, cat(latin1('Xing'), zeros(116), latin1('LAME3.100'))), mpegFrame(2), mpegFrame(3));

export const id3Frame = (id: string, data: Uint8Array): Uint8Array => cat(latin1(id), syncsafe(data.length), [0, 0], data);
export const id3Text = (id: string, value: string): Uint8Array => id3Frame(id, cat([3], utf8(value)));
export const id3v24 = (...frames: Uint8Array[]): Uint8Array => { const body = cat(...frames); return cat(latin1('ID3'), [4, 0, 0], syncsafe(body.length), body); };
export const id3v23 = (...frames: Uint8Array[]): Uint8Array => {
  const body = cat(...frames.map((f) => cat(f.subarray(0, 4), u32be(f.length - 10), f.subarray(8))));
  return cat(latin1('ID3'), [3, 0, 0], syncsafe(body.length), body);
};
export const c2paGeob = (): Uint8Array => id3Frame('GEOB', cat([0], latin1('application/x-c2pa-manifest-store\0c2pa\0c2pa\0'), utf8('store')));
export function id3v1(title: string, artist: string): Uint8Array {
  const field = (s: string, n: number) => padTo(latin1(s), n);
  return cat(latin1('TAG'), field(title, 30), field(artist, 30), field('', 30), latin1('2026'), field('v1 comment', 30), [0xff]);
}
export function apeTag(key: string, value: string): Uint8Array {
  const items = cat(u32le(utf8(value).length), u32le(0), latin1(`${key}\0`), utf8(value));
  const size = items.length + 32;
  const part = (flags: number) => cat(latin1('APETAGEX'), u32le(2000), u32le(size), u32le(1), u32le(flags), zeros(8));
  return cat(part(0xa0000000), items, part(0x80000000));
}
export function lyrics3(text: string): Uint8Array {
  const body = cat(latin1('LYRICSBEGIN'), latin1(`LYR${String(text.length).padStart(5, '0')}${text}`));
  return cat(body, latin1(String(body.length).padStart(6, '0')), latin1('LYRICS200'));
}

/** An MP3 with two ID3v2 tags in front (one carrying the C2PA GEOB) and APE, Lyrics3 and ID3v1 tags behind. */
export function buildMp3(frames = MP3_FRAMES): Uint8Array {
  return cat(
    id3v24(id3Text('TIT2', 'Ska demo'), id3Text('TPE1', 'Ada Lovelace'), id3Frame('COMM', cat([0], latin1('eng'), [0], latin1('A comment'))), c2paGeob()),
    id3v23(id3Text('TSSE', 'Lavf61')),
    frames, apeTag('Title', 'APE title'), lyrics3('la la'), id3v1('V1 title', 'V1 artist'));
}

// ─── FLAC ────────────────────────────────────────────────────────────────────

export const flacBlock = (type: number, body: Uint8Array, last = false): Uint8Array => cat([(last ? 0x80 : 0) | type], u24be(body.length), body);
export const FLAC_FRAMES = cat([0xff, 0xf8], pattern(300, 5));
export const flacStreamInfo = flacBlock(0, pattern(34, 6));
export const flacSeekTable = flacBlock(3, pattern(18, 8));
export function vorbisComment(vendor: string, comments: string[]): Uint8Array {
  return cat(u32le(utf8(vendor).length), utf8(vendor), u32le(comments.length), ...comments.map((c) => cat(u32le(utf8(c).length), utf8(c))));
}

/** A FLAC with every removable block kind and a zero PADDING block last (kept). */
export function buildFlac(): Uint8Array {
  return cat(latin1('fLaC'), flacStreamInfo, flacSeekTable,
    flacBlock(4, vorbisComment('reference libFLAC 1.4.3', ['TITLE=Ska demo', 'ARTIST=Ada Lovelace'])),
    flacBlock(6, cat(u32be(3), u32be(10), latin1('image/jpeg'), u32be(0), zeros(16), u32be(3), [1, 2, 3])),
    flacBlock(2, cat(latin1('C2PA'), utf8('store'))),
    flacBlock(5, zeros(20)),
    flacBlock(1, zeros(16), true),
    FLAC_FRAMES);
}

// ─── Ogg Opus ────────────────────────────────────────────────────────────────

const pageHead = (htype: number, granule: number, seq: number): Uint8Array =>
  cat(latin1('OggS'), [0, htype], u64le(granule), u32le(0x1234), u32le(seq));
export const OPUS_HEAD_PAGE = buildOggPage(pageHead(2, 0, 0), cat(latin1('OpusHead'), [1, 2], u16le(312), u32le(48000), u16le(0), [0]));
export const OPUS_AUDIO_PAGES = cat(buildOggPage(pageHead(0, 960, 2), pattern(120, 9)), buildOggPage(pageHead(4, 1920, 3), pattern(80, 10)));

/** An Ogg Opus stream whose one-page OpusTags carries a vendor, two tags and a C2PA field. */
export function buildOpus(vendor = 'libopus 1.5', comments = ['TITLE=Ska demo', 'ARTIST=Ada Lovelace', `C2PA=${btoa('store')}`]): Uint8Array {
  return cat(OPUS_HEAD_PAGE, buildOggPage(pageHead(0, 0, 1), buildOpusTags(utf8(vendor), comments.map(utf8))), OPUS_AUDIO_PAGES);
}
