// SPDX-License-Identifier: MPL-2.0
/**
 * APNG packer — pure, DOM-free, platform-agnostic.
 *
 * Chunk-level surgery only: the shell supplies COMPLETE already-encoded PNG
 * files (one per animation frame, all with identical IHDR geometry), and this
 * splices them into a single Animated PNG. No pixel work, no compression —
 * frame 0's chunk stream is kept intact (ancillary chunks stay in their
 * original positions) with an acTL inserted right after IHDR and an fcTL
 * before its first IDAT; every later frame contributes one fcTL plus its IDAT
 * data re-wrapped as fdAT chunks (everything else from those frames is
 * dropped). Sequence numbers are shared across fcTL/fdAT per the APNG spec.
 *
 * Like emf.js / eps.js this is a byte-format authority: no DOM, no deps,
 * fully node:test-able.
 */

const PNG_SIG = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

// Animation control chunks are regenerated here; carrying them over from an
// input that is already an APNG would corrupt the sequence numbering.
const ANIM_CHUNKS = new Set(['acTL', 'fcTL', 'fdAT']);

function writeU32(bytes, off, value) {
  bytes[off] = (value >>> 24) & 0xff;
  bytes[off + 1] = (value >>> 16) & 0xff;
  bytes[off + 2] = (value >>> 8) & 0xff;
  bytes[off + 3] = value & 0xff;
}

function readU32(bytes, off) {
  return ((bytes[off] << 24) | (bytes[off + 1] << 16) | (bytes[off + 2] << 8) | bytes[off + 3]) >>> 0;
}

let CRC_TABLE = null;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC_TABLE[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

// Serialize one chunk: length + 4-char type + data + CRC(type‖data).
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  writeU32(out, 0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  writeU32(out, 8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

// Split an encoded PNG into { type, data } chunks. Throws on a bad signature,
// truncation, or a stream that doesn't start IHDR / end IEND. Input CRCs are
// not re-verified — the frames come from a trusted encoder.
function parsePng(bytes, label) {
  if (!(bytes instanceof Uint8Array)) {
    throw new Error(`packApng: ${label} is not a Uint8Array`);
  }
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIG[i]) throw new Error(`packApng: ${label} has a bad PNG signature`);
  }
  const chunks = [];
  let off = 8;
  while (off + 8 <= bytes.length) {
    const len = readU32(bytes, off);
    const type = String.fromCharCode(bytes[off + 4], bytes[off + 5], bytes[off + 6], bytes[off + 7]);
    const end = off + 12 + len;
    if (end > bytes.length) throw new Error(`packApng: ${label} is truncated inside a ${type} chunk`);
    chunks.push({ type, data: bytes.subarray(off + 8, off + 8 + len) });
    off = end;
    if (type === 'IEND') break;
  }
  if (!chunks.length || chunks[0].type !== 'IHDR' || chunks[0].data.length !== 13) {
    throw new Error(`packApng: ${label} does not start with a valid IHDR chunk`);
  }
  if (chunks[chunks.length - 1].type !== 'IEND') {
    throw new Error(`packApng: ${label} has no IEND chunk`);
  }
  return chunks;
}

const ihdrDesc = (d) => `${readU32(d, 0)}x${readU32(d, 4)} depth ${d[8]} color type ${d[9]}`;

/**
 * Pack pre-encoded PNG frames into an APNG.
 *
 * frames : Uint8Array[] — complete PNG files, identical IHDR geometry.
 * opts   : { delayMs = 67, loops = 0 }
 *   delayMs — per-frame display time in ms; a number applies to every frame,
 *             an array is per-frame (missing/invalid entries fall back to 67).
 *             Encoded as fcTL delay_num / delay_den with den fixed at 1000.
 *   loops   — acTL num_plays; 0 = loop forever.
 *
 * Returns the APNG bytes as a Uint8Array.
 */
export function packApng(frames, opts = {}) {
  const { delayMs = 67, loops = 0 } = opts;
  if (!Array.isArray(frames) || frames.length === 0) {
    throw new Error('packApng: frames must be a non-empty array of encoded PNG byte arrays');
  }
  if (!Number.isInteger(loops) || loops < 0) {
    throw new Error('packApng: loops must be a non-negative integer (0 = infinite)');
  }

  const parsed = frames.map((f, i) => parsePng(f, `frame ${i}`));
  const ihdr0 = parsed[0][0].data;
  for (let i = 1; i < parsed.length; i++) {
    const ihdr = parsed[i][0].data;
    for (let b = 0; b < 13; b++) {
      if (ihdr[b] !== ihdr0[b]) {
        throw new Error(`packApng: frame ${i} IHDR (${ihdrDesc(ihdr)}) does not match frame 0 (${ihdrDesc(ihdr0)})`);
      }
    }
  }

  const width = readU32(ihdr0, 0);
  const height = readU32(ihdr0, 4);
  let seq = 0; // shared, strictly increasing across fcTL and fdAT

  // fcTL: sequence, full-frame region at 0,0, delay, dispose NONE, blend SOURCE.
  const fctl = (frameIndex) => {
    const raw = Array.isArray(delayMs) ? delayMs[frameIndex] : delayMs;
    const num = Number.isFinite(raw) && raw >= 0 ? Math.min(65535, Math.round(raw)) : 67;
    const d = new Uint8Array(26);
    writeU32(d, 0, seq++);
    writeU32(d, 4, width);
    writeU32(d, 8, height);
    writeU32(d, 12, 0); // x_offset
    writeU32(d, 16, 0); // y_offset
    d[20] = (num >>> 8) & 0xff; // delay_num (u16)
    d[21] = num & 0xff;
    d[22] = (1000 >>> 8) & 0xff; // delay_den (u16) — ms
    d[23] = 1000 & 0xff;
    d[24] = 0; // dispose_op: APNG_DISPOSE_OP_NONE
    d[25] = 0; // blend_op: APNG_BLEND_OP_SOURCE
    return chunk('fcTL', d);
  };

  const parts = [Uint8Array.from(PNG_SIG)];

  // Frame 0: its own chunk stream, minus IEND, with acTL + fcTL spliced in.
  let sawIdat = false;
  for (const c of parsed[0]) {
    if (c.type === 'IEND' || ANIM_CHUNKS.has(c.type)) continue;
    if (c.type === 'IDAT' && !sawIdat) {
      parts.push(fctl(0));
      sawIdat = true;
    }
    parts.push(chunk(c.type, c.data));
    if (c.type === 'IHDR') {
      const actl = new Uint8Array(8);
      writeU32(actl, 0, parsed.length); // num_frames
      writeU32(actl, 4, loops); // num_plays
      parts.push(chunk('acTL', actl));
    }
  }
  if (!sawIdat) throw new Error('packApng: frame 0 has no IDAT chunk');

  // Frames 1..N-1: fcTL, then each IDAT's data re-wrapped as an fdAT
  // (4-byte sequence prefix + data). Everything else is dropped.
  for (let i = 1; i < parsed.length; i++) {
    parts.push(fctl(i));
    let wrote = false;
    for (const c of parsed[i]) {
      if (c.type !== 'IDAT') continue;
      const fd = new Uint8Array(4 + c.data.length);
      writeU32(fd, 0, seq++);
      fd.set(c.data, 4);
      parts.push(chunk('fdAT', fd));
      wrote = true;
    }
    if (!wrote) throw new Error(`packApng: frame ${i} has no IDAT chunk`);
  }

  parts.push(chunk('IEND', new Uint8Array(0)));

  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}
