/* global onInit, onInput, exportFile */
/**
 * Strip Hidden Data - runs entirely in the sandboxed hook context (no DOM,
 * no network). Reads the picked file's bytes (input.value.bytes), reports the
 * hidden / non-rendering data it carries, and produces a clean copy.
 *
 * Audio (M4A/MP4, WAV, MP3, FLAC, Ogg Opus) goes through the engine's own audio
 * stripper, compiled into this file as the `strip-audio` region below: tags,
 * Content Credentials and other metadata go, and the audio bytes are copied
 * through untouched.
 *
 * Three image formats, all by lossless surgery - the image content is copied
 * through untouched, only metadata is removed:
 *   JPEG: drop APP1 (EXIF/XMP), APP2 (ICC), APP13 (IPTC/Photoshop) and COM
 *         comment segments; keep APP0 (JFIF) and all image segments.
 *   PNG : drop tEXt / zTXt / iTXt / eXIf / tIME / caBX chunks; keep everything else.
 *   SVG : drop comments, <metadata>, editor-private namespaces/attributes
 *         (Inkscape sodipodi/Adobe i:,x:), DOCTYPE/PI noise, insignificant
 *         whitespace; every painting tag is emitted byte-for-byte.
 *
 * No DOMParser / no canvas: the sandbox has no DOM, and we want identical
 * behaviour across web, Tauri and (jsdom-free) CLI shells. Everything is done
 * with hand-rolled byte/segment scanners and a small XML tokenizer.
 */

// ─── shared byte / text helpers ──────────────────────────────────────────────

function concatBytes(parts) {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function fmtBytes(n) {
  if (!(n > 0)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  const v = n / Math.pow(1024, i);
  return `${i === 0 ? v : v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function matchAscii(bytes, off, str) {
  for (let i = 0; i < str.length; i++) {
    if (bytes[off + i] !== str.charCodeAt(i)) return false;
  }
  return true;
}

function decodeText(bytes) {
  // TextDecoder strips a leading UTF-8 BOM by default; encoding back drops it.
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeText(str) {
  return new TextEncoder().encode(str);
}

// ─── audio (M4A/MP4, WAV, MP3, FLAC, Ogg Opus) ───────────────────────────────
// engine/src/strip-audio.ts, compiled by scripts/build-strip-audio.ts. It exposes
// LollyStripAudio.{sniffAudioFormat, inspectAudioMetadata, stripAudioMetadata,
// audioMetadataResidual}; the strip throws rather than return a copy it cannot verify.
// === lolly:shared strip-audio - generated from community/_shared/strip-audio.js; edit there and run pnpm run sync:shared ===
var LollyStripAudio = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // engine/src/strip-audio.ts
  var strip_audio_exports = {};
  __export(strip_audio_exports, {
    AUDIO_STRIP_FORMATS: () => AUDIO_STRIP_FORMATS,
    audioMetadataResidual: () => audioMetadataResidual,
    inspectAudioMetadata: () => inspectAudioMetadata,
    sniffAudioFormat: () => sniffAudioFormat,
    stripAudioMetadata: () => stripAudioMetadata
  });

  // engine/src/bytes.ts
  function concatBytes(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
  function bytesToBin(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 32768) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 32768));
    }
    return s;
  }

  // engine/src/ogg.ts
  var te = new TextEncoder();
  var OGG_CRC_TABLE = /* @__PURE__ */ (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let r = i << 24;
      for (let j = 0; j < 8; j++) r = r & 2147483648 ? r << 1 ^ 79764919 : r << 1;
      t[i] = r >>> 0;
    }
    return t;
  })();
  function oggCrc32(buf) {
    let crc = 0;
    for (let i = 0; i < buf.length; i++) crc = (crc << 8 ^ OGG_CRC_TABLE[(crc >>> 24 ^ buf[i]) & 255]) >>> 0;
    return crc >>> 0;
  }
  var OGG_CAPTURE = [79, 103, 103, 83];
  var isCapture = (b, o) => b[o] === OGG_CAPTURE[0] && b[o + 1] === OGG_CAPTURE[1] && b[o + 2] === OGG_CAPTURE[2] && b[o + 3] === OGG_CAPTURE[3];
  function walkOggPages(b) {
    const pages = [];
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let off = 0;
    while (off + 27 <= b.length && isCapture(b, off)) {
      const segCount = b[off + 26];
      const segTableOff = off + 27;
      if (segTableOff + segCount > b.length) break;
      let bodyLen = 0;
      for (let i = 0; i < segCount; i++) bodyLen += b[segTableOff + i];
      const bodyStart = segTableOff + segCount;
      const bodyEnd = bodyStart + bodyLen;
      if (bodyEnd > b.length) break;
      pages.push({
        start: off,
        bodyStart,
        bodyEnd,
        end: bodyEnd,
        htype: b[off + 5],
        serial: dv.getUint32(off + 14, true),
        seq: dv.getUint32(off + 18, true),
        lastLacing: segCount > 0 ? b[segTableOff + segCount - 1] : 0
      });
      off = bodyEnd;
    }
    return pages;
  }
  var magic = (b, o, s) => b.length >= o + s.length && bytesToBin(b.subarray(o, o + s.length)) === s;
  function locateOpusComment(bytes) {
    const pages = walkOggPages(bytes);
    if (pages.length < 2) return null;
    const head = pages[0];
    if (!(head.htype & 2) || !magic(bytes, head.bodyStart, "OpusHead")) return null;
    const c0 = pages[1];
    if (!magic(bytes, c0.bodyStart, "OpusTags")) return null;
    let last = 1;
    const bodies = [bytes.subarray(c0.bodyStart, c0.bodyEnd)];
    while (pages[last].lastLacing === 255 && pages[last + 1]) {
      last++;
      bodies.push(bytes.subarray(pages[last].bodyStart, pages[last].bodyEnd));
    }
    return {
      commentStart: c0.start,
      commentEnd: pages[last].end,
      pageCount: last,
      // pages 1..last inclusive
      packet: bodies.length === 1 ? bodies[0] : concatBytes(bodies),
      first22: bytes.subarray(c0.start, c0.start + 22),
      serial: c0.serial
    };
  }
  function parseOpusTags(packet) {
    if (!magic(packet, 0, "OpusTags")) return null;
    const dv = new DataView(packet.buffer, packet.byteOffset, packet.byteLength);
    let p = 8;
    if (p + 4 > packet.length) return null;
    const vlen = dv.getUint32(p, true);
    p += 4;
    if (p + vlen > packet.length) return null;
    const vendor = packet.subarray(p, p + vlen);
    p += vlen;
    if (p + 4 > packet.length) return null;
    const count = dv.getUint32(p, true);
    p += 4;
    const comments = [];
    for (let i = 0; i < count; i++) {
      if (p + 4 > packet.length) return null;
      const clen = dv.getUint32(p, true);
      p += 4;
      if (p + clen > packet.length) return null;
      comments.push(packet.subarray(p, p + clen));
      p += clen;
    }
    return { vendor, comments };
  }
  function buildOpusTags(vendor, comments) {
    const u32 = (n) => {
      const a = new Uint8Array(4);
      new DataView(a.buffer).setUint32(0, n, true);
      return a;
    };
    const parts = [te.encode("OpusTags"), u32(vendor.length), vendor, u32(comments.length)];
    for (const c of comments) {
      parts.push(u32(c.length), c);
    }
    return concatBytes(parts);
  }
  function commentKey(raw) {
    const eq = raw.indexOf(61);
    return bytesToBin(raw.subarray(0, eq < 0 ? raw.length : eq)).toUpperCase();
  }
  function commentValue(raw) {
    const eq = raw.indexOf(61);
    return eq < 0 ? raw.subarray(raw.length) : raw.subarray(eq + 1);
  }
  function buildOggPage(first22, packet) {
    if (first22.length !== 22) throw new Error("ogg: page header template must be 22 bytes");
    const nseg = Math.floor(packet.length / 255) + 1;
    if (nseg > 255) throw new Error("ogg: packet too large for a single page");
    const seg = new Uint8Array(nseg);
    for (let i = 0; i < nseg - 1; i++) seg[i] = 255;
    seg[nseg - 1] = packet.length % 255;
    const page = concatBytes([first22, new Uint8Array(4), Uint8Array.of(nseg), seg, packet]);
    new DataView(page.buffer, page.byteOffset, page.byteLength).setUint32(22, oggCrc32(page), true);
    return page;
  }

  // engine/src/strip-audio.ts
  var AUDIO_STRIP_FORMATS = Object.freeze(["mp4", "wav", "mp3", "flac", "ogg"]);
  var MAX_REPORT_ITEMS = 64;
  var MAX_VALUE = 200;
  var MAX_UNITS = 65536;
  var MAX_TAGS = 16;
  var MAX_FRAMES = 1024;
  var MAX_SYNC_SCAN = 65536;
  var MP4_NEST_DEPTH = 8;
  function stripRefusal(message) {
    throw new Error(message);
  }
  var readBe16 = (b, o) => (b[o] ?? 0) << 8 | (b[o + 1] ?? 0);
  var readBe24 = (b, o) => (b[o] ?? 0) << 16 | (b[o + 1] ?? 0) << 8 | (b[o + 2] ?? 0);
  var readBe32 = (b, o) => ((b[o] ?? 0) << 24 | (b[o + 1] ?? 0) << 16 | (b[o + 2] ?? 0) << 8 | (b[o + 3] ?? 0)) >>> 0;
  var readLe32 = (b, o) => ((b[o] ?? 0) | (b[o + 1] ?? 0) << 8 | (b[o + 2] ?? 0) << 16 | (b[o + 3] ?? 0) << 24) >>> 0;
  var syncsafeAt = (b, o) => ((b[o] ?? 0) & 127) << 21 | ((b[o + 1] ?? 0) & 127) << 14 | ((b[o + 2] ?? 0) & 127) << 7 | (b[o + 3] ?? 0) & 127;
  function putBe32(b, o, v) {
    b[o] = v >>> 24 & 255;
    b[o + 1] = v >>> 16 & 255;
    b[o + 2] = v >>> 8 & 255;
    b[o + 3] = v & 255;
  }
  function latin1At(b, o, n) {
    if (o < 0 || n < 0 || o + n > b.length) return "";
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(b[o + i]);
    return s;
  }
  function joinBytes(parts) {
    let n = 0;
    for (const p of parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  }
  function anyNonZero(b, start, end) {
    for (let i = start; i < end; i++) if (b[i] !== 0) return true;
    return false;
  }
  function decodeSlice(b, start, end, enc) {
    if (start < 0 || end <= start || start >= b.length) return "";
    const slice = b.subarray(start, Math.min(end, b.length, start + MAX_VALUE * 4));
    try {
      return new TextDecoder(enc === "latin1" ? "windows-1252" : enc).decode(slice);
    } catch {
      return "";
    }
  }
  function clipValue(s) {
    let out = "";
    let space = false;
    for (const ch of s) {
      const c = ch.charCodeAt(0);
      const blank = c < 32 || c === 127 || ch === " " || ch === " ";
      if (blank) {
        space = out.length > 0;
        continue;
      }
      if (space) {
        out += " ";
        space = false;
      }
      out += ch;
      if (out.length > MAX_VALUE) break;
    }
    return out.length > MAX_VALUE ? `${out.slice(0, MAX_VALUE - 1)}…` : out;
  }
  function printableId(id) {
    let s = "";
    for (const ch of id) {
      const c = ch.charCodeAt(0);
      s += c >= 32 && c !== 127 ? ch : ".";
    }
    return s.trim() || "?";
  }
  var sizeLabel = (n) => n < 1024 ? `${n} bytes` : `${Math.round(n / 1024)} KB`;
  function newReport() {
    return { items: [], removals: [], kept: [], video: false, timesShown: false };
  }
  function addItem(rep, label, value, source, sensitive = false) {
    if (rep.items.length >= MAX_REPORT_ITEMS) return;
    const v = clipValue(value) || "present";
    rep.items.push(sensitive ? { label, value: v, source, sensitive: true } : { label, value: v, source });
  }
  function addRemoval(rep, what) {
    if (rep.removals.length < MAX_REPORT_ITEMS && !rep.removals.includes(what)) rep.removals.push(what);
  }
  function ownLabel(map, key) {
    return Object.hasOwn(map, key) ? map[key] : void 0;
  }
  var VORBIS_LABELS = {
    TITLE: ["Title"],
    ARTIST: ["Artist", true],
    ALBUMARTIST: ["Album artist", true],
    "ALBUM ARTIST": ["Album artist", true],
    ALBUM: ["Album"],
    COMMENT: ["Comment"],
    DESCRIPTION: ["Description"],
    ENCODER: ["Encoder"],
    ENCODED_BY: ["Encoded by", true],
    ENCODEDBY: ["Encoded by", true],
    DATE: ["Date"],
    YEAR: ["Year"],
    GENRE: ["Genre"],
    COMPOSER: ["Composer", true],
    PERFORMER: ["Performer", true],
    COPYRIGHT: ["Copyright"],
    LICENSE: ["Licence"],
    ORGANIZATION: ["Organisation"],
    CONTACT: ["Contact", true],
    LOCATION: ["Location", true],
    TRACKNUMBER: ["Track number"],
    DISCNUMBER: ["Disc number"],
    LYRICS: ["Lyrics"],
    ISRC: ["ISRC"]
  };
  function describeVorbisComment(rep, raw, source) {
    const key = commentKey(raw);
    const value = commentValue(raw);
    if (key === "C2PA") {
      addItem(rep, "Content Credentials", "C2PA manifest store", source);
      return;
    }
    if (key === "METADATA_BLOCK_PICTURE" || key === "COVERART") {
      addItem(rep, "Picture", sizeLabel(value.length), source);
      return;
    }
    if (key.startsWith("REPLAYGAIN_")) {
      addItem(rep, "Loudness tag", `${key}: ${decodeSlice(value, 0, value.length, "utf-8")}`, source);
      return;
    }
    const label = ownLabel(VORBIS_LABELS, key);
    addItem(rep, label ? label[0] : `Tag ${printableId(key)}`, decodeSlice(value, 0, value.length, "utf-8"), source, label?.[1] ?? false);
  }
  var ID3_LABELS = {
    TIT2: ["Title"],
    TT2: ["Title"],
    TPE1: ["Artist", true],
    TP1: ["Artist", true],
    TPE2: ["Album artist", true],
    TP2: ["Album artist", true],
    TALB: ["Album"],
    TAL: ["Album"],
    TCOM: ["Composer", true],
    TCM: ["Composer", true],
    TYER: ["Year"],
    TYE: ["Year"],
    TDRC: ["Recording date"],
    TDRL: ["Release date"],
    TDEN: ["Encoding date"],
    TDTG: ["Tagging date"],
    TDAT: ["Date"],
    TCON: ["Genre"],
    TCO: ["Genre"],
    TRCK: ["Track number"],
    TRK: ["Track number"],
    TPOS: ["Disc number"],
    TPA: ["Disc number"],
    TCOP: ["Copyright"],
    TCR: ["Copyright"],
    TPUB: ["Publisher"],
    TPB: ["Publisher"],
    TENC: ["Encoded by", true],
    TEN: ["Encoded by", true],
    TSSE: ["Encoder settings"],
    TSS: ["Encoder settings"],
    TOWN: ["Owner", true],
    TEXT: ["Lyricist", true],
    TXT: ["Lyricist", true],
    TOLY: ["Original lyricist", true],
    TOPE: ["Original artist", true],
    TIT1: ["Grouping"],
    TIT3: ["Subtitle"],
    TBPM: ["Tempo"],
    TKEY: ["Musical key"],
    TLAN: ["Language"],
    TSRC: ["ISRC"],
    TOFN: ["Original filename", true],
    TMED: ["Media type"],
    TFLT: ["File type"],
    TLEN: ["Length"]
  };
  var GEOB_C2PA_MIME = "application/x-c2pa-manifest-store";
  function id3Encoding(e, b, at) {
    if (e === 3) return "utf-8";
    if (e === 2) return "utf-16be";
    if (e === 1) return b[at] === 254 && b[at + 1] === 255 ? "utf-16be" : "utf-16le";
    return "latin1";
  }
  function termEnd(b, at, end, wide) {
    if (!wide) {
      let i2 = at;
      while (i2 < end && b[i2] !== 0) i2++;
      return i2;
    }
    let i = at;
    while (i + 1 < end && !(b[i] === 0 && b[i + 1] === 0)) i += 2;
    return Math.min(i, end);
  }
  function id3Text(b, start, end, e) {
    const enc = id3Encoding(e, b, start);
    return decodeSlice(b, start, end, enc).split("\0").filter(Boolean).join(", ");
  }
  function describeId3Frame(rep, id, f, source) {
    const where = `${source} ${printableId(id)}`;
    const e = f[0] ?? 0;
    const wide = e === 1 || e === 2;
    const step = wide ? 2 : 1;
    if (id === "GEOB" || id === "GEO") {
      const mimeEnd = termEnd(f, 1, f.length, false);
      const mime = latin1At(f, 1, mimeEnd - 1);
      if (mime === GEOB_C2PA_MIME) {
        addItem(rep, "Content Credentials", "C2PA manifest store", where);
        return;
      }
      addItem(rep, "Embedded object", mime || sizeLabel(f.length), where);
      return;
    }
    if (id === "APIC" || id === "PIC") {
      const mime = id === "PIC" ? `image/${latin1At(f, 1, 3).toLowerCase()}` : latin1At(f, 1, termEnd(f, 1, f.length, false) - 1);
      addItem(rep, "Picture", `${mime || "image"}, ${sizeLabel(f.length)}`, where);
      return;
    }
    if (id === "COMM" || id === "COM" || id === "USLT" || id === "ULT") {
      const descEnd = termEnd(f, 4, f.length, wide);
      addItem(rep, id.startsWith("C") ? "Comment" : "Lyrics", id3Text(f, descEnd + step, f.length, e), where);
      return;
    }
    if (id === "TXXX" || id === "TXX") {
      const descEnd = termEnd(f, 1, f.length, wide);
      const desc = id3Text(f, 1, descEnd, e);
      addItem(rep, `User text${desc ? ` (${clipValue(desc).slice(0, 40)})` : ""}`, id3Text(f, descEnd + step, f.length, e), where);
      return;
    }
    if (id === "PRIV" || id === "UFID" || id === "UFI") {
      const owner = latin1At(f, 0, termEnd(f, 0, f.length, false));
      addItem(rep, id === "PRIV" ? "Private data" : "Unique file identifier", owner || sizeLabel(f.length), where);
      return;
    }
    if (id === "POPM" || id === "POP") {
      addItem(rep, "Rating", latin1At(f, 0, termEnd(f, 0, f.length, false)), where, true);
      return;
    }
    if (id === "WXXX" || id === "WXX") {
      const descEnd = termEnd(f, 1, f.length, wide);
      addItem(rep, "Web address", latin1At(f, descEnd + step, f.length - descEnd - step), where);
      return;
    }
    if (id[0] === "W") {
      addItem(rep, "Web address", latin1At(f, 0, f.length), where);
      return;
    }
    if (id === "CHAP" || id === "CTOC") {
      addItem(rep, "Chapters", "chapter markers", where);
      return;
    }
    if (id[0] === "T") {
      const label = ownLabel(ID3_LABELS, id);
      addItem(rep, label ? label[0] : `Tag ${printableId(id)}`, id3Text(f, 1, f.length, e), where, label?.[1] ?? false);
      return;
    }
    addItem(rep, `Tag ${printableId(id)}`, sizeLabel(f.length), where);
  }
  function deunsync(b) {
    const out = new Uint8Array(b.length);
    let n = 0;
    for (let i = 0; i < b.length; i++) {
      out[n++] = b[i];
      if (b[i] === 255 && b[i + 1] === 0) i++;
    }
    return out.subarray(0, n);
  }
  function id3v2At(b, p) {
    if (p + 10 > b.length || latin1At(b, p, 3) !== "ID3") return null;
    const ver = b[p + 3];
    const flags = b[p + 5];
    if (ver < 2 || ver > 4 || b[p + 4] === 255) stripRefusal("An ID3v2 tag has an unknown version.");
    for (let i = 6; i < 10; i++) if (b[p + i] & 128) stripRefusal("An ID3v2 tag has a malformed size.");
    const end = p + 10 + syncsafeAt(b, p + 6) + (ver === 4 && flags & 16 ? 10 : 0);
    if (end > b.length) stripRefusal("An ID3v2 tag runs past the end of the file.");
    return { start: p, end, ver, flags };
  }
  function describeId3v2(rep, b, tag, source) {
    const before = rep.items.length;
    try {
      const footer = tag.ver === 4 && tag.flags & 16 ? 10 : 0;
      let body = b.subarray(tag.start + 10, tag.end - footer);
      if (tag.flags & 128 && tag.ver < 4) body = deunsync(body);
      let p = 0;
      if (tag.flags & 64) p = tag.ver === 3 ? 4 + readBe32(body, 0) : tag.ver === 4 ? syncsafeAt(body, 0) : 0;
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
          const format = body[p + 9];
          if (format & 64) frame = frame.subarray(1);
          if (format & 12) unreadable = true;
          if (format & 1) frame = frame.subarray(4);
          if (format & 2) frame = deunsync(frame);
        } else if (tag.ver === 3 && body[p + 9] & 192) unreadable = true;
        if (unreadable) addItem(rep, `Tag ${printableId(id)}`, "compressed or encrypted", `${source} ${printableId(id)}`);
        else describeId3Frame(rep, id, frame, source);
        p = fe;
      }
    } catch {
    }
    if (rep.items.length === before) addItem(rep, "ID3 tag", `ID3v2.${tag.ver}, ${sizeLabel(tag.end - tag.start)}`, source);
  }
  function describeId3v1(rep, b, at) {
    const before = rep.items.length;
    const field = (o, n) => clipValue(decodeSlice(b, at + o, at + o + n, "latin1").split("\0")[0] ?? "");
    const rows = [
      ["Title", field(3, 30), false],
      ["Artist", field(33, 30), true],
      ["Album", field(63, 30), false],
      ["Year", field(93, 4), false],
      ["Comment", field(97, b[at + 125] === 0 ? 28 : 30), false]
    ];
    for (const [label, value, sensitive] of rows) if (value) addItem(rep, label, value, "ID3v1 tag", sensitive);
    if (rep.items.length === before) addItem(rep, "ID3v1 tag", "empty fields", "ID3v1 tag");
  }
  var APE_LABELS = {
    TITLE: ["Title"],
    ARTIST: ["Artist", true],
    ALBUM: ["Album"],
    COMMENT: ["Comment"],
    YEAR: ["Year"],
    GENRE: ["Genre"],
    TRACK: ["Track number"],
    COMPOSER: ["Composer", true],
    COPYRIGHT: ["Copyright"],
    PUBLISHER: ["Publisher"]
  };
  function describeApe(rep, b, itemsStart, footer) {
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
        const value = (flags >>> 1 & 3) === 0 ? decodeSlice(b, vs, vs + size, "utf-8") : sizeLabel(size);
        addItem(rep, label ? label[0] : `Tag ${printableId(key)}`, value, "APE tag", label?.[1] ?? false);
        p = vs + size;
      }
    } catch {
    }
    if (rep.items.length === before) addItem(rep, "APE tag", "tag present", "APE tag");
  }
  function trailingTags(rep, b, floor) {
    let end = b.length;
    for (let i = 0; i <= MAX_TAGS; i++) {
      if (i === MAX_TAGS) stripRefusal("The file ends in too many stacked tags.");
      if (end - 128 >= floor && latin1At(b, end - 128, 3) === "TAG") {
        describeId3v1(rep, b, end - 128);
        addRemoval(rep, "an ID3v1 tag");
        end -= 128;
        if (end - 227 >= floor && latin1At(b, end - 227, 4) === "TAG+") {
          addItem(rep, "Enhanced tag", "extended ID3v1 fields", "Enhanced TAG");
          end -= 227;
        }
        continue;
      }
      if (end - 32 >= floor && latin1At(b, end - 32, 8) === "APETAGEX") {
        const size = readLe32(b, end - 20);
        const total = size + (readLe32(b, end - 12) & 2147483648 ? 32 : 0);
        if (size < 32 || end - total < floor) stripRefusal("An APE tag runs past the start of the audio.");
        describeApe(rep, b, end - size, end - 32);
        addRemoval(rep, "an APE tag");
        end -= total;
        continue;
      }
      if (end - 10 >= floor && latin1At(b, end - 10, 3) === "3DI") {
        for (let k = 6; k < 10; k++) if (b[end - 10 + k] & 128) stripRefusal("An appended ID3v2 tag has a malformed size.");
        const start = end - 20 - syncsafeAt(b, end - 4);
        if (start < floor || latin1At(b, start, 3) !== "ID3") stripRefusal("An appended ID3v2 tag does not match its footer.");
        describeId3v2(rep, b, { start, end, ver: b[start + 3], flags: b[start + 5] }, "ID3v2 tag");
        addRemoval(rep, "an ID3v2 tag");
        end = start;
        continue;
      }
      if (end - 15 >= floor && latin1At(b, end - 9, 9) === "LYRICS200") {
        const digits = latin1At(b, end - 15, 6);
        if (!/^[0-9]{6}$/.test(digits)) stripRefusal("A Lyrics3 tag has a malformed size.");
        const start = end - 15 - Number(digits);
        if (start < floor || latin1At(b, start, 11) !== "LYRICSBEGIN") stripRefusal("A Lyrics3 tag does not match its size.");
        addItem(rep, "Lyrics", sizeLabel(end - start), "Lyrics3 tag");
        addRemoval(rep, "a Lyrics3 tag");
        end = start;
        continue;
      }
      if (end - 20 >= floor && latin1At(b, end - 9, 9) === "LYRICSEND") {
        const from = Math.max(floor, end - 9 - 5100 - 11);
        let start = -1;
        for (let p = end - 20; p >= from; p--) if (latin1At(b, p, 11) === "LYRICSBEGIN") {
          start = p;
          break;
        }
        if (start < 0) stripRefusal("A Lyrics3 tag has no start marker.");
        addItem(rep, "Lyrics", sizeLabel(end - start), "Lyrics3 tag");
        addRemoval(rep, "a Lyrics3 tag");
        end = start;
        continue;
      }
      break;
    }
    return end;
  }
  function leadingId3(rep, b, source) {
    let p = 0;
    for (let i = 0; i <= MAX_TAGS; i++) {
      const tag = id3v2At(b, p);
      if (!tag) return p;
      if (i === MAX_TAGS) stripRefusal("The file starts with too many stacked ID3 tags.");
      describeId3v2(rep, b, tag, source);
      addRemoval(rep, "an ID3v2 tag");
      p = tag.end;
    }
    return p;
  }
  var BR_V1_L1 = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448];
  var BR_V1_L2 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384];
  var BR_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  var BR_V2_L1 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256];
  var BR_V2_L23 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  var MPEG_RATES = { 0: [11025, 12e3, 8e3], 2: [22050, 24e3, 16e3], 3: [44100, 48e3, 32e3] };
  function mpegFrame(b, o) {
    if (o < 0 || o + 4 > b.length || b[o] !== 255 || (b[o + 1] & 224) !== 224) return null;
    const ver = b[o + 1] >> 3 & 3;
    const layer = b[o + 1] >> 1 & 3;
    const bri = b[o + 2] >> 4;
    const sri = b[o + 2] >> 2 & 3;
    const pad = b[o + 2] >> 1 & 1;
    if (ver === 1 || layer === 0 || bri === 15 || sri === 3) return null;
    const v1 = ver === 3;
    const table = layer === 3 ? v1 ? BR_V1_L1 : BR_V2_L1 : layer === 2 ? v1 ? BR_V1_L2 : BR_V2_L23 : v1 ? BR_V1_L3 : BR_V2_L23;
    const kbps = table[bri];
    if (!kbps) return 0;
    const rate = MPEG_RATES[ver][sri];
    if (layer === 3) return Math.floor(12 * kbps * 1e3 / rate + pad) * 4;
    if (layer === 1 && !v1) return Math.floor(72 * kbps * 1e3 / rate) + pad;
    return Math.floor(144 * kbps * 1e3 / rate) + pad;
  }
  function mpegRun(b, o) {
    const len = mpegFrame(b, o);
    if (len === null) return false;
    if (len === 0) return true;
    return o + len === b.length || mpegFrame(b, o + len) !== null;
  }
  function firstMpegFrame(b, from) {
    const stop = Math.min(b.length, from + MAX_SYNC_SCAN);
    for (let o = from; o < stop; o++) if (b[o] === 255 && mpegRun(b, o)) return o;
    return -1;
  }
  function encoderHeader(b, frame) {
    const len = mpegFrame(b, frame) || 0;
    const end = Math.min(b.length, frame + Math.max(len, 0), frame + 2048);
    let header = "";
    let version = "";
    for (let p = frame + 4; p + 4 <= end && !(header && version); p++) {
      const tag = latin1At(b, p, 4);
      if (!header && (tag === "Xing" || tag === "Info" || tag === "VBRI")) header = tag;
      if (!version && (tag === "LAME" || tag === "Lavc" || tag === "Lavf" || tag === "GOGO")) {
        let q = p;
        while (q < end && q < p + 9 && b[q] >= 32 && b[q] < 127) q++;
        version = latin1At(b, p, q - p).trim();
      }
    }
    if (!header) return null;
    return version ? `${header} header, ${version}` : `${header} header`;
  }
  function planMp3(b) {
    const rep = newReport();
    const start = leadingId3(rep, b, "ID3v2 tag");
    const frame = firstMpegFrame(b, start);
    if (frame < 0) stripRefusal(start > 0 ? "No MP3 audio follows the ID3 tag." : "This is not an MP3 file.");
    const end = trailingTags(rep, b, frame);
    const header = encoderHeader(b, frame);
    if (header) rep.kept.push({ label: "Encoder header frame", value: clipValue(header), source: "MP3 first frame" });
    return { report: rep, audio: [[start, end]], build: () => b.slice(start, end) };
  }
  function describeFlacBlock(rep, b, type, bs, be) {
    const source = "FLAC metadata block";
    if (type === 1) {
      addItem(rep, "Padding with leftover data", sizeLabel(be - bs), "FLAC PADDING block");
      addRemoval(rep, "padding with leftover data");
      return;
    }
    if (type === 2) {
      const id = latin1At(b, bs, 4);
      if (id === "C2PA") addItem(rep, "Content Credentials", "C2PA manifest store", "FLAC APPLICATION block");
      else addItem(rep, "Application data", printableId(id), "FLAC APPLICATION block");
      addRemoval(rep, id === "C2PA" ? "Content Credentials" : "an APPLICATION block");
      return;
    }
    if (type === 4) {
      const before = rep.items.length;
      const vlen = readLe32(b, bs);
      if (bs + 4 + vlen <= be) {
        const vendor = decodeSlice(b, bs + 4, bs + 4 + vlen, "utf-8");
        if (clipValue(vendor)) addItem(rep, "Encoder", vendor, "FLAC VORBIS_COMMENT vendor");
        let p = bs + 8 + vlen;
        const count = Math.min(readLe32(b, bs + 4 + vlen), MAX_FRAMES);
        for (let i = 0; i < count && p + 4 <= be; i++) {
          const len = readLe32(b, p);
          if (p + 4 + len > be) break;
          describeVorbisComment(rep, b.subarray(p + 4, p + 4 + len), "FLAC VORBIS_COMMENT");
          p += 4 + len;
        }
      }
      if (rep.items.length === before) addItem(rep, "Tags", "empty comment block", "FLAC VORBIS_COMMENT");
      addRemoval(rep, "a VORBIS_COMMENT block");
      return;
    }
    if (type === 5) {
      addItem(rep, "Cue sheet", "CD track layout", "FLAC CUESHEET block");
      addRemoval(rep, "a CUESHEET block");
      return;
    }
    if (type === 6) {
      const mlen = readBe32(b, bs + 4);
      const mime = bs + 8 + mlen <= be ? latin1At(b, bs + 8, Math.min(mlen, 64)) : "";
      addItem(rep, "Picture", `${mime || "image"}, ${sizeLabel(be - bs)}`, "FLAC PICTURE block");
      addRemoval(rep, "a PICTURE block");
      return;
    }
    addItem(rep, "Metadata block", `type ${type}, ${sizeLabel(be - bs)}`, source);
    addRemoval(rep, "a metadata block");
  }
  function planFlac(b) {
    const rep = newReport();
    const head = leadingId3(rep, b, "ID3v2 tag before FLAC");
    if (latin1At(b, head, 4) !== "fLaC") stripRefusal("This is not a FLAC file.");
    const kept = [];
    let p = head + 4;
    let last = false;
    for (let n = 0; !last; n++) {
      if (n >= MAX_UNITS) stripRefusal("This FLAC file has too many metadata blocks.");
      if (p + 4 > b.length) stripRefusal("A FLAC metadata block header is cut short.");
      last = (b[p] & 128) !== 0;
      const type = b[p] & 127;
      const bs = p + 4;
      const be = bs + readBe24(b, p + 1);
      if (be > b.length) stripRefusal("A FLAC metadata block runs past the end of the file.");
      if (n === 0 && type !== 0) stripRefusal("A FLAC file must start with a STREAMINFO block.");
      if (n > 0 && type === 0) stripRefusal("A FLAC file has a second STREAMINFO block.");
      if (type === 127) stripRefusal("A FLAC metadata block has an invalid type.");
      if (type === 0 || type === 3 || type === 1 && !anyNonZero(b, bs, be)) kept.push({ type, start: p, end: be });
      else describeFlacBlock(rep, b, type, bs, be);
      p = be;
    }
    const frames = p;
    if (frames < b.length && !(b[frames] === 255 && (b[frames + 1] & 254) === 248)) stripRefusal("No FLAC audio frame follows the metadata.");
    const end = trailingTags(rep, b, frames);
    return {
      report: rep,
      audio: [[frames, end]],
      build: () => {
        const parts = [Uint8Array.of(102, 76, 97, 67)];
        kept.forEach((k, i) => {
          parts.push(Uint8Array.of((i === kept.length - 1 ? 128 : 0) | k.type, b[k.start + 1], b[k.start + 2], b[k.start + 3]));
          parts.push(b.subarray(k.start + 4, k.end));
        });
        parts.push(b.subarray(frames, end));
        return joinBytes(parts);
      }
    };
  }
  var INFO_LABELS = {
    INAM: ["Title"],
    IART: ["Artist", true],
    ICMT: ["Comment"],
    ISFT: ["Software"],
    ICOP: ["Copyright"],
    ICRD: ["Creation date"],
    IENG: ["Engineer", true],
    ITCH: ["Technician", true],
    IGNR: ["Genre"],
    IPRD: ["Album"],
    ISBJ: ["Subject"],
    IKEY: ["Keywords"],
    ISRC: ["Source"],
    ISRF: ["Source form"],
    ICMS: ["Commissioned by", true],
    IARL: ["Archival location"],
    ILNG: ["Language"],
    IMED: ["Medium"],
    ITRK: ["Track number"],
    IPRT: ["Track number"]
  };
  var WAV_DROP = {
    "id3 ": "an ID3 chunk",
    "ID3 ": "an ID3 chunk",
    bext: "a bext chunk",
    iXML: "an iXML chunk",
    axml: "an axml chunk",
    cart: "a cart chunk",
    DISP: "a DISP chunk",
    umid: "a umid chunk",
    _PMX: "an XMP chunk",
    "XMP ": "an XMP chunk",
    C2PA: "Content Credentials"
  };
  var WAV_LISTS = /* @__PURE__ */ new Set(["INFO", "adtl", "exif"]);
  var WAV_PADDING = /* @__PURE__ */ new Set(["JUNK", "junk", "PAD ", "FLLR", "fllr", "free"]);
  function describeWavChunk(rep, b, c) {
    const source = `WAV ${printableId(c.id)} chunk`;
    if (c.id === "LIST") {
      const type = latin1At(b, c.bs, 4);
      if (type === "INFO") {
        const before = rep.items.length;
        let q = c.bs + 4;
        for (let n = 0; n < MAX_FRAMES && q + 8 <= c.be; n++) {
          const id = latin1At(b, q, 4);
          const size = readLe32(b, q + 4);
          if (q + 8 + size > c.be) break;
          const label = ownLabel(INFO_LABELS, id);
          const value = decodeSlice(b, q + 8, q + 8 + size, "utf-8").split("\0")[0] ?? "";
          if (clipValue(value)) addItem(rep, label ? label[0] : `Info field ${printableId(id)}`, value, `WAV INFO ${printableId(id)}`, label?.[1] ?? false);
          q += 8 + size + (size & 1);
        }
        if (rep.items.length === before) addItem(rep, "Info list", "empty fields", "WAV LIST/INFO");
        addRemoval(rep, "a LIST/INFO chunk");
        return;
      }
      addItem(rep, type === "adtl" ? "Cue labels" : "Exif data", sizeLabel(c.be - c.bs), `WAV LIST/${type}`);
      addRemoval(rep, `a LIST/${type} chunk`);
      return;
    }
    if (WAV_PADDING.has(c.id)) {
      addItem(rep, "Padding with leftover data", sizeLabel(c.be - c.bs), source);
      addRemoval(rep, "padding with leftover data");
      return;
    }
    const phrase = ownLabel(WAV_DROP, c.id);
    switch (c.id) {
      case "C2PA":
        addItem(rep, "Content Credentials", "C2PA manifest store", source);
        break;
      case "_PMX":
      case "XMP ":
        addItem(rep, "XMP metadata", sizeLabel(c.be - c.bs), source);
        break;
      case "iXML":
        addItem(rep, "iXML metadata", sizeLabel(c.be - c.bs), source);
        break;
      case "axml":
        addItem(rep, "EBU Core metadata", sizeLabel(c.be - c.bs), source);
        break;
      case "cart":
        addItem(rep, "Broadcast cart data", sizeLabel(c.be - c.bs), source);
        break;
      case "umid":
        addItem(rep, "Material identifier", sizeLabel(c.be - c.bs), source);
        break;
      case "DISP": {
        const value = readLe32(b, c.bs) === 1 ? decodeSlice(b, c.bs + 4, c.be, "latin1").split("\0")[0] ?? "" : "";
        addItem(rep, "Display title", value || sizeLabel(c.be - c.bs), source);
        break;
      }
      case "bext": {
        const field = (o, n) => clipValue(decodeSlice(b, c.bs + o, Math.min(c.be, c.bs + o + n), "latin1").split("\0")[0] ?? "");
        const before = rep.items.length;
        if (field(0, 256)) addItem(rep, "Description", field(0, 256), "WAV bext");
        if (field(256, 32)) addItem(rep, "Originator", field(256, 32), "WAV bext", true);
        if (field(288, 32)) addItem(rep, "Originator reference", field(288, 32), "WAV bext");
        if (field(320, 10)) addItem(rep, "Origination date", `${field(320, 10)} ${field(330, 8)}`, "WAV bext");
        if (c.be - c.bs > 602 && field(602, MAX_VALUE)) addItem(rep, "Coding history", field(602, MAX_VALUE), "WAV bext");
        if (rep.items.length === before) addItem(rep, "Broadcast metadata", sizeLabel(c.be - c.bs), "WAV bext");
        break;
      }
      default: {
        const inner = b.subarray(c.bs, c.be);
        let tag = null;
        try {
          tag = id3v2At(inner, 0);
        } catch {
          tag = null;
        }
        if (tag) describeId3v2(rep, inner, tag, "WAV id3 chunk");
        else addItem(rep, "ID3 tag", sizeLabel(c.be - c.bs), source);
      }
    }
    addRemoval(rep, phrase);
  }
  function planWav(b) {
    const rep = newReport();
    const form = latin1At(b, 0, 4);
    if (form === "RF64" || form === "BW64") stripRefusal("RF64 and BW64 files are not supported yet.");
    if (b.length < 12 || form !== "RIFF" || latin1At(b, 8, 4) !== "WAVE") stripRefusal("This is not a WAV file.");
    const declared = readLe32(b, 4) + 8;
    const end = declared >= 12 && declared <= b.length ? declared : b.length;
    const keep = [];
    const audio = [];
    let p = 12;
    let sawFmt = false;
    for (let n = 0; p + 8 <= end; n++) {
      if (n >= MAX_UNITS) stripRefusal("This WAV file has too many chunks.");
      const id = latin1At(b, p, 4);
      const size = readLe32(b, p + 4);
      const be = p + 8 + size;
      if (be > end) stripRefusal("A WAV chunk runs past the end of the file.");
      const next = Math.min(be + (size & 1), end);
      const c = { id, start: p, end: next, bs: p + 8, be };
      if (id === "fmt ") sawFmt = true;
      if (id === "data") {
        if (size === 0 && next < end) stripRefusal("This WAV does not record the length of its audio.");
        audio.push([c.bs, c.be]);
      }
      const listType = id === "LIST" && size >= 4 ? latin1At(b, c.bs, 4) : "";
      const drop = ownLabel(WAV_DROP, id) !== void 0 || WAV_LISTS.has(listType) || WAV_PADDING.has(id) && anyNonZero(b, c.bs, c.be);
      if (drop) describeWavChunk(rep, b, c);
      else keep.push(c);
      p = next;
    }
    if (!sawFmt || !audio.length) stripRefusal("This WAV file has no audio data.");
    const stray = b.subarray(p, end);
    let trailing = b.subarray(end);
    const tail = latin1At(trailing, 0, 3);
    if (tail === "ID3" || tail === "TAG") {
      let tag = null;
      try {
        tag = id3v2At(trailing, 0);
      } catch {
        tag = null;
      }
      if (tag) describeId3v2(rep, trailing, tag, "ID3 tag after the audio");
      else if (tail === "TAG" && trailing.length >= 128) describeId3v1(rep, trailing, 0);
      else addItem(rep, "ID3 tag", sizeLabel(trailing.length), "ID3 tag after the audio");
      addRemoval(rep, "an ID3 tag after the audio");
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
        out[4] = riff & 255;
        out[5] = riff >>> 8 & 255;
        out[6] = riff >>> 16 & 255;
        out[7] = riff >>> 24 & 255;
        return out;
      }
    };
  }
  function planOgg(b) {
    const rep = newReport();
    const loc = locateOpusComment(b);
    if (!loc) stripRefusal("This Ogg file is not Opus audio. Ogg Vorbis and Ogg FLAC are not supported yet.");
    const tags = parseOpusTags(loc.packet);
    if (!tags) stripRefusal("The Opus comment header is malformed.");
    const vendor = decodeSlice(tags.vendor, 0, tags.vendor.length, "utf-8");
    if (clipValue(vendor)) addItem(rep, "Encoder", vendor, "OpusTags vendor");
    for (const c of tags.comments.slice(0, MAX_FRAMES)) describeVorbisComment(rep, c, "OpusTags");
    const empty = buildOpusTags(new Uint8Array(0), []);
    const extra = loc.packet.length - buildOpusTags(tags.vendor, tags.comments).length;
    if (extra > 0) addItem(rep, "Extra comment data", sizeLabel(extra), "OpusTags");
    if (tags.vendor.length || tags.comments.length || extra > 0) {
      addRemoval(rep, "Opus comments");
      if (loc.pageCount !== 1) stripRefusal("This Opus file keeps its comments across several pages, which is not supported yet.");
    }
    return {
      report: rep,
      audio: [[0, loc.commentStart], [loc.commentEnd, b.length]],
      build: () => joinBytes([b.subarray(0, loc.commentStart), buildOggPage(loc.first22, empty), b.subarray(loc.commentEnd)])
    };
  }
  var C2PA_USERTYPE = [216, 254, 195, 214, 27, 14, 72, 60, 146, 151, 88, 40, 135, 126, 196, 129];
  var XMP_USERTYPE = [190, 122, 207, 203, 151, 169, 66, 232, 156, 113, 153, 148, 145, 227, 175, 172];
  var HEIF_BRANDS = /* @__PURE__ */ new Set(["avif", "avis", "heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "mif2", "msf1"]);
  function bmffBoxes(b, start, end) {
    const out = [];
    let off = start;
    while (off < end) {
      if (out.length >= MAX_UNITS) stripRefusal("This MP4 file has too many boxes.");
      if (off + 8 > end) stripRefusal("An MP4 box header is cut short.");
      let size = readBe32(b, off);
      let hdr = 8;
      if (size === 1) {
        if (off + 16 > end) stripRefusal("An MP4 box header is cut short.");
        size = readBe32(b, off + 8) * 2 ** 32 + readBe32(b, off + 12);
        hdr = 16;
      } else if (size === 0) {
        size = end - off;
      }
      if (!Number.isSafeInteger(size) || size < hdr || off + size > end) stripRefusal("An MP4 box runs past the end of its container.");
      out.push({ off, size, hdr, type: latin1At(b, off + 4, 4), end: off + size });
      off += size;
    }
    return out;
  }
  function bmffBoxesQuiet(b, start, end) {
    try {
      return bmffBoxes(b, start, end);
    } catch {
      return [];
    }
  }
  function uuidKind(b, box) {
    if (box.type !== "uuid" || box.size < box.hdr + 16) return null;
    const p = box.off + box.hdr;
    if (C2PA_USERTYPE.every((v, i) => b[p + i] === v)) return "c2pa";
    if (XMP_USERTYPE.every((v, i) => b[p + i] === v)) return "xmp";
    return null;
  }
  var ILST_LABELS = {
    "©nam": ["Title"],
    "©ART": ["Artist", true],
    aART: ["Album artist", true],
    "©alb": ["Album"],
    "©cmt": ["Comment"],
    desc: ["Description"],
    ldes: ["Long description"],
    "©too": ["Encoder"],
    "©enc": ["Encoded by", true],
    "©day": ["Date"],
    "©gen": ["Genre"],
    gnre: ["Genre"],
    "©wrt": ["Composer", true],
    "©lyr": ["Lyrics"],
    cprt: ["Copyright"],
    "©grp": ["Grouping"],
    covr: ["Cover art"],
    trkn: ["Track number"],
    disk: ["Disc number"],
    tmpo: ["Tempo"],
    apID: ["Account name", true],
    ownr: ["Owner", true],
    purd: ["Purchase date"],
    "©pub": ["Publisher"],
    "©xyz": ["GPS location", true],
    "©mak": ["Device make", true],
    "©mod": ["Device model", true],
    "©swr": ["Software"],
    "©inf": ["Information"],
    "©des": ["Description"],
    "©aut": ["Author", true],
    name: ["Name"]
  };
  var MDTA_LABELS = {
    "com.apple.quicktime.location.ISO6709": ["GPS location", true],
    "com.apple.quicktime.make": ["Device make", true],
    "com.apple.quicktime.model": ["Device model", true],
    "com.apple.quicktime.software": ["Software"],
    "com.apple.quicktime.creationdate": ["Creation date"],
    "com.apple.quicktime.author": ["Author", true],
    "com.apple.quicktime.title": ["Title"],
    "com.apple.quicktime.comment": ["Comment"],
    "com.apple.quicktime.description": ["Description"],
    "com.android.version": ["Software"]
  };
  function ilstValue(b, entry) {
    for (const d of bmffBoxesQuiet(b, entry.off + entry.hdr, entry.end)) {
      if (d.type !== "data") continue;
      const p = d.off + d.hdr;
      if (d.end - p < 8) return "";
      const type = readBe32(b, p) & 16777215;
      const vs = p + 8;
      if (type === 1) return decodeSlice(b, vs, d.end, "utf-8");
      if (type === 2) return decodeSlice(b, vs, d.end, "utf-16be");
      if (type === 13 || type === 14 || type === 27) return `picture, ${sizeLabel(d.end - vs)}`;
      if ((entry.type === "trkn" || entry.type === "disk") && d.end - vs >= 6) return `${readBe16(b, vs + 2)} of ${readBe16(b, vs + 4)}`;
      if ((type === 21 || type === 22 || type === 0) && d.end - vs >= 1 && d.end - vs <= 4) {
        let n = 0;
        for (let i = vs; i < d.end; i++) n = n * 256 + b[i];
        return String(n);
      }
      return sizeLabel(d.end - vs);
    }
    return "";
  }
  function describeIlst(rep, b, ilst, keys, source) {
    for (const entry of bmffBoxesQuiet(b, ilst.off + ilst.hdr, ilst.end).slice(0, MAX_FRAMES)) {
      if (keys) {
        const key = keys[readBe32(b, entry.off + 4) - 1] ?? "";
        const label2 = ownLabel(MDTA_LABELS, key);
        addItem(rep, label2 ? label2[0] : `Tag ${printableId(key || entry.type)}`, ilstValue(b, entry), source, label2?.[1] ?? false);
        continue;
      }
      if (entry.type === "----") {
        const kids = bmffBoxesQuiet(b, entry.off + entry.hdr, entry.end);
        const name = kids.find((k) => k.type === "name");
        const n = name ? decodeSlice(b, name.off + name.hdr + 4, name.end, "utf-8") : "";
        addItem(rep, `Tag ${clipValue(n).slice(0, 40) || "freeform"}`, ilstValue(b, entry), source);
        continue;
      }
      const label = ownLabel(ILST_LABELS, entry.type);
      addItem(rep, label ? label[0] : `Tag ${printableId(entry.type)}`, ilstValue(b, entry), source, label?.[1] ?? false);
    }
  }
  function describeMeta(rep, b, meta, source) {
    const p = meta.off + meta.hdr;
    const start = latin1At(b, p + 4, 4) === "hdlr" ? p : p + 4;
    const kids = bmffBoxesQuiet(b, start, meta.end);
    const hdlr = kids.find((k) => k.type === "hdlr");
    const handler = hdlr ? latin1At(b, hdlr.off + hdlr.hdr + 8, 4) : "";
    let keys = null;
    if (handler === "mdta") {
      const k = kids.find((x) => x.type === "keys");
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
      if (k.type === "ilst") describeIlst(rep, b, k, keys, source);
      else if (k.type === "ID32") {
        const inner = b.subarray(k.off + k.hdr + 6, k.end);
        let tag = null;
        try {
          tag = id3v2At(inner, 0);
        } catch {
          tag = null;
        }
        if (tag) describeId3v2(rep, inner, tag, `${source} ID3`);
      } else if (k.type === "xml " || k.type === "XMP_") addItem(rep, "XML metadata", sizeLabel(k.end - k.off), source);
    }
  }
  function qtText(b, box) {
    const p = box.off + box.hdr;
    const len = readBe16(b, p);
    return len > 0 && p + 4 + len <= box.end ? decodeSlice(b, p + 4, p + 4 + len, "utf-8") : decodeSlice(b, p, box.end, "utf-8");
  }
  function describeUdta(rep, b, udta, source) {
    for (const k of bmffBoxesQuiet(b, udta.off + udta.hdr, udta.end).slice(0, MAX_FRAMES)) {
      if (k.type === "meta") describeMeta(rep, b, k, `${source} meta`);
      else if (k.type === "XMP_") addItem(rep, "XMP metadata", sizeLabel(k.size), source);
      else if (k.type === "chpl") addItem(rep, "Chapters", "chapter list", source);
      else if (k.type === "free" || k.type === "skip") continue;
      else if (ownLabel(ILST_LABELS, k.type)) {
        const l = ownLabel(ILST_LABELS, k.type);
        addItem(rep, l[0], qtText(b, k), source, l[1] ?? false);
      } else addItem(rep, `User data ${printableId(k.type)}`, sizeLabel(k.size), source);
    }
  }
  function mp4Date(secs) {
    const unix = secs - 2082844800;
    if (!(unix > 0) || !Number.isFinite(unix)) return "recorded";
    const d = new Date(unix * 1e3);
    return Number.isNaN(d.getTime()) ? "recorded" : `${d.toISOString().slice(0, 16).replace("T", " ")} UTC`;
  }
  function dropBox(rep, b, box, where, top) {
    const kind = uuidKind(b, box);
    if (kind === "c2pa") {
      const p = box.off + box.hdr + 20;
      const purpose = latin1At(b, p, Math.max(0, termEnd(b, p, box.end, false) - p));
      addItem(rep, "Content Credentials", purpose === "merkle" ? "C2PA fragment hashes" : "C2PA manifest store", `MP4 ${where} uuid box`);
      addRemoval(rep, "Content Credentials (a C2PA box)");
      return true;
    }
    if (kind === "xmp") {
      addItem(rep, "XMP metadata", sizeLabel(box.size), `MP4 ${where} uuid box`);
      addRemoval(rep, "an XMP box");
      return true;
    }
    if (box.type === "udta") {
      const before = rep.items.length;
      describeUdta(rep, b, box, `MP4 ${where} udta`);
      if (rep.items.length === before) addItem(rep, "User data box", sizeLabel(box.size), `MP4 ${where} udta`);
      addRemoval(rep, "a udta metadata box");
      return true;
    }
    if (box.type === "meta") {
      const before = rep.items.length;
      describeMeta(rep, b, box, `MP4 ${where} meta`);
      if (rep.items.length === before) addItem(rep, "Metadata box", sizeLabel(box.size), `MP4 ${where} meta`);
      addRemoval(rep, "a meta metadata box");
      return true;
    }
    if (top && box.type === "jumb") {
      addItem(rep, "Content Credentials", "JUMBF box", "MP4 top-level jumb box");
      addRemoval(rep, "Content Credentials (a JUMBF box)");
      return true;
    }
    if ((box.type === "free" || box.type === "skip") && anyNonZero(b, box.off + box.hdr, box.end)) {
      addItem(rep, "Padding with leftover data", sizeLabel(box.size - box.hdr), `MP4 ${where} ${box.type} box`);
      addRemoval(rep, "padding with leftover data");
      return true;
    }
    return false;
  }
  function chunkSlot(b, k) {
    const p = k.off + k.hdr;
    if (k.end - p < 8) stripRefusal("An MP4 chunk offset table is cut short.");
    const wide = k.type === "co64";
    const count = readBe32(b, p + 4);
    if (8 + count * (wide ? 8 : 4) > k.end - p) stripRefusal("An MP4 chunk offset table claims more entries than it holds.");
    return { pos: k.hdr + 8, count, stride: wide ? 8 : 4, wide };
  }
  function blankHandler(rep, b, k, parent) {
    const p = k.off + k.hdr;
    if (k.end - p < 24) return null;
    if (parent === "mdia" && latin1At(b, p + 8, 4) === "vide") rep.video = true;
    const ns = p + 24;
    if (!anyNonZero(b, ns, k.end)) return null;
    const counted = b[ns] === k.end - ns - 1;
    addItem(rep, "Handler description", decodeSlice(b, counted ? ns + 1 : ns, k.end, "utf-8").split("\0")[0] ?? "", `MP4 ${parent} hdlr`);
    addRemoval(rep, "a handler name");
    const out = new Uint8Array(8 + 24 + 1);
    putBe32(out, 0, out.length);
    out.set(b.subarray(k.off + 4, k.off + 8), 4);
    out.set(b.subarray(p, p + 24), 8);
    return out;
  }
  function clearTimes(rep, b, k) {
    const p = k.off + k.hdr;
    const v = b[p];
    if (v !== 0 && v !== 1) return null;
    const span = v === 1 ? 16 : 8;
    if (k.end - p < 4 + span) stripRefusal("An MP4 header box is cut short.");
    if (!anyNonZero(b, p + 4, p + 4 + span)) return null;
    if (!rep.timesShown) {
      const created = v === 1 ? readBe32(b, p + 4) * 2 ** 32 + readBe32(b, p + 8) : readBe32(b, p + 4);
      const modified = v === 1 ? readBe32(b, p + 12) * 2 ** 32 + readBe32(b, p + 16) : readBe32(b, p + 8);
      addItem(rep, "Creation time", mp4Date(created || modified), `MP4 ${k.type}`);
      rep.timesShown = true;
    }
    addRemoval(rep, "creation and modification times");
    const out = b.slice(k.off, k.end);
    out.fill(0, k.hdr + 4, k.hdr + 4 + span);
    return out;
  }
  var MP4_CONTAINERS = /* @__PURE__ */ new Set(["moov", "trak", "mdia", "minf", "stbl"]);
  var MP4_TIMED = /* @__PURE__ */ new Set(["mvhd", "tkhd", "mdhd"]);
  function rebuildMovieBox(rep, b, box, depth) {
    if (depth > MP4_NEST_DEPTH) stripRefusal("The MP4 movie header nests too deeply.");
    const parts = [];
    const slots = [];
    let len = 0;
    let changed = false;
    for (const k of bmffBoxes(b, box.off + box.hdr, box.end)) {
      if (box.type !== "stbl" && dropBox(rep, b, k, box.type, false)) {
        changed = true;
        continue;
      }
      let piece = b.subarray(k.off, k.end);
      let inner = [];
      if (MP4_CONTAINERS.has(k.type)) {
        const r = rebuildMovieBox(rep, b, k, depth + 1);
        if (r.changed) {
          piece = r.bytes;
          changed = true;
        }
        inner = r.slots;
      } else if (k.type === "hdlr" && (box.type === "mdia" || box.type === "minf")) {
        const h = blankHandler(rep, b, k, box.type);
        if (h) {
          piece = h;
          changed = true;
        }
      } else if (MP4_TIMED.has(k.type)) {
        const t = clearTimes(rep, b, k);
        if (t) {
          piece = t;
          changed = true;
        }
      } else if (box.type === "stbl" && (k.type === "stco" || k.type === "co64")) {
        inner = [chunkSlot(b, k)];
      }
      for (const s of inner) slots.push({ ...s, pos: s.pos + len });
      parts.push(piece);
      len += piece.length;
    }
    if (!changed) return { bytes: b.subarray(box.off, box.end), changed, slots: slots.map((s) => ({ ...s, pos: s.pos + box.hdr })) };
    if (8 + len > 4294967295) stripRefusal("The MP4 movie header is too large to rewrite.");
    const head = new Uint8Array(8);
    putBe32(head, 0, 8 + len);
    head.set(b.subarray(box.off + 4, box.off + 8), 4);
    return { bytes: joinBytes([head, ...parts]), changed, slots: slots.map((s) => ({ ...s, pos: s.pos + 8 })) };
  }
  function fragmentSlots(b, moof) {
    const slots = [];
    for (const traf of bmffBoxes(b, moof.off + moof.hdr, moof.end)) {
      if (traf.type !== "traf") continue;
      for (const k of bmffBoxes(b, traf.off + traf.hdr, traf.end)) {
        if (k.type !== "tfhd") continue;
        const p = k.off + k.hdr;
        if (k.end - p < 8) stripRefusal("An MP4 fragment header is cut short.");
        if (!(readBe24(b, p + 1) & 1)) continue;
        if (k.end - p < 16) stripRefusal("An MP4 fragment header is cut short.");
        slots.push({ pos: p + 8 - moof.off, count: 1, stride: 8, wide: true });
      }
    }
    return slots;
  }
  function randomAccessSlots(b, mfra) {
    const slots = [];
    for (const k of bmffBoxes(b, mfra.off + mfra.hdr, mfra.end)) {
      if (k.type !== "tfra") continue;
      const p = k.off + k.hdr;
      if (k.end - p < 16) stripRefusal("An MP4 fragment index is cut short.");
      const wide = b[p] === 1;
      const sizes = readBe32(b, p + 8);
      const entry = (wide ? 16 : 8) + (sizes >> 4 & 3) + (sizes >> 2 & 3) + (sizes & 3) + 3;
      const count = readBe32(b, p + 12);
      if (16 + count * entry > k.end - p) stripRefusal("An MP4 fragment index claims more entries than it holds.");
      if (count) slots.push({ pos: p + 16 + (wide ? 8 : 4) - mfra.off, count, stride: entry, wide });
    }
    return slots;
  }
  function planMp4(b) {
    const rep = newReport();
    const top = bmffBoxes(b, 0, b.length);
    if (!top.length || top[0].type !== "ftyp") stripRefusal("This is not an MP4 or M4A file.");
    if (HEIF_BRANDS.has(latin1At(b, 8, 4))) stripRefusal("This is a HEIF or AVIF picture, not audio.");
    if (!top.some((x) => x.type === "moov")) stripRefusal("This MP4 has no movie header, so it is not an audio or video file.");
    const pieces = top.map((box) => {
      if (dropBox(rep, b, box, "top-level", true)) return { box, dropped: true, bytes: null, slots: [] };
      if (box.type === "moov") {
        const r = rebuildMovieBox(rep, b, box, 0);
        return { box, dropped: false, bytes: r.changed ? r.bytes : null, slots: r.slots };
      }
      if (box.type === "moof") return { box, dropped: false, bytes: null, slots: fragmentSlots(b, box) };
      if (box.type === "mfra") return { box, dropped: false, bytes: null, slots: randomAccessSlots(b, box) };
      return { box, dropped: false, bytes: null, slots: [] };
    });
    const frag = top.filter((x) => x.type === "moof" || x.type === "sidx");
    if (top.some((x) => x.type === "moof")) {
      const first = frag.reduce((m, x) => Math.min(m, x.off), Number.POSITIVE_INFINITY);
      const last = top.reduce((m, x) => x.off >= first && (x.type === "moof" || x.type === "mdat" || x.type === "sidx") ? Math.max(m, x.end) : m, first);
      if (pieces.some((p) => (p.dropped || p.bytes) && p.box.off >= first && p.box.off < last)) {
        stripRefusal("This fragmented MP4 holds metadata between its fragments, which is not supported yet.");
      }
    }
    const audio = top.filter((x) => x.type === "mdat").map((x) => [x.off + x.hdr, x.end]);
    return {
      report: rep,
      audio,
      build: () => {
        const at = /* @__PURE__ */ new Map();
        const parts = [];
        let pos = 0;
        for (const p of pieces) {
          if (p.dropped) continue;
          const bytes = p.bytes ?? b.subarray(p.box.off, p.box.end);
          at.set(p.box, pos);
          parts.push(bytes);
          pos += bytes.length;
        }
        const out = joinBytes(parts);
        const verbatim = pieces.filter((p) => !p.dropped && !p.bytes).map((p) => p.box);
        const move = (x) => {
          if (x === b.length) return out.length;
          let lo = 0;
          let hi = verbatim.length - 1;
          while (lo <= hi) {
            const mid = lo + hi >> 1;
            const v = verbatim[mid];
            if (x < v.off) hi = mid - 1;
            else if (x >= v.end) lo = mid + 1;
            else return at.get(v) + (x - v.off);
          }
          return stripRefusal("A media offset in this MP4 points outside its media data.");
        };
        for (const p of pieces) {
          if (p.dropped) continue;
          const base = at.get(p.box);
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
      }
    };
  }
  function sniffAudioFormat(bytes) {
    if (bytes.length < 12) return null;
    const head = latin1At(bytes, 0, 4);
    if (head === "RIFF" && latin1At(bytes, 8, 4) === "WAVE" || head === "RF64" || head === "BW64") return "wav";
    if (head === "fLaC") return "flac";
    if (head === "OggS") return latin1At(bytes, 0, Math.min(bytes.length, 80)).includes("OpusHead") ? "ogg" : null;
    if (latin1At(bytes, 4, 4) === "ftyp") return HEIF_BRANDS.has(latin1At(bytes, 8, 4)) ? null : "mp4";
    if (latin1At(bytes, 0, 3) === "ID3") {
      let p = 0;
      try {
        for (let i = 0; i < MAX_TAGS; i++) {
          const tag = id3v2At(bytes, p);
          if (!tag) break;
          p = tag.end;
        }
      } catch {
        return "mp3";
      }
      return latin1At(bytes, p, 4) === "fLaC" ? "flac" : "mp3";
    }
    const len = mpegFrame(bytes, 0);
    return len && mpegFrame(bytes, len) !== null ? "mp3" : null;
  }
  function planStrip(bytes, format) {
    switch (format) {
      case "mp4":
        return planMp4(bytes);
      case "wav":
        return planWav(bytes);
      case "mp3":
        return planMp3(bytes);
      case "flac":
        return planFlac(bytes);
      case "ogg":
        return planOgg(bytes);
      default:
        return stripRefusal(`Unsupported audio format: ${String(format)}`);
    }
  }
  function inspectAudioMetadata(bytes, format) {
    const { report } = planStrip(bytes, format);
    return { format, items: report.items, removals: report.removals, kept: report.kept, video: report.video };
  }
  function audioMetadataResidual(bytes, format) {
    return planStrip(bytes, format).report.removals[0] ?? null;
  }
  function sameAudio(a, aSpans, b, bSpans) {
    let ai = 0;
    let ao = aSpans[0]?.[0] ?? 0;
    let bi = 0;
    let bo = bSpans[0]?.[0] ?? 0;
    for (; ; ) {
      while (ai < aSpans.length && ao >= aSpans[ai][1]) {
        ai++;
        ao = aSpans[ai]?.[0] ?? 0;
      }
      while (bi < bSpans.length && bo >= bSpans[bi][1]) {
        bi++;
        bo = bSpans[bi]?.[0] ?? 0;
      }
      if (ai === aSpans.length || bi === bSpans.length) return ai === aSpans.length && bi === bSpans.length;
      const n = Math.min(aSpans[ai][1] - ao, bSpans[bi][1] - bo);
      for (let i = 0; i < n; i++) if (a[ao + i] !== b[bo + i]) return false;
      ao += n;
      bo += n;
    }
  }
  function stripAudioMetadata(bytes, format) {
    const first = planStrip(bytes, format);
    if (!first.report.removals.length) return bytes;
    const out = first.build();
    let again;
    try {
      again = planStrip(out, format);
    } catch (err) {
      return stripRefusal(`The clean copy did not read back: ${err.message}`);
    }
    if (again.report.removals.length) stripRefusal(`The clean copy still contains ${again.report.removals[0]}.`);
    if (!sameAudio(bytes, first.audio, out, again.audio)) stripRefusal("The clean copy changed the audio data.");
    return out;
  }
  return __toCommonJS(strip_audio_exports);
})();
// === /lolly:shared strip-audio ===

const AUDIO_LABEL = { mp4: 'M4A', wav: 'WAV', mp3: 'MP3', flac: 'FLAC', ogg: 'Opus' };
const AUDIO_MIME = { mp4: 'audio/mp4', wav: 'audio/wav', mp3: 'audio/mpeg', flac: 'audio/flac', ogg: 'audio/ogg' };

// The name the report uses: an MP4 with a video track is not called M4A.
function audioKind(format, video) {
  return format === 'mp4' && video ? 'MP4' : AUDIO_LABEL[format];
}

function audioReport(f, format, base) {
  const unreadable = (e) => ({
    ...base, supported: true, kind: AUDIO_LABEL[format], unreadable: true,
    unreadableNote: `${(e && e.message) || 'The file could not be read.'} Nothing was removed.`,
  });
  let inspection;
  try { inspection = LollyStripAudio.inspectAudioMetadata(f.bytes, format); } catch (e) { return unreadable(e); }
  const kind = audioKind(format, inspection.video);
  let cleanLen = f.bytes.length;
  if (inspection.removals.length) {
    try { cleanLen = LollyStripAudio.stripAudioMetadata(f.bytes, format).length; } catch (e) { return { ...unreadable(e), kind }; }
  }
  const findings = inspection.items.map(i => ({ label: i.label, detail: i.value, tone: i.sensitive ? 'warn' : '' }));
  const removed = Math.max(0, f.bytes.length - cleanLen);
  const kept = inspection.kept.map(k => ` The first audio frame keeps its encoder header (${k.value}), because players read the track length and seek table from that frame.`).join('');
  const nothing = inspection.removals.length === 0;
  return {
    ...base,
    supported: true,
    kind,
    findings,
    nothingFound: nothing,
    cleanSize: fmtBytes(cleanLen),
    tailNote: `The clean copy keeps the audio data byte for byte. Tags, Content Credentials and other metadata are removed, and nothing is re-encoded.${kept}`,
    cleanNote: `You can still download a copy below.${kept}`,
    metaSummary: nothing ? '' : `Found ${findings.length} item${findings.length === 1 ? '' : 's'} of hidden data${removed > 0 ? ` - ${fmtBytes(removed)} will be removed` : ''}.`,
  };
}

// ─── EXIF / TIFF reader (shared by JPEG APP1 and PNG eXIf) ────────────────────
// Offsets inside a TIFF block are relative to the start of the TIFF header, so
// the DataView is anchored there. Best-effort: anything malformed → null.

function readTiff(bytes, base, len) {
  if (len < 8 || base + len > bytes.length) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset + base, len);
  const b0 = dv.getUint8(0), b1 = dv.getUint8(1);
  let le;
  if (b0 === 0x49 && b1 === 0x49) le = true;        // "II" little-endian
  else if (b0 === 0x4D && b1 === 0x4D) le = false;  // "MM" big-endian
  else return null;
  if (dv.getUint16(2, le) !== 42) return null;
  const out = { make: null, model: null, software: null, dateTime: null, artist: null, hasGps: false, gps: null };
  for (const e of readIfd(dv, dv.getUint32(4, le), le)) {
    switch (e.tag) {
      case 0x010F: out.make     = ascii(dv, e); break;
      case 0x0110: out.model    = ascii(dv, e); break;
      case 0x0131: out.software = ascii(dv, e); break;
      case 0x0132: out.dateTime = ascii(dv, e); break;
      case 0x013B: out.artist   = ascii(dv, e); break;
      case 0x8825: {                                // GPS IFD pointer (LONG offset)
        out.hasGps = true;
        out.gps = readGps(dv, dv.getUint32(e.valueOffset, le), le);
        break;
      }
    }
  }
  return out;
}

const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

function readIfd(dv, off, le) {
  const out = [];
  if (off <= 0 || off + 2 > dv.byteLength) return out;
  const n = dv.getUint16(off, le);
  let p = off + 2;
  for (let i = 0; i < n; i++) {
    if (p + 12 > dv.byteLength) break;
    const tag = dv.getUint16(p, le);
    const type = dv.getUint16(p + 2, le);
    const count = dv.getUint32(p + 4, le);
    const size = (TYPE_SIZE[type] || 1) * count;
    const valueOffset = size > 4 ? dv.getUint32(p + 8, le) : p + 8;
    out.push({ tag, type, count, size, valueOffset, le });
    p += 12;
  }
  return out;
}

function ascii(dv, e) {
  if (e.type !== 2) return null;
  let s = '';
  for (let i = 0; i < e.count; i++) {
    const off = e.valueOffset + i;
    if (off >= dv.byteLength) break;
    const c = dv.getUint8(off);
    if (c === 0) break;
    s += String.fromCharCode(c);
  }
  return s.trim() || null;
}

function readRationals(dv, e, want) {
  if (e.type !== 5) return null;
  const out = [];
  for (let i = 0; i < Math.min(e.count, want); i++) {
    const o = e.valueOffset + i * 8;
    if (o + 8 > dv.byteLength) return null;
    const num = dv.getUint32(o, e.le), den = dv.getUint32(o + 4, e.le);
    out.push(den ? num / den : 0);
  }
  return out.length === want ? out : null;
}

function readGps(dv, off, le) {
  let latRef = null, lonRef = null, lat = null, lon = null;
  for (const e of readIfd(dv, off, le)) {
    if (e.tag === 0x0001) latRef = ascii(dv, e);
    else if (e.tag === 0x0003) lonRef = ascii(dv, e);
    else if (e.tag === 0x0002) lat = readRationals(dv, e, 3);
    else if (e.tag === 0x0004) lon = readRationals(dv, e, 3);
  }
  if (!lat || !lon) return null;
  const dec = (dms, ref) => {
    const d = dms[0] + dms[1] / 60 + dms[2] / 3600;
    return (ref === 'S' || ref === 'W') ? -d : d;
  };
  return { lat: dec(lat, latRef), lon: dec(lon, lonRef) };
}

// ─── JPEG segment scan + strip ────────────────────────────────────────────────

function scanJpeg(bytes) {
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  const segs = [];
  let p = 2;
  while (p + 1 < bytes.length) {
    if (bytes[p] !== 0xFF) break;                 // misaligned - bail, keep file intact
    let marker = bytes[p + 1];
    while (marker === 0xFF && p + 2 < bytes.length) { p++; marker = bytes[p + 1]; } // fill bytes
    if (marker === 0xD9) { segs.push({ marker, start: p, end: p + 2 }); break; } // EOI
    if (marker === 0xDA) { segs.push({ marker, start: p, sos: true }); break; }   // SOS → entropy data
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) { // standalone, no length
      segs.push({ marker, start: p, end: p + 2 }); p += 2; continue;
    }
    if (p + 4 > bytes.length) break;
    const len = (bytes[p + 2] << 8) | bytes[p + 3];
    if (len < 2 || p + 2 + len > bytes.length) break;
    segs.push({ marker, start: p, end: p + 2 + len, dataStart: p + 4, dataLen: len - 2 });
    p += 2 + len;
  }
  return segs;
}

function stripJpeg(bytes) {
  const segs = scanJpeg(bytes);
  if (!segs) return bytes;
  const keep = [bytes.subarray(0, 2)];            // SOI
  for (const s of segs) {
    if (s.sos) { keep.push(bytes.subarray(s.start)); continue; } // SOS + entropy data + EOI
    const isApp = s.marker >= 0xE0 && s.marker <= 0xEF;
    const isCom = s.marker === 0xFE;
    if ((isApp && s.marker !== 0xE0) || isCom) continue; // drop metadata; keep APP0 (JFIF)
    keep.push(bytes.subarray(s.start, s.end));
  }
  return concatBytes(keep);
}

// ─── PNG chunk scan + strip ─────────────────────────────────────────────────

const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_STRIP = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'caBX']);

function isPng(b) {
  for (let i = 0; i < 8; i++) if (b[i] !== PNG_SIG[i]) return false;
  return true;
}

function scanPng(bytes) {
  const chunks = [];
  let p = 8;
  while (p + 8 <= bytes.length) {
    const len = ((bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3]) >>> 0;
    const type = String.fromCharCode(bytes[p + 4], bytes[p + 5], bytes[p + 6], bytes[p + 7]);
    const end = p + 12 + len;
    if (end > bytes.length) break;
    chunks.push({ type, start: p, end, dataStart: p + 8, dataLen: len });
    p = end;
    if (type === 'IEND') break;
  }
  return chunks;
}

function stripPng(bytes) {
  const chunks = scanPng(bytes);
  if (!chunks.length) return bytes;
  const keep = [bytes.subarray(0, 8)];
  for (const c of chunks) {
    if (PNG_STRIP.has(c.type)) continue;
    keep.push(bytes.subarray(c.start, c.end));
  }
  return concatBytes(keep);
}

// ─── raster analyse (JPEG / PNG) ──────────────────────────────────────────────

function analyzeRaster(bytes) {
  const findings = [];
  let kind = 'file';
  const gpsDetail = (gps) => gps ? `${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}` : 'present';

  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    kind = 'JPEG';
    let exif = null, xmp = false, icc = false, iptc = false, comment = false;
    for (const s of scanJpeg(bytes) || []) {
      if (s.dataStart == null) continue;
      if (s.marker === 0xE1) {
        if (matchAscii(bytes, s.dataStart, 'Exif\0\0')) exif = readTiff(bytes, s.dataStart + 6, s.dataLen - 6);
        else if (matchAscii(bytes, s.dataStart, 'http://ns.adobe.com/xap/')) xmp = true;
      } else if (s.marker === 0xE2 && matchAscii(bytes, s.dataStart, 'ICC_PROFILE\0')) icc = true;
      else if (s.marker === 0xED) iptc = true;
      else if (s.marker === 0xFE) comment = true;
    }
    if (exif) {
      if (exif.hasGps) findings.push({ label: 'GPS location', detail: gpsDetail(exif.gps), tone: 'warn' });
      if (exif.make || exif.model) findings.push({ label: 'Camera / device', detail: [exif.make, exif.model].filter(Boolean).join(' '), tone: 'warn' });
      if (exif.artist) findings.push({ label: 'Author', detail: exif.artist, tone: 'warn' });
      if (exif.dateTime) findings.push({ label: 'Date taken', detail: exif.dateTime, tone: '' });
      if (exif.software) findings.push({ label: 'Software', detail: exif.software, tone: '' });
      findings.push({ label: 'EXIF block', detail: 'camera & shooting data', tone: '' });
    }
    if (xmp) findings.push({ label: 'XMP metadata', detail: 'editing / rights data', tone: '' });
    if (icc) findings.push({ label: 'ICC colour profile', detail: 'embedded profile', tone: '' });
    if (iptc) findings.push({ label: 'IPTC / Photoshop', detail: 'caption / author data', tone: '' });
    if (comment) findings.push({ label: 'Comment', detail: 'embedded text', tone: '' });
  } else if (isPng(bytes)) {
    kind = 'PNG';
    let exif = null, texts = 0, time = false, credentials = false;
    for (const c of scanPng(bytes)) {
      if (c.type === 'eXIf') exif = readTiff(bytes, c.dataStart, c.dataLen);
      else if (c.type === 'tEXt' || c.type === 'zTXt' || c.type === 'iTXt') texts++;
      else if (c.type === 'tIME') time = true;
      else if (c.type === 'caBX') credentials = true;
    }
    if (exif) {
      if (exif.hasGps) findings.push({ label: 'GPS location', detail: gpsDetail(exif.gps), tone: 'warn' });
      if (exif.make || exif.model) findings.push({ label: 'Camera / device', detail: [exif.make, exif.model].filter(Boolean).join(' '), tone: 'warn' });
      findings.push({ label: 'EXIF block', detail: 'embedded camera data', tone: '' });
    }
    if (texts) findings.push({ label: 'Text chunks', detail: `${texts} text/metadata chunk${texts > 1 ? 's' : ''}`, tone: '' });
    if (credentials) findings.push({ label: 'Content credentials', detail: 'embedded provenance packet', tone: '' });
    if (time) findings.push({ label: 'Timestamp', detail: 'last-modified time', tone: '' });
  }
  return { kind, findings };
}

// ─── SVG tokenizer + clean + analyse ──────────────────────────────────────────
// No DOM: a small, careful XML tokenizer (same spirit as the JPEG/PNG scanners).

function prefixOf(name) {
  const c = name.indexOf(':');
  return c > 0 ? name.slice(0, c).toLowerCase() : '';
}

// Namespaces that are editor-private or pure metadata and never paint pixels.
const DROP_EL_PREFIX = new Set(['sodipodi', 'inkscape', 'i', 'x']); // i:/x: = Adobe private
const DROP_EL_NAME = new Set(['metadata']);
// Whitespace inside these is content - never collapse it.
const SPACE_SENSITIVE = new Set(['text', 'tspan', 'textpath', 'tref', 'style', 'title', 'desc', 'script']);
// Namespace declarations safe to drop - ONLY for prefixes we also strip wholesale
// (elements + attributes). We must not drop a decl while leaving attributes in that
// namespace behind (e.g. Affinity's serif:id, Adobe's a:*), so those stay.
const DROP_XMLNS = new Set([
  'xmlns:inkscape', 'xmlns:sodipodi', 'xmlns:i', 'xmlns:x', // dropped as element/attr prefixes
  'xmlns:dc', 'xmlns:cc', 'xmlns:rdf',                      // metadata-only - block is removed
]);

function shouldDropElement(name) {
  return DROP_EL_NAME.has(name.toLowerCase()) || DROP_EL_PREFIX.has(prefixOf(name));
}

function shouldDropAttr(name) {
  if (name === 'xml:space') return false;           // rendering-relevant - keep
  if (DROP_EL_PREFIX.has(prefixOf(name))) return true; // inkscape:*, sodipodi:*, i:*, x:*
  if (DROP_XMLNS.has(name.toLowerCase())) return true;
  if (name === 'data-name') return true;            // Illustrator layer names (privacy)
  return false;
}

function parseAttrs(s) {
  const attrs = [];
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g;
  let m;
  while ((m = re.exec(s)) && m[0]) {
    const value = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : null));
    attrs.push({ name: m[1], value });
  }
  return attrs;
}

function parseTag(raw) {
  const selfClose = raw.endsWith('/>');
  const inner = raw.slice(1, selfClose ? -2 : -1);
  if (inner[0] === '/') return { t: 'close', name: inner.slice(1).trim(), raw };
  const m = /^\s*([^\s/>]+)/.exec(inner);
  const name = m ? m[1] : '';
  const attrs = m ? parseAttrs(inner.slice(m[0].length)) : [];
  return { t: selfClose ? 'self' : 'open', name, attrs, raw };
}

function tokenize(s) {
  const toks = [];
  let i = 0;
  const n = s.length;
  while (i < n) {
    if (s[i] === '<') {
      if (s.startsWith('<!--', i)) {
        const end = s.indexOf('-->', i + 4);
        const close = end === -1 ? n : end + 3;
        toks.push({ t: 'comment', raw: s.slice(i, close), text: s.slice(i + 4, end === -1 ? n : end) });
        i = close;
      } else if (s.startsWith('<![CDATA[', i)) {
        const end = s.indexOf(']]>', i + 9);
        const close = end === -1 ? n : end + 3;
        toks.push({ t: 'cdata', raw: s.slice(i, close) });
        i = close;
      } else if (s.startsWith('<!', i)) {              // DOCTYPE / declaration
        const end = s.indexOf('>', i);
        const close = end === -1 ? n : end + 1;
        toks.push({ t: 'doctype', raw: s.slice(i, close) });
        i = close;
      } else if (s.startsWith('<?', i)) {              // PI or xml declaration
        const end = s.indexOf('?>', i);
        const close = end === -1 ? n : end + 2;
        const raw = s.slice(i, close);
        toks.push({ t: 'pi', raw, isXmlDecl: /^<\?xml\s/i.test(raw) });
        i = close;
      } else {                                         // element tag
        let j = i + 1, q = 0;
        while (j < n) {
          const c = s[j];
          if (q) { if (c === q) q = 0; }
          else if (c === '"' || c === "'") q = c;
          else if (c === '>') break;
          j++;
        }
        const close = j < n ? j + 1 : n;
        toks.push(parseTag(s.slice(i, close)));
        i = close;
      }
    } else {
      const next = s.indexOf('<', i);
      const close = next === -1 ? n : next;
      toks.push({ t: 'text', raw: s.slice(i, close) });
      i = close;
    }
  }
  return toks;
}


// Embedded raster metadata uses the same strip and residual checks as standalone images.
function embeddedRaster(value, budget) {
  value = value.replace(/&#(x[0-9a-f]+|[0-9]+);|&(amp|lt|gt|quot|apos);/gi, (raw, number, name) => {
    if (number) { const point = parseInt(number.startsWith('x') ? number.slice(1) : number, number.startsWith('x') ? 16 : 10); return point <= 0x10ffff ? String.fromCodePoint(point) : raw; }
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[name.toLowerCase()];
  });
  const match = /^data:image\/(png|jpe?g)(;base64)?,([\s\S]*)$/i.exec(value);
  if (!match) return null;
  if (!match[2] && /%(?![0-9a-f]{2})/i.test(match[3])) throw new Error('Invalid embedded image encoding.');
  if (++budget.count > 128 || match[3].length > 24 * 1024 * 1024) throw new Error('Embedded image cleaning exceeds the supported size limit.');
  let binary;
  if (match[2]) binary = atob(decodeURIComponent(match[3]).replace(/\s/g, ''));
  else binary = match[3].replace(/%([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  budget.bytes += binary.length;
  if (binary.length > 16 * 1024 * 1024 || budget.bytes > 32 * 1024 * 1024) throw new Error('Embedded image cleaning exceeds the supported size limit.');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    if (binary.charCodeAt(i) > 255) throw new Error('Invalid embedded image encoding.');
    bytes[i] = binary.charCodeAt(i);
  }
  const format = match[1].toLowerCase() === 'png' ? 'png' : 'jpeg';
  if (format === 'png') {
    if (!bytes.subarray(0, 8).every((byte, i) => byte === [137,80,78,71,13,10,26,10][i]) || bytes.length < 20) throw new Error('Invalid embedded PNG.');
    let offset = 8, ended = false;
    while (offset + 12 <= bytes.length) {
      const size = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0);
      const end = offset + size + 12;
      if (end > bytes.length) throw new Error('Truncated embedded PNG.');
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      offset = end;
      if (type === 'IEND') { ended = true; break; }
    }
    if (!ended) throw new Error('Truncated embedded PNG.');
  } else if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new Error('Invalid embedded JPEG.');
  return { bytes, format };
}
function cleanEmbeddedRaster(value, budget) {
  const image = embeddedRaster(value, budget);
  if (!image) return value;
  const clean = image.format === 'png' ? stripPng(image.bytes) : stripJpeg(image.bytes);
  if (clean.length === image.bytes.length && clean.every((byte, i) => byte === image.bytes[i])) return value;
  let binary = '';
  for (let i = 0; i < clean.length; i += 0x8000) binary += String.fromCharCode(...clean.subarray(i, i + 0x8000));
  return `data:image/${image.format === 'png' ? 'png' : 'jpeg'};base64,${btoa(binary)}`;
}

function rebuildTag(tk) {
  const kept = [];
  for (const a of tk.attrs) {
    if (shouldDropAttr(a.name)) continue;
    if (a.value == null) { kept.push(a.name); continue; }
    const quote = a.value.includes('"') ? "'" : '"';
    kept.push(`${a.name}=${quote}${a.value}${quote}`);
  }
  const body = tk.name + (kept.length ? ' ' + kept.join(' ') : '');
  return tk.t === 'self' ? `<${body}/>` : `<${body}>`;
}

function clean(toks) {
  const embeddedBudget = { count: 0, bytes: 0 };
  const out = [];
  const stack = [];          // names of currently-open kept elements
  let dropName = null, dropDepth = 0;

  for (const tk of toks) {
    if (dropDepth > 0) {     // inside a dropped subtree - watch only its nesting
      if (tk.t === 'open' && tk.name === dropName) dropDepth++;
      else if (tk.t === 'close' && tk.name === dropName) dropDepth--;
      continue;
    }
    switch (tk.t) {
      case 'comment':
      case 'doctype':
        break;               // drop
      case 'pi':
        if (tk.isXmlDecl) out.push(tk.raw); // keep the xml declaration, drop other PIs
        break;
      case 'cdata':
        out.push(tk.raw);
        break;
      case 'text': {
        // In SVG, whitespace is only significant inside text-content elements;
        // xml:space="preserve" on a container (Illustrator stamps it on the root
        // <svg>) does not make geometry whitespace render. So sensitivity tracks
        // the nearest open element, not xml:space.
        const sensitive = stack.length && SPACE_SENSITIVE.has(stack[stack.length - 1]);
        if (!sensitive && /^\s*$/.test(tk.raw)) break; // drop insignificant whitespace
        out.push(tk.raw);
        break;
      }
      case 'open':
      case 'self': {
        if (shouldDropElement(tk.name)) {
          if (tk.t === 'open') { dropName = tk.name; dropDepth = 1; }
          break;
        }
        const attrs = tk.attrs.map(a => (a.name === 'href' || a.name === 'xlink:href') && a.value
          ? { ...a, value: cleanEmbeddedRaster(a.value, embeddedBudget) } : a);
        const embeddedChanged = attrs.some((a, i) => a.value !== tk.attrs[i].value);
        const hasDroppable = tk.attrs.some(a => shouldDropAttr(a.name));
        out.push(hasDroppable || embeddedChanged ? rebuildTag({ ...tk, attrs }) : tk.raw);
        if (tk.t === 'open') stack.push(tk.name.toLowerCase());
        break;
      }
      case 'close': {
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k] === tk.name.toLowerCase()) { stack.length = k; break; }
        }
        out.push(tk.raw);
        break;
      }
    }
  }
  return out.join('');
}

function analyzeSvg(toks) {
  const findings = [];
  const embeddedBudget = { count: 0, bytes: 0 };
  let editor = null, docName = null;
  let comments = 0, pathInComment = false, stylesheetPI = false, hasDoctype = false;
  let hasMetadata = false, metaParts = [];
  let metaDepth = 0;
  let titleText = '', inTitle = 0, descText = '', inDesc = 0;
  let editorElements = false, adobePrivate = false;
  let embeddedImgs = 0, embeddedBytes = 0;

  for (const tk of toks) {
    if (metaDepth > 0 && tk.raw) metaParts.push(tk.raw);

    if (tk.t === 'comment') {
      comments++;
      const g = /Generator:\s*([^\n]*)/i.exec(tk.text);
      if (g && !editor) {
        editor = g[1].replace(/-->\s*$/, '').replace(/,?\s*SVG (Export|Version).*$/i, '').trim();
      }
      if (/[A-Za-z]:\\|\/Users\/|\/home\/|\.ai\b|\.eps\b|\.psd\b|\.sketch\b/.test(tk.text)) pathInComment = true;
    } else if (tk.t === 'doctype') {
      hasDoctype = true;
    } else if (tk.t === 'pi' && !tk.isXmlDecl && /xml-stylesheet/i.test(tk.raw)) {
      stylesheetPI = true;
    } else if (tk.t === 'open' || tk.t === 'self') {
      const lname = tk.name.toLowerCase();
      const pre = prefixOf(tk.name);
      if (lname === 'metadata' && tk.t === 'open') { hasMetadata = true; metaDepth++; }
      else if (lname === 'metadata' && metaDepth > 0) metaDepth++;
      if (pre === 'sodipodi' || pre === 'inkscape') editorElements = true;
      if (pre === 'i' || pre === 'x') adobePrivate = true;
      if (lname === 'title' && tk.t === 'open') inTitle++;
      if (lname === 'desc' && tk.t === 'open') inDesc++;
      for (const a of tk.attrs) {
        if (a.name === 'inkscape:version' && !editor) editor = 'Inkscape ' + (a.value || '').split(' ')[0];
        if (a.name === 'sodipodi:docname' && a.value) docName = a.value;
        if (a.name === 'xmlns:sketch' && !editor) editor = 'Sketch';
        if (a.name === 'xmlns:figma' && !editor) editor = 'Figma';
        if ((a.name === 'href' || a.name === 'xlink:href') && a.value && /^data:image\//i.test(a.value)) {
          embeddedImgs++;
          const comma = a.value.indexOf(',');
          if (comma > -1) embeddedBytes += Math.floor((a.value.length - comma - 1) * 0.75);
        }
        if ((a.name === 'href' || a.name === 'xlink:href') && a.value) {
          const image = embeddedRaster(a.value, embeddedBudget);
          if (image) for (const finding of analyzeRaster(image.bytes).findings) findings.push({
            ...finding, label: `Embedded ${finding.label}`, detail: `${image.format.toUpperCase()} image: ${finding.detail}`,
          });
        }
      }
    } else if (tk.t === 'close') {
      const lname = tk.name.toLowerCase();
      if (lname === 'metadata' && metaDepth > 0) metaDepth--;
      if (lname === 'title' && inTitle > 0) inTitle--;
      if (lname === 'desc' && inDesc > 0) inDesc--;
    } else if (tk.t === 'text') {
      if (inTitle > 0) titleText += tk.raw;
      if (inDesc > 0) descText += tk.raw;
    }
  }

  // Author / licence from the <metadata> block (RDF / Dublin Core).
  let author = null, licence = null;
  if (hasMetadata) {
    const meta = metaParts.join('');
    const cr = /<dc:(?:creator|rights)[^>]*>([\s\S]*?)<\/dc:(?:creator|rights)>/i.exec(meta);
    if (cr) { const t = cr[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (t) author = t; }
    const lic = /<cc:license[^>]*rdf:resource=["']([^"']+)["']/i.exec(meta)
      || /<dc:rights[^>]*>([\s\S]*?)<\/dc:rights>/i.exec(meta);
    if (lic) { const t = lic[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); if (t) licence = t; }
  }

  // Assemble findings, warn-toned for anything personally identifying.
  if (editor) findings.push({ label: 'Created with', detail: editor, tone: 'warn' });
  if (docName) findings.push({ label: 'Original filename', detail: docName, tone: 'warn' });
  if (author) findings.push({ label: 'Author', detail: author, tone: 'warn' });
  if (licence) findings.push({ label: 'Licence', detail: licence, tone: '' });
  if (pathInComment) findings.push({ label: 'File path in comment', detail: 'a local path is embedded', tone: 'warn' });
  if (hasMetadata && !author && !licence) findings.push({ label: 'Metadata block', detail: 'embedded RDF / Dublin Core', tone: '' });
  if (editorElements) findings.push({ label: 'Editor data', detail: 'Inkscape canvas, guides & settings', tone: '' });
  if (adobePrivate) findings.push({ label: 'Adobe private data', detail: 'Illustrator graphics format', tone: '' });
  if (comments) findings.push({ label: 'Comments', detail: `${comments} comment${comments > 1 ? 's' : ''}`, tone: '' });
  if (stylesheetPI) findings.push({ label: 'External stylesheet', detail: 'xml-stylesheet reference', tone: 'warn' });
  if (hasDoctype) findings.push({ label: 'Legacy DOCTYPE', detail: 'SVG 1.0 doctype', tone: '' });
  const titleTrim = titleText.replace(/\s+/g, ' ').trim();
  if (titleTrim) findings.push({ label: 'Title', detail: titleTrim, tone: '' });
  const descTrim = descText.replace(/\s+/g, ' ').trim();
  if (descTrim) findings.push({ label: 'Description', detail: descTrim, tone: '' });
  if (embeddedImgs) findings.push({ label: 'Embedded images', detail: `${embeddedImgs} image${embeddedImgs > 1 ? 's' : ''}${embeddedBytes ? `, ~${fmtBytes(embeddedBytes)}` : ''} - kept`, tone: '' });

  return findings;
}

// ─── format dispatch ───────────────────────────────────────────────────────────

function looksLikeSvg(text) {
  return /<svg[\s>]/i.test(text);
}

// "%PDF-" magic at the start of the file.
function isPdf(b) {
  return b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2D;
}

// Append "-clean" before the extension: report.pdf → report-clean.pdf.
function cleanName(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)}-clean${name.slice(dot)}` : `${name}-clean`;
}

// Classify the file and surface the text decode for SVG (so it isn't decoded
// twice). Returns { kind: 'JPEG'|'PNG'|'SVG'|'PDF'|'audio'|'file', text, audio },
// where `audio` is the engine's audio format id ('mp4', 'wav', 'mp3', 'flac', 'ogg').
function classify(bytes) {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) return { kind: 'JPEG', text: null };
  if (isPng(bytes)) return { kind: 'PNG', text: null };
  if (isPdf(bytes)) return { kind: 'PDF', text: null };
  const audio = LollyStripAudio.sniffAudioFormat(bytes);
  if (audio) return { kind: 'audio', text: null, audio };
  let text = null;
  try { text = decodeText(bytes); } catch (e) { /* not decodable text */ }
  if (text != null && looksLikeSvg(text)) return { kind: 'SVG', text };
  return { kind: 'file', text };
}

// Produce the cleaned bytes for a supported file; unsupported input passes through.
function cleanBytes(bytes, info) {
  const { kind, text } = info || classify(bytes);
  if (kind === 'JPEG') return stripJpeg(bytes);
  if (kind === 'PNG') return stripPng(bytes);
  if (kind === 'SVG') return encodeText(clean(tokenize(text)));
  return bytes; // unrecognised - leave untouched rather than risk corruption
}

// Verify-after-strip: re-scan a *cleaned* buffer for anything the strip is meant
// to have removed. Returns a short reason, or null when it's verifiably clean.
// This is what lets exportFile fail loud instead of silently handing back an
// un-stripped original under a "-clean" name - the cardinal sin for a privacy
// tool. Narrow by design: only the segments/chunks/nodes cleanBytes drops.
function residualMetadata(bytes, kind) {
  if (kind === 'JPEG') {
    for (const s of scanJpeg(bytes) || []) {
      if (s.sos) break; // scan/entropy data begins - no metadata beyond here
      if (s.marker === 0xFE) return 'a JPEG comment';
      if (s.marker >= 0xE1 && s.marker <= 0xEF) return `a JPEG APP${s.marker - 0xE0} metadata segment`;
    }
    return null;
  }
  if (kind === 'PNG') {
    for (const c of scanPng(bytes)) {
      if (PNG_STRIP.has(c.type)) return `a PNG ${c.type} chunk`;
    }
    return null;
  }
  if (kind === 'SVG') {
    const embeddedBudget = { count: 0, bytes: 0 };
    let text;
    try { text = decodeText(bytes); } catch (e) { return null; }
    for (const tk of tokenize(text)) {
      if (tk.t === 'comment') return 'an XML comment';
      if (tk.t === 'doctype') return 'a DOCTYPE declaration';
      if (tk.t === 'pi' && !tk.isXmlDecl) return 'a processing instruction';
      if (tk.t === 'open' || tk.t === 'self') {
        if (shouldDropElement(tk.name)) return `an editor-private <${tk.name}> element`;
        for (const a of tk.attrs) if (shouldDropAttr(a.name)) return `an editor-private ${a.name} attribute`;
        for (const a of tk.attrs) if ((a.name === 'href' || a.name === 'xlink:href') && a.value) {
          const image = embeddedRaster(a.value, embeddedBudget);
          if (image) { const residual = residualMetadata(image.bytes, image.format === 'png' ? 'PNG' : 'JPEG'); if (residual) return `embedded ${residual}`; }
        }
      }
    }
    return null;
  }
  return null;
}

// ─── lifecycle ───────────────────────────────────────────────────────────────

function isOfficeFile(f) {
  return /\.(docx|pptx|xlsx|docm|pptm|xlsm|dotx|dotm|potx|potm|xltx|xltm|xlsb|doc|ppt|xls)$/i.test(f.name || '')
    || [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1].every((b, i) => f.bytes[i] === b);
}

function isPackageFile(f) { return f.bytes[0] === 0x50 && f.bytes[1] === 0x4b; }

let officeSourceKey = '';
async function officeReport(f, host, base, selected) {
  const result = { ...base, kind: 'Office', supported: true, inspectOnly: true, nothingFound: true,
    cleanNote: 'Office files are inspected only. Their content remains unchanged and no cleaned download is available.' };
  if (!host || !host.prepare || !host.prepare.inspect) return isOfficeFile(f)
    ? { ...result, cleanNote: 'Office inspection is unavailable in this app. No content was inspected or removed.' }
    : { ...base, kind: 'Archive', supported: false };
  try {
    const inspection = await host.prepare.inspect([{ id: 'office', name: f.name, bytes: f.bytes, mime: f.mime }]);
    if (!isOfficeFile(f) && !inspection.scopes.some(s => s.id === 'office' && s.readOnly)) return { ...base, kind: 'Archive', supported: false };
    const editable = inspection.scopes.find(s => s.id === 'office')?.actions?.includes('remove-property') && host.prepare.apply;
    const prefix = inspection.sources[0].sha256, key = `${f.name}:${prefix}`, same = key === officeSourceKey;
    officeSourceKey = key;
    const properties = editable ? inspection.groups.filter(g => g.action === 'remove-property').map(group => ({
      id: `${prefix}:${group.id}`, remove: same && Array.isArray(selected) && selected.some(row => row.id === `${prefix}:${group.id}` && row.remove === true),
    })) : [];
    const officeProperties = properties.map(row => {
      const finding = inspection.findings.find(finding => row.id === `${prefix}:${finding.groupId}`);
      return { rowId: row.id, remove: row.remove, label: finding.label, detail: `${finding.location} - ${finding.value}` };
    });
    const findings = inspection.findings.filter(f => f.action !== 'remove-property').map(finding => ({ label: finding.label, tone: 'warn',
      detail: `${inspection.scopes.find(s => s.id === finding.scopeId)?.path || ''}: ${finding.location} - ${finding.value}` }));
    const limitations = [...new Set(inspection.scopes.flatMap(s => s.limitations))];
    if (editable) return { ...result, properties, officeProperties, officeMetadata: true, propertySelected: properties.some(row => row.remove), findings, nothingFound: false,
      metaSummary: `Review ${properties.length} removable document propert${properties.length === 1 ? 'y' : 'ies'}. Select properties to remove from a new DOCX copy.`,
      cleanNote: limitations.join(' '), tailNote: limitations.join(' ') };
    return { ...result, findings, nothingFound: findings.length === 0,
      metaSummary: `Found ${findings.length} retained item${findings.length === 1 ? '' : 's'}. Office inspection is read-only; nothing was removed.`,
      cleanNote: limitations.join(' '), tailNote: limitations.join(' ') };
  } catch {
    return { ...result, cleanNote: 'Office inspection could not finish. The file may exceed the 32 MiB inspection limit or use an unsupported package. Nothing was removed.' };
  }
}

// The accessibility checks, listed and never summed into a verdict. A shell without the
// capability, or a file it cannot read, leaves the section out or says why.
async function pdfChecks(host, bytes) {
  const none = { a11yShown: false, a11yHeadline: '', a11yRows: [], a11yStatement: '', a11yRefused: '' };
  if (!host || !host.pdf || typeof host.pdf.accessibility !== 'function') return none;
  try {
    const report = await host.pdf.accessibility(bytes);
    const label = { pass: 'Passed', fail: 'Failed', 'not-applicable': 'Not applicable', 'needs-person': 'Needs a person' };
    const c = report.counts;
    return {
      a11yShown: true,
      a11yHeadline: `${c.pass} of ${report.rows.length} checks passed, ${c.fail} failed, ${c['not-applicable']} did not apply and ${c['needs-person']} need a person.`,
      a11yRows: report.rows.map(r => ({
        name: r.name, description: r.description, outcome: r.outcome, outcomeLabel: label[r.outcome] || r.outcome,
        where: r.outcome === 'fail' ? r.where : '',
        notes: r.outcome === 'fail' ? r.notes.join(' ') + (r.more > 0 ? ` (and ${r.more} more)` : '') : '',
      })),
      a11yStatement: report.statements.join(' '),
      a11yRefused: '',
    };
  } catch (e) {
    return { ...none, a11yShown: true, a11yRefused: (e && e.message) ? e.message : 'The accessibility checks could not run on this file.' };
  }
}

async function patch({ model, host }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.source;
  const blank = {
    a11yShown: false, a11yHeadline: '', a11yRows: [], a11yStatement: '', a11yRefused: '',
    hasFile: false, supported: false, pdfUnavailable: false, unreadable: false, unreadableNote: '', inspectOnly: false, findings: [], nothingFound: false,
    officeMetadata: false, officeProperties: [], propertySelected: false, properties: [],
    fileName: '', fileSize: '', kind: '', metaSummary: '', cleanSize: '',
    tailNote: '', cleanNote: '',
  };
  if (!f || !f.bytes) { officeSourceKey = ''; return blank; }

  const base = { ...blank, hasFile: true, fileName: f.name, fileSize: fmtBytes(f.size) };
  if (isOfficeFile(f) || isPackageFile(f)) return officeReport(f, host, base, inputs.properties);
  officeSourceKey = '';
  const info = classify(f.bytes);
  if (info.kind === 'file') {
    return { ...base, kind: 'file' }; // supported:false → template shows guidance
  }
  if (info.audio) return audioReport(f, info.audio, base);

  // PDF can't be cleaned by in-hook byte surgery - it goes through host.pdf (a
  // real PDF library in the shell). Shells without that capability degrade to a
  // clear "not available here" rather than a wrong "already clean".
  if (info.kind === 'PDF') {
    if (!host || !host.pdf) {
      return { ...base, kind: 'PDF', supported: true, pdfUnavailable: true };
    }
    let findings = [];
    try { ({ findings } = await host.pdf.analyze(f.bytes)); } catch (e) { findings = []; }
    const a11y = await pdfChecks(host, f.bytes);
    return {
      ...base,
      ...a11y,
      supported: true,
      kind: 'PDF',
      findings,
      nothingFound: findings.length === 0,
      cleanSize: '', // a re-save's size isn't meaningful to preview, so it's omitted
      tailNote: 'Your PDF is re-saved without its metadata - the pages are preserved; document info and XMP packets are removed. Attachments, form values and scripts remain. (A re-save isn\'t byte-for-byte and invalidates any digital signature.)',
      cleanNote: 'You can still download a re-saved copy below.',
      metaSummary: findings.length
        ? `Found ${findings.length} embedded item${findings.length > 1 ? 's' : ''}. Document info and XMP are removed; other document content remains.`
        : '',
    };
  }

  let findings = [];
  try {
    findings = info.kind === 'SVG' ? analyzeSvg(tokenize(info.text)) : analyzeRaster(f.bytes).findings;
  } catch (e) { findings = []; }

  let cleanLen = f.bytes.length;
  try { cleanLen = cleanBytes(f.bytes, info).length; } catch (e) { /* keep original size */ }
  const removed = Math.max(0, f.bytes.length - cleanLen);

  const isVector = info.kind === 'SVG';
  const pct = f.bytes.length > 0 ? Math.round((removed / f.bytes.length) * 100) : 0;
  const sizeNote = removed > 0 ? `That's ${fmtBytes(removed)} smaller${pct >= 1 ? ` (−${pct}%)` : ''}. ` : '';
  const tailNote = isVector
    ? `${sizeNote}Vector geometry and embedded image pixels are retained. Metadata is removed from embedded JPEG and PNG images; other embedded formats are unchanged.`
    : 'The clean copy keeps the image pixels byte-for-byte - only the metadata is removed, nothing is re-compressed.';

  return {
    ...base,
    supported: true,
    kind: info.kind,
    findings,
    nothingFound: findings.length === 0,
    cleanSize: fmtBytes(cleanLen),
    tailNote,
    cleanNote: isVector
      ? `${sizeNote}You can still download the re-saved copy below.`
      : 'You can still download a re-saved copy below.',
    metaSummary: findings.length
      ? `Found ${findings.length} item${findings.length > 1 ? 's' : ''} of hidden data${removed > 0 ? ` - ${fmtBytes(removed)} will be removed` : ''}.`
      : '',
  };
}

function onInit(ctx) { return patch(ctx); }
function onInput(ctx) { return patch(ctx); }

async function exportFile({ model, host }) {
  const inputs = Object.fromEntries(model.map(i => [i.id, i.value]));
  const f = inputs.source;
  if (!f || !f.bytes) throw new Error('Choose a file first.');
  if (isOfficeFile(f) || isPackageFile(f)) {
    if (!host?.prepare?.inspect || !host.prepare.apply) throw new Error('Office inspection is read-only. DOCX metadata cleanup is unavailable.');
    const sources = [{ id: 'office', name: f.name, bytes: f.bytes, mime: f.mime }];
    const inspection = await host.prepare.inspect(sources);
    if (!inspection.scopes.find(s => s.id === 'office')?.actions?.includes('remove-property')) throw new Error('Office inspection is read-only for this file. DOCX metadata cleanup is unavailable.');
    const prefix = inspection.sources[0].sha256, key = `${f.name}:${prefix}`;
    const choices = inspection.groups.filter(group => group.action === 'remove-property' && Array.isArray(inputs.properties) && inputs.properties.some(row => row.id === `${prefix}:${group.id}` && row.remove === true)).map(group => ({ groupId: group.id, replacement: '' }));
    if (key !== officeSourceKey || !choices.length) throw new Error('Select document properties from the current inspection before downloading a copy.');
    const result = await host.prepare.apply(sources, inspection, choices);
    if (result.report.stages?.some(stage => stage.status === 'failed') || result.report.replaced !== choices.length || !result.report.outputs[0]?.changed) throw new Error('Selected properties could not be removed and verified. Nothing was downloaded.');
    return { bytes: result.outputs[0].bytes, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', filename: (f.name || 'document.docx').replace(/\.docx$/i, '-prepared.docx') };
  }

  // PDF is re-saved (metadata removed) via the shell's PDF capability.
  if (isPdf(f.bytes)) {
    if (!host || !host.pdf) throw new Error('PDF cleaning isn\'t available in this app.');
    const { bytes } = await host.pdf.strip(f.bytes);
    return { bytes, mime: 'application/pdf', filename: cleanName(f.name) };
  }

  // Audio: the engine's stripper verifies its own copy (nothing removable left,
  // the audio bytes unchanged) and throws otherwise; the residual check below
  // repeats the first half here so a privacy failure can never pass silently.
  const info = classify(f.bytes);
  if (info.audio) {
    const bytes = LollyStripAudio.stripAudioMetadata(f.bytes, info.audio); // may throw - deliberately not caught
    const residual = LollyStripAudio.audioMetadataResidual(bytes, info.audio);
    if (residual) throw new Error(`Couldn't fully remove ${residual} from this file - nothing was downloaded.`);
    const video = info.audio === 'mp4' && LollyStripAudio.inspectAudioMetadata(bytes, 'mp4').video;
    return { bytes, mime: video ? 'video/mp4' : AUDIO_MIME[info.audio], filename: cleanName(f.name) };
  }

  // JPEG / PNG / SVG: lossless in-hook surgery (an unrecognised file has no
  // metadata we claim to remove, so it passes through untouched - the report
  // already tells the user it isn't a supported image). For the supported kinds
  // a privacy tool must NEVER hand back the original under a "-clean" name, so we
  // do NOT swallow errors: if the surgery throws, or the result still carries
  // metadata we claim to remove, we fail loud and download nothing (the shell
  // surfaces the thrown message on the button).
  const bytes = cleanBytes(f.bytes, info); // may throw - deliberately not caught
  const residual = residualMetadata(bytes, info.kind);
  if (residual) {
    throw new Error(`Couldn't fully remove ${residual} from this ${info.kind} - nothing was downloaded.`);
  }
  return { bytes, mime: f.mime || 'application/octet-stream', filename: cleanName(f.name) };
}
