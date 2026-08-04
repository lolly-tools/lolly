// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/png.ts — the Phase B1 PNG writer (plans/61-deeprichpixels.md §4.2).
 *
 * Three independent ways of being right, because a writer with no reader is a
 * writer with no test:
 *
 *  1. DECODE-YOUR-OWN-OUTPUT ORACLE. node:zlib inflates the IDAT stream and the
 *     engine's own `unfilterPng` (engine/src/png-unfilter.ts — written years
 *     before this encoder, for PDF /Predictor 15 embeds, so it is genuinely
 *     independent code) reverses the row filters. Samples are then compared
 *     EXACTLY against the input buffer, at both depths and both channel counts.
 *  2. AN EXTERNAL DECODER. `sharp` (libvips → libspng) reads the same files and
 *     must return the same pixels — 8-bit and 16-bit both. Skipped with a reason
 *     if sharp is not installed, so a plain clone is not punished.
 *  3. GOLDEN BYTES. Small fixtures pinned base64-exact, UPDATE_GOLDENS=1 to
 *     regenerate (same pattern as tests/export-emitter-golden.test.ts), so any
 *     change in filter choice, chunk order or compressor output is a reviewable
 *     diff rather than a silent behaviour change.
 *
 * Plus a reference CRC-32 (bitwise, no table) recomputed over every chunk, the
 * cICP bytes checked against the PNG 3e / H.273 code points AND against the
 * engine's own HDR_PQ_CICP, pHYs checked against the shell's insertPngPhys
 * arithmetic, and negative controls throughout.
 *
 * NOTE on the CRC negative control: libspng (and libpng by default) only WARNS
 * on a bad ancillary/critical chunk CRC — verified below, sharp happily decodes
 * a PNG whose IHDR CRC has been flipped. So "a decoder detects it" is asserted
 * with the reference verifier here, and the byte-level corruption control that
 * an external decoder DOES catch is an IDAT payload flip (node:zlib rejects it).
 * That is documented rather than hidden, because a test that quietly asserted
 * nothing would be worse than no test.
 *
 * Run:        node --test tests/png.test.ts
 * Regenerate: UPDATE_GOLDENS=1 node --test tests/png.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { packPng, type PackPngOptions, type PngSamples } from '../engine/src/png.ts';
import { unfilterPng } from '../engine/src/png-unfilter.ts';
import { HDR_PQ_CICP } from '../engine/src/hdr.ts';
import { crc32 as engineCrc32 } from '../engine/src/zip-crypto.ts';

// ── golden fixture plumbing (tests/export-emitter-golden.test.ts pattern) ────

const FIXTURE_PATH = fileURLToPath(new URL('fixtures/png.golden.json', import.meta.url));
const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === '1';

type Golden = Record<string, string>;
const committed: Golden = (() => {
  try { return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Golden; } catch { return {}; }
})();
const regenerated: Golden = {};

after(() => {
  if (!UPDATE_GOLDENS) return;
  mkdirSync(fileURLToPath(new URL('fixtures/', import.meta.url)), { recursive: true });
  const sorted: Golden = {};
  for (const key of Object.keys(regenerated).sort()) sorted[key] = regenerated[key]!;
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
});

function golden(key: string, bytes: Uint8Array): void {
  const b64 = Buffer.from(bytes).toString('base64');
  if (UPDATE_GOLDENS) { regenerated[key] = b64; return; }
  assert.ok(committed[key], `no golden for ${key} — run UPDATE_GOLDENS=1 node --test tests/png.test.ts`);
  assert.equal(b64, committed[key], `golden byte mismatch for ${key}`);
}

// ── optional external decoder ───────────────────────────────────────────────

// Structurally typed, and imported through a variable specifier so a clone
// WITHOUT sharp neither fails to typecheck nor fails to run — it skips.
interface SharpMeta { width?: number; height?: number; depth?: string; channels?: number; density?: number }
interface SharpImage {
  metadata(): Promise<SharpMeta>;
  raw(opts?: { depth?: string }): SharpImage;
  toColourspace(space: string): SharpImage;
  toBuffer(): Promise<Buffer>;
}
type SharpFactory = (input: Buffer) => SharpImage;

let sharp: SharpFactory | null = null;
try {
  const specifier = 'sharp';
  sharp = ((await import(specifier)) as { default: SharpFactory }).default;
} catch {
  sharp = null;
}
const SKIP_SHARP = sharp ? false : 'sharp is not installed (optional external-decoder oracle)';

// ── reference CRC-32 (bitwise, no table — independent of zip-crypto.ts) ─────

function refCrc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]!;
    for (let b = 0; b < 8; b++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// ── a minimal, CRC-VERIFYING chunk reader (the test's own decoder) ──────────

interface Chunk { type: string; data: Uint8Array; crc: number; crcOk: boolean }

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const rdU32 = (b: Uint8Array, o: number): number =>
  ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;

function parseChunks(png: Uint8Array): Chunk[] {
  for (let i = 0; i < 8; i++) assert.equal(png[i], PNG_SIG[i], `bad PNG signature byte ${i}`);
  const out: Chunk[] = [];
  let off = 8;
  while (off + 12 <= png.length) {
    const len = rdU32(png, off);
    const type = String.fromCharCode(png[off + 4]!, png[off + 5]!, png[off + 6]!, png[off + 7]!);
    const data = png.subarray(off + 8, off + 8 + len);
    const crc = rdU32(png, off + 8 + len);
    out.push({ type, data, crc, crcOk: crc === refCrc32(png.subarray(off + 4, off + 8 + len)) });
    off += 12 + len;
    if (type === 'IEND') break;
  }
  assert.equal(off, png.length, 'trailing bytes after IEND');
  return out;
}

function idatPayload(chunks: Chunk[]): Uint8Array {
  const parts = chunks.filter((c) => c.type === 'IDAT');
  assert.ok(parts.length >= 1, 'no IDAT chunk');
  const total = parts.reduce((n, c) => n + c.data.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of parts) { out.set(c.data, o); o += c.data.length; }
  return out;
}

/** Full self-decode: inflate → unfilter → samples at the declared depth. */
function decodeSelf(png: Uint8Array): { width: number; height: number; depth: number; channels: number; samples: Uint8Array | Uint16Array } {
  const chunks = parseChunks(png);
  for (const c of chunks) assert.ok(c.crcOk, `CRC mismatch in ${c.type}`);
  const ihdr = chunks[0]!;
  assert.equal(ihdr.type, 'IHDR');
  const width = rdU32(ihdr.data, 0);
  const height = rdU32(ihdr.data, 4);
  const depth = ihdr.data[8]!;
  const colorType = ihdr.data[9]!;
  const channels = colorType === 6 ? 4 : 3;
  const inflated = new Uint8Array(inflateSync(Buffer.from(idatPayload(chunks))));
  const bpp = channels * (depth >> 3);
  const bytes = unfilterPng(inflated, width, height, bpp);
  assert.ok(bytes, 'unfilterPng returned null');
  if (depth === 8) return { width, height, depth, channels, samples: bytes };
  // 16-bit: PNG samples are big-endian (spec §7.1).
  const u16 = new Uint16Array(bytes.length / 2);
  for (let i = 0; i < u16.length; i++) u16[i] = (bytes[i * 2]! << 8) | bytes[i * 2 + 1]!;
  return { width, height, depth, channels, samples: u16 };
}

function assertSamplesEqual(got: Uint8Array | Uint16Array, want: PngSamples, label: string): void {
  assert.equal(got.length, want.length, `${label}: sample count`);
  for (let i = 0; i < want.length; i++) {
    if (got[i] !== want[i]) assert.fail(`${label}: sample ${i} is ${got[i]}, expected ${want[i]}`);
  }
}

// ── deterministic fixtures (no randomness, no now-defaults) ─────────────────

const W = 9;
const H = 7;

/** 8-bit RGBA: independent per-channel ramps + a varying alpha. */
const RGBA8 = (() => {
  const a = new Uint8Array(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    a[i * 4] = (i * 13) & 0xff;
    a[i * 4 + 1] = (i * 29) & 0xff;
    a[i * 4 + 2] = (i * 7) & 0xff;
    a[i * 4 + 3] = 255 - ((i * 3) & 0xff);
  }
  return a;
})();

const RGB8 = (() => {
  const a = new Uint8Array(W * H * 3);
  for (let i = 0; i < a.length; i++) a[i] = (i * 37) & 0xff;
  return a;
})();

/** 16-bit RGBA covering the full range, including values whose low byte differs. */
const RGBA16 = (() => {
  const a = new Uint16Array(W * H * 4);
  for (let i = 0; i < a.length; i++) a[i] = (i * 4099) & 0xffff;
  return a;
})();

const RGB16 = (() => {
  const a = new Uint16Array(W * H * 3);
  for (let i = 0; i < a.length; i++) a[i] = (i * 7919) & 0xffff;
  return a;
})();

/** A smooth gradient — the filtering measurement fixture. */
function gradient(size: number, depth: 8 | 16): PngSamples {
  const n = size * size * 4;
  const a = depth === 8 ? new Uint8Array(n) : new Uint16Array(n);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const s = depth === 8 ? 1 : 257;
      a[i] = x * s;
      a[i + 1] = y * s;
      a[i + 2] = ((x + y) >> 1) * s;
      a[i + 3] = depth === 8 ? 255 : 65535;
    }
  }
  return a;
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Structure
// ────────────────────────────────────────────────────────────────────────────

test('IHDR describes the requested geometry, depth and colour type', () => {
  const cases: Array<[PngSamples, Partial<PackPngOptions>, number, number]> = [
    [RGBA8, {}, 8, 6],
    [RGB8, { channels: 3 }, 8, 2],
    [RGBA16, { depth: 16 }, 16, 6],
    [RGB16, { depth: 16, channels: 3 }, 16, 2],
  ];
  for (const [pixels, opts, depth, colorType] of cases) {
    const png = packPng(pixels, { width: W, height: H, ...opts } as PackPngOptions);
    const [ihdr] = parseChunks(png);
    assert.equal(ihdr!.type, 'IHDR');
    assert.equal(ihdr!.data.length, 13);
    assert.equal(rdU32(ihdr!.data, 0), W);
    assert.equal(rdU32(ihdr!.data, 4), H);
    assert.equal(ihdr!.data[8], depth, 'bit depth');
    assert.equal(ihdr!.data[9], colorType, 'colour type');
    assert.equal(ihdr!.data[10], 0, 'compression method 0 (deflate)');
    assert.equal(ihdr!.data[11], 0, 'filter method 0 (adaptive)');
    assert.equal(ihdr!.data[12], 0, 'interlace 0 (none)');
  }
});

test('chunk order: IHDR first, ancillaries before IDAT, IEND last and empty', () => {
  const png = packPng(RGBA8, {
    width: W, height: H, dpi: 300, cicp: { ...HDR_PQ_CICP },
    text: [{ keyword: 'Software', text: 'Lolly' }],
  });
  const types = parseChunks(png).map((c) => c.type);
  assert.equal(types[0], 'IHDR');
  assert.equal(types[types.length - 1], 'IEND');
  const firstIdat = types.indexOf('IDAT');
  for (const t of ['cICP', 'pHYs', 'iTXt']) {
    const at = types.indexOf(t);
    assert.ok(at > 0 && at < firstIdat, `${t} must sit between IHDR and IDAT (got index ${at})`);
  }
  // Every IDAT is contiguous and nothing follows them but IEND.
  const lastIdat = types.lastIndexOf('IDAT');
  for (let i = firstIdat; i <= lastIdat; i++) assert.equal(types[i], 'IDAT');
  assert.equal(lastIdat, types.length - 2);
  assert.equal(parseChunks(png).at(-1)!.data.length, 0, 'IEND carries no data');
});

test('a large payload is split across multiple IDAT chunks, and rejoins losslessly', () => {
  const px = gradient(64, 8);
  const png = packPng(px, { width: 64, height: 64, idatChunkBytes: 64 });
  const chunks = parseChunks(png);
  const idats = chunks.filter((c) => c.type === 'IDAT');
  assert.ok(idats.length > 1, `expected several IDATs, got ${idats.length}`);
  for (const c of idats.slice(0, -1)) assert.equal(c.data.length, 64);
  assertSamplesEqual(decodeSelf(png).samples, px, 'split IDAT');
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Oracle 1 — decode our own output (node:zlib + engine unfilterPng)
// ────────────────────────────────────────────────────────────────────────────

for (const [label, pixels, opts] of [
  ['8-bit RGBA', RGBA8, {}],
  ['8-bit RGB', RGB8, { channels: 3 }],
  ['16-bit RGBA', RGBA16, { depth: 16 }],
  ['16-bit RGB', RGB16, { depth: 16, channels: 3 }],
] as Array<[string, PngSamples, Partial<PackPngOptions>]>) {
  test(`self-decode oracle: ${label} round-trips exactly (filter auto)`, () => {
    const png = packPng(pixels, { width: W, height: H, ...opts } as PackPngOptions);
    const got = decodeSelf(png);
    assert.equal(got.width, W);
    assert.equal(got.height, H);
    assertSamplesEqual(got.samples, pixels, label);
  });

  test(`self-decode oracle: ${label} round-trips exactly (filter none)`, () => {
    const png = packPng(pixels, { width: W, height: H, filter: 'none', ...opts } as PackPngOptions);
    assertSamplesEqual(decodeSelf(png).samples, pixels, `${label} unfiltered`);
    // Every scanline really does carry filter tag 0.
    const chunks = parseChunks(png);
    const inflated = new Uint8Array(inflateSync(Buffer.from(idatPayload(chunks))));
    const channels = (opts.channels ?? 4);
    const stride = W * channels * ((opts.depth ?? 8) >> 3) + 1;
    for (let y = 0; y < H; y++) assert.equal(inflated[y * stride], 0, `row ${y} filter tag`);
  });
}

test('filter auto really does choose more than one filter type on real content', () => {
  const png = packPng(gradient(32, 8), { width: 32, height: 32 });
  const inflated = new Uint8Array(inflateSync(Buffer.from(idatPayload(parseChunks(png)))));
  const stride = 32 * 4 + 1;
  const tags = new Set<number>();
  for (let y = 0; y < 32; y++) tags.add(inflated[y * stride]!);
  for (const t of tags) assert.ok(t >= 0 && t <= 4, `filter tag ${t} is outside 0..4`);
  assert.ok(tags.size > 1, `heuristic picked a single filter type for a gradient: ${[...tags].join(',')}`);
});

test('a single pixel image and a 1xN column both round-trip (degenerate geometry)', () => {
  const one = Uint8Array.of(1, 2, 3, 4);
  assertSamplesEqual(decodeSelf(packPng(one, { width: 1, height: 1 })).samples, one, '1x1');
  const col = new Uint8Array(5 * 4).map((_, i) => (i * 11) & 0xff);
  assertSamplesEqual(decodeSelf(packPng(col, { width: 1, height: 5 })).samples, col, '1x5');
  const row = new Uint16Array(5 * 3).map((_, i) => (i * 9001) & 0xffff);
  assertSamplesEqual(decodeSelf(packPng(row, { width: 5, height: 1, depth: 16, channels: 3 })).samples, row, '5x1 deep');
});

// ────────────────────────────────────────────────────────────────────────────
// 3. Oracle 2 — an external decoder (sharp / libvips)
// ────────────────────────────────────────────────────────────────────────────

test('external decoder: sharp reads our 8-bit RGBA and RGB byte-for-byte', { skip: SKIP_SHARP }, async () => {
  const s = sharp!;
  for (const [label, pixels, channels] of [['RGBA', RGBA8, 4], ['RGB', RGB8, 3]] as const) {
    const png = packPng(pixels, { width: W, height: H, channels: channels as 3 | 4 });
    const meta = await s(Buffer.from(png)).metadata();
    assert.equal(meta.width, W);
    assert.equal(meta.height, H);
    assert.equal(meta.depth, 'uchar', `${label}: sharp should see 8-bit`);
    assert.equal(meta.channels, channels);
    const raw = await s(Buffer.from(png)).raw().toBuffer();
    assertSamplesEqual(new Uint8Array(raw), pixels, `sharp ${label}`);
  }
});

test('external decoder: sharp reads our 16-bit RGBA and RGB byte-for-byte', { skip: SKIP_SHARP }, async () => {
  const s = sharp!;
  for (const [label, pixels, channels] of [['RGBA', RGBA16, 4], ['RGB', RGB16, 3]] as const) {
    const png = packPng(pixels, { width: W, height: H, depth: 16, channels: channels as 3 | 4 });
    const meta = await s(Buffer.from(png)).metadata();
    assert.equal(meta.depth, 'ushort', `${label}: sharp should see 16-bit`);
    assert.equal(meta.channels, channels);
    // sharp's pipeline interpretation is 8-bit sRGB unless told otherwise, so
    // ask for the 16-bit colourspace explicitly or it hands back highbyte-only.
    const raw = await s(Buffer.from(png)).toColourspace('rgb16').raw({ depth: 'ushort' }).toBuffer();
    const got = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
    assertSamplesEqual(got, pixels, `sharp 16-bit ${label}`);
  }
});

test('external decoder: sharp reads the pHYs density and the deep gradient', { skip: SKIP_SHARP }, async () => {
  const s = sharp!;
  const meta = await s(Buffer.from(packPng(RGBA8, { width: W, height: H, dpi: 300 }))).metadata();
  assert.equal(meta.density, 300, 'sharp resolves our pHYs back to 300 dpi');
  const px = gradient(48, 16);
  const png = packPng(px, { width: 48, height: 48, depth: 16 });
  const raw = await s(Buffer.from(png)).toColourspace('rgb16').raw({ depth: 'ushort' }).toBuffer();
  assertSamplesEqual(new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2), px, 'sharp deep gradient');
});

test('external decoder NEGATIVE CONTROL: sharp disagrees when the pixels differ', { skip: SKIP_SHARP }, async () => {
  const s = sharp!;
  const mutated = RGBA8.slice();
  mutated[17] = (mutated[17]! ^ 0x01) & 0xff;
  const raw = await s(Buffer.from(packPng(mutated, { width: W, height: H }))).raw().toBuffer();
  assert.notEqual(new Uint8Array(raw)[17], RGBA8[17], 'the oracle would have passed on any bytes — it does not');
  assertSamplesEqual(new Uint8Array(raw), mutated, 'sharp mutated');
});

// ────────────────────────────────────────────────────────────────────────────
// 4. cICP (PNG 3rd Edition §11.3.3.6 / ITU-T H.273)
// ────────────────────────────────────────────────────────────────────────────

test('cICP carries the four H.273 code points, BT.2100-PQ being 9 16 0 1', () => {
  const png = packPng(RGBA16, { width: W, height: H, depth: 16, cicp: { ...HDR_PQ_CICP } });
  const cicp = parseChunks(png).find((c) => c.type === 'cICP');
  assert.ok(cicp, 'no cICP chunk');
  assert.equal(cicp!.data.length, 4);
  // Spec values, written out rather than derived: BT.2020 primaries, PQ
  // transfer, identity matrix, full range.
  assert.deepEqual([...cicp!.data], [9, 16, 0, 1]);
  // ...and the engine's own constant must still BE those values.
  assert.deepEqual(
    [HDR_PQ_CICP.primaries, HDR_PQ_CICP.transfer, HDR_PQ_CICP.matrix, HDR_PQ_CICP.fullRange],
    [9, 16, 0, 1],
  );
});

test('cICP can also describe plain sRGB (1 13 0 1), and is omitted when not asked for', () => {
  const png = packPng(RGBA8, { width: W, height: H, cicp: { primaries: 1, transfer: 13, matrix: 0, fullRange: 1 } });
  assert.deepEqual([...parseChunks(png).find((c) => c.type === 'cICP')!.data], [1, 13, 0, 1]);
  assert.equal(parseChunks(packPng(RGBA8, { width: W, height: H })).find((c) => c.type === 'cICP'), undefined);
});

test('cICP NEGATIVE CONTROL: a non-identity matrix or an out-of-range code point is refused', () => {
  const base = { width: W, height: H } as const;
  assert.throws(
    () => packPng(RGBA8, { ...base, cicp: { primaries: 9, transfer: 16, matrix: 1, fullRange: 1 } }),
    /matrix must be 0/,
  );
  assert.throws(
    () => packPng(RGBA8, { ...base, cicp: { primaries: 300, transfer: 16, matrix: 0, fullRange: 1 } }),
    /primaries must be a byte/,
  );
  assert.throws(
    () => packPng(RGBA8, { ...base, cicp: { primaries: 9, transfer: -1, matrix: 0, fullRange: 1 } }),
    /transfer must be a byte/,
  );
});

// ────────────────────────────────────────────────────────────────────────────
// 5. pHYs — must mean exactly what the shell's insertPngPhys means
// ────────────────────────────────────────────────────────────────────────────

test('pHYs matches insertPngPhys semantics: equal axes, unit 1 (metre), ppm = round(dpi/0.0254)', () => {
  for (const dpi of [72, 96, 150, 300, 600]) {
    const png = packPng(RGBA8, { width: W, height: H, dpi });
    const phys = parseChunks(png).find((c) => c.type === 'pHYs');
    assert.ok(phys, `no pHYs at ${dpi} dpi`);
    assert.equal(phys!.data.length, 9);
    const expect = Math.round(dpi / 0.0254); // the shell's arithmetic, verbatim
    assert.equal(rdU32(phys!.data, 0), expect, `x ppm at ${dpi} dpi`);
    assert.equal(rdU32(phys!.data, 4), expect, `y ppm at ${dpi} dpi`);
    assert.equal(phys!.data[8], 1, 'unit specifier: metre');
  }
  // Pinned literals so a refactor of the arithmetic cannot drift silently.
  assert.equal(Math.round(300 / 0.0254), 11811);
  assert.equal(Math.round(96 / 0.0254), 3780);
});

test('pHYs is omitted for a missing or non-positive dpi', () => {
  for (const dpi of [undefined, 0, -300]) {
    const png = packPng(RGBA8, { width: W, height: H, dpi });
    assert.equal(parseChunks(png).find((c) => c.type === 'pHYs'), undefined, `dpi=${String(dpi)}`);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 6. iTXt passthrough
// ────────────────────────────────────────────────────────────────────────────

test('iTXt keywords with NUL or bad spacing are refused (spec 11.3.4.5)', () => {
  const px = new Uint8Array(4);
  for (const keyword of ['a\0b', ' lead', 'trail ', 'two  spaces']) {
    assert.throws(
      () => packPng(px, { width: 1, height: 1, channels: 4, depth: 8, text: [{ keyword, text: 'x' }] }),
      /NUL or leading|1-79/,
      `keyword ${JSON.stringify(keyword)} must be refused`);
  }
  // Negative control: an ordinary keyword still writes.
  packPng(px, { width: 1, height: 1, channels: 4, depth: 8, text: [{ keyword: 'Software', text: 'x' }] });
});

test('iTXt writes uncompressed UTF-8 with the spec field order', () => {
  const png = packPng(RGBA8, {
    width: W, height: H,
    text: [
      { keyword: 'Software', text: 'Lolly' },
      { keyword: 'Description', text: 'depth follows provenance — 16-bit éè', languageTag: 'en', translatedKeyword: 'Beschreibung' },
    ],
  });
  const texts = parseChunks(png).filter((c) => c.type === 'iTXt');
  assert.equal(texts.length, 2);

  const parse = (d: Uint8Array): { keyword: string; flag: number; method: number; lang: string; translated: string; text: string } => {
    const nul = (from: number): number => { let i = from; while (d[i] !== 0) i++; return i; };
    const dec = new TextDecoder();
    const k = nul(0);
    const flag = d[k + 1]!;
    const method = d[k + 2]!;
    const l = nul(k + 3);
    const t = nul(l + 1);
    return {
      keyword: dec.decode(d.subarray(0, k)),
      flag, method,
      lang: dec.decode(d.subarray(k + 3, l)),
      translated: dec.decode(d.subarray(l + 1, t)),
      text: dec.decode(d.subarray(t + 1)),
    };
  };

  const a = parse(texts[0]!.data);
  assert.deepEqual(a, { keyword: 'Software', flag: 0, method: 0, lang: '', translated: '', text: 'Lolly' });
  const b = parse(texts[1]!.data);
  assert.equal(b.keyword, 'Description');
  assert.equal(b.flag, 0, 'compression flag 0 = uncompressed');
  assert.equal(b.lang, 'en');
  assert.equal(b.translated, 'Beschreibung');
  assert.equal(b.text, 'depth follows provenance — 16-bit éè');
  // The em dash is multi-byte UTF-8, so the chunk is longer than the JS string.
  assert.ok(texts[1]!.data.length > b.keyword.length + b.text.length);
});

test('iTXt NEGATIVE CONTROL: an empty or over-long keyword, or a non-Latin-1 one, is refused', () => {
  const base = { width: W, height: H } as const;
  assert.throws(() => packPng(RGBA8, { ...base, text: [{ keyword: '', text: 'x' }] }), /keyword must be 1-79/);
  assert.throws(() => packPng(RGBA8, { ...base, text: [{ keyword: 'k'.repeat(80), text: 'x' }] }), /keyword must be 1-79/);
  assert.throws(() => packPng(RGBA8, { ...base, text: [{ keyword: 'K中', text: 'x' }] }), /not Latin-1/);
});

// ────────────────────────────────────────────────────────────────────────────
// 7. CRC-32
// ────────────────────────────────────────────────────────────────────────────

test('every chunk CRC matches an independent bitwise reference implementation', () => {
  const png = packPng(RGBA16, {
    width: W, height: H, depth: 16, dpi: 300, cicp: { ...HDR_PQ_CICP },
    text: [{ keyword: 'Software', text: 'Lolly' }],
  });
  const chunks = parseChunks(png);
  assert.ok(chunks.length >= 6);
  for (const c of chunks) assert.ok(c.crcOk, `${c.type} CRC does not match the reference`);
});

test('CRC reference values: the standard check vector, and the invariant IEND CRC', () => {
  const ascii = (s: string): Uint8Array => Uint8Array.from(s, (ch) => ch.charCodeAt(0));
  // CRC-32/ISO-HDLC check value for "123456789" — the reflected 0xEDB88320
  // polynomial PNG mandates (spec §5.5).
  assert.equal(refCrc32(ascii('123456789')), 0xcbf43926);
  assert.equal(engineCrc32(ascii('123456789')), 0xcbf43926, 'the engine crc32 we reuse agrees');
  // An empty IEND is byte-invariant across every PNG ever written.
  assert.equal(refCrc32(ascii('IEND')), 0xae426082);
  const png = packPng(RGBA8, { width: W, height: H });
  assert.equal(parseChunks(png).at(-1)!.crc, 0xae426082);
});

test('CRC NEGATIVE CONTROL: a flipped CRC byte is detected (and libvips notably does NOT)', async () => {
  const png = packPng(RGBA8, { width: W, height: H });
  const ihdrCrcOffset = 8 + 4 + 4 + 13; // signature + IHDR length + type + data
  const bad = png.slice();
  bad[ihdrCrcOffset] = bad[ihdrCrcOffset]! ^ 0x01;
  const chunks = parseChunks(bad);
  assert.equal(chunks[0]!.crcOk, false, 'the reference verifier must catch it');
  assert.ok(chunks.slice(1).every((c) => c.crcOk), 'only the tampered chunk should fail');
  assert.throws(() => decodeSelf(bad), /CRC mismatch in IHDR/);
  // Documented reality: libspng only warns on CRC mismatch, so the external
  // decoder is NOT the CRC oracle. Asserting that keeps the claim honest.
  if (!SKIP_SHARP) {
    const meta = await sharp!(Buffer.from(bad)).metadata();
    assert.equal(meta.width, W, 'libvips decodes past a bad CRC — hence the reference verifier above');
  }
});

test('DATA NEGATIVE CONTROL: a flipped IDAT byte is rejected by node:zlib', () => {
  const png = packPng(gradient(32, 8), { width: 32, height: 32 });
  const chunks = parseChunks(png);
  const first = chunks.findIndex((c) => c.type === 'IDAT');
  // Byte offset of the IDAT payload inside the file.
  let off = 8;
  for (let i = 0; i < first; i++) off += 12 + chunks[i]!.data.length;
  const payloadAt = off + 8 + 6; // a few bytes into the deflate stream
  const bad = png.slice();
  bad[payloadAt] = bad[payloadAt]! ^ 0xff;
  assert.throws(() => inflateSync(Buffer.from(idatPayload(parseChunks(bad)))));
});

// ────────────────────────────────────────────────────────────────────────────
// 8. Golden bytes
// ────────────────────────────────────────────────────────────────────────────

test('golden: 8-bit RGBA, default options', () => {
  golden('rgba8-default.png', packPng(RGBA8, { width: W, height: H }));
});

test('golden: 8-bit RGB, unfiltered', () => {
  golden('rgb8-none.png', packPng(RGB8, { width: W, height: H, channels: 3, filter: 'none' }));
});

test('golden: 16-bit RGBA with pHYs + cICP (BT.2100-PQ) + iTXt', () => {
  golden('rgba16-hdr.png', packPng(RGBA16, {
    width: W, height: H, depth: 16, dpi: 300, cicp: { ...HDR_PQ_CICP },
    text: [{ keyword: 'Software', text: 'Lolly' }],
  }));
});

test('golden: 16-bit RGB', () => {
  golden('rgb16.png', packPng(RGB16, { width: W, height: H, depth: 16, channels: 3 }));
});

test('golden NEGATIVE CONTROL: one changed sample changes the file bytes', () => {
  const a = packPng(RGBA8, { width: W, height: H });
  const mutated = RGBA8.slice();
  mutated[17] = (mutated[17]! ^ 0x01) & 0xff;
  const b = packPng(mutated, { width: W, height: H });
  assert.notEqual(Buffer.from(a).toString('base64'), Buffer.from(b).toString('base64'));
  if (!UPDATE_GOLDENS) {
    assert.notEqual(Buffer.from(b).toString('base64'), committed['rgba8-default.png']);
  }
  // ...and options change bytes too, so the goldens are not pinning a constant.
  assert.notEqual(
    Buffer.from(packPng(RGBA8, { width: W, height: H, dpi: 300 })).toString('base64'),
    Buffer.from(a).toString('base64'),
  );
});

// ────────────────────────────────────────────────────────────────────────────
// 9. Filtering measurement (plan asks for the number, not a hunch)
// ────────────────────────────────────────────────────────────────────────────

test('filter heuristic pays for itself at BOTH depths on a gradient', () => {
  const rows: string[] = [];
  for (const depth of [8, 16] as const) {
    const px = gradient(256, depth);
    const auto = packPng(px, { width: 256, height: 256, depth }).length;
    const none = packPng(px, { width: 256, height: 256, depth, filter: 'none' }).length;
    rows.push(`  ${depth}-bit 256x256 RGBA gradient: auto ${auto} bytes, none ${none} bytes (${(none / auto).toFixed(1)}x)`);
    assert.ok(auto < none, `${depth}-bit: filtering must not make the file bigger (auto ${auto}, none ${none})`);
    // Well beyond noise — this is the justification for using the heuristic on
    // the 16-bit path too rather than defaulting it to None.
    assert.ok(none / auto > 4, `${depth}-bit: expected a large win, got ${(none / auto).toFixed(2)}x`);
    // Both encodings still decode to the identical pixels.
    assertSamplesEqual(decodeSelf(packPng(px, { width: 256, height: 256, depth })).samples, px, `${depth}-bit auto`);
    assertSamplesEqual(decodeSelf(packPng(px, { width: 256, height: 256, depth, filter: 'none' })).samples, px, `${depth}-bit none`);
  }
  console.log('[png] filter heuristic vs none:');
  for (const r of rows) console.log(r);
});

test('filtering never expands incompressible-looking noise beyond the unfiltered size', () => {
  // Deterministic pseudo-noise (LCG) — no randomness in the fixture.
  const n = 64 * 64 * 4;
  const px = new Uint8Array(n);
  let s = 12345;
  for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; px[i] = (s >>> 16) & 0xff; }
  const auto = packPng(px, { width: 64, height: 64 }).length;
  const none = packPng(px, { width: 64, height: 64, filter: 'none' }).length;
  console.log(`[png] 64x64 noise: auto ${auto} bytes, none ${none} bytes`);
  assert.ok(auto <= none * 1.02, `filtering blew up on noise (auto ${auto}, none ${none})`);
  assertSamplesEqual(decodeSelf(packPng(px, { width: 64, height: 64 })).samples, px, 'noise');
});

// ────────────────────────────────────────────────────────────────────────────
// 10. The deflate memory guard (plan §9 "Phase B blocker")
// ────────────────────────────────────────────────────────────────────────────

test('past maxDeflateBytes the writer refuses loudly, naming the reason', () => {
  assert.throws(
    () => packPng(gradient(64, 8), { width: 64, height: 64, maxDeflateBytes: 1024 }),
    (err: Error) => {
      assert.match(err.message, /exceeds maxDeflateBytes/);
      assert.match(err.message, /no incremental surface/);
      assert.match(err.message, /oversize: 'store'/);
      return true;
    },
  );
  // Raising the cap deliberately is allowed and produces a normal file.
  const png = packPng(gradient(64, 8), { width: 64, height: 64, maxDeflateBytes: 1 << 20 });
  assertSamplesEqual(decodeSelf(png).samples, gradient(64, 8), 'raised cap');
});

test("oversize: 'store' emits a valid, decodable, uncompressed PNG", async () => {
  const px = gradient(64, 8);
  const png = packPng(px, { width: 64, height: 64, maxDeflateBytes: 1024, oversize: 'store' });
  assertSamplesEqual(decodeSelf(png).samples, px, 'stored');
  // node:zlib accepts the hand-built stored stream...
  const inflated = new Uint8Array(inflateSync(Buffer.from(idatPayload(parseChunks(png)))));
  assert.equal(inflated.length, 64 * (64 * 4 + 1));
  // ...and it is genuinely uncompressed (bigger than the deflated file).
  const compressed = packPng(px, { width: 64, height: 64 });
  assert.ok(png.length > compressed.length * 4, `stored ${png.length} vs deflated ${compressed.length}`);
  if (!SKIP_SHARP) {
    const raw = await sharp!(Buffer.from(png)).raw().toBuffer();
    assertSamplesEqual(new Uint8Array(raw), px, 'sharp reads the stored-block PNG');
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 11. Input validation (the depth seam is a refusal, not a conversion)
// ────────────────────────────────────────────────────────────────────────────

test('the depth seam: packPng refuses to convert, it only writes', () => {
  // An 8-bit buffer offered as 16-bit is padding sold as quality — refused.
  assert.throws(() => packPng(RGBA8, { width: W, height: H, depth: 16 }), /depth 16 requires a Uint16Array/);
  // ...and the reverse.
  assert.throws(() => packPng(RGBA16, { width: W, height: H, depth: 8 }), /depth 8 requires a Uint8Array/);
  // Uint8ClampedArray (what canvas hands out) is accepted at depth 8.
  const clamped = new Uint8ClampedArray(RGBA8);
  assertSamplesEqual(decodeSelf(packPng(clamped, { width: W, height: H })).samples, RGBA8, 'clamped');
});

test('geometry, channel-count and buffer-length errors are explicit', () => {
  assert.throws(() => packPng(RGBA8, { width: 0, height: H }), /width and height must be positive/);
  assert.throws(() => packPng(RGBA8, { width: W, height: -1 }), /width and height must be positive/);
  assert.throws(() => packPng(RGBA8, { width: W, height: H, channels: 2 as unknown as 3 }), /unsupported channels/);
  assert.throws(() => packPng(RGBA8, { width: W, height: H, depth: 12 as unknown as 8 }), /unsupported depth/);
  assert.throws(() => packPng(RGBA8, { width: W, height: H + 1 }), /expected \d+/);
  assert.throws(() => packPng(RGBA8.subarray(0, 8), { width: W, height: H }), /pixel buffer is 8 samples/);
});
