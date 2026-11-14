// SPDX-License-Identifier: MPL-2.0
/**
 * Audio metadata stripper: lossless byte surgery that removes tags, Content
 * Credentials and other hidden data from audio files while every audio byte
 * stays exactly as it was.
 *
 * What each format loses (everything else is copied through verbatim):
 *
 *   M4A / MP4  every C2PA and XMP `uuid` box at the top level, top-level `meta`,
 *              `udta` and `jumb` boxes, and the `udta` and `meta` boxes of the
 *              movie and its tracks: iTunes `ilst` items (title, comment,
 *              description, encoder, artist and the rest), QuickTime keys,
 *              chapters and location. Handler names are emptied, and the
 *              creation and modification times in `mvhd`, `tkhd` and `mdhd`
 *              are set to zero. `mdat` is never touched: when anything before
 *              it shrinks, every `stco`/`co64` chunk offset, `tfhd` base data
 *              offset and `tfra` fragment offset moves by the same amount.
 *   WAV        LIST/INFO, LIST/adtl and LIST/exif, `id3 `, `bext`, `iXML`,
 *              `axml`, `cart`, `DISP`, `umid`, XMP (`_PMX`) and C2PA chunks, and
 *              an ID3 tag appended after the RIFF form. The RIFF size is
 *              rewritten and kept chunks keep their pad byte.
 *   MP3        ID3v2 tags at the front (the C2PA GEOB frame lives in one), and
 *              ID3v1, Enhanced TAG, APE, Lyrics3 and appended ID3v2 tags at the
 *              end. Every MPEG frame is kept, a Xing or LAME header frame too.
 *   FLAC       every metadata block except STREAMINFO and SEEKTABLE (so
 *              VORBIS_COMMENT, PICTURE, CUESHEET and APPLICATION, Lolly's C2PA
 *              block included), and ID3 tags before `fLaC` or after the frames.
 *   Ogg Opus   the OpusTags vendor string and comments, when the comment header
 *              fills one page (as in every Opus file without embedded art).
 *
 * Padding (`free`/`skip`, `JUNK`, FLAC PADDING) is kept while it holds only
 * zero bytes; padding with anything else in it can be leftover tag data, so it
 * goes too.
 *
 * Contract, the same as strip-metadata.ts for images: a privacy control fails
 * closed. Structure this module cannot walk throws a plain-language Error
 * rather than guess. A file with nothing to remove comes back as the same
 * Uint8Array. Every clean copy is planned again before it is returned: a copy
 * that still holds removable data, no longer parses, or whose audio bytes
 * differ from the original's throws instead of being offered as clean. Every
 * loop is bounded by the bytes it walks and by a fixed count.
 *
 * No DOM. scripts/build-strip-audio.ts compiles this module, with the Ogg page
 * grammar it imports, into the Strip Hidden Data tool's hook, which cannot
 * import the engine.
 */
import { buildOggPage, buildOpusTags, commentKey, commentValue, locateOpusComment, parseOpusTags } from './ogg.ts';

/** The audio containers this module cleans. 'mp4' covers M4A and other ISO BMFF movies. */
export type AudioStripFormat = 'mp4' | 'wav' | 'mp3' | 'flac' | 'ogg';

/** Every format stripAudioMetadata accepts, in a fixed order. */
export const AUDIO_STRIP_FORMATS: readonly AudioStripFormat[] = Object.freeze(['mp4', 'wav', 'mp3', 'flac', 'ogg']);

/** One piece of hidden data, in words a person reads. */
export interface AudioMetadataItem {
  /** Plain words: "Content Credentials", "Title", "Comment". */
  label: string;
  /** The value where one is readable, else a short description. At most 200 characters. */
  value: string;
  /** The place in the file: "ID3v2 TIT2", "WAV INFO INAM", "MP4 ilst". */
  source: string;
  /** Identifies a person, a device or a place. */
  sensitive?: boolean;
}

/** What a strip would remove from one file. */
export interface AudioInspection {
  format: AudioStripFormat;
  /** The hidden data a strip removes, with values. At most 64 entries. */
  items: AudioMetadataItem[];
  /** The structures a strip removes, as short phrases ("an ID3v2 tag"). Empty when there is nothing to remove. */
  removals: string[];
  /** Data a strip keeps on purpose, such as an MP3's encoder header frame. */
  kept: AudioMetadataItem[];
  /** True for an MP4 with a video track. */
  video: boolean;
}

const MAX_REPORT_ITEMS = 64;
const MAX_VALUE = 200;
/** Boxes, chunks or blocks walked at one level. */
const MAX_UNITS = 65536;
/** Tags stacked at either end of an MP3 or FLAC file. */
const MAX_TAGS = 16;
/** ID3 frames read from one tag for the report. */
const MAX_FRAMES = 1024;
/** Bytes searched past the leading tags for the first MPEG audio frame. */
const MAX_SYNC_SCAN = 65536;
/** MP4 container nesting this module follows: moov, trak, mdia, minf, stbl. */
const MP4_NEST_DEPTH = 8;

// ─── small byte helpers ──────────────────────────────────────────────────────

function stripRefusal(message: string): never {
  throw new Error(message);
}

const readBe16 = (b: Uint8Array, o: number): number => ((b[o] ?? 0) << 8) | (b[o + 1] ?? 0);
const readBe24 = (b: Uint8Array, o: number): number => ((b[o] ?? 0) << 16) | ((b[o + 1] ?? 0) << 8) | (b[o + 2] ?? 0);
const readBe32 = (b: Uint8Array, o: number): number =>
  (((b[o] ?? 0) << 24) | ((b[o + 1] ?? 0) << 16) | ((b[o + 2] ?? 0) << 8) | (b[o + 3] ?? 0)) >>> 0;
const readLe32 = (b: Uint8Array, o: number): number =>
  ((b[o] ?? 0) | ((b[o + 1] ?? 0) << 8) | ((b[o + 2] ?? 0) << 16) | ((b[o + 3] ?? 0) << 24)) >>> 0;
const syncsafeAt = (b: Uint8Array, o: number): number =>
  (((b[o] ?? 0) & 0x7f) << 21) | (((b[o + 1] ?? 0) & 0x7f) << 14) | (((b[o + 2] ?? 0) & 0x7f) << 7) | ((b[o + 3] ?? 0) & 0x7f);

function putBe32(b: Uint8Array, o: number, v: number): void {
  b[o] = (v >>> 24) & 0xff; b[o + 1] = (v >>> 16) & 0xff; b[o + 2] = (v >>> 8) & 0xff; b[o + 3] = v & 0xff;
}

/** `n` bytes as Latin-1 text, or '' when the range is out of bounds. */
function latin1At(b: Uint8Array, o: number, n: number): string {
  if (o < 0 || n < 0 || o + n > b.length) return '';
  let s = '';
  for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]!);
  return s;
}

function joinBytes(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function anyNonZero(b: Uint8Array, start: number, end: number): boolean {
  for (let i = start; i < end; i++) if (b[i] !== 0) return true;
  return false;
}

type TextEncoding = 'utf-8' | 'utf-16le' | 'utf-16be' | 'latin1';

/** Decode a bounded slice for display; a failed decode reads as ''. */
function decodeSlice(b: Uint8Array, start: number, end: number, enc: TextEncoding): string {
  if (start < 0 || end <= start || start >= b.length) return '';
  const slice = b.subarray(start, Math.min(end, b.length, start + MAX_VALUE * 4));
  try {
    return new TextDecoder(enc === 'latin1' ? 'windows-1252' : enc).decode(slice);
  } catch {
    return '';
  }
}

/** Collapse control characters and runs of space, then cap the length. */
function clipValue(s: string): string {
  let out = '';
  let space = false;
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    const blank = c < 0x20 || c === 0x7f || ch === ' ' || ch === ' ';
    if (blank) { space = out.length > 0; continue; }
    if (space) { out += ' '; space = false; }
    out += ch;
    if (out.length > MAX_VALUE) break;
  }
  return out.length > MAX_VALUE ? `${out.slice(0, MAX_VALUE - 1)}…` : out;
}

/** A box type or chunk id with unprintable bytes shown as dots. */
function printableId(id: string): string {
  let s = '';
  for (const ch of id) { const c = ch.charCodeAt(0); s += c >= 0x20 && c !== 0x7f ? ch : '.'; }
  return s.trim() || '?';
}

const sizeLabel = (n: number): string => (n < 1024 ? `${n} bytes` : `${Math.round(n / 1024)} KB`);

// ─── the report a plan builds ────────────────────────────────────────────────

interface Report {
  items: AudioMetadataItem[];
  removals: string[];
  kept: AudioMetadataItem[];
  video: boolean;
  timesShown: boolean;
}

function newReport(): Report {
  return { items: [], removals: [], kept: [], video: false, timesShown: false };
}

function addItem(rep: Report, label: string, value: string, source: string, sensitive = false): void {
  if (rep.items.length >= MAX_REPORT_ITEMS) return;
  const v = clipValue(value) || 'present';
  rep.items.push(sensitive ? { label, value: v, source, sensitive: true } : { label, value: v, source });
}

function addRemoval(rep: Report, what: string): void {
  if (rep.removals.length < MAX_REPORT_ITEMS && !rep.removals.includes(what)) rep.removals.push(what);
}

/** Byte ranges of audio payload: `mdat` sample data, PCM, MPEG or FLAC frames, Opus pages. */
type Spans = Array<[number, number]>;

interface Plan {
  report: Report;
  audio: Spans;
  /** The clean copy. Called only when the report lists a removal. */
  build: () => Uint8Array;
}

// ─── shared tag labels ───────────────────────────────────────────────────────

type Label = [string, boolean?];

/** A label for a key read from the file; keys such as `constructor` never reach the prototype. */
function ownLabel<T>(map: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}

// Vorbis comment keys (FLAC VORBIS_COMMENT, Opus OpusTags), uppercased.
const VORBIS_LABELS: Record<string, Label> = {
  TITLE: ['Title'], ARTIST: ['Artist', true], ALBUMARTIST: ['Album artist', true], 'ALBUM ARTIST': ['Album artist', true],
  ALBUM: ['Album'], COMMENT: ['Comment'], DESCRIPTION: ['Description'], ENCODER: ['Encoder'],
  ENCODED_BY: ['Encoded by', true], ENCODEDBY: ['Encoded by', true], DATE: ['Date'], YEAR: ['Year'], GENRE: ['Genre'],
  COMPOSER: ['Composer', true], PERFORMER: ['Performer', true], COPYRIGHT: ['Copyright'], LICENSE: ['Licence'],
  ORGANIZATION: ['Organisation'], CONTACT: ['Contact', true], LOCATION: ['Location', true],
  TRACKNUMBER: ['Track number'], DISCNUMBER: ['Disc number'], LYRICS: ['Lyrics'], ISRC: ['ISRC'],
};

function describeVorbisComment(rep: Report, raw: Uint8Array, source: string): void {
  const key = commentKey(raw);
  const value = commentValue(raw);
  if (key === 'C2PA') { addItem(rep, 'Content Credentials', 'C2PA manifest store', source); return; }
  if (key === 'METADATA_BLOCK_PICTURE' || key === 'COVERART') { addItem(rep, 'Picture', sizeLabel(value.length), source); return; }
  if (key.startsWith('REPLAYGAIN_')) { addItem(rep, 'Loudness tag', `${key}: ${decodeSlice(value, 0, value.length, 'utf-8')}`, source); return; }
  const label = ownLabel(VORBIS_LABELS, key);
  addItem(rep, label ? label[0] : `Tag ${printableId(key)}`, decodeSlice(value, 0, value.length, 'utf-8'), source, label?.[1] ?? false);
}

// ID3v2 frame ids (v2.3/v2.4 four-character and v2.2 three-character forms).
const ID3_LABELS: Record<string, Label> = {
  TIT2: ['Title'], TT2: ['Title'], TPE1: ['Artist', true], TP1: ['Artist', true], TPE2: ['Album artist', true],
  TP2: ['Album artist', true], TALB: ['Album'], TAL: ['Album'], TCOM: ['Composer', true], TCM: ['Composer', true],
  TYER: ['Year'], TYE: ['Year'], TDRC: ['Recording date'], TDRL: ['Release date'], TDEN: ['Encoding date'],
  TDTG: ['Tagging date'], TDAT: ['Date'], TCON: ['Genre'], TCO: ['Genre'], TRCK: ['Track number'], TRK: ['Track number'],
  TPOS: ['Disc number'], TPA: ['Disc number'], TCOP: ['Copyright'], TCR: ['Copyright'], TPUB: ['Publisher'],
  TPB: ['Publisher'], TENC: ['Encoded by', true], TEN: ['Encoded by', true], TSSE: ['Encoder settings'],
  TSS: ['Encoder settings'], TOWN: ['Owner', true], TEXT: ['Lyricist', true], TXT: ['Lyricist', true],
  TOLY: ['Original lyricist', true], TOPE: ['Original artist', true], TIT1: ['Grouping'], TIT3: ['Subtitle'],
  TBPM: ['Tempo'], TKEY: ['Musical key'], TLAN: ['Language'], TSRC: ['ISRC'], TOFN: ['Original filename', true],
  TMED: ['Media type'], TFLT: ['File type'], TLEN: ['Length'],
};

const GEOB_C2PA_MIME = 'application/x-c2pa-manifest-store';

function id3Encoding(e: number, b: Uint8Array, at: number): TextEncoding {
  if (e === 3) return 'utf-8';
  if (e === 2) return 'utf-16be';
  if (e === 1) return b[at] === 0xfe && b[at + 1] === 0xff ? 'utf-16be' : 'utf-16le';
  return 'latin1';
}

/** End of a terminated string from `at` (the index of its terminator, or `end`). */
function termEnd(b: Uint8Array, at: number, end: number, wide: boolean): number {
  if (!wide) { let i = at; while (i < end && b[i] !== 0) i++; return i; }
  let i = at;
  while (i + 1 < end && !(b[i] === 0 && b[i + 1] === 0)) i += 2;
  return Math.min(i, end);
}

function id3Text(b: Uint8Array, start: number, end: number, e: number): string {
  const enc = id3Encoding(e, b, start);
  return decodeSlice(b, start, end, enc).split('\u0000').filter(Boolean).join(', ');
}

function describeId3Frame(rep: Report, id: string, f: Uint8Array, source: string): void {
  const where = `${source} ${printableId(id)}`;
  const e = f[0] ?? 0;
  const wide = e === 1 || e === 2;
  const step = wide ? 2 : 1;
  if (id === 'GEOB' || id === 'GEO') {
    const mimeEnd = termEnd(f, 1, f.length, false);
    const mime = latin1At(f, 1, mimeEnd - 1);
    if (mime === GEOB_C2PA_MIME) { addItem(rep, 'Content Credentials', 'C2PA manifest store', where); return; }
    addItem(rep, 'Embedded object', mime || sizeLabel(f.length), where);
    return;
  }
  if (id === 'APIC' || id === 'PIC') {
    const mime = id === 'PIC' ? `image/${latin1At(f, 1, 3).toLowerCase()}` : latin1At(f, 1, termEnd(f, 1, f.length, false) - 1);
    addItem(rep, 'Picture', `${mime || 'image'}, ${sizeLabel(f.length)}`, where);
    return;
  }
  if (id === 'COMM' || id === 'COM' || id === 'USLT' || id === 'ULT') {
    const descEnd = termEnd(f, 4, f.length, wide);
    addItem(rep, id.startsWith('C') ? 'Comment' : 'Lyrics', id3Text(f, descEnd + step, f.length, e), where);
    return;
  }
  if (id === 'TXXX' || id === 'TXX') {
    const descEnd = termEnd(f, 1, f.length, wide);
    const desc = id3Text(f, 1, descEnd, e);
    addItem(rep, `User text${desc ? ` (${clipValue(desc).slice(0, 40)})` : ''}`, id3Text(f, descEnd + step, f.length, e), where);
    return;
  }
  if (id === 'PRIV' || id === 'UFID' || id === 'UFI') {
    const owner = latin1At(f, 0, termEnd(f, 0, f.length, false));
    addItem(rep, id === 'PRIV' ? 'Private data' : 'Unique file identifier', owner || sizeLabel(f.length), where);
    return;
  }
  if (id === 'POPM' || id === 'POP') { addItem(rep, 'Rating', latin1At(f, 0, termEnd(f, 0, f.length, false)), where, true); return; }
  if (id === 'WXXX' || id === 'WXX') {
    const descEnd = termEnd(f, 1, f.length, wide);
    addItem(rep, 'Web address', latin1At(f, descEnd + step, f.length - descEnd - step), where);
    return;
  }
  if (id[0] === 'W') { addItem(rep, 'Web address', latin1At(f, 0, f.length), where); return; }
  if (id === 'CHAP' || id === 'CTOC') { addItem(rep, 'Chapters', 'chapter markers', where); return; }
  if (id[0] === 'T') {
    const label = ownLabel(ID3_LABELS, id);
    addItem(rep, label ? label[0] : `Tag ${printableId(id)}`, id3Text(f, 1, f.length, e), where, label?.[1] ?? false);
    return;
  }
  addItem(rep, `Tag ${printableId(id)}`, sizeLabel(f.length), where);
}

/** Undo ID3 unsynchronisation (0xFF 0x00 becomes 0xFF). */
function deunsync(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length);
  let n = 0;
  for (let i = 0; i < b.length; i++) {
    out[n++] = b[i]!;
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, n);
}

interface Id3Tag { start: number; end: number; ver: number; flags: number }

/** The ID3v2 tag starting at `p`, null when there is none, or a throw when its header is malformed. */
function id3v2At(b: Uint8Array, p: number): Id3Tag | null {
  if (p + 10 > b.length || latin1At(b, p, 3) !== 'ID3') return null;
  const ver = b[p + 3]!;
  const flags = b[p + 5]!;
  if (ver < 2 || ver > 4 || b[p + 4] === 0xff) stripRefusal('An ID3v2 tag has an unknown version.');
  for (let i = 6; i < 10; i++) if (b[p + i]! & 0x80) stripRefusal('An ID3v2 tag has a malformed size.');
  const end = p + 10 + syncsafeAt(b, p + 6) + (ver === 4 && flags & 0x10 ? 10 : 0);
  if (end > b.length) stripRefusal('An ID3v2 tag runs past the end of the file.');
  return { start: p, end, ver, flags };
}

/** List an ID3v2 tag's frames. Best effort: a frame that does not read ends the list. */
function describeId3v2(rep: Report, b: Uint8Array, tag: Id3Tag, source: string): void {
  const before = rep.items.length;
  try {
    const footer = tag.ver === 4 && tag.flags & 0x10 ? 10 : 0;
    let body = b.subarray(tag.start + 10, tag.end - footer);
    if (tag.flags & 0x80 && tag.ver < 4) body = deunsync(body);
    let p = 0;
    if (tag.flags & 0x40) p = tag.ver === 3 ? 4 + readBe32(body, 0) : tag.ver === 4 ? syncsafeAt(body, 0) : 0;
    const idLen = tag.ver === 2 ? 3 : 4;
    const hdr = tag.ver === 2 ? 6 : 10;
    for (let i = 0; i < MAX_FRAMES && p + hdr <= body.length && body[p] !== 0; i++) {
      const id = latin1At(body, p, idLen);
      const size = tag.ver === 2 ? readBe24(body, p + 3) : tag.ver === 4 ? syncsafeAt(body, p + 4) : readBe32(body, p + 4);
      const fs = p + hdr;
      const fe = fs + size;
      if (fe > body.length || !/^[A-Z0-9]+$/.test(id)) break;
      let frame = body.subarray(fs, fe);
      let unreadable = false;
      if (tag.ver === 4) {
        const format = body[p + 9]!;
        if (format & 0x40) frame = frame.subarray(1);
        if (format & 0x0c) unreadable = true;
        if (format & 0x01) frame = frame.subarray(4);
        if (format & 0x02) frame = deunsync(frame);
      } else if (tag.ver === 3 && body[p + 9]! & 0xc0) unreadable = true;
      if (unreadable) addItem(rep, `Tag ${printableId(id)}`, 'compressed or encrypted', `${source} ${printableId(id)}`);
      else describeId3Frame(rep, id, frame, source);
      p = fe;
    }
  } catch {
    /* the tag is removed whole; the report lists what was readable */
  }
  if (rep.items.length === before) addItem(rep, 'ID3 tag', `ID3v2.${tag.ver}, ${sizeLabel(tag.end - tag.start)}`, source);
}

function describeId3v1(rep: Report, b: Uint8Array, at: number): void {
  const before = rep.items.length;
  const field = (o: number, n: number) => clipValue(decodeSlice(b, at + o, at + o + n, 'latin1').split('\u0000')[0] ?? '');
  const rows: Array<[string, string, boolean]> = [
    ['Title', field(3, 30), false], ['Artist', field(33, 30), true], ['Album', field(63, 30), false],
    ['Year', field(93, 4), false], ['Comment', field(97, b[at + 125] === 0 ? 28 : 30), false],
  ];
  for (const [label, value, sensitive] of rows) if (value) addItem(rep, label, value, 'ID3v1 tag', sensitive);
  if (rep.items.length === before) addItem(rep, 'ID3v1 tag', 'empty fields', 'ID3v1 tag');
}

const APE_LABELS: Record<string, Label> = {
  TITLE: ['Title'], ARTIST: ['Artist', true], ALBUM: ['Album'], COMMENT: ['Comment'], YEAR: ['Year'], GENRE: ['Genre'],
  TRACK: ['Track number'], COMPOSER: ['Composer', true], COPYRIGHT: ['Copyright'], PUBLISHER: ['Publisher'],
};

function describeApe(rep: Report, b: Uint8Array, itemsStart: number, footer: number): void {
  const before = rep.items.length;
  try {
    const count = Math.min(readLe32(b, footer + 16), MAX_FRAMES);
    let p = itemsStart;
    for (let i = 0; i < count && p + 8 < footer; i++) {
      const size = readLe32(b, p);
      const flags = readLe32(b, p + 4);
      const keyEnd = termEnd(b, p + 8, Math.min(footer, p + 8 + 256), false);
      const key = latin1At(b, p + 8, keyEnd - p - 8).toUpperCase();
      const vs = keyEnd + 1;
      if (vs + size > footer) break;
      const label = ownLabel(APE_LABELS, key);
      const value = ((flags >>> 1) & 3) === 0 ? decodeSlice(b, vs, vs + size, 'utf-8') : sizeLabel(size);
      addItem(rep, label ? label[0] : `Tag ${printableId(key)}`, value, 'APE tag', label?.[1] ?? false);
      p = vs + size;
    }
  } catch {
    /* the tag is removed whole */
  }
  if (rep.items.length === before) addItem(rep, 'APE tag', 'tag present', 'APE tag');
}

/**
 * Tags stacked after the audio: ID3v1 (and Enhanced TAG before it), APE, an
 * appended ID3v2 tag with its footer, and Lyrics3. Returns the new end of the
 * audio. `floor` is the first audio byte: no tag may reach below that byte.
 */
function trailingTags(rep: Report, b: Uint8Array, floor: number): number {
  let end = b.length;
  for (let i = 0; i <= MAX_TAGS; i++) {
    if (i === MAX_TAGS) stripRefusal('The file ends in too many stacked tags.');
    if (end - 128 >= floor && latin1At(b, end - 128, 3) === 'TAG') {
      describeId3v1(rep, b, end - 128);
      addRemoval(rep, 'an ID3v1 tag');
      end -= 128;
      if (end - 227 >= floor && latin1At(b, end - 227, 4) === 'TAG+') { addItem(rep, 'Enhanced tag', 'extended ID3v1 fields', 'Enhanced TAG'); end -= 227; }
      continue;
    }
    if (end - 32 >= floor && latin1At(b, end - 32, 8) === 'APETAGEX') {
      const size = readLe32(b, end - 20);
      const total = size + (readLe32(b, end - 12) & 0x80000000 ? 32 : 0);
      if (size < 32 || end - total < floor) stripRefusal('An APE tag runs past the start of the audio.');
      describeApe(rep, b, end - size, end - 32);
      addRemoval(rep, 'an APE tag');
      end -= total;
      continue;
    }
    if (end - 10 >= floor && latin1At(b, end - 10, 3) === '3DI') {
      for (let k = 6; k < 10; k++) if (b[end - 10 + k]! & 0x80) stripRefusal('An appended ID3v2 tag has a malformed size.');
      const start = end - 20 - syncsafeAt(b, end - 4);
      if (start < floor || latin1At(b, start, 3) !== 'ID3') stripRefusal('An appended ID3v2 tag does not match its footer.');
      describeId3v2(rep, b, { start, end, ver: b[start + 3]!, flags: b[start + 5]! }, 'ID3v2 tag');
      addRemoval(rep, 'an ID3v2 tag');
      end = start;
      continue;
    }
    if (end - 15 >= floor && latin1At(b, end - 9, 9) === 'LYRICS200') {
      const digits = latin1At(b, end - 15, 6);
      if (!/^[0-9]{6}$/.test(digits)) stripRefusal('A Lyrics3 tag has a malformed size.');
      const start = end - 15 - Number(digits);
      if (start < floor || latin1At(b, start, 11) !== 'LYRICSBEGIN') stripRefusal('A Lyrics3 tag does not match its size.');
      addItem(rep, 'Lyrics', sizeLabel(end - start), 'Lyrics3 tag');
      addRemoval(rep, 'a Lyrics3 tag');
      end = start;
      continue;
    }
    if (end - 20 >= floor && latin1At(b, end - 9, 9) === 'LYRICSEND') {
      const from = Math.max(floor, end - 9 - 5100 - 11);
      let start = -1;
      for (let p = end - 20; p >= from; p--) if (latin1At(b, p, 11) === 'LYRICSBEGIN') { start = p; break; }
      if (start < 0) stripRefusal('A Lyrics3 tag has no start marker.');
      addItem(rep, 'Lyrics', sizeLabel(end - start), 'Lyrics3 tag');
      addRemoval(rep, 'a Lyrics3 tag');
      end = start;
      continue;
    }
    break;
  }
  return end;
}

/** Leading ID3v2 tags from offset 0. Returns the first byte past them. */
function leadingId3(rep: Report, b: Uint8Array, source: string): number {
  let p = 0;
  for (let i = 0; i <= MAX_TAGS; i++) {
    const tag = id3v2At(b, p);
    if (!tag) return p;
    if (i === MAX_TAGS) stripRefusal('The file starts with too many stacked ID3 tags.');
    describeId3v2(rep, b, tag, source);
    addRemoval(rep, 'an ID3v2 tag');
    p = tag.end;
  }
  return p;
}

// ─── MP3 ─────────────────────────────────────────────────────────────────────

// Bitrates in kbps by index 0..14 (0 = free format). Layer I/II/III for MPEG-1,
// Layer I and Layer II/III for MPEG-2 and 2.5.
const BR_V1_L1 = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448];
const BR_V1_L2 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384];
const BR_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const BR_V2_L1 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256];
const BR_V2_L23 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
// Sample rates by version bits (0 = MPEG-2.5, 2 = MPEG-2, 3 = MPEG-1).
const MPEG_RATES: Record<number, number[]> = { 0: [11025, 12000, 8000], 2: [22050, 24000, 16000], 3: [44100, 48000, 32000] };

/** The MPEG audio frame header at `o`: its length (0 for free format), or null when there is none. */
function mpegFrame(b: Uint8Array, o: number): number | null {
  if (o < 0 || o + 4 > b.length || b[o] !== 0xff || (b[o + 1]! & 0xe0) !== 0xe0) return null;
  const ver = (b[o + 1]! >> 3) & 3;
  const layer = (b[o + 1]! >> 1) & 3;
  const bri = b[o + 2]! >> 4;
  const sri = (b[o + 2]! >> 2) & 3;
  const pad = (b[o + 2]! >> 1) & 1;
  if (ver === 1 || layer === 0 || bri === 15 || sri === 3) return null;
  const v1 = ver === 3;
  const table = layer === 3 ? (v1 ? BR_V1_L1 : BR_V2_L1) : layer === 2 ? (v1 ? BR_V1_L2 : BR_V2_L23) : (v1 ? BR_V1_L3 : BR_V2_L23);
  const kbps = table[bri]!;
  if (!kbps) return 0;
  const rate = MPEG_RATES[ver]![sri]!;
  if (layer === 3) return Math.floor((12 * kbps * 1000) / rate + pad) * 4;
  if (layer === 1 && !v1) return Math.floor((72 * kbps * 1000) / rate) + pad;
  return Math.floor((144 * kbps * 1000) / rate) + pad;
}

/** True when two MPEG frames follow each other from `o`, or one frame fills the rest of the file. */
function mpegRun(b: Uint8Array, o: number): boolean {
  const len = mpegFrame(b, o);
  if (len === null) return false;
  if (len === 0) return true;
  return o + len === b.length || mpegFrame(b, o + len) !== null;
}

/** The first MPEG frame at or after `from`, searched over a bounded window; -1 when none. */
function firstMpegFrame(b: Uint8Array, from: number): number {
  const stop = Math.min(b.length, from + MAX_SYNC_SCAN);
  for (let o = from; o < stop; o++) if (b[o] === 0xff && mpegRun(b, o)) return o;
  return -1;
}

/** The encoder header an MP3's first frame can carry (Xing, Info or VBRI, and an encoder version). */
function encoderHeader(b: Uint8Array, frame: number): string | null {
  const len = mpegFrame(b, frame) || 0;
  const end = Math.min(b.length, frame + Math.max(len, 0), frame + 2048);
  let header = '';
  let version = '';
  for (let p = frame + 4; p + 4 <= end && !(header && version); p++) {
    const tag = latin1At(b, p, 4);
    if (!header && (tag === 'Xing' || tag === 'Info' || tag === 'VBRI')) header = tag;
    if (!version && (tag === 'LAME' || tag === 'Lavc' || tag === 'Lavf' || tag === 'GOGO')) {
      // The LAME tag's encoder field is nine bytes ("LAME3.100", "Lavc61.19").
      let q = p;
      while (q < end && q < p + 9 && b[q]! >= 0x20 && b[q]! < 0x7f) q++;
      version = latin1At(b, p, q - p).trim();
    }
  }
  if (!header) return null;
  return version ? `${header} header, ${version}` : `${header} header`;
}

function planMp3(b: Uint8Array): Plan {
  const rep = newReport();
  const start = leadingId3(rep, b, 'ID3v2 tag');
  const frame = firstMpegFrame(b, start);
  if (frame < 0) stripRefusal(start > 0 ? 'No MP3 audio follows the ID3 tag.' : 'This is not an MP3 file.');
  const end = trailingTags(rep, b, frame);
  const header = encoderHeader(b, frame);
  if (header) rep.kept.push({ label: 'Encoder header frame', value: clipValue(header), source: 'MP3 first frame' });
  return { report: rep, audio: [[start, end]], build: () => b.slice(start, end) };
}

// ─── FLAC ────────────────────────────────────────────────────────────────────

interface FlacBlock { type: number; start: number; end: number }

function describeFlacBlock(rep: Report, b: Uint8Array, type: number, bs: number, be: number): void {
  const source = 'FLAC metadata block';
  if (type === 1) {
    addItem(rep, 'Padding with leftover data', sizeLabel(be - bs), 'FLAC PADDING block');
    addRemoval(rep, 'padding with leftover data');
    return;
  }
  if (type === 2) {
    const id = latin1At(b, bs, 4);
    if (id === 'C2PA') addItem(rep, 'Content Credentials', 'C2PA manifest store', 'FLAC APPLICATION block');
    else addItem(rep, 'Application data', printableId(id), 'FLAC APPLICATION block');
    addRemoval(rep, id === 'C2PA' ? 'Content Credentials' : 'an APPLICATION block');
    return;
  }
  if (type === 4) {
    const before = rep.items.length;
    const vlen = readLe32(b, bs);
    if (bs + 4 + vlen <= be) {
      const vendor = decodeSlice(b, bs + 4, bs + 4 + vlen, 'utf-8');
      if (clipValue(vendor)) addItem(rep, 'Encoder', vendor, 'FLAC VORBIS_COMMENT vendor');
      let p = bs + 8 + vlen;
      const count = Math.min(readLe32(b, bs + 4 + vlen), MAX_FRAMES);
      for (let i = 0; i < count && p + 4 <= be; i++) {
        const len = readLe32(b, p);
        if (p + 4 + len > be) break;
        describeVorbisComment(rep, b.subarray(p + 4, p + 4 + len), 'FLAC VORBIS_COMMENT');
        p += 4 + len;
      }
    }
    if (rep.items.length === before) addItem(rep, 'Tags', 'empty comment block', 'FLAC VORBIS_COMMENT');
    addRemoval(rep, 'a VORBIS_COMMENT block');
    return;
  }
  if (type === 5) {
    addItem(rep, 'Cue sheet', 'CD track layout', 'FLAC CUESHEET block');
    addRemoval(rep, 'a CUESHEET block');
    return;
  }
  if (type === 6) {
    const mlen = readBe32(b, bs + 4);
    const mime = bs + 8 + mlen <= be ? latin1At(b, bs + 8, Math.min(mlen, 64)) : '';
    addItem(rep, 'Picture', `${mime || 'image'}, ${sizeLabel(be - bs)}`, 'FLAC PICTURE block');
    addRemoval(rep, 'a PICTURE block');
    return;
  }
  addItem(rep, 'Metadata block', `type ${type}, ${sizeLabel(be - bs)}`, source);
  addRemoval(rep, 'a metadata block');
}

function planFlac(b: Uint8Array): Plan {
  const rep = newReport();
  const head = leadingId3(rep, b, 'ID3v2 tag before FLAC');
  if (latin1At(b, head, 4) !== 'fLaC') stripRefusal('This is not a FLAC file.');
  const kept: FlacBlock[] = [];
  let p = head + 4;
  let last = false;
  for (let n = 0; !last; n++) {
    if (n >= MAX_UNITS) stripRefusal('This FLAC file has too many metadata blocks.');
    if (p + 4 > b.length) stripRefusal('A FLAC metadata block header is cut short.');
    last = (b[p]! & 0x80) !== 0;
    const type = b[p]! & 0x7f;
    const bs = p + 4;
    const be = bs + readBe24(b, p + 1);
    if (be > b.length) stripRefusal('A FLAC metadata block runs past the end of the file.');
    if (n === 0 && type !== 0) stripRefusal('A FLAC file must start with a STREAMINFO block.');
    if (n > 0 && type === 0) stripRefusal('A FLAC file has a second STREAMINFO block.');
    if (type === 127) stripRefusal('A FLAC metadata block has an invalid type.');
    if (type === 0 || type === 3 || (type === 1 && !anyNonZero(b, bs, be))) kept.push({ type, start: p, end: be });
    else describeFlacBlock(rep, b, type, bs, be);
    p = be;
  }
  const frames = p;
  if (frames < b.length && !(b[frames] === 0xff && (b[frames + 1]! & 0xfe) === 0xf8)) stripRefusal('No FLAC audio frame follows the metadata.');
  const end = trailingTags(rep, b, frames);
  return {
    report: rep,
    audio: [[frames, end]],
    build: () => {
      const parts: Uint8Array[] = [Uint8Array.of(0x66, 0x4c, 0x61, 0x43)];
      kept.forEach((k, i) => {
        parts.push(Uint8Array.of((i === kept.length - 1 ? 0x80 : 0) | k.type, b[k.start + 1]!, b[k.start + 2]!, b[k.start + 3]!));
        parts.push(b.subarray(k.start + 4, k.end));
      });
      parts.push(b.subarray(frames, end));
      return joinBytes(parts);
    },
  };
}

// ─── WAV ─────────────────────────────────────────────────────────────────────

const INFO_LABELS: Record<string, Label> = {
  INAM: ['Title'], IART: ['Artist', true], ICMT: ['Comment'], ISFT: ['Software'], ICOP: ['Copyright'],
  ICRD: ['Creation date'], IENG: ['Engineer', true], ITCH: ['Technician', true], IGNR: ['Genre'], IPRD: ['Album'],
  ISBJ: ['Subject'], IKEY: ['Keywords'], ISRC: ['Source'], ISRF: ['Source form'], ICMS: ['Commissioned by', true],
  IARL: ['Archival location'], ILNG: ['Language'], IMED: ['Medium'], ITRK: ['Track number'], IPRT: ['Track number'],
};

// Top-level chunks removed whole, with the phrase a residual message uses.
const WAV_DROP: Record<string, string> = {
  'id3 ': 'an ID3 chunk', 'ID3 ': 'an ID3 chunk', bext: 'a bext chunk', iXML: 'an iXML chunk', axml: 'an axml chunk',
  cart: 'a cart chunk', DISP: 'a DISP chunk', umid: 'a umid chunk', _PMX: 'an XMP chunk', 'XMP ': 'an XMP chunk',
  C2PA: 'Content Credentials',
};
const WAV_LISTS = new Set(['INFO', 'adtl', 'exif']);
const WAV_PADDING = new Set(['JUNK', 'junk', 'PAD ', 'FLLR', 'fllr', 'free']);

interface WavChunk { id: string; start: number; end: number; bs: number; be: number }

function describeWavChunk(rep: Report, b: Uint8Array, c: WavChunk): void {
  const source = `WAV ${printableId(c.id)} chunk`;
  if (c.id === 'LIST') {
    const type = latin1At(b, c.bs, 4);
    if (type === 'INFO') {
      const before = rep.items.length;
      let q = c.bs + 4;
      for (let n = 0; n < MAX_FRAMES && q + 8 <= c.be; n++) {
        const id = latin1At(b, q, 4);
        const size = readLe32(b, q + 4);
        if (q + 8 + size > c.be) break;
        const label = ownLabel(INFO_LABELS, id);
        const value = decodeSlice(b, q + 8, q + 8 + size, 'utf-8').split('\u0000')[0] ?? '';
        if (clipValue(value)) addItem(rep, label ? label[0] : `Info field ${printableId(id)}`, value, `WAV INFO ${printableId(id)}`, label?.[1] ?? false);
        q += 8 + size + (size & 1);
      }
      if (rep.items.length === before) addItem(rep, 'Info list', 'empty fields', 'WAV LIST/INFO');
      addRemoval(rep, 'a LIST/INFO chunk');
      return;
    }
    addItem(rep, type === 'adtl' ? 'Cue labels' : 'Exif data', sizeLabel(c.be - c.bs), `WAV LIST/${type}`);
    addRemoval(rep, `a LIST/${type} chunk`);
    return;
  }
  if (WAV_PADDING.has(c.id)) {
    addItem(rep, 'Padding with leftover data', sizeLabel(c.be - c.bs), source);
    addRemoval(rep, 'padding with leftover data');
    return;
  }
  const phrase = ownLabel(WAV_DROP, c.id)!;
  switch (c.id) {
    case 'C2PA': addItem(rep, 'Content Credentials', 'C2PA manifest store', source); break;
    case '_PMX': case 'XMP ': addItem(rep, 'XMP metadata', sizeLabel(c.be - c.bs), source); break;
    case 'iXML': addItem(rep, 'iXML metadata', sizeLabel(c.be - c.bs), source); break;
    case 'axml': addItem(rep, 'EBU Core metadata', sizeLabel(c.be - c.bs), source); break;
    case 'cart': addItem(rep, 'Broadcast cart data', sizeLabel(c.be - c.bs), source); break;
    case 'umid': addItem(rep, 'Material identifier', sizeLabel(c.be - c.bs), source); break;
    case 'DISP': {
      const value = readLe32(b, c.bs) === 1 ? decodeSlice(b, c.bs + 4, c.be, 'latin1').split('\u0000')[0] ?? '' : '';
      addItem(rep, 'Display title', value || sizeLabel(c.be - c.bs), source);
      break;
    }
    case 'bext': {
      const field = (o: number, n: number) => clipValue(decodeSlice(b, c.bs + o, Math.min(c.be, c.bs + o + n), 'latin1').split('\u0000')[0] ?? '');
      const before = rep.items.length;
      if (field(0, 256)) addItem(rep, 'Description', field(0, 256), 'WAV bext');
      if (field(256, 32)) addItem(rep, 'Originator', field(256, 32), 'WAV bext', true);
      if (field(288, 32)) addItem(rep, 'Originator reference', field(288, 32), 'WAV bext');
      if (field(320, 10)) addItem(rep, 'Origination date', `${field(320, 10)} ${field(330, 8)}`, 'WAV bext');
      if (c.be - c.bs > 602 && field(602, MAX_VALUE)) addItem(rep, 'Coding history', field(602, MAX_VALUE), 'WAV bext');
      if (rep.items.length === before) addItem(rep, 'Broadcast metadata', sizeLabel(c.be - c.bs), 'WAV bext');
      break;
    }
    default: {
      // 'id3 ' / 'ID3 ': an ID3v2 tag inside the chunk.
      const inner = b.subarray(c.bs, c.be);
      let tag: Id3Tag | null = null;
      try { tag = id3v2At(inner, 0); } catch { tag = null; }
      if (tag) describeId3v2(rep, inner, tag, 'WAV id3 chunk');
      else addItem(rep, 'ID3 tag', sizeLabel(c.be - c.bs), source);
    }
  }
  addRemoval(rep, phrase);
}

function planWav(b: Uint8Array): Plan {
  const rep = newReport();
  const form = latin1At(b, 0, 4);
  if (form === 'RF64' || form === 'BW64') stripRefusal('RF64 and BW64 files are not supported yet.');
  if (b.length < 12 || form !== 'RIFF' || latin1At(b, 8, 4) !== 'WAVE') stripRefusal('This is not a WAV file.');
  const declared = readLe32(b, 4) + 8;
  const end = declared >= 12 && declared <= b.length ? declared : b.length;
  const keep: WavChunk[] = [];
  const audio: Spans = [];
  let p = 12;
  let sawFmt = false;
  for (let n = 0; p + 8 <= end; n++) {
    if (n >= MAX_UNITS) stripRefusal('This WAV file has too many chunks.');
    const id = latin1At(b, p, 4);
    const size = readLe32(b, p + 4);
    const be = p + 8 + size;
    if (be > end) stripRefusal('A WAV chunk runs past the end of the file.');
    const next = Math.min(be + (size & 1), end); // a final odd chunk may lack its pad byte
    const c: WavChunk = { id, start: p, end: next, bs: p + 8, be };
    if (id === 'fmt ') sawFmt = true;
    if (id === 'data') {
      if (size === 0 && next < end) stripRefusal('This WAV does not record the length of its audio.');
      audio.push([c.bs, c.be]);
    }
    const listType = id === 'LIST' && size >= 4 ? latin1At(b, c.bs, 4) : '';
    const drop = ownLabel(WAV_DROP, id) !== undefined || WAV_LISTS.has(listType) || (WAV_PADDING.has(id) && anyNonZero(b, c.bs, c.be));
    if (drop) describeWavChunk(rep, b, c);
    else keep.push(c);
    p = next;
  }
  if (!sawFmt || !audio.length) stripRefusal('This WAV file has no audio data.');
  const stray = b.subarray(p, end); // fewer than 8 bytes that cannot be a chunk
  let trailing = b.subarray(end);
  const tail = latin1At(trailing, 0, 3);
  if (tail === 'ID3' || tail === 'TAG') {
    let tag: Id3Tag | null = null;
    try { tag = id3v2At(trailing, 0); } catch { tag = null; }
    if (tag) describeId3v2(rep, trailing, tag, 'ID3 tag after the audio');
    else if (tail === 'TAG' && trailing.length >= 128) describeId3v1(rep, trailing, 0);
    else addItem(rep, 'ID3 tag', sizeLabel(trailing.length), 'ID3 tag after the audio');
    addRemoval(rep, 'an ID3 tag after the audio');
    trailing = trailing.subarray(trailing.length);
  }
  return {
    report: rep,
    audio,
    build: () => {
      const header = new Uint8Array(12);
      header.set(b.subarray(0, 4));
      header.set(b.subarray(8, 12), 8);
      const body = keep.map((c) => b.subarray(c.start, c.end));
      const out = joinBytes([header, ...body, stray, trailing]);
      const riff = out.length - 8 - trailing.length;
      out[4] = riff & 0xff; out[5] = (riff >>> 8) & 0xff; out[6] = (riff >>> 16) & 0xff; out[7] = (riff >>> 24) & 0xff;
      return out;
    },
  };
}

// ─── Ogg Opus ────────────────────────────────────────────────────────────────

function planOgg(b: Uint8Array): Plan {
  const rep = newReport();
  const loc = locateOpusComment(b);
  if (!loc) stripRefusal('This Ogg file is not Opus audio. Ogg Vorbis and Ogg FLAC are not supported yet.');
  const tags = parseOpusTags(loc.packet);
  if (!tags) stripRefusal('The Opus comment header is malformed.');
  const vendor = decodeSlice(tags.vendor, 0, tags.vendor.length, 'utf-8');
  if (clipValue(vendor)) addItem(rep, 'Encoder', vendor, 'OpusTags vendor');
  for (const c of tags.comments.slice(0, MAX_FRAMES)) describeVorbisComment(rep, c, 'OpusTags');
  const empty = buildOpusTags(new Uint8Array(0), []);
  const extra = loc.packet.length - buildOpusTags(tags.vendor, tags.comments).length;
  if (extra > 0) addItem(rep, 'Extra comment data', sizeLabel(extra), 'OpusTags');
  if (tags.vendor.length || tags.comments.length || extra > 0) {
    addRemoval(rep, 'Opus comments');
    if (loc.pageCount !== 1) stripRefusal('This Opus file keeps its comments across several pages, which is not supported yet.');
  }
  return {
    report: rep,
    audio: [[0, loc.commentStart], [loc.commentEnd, b.length]],
    build: () => joinBytes([b.subarray(0, loc.commentStart), buildOggPage(loc.first22, empty), b.subarray(loc.commentEnd)]),
  };
}

// ─── MP4 / M4A (ISO BMFF) ────────────────────────────────────────────────────

const C2PA_USERTYPE = [0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c, 0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81];
const XMP_USERTYPE = [0xbe, 0x7a, 0xcf, 0xcb, 0x97, 0xa9, 0x42, 0xe8, 0x9c, 0x71, 0x99, 0x94, 0x91, 0xe3, 0xaf, 0xac];
/** HEIF and AVIF stills share the ftyp grammar; they are pictures, not audio. */
const HEIF_BRANDS = new Set(['avif', 'avis', 'heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'mif2', 'msf1']);

interface Box { off: number; size: number; hdr: number; type: string; end: number }

/** Sibling boxes in [start, end). Throws on a box that runs past its container. */
function bmffBoxes(b: Uint8Array, start: number, end: number): Box[] {
  const out: Box[] = [];
  let off = start;
  while (off < end) {
    if (out.length >= MAX_UNITS) stripRefusal('This MP4 file has too many boxes.');
    if (off + 8 > end) stripRefusal('An MP4 box header is cut short.');
    let size = readBe32(b, off);
    let hdr = 8;
    if (size === 1) {
      if (off + 16 > end) stripRefusal('An MP4 box header is cut short.');
      size = readBe32(b, off + 8) * 2 ** 32 + readBe32(b, off + 12);
      hdr = 16;
    } else if (size === 0) {
      size = end - off; // to the end of the container
    }
    if (!Number.isSafeInteger(size) || size < hdr || off + size > end) stripRefusal('An MP4 box runs past the end of its container.');
    out.push({ off, size, hdr, type: latin1At(b, off + 4, 4), end: off + size });
    off += size;
  }
  return out;
}

/** Boxes in [start, end) for the report only: a malformed run reads as none. */
function bmffBoxesQuiet(b: Uint8Array, start: number, end: number): Box[] {
  try { return bmffBoxes(b, start, end); } catch { return []; }
}

function uuidKind(b: Uint8Array, box: Box): 'c2pa' | 'xmp' | null {
  if (box.type !== 'uuid' || box.size < box.hdr + 16) return null;
  const p = box.off + box.hdr;
  if (C2PA_USERTYPE.every((v, i) => b[p + i] === v)) return 'c2pa';
  if (XMP_USERTYPE.every((v, i) => b[p + i] === v)) return 'xmp';
  return null;
}

const ILST_LABELS: Record<string, Label> = {
  '©nam': ['Title'], '©ART': ['Artist', true], aART: ['Album artist', true], '©alb': ['Album'],
  '©cmt': ['Comment'], desc: ['Description'], ldes: ['Long description'], '©too': ['Encoder'],
  '©enc': ['Encoded by', true], '©day': ['Date'], '©gen': ['Genre'], gnre: ['Genre'],
  '©wrt': ['Composer', true], '©lyr': ['Lyrics'], cprt: ['Copyright'], '©grp': ['Grouping'],
  covr: ['Cover art'], trkn: ['Track number'], disk: ['Disc number'], tmpo: ['Tempo'], apID: ['Account name', true],
  ownr: ['Owner', true], purd: ['Purchase date'], '©pub': ['Publisher'], '©xyz': ['GPS location', true],
  '©mak': ['Device make', true], '©mod': ['Device model', true], '©swr': ['Software'],
  '©inf': ['Information'], '©des': ['Description'], '©aut': ['Author', true], name: ['Name'],
};

const MDTA_LABELS: Record<string, Label> = {
  'com.apple.quicktime.location.ISO6709': ['GPS location', true], 'com.apple.quicktime.make': ['Device make', true],
  'com.apple.quicktime.model': ['Device model', true], 'com.apple.quicktime.software': ['Software'],
  'com.apple.quicktime.creationdate': ['Creation date'], 'com.apple.quicktime.author': ['Author', true],
  'com.apple.quicktime.title': ['Title'], 'com.apple.quicktime.comment': ['Comment'],
  'com.apple.quicktime.description': ['Description'], 'com.android.version': ['Software'],
};

/** The readable value of an iTunes-style item's `data` atom. */
function ilstValue(b: Uint8Array, entry: Box): string {
  for (const d of bmffBoxesQuiet(b, entry.off + entry.hdr, entry.end)) {
    if (d.type !== 'data') continue;
    const p = d.off + d.hdr;
    if (d.end - p < 8) return '';
    const type = readBe32(b, p) & 0xffffff;
    const vs = p + 8;
    if (type === 1) return decodeSlice(b, vs, d.end, 'utf-8');
    if (type === 2) return decodeSlice(b, vs, d.end, 'utf-16be');
    if (type === 13 || type === 14 || type === 27) return `picture, ${sizeLabel(d.end - vs)}`;
    if ((entry.type === 'trkn' || entry.type === 'disk') && d.end - vs >= 6) return `${readBe16(b, vs + 2)} of ${readBe16(b, vs + 4)}`;
    if ((type === 21 || type === 22 || type === 0) && d.end - vs >= 1 && d.end - vs <= 4) {
      let n = 0;
      for (let i = vs; i < d.end; i++) n = n * 256 + b[i]!;
      return String(n);
    }
    return sizeLabel(d.end - vs);
  }
  return '';
}

function describeIlst(rep: Report, b: Uint8Array, ilst: Box, keys: string[] | null, source: string): void {
  for (const entry of bmffBoxesQuiet(b, ilst.off + ilst.hdr, ilst.end).slice(0, MAX_FRAMES)) {
    if (keys) {
      const key = keys[readBe32(b, entry.off + 4) - 1] ?? '';
      const label = ownLabel(MDTA_LABELS, key);
      addItem(rep, label ? label[0] : `Tag ${printableId(key || entry.type)}`, ilstValue(b, entry), source, label?.[1] ?? false);
      continue;
    }
    if (entry.type === '----') {
      const kids = bmffBoxesQuiet(b, entry.off + entry.hdr, entry.end);
      const name = kids.find((k) => k.type === 'name');
      const n = name ? decodeSlice(b, name.off + name.hdr + 4, name.end, 'utf-8') : '';
      addItem(rep, `Tag ${clipValue(n).slice(0, 40) || 'freeform'}`, ilstValue(b, entry), source);
      continue;
    }
    const label = ownLabel(ILST_LABELS, entry.type);
    addItem(rep, label ? label[0] : `Tag ${printableId(entry.type)}`, ilstValue(b, entry), source, label?.[1] ?? false);
  }
}

/** List a `meta` box: iTunes `ilst`, QuickTime keys, or an ID3 tag. */
function describeMeta(rep: Report, b: Uint8Array, meta: Box, source: string): void {
  const p = meta.off + meta.hdr;
  const start = latin1At(b, p + 4, 4) === 'hdlr' ? p : p + 4; // QuickTime writes meta without version and flags
  const kids = bmffBoxesQuiet(b, start, meta.end);
  const hdlr = kids.find((k) => k.type === 'hdlr');
  const handler = hdlr ? latin1At(b, hdlr.off + hdlr.hdr + 8, 4) : '';
  let keys: string[] | null = null;
  if (handler === 'mdta') {
    const k = kids.find((x) => x.type === 'keys');
    keys = [];
    if (k) {
      let q = k.off + k.hdr + 8;
      const count = Math.min(readBe32(b, k.off + k.hdr + 4), MAX_FRAMES);
      for (let i = 0; i < count && q + 8 <= k.end; i++) {
        const size = readBe32(b, q);
        if (size < 8 || q + size > k.end) break;
        keys.push(latin1At(b, q + 8, size - 8));
        q += size;
      }
    }
  }
  for (const k of kids) {
    if (k.type === 'ilst') describeIlst(rep, b, k, keys, source);
    else if (k.type === 'ID32') {
      const inner = b.subarray(k.off + k.hdr + 6, k.end);
      let tag: Id3Tag | null = null;
      try { tag = id3v2At(inner, 0); } catch { tag = null; }
      if (tag) describeId3v2(rep, inner, tag, `${source} ID3`);
    } else if (k.type === 'xml ' || k.type === 'XMP_') addItem(rep, 'XML metadata', sizeLabel(k.end - k.off), source);
  }
}

/** QuickTime user-data text atom: 16-bit length, 16-bit language, text. */
function qtText(b: Uint8Array, box: Box): string {
  const p = box.off + box.hdr;
  const len = readBe16(b, p);
  return len > 0 && p + 4 + len <= box.end ? decodeSlice(b, p + 4, p + 4 + len, 'utf-8') : decodeSlice(b, p, box.end, 'utf-8');
}

function describeUdta(rep: Report, b: Uint8Array, udta: Box, source: string): void {
  for (const k of bmffBoxesQuiet(b, udta.off + udta.hdr, udta.end).slice(0, MAX_FRAMES)) {
    if (k.type === 'meta') describeMeta(rep, b, k, `${source} meta`);
    else if (k.type === 'XMP_') addItem(rep, 'XMP metadata', sizeLabel(k.size), source);
    else if (k.type === 'chpl') addItem(rep, 'Chapters', 'chapter list', source);
    else if (k.type === 'free' || k.type === 'skip') continue;
    else if (ownLabel(ILST_LABELS, k.type)) { const l = ownLabel(ILST_LABELS, k.type)!; addItem(rep, l[0], qtText(b, k), source, l[1] ?? false); }
    else addItem(rep, `User data ${printableId(k.type)}`, sizeLabel(k.size), source);
  }
}

function mp4Date(secs: number): string {
  const unix = secs - 2082844800;
  if (!(unix > 0) || !Number.isFinite(unix)) return 'recorded';
  const d = new Date(unix * 1000);
  return Number.isNaN(d.getTime()) ? 'recorded' : `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/**
 * Should this box go? Records what it held. Applies at the top level and inside
 * the movie and its tracks; `top` adds the boxes only a file's top level may hold.
 */
function dropBox(rep: Report, b: Uint8Array, box: Box, where: string, top: boolean): boolean {
  const kind = uuidKind(b, box);
  if (kind === 'c2pa') {
    const p = box.off + box.hdr + 20;
    const purpose = latin1At(b, p, Math.max(0, termEnd(b, p, box.end, false) - p));
    addItem(rep, 'Content Credentials', purpose === 'merkle' ? 'C2PA fragment hashes' : 'C2PA manifest store', `MP4 ${where} uuid box`);
    addRemoval(rep, 'Content Credentials (a C2PA box)');
    return true;
  }
  if (kind === 'xmp') {
    addItem(rep, 'XMP metadata', sizeLabel(box.size), `MP4 ${where} uuid box`);
    addRemoval(rep, 'an XMP box');
    return true;
  }
  if (box.type === 'udta') {
    const before = rep.items.length;
    describeUdta(rep, b, box, `MP4 ${where} udta`);
    if (rep.items.length === before) addItem(rep, 'User data box', sizeLabel(box.size), `MP4 ${where} udta`);
    addRemoval(rep, 'a udta metadata box');
    return true;
  }
  if (box.type === 'meta') {
    const before = rep.items.length;
    describeMeta(rep, b, box, `MP4 ${where} meta`);
    if (rep.items.length === before) addItem(rep, 'Metadata box', sizeLabel(box.size), `MP4 ${where} meta`);
    addRemoval(rep, 'a meta metadata box');
    return true;
  }
  if (top && box.type === 'jumb') {
    addItem(rep, 'Content Credentials', 'JUMBF box', 'MP4 top-level jumb box');
    addRemoval(rep, 'Content Credentials (a JUMBF box)');
    return true;
  }
  if ((box.type === 'free' || box.type === 'skip') && anyNonZero(b, box.off + box.hdr, box.end)) {
    addItem(rep, 'Padding with leftover data', sizeLabel(box.size - box.hdr), `MP4 ${where} ${box.type} box`);
    addRemoval(rep, 'padding with leftover data');
    return true;
  }
  return false;
}

/** A run of absolute file offsets to move: `count` values `stride` bytes apart, 4 or 8 bytes wide. */
interface Slot { pos: number; count: number; stride: number; wide: boolean }

/** The chunk offset table of an `stco`/`co64` box, relative to the box start. */
function chunkSlot(b: Uint8Array, k: Box): Slot {
  const p = k.off + k.hdr;
  if (k.end - p < 8) stripRefusal('An MP4 chunk offset table is cut short.');
  const wide = k.type === 'co64';
  const count = readBe32(b, p + 4);
  if (8 + count * (wide ? 8 : 4) > k.end - p) stripRefusal('An MP4 chunk offset table claims more entries than it holds.');
  return { pos: k.hdr + 8, count, stride: wide ? 8 : 4, wide };
}

/** Empty a handler name (`mdia`/`minf` hdlr); null when it is already empty. */
function blankHandler(rep: Report, b: Uint8Array, k: Box, parent: string): Uint8Array | null {
  const p = k.off + k.hdr;
  if (k.end - p < 24) return null;
  if (parent === 'mdia' && latin1At(b, p + 8, 4) === 'vide') rep.video = true;
  const ns = p + 24;
  if (!anyNonZero(b, ns, k.end)) return null;
  const counted = b[ns]! === k.end - ns - 1; // QuickTime writes a length-prefixed name
  addItem(rep, 'Handler description', decodeSlice(b, counted ? ns + 1 : ns, k.end, 'utf-8').split('\u0000')[0] ?? '', `MP4 ${parent} hdlr`);
  addRemoval(rep, 'a handler name');
  const out = new Uint8Array(8 + 24 + 1);
  putBe32(out, 0, out.length);
  out.set(b.subarray(k.off + 4, k.off + 8), 4);
  out.set(b.subarray(p, p + 24), 8);
  return out;
}

/** Zero the creation and modification times of `mvhd`, `tkhd` or `mdhd`; null when they are zero already. */
function clearTimes(rep: Report, b: Uint8Array, k: Box): Uint8Array | null {
  const p = k.off + k.hdr;
  const v = b[p];
  if (v !== 0 && v !== 1) return null;
  const span = v === 1 ? 16 : 8;
  if (k.end - p < 4 + span) stripRefusal('An MP4 header box is cut short.');
  if (!anyNonZero(b, p + 4, p + 4 + span)) return null;
  if (!rep.timesShown) {
    const created = v === 1 ? readBe32(b, p + 4) * 2 ** 32 + readBe32(b, p + 8) : readBe32(b, p + 4);
    const modified = v === 1 ? readBe32(b, p + 12) * 2 ** 32 + readBe32(b, p + 16) : readBe32(b, p + 8);
    addItem(rep, 'Creation time', mp4Date(created || modified), `MP4 ${k.type}`);
    rep.timesShown = true;
  }
  addRemoval(rep, 'creation and modification times');
  const out = b.slice(k.off, k.end);
  out.fill(0, k.hdr + 4, k.hdr + 4 + span);
  return out;
}

const MP4_CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl']);
const MP4_TIMED = new Set(['mvhd', 'tkhd', 'mdhd']);

interface Rebuilt { bytes: Uint8Array; changed: boolean; slots: Slot[] }

/** Rebuild a movie container without its metadata. Slot positions are relative to the returned box. */
function rebuildMovieBox(rep: Report, b: Uint8Array, box: Box, depth: number): Rebuilt {
  if (depth > MP4_NEST_DEPTH) stripRefusal('The MP4 movie header nests too deeply.');
  const parts: Uint8Array[] = [];
  const slots: Slot[] = [];
  let len = 0;
  let changed = false;
  for (const k of bmffBoxes(b, box.off + box.hdr, box.end)) {
    if (box.type !== 'stbl' && dropBox(rep, b, k, box.type, false)) { changed = true; continue; }
    let piece = b.subarray(k.off, k.end);
    let inner: Slot[] = [];
    if (MP4_CONTAINERS.has(k.type)) {
      const r = rebuildMovieBox(rep, b, k, depth + 1);
      if (r.changed) { piece = r.bytes; changed = true; }
      inner = r.slots;
    } else if (k.type === 'hdlr' && (box.type === 'mdia' || box.type === 'minf')) {
      const h = blankHandler(rep, b, k, box.type);
      if (h) { piece = h; changed = true; }
    } else if (MP4_TIMED.has(k.type)) {
      const t = clearTimes(rep, b, k);
      if (t) { piece = t; changed = true; }
    } else if (box.type === 'stbl' && (k.type === 'stco' || k.type === 'co64')) {
      inner = [chunkSlot(b, k)];
    }
    for (const s of inner) slots.push({ ...s, pos: s.pos + len });
    parts.push(piece);
    len += piece.length;
  }
  if (!changed) return { bytes: b.subarray(box.off, box.end), changed, slots: slots.map((s) => ({ ...s, pos: s.pos + box.hdr })) };
  if (8 + len > 0xffffffff) stripRefusal('The MP4 movie header is too large to rewrite.');
  const head = new Uint8Array(8);
  putBe32(head, 0, 8 + len);
  head.set(b.subarray(box.off + 4, box.off + 8), 4);
  return { bytes: joinBytes([head, ...parts]), changed, slots: slots.map((s) => ({ ...s, pos: s.pos + 8 })) };
}

/** `tfhd` base data offsets in a movie fragment, relative to the `moof` start. */
function fragmentSlots(b: Uint8Array, moof: Box): Slot[] {
  const slots: Slot[] = [];
  for (const traf of bmffBoxes(b, moof.off + moof.hdr, moof.end)) {
    if (traf.type !== 'traf') continue;
    for (const k of bmffBoxes(b, traf.off + traf.hdr, traf.end)) {
      if (k.type !== 'tfhd') continue;
      const p = k.off + k.hdr;
      if (k.end - p < 8) stripRefusal('An MP4 fragment header is cut short.');
      if (!(readBe24(b, p + 1) & 1)) continue;
      if (k.end - p < 16) stripRefusal('An MP4 fragment header is cut short.');
      slots.push({ pos: p + 8 - moof.off, count: 1, stride: 8, wide: true });
    }
  }
  return slots;
}

/** `tfra` fragment offsets in a fragment random-access box, relative to the `mfra` start. */
function randomAccessSlots(b: Uint8Array, mfra: Box): Slot[] {
  const slots: Slot[] = [];
  for (const k of bmffBoxes(b, mfra.off + mfra.hdr, mfra.end)) {
    if (k.type !== 'tfra') continue;
    const p = k.off + k.hdr;
    if (k.end - p < 16) stripRefusal('An MP4 fragment index is cut short.');
    const wide = b[p] === 1;
    const sizes = readBe32(b, p + 8);
    const entry = (wide ? 16 : 8) + ((sizes >> 4) & 3) + ((sizes >> 2) & 3) + (sizes & 3) + 3;
    const count = readBe32(b, p + 12);
    if (16 + count * entry > k.end - p) stripRefusal('An MP4 fragment index claims more entries than it holds.');
    if (count) slots.push({ pos: p + 16 + (wide ? 8 : 4) - mfra.off, count, stride: entry, wide });
  }
  return slots;
}

interface Piece { box: Box; dropped: boolean; bytes: Uint8Array | null; slots: Slot[] }

function planMp4(b: Uint8Array): Plan {
  const rep = newReport();
  const top = bmffBoxes(b, 0, b.length);
  if (!top.length || top[0]!.type !== 'ftyp') stripRefusal('This is not an MP4 or M4A file.');
  if (HEIF_BRANDS.has(latin1At(b, 8, 4))) stripRefusal('This is a HEIF or AVIF picture, not audio.');
  if (!top.some((x) => x.type === 'moov')) stripRefusal('This MP4 has no movie header, so it is not an audio or video file.');
  const pieces: Piece[] = top.map((box) => {
    if (dropBox(rep, b, box, 'top-level', true)) return { box, dropped: true, bytes: null, slots: [] };
    if (box.type === 'moov') {
      const r = rebuildMovieBox(rep, b, box, 0);
      return { box, dropped: false, bytes: r.changed ? r.bytes : null, slots: r.slots };
    }
    if (box.type === 'moof') return { box, dropped: false, bytes: null, slots: fragmentSlots(b, box) };
    if (box.type === 'mfra') return { box, dropped: false, bytes: null, slots: randomAccessSlots(b, box) };
    return { box, dropped: false, bytes: null, slots: [] };
  });
  // Fragments index each other by relative distance (sidx), so nothing between
  // the first fragment and the last may change size.
  const frag = top.filter((x) => x.type === 'moof' || x.type === 'sidx');
  if (top.some((x) => x.type === 'moof')) {
    const first = frag.reduce((m, x) => Math.min(m, x.off), Number.POSITIVE_INFINITY);
    const last = top.reduce((m, x) => (x.off >= first && (x.type === 'moof' || x.type === 'mdat' || x.type === 'sidx') ? Math.max(m, x.end) : m), first);
    if (pieces.some((p) => (p.dropped || p.bytes) && p.box.off >= first && p.box.off < last)) {
      stripRefusal('This fragmented MP4 holds metadata between its fragments, which is not supported yet.');
    }
  }
  const audio: Spans = top.filter((x) => x.type === 'mdat').map((x) => [x.off + x.hdr, x.end]);
  return {
    report: rep,
    audio,
    build: () => {
      const at = new Map<Box, number>();
      const parts: Uint8Array[] = [];
      let pos = 0;
      for (const p of pieces) {
        if (p.dropped) continue;
        const bytes = p.bytes ?? b.subarray(p.box.off, p.box.end);
        at.set(p.box, pos);
        parts.push(bytes);
        pos += bytes.length;
      }
      const out = joinBytes(parts);
      // An absolute offset must point into a box copied verbatim; it moves by that box's shift.
      const verbatim = pieces.filter((p) => !p.dropped && !p.bytes).map((p) => p.box);
      const move = (x: number): number => {
        if (x === b.length) return out.length;
        let lo = 0;
        let hi = verbatim.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const v = verbatim[mid]!;
          if (x < v.off) hi = mid - 1;
          else if (x >= v.end) lo = mid + 1;
          else return at.get(v)! + (x - v.off);
        }
        return stripRefusal('A media offset in this MP4 points outside its media data.');
      };
      for (const p of pieces) {
        if (p.dropped) continue;
        const base = at.get(p.box)!;
        for (const s of p.slots) {
          for (let i = 0; i < s.count; i++) {
            const o = base + s.pos + i * s.stride;
            if (s.wide) {
              const moved = move(readBe32(out, o) * 2 ** 32 + readBe32(out, o + 4));
              putBe32(out, o, Math.floor(moved / 2 ** 32));
              putBe32(out, o + 4, moved >>> 0);
            } else {
              putBe32(out, o, move(readBe32(out, o)));
            }
          }
        }
      }
      return out;
    },
  };
}

// ─── public surface ──────────────────────────────────────────────────────────

/**
 * The audio container `bytes` holds, or null. M4A and other ISO BMFF movies read as
 * 'mp4' (HEIF and AVIF stills do not); a leading ID3 tag reads as 'mp3' unless
 * `fLaC` follows it; a bare MP3 needs two consecutive MPEG frames; Ogg counts only
 * when it carries Opus. RF64 reads as 'wav' so a caller can report that it is not
 * supported yet.
 */
export function sniffAudioFormat(bytes: Uint8Array): AudioStripFormat | null {
  if (bytes.length < 12) return null;
  const head = latin1At(bytes, 0, 4);
  if ((head === 'RIFF' && latin1At(bytes, 8, 4) === 'WAVE') || head === 'RF64' || head === 'BW64') return 'wav';
  if (head === 'fLaC') return 'flac';
  if (head === 'OggS') return latin1At(bytes, 0, Math.min(bytes.length, 80)).includes('OpusHead') ? 'ogg' : null;
  if (latin1At(bytes, 4, 4) === 'ftyp') return HEIF_BRANDS.has(latin1At(bytes, 8, 4)) ? null : 'mp4';
  if (latin1At(bytes, 0, 3) === 'ID3') {
    let p = 0;
    try {
      for (let i = 0; i < MAX_TAGS; i++) { const tag = id3v2At(bytes, p); if (!tag) break; p = tag.end; }
    } catch {
      return 'mp3';
    }
    return latin1At(bytes, p, 4) === 'fLaC' ? 'flac' : 'mp3';
  }
  const len = mpegFrame(bytes, 0);
  return len && mpegFrame(bytes, len) !== null ? 'mp3' : null;
}

function planStrip(bytes: Uint8Array, format: AudioStripFormat): Plan {
  switch (format) {
    case 'mp4': return planMp4(bytes);
    case 'wav': return planWav(bytes);
    case 'mp3': return planMp3(bytes);
    case 'flac': return planFlac(bytes);
    case 'ogg': return planOgg(bytes);
    default: return stripRefusal(`Unsupported audio format: ${String(format)}`);
  }
}

/**
 * What a strip of `bytes` would remove, read without changing anything. Throws a
 * plain-language Error when the file does not walk cleanly as `format`.
 */
export function inspectAudioMetadata(bytes: Uint8Array, format: AudioStripFormat): AudioInspection {
  const { report } = planStrip(bytes, format);
  return { format, items: report.items, removals: report.removals, kept: report.kept, video: report.video };
}

/**
 * Verify-after-strip: what in `bytes` a strip would still remove, as a short phrase,
 * or null when there is nothing. Throws when the file does not walk cleanly.
 */
export function audioMetadataResidual(bytes: Uint8Array, format: AudioStripFormat): string | null {
  return planStrip(bytes, format).report.removals[0] ?? null;
}

function sameAudio(a: Uint8Array, aSpans: Spans, b: Uint8Array, bSpans: Spans): boolean {
  let ai = 0;
  let ao = aSpans[0]?.[0] ?? 0;
  let bi = 0;
  let bo = bSpans[0]?.[0] ?? 0;
  for (;;) {
    while (ai < aSpans.length && ao >= aSpans[ai]![1]) { ai++; ao = aSpans[ai]?.[0] ?? 0; }
    while (bi < bSpans.length && bo >= bSpans[bi]![1]) { bi++; bo = bSpans[bi]?.[0] ?? 0; }
    if (ai === aSpans.length || bi === bSpans.length) return ai === aSpans.length && bi === bSpans.length;
    const n = Math.min(aSpans[ai]![1] - ao, bSpans[bi]![1] - bo);
    for (let i = 0; i < n; i++) if (a[ao + i] !== b[bo + i]) return false;
    ao += n;
    bo += n;
  }
}

/**
 * A copy of `bytes` without its tags, Content Credentials and other hidden data
 * (see the module header for each format). The audio payload is byte-identical.
 * Returns `bytes` itself when there is nothing to remove. Fails closed: throws when
 * the file does not walk cleanly, when the copy still holds removable data or no
 * longer parses, or when its audio bytes differ from the original's.
 */
export function stripAudioMetadata(bytes: Uint8Array, format: AudioStripFormat): Uint8Array {
  const first = planStrip(bytes, format);
  if (!first.report.removals.length) return bytes;
  const out = first.build();
  let again: Plan;
  try {
    again = planStrip(out, format);
  } catch (err) {
    return stripRefusal(`The clean copy did not read back: ${(err as Error).message}`);
  }
  if (again.report.removals.length) stripRefusal(`The clean copy still contains ${again.report.removals[0]}.`);
  if (!sameAudio(bytes, first.audio, out, again.audio)) stripRefusal('The clean copy changed the audio data.');
  return out;
}
