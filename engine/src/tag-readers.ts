// SPDX-License-Identifier: MPL-2.0
/**
 * Rights and credit statements from tag carriers: ID3v2 frames, Vorbis comments
 * (FLAC, Ogg Opus, Ogg Vorbis), Matroska tags and the property parts of an Office
 * package. file-metadata.ts calls these for the formats it sniffs.
 *
 * A field is evidence of what the file STATES. Each value is the text of one tag,
 * with the carrier and tag as its source. Nothing is interpreted: a URL is recorded
 * as written, and two statements stay two fields.
 *
 * The input is untrusted. Every offset is checked before the read, every declared
 * length is compared with the bytes that remain, every loop has a fixed cap as
 * well as its byte bound, and each value has its control characters replaced and
 * its length capped. A structure that does not read yields fewer fields. No reader
 * here throws.
 *
 * Read only. strip-audio.ts owns removal and has its own walkers, because a strip
 * fails closed where a reader is best effort.
 */
import type { MetaField } from './file-metadata.ts';
import { OFFICE_MAX_XML_BYTES, officeText, readOfficeXml, type OfficeXmlNode } from './office-xml.ts';
import { decodeZipMember, readZipMembers, type ZipRawMember } from './zip.ts';

/** Fields one carrier may add. file-metadata.ts applies its own cap to the whole file. */
const MAX_TAG_FIELDS = 32;
const MAX_VALUE_CHARS = 2048;
/** Bytes of one tag body or comment packet that are examined. */
const MAX_TAG_BYTES = 4 * 1024 * 1024;
/** ID3v2 tags stacked at the front of a file. */
const MAX_ID3_TAGS = 4;
const MAX_ID3_FRAMES = 1024;
const MAX_VORBIS_COMMENTS = 1024;
const MAX_VORBIS_KEY_BYTES = 64;
const MAX_FLAC_BLOCKS = 128;
const MAX_OGG_PAGES = 64;
/** Segment children walked: a long recording holds thousands of clusters before its tags. */
const MAX_EBML_SEGMENT_CHILDREN = 65536;
/** Elements read inside every Tags element of one file. */
const MAX_EBML_TAG_ELEMENTS = 2048;
const MAX_OFFICE_ENTRIES = 4096;
const MAX_OFFICE_PROPERTIES = 512;

type TagSpec = readonly [label: string, sensitive?: boolean];

/** A spec for a key read from the file; `constructor` and its kin never reach the prototype. */
const own = (map: Record<string, TagSpec>, key: string): TagSpec | undefined => (Object.hasOwn(map, key) ? map[key] : undefined);

/** Control characters become spaces, runs of space collapse, and the length is capped. */
function tidy(raw: string): string {
  const s = raw.slice(0, MAX_VALUE_CHARS * 4).replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim();
  return s.length > MAX_VALUE_CHARS ? `${s.slice(0, MAX_VALUE_CHARS)}…` : s;
}

function add(out: MetaField[], spec: TagSpec, raw: string, source: string): void {
  if (out.length >= MAX_TAG_FIELDS) return;
  const value = tidy(raw);
  if (!value || out.some((f) => f.label === spec[0] && f.value === value && f.source === source)) return;
  out.push({ label: spec[0], value, group: 'authorship', source, ...(spec[1] ? { sensitive: true } : {}) });
}

/** A bounded slice decoded for display; a label this runtime does not know reads as ''. */
function decode(b: Uint8Array, start: number, end: number, encoding: string): string {
  if (start < 0 || end <= start || start >= b.length) return '';
  try {
    return new TextDecoder(encoding).decode(b.subarray(start, Math.min(end, b.length, start + MAX_VALUE_CHARS * 4)));
  } catch {
    return '';
  }
}

const ascii = (b: Uint8Array, o: number, s: string): boolean => {
  if (o < 0 || o + s.length > b.length) return false;
  for (let i = 0; i < s.length; i++) if (b[o + i] !== s.charCodeAt(i)) return false;
  return true;
};
const le32 = (b: Uint8Array, o: number): number => ((b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0);
const be32 = (b: Uint8Array, o: number): number => (((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0);
const be24 = (b: Uint8Array, o: number): number => (b[o]! << 16) | (b[o + 1]! << 8) | b[o + 2]!;

// ── ID3v2 ────────────────────────────────────────────────────────────────────
//
// TCOP is the copyright message, WCOP the address of the copyright or licence
// terms, USER the terms of use and TPE1 the lead performer (ID3v2.3 section 4,
// ID3v2.4 frames document). TCR, WCP and TP1 are their ID3v2.2 forms.

const ID3_FRAMES: Record<string, TagSpec> = {
  TCOP: ['Copyright'], TCR: ['Copyright'],
  WCOP: ['Rights statement'], WCP: ['Rights statement'],
  USER: ['Usage terms'],
  TPE1: ['Artist', true], TP1: ['Artist', true],
};

/** A four-byte syncsafe integer, or -1 when a byte has its high bit set. */
function syncsafe(b: Uint8Array, o: number): number {
  if (o + 4 > b.length) return -1;
  if ((b[o]! | b[o + 1]! | b[o + 2]! | b[o + 3]!) & 0x80) return -1;
  return (b[o]! << 21) | (b[o + 1]! << 14) | (b[o + 2]! << 7) | b[o + 3]!;
}

interface Id3Tag { version: number; flags: number; bodyStart: number; bodyEnd: number; end: number }

/** The ID3v2 tag header at `p`. `end` is where the tag says it stops, which may be past the file. */
function id3TagAt(b: Uint8Array, p: number): Id3Tag | null {
  if (p + 10 > b.length || !ascii(b, p, 'ID3')) return null;
  const version = b[p + 3]!;
  const size = syncsafe(b, p + 6);
  if (version < 2 || version > 4 || b[p + 4] === 0xff || size < 0) return null;
  const flags = b[p + 5]!;
  const bodyStart = p + 10;
  return { version, flags, bodyStart, bodyEnd: bodyStart + size, end: bodyStart + size + (version === 4 && flags & 0x10 ? 10 : 0) };
}

/** Undo unsynchronisation: 0xFF 0x00 becomes 0xFF. The copy is no longer than the input. */
function deunsync(b: Uint8Array): Uint8Array {
  const out = new Uint8Array(b.length);
  let n = 0;
  for (let i = 0; i < b.length; i++) {
    out[n++] = b[i]!;
    if (b[i] === 0xff && b[i + 1] === 0x00) i++;
  }
  return out.subarray(0, n);
}

/** Text of an ID3 text field: encoding 0 Latin-1, 1 UTF-16 with a byte order mark, 2 UTF-16BE, 3 UTF-8. */
function id3Text(f: Uint8Array, start: number, encoding: number): string {
  const label = encoding === 3 ? 'utf-8'
    : encoding === 2 || (encoding === 1 && f[start] === 0xfe && f[start + 1] === 0xff) ? 'utf-16be'
    : encoding === 1 ? 'utf-16le'
    : 'windows-1252';
  return decode(f, start, f.length, label);
}

function readId3Frame(out: MetaField[], id: string, f: Uint8Array): void {
  const spec = own(ID3_FRAMES, id);
  if (!spec || !f.length) return;
  const source = `ID3 ${id}`;
  if (id[0] === 'W') {
    // A URL frame is Latin-1 with no encoding byte and ends at the first NUL.
    add(out, spec, decode(f, 0, f.length, 'windows-1252').split('\0')[0] ?? '', source);
    return;
  }
  // USER is encoding, a three-letter language, then the text. Text frames are encoding, then
  // the text, and ID3v2.4 allows several values separated by NUL: each stays its own field.
  const raw = id === 'USER' ? id3Text(f, 4, f[0]!) : id3Text(f, 1, f[0]!);
  for (const part of raw.split('\0').slice(0, 8)) add(out, spec, part, source);
}

function readId3Tag(out: MetaField[], b: Uint8Array, tag: Id3Tag): void {
  let body = b.subarray(tag.bodyStart, Math.min(tag.bodyEnd, b.length, tag.bodyStart + MAX_TAG_BYTES));
  if (tag.flags & 0x80 && tag.version < 4) body = deunsync(body);
  let p = 0;
  if (tag.flags & 0x40 && tag.version > 2) {
    // The extended header: ID3v2.3 counts the bytes after its size field, ID3v2.4 counts them all.
    if (body.length < 4) return;
    const skip = tag.version === 3 ? 4 + be32(body, 0) : syncsafe(body, 0);
    if (skip < 4 || skip > body.length) return;
    p = skip;
  }
  const idLength = tag.version === 2 ? 3 : 4;
  const header = tag.version === 2 ? 6 : 10;
  for (let i = 0; i < MAX_ID3_FRAMES && p + header <= body.length && body[p] !== 0; i++) {
    let id = '';
    for (let k = 0; k < idLength; k++) id += String.fromCharCode(body[p + k]!);
    const size = tag.version === 2 ? be24(body, p + 3) : tag.version === 4 ? syncsafe(body, p + 4) : be32(body, p + 4);
    const start = p + header;
    if (size < 0 || size > body.length - start || !/^[A-Z0-9]+$/.test(id)) return;
    let frame = body.subarray(start, start + size);
    const format = tag.version === 2 ? 0 : body[p + 9]!;
    let readable = true;
    if (tag.version === 4) {
      if (format & 0x0c) readable = false; // compressed or encrypted
      if (format & 0x40) frame = frame.subarray(1); // group identifier
      if (format & 0x01) frame = frame.subarray(4); // data length indicator
      if (format & 0x02) frame = deunsync(frame);
    } else if (tag.version === 3) {
      if (format & 0xc0) readable = false;
      if (format & 0x20) frame = frame.subarray(1);
    }
    if (readable) readId3Frame(out, id, frame);
    p = start + size;
  }
}

/** Where the leading ID3v2 tags end: the offset of the audio or of the `fLaC` marker behind them. */
function afterId3(b: Uint8Array): number {
  let p = 0;
  for (let i = 0; i < MAX_ID3_TAGS; i++) {
    const tag = id3TagAt(b, p);
    if (!tag || tag.end > b.length) break;
    p = tag.end;
  }
  return p;
}

/** Rights and credit frames from the ID3v2 tags at the front of an MP3. */
export function readId3Rights(bytes: Uint8Array): MetaField[] {
  const out: MetaField[] = [];
  try {
    let p = 0;
    for (let i = 0; i < MAX_ID3_TAGS; i++) {
      const tag = id3TagAt(bytes, p);
      if (!tag) break;
      readId3Tag(out, bytes, tag);
      if (tag.end > bytes.length) break; // truncated: what was readable has been read
      p = tag.end;
    }
  } catch { /* best effort */ }
  return out;
}

// ── Vorbis comments ──────────────────────────────────────────────────────────
//
// One comment list grammar, three homes: a FLAC VORBIS_COMMENT block, the OpusTags
// packet and the Vorbis comment header. LICENSE and COPYRIGHT are the field names
// the Vorbis comment specification proposes; keys compare without regard to case.

const VORBIS_KEYS: Record<string, TagSpec> = {
  LICENSE: ['Licence'], COPYRIGHT: ['Copyright'], ARTIST: ['Artist', true],
};

function readVorbisComments(out: MetaField[], b: Uint8Array, start: number, end: number): void {
  let p = start;
  if (p + 4 > end) return;
  const vendor = le32(b, p);
  p += 4;
  if (vendor > end - p) return;
  p += vendor;
  if (p + 4 > end) return;
  const count = le32(b, p);
  p += 4;
  for (let i = 0; i < count && i < MAX_VORBIS_COMMENTS && p + 4 <= end; i++) {
    const length = le32(b, p);
    p += 4;
    if (length > end - p) return;
    let key = '';
    let eq = -1;
    for (let k = 0; k < length && k < MAX_VORBIS_KEY_BYTES; k++) {
      const c = b[p + k]!;
      if (c === 0x3d) { eq = k; break; }
      key += String.fromCharCode(c);
    }
    key = key.toUpperCase();
    const spec = eq > 0 ? own(VORBIS_KEYS, key) : undefined;
    if (spec) add(out, spec, decode(b, p + eq + 1, p + length, 'utf-8'), `Vorbis ${key}`);
    p += length;
  }
}

/** True when a FLAC stream starts the file, straight away or behind ID3v2 tags. */
export function isFlac(bytes: Uint8Array): boolean {
  return ascii(bytes, afterId3(bytes), 'fLaC');
}

/** Rights and credit comments from a FLAC file's VORBIS_COMMENT block. */
export function readFlacRights(bytes: Uint8Array): MetaField[] {
  const out: MetaField[] = [];
  try {
    let p = afterId3(bytes);
    if (!ascii(bytes, p, 'fLaC')) return out;
    p += 4;
    // Metadata blocks: one byte (last-block flag and type), a 24-bit length, the body.
    for (let i = 0; i < MAX_FLAC_BLOCKS && p + 4 <= bytes.length; i++) {
      const head = bytes[p]!;
      const length = be24(bytes, p + 1);
      const body = p + 4;
      if ((head & 0x7f) === 4) readVorbisComments(out, bytes, body, Math.min(body + length, bytes.length, body + MAX_TAG_BYTES));
      if (head & 0x80) break;
      p = body + length;
    }
  } catch { /* best effort */ }
  return out;
}

/**
 * What the first page of an Ogg file identifies: 'Ogg' for Opus (the one Ogg mapping
 * strip-audio.ts cleans, under the same name), 'Ogg Vorbis', or '' for any other stream.
 */
export function oggKind(bytes: Uint8Array): 'Ogg' | 'Ogg Vorbis' | '' {
  if (bytes.length < 28 || !ascii(bytes, 0, 'OggS')) return '';
  const body = 27 + bytes[26]!;
  if (ascii(bytes, body, 'OpusHead')) return 'Ogg';
  return bytes[body] === 1 && ascii(bytes, body + 1, 'vorbis') ? 'Ogg Vorbis' : '';
}

/** Rights and credit comments from the comment header of an Ogg Opus or Ogg Vorbis stream. */
export function readOggRights(bytes: Uint8Array): MetaField[] {
  const out: MetaField[] = [];
  try {
    const parts: Uint8Array[] = [];
    let total = 0;
    let serial = -1;
    let listAt = 0;
    let p = 0;
    for (let i = 0; i < MAX_OGG_PAGES && p + 27 <= bytes.length && ascii(bytes, p, 'OggS'); i++) {
      const segments = bytes[p + 26]!;
      const bodyStart = p + 27 + segments;
      if (bodyStart > bytes.length) break;
      let bodyLength = 0;
      for (let k = 0; k < segments; k++) bodyLength += bytes[p + 27 + k]!;
      const bodyEnd = Math.min(bodyStart + bodyLength, bytes.length);
      const pageSerial = le32(bytes, p + 14);
      if (serial < 0) {
        // The comment header starts a page of its own in both mappings.
        if (ascii(bytes, bodyStart, 'OpusTags')) listAt = 8;
        else if (bytes[bodyStart] === 3 && ascii(bytes, bodyStart + 1, 'vorbis')) listAt = 7;
        if (listAt) serial = pageSerial;
      }
      if (serial >= 0 && pageSerial === serial) {
        parts.push(bytes.subarray(bodyStart, bodyEnd));
        total += bodyEnd - bodyStart;
        // A last lacing value under 255 ends a packet on this page, so the comment
        // packet is complete. Bytes after it are never reached: the list has its own lengths.
        if (!segments || bytes[p + 27 + segments - 1]! < 255 || total >= MAX_TAG_BYTES) break;
      }
      if (bodyStart + bodyLength > bytes.length) break;
      p = bodyStart + bodyLength;
    }
    if (!parts.length) return out;
    let packet = parts[0]!;
    if (parts.length > 1) {
      packet = new Uint8Array(Math.min(total, MAX_TAG_BYTES));
      let o = 0;
      for (const part of parts) {
        const take = part.subarray(0, packet.length - o);
        packet.set(take, o);
        o += take.length;
      }
    }
    readVorbisComments(out, packet, listAt, packet.length);
  } catch { /* best effort */ }
  return out;
}

// ── Matroska and WebM ────────────────────────────────────────────────────────
//
// Segment > Tags > Tag > SimpleTag { TagName, TagString }. COPYRIGHT, LICENSE and
// TERMS_OF_USE are the official tag names for legal statements (Matroska tagging
// specification). A SimpleTag nested inside another qualifies its parent and is
// not read, which also keeps the walk free of recursion.

const EBML_HEADER = 0x1a45dfa3;
const EBML_DOCTYPE = 0x4282;
const EBML_SEGMENT = 0x18538067;
const EBML_TAGS = 0x1254c367;
const EBML_TAG = 0x7373;
const EBML_SIMPLE_TAG = 0x67c8;
const EBML_TAG_NAME = 0x45a3;
const EBML_TAG_STRING = 0x4487;

const MATROSKA_TAGS: Record<string, TagSpec> = {
  COPYRIGHT: ['Copyright'], LICENSE: ['Licence'], TERMS_OF_USE: ['Usage terms'], ARTIST: ['Artist', true],
};

interface EbmlElement { id: number; start: number; end: number; unknown: boolean }

/**
 * The element at `p` inside [p, limit). Null when the id or size does not read, or
 * when the declared size runs past `limit`; `open` accepts that last case and ends
 * the element at `limit` (a recording cut short, or a Segment of unknown size).
 */
function ebmlAt(b: Uint8Array, p: number, limit: number, open = false): EbmlElement | null {
  if (p < 0 || p >= limit) return null;
  const first = b[p]!;
  if (!first) return null;
  let idWidth = 1;
  while (idWidth <= 4 && !(first & (0x80 >> (idWidth - 1)))) idWidth++;
  if (idWidth > 4 || p + idWidth >= limit) return null;
  let id = 0;
  for (let i = 0; i < idWidth; i++) id = id * 256 + b[p + i]!;
  const q = p + idWidth;
  const lead = b[q]!;
  if (!lead) return null;
  let width = 1;
  while (!(lead & (0x80 >> (width - 1)))) width++;
  if (q + width > limit) return null;
  let size = lead & (0xff >> width);
  let unknown = size === (0xff >> width);
  for (let i = 1; i < width; i++) {
    const byte = b[q + i]!;
    if (byte !== 0xff) unknown = false;
    size = size * 256 + byte;
  }
  const start = q + width;
  if (unknown) return { id, start, end: limit, unknown: true };
  if (size > limit - start) return open ? { id, start, end: limit, unknown: false } : null;
  return { id, start, end: start + size, unknown: false };
}

function readMatroskaTags(out: MetaField[], b: Uint8Array, tags: EbmlElement, budget: { left: number }): void {
  for (let p = tags.start; p < tags.end && budget.left > 0; ) {
    const tag = ebmlAt(b, p, tags.end);
    if (!tag || tag.unknown) return;
    budget.left--;
    p = tag.end;
    if (tag.id !== EBML_TAG) continue;
    for (let q = tag.start; q < tag.end && budget.left > 0; ) {
      const simple = ebmlAt(b, q, tag.end);
      if (!simple || simple.unknown) break;
      budget.left--;
      q = simple.end;
      if (simple.id !== EBML_SIMPLE_TAG) continue;
      let name = '';
      let value: string | null = null;
      for (let r = simple.start; r < simple.end && budget.left > 0; ) {
        const part = ebmlAt(b, r, simple.end);
        if (!part || part.unknown) break;
        budget.left--;
        r = part.end;
        if (part.id === EBML_TAG_NAME) name = decode(b, part.start, Math.min(part.end, part.start + 64), 'utf-8').replace(/\0[\s\S]*$/, '').toUpperCase();
        else if (part.id === EBML_TAG_STRING) value = decode(b, part.start, part.end, 'utf-8').replace(/\0[\s\S]*$/, '');
      }
      const spec = own(MATROSKA_TAGS, name);
      if (spec && value) add(out, spec, value, `Matroska ${name}`);
    }
  }
}

/** Rights and credit tags from a Matroska or WebM file, or null when the bytes are not EBML. */
export function readMatroskaRights(bytes: Uint8Array): { format: 'Matroska' | 'WebM'; fields: MetaField[] } | null {
  const fields: MetaField[] = [];
  try {
    const head = ebmlAt(bytes, 0, bytes.length);
    if (!head || head.id !== EBML_HEADER || head.unknown) return null;
    let docType = '';
    for (let p = head.start, i = 0; p < head.end && i < 32; i++) {
      const part = ebmlAt(bytes, p, head.end);
      if (!part || part.unknown) break;
      if (part.id === EBML_DOCTYPE) docType = decode(bytes, part.start, Math.min(part.end, part.start + 16), 'utf-8').replace(/\0[\s\S]*$/, '');
      p = part.end;
    }
    const format = docType === 'webm' ? 'WebM' : 'Matroska';
    const segment = ebmlAt(bytes, head.end, bytes.length, true);
    if (!segment || segment.id !== EBML_SEGMENT) return { format, fields };
    const budget = { left: MAX_EBML_TAG_ELEMENTS };
    for (let p = segment.start, i = 0; p < segment.end && i < MAX_EBML_SEGMENT_CHILDREN; i++) {
      const child = ebmlAt(bytes, p, segment.end);
      // A child of unknown size (a streamed cluster) has no findable end, so the walk stops there.
      if (!child || child.unknown) break;
      if (child.id === EBML_TAGS) readMatroskaTags(fields, bytes, child, budget);
      p = child.end;
    }
    return { format, fields };
  } catch {
    return fields.length ? { format: 'Matroska', fields } : null;
  }
}

// ── Office packages (DOCX, PPTX) ─────────────────────────────────────────────
//
// docProps/core.xml holds the Dublin Core properties and docProps/custom.xml the
// properties an author added by name. Only those two parts are inflated, each
// through the bounded Office XML reader; nothing else in the package is opened.

const DC_NAMESPACE = 'http://purl.org/dc/elements/1.1/';
const CUSTOM_NAMESPACE = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';
const CORE_PROPERTIES: Record<string, TagSpec> = { rights: ['Rights'], creator: ['Author', true] };
/** Custom property names read as a rights statement, compared in lower case. */
const CUSTOM_PROPERTIES: Record<string, TagSpec> = { licence: ['Licence'], license: ['Licence'], copyright: ['Copyright'] };

function officePart(members: ZipRawMember[], name: string, budget: { nodes: number }): OfficeXmlNode | null {
  const member = members.find((m) => m.name === name);
  if (!member || member.size > OFFICE_MAX_XML_BYTES) return null;
  try {
    return readOfficeXml(decodeZipMember(member), budget);
  } catch {
    return null;
  }
}

/** Rights and credit properties from a DOCX or PPTX, or null when the bytes are not one. */
export function readOfficeRights(bytes: Uint8Array): { format: 'DOCX' | 'PPTX'; fields: MetaField[] } | null {
  if (bytes.length < 22 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 0x03 || bytes[3] !== 0x04) return null;
  try {
    const members = readZipMembers(bytes, { maxEntries: MAX_OFFICE_ENTRIES });
    const format = members.some((m) => m.name === 'word/document.xml') ? 'DOCX'
      : members.some((m) => m.name === 'ppt/presentation.xml') ? 'PPTX'
      : null;
    if (!format) return null;
    const fields: MetaField[] = [];
    const budget = { nodes: 0 };
    const core = officePart(members, 'docProps/core.xml', budget);
    for (const node of core?.children.slice(0, MAX_OFFICE_PROPERTIES) ?? []) {
      const spec = node.namespace === DC_NAMESPACE ? own(CORE_PROPERTIES, node.name) : undefined;
      if (spec) add(fields, spec, officeText(node), `${format} core.xml dc:${node.name}`);
    }
    const custom = officePart(members, 'docProps/custom.xml', budget);
    for (const node of custom?.children.slice(0, MAX_OFFICE_PROPERTIES) ?? []) {
      if (node.namespace !== CUSTOM_NAMESPACE || node.name !== 'property') continue;
      const name = tidy(node.attrs.name ?? '').slice(0, 64);
      const spec = own(CUSTOM_PROPERTIES, name.toLowerCase());
      if (spec) add(fields, spec, officeText(node), `${format} custom.xml ${name}`);
    }
    return { format, fields };
  } catch {
    return null;
  }
}
