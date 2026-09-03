// SPDX-License-Identifier: MPL-2.0
/**
 * packages/node-shell/src/hdr.ts - the Node HDR stills (plans/183 WS5).
 *
 * The Node port of `shells/web/src/bridge/export-hdr-png.ts` and
 * `export-gainmap-jpeg.ts`, so this suite deliberately mirrors those two web
 * suites' assertions. It is the mechanism that keeps the port honest: the ORDER
 * of engine calls is duplicated in two files, and a divergence has to show up as
 * a failing test rather than as two different HDR files.
 *
 * Everything is decoded back OUT of the produced bytes - node:zlib plus the
 * engine's own `unfilterPng` for the PNG, a marker walk plus sharp for the JPEG -
 * never trusted from the in-memory buffer. sharp is a root dependency and the
 * default JPEG encoder for this module, so nothing here skips.
 *
 * Run: node --test packages/node-shell/test/hdr.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import {
  encodeHdrPng, encodeGainMapJpeg, hdrBoostOptions, decodeRgba,
  isGainMapJpegAvailable, sharpJpegEncoder, HDR_PNG_DEFLATE_CAP,
} from '../src/hdr.ts';
import type { JpegEncoder } from '../src/hdr.ts';
import { unfilterPng } from '../../../engine/src/png-unfilter.ts';
import { HDR_PQ_CICP } from '../../../engine/src/hdr.ts';
import { detectWatermark } from '../../../engine/src/pixel-watermark.ts';
import { findJpegSegment, jpegSegmentBody, scanJpegSegments, JPEG_APP_IDS } from '../../../engine/src/jpeg-segments.ts';
import { ISO_GAINMAP_URN } from '../../../engine/src/gainmap-jpeg.ts';
import { srgbIccProfile } from '../../../engine/src/color.ts';
import { attachC2paStore, extractC2paStore } from '@lolly/engine';

import sharpDefault from 'sharp';
const sharp = sharpDefault as unknown as (
  input: Buffer, opts?: { raw: { width: number; height: number; channels: number } },
) => {
  raw(): { toBuffer(): Promise<Buffer> };
  metadata(): Promise<{ width?: number; height?: number; format?: string }>;
};

// ─── tiny PNG reader (chunk walk + 16-bit sample decode) ─────────────────────

const SIG = [137, 80, 78, 71, 13, 10, 26, 10];
const u32 = (b: Uint8Array, o: number): number => ((b[o]! << 24) | (b[o + 1]! << 16) | (b[o + 2]! << 8) | b[o + 3]!) >>> 0;

interface Chunk { type: string; data: Uint8Array }

function chunks(png: Uint8Array): Chunk[] {
  for (let i = 0; i < 8; i++) assert.equal(png[i], SIG[i], `PNG signature byte ${i}`);
  const out: Chunk[] = [];
  for (let i = 8; i + 8 <= png.length;) {
    const len = u32(png, i);
    const type = String.fromCharCode(png[i + 4]!, png[i + 5]!, png[i + 6]!, png[i + 7]!);
    assert.ok(i + len + 12 <= png.length, `chunk ${type} runs past the end`);
    out.push({ type, data: png.subarray(i + 8, i + 8 + len) });
    if (type === 'IEND') break;
    i += len + 12;
  }
  return out;
}

const first = (cs: Chunk[], type: string): Chunk | undefined => cs.find(c => c.type === type);

interface Decoded { width: number; height: number; depth: number; colorType: number; samples: Uint16Array }

/** Decode a 16-bit truecolour+alpha PNG back to samples, via zlib + unfilterPng. */
function decode16(png: Uint8Array): Decoded {
  const cs = chunks(png);
  const ihdr = first(cs, 'IHDR')!.data;
  const width = u32(ihdr, 0), height = u32(ihdr, 4);
  const depth = ihdr[8]!, colorType = ihdr[9]!;
  const idat = cs.filter(c => c.type === 'IDAT');
  assert.ok(idat.length >= 1, 'at least one IDAT');
  const z = new Uint8Array(idat.reduce((n, c) => n + c.data.length, 0));
  let o = 0;
  for (const c of idat) { z.set(c.data, o); o += c.data.length; }
  const inflated = new Uint8Array(inflateSync(Buffer.from(z)));
  const bytes = unfilterPng(inflated, width, height, 8); // 4 channels x 2 bytes
  assert.ok(bytes, 'unfilterPng decoded the scanlines');
  const samples = new Uint16Array(width * height * 4);
  for (let i = 0; i < samples.length; i++) samples[i] = (bytes![i * 2]! << 8) | bytes![i * 2 + 1]!;
  return { width, height, depth, colorType, samples };
}

/** The high byte of each 16-bit sample - the 8-bit view a legacy reader sees. */
function highBytes(d: Decoded): Uint8ClampedArray {
  const out = new Uint8ClampedArray(d.samples.length);
  for (let i = 0; i < out.length; i++) out[i] = d.samples[i]! >> 8;
  return out;
}

// ─── inputs ──────────────────────────────────────────────────────────────────

function frameOf(data: Uint8ClampedArray, width: number, height: number): { data: Uint8ClampedArray; width: number; height: number } {
  return { data, width, height };
}

/** Flat RGBA of one colour. */
function solid(w: number, h: number, r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i += 4) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; }
  return px;
}

/** A textured, deterministic image (mulberry32) - enough block activity to mark. */
function noisy(w: number, h: number): Uint8ClampedArray {
  let s = 0x2f6e2b1 >>> 0;
  const rnd = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const base = 60 + 120 * ((x / w + y / h) / 2);
      px[i] = base + rnd() * 70;
      px[i + 1] = base * 0.8 + rnd() * 70;
      px[i + 2] = base * 0.6 + rnd() * 70;
      px[i + 3] = 255;
    }
  }
  return px;
}

/** A test image: a brand-green block on a mid-grey field, plus a luminance ramp. */
function testImage(w: number, h: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inBlock = x > w / 4 && x < w / 2 && y > h / 4 && y < h / 2;
      if (inBlock) { px[i] = 0x30; px[i + 1] = 0xba; px[i + 2] = 0x78; }
      else { const v = Math.round((x / Math.max(1, w - 1)) * 255); px[i] = v; px[i + 1] = v; px[i + 2] = v; }
      px[i + 3] = 255;
    }
  }
  return px;
}

/** No brand targets and no white target: the plain 203-nit anchor, nothing boosted. */
const NO_BOOST = { targets: [] as string[], includeWhite: false };
const HDR = { targets: ['#30ba78'] };

// ═══ the 16-bit HDR PNG ══════════════════════════════════════════════════════

test('HDR PNG is a valid 16-bit RGBA file carrying cICP, pHYs, iTXt and iCCP', async () => {
  const icc = Uint8Array.from({ length: 128 }, (_, i) => i & 0xff);
  const png = await encodeHdrPng(frameOf(solid(8, 4, 200, 30, 40), 8, 4), {
    hdr: { targets: ['#00c1b4'] }, dpi: 300,
    meta: { software: 'Lolly', author: 'Test', tool: 't', source: '', description: 'HDR master' } as never,
    icc,
  });

  const cs = chunks(png);
  assert.equal(cs[0]!.type, 'IHDR');
  assert.equal(cs.at(-1)!.type, 'IEND');

  const d = decode16(png);
  assert.deepEqual([d.width, d.height, d.depth, d.colorType], [8, 4, 16, 6]);

  // cICP == the engine's Rec.2100-PQ code points (9 = BT.2020, 16 = PQ, 0, full).
  const cicp = first(cs, 'cICP');
  assert.ok(cicp, 'cICP chunk present');
  assert.deepEqual([...cicp!.data], [HDR_PQ_CICP.primaries, HDR_PQ_CICP.transfer, HDR_PQ_CICP.matrix, HDR_PQ_CICP.fullRange]);
  assert.deepEqual([...cicp!.data], [9, 16, 0, 1]);

  const phys = first(cs, 'pHYs');
  assert.ok(phys, 'pHYs chunk present');
  assert.equal(u32(phys!.data, 0), Math.round(300 / 0.0254));
  assert.equal(u32(phys!.data, 4), Math.round(300 / 0.0254));
  assert.equal(phys!.data[8], 1); // unit: metre

  const texts = cs.filter(c => c.type === 'iTXt').map(c => Buffer.from(c.data).toString('utf8'));
  assert.ok(texts.some(t => t.startsWith('Software')), 'Software iTXt');
  assert.ok(texts.some(t => t.includes('HDR master')), 'Description iTXt');
  const iccp = first(cs, 'iCCP');
  assert.ok(iccp, 'iCCP chunk present');
  assert.ok(Buffer.from(iccp!.data).toString('latin1').startsWith('Rec2100 PQ\0'), 'iCCP names the PQ profile');

  // Every ancillary must precede IDAT (the only ordering the spec imposes here).
  const idatAt = cs.findIndex(c => c.type === 'IDAT');
  for (const t of ['cICP', 'pHYs', 'iTXt', 'iCCP']) {
    assert.ok(cs.findIndex(c => c.type === t) < idatAt, `${t} before IDAT`);
  }
});

test('no dpi and no metadata writes no pHYs / iTXt / iCCP (negative control)', async () => {
  const png = await encodeHdrPng(frameOf(solid(8, 4, 10, 10, 10), 8, 4), { hdr: NO_BOOST });
  const cs = chunks(png);
  for (const t of ['pHYs', 'iTXt', 'iCCP']) assert.equal(first(cs, t), undefined, `${t} absent`);
  assert.ok(first(cs, 'cICP'), 'cICP is unconditional - it is the HDR signal');
});

test('a plain Uint8Array frame (resvg output) encodes exactly like a clamped one', async () => {
  // The Node source is resvg, which returns Uint8Array; the web source is canvas
  // ImageData, which is Uint8ClampedArray. Both must land on the same file.
  const clamped = noisy(32, 32);
  const plain = new Uint8Array(clamped);
  const a = await encodeHdrPng({ data: clamped, width: 32, height: 32 }, { hdr: HDR });
  const b = await encodeHdrPng({ data: plain, width: 32, height: 32 }, { hdr: HDR });
  assert.deepEqual([...a], [...b]);
});

test('203-nit diffuse white lands at PQ ~0.58 of full scale; black at 0', async () => {
  const px = solid(4, 2, 255, 255, 255);
  for (let i = 0; i < 4 * 4; i += 4) { px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; } // first row black
  const d = decode16(await encodeHdrPng(frameOf(px, 4, 2), { hdr: NO_BOOST }));

  // BT.2408 diffuse white = 203 nits; ST 2084 PQ(203/10000) = 0.5802.
  const white = d.samples[4 * 4]! / 65535;
  assert.ok(Math.abs(white - 0.5802) < 0.002, `white PQ signal ${white.toFixed(4)} should be ~0.5802`);
  assert.equal(d.samples[4 * 4], d.samples[4 * 4 + 1]);
  assert.equal(d.samples[4 * 4], d.samples[4 * 4 + 2]);
  assert.equal(d.samples[4 * 4 + 3], 65535); // opaque alpha survives at 16 bits
  assert.equal(d.samples[0], 0);
  assert.equal(d.samples[1], 0);
});

test('the brand boost is real: a matched colour lands materially above the unboosted encode', async () => {
  const px = solid(4, 4, 0, 193, 180);
  const plain = decode16(await encodeHdrPng(frameOf(px, 4, 4), { hdr: NO_BOOST }));
  const boosted = decode16(await encodeHdrPng(frameOf(px, 4, 4), { hdr: { targets: ['#00c1b4'] } }));
  const i = 1; // green channel of the first pixel
  assert.ok(boosted.samples[i]! > plain.samples[i]! + 2000, `boosted ${boosted.samples[i]} vs plain ${plain.samples[i]}`);
});

test('the low byte carries generated signal - not a v*257 replication of 8 bits', async () => {
  const w = 256, h = 1;
  const px = new Uint8ClampedArray(w * 4);
  for (let x = 0; x < w; x++) { px[x * 4] = x; px[x * 4 + 1] = x; px[x * 4 + 2] = x; px[x * 4 + 3] = 255; }
  const d = decode16(await encodeHdrPng(frameOf(px, w, h), { hdr: NO_BOOST }));

  // Padding (an 8-bit value widened to 16) is exactly v*257: divisible by 257,
  // with a low byte equal to the high byte. Assert the opposite, loudly.
  let padded = 0, echoed = 0;
  const lowSet = new Set<number>();
  for (let x = 0; x < w; x++) {
    const v = d.samples[x * 4]!;
    if (v % 257 === 0) padded++;
    if ((v & 0xff) === (v >> 8)) echoed++;
    lowSet.add(v & 0xff);
  }
  assert.ok(padded < 8, `${padded}/256 samples look like 8-bit padding (v*257)`);
  assert.ok(echoed < 8, `${echoed}/256 samples have low byte === high byte (the padding signature)`);
  assert.ok(lowSet.size > 64, `only ${lowSet.size} distinct low bytes - expected the PQ curve to spread them`);

  // The banding defect this replaces, demonstrated: two adjacent bright greys
  // collapse to ONE 8-bit PQ code and stay distinct at 16 bits.
  const a = d.samples[254 * 4]!, b = d.samples[255 * 4]!;
  assert.equal(Math.round((a / 65535) * 255), Math.round((b / 65535) * 255), 'sRGB 254/255 share an 8-bit PQ code');
  assert.ok(b - a > 20, `16-bit codes should stay apart, got ${a} and ${b}`);
});

test('two encodes of the same pixels are byte-identical (determinism)', async () => {
  const px = noisy(64, 64);
  const opts = { hdr: { targets: ['#00c1b4'] }, dpi: 300 } as const;
  const a = await encodeHdrPng(frameOf(px, 64, 64), { ...opts });
  const b = await encodeHdrPng(frameOf(px, 64, 64), { ...opts });
  assert.deepEqual([...a], [...b]);
  assert.ok(a.length > 100);
});

test('depth=8 is refused with a logged note and the file stays 16-bit', async () => {
  const notes: string[] = [];
  const png = await encodeHdrPng(frameOf(solid(8, 8, 120, 120, 120), 8, 8), {
    hdr: NO_BOOST, depth: 8, log: (_l, m) => notes.push(m),
  });
  assert.equal(decode16(png).depth, 16);
  assert.ok(notes.some(m => /depth=8 ignored/.test(m)), `expected a depth=8 note, got ${JSON.stringify(notes)}`);
});

test('depth=16 and depth=auto pass silently; depth=float is noted and satisfied at 16', async () => {
  for (const depth of [16, 'auto', undefined] as const) {
    const notes: string[] = [];
    const png = await encodeHdrPng(frameOf(solid(8, 8, 120, 120, 120), 8, 8), {
      hdr: NO_BOOST, ...(depth === undefined ? {} : { depth }), log: (_l, m) => notes.push(m),
    });
    assert.equal(decode16(png).depth, 16);
    assert.deepEqual(notes, [], `depth=${String(depth)} should log nothing`);
  }
  const notes: string[] = [];
  await encodeHdrPng(frameOf(solid(8, 8, 120, 120, 120), 8, 8), { hdr: NO_BOOST, depth: 'float', log: (_l, m) => notes.push(m) });
  assert.ok(notes.some(m => /depth=float/.test(m)));
});

test('the imprint survives into the 16-bit file and reads back off the high bytes', async () => {
  const px = noisy(128, 128);
  const base = { hdr: { targets: ['#00c1b4'] } } as const;
  const marked = decode16(await encodeHdrPng(frameOf(px, 128, 128), { ...base, imprint: true }));
  const clean = decode16(await encodeHdrPng(frameOf(px, 128, 128), { ...base }));

  const hit = detectWatermark(highBytes(marked), { width: 128, height: 128 });
  const miss = detectWatermark(highBytes(clean), { width: 128, height: 128 });
  assert.equal(hit.present, true, `mark not detected in the 16-bit file (score ${hit.score})`);
  assert.equal(miss.present, false, `unmarked file reported a mark (score ${miss.score})`);

  let padded = 0;
  for (let i = 0; i < marked.samples.length; i += 4) {
    assert.equal(marked.samples[i + 3], clean.samples[i + 3], 'alpha untouched by the mark');
    if (marked.samples[i]! % 257 === 0) padded++;
  }
  assert.ok(padded < marked.samples.length / 32, `${padded} samples went 8-bit-shaped after marking`);
});

test('a 16-bit HDR PNG takes a C2PA store and still decodes', async () => {
  const png = await encodeHdrPng(frameOf(solid(16, 16, 90, 140, 200), 16, 16), { hdr: NO_BOOST, dpi: 300 });
  const store = Uint8Array.from({ length: 64 }, (_, i) => (i * 7) & 0xff);
  const stamped = attachC2paStore(png, 'png', store);
  const back = extractC2paStore(stamped);
  assert.ok(back, 'store extracted back out');
  assert.equal(back!.format, 'png');
  assert.deepEqual([...back!.store], [...store]);

  const before = decode16(png), after = decode16(stamped);
  assert.deepEqual([...after.samples], [...before.samples]);
  assert.equal(after.depth, 16);
  assert.equal(chunks(stamped)[1]!.type, 'caBX', 'caBX sits directly after IHDR');
});

test('sharp decodes the 16-bit HDR PNG at 16 bits, at the right size', async () => {
  // An independent decoder, so the file is not merely self-consistent.
  const png = await encodeHdrPng(frameOf(testImage(48, 32), 48, 32), { hdr: HDR });
  const meta = await sharp(Buffer.from(png)).metadata() as { width?: number; height?: number; format?: string; depth?: string };
  assert.equal(meta.width, 48);
  assert.equal(meta.height, 32);
  assert.equal(meta.format, 'png');
  assert.equal(meta.depth, 'ushort', 'sharp reports 16-bit samples');
});

test('past the compressor ceiling the encode refuses (the caller can fall back)', async () => {
  await assert.rejects(
    () => encodeHdrPng(frameOf(noisy(64, 64), 64, 64), { hdr: NO_BOOST, maxDeflateBytes: 4096 }),
    /size ceiling/,
  );
  const small = decode16(await encodeHdrPng(frameOf(noisy(64, 64), 64, 64), { hdr: NO_BOOST }));
  assert.equal(small.depth, 16);
  assert.equal(small.width, 64);
  assert.equal(HDR_PNG_DEFLATE_CAP, 1024 * 1024 * 1024);
});

test('bad dimensions refuse rather than encode something plausible', async () => {
  await assert.rejects(
    () => encodeHdrPng(frameOf(testImage(16, 16), 17, 16), { hdr: NO_BOOST }),
    /samples for 17x16/,
  );
});

// ═══ the ISO 21496-1 gain-map JPEG ═══════════════════════════════════════════

interface Recorded { kind: 'base' | 'map'; rgba: Uint8ClampedArray; width: number; height: number }

/** Records the exact buffers the seam asked for, then hands them to the real
 *  encoder - so the gain-map maths is observed without a codec in the way, while
 *  the assembled file is still a real one. */
function recordingEncoder(): { fn: JpegEncoder; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const real = sharpJpegEncoder();
  return {
    calls,
    fn: async (rgba, width, height, kind) => {
      calls.push({ kind, rgba: Uint8ClampedArray.from(rgba), width, height });
      return await real(rgba, width, height, kind);
    },
  };
}

function splitFile(file: Uint8Array): { primary: Uint8Array; map: Uint8Array } {
  const scan = scanJpegSegments(file);
  assert.ok(scan && scan.trailerStart !== null, 'assembled file has a post-EOI trailer');
  return { primary: file.subarray(0, scan!.trailerStart!), map: file.subarray(scan!.trailerStart!) };
}

test('sharp is the Node JPEG encoder for this module, and it says so when it is not', () => {
  assert.equal(isGainMapJpegAvailable(), true, 'sharp is a root dependency of this repo');
});

test('produces a two-image file whose halves are the reported lengths', async () => {
  const { fn, calls } = recordingEncoder();
  const res = await encodeGainMapJpeg(frameOf(testImage(16, 16), 16, 16), { hdr: HDR, encodeJpeg: fn });
  assert.equal(calls.length, 2, 'exactly two encodes: base and map');
  assert.equal(calls[0]!.kind, 'base');
  assert.equal(calls[1]!.kind, 'map');
  assert.equal(res.baseLength + res.mapLength, res.bytes.length);
  const { primary, map } = splitFile(res.bytes);
  assert.equal(primary.length, res.baseLength);
  assert.equal(map.length, res.mapLength);
  // Both metadata forms present, on the image each belongs to.
  assert.ok(findJpegSegment(primary, 0xe2, 'MPF'), 'primary carries the MPF index');
  assert.ok(findJpegSegment(primary, 0xe1, JPEG_APP_IDS.XMP), 'primary carries the container XMP');
  assert.ok(findJpegSegment(map, 0xe1, JPEG_APP_IDS.XMP), 'gain map carries the hdrgm XMP');
  assert.ok(findJpegSegment(map, 0xe2, ISO_GAINMAP_URN), 'gain map carries the ISO 21496-1 metadata');
});

test('ONE rasterisation: base and map are the same size, and the map is grey', async () => {
  const { fn, calls } = recordingEncoder();
  await encodeGainMapJpeg(frameOf(testImage(32, 24), 32, 24), { hdr: HDR, encodeJpeg: fn });
  const [base, map] = calls;
  assert.equal(map!.width, base!.width);
  assert.equal(map!.height, base!.height);
  assert.equal(map!.rgba.length, base!.rgba.length, 'pixel-aligned by construction - no second render');
  for (let i = 0; i < map!.rgba.length; i += 4) {
    assert.equal(map!.rgba[i], map!.rgba[i + 1]);
    assert.equal(map!.rgba[i], map!.rgba[i + 2]);
    assert.equal(map!.rgba[i + 3], 255, 'map alpha is opaque');
  }
});

test('the base image is the UNTRANSFORMED SDR render (no PQ in the delivered pixels)', async () => {
  const src = testImage(32, 32);
  const { fn, calls } = recordingEncoder();
  await encodeGainMapJpeg(frameOf(src, 32, 32), { hdr: HDR, encodeJpeg: fn });
  assert.deepEqual(calls[0]!.rgba, src, 'the base encoder saw the source pixels unchanged');
});

test('negative control: different HDR targets produce different map bytes', async () => {
  const src = testImage(32, 32);
  const a = recordingEncoder();
  await encodeGainMapJpeg(frameOf(src, 32, 32), { hdr: { targets: ['#30ba78'] }, encodeJpeg: a.fn });
  const b = recordingEncoder();
  await encodeGainMapJpeg(frameOf(src, 32, 32), { hdr: { targets: ['#ff0000'] }, encodeJpeg: b.fn });
  assert.deepEqual(a.calls[0]!.rgba, b.calls[0]!.rgba, 'the SDR base does not depend on the HDR target');
  assert.notDeepEqual(a.calls[1]!.rgba, b.calls[1]!.rgba, 'the gain map does');
});

test('nothing to boost -> a plain SDR JPEG, not a gain map carrying no light', async () => {
  const flat = new Uint8ClampedArray(16 * 16 * 4).fill(128);
  for (let i = 3; i < flat.length; i += 4) flat[i] = 255;
  const notes: string[] = [];
  const { fn, calls } = recordingEncoder();
  const res = await encodeGainMapJpeg(frameOf(flat, 16, 16), {
    hdr: { targets: [], boostFloor: 0, richness: 0 },
    encodeJpeg: fn,
    log: (_l, m) => notes.push(m),
  });
  assert.equal(res.mapLength, 0, 'no gain map is attached');
  assert.equal(res.baseLength, res.bytes.length, 'the file IS the base image');
  assert.equal(calls.length, 1, 'the map was never even encoded');
  assert.ok(notes.some(n => /nothing to boost/.test(n)), 'the decision is logged, not silent');
  assert.equal(res.bytes[0], 0xff);
  assert.equal(res.bytes[1], 0xd8);
  assert.equal(res.bytes[res.bytes.length - 2], 0xff);
  assert.equal(res.bytes[res.bytes.length - 1], 0xd9);
});

test('the gain map really encodes log2(HDR/SDR): brighter targets declare more headroom', async () => {
  const src = testImage(32, 32);
  const capOf = (bytes: Uint8Array): number => {
    const { map } = splitFile(bytes);
    const packet = new TextDecoder().decode(
      jpegSegmentBody(map, findJpegSegment(map, 0xe1, JPEG_APP_IDS.XMP)!).subarray(JPEG_APP_IDS.XMP.length + 1));
    return Number(/hdrgm:HDRCapacityMax="([^"]*)"/.exec(packet)![1]);
  };
  const lo = await encodeGainMapJpeg(frameOf(src, 32, 32), { hdr: { ...HDR, peakNits: 400 }, encodeJpeg: recordingEncoder().fn });
  const hi = await encodeGainMapJpeg(frameOf(src, 32, 32), { hdr: { ...HDR, peakNits: 4000 }, encodeJpeg: recordingEncoder().fn });
  assert.ok(capOf(hi.bytes) > capOf(lo.bytes), 'a 4000-nit target declares more headroom than a 400-nit one');
  assert.ok(capOf(lo.bytes) >= 0, 'capacity is never negative');
});

test('imprint lands in the DELIVERED base pixels, and the map follows them', async () => {
  const src = testImage(256, 256);
  const marked = recordingEncoder();
  await encodeGainMapJpeg(frameOf(src, 256, 256), { hdr: HDR, encodeJpeg: marked.fn, imprint: true });
  const plain = recordingEncoder();
  await encodeGainMapJpeg(frameOf(src, 256, 256), { hdr: HDR, encodeJpeg: plain.fn });

  const withMark = detectWatermark(marked.calls[0]!.rgba, { width: 256, height: 256 });
  const without = detectWatermark(plain.calls[0]!.rgba, { width: 256, height: 256 });
  assert.equal(withMark.present, true, 'the base image carries the imprint');
  assert.equal(without.present, false, 'the unmarked control does not');
  assert.notDeepEqual(marked.calls[1]!.rgba, plain.calls[1]!.rgba, 'the map describes the MARKED image');
});

test('durable embed is best-effort and never breaks the export', async () => {
  const src = testImage(32, 32);
  const seen: number[] = [];
  const ok = recordingEncoder();
  await encodeGainMapJpeg(frameOf(src, 32, 32), {
    hdr: HDR, encodeJpeg: ok.fn,
    durable: async (rgba) => { seen.push(rgba.length); const out = Uint8ClampedArray.from(rgba); out[0] = 7; return out; },
  });
  assert.deepEqual(seen, [32 * 32 * 4], 'the durable hook saw the full frame once');
  assert.equal(ok.calls[0]!.rgba[0], 7, 'its output reached the encoded base');

  const boom = recordingEncoder();
  const res = await encodeGainMapJpeg(frameOf(src, 32, 32), {
    hdr: HDR, encodeJpeg: boom.fn,
    durable: async () => { throw new Error('model missing'); },
  });
  assert.ok(res.bytes.length > 0, 'a failing durable pass still produces the file');
  assert.deepEqual(boom.calls[0]!.rgba, src, 'and leaves the pixels alone');
});

test('DPI, EXIF and the sRGB profile are stamped on the BASE image', async () => {
  const res = await encodeGainMapJpeg(frameOf(testImage(16, 16), 16, 16), {
    hdr: HDR, encodeJpeg: recordingEncoder().fn,
    dpi: 300,
    meta: { software: 'Lolly', author: 'Test' } as never,
    icc: srgbIccProfile(),
  });
  const { primary, map } = splitFile(res.bytes);
  assert.ok(findJpegSegment(primary, 0xe1, JPEG_APP_IDS.EXIF), 'EXIF on the primary');
  assert.ok(findJpegSegment(primary, 0xe2, JPEG_APP_IDS.ICC), 'ICC on the primary');
  assert.equal(findJpegSegment(map, 0xe2, JPEG_APP_IDS.ICC), null, 'the gain map is data, not a picture - no profile');
  // MPF must come BEFORE the ICC chunks, or its offsets would be stale.
  const mpf = findJpegSegment(primary, 0xe2, 'MPF')!;
  const iccSeg = findJpegSegment(primary, 0xe2, JPEG_APP_IDS.ICC)!;
  assert.ok(mpf.end <= iccSeg.start, 'MPF precedes ICC');
});

test('byte-determinism across two runs, through the real sharp encoder', async () => {
  const src = testImage(24, 24);
  const a = await encodeGainMapJpeg(frameOf(src, 24, 24), { hdr: HDR });
  const b = await encodeGainMapJpeg(frameOf(src, 24, 24), { hdr: HDR });
  assert.deepEqual([...a.bytes], [...b.bytes]);
  assert.ok(a.mapLength > 0, 'this fixture really does attach a map');
});

test('depth: float is noted and satisfied; 16/auto say nothing', async () => {
  const src = testImage(16, 16);
  const notes: string[] = [];
  await encodeGainMapJpeg(frameOf(src, 16, 16), { hdr: HDR, encodeJpeg: recordingEncoder().fn, depth: 'float', log: (_l, m) => notes.push(m) });
  assert.ok(notes.some(n => /depth=float/.test(n)), 'the float request is answered explicitly');
  for (const depth of [16, 'auto', undefined] as const) {
    const quiet: string[] = [];
    await encodeGainMapJpeg(frameOf(src, 16, 16), {
      hdr: HDR, encodeJpeg: recordingEncoder().fn,
      ...(depth !== undefined ? { depth } : {}), log: (_l, m) => quiet.push(m),
    });
    assert.equal(quiet.some(n => /depth/.test(n)), false, `depth=${depth} is silent`);
  }
});

test('refusals: bad dimensions and a non-JPEG encoder throw', async () => {
  const src = testImage(16, 16);
  await assert.rejects(() => encodeGainMapJpeg(frameOf(src, 17, 16), { hdr: HDR, encodeJpeg: recordingEncoder().fn }), /samples for 17x16/);
  await assert.rejects(() => encodeGainMapJpeg(frameOf(new Uint8ClampedArray(0), 0, 0), { hdr: HDR, encodeJpeg: recordingEncoder().fn }), /expected 0/);
  await assert.rejects(
    () => encodeGainMapJpeg(frameOf(src, 16, 16), { hdr: HDR, encodeJpeg: async () => new Uint8Array([1, 2, 3, 4]) }),
    /base encoder did not return JPEG bytes/,
  );
  const baseOnly = await sharpJpegEncoder()(src, 16, 16, 'base');
  await assert.rejects(
    () => encodeGainMapJpeg(frameOf(src, 16, 16), {
      hdr: HDR,
      encodeJpeg: async (_r, _w, _h, kind) => (kind === 'base' ? baseOnly : new Uint8Array([0, 0])),
    }),
    /gain-map encoder did not return JPEG bytes/,
  );
});

test('sharp decodes the finished file to EXACTLY the base SDR image', async () => {
  // The single most important assertion for a gain-map file: a decoder that has
  // never heard of gain maps must see the ordinary SDR JPEG, pixel for pixel.
  const w = 64, h = 48;
  const src = testImage(w, h);
  const res = await encodeGainMapJpeg(frameOf(src, w, h), { hdr: HDR, icc: null });

  const reference = await sharpJpegEncoder()(src, w, h, 'base');
  const refPixels = await sharp(Buffer.from(reference)).raw().toBuffer();
  const outPixels = await sharp(Buffer.from(res.bytes)).raw().toBuffer();
  assert.deepEqual(new Uint8Array(outPixels), new Uint8Array(refPixels), 'the HDR file decodes to the plain SDR encode');

  const meta = await sharp(Buffer.from(res.bytes)).metadata();
  assert.equal(meta.width, w);
  assert.equal(meta.height, h);

  // The appended image is a real, decodable JPEG of the same size, and its
  // decoded pixels are grey (a single-channel gain map splayed across RGB).
  const { map } = splitFile(res.bytes);
  const mapMeta = await sharp(Buffer.from(map)).metadata();
  assert.equal(mapMeta.width, w);
  assert.equal(mapMeta.height, h);
  const mapPixels = new Uint8Array(await sharp(Buffer.from(map)).raw().toBuffer());
  let maxSpread = 0;
  for (let i = 0; i < mapPixels.length; i += 3) {
    maxSpread = Math.max(maxSpread, Math.abs(mapPixels[i]! - mapPixels[i + 1]!), Math.abs(mapPixels[i]! - mapPixels[i + 2]!));
  }
  assert.ok(maxSpread <= 4, `decoded gain map is neutral grey (max channel spread ${maxSpread})`);
  const min = Math.min(...mapPixels), max = Math.max(...mapPixels);
  assert.ok(max - min > 8, `the gain map carries structure (range ${min}..${max})`);
});

// ═══ the Node-only plumbing ══════════════════════════════════════════════════

test('decodeRgba round-trips a PNG back to the pixels it was made from', async () => {
  // This is how a Tier-B browser render becomes an HDR source: the web shell hands
  // over an ordinary SDR PNG and it is decoded here, straight-alpha, 4 channels.
  const src = testImage(20, 12);
  const png = await sharpDefault(Buffer.from(src.buffer, src.byteOffset, src.byteLength), {
    raw: { width: 20, height: 12, channels: 4 },
  }).png().toBuffer();
  const frame = await decodeRgba(new Uint8Array(png));
  assert.equal(frame.width, 20);
  assert.equal(frame.height, 12);
  assert.equal(frame.data.length, 20 * 12 * 4);
  assert.deepEqual(Array.from(frame.data), Array.from(src));
});

test('hdrBoostOptions maps the 0-100 author dials the way the EXR path does', () => {
  const plain = hdrBoostOptions({});
  assert.deepEqual(plain.targets, []);
  assert.equal(plain.peakNits, undefined, 'an unset dial falls through to the engine default');

  const tuned = hdrBoostOptions({ targets: ['#30ba78'], peakNits: 1600, reach: 60, lift: 0, richness: 50 });
  assert.deepEqual(tuned.targets, ['#30ba78']);
  assert.equal(tuned.peakNits, 1600);
  assert.equal(tuned.boostFloor, 0);
  assert.equal(tuned.richness, 0.5);
  // reach slides the OKLab lightness knee: 0.65 - 0.45 * 0.6 = 0.38, +/- 0.12.
  assert.ok(Math.abs(tuned.kneeLo! - 0.26) < 1e-9, `kneeLo ${tuned.kneeLo}`);
  assert.ok(Math.abs(tuned.kneeHi! - 0.5) < 1e-9, `kneeHi ${tuned.kneeHi}`);
});
