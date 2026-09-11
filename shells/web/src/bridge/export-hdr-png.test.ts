// SPDX-License-Identifier: MPL-2.0
/**
 * bridge/export-hdr-png.ts - HDR PNG at 16 bits per channel
 * (plans/61-deeprichpixels.md section 10 item 2, Phase B1 wiring).
 *
 * The seam under test is deliberately DOM-free - `Uint8ClampedArray` in, PNG
 * bytes out - so the whole HDR raster path is driven here with no canvas and no
 * jsdom. What is NOT covered: `renderRaster`'s canvas plumbing around it
 * (`getImageData` -> `encodeHdrPng16` -> Blob), which needs a real browser and
 * is the same browser-tier gap the rest of the export path carries.
 *
 * Everything asserted here is decoded back out of the produced file with
 * node:zlib + the engine's own `unfilterPng` (written years earlier for PDF
 * /Predictor embeds - genuinely independent of the encoder), never trusted from
 * the in-memory buffer.
 *
 * Run: node --test shells/web/src/bridge/export-hdr-png.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';

import { encodeHdrPng16 } from './export-hdr-png.ts';
import { unfilterPng } from '../../../../engine/src/png-unfilter.ts';
import { HDR_PQ_CICP } from '../../../../engine/src/hdr.ts';
import { detectWatermark } from '../../../../engine/src/pixel-watermark.ts';
import { attachC2paStore, extractC2paStore } from '@lolly/engine';

// ── tiny PNG reader (chunk walk + 16-bit sample decode) ──────────────────────

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

// ── inputs ──────────────────────────────────────────────────────────────────

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

/** No brand targets and no white target: the plain 203-nit anchor, nothing boosted. */
const NO_BOOST = { targets: [] as string[], includeWhite: false };

// ── the file it writes ──────────────────────────────────────────────────────

test('HDR PNG is a valid 16-bit RGBA file carrying cICP, pHYs, iTXt and iCCP', async () => {
  const icc = Uint8Array.from({ length: 128 }, (_, i) => i & 0xff);
  const png = await encodeHdrPng16(solid(8, 4, 200, 30, 40), {
    width: 8, height: 4, hdr: { targets: ['#00c1b4'] }, dpi: 300,
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

  // pHYs: the same ppm arithmetic the old splice path (insertPngPhys) used.
  const phys = first(cs, 'pHYs');
  assert.ok(phys, 'pHYs chunk present');
  assert.equal(u32(phys!.data, 0), Math.round(300 / 0.0254));
  assert.equal(u32(phys!.data, 4), Math.round(300 / 0.0254));
  assert.equal(phys!.data[8], 1); // unit: metre

  // iTXt provenance (via the shared insertPngMeta) + iCCP (via insertPngIcc).
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
  const png = await encodeHdrPng16(solid(8, 4, 10, 10, 10), { width: 8, height: 4, hdr: NO_BOOST });
  const cs = chunks(png);
  for (const t of ['pHYs', 'iTXt', 'iCCP']) assert.equal(first(cs, t), undefined, `${t} absent`);
  assert.ok(first(cs, 'cICP'), 'cICP is unconditional - it is the HDR signal');
});

// ── the signal it carries ───────────────────────────────────────────────────

test('203-nit diffuse white lands at PQ ~0.58 of full scale; black at 0', async () => {
  const px = solid(4, 2, 255, 255, 255);
  for (let i = 0; i < 4 * 4; i += 4) { px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; } // first row black
  const d = decode16(await encodeHdrPng16(px, { width: 4, height: 2, hdr: NO_BOOST }));

  // BT.2408 diffuse white = 203 nits; ST 2084 PQ(203/10000) = 0.5802.
  const white = d.samples[4 * 4]! / 65535;
  assert.ok(Math.abs(white - 0.5802) < 0.002, `white PQ signal ${white.toFixed(4)} should be ~0.5802`);
  // Neutral in, neutral out (Rec.709 -> Rec.2020 white is white).
  assert.equal(d.samples[4 * 4], d.samples[4 * 4 + 1]);
  assert.equal(d.samples[4 * 4], d.samples[4 * 4 + 2]);
  assert.equal(d.samples[4 * 4 + 3], 65535); // opaque alpha survives at 16 bits

  // Negative control on the range: 0 nits is PQ 0, not "some small number".
  assert.equal(d.samples[0], 0);
  assert.equal(d.samples[1], 0);
});

test('the brand boost is real: a matched colour lands materially above the unboosted encode', async () => {
  const px = solid(4, 4, 0, 193, 180); // SUSE-ish primary
  const plain = decode16(await encodeHdrPng16(px, { width: 4, height: 4, hdr: NO_BOOST }));
  const boosted = decode16(await encodeHdrPng16(px, { width: 4, height: 4, hdr: { targets: ['#00c1b4'] } }));
  const i = 1; // green channel of the first pixel
  assert.ok(boosted.samples[i]! > plain.samples[i]! + 2000, `boosted ${boosted.samples[i]} vs plain ${plain.samples[i]}`);
});

// ── the honesty claim: these are generated bits, not padding ─────────────────

test('the low byte carries generated signal - not a v*257 replication of 8 bits', async () => {
  // A full grey ramp: 256 distinct inputs, so any structure is the transform's.
  const w = 256, h = 1;
  const px = new Uint8ClampedArray(w * 4);
  for (let x = 0; x < w; x++) { px[x * 4] = x; px[x * 4 + 1] = x; px[x * 4 + 2] = x; px[x * 4 + 3] = 255; }
  const d = decode16(await encodeHdrPng16(px, { width: w, height: h, hdr: NO_BOOST }));

  // Padding (an 8-bit value widened to 16) is exactly v*257, i.e. divisible by
  // 257 with a low byte equal to the high byte. Assert the opposite, loudly.
  // (A padded buffer trips BOTH: v*257 is divisible by 257 and has low === high.
  // A padded buffer would still show many distinct low bytes, which is why the
  // divisibility/echo pair - not the low-byte variety alone - is the control.)
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
  // collapse to ONE 8-bit PQ code, and stay distinct at 16 bits.
  const a = d.samples[254 * 4]!, b = d.samples[255 * 4]!;
  assert.equal(Math.round((a / 65535) * 255), Math.round((b / 65535) * 255), 'sRGB 254/255 share an 8-bit PQ code');
  assert.ok(b - a > 20, `16-bit codes should stay apart, got ${a} and ${b}`);
});

test('two encodes of the same pixels are byte-identical (determinism)', async () => {
  const px = noisy(64, 64);
  const opts = { width: 64, height: 64, hdr: { targets: ['#00c1b4'] }, dpi: 300 } as const;
  const a = await encodeHdrPng16(px, { ...opts });
  const b = await encodeHdrPng16(px, { ...opts });
  assert.deepEqual([...a], [...b]);
  assert.ok(a.length > 100);
});

// ── depth= interaction (the plan forbids 8-bit PQ) ──────────────────────────

test('depth=8 is refused with a logged note and the file stays 16-bit', async () => {
  const notes: string[] = [];
  const png = await encodeHdrPng16(solid(8, 8, 120, 120, 120), {
    width: 8, height: 8, hdr: NO_BOOST, depth: 8, log: (_l, m) => notes.push(m),
  });
  assert.equal(decode16(png).depth, 16);
  assert.ok(notes.some(m => /depth=8 ignored/.test(m)), `expected a depth=8 note, got ${JSON.stringify(notes)}`);
});

test('depth=16 and depth=auto pass silently; depth=float is noted and satisfied at 16', async () => {
  for (const depth of [16, 'auto', undefined] as const) {
    const notes: string[] = [];
    const png = await encodeHdrPng16(solid(8, 8, 120, 120, 120), {
      width: 8, height: 8, hdr: NO_BOOST, ...(depth === undefined ? {} : { depth }), log: (_l, m) => notes.push(m),
    });
    assert.equal(decode16(png).depth, 16);
    assert.deepEqual(notes, [], `depth=${String(depth)} should log nothing`);
  }
  const notes: string[] = [];
  await encodeHdrPng16(solid(8, 8, 120, 120, 120), { width: 8, height: 8, hdr: NO_BOOST, depth: 'float', log: (_l, m) => notes.push(m) });
  assert.ok(notes.some(m => /depth=float/.test(m)));
});

// ── the pixel mark still lands, in the delivered (PQ) space ─────────────────

test('the imprint survives into the 16-bit file and reads back off the high bytes', async () => {
  const px = noisy(128, 128);
  const base = { width: 128, height: 128, hdr: { targets: ['#00c1b4'] } } as const;
  const marked = decode16(await encodeHdrPng16(px, { ...base, imprint: true }));
  const clean = decode16(await encodeHdrPng16(px, { ...base }));

  const hit = detectWatermark(highBytes(marked), { width: 128, height: 128 });
  const miss = detectWatermark(highBytes(clean), { width: 128, height: 128 });
  assert.equal(hit.present, true, `mark not detected in the 16-bit file (score ${hit.score})`);
  assert.equal(miss.present, false, `unmarked file reported a mark (score ${miss.score})`);

  // The mark is a small perturbation, not a re-encode: alpha untouched, and the
  // deep precision is still there (the low bytes did not become padding).
  let padded = 0;
  for (let i = 0; i < marked.samples.length; i += 4) {
    assert.equal(marked.samples[i + 3], clean.samples[i + 3]);
    if (marked.samples[i]! % 257 === 0) padded++;
  }
  assert.ok(padded < marked.samples.length / 32, `${padded} samples went 8-bit-shaped after marking`);
});

// ── C2PA compatibility (the stamper is a generic chunk walk) ────────────────

test('a 16-bit HDR PNG takes a C2PA store and still decodes', async () => {
  const png = await encodeHdrPng16(solid(16, 16, 90, 140, 200), { width: 16, height: 16, hdr: NO_BOOST, dpi: 300 });
  const store = Uint8Array.from({ length: 64 }, (_, i) => (i * 7) & 0xff);
  const stamped = attachC2paStore(png, 'png', store);
  const back = extractC2paStore(stamped);
  assert.ok(back, 'store extracted back out');
  assert.equal(back!.format, 'png');
  assert.deepEqual([...back!.store], [...store]);

  // The pixels are untouched by the stamp - decode the stamped file and compare.
  const before = decode16(png), after = decode16(stamped);
  assert.deepEqual([...after.samples], [...before.samples]);
  assert.equal(after.depth, 16);
  // caBX sits after IHDR, ahead of everything else we wrote.
  const cs = chunks(stamped);
  assert.equal(cs[1]!.type, 'caBX');
});

// ── the deflate ceiling (plan section 9b): big images REFUSE so the caller can fall
// back to the legacy 8-bit path - a stored 16-bit IDAT would ship a ~60 MB 4K
// file from an existing link, which is a regression, not an upgrade.

test('past the compressor ceiling the encode refuses (caller falls back to legacy)', async () => {
  // 64x64 RGBA16 = 32 KiB of scanlines; a 4 KiB cap forces the refusal.
  await assert.rejects(
    () => encodeHdrPng16(noisy(64, 64), { width: 64, height: 64, hdr: NO_BOOST, maxDeflateBytes: 4096 }),
    /size ceiling/,
  );
  // Under the cap the encode still works - the refusal is the ceiling, not a
  // general failure (negative control).
  const small = decode16(await encodeHdrPng16(noisy(64, 64), { width: 64, height: 64, hdr: NO_BOOST }));
  assert.equal(small.depth, 16);
  assert.equal(small.width, 64);
});
