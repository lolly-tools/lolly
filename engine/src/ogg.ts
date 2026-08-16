// SPDX-License-Identifier: MPL-2.0
/**
 * Ogg (RFC 3533) page + Opus comment-header primitives, shared by the C2PA
 * write side (c2pa-containers.ts placeOgg) and the read side (c2pa-extract.ts
 * extractC2paFromOgg). Pure byte-grammar - no crypto, no DOM - so both sides
 * agree on where an Opus stream's C2PA credential lives.
 *
 * WHERE THE CREDENTIAL GOES. Opus in Ogg carries its metadata in the OpusTags
 * comment header (RFC 7845 section 5.2), a VorbisComment packet alone on the second
 * Ogg page (the first is OpusHead, the BOS page). We stash the JUMBF manifest
 * store as a base64 VorbisComment field, `C2PA=<base64>`, rebuild that one page
 * (recomputing its Ogg CRC), and the hard binding excludes the WHOLE comment
 * page byte range - CRC included, so the pixels-equivalent (OpusHead + every
 * audio page) hashes identically across the embedder's two passes.
 *
 * There is no interoperable C2PA-in-Ogg standard (c2pa-rs has no Ogg handler),
 * so this binding is Lolly's own - the same "our verifier reads it, c2patool
 * can't" caveat that already applies to the WebM attachment path. It keeps a
 * valid, correctly-CRC'd Ogg stream that every decoder (incl. Safari's Web
 * Audio) still plays, since unknown comment fields are ignored.
 *
 * SINGLE-PAGE ASSUMPTION. The writer only rebuilds a comment header that lives
 * on ONE page - true for every real Opus file (an OpusTags packet is a few
 * hundred bytes; even with a multi-KB manifest it stays well under a page's
 * 64 KB packet limit). Re-paging into one page preserves every following page's
 * sequence number. locateOpusComment still REASSEMBLES a multi-page comment
 * packet on read (tolerant), but placeOgg refuses to rewrite one.
 */
import { concatBytes, bytesToBin } from './bytes.ts';

const te = new TextEncoder();

/** The VorbisComment field key carrying the base64 JUMBF store. Keys are
 *  case-insensitive ASCII (RFC 7845); we compare uppercased. */
export const OGG_C2PA_KEY = 'C2PA';

// ─── Ogg CRC-32 ────────────────────────────────────────────────────────────────
// libogg's checksum: a NON-reflected CRC-32, polynomial 0x04c11db7, init 0, no
// final xor, stored little-endian in the page header at offset 22. (Not the
// common reflected zlib CRC-32 - a different value.)
const OGG_CRC_TABLE = /* @__PURE__ */ (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) r = (r & 0x80000000) ? ((r << 1) ^ 0x04c11db7) : (r << 1);
    t[i] = r >>> 0;
  }
  return t;
})();

/** Ogg page checksum over `buf` (which must already have its 4 CRC bytes zeroed). */
export function oggCrc32(buf: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < buf.length; i++) crc = ((crc << 8) ^ OGG_CRC_TABLE[((crc >>> 24) ^ buf[i]!) & 0xff]!) >>> 0;
  return crc >>> 0;
}

// ─── page walk ───────────────────────────────────────────────────────────────
const OGG_CAPTURE = [0x4f, 0x67, 0x67, 0x53]; // 'OggS'
const isCapture = (b: Uint8Array, o: number): boolean =>
  b[o] === OGG_CAPTURE[0] && b[o + 1] === OGG_CAPTURE[1] && b[o + 2] === OGG_CAPTURE[2] && b[o + 3] === OGG_CAPTURE[3];

export interface OggPage {
  start: number;       // offset of the 'OggS' capture pattern
  bodyStart: number;   // offset of the packet data (past header + segment table)
  bodyEnd: number;     // == end
  end: number;         // offset just past this page
  htype: number;       // header type flag (bit0 continued, bit1 BOS, bit2 EOS)
  serial: number;      // bitstream serial number
  seq: number;         // page sequence number
  lastLacing: number;  // last segment-table value (255 ⇒ a packet continues onto the next page)
}

/** Walk an Ogg bitstream into its pages. Stops at the first byte that is not a
 *  well-formed page (so trailing garbage or truncation ends the walk cleanly). */
export function walkOggPages(b: Uint8Array): OggPage[] {
  const pages: OggPage[] = [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let off = 0;
  while (off + 27 <= b.length && isCapture(b, off)) {
    const segCount = b[off + 26]!;
    const segTableOff = off + 27;
    if (segTableOff + segCount > b.length) break;
    let bodyLen = 0;
    for (let i = 0; i < segCount; i++) bodyLen += b[segTableOff + i]!;
    const bodyStart = segTableOff + segCount;
    const bodyEnd = bodyStart + bodyLen;
    if (bodyEnd > b.length) break;
    pages.push({
      start: off, bodyStart, bodyEnd, end: bodyEnd,
      htype: b[off + 5]!,
      serial: dv.getUint32(off + 14, true),
      seq: dv.getUint32(off + 18, true),
      lastLacing: segCount > 0 ? b[segTableOff + segCount - 1]! : 0,
    });
    off = bodyEnd;
  }
  return pages;
}

// ─── Opus comment header ───────────────────────────────────────────────────────
const magic = (b: Uint8Array, o: number, s: string): boolean =>
  b.length >= o + s.length && bytesToBin(b.subarray(o, o + s.length)) === s;

export interface OpusCommentLoc {
  commentStart: number;   // byte offset of the first comment-header page
  commentEnd: number;     // byte offset just past the last comment-header page
  pageCount: number;      // how many pages the comment packet spans (1 for every real file)
  packet: Uint8Array;     // the reassembled OpusTags packet
  first22: Uint8Array;    // the first comment page's 22 header bytes (OggS…seq), copied verbatim
  serial: number;
}

/** Find the OpusTags comment header of an Ogg Opus stream: verify page 0 is the
 *  OpusHead BOS page, then reassemble the OpusTags packet that begins on page 1.
 *  Returns null for anything that is not Ogg Opus (Vorbis/FLAC/Theora/… are not
 *  claimed - their comment home differs and we don't stamp them). */
export function locateOpusComment(bytes: Uint8Array): OpusCommentLoc | null {
  const pages = walkOggPages(bytes);
  if (pages.length < 2) return null;
  const head = pages[0]!;
  if (!(head.htype & 0x02) || !magic(bytes, head.bodyStart, 'OpusHead')) return null;
  const c0 = pages[1]!;
  if (!magic(bytes, c0.bodyStart, 'OpusTags')) return null;
  // Gather continuation pages: a lastLacing of 255 means the packet spills over.
  let last = 1;
  const bodies: Uint8Array[] = [bytes.subarray(c0.bodyStart, c0.bodyEnd)];
  while (pages[last]!.lastLacing === 255 && pages[last + 1]) {
    last++;
    bodies.push(bytes.subarray(pages[last]!.bodyStart, pages[last]!.bodyEnd));
  }
  return {
    commentStart: c0.start,
    commentEnd: pages[last]!.end,
    pageCount: last, // pages 1..last inclusive
    packet: bodies.length === 1 ? bodies[0]! : concatBytes(bodies),
    first22: bytes.subarray(c0.start, c0.start + 22),
    serial: c0.serial,
  };
}

/** Parse an OpusTags packet into its vendor string + raw comment entries (each a
 *  full `KEY=value` byte run). Returns null if the packet is malformed. */
export function parseOpusTags(packet: Uint8Array): { vendor: Uint8Array; comments: Uint8Array[] } | null {
  if (!magic(packet, 0, 'OpusTags')) return null;
  const dv = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
  let p = 8;
  if (p + 4 > packet.length) return null;
  const vlen = dv.getUint32(p, true); p += 4;
  if (p + vlen > packet.length) return null;
  const vendor = packet.subarray(p, p + vlen); p += vlen;
  if (p + 4 > packet.length) return null;
  const count = dv.getUint32(p, true); p += 4;
  const comments: Uint8Array[] = [];
  for (let i = 0; i < count; i++) {
    if (p + 4 > packet.length) return null;
    const clen = dv.getUint32(p, true); p += 4;
    if (p + clen > packet.length) return null;
    comments.push(packet.subarray(p, p + clen)); p += clen;
  }
  return { vendor, comments };
}

/** Rebuild an OpusTags packet from a vendor string + raw comment entries. */
export function buildOpusTags(vendor: Uint8Array, comments: Uint8Array[]): Uint8Array {
  const u32 = (n: number): Uint8Array => { const a = new Uint8Array(4); new DataView(a.buffer).setUint32(0, n, true); return a; };
  const parts: Uint8Array[] = [te.encode('OpusTags'), u32(vendor.length), vendor, u32(comments.length)];
  for (const c of comments) { parts.push(u32(c.length), c); }
  return concatBytes(parts);
}

/** The uppercased VorbisComment key of a raw `KEY=value` entry (empty if no `=`). */
export function commentKey(raw: Uint8Array): string {
  const eq = raw.indexOf(0x3d); // '='
  return bytesToBin(raw.subarray(0, eq < 0 ? raw.length : eq)).toUpperCase();
}

/** The value bytes of a raw `KEY=value` entry (empty if no `=`). */
export function commentValue(raw: Uint8Array): Uint8Array {
  const eq = raw.indexOf(0x3d);
  return eq < 0 ? raw.subarray(raw.length) : raw.subarray(eq + 1);
}

/** Assemble a single Ogg page: `first22` (OggS…page-sequence, copied verbatim so
 *  version/type/granule/serial/seq are preserved) + a fresh segment table for
 *  `packet` + the packet body, with the Ogg CRC computed and written in. Throws
 *  if the packet needs more than one page (>255 lacing segments). */
export function buildOggPage(first22: Uint8Array, packet: Uint8Array): Uint8Array {
  if (first22.length !== 22) throw new Error('ogg: page header template must be 22 bytes');
  const nseg = Math.floor(packet.length / 255) + 1;
  if (nseg > 255) throw new Error('ogg: packet too large for a single page');
  const seg = new Uint8Array(nseg);
  for (let i = 0; i < nseg - 1; i++) seg[i] = 255;
  seg[nseg - 1] = packet.length % 255; // 0..254 terminator
  // CRC field (4 bytes) starts zeroed; compute over the whole page then write LE.
  const page = concatBytes([first22, new Uint8Array(4), Uint8Array.of(nseg), seg, packet]);
  new DataView(page.buffer, page.byteOffset, page.byteLength).setUint32(22, oggCrc32(page), true);
  return page;
}
