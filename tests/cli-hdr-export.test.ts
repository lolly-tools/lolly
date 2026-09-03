// SPDX-License-Identifier: MPL-2.0
/**
 * `--hdr=1` on the CLI, through the REAL mechanism (plans/183 WS5): `--export=png`
 * writes a 16-bit Rec.2100-PQ file, `--export=jpg` writes an ISO 21496-1 gain-map
 * file, both driven by `runToolCli` exactly as a terminal invocation would - jsdom,
 * createCliBridge, resvg for the pixels, `packages/node-shell/src/hdr.ts` for the
 * encode.
 *
 * Sibling of tests/cli-deep-export.test.ts and hermetic the same way: a
 * self-contained fixture repo with LOLLY_ROOT pinned BEFORE the dynamic import, so
 * the whole run chain resolves against the fixture regardless of the active content
 * profile.
 *
 * WHAT IS BEING CLAIMED, and how each claim is checked:
 *
 *   1. THE FLAG USED TO DO NOTHING. Before this workstream `--hdr=1 --export=png`
 *      wrote a plain 8-bit sRGB PNG with no cICP chunk, exit 0, no warning: Tier A
 *      never saw `hdr=` and the Tier-B URL builder never forwarded it. The negative
 *      control (`no --hdr`) pins the old output, so the two cases together say the
 *      flag changed the file rather than merely being accepted.
 *   2. THE FILE IS WHAT IT CLAIMS. Every assertion is decoded back out of the bytes
 *      on disk: a PNG chunk walk for the cICP/IHDR depth, a JPEG marker walk for
 *      the MPF/XMP/ISO segments, and sharp as an independent decoder for both.
 *   3. THE PORT DID NOT DRIFT. The last case runs the WEB shell's own
 *      `encodeHdrPng16` over the same pixels and asserts the two files are byte for
 *      byte the same. That is the contract plans/183 WS5 set: an HDR export is
 *      device-independent, so the terminal and the browser must agree exactly.
 *
 * C2PA rides the ordinary path, so a stamped credential is asserted on both files.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import sharp from 'sharp';
import { findJpegSegment, scanJpegSegments, JPEG_APP_IDS } from '../engine/src/jpeg-segments.ts';
import { ISO_GAINMAP_URN } from '../engine/src/gainmap-jpeg.ts';
import { extractC2paStore } from '../engine/src/c2pa-extract.ts';

// ─── self-contained fixture repo ────────────────────────────────────────────

const root = await mkdtemp(join(tmpdir(), 'lolly-hdr-export-'));
after(() => rm(root, { recursive: true, force: true }));

// A white block on black. White is what the HDR view transform's includeWhite
// default boosts, so there is real light for the PQ encode and the gain map to
// carry; black is the fixed point. 384x288 clears the Imprint's detection floor
// (MIN_IMPRINT_BLOCKS), so the default-on mark is genuinely exercised.
const W = 384, H = 288;
const SWATCH =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  `<rect width="${W}" height="${H}" fill="#000000"/>` +
  `<rect x="24" y="24" width="${W / 2}" height="${H / 2}" fill="{{fill}}"/>` +
  `<rect x="${W / 2}" y="${H / 2}" width="${W / 3}" height="${H / 3}" fill="#30ba78"/></svg>`;

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: 'swatch' }] }));
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
await mkdir(join(root, 'tools', 'swatch'), { recursive: true });
await writeFile(join(root, 'tools', 'swatch', 'tool.json'), JSON.stringify({
  id: 'swatch', name: 'swatch', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
  render: { width: W, height: H, formats: ['svg', 'png', 'jpg'] },
  inputs: [{ id: 'fill', type: 'color', label: 'Fill', default: '#ffffff' }],
}));
await writeFile(join(root, 'tools', 'swatch', 'template.html'), SWATCH);

process.env.LOLLY_ROOT = root;
const { runToolCli } = await import('../shells/cli/src/run.ts');

let seq = 0;
/** Run the REAL CLI entry point and read back what it wrote. */
async function cli(format: string, params: Record<string, string> = {}): Promise<Buffer> {
  const out = join(root, `out-${seq++}.${format}`);
  await runToolCli({ toolId: 'swatch', params, outputPath: out, format });
  return await readFile(out);
}

// ─── decoders (nothing is trusted from the encoder's own buffers) ────────────

interface Chunk { type: string; data: Uint8Array }

function pngChunks(png: Uint8Array): Chunk[] {
  const u32 = (o: number): number => ((png[o]! << 24) | (png[o + 1]! << 16) | (png[o + 2]! << 8) | png[o + 3]!) >>> 0;
  const out: Chunk[] = [];
  for (let i = 8; i + 8 <= png.length;) {
    const len = u32(i);
    const type = String.fromCharCode(png[i + 4]!, png[i + 5]!, png[i + 6]!, png[i + 7]!);
    out.push({ type, data: png.subarray(i + 8, i + 8 + len) });
    if (type === 'IEND') break;
    i += len + 12;
  }
  return out;
}

/** IHDR bit depth and colour type, read off the header rather than assumed. */
function pngHeader(png: Uint8Array): { width: number; height: number; depth: number; colorType: number } {
  const ihdr = pngChunks(png).find(c => c.type === 'IHDR')!.data;
  const u32 = (o: number): number => ((ihdr[o]! << 24) | (ihdr[o + 1]! << 16) | (ihdr[o + 2]! << 8) | ihdr[o + 3]!) >>> 0;
  return { width: u32(0), height: u32(4), depth: ihdr[8]!, colorType: ihdr[9]! };
}

function splitGainMapJpeg(file: Uint8Array): { primary: Uint8Array; map: Uint8Array } {
  const scan = scanJpegSegments(file);
  assert.ok(scan && scan.trailerStart !== null, 'the JPEG has a post-EOI trailer (the appended gain map)');
  return { primary: file.subarray(0, scan!.trailerStart!), map: file.subarray(scan!.trailerStart!) };
}

// ─── 1. the negative control: what the flag used to produce ──────────────────

test('without --hdr the CLI writes an ordinary 8-bit sRGB PNG (no cICP)', async () => {
  const png = await cli('png');
  const h = pngHeader(png);
  assert.deepEqual([h.width, h.height, h.depth, h.colorType], [W, H, 8, 6]);
  assert.equal(pngChunks(png).find(c => c.type === 'cICP'), undefined, 'no HDR signal without the flag');
});

// ─── 2. --hdr=1 --export=png: the 16-bit Rec.2100-PQ file ────────────────────

test('--hdr=1 --export=png writes a 16-bit PNG carrying cICP 9/16/0/1 and the PQ profile', async () => {
  const png = await cli('png', { hdr: '1' });
  const h = pngHeader(png);
  assert.deepEqual([h.width, h.height, h.depth, h.colorType], [W, H, 16, 6], 'RGBA at 16 bits per channel');

  const cs = pngChunks(png);
  const cicp = cs.find(c => c.type === 'cICP');
  assert.ok(cicp, 'cICP chunk present');
  assert.deepEqual([...cicp!.data], [9, 16, 0, 1], 'BT.2020 primaries, PQ transfer, full range');

  const iccp = cs.find(c => c.type === 'iCCP');
  assert.ok(iccp, 'iCCP chunk present');
  assert.ok(Buffer.from(iccp!.data).toString('latin1').startsWith('Rec2100 PQ\0'), 'the profile names Rec.2100 PQ');

  // Every ancillary before IDAT (the only ordering PNG imposes here), and the
  // Content Credential survived onto the file this shell wrote.
  const idatAt = cs.findIndex(c => c.type === 'IDAT');
  for (const t of ['cICP', 'iCCP']) assert.ok(cs.findIndex(c => c.type === t) < idatAt, `${t} before IDAT`);
  assert.ok(cs.some(c => c.type === 'caBX'), 'the C2PA store is stamped like any other CLI raster');

  // An independent decoder agrees: 16-bit samples, at the requested dimensions.
  const meta = await sharp(Buffer.from(png)).metadata();
  assert.equal(meta.width, W);
  assert.equal(meta.height, H);
  assert.equal((meta as { depth?: string }).depth, 'ushort');
});

test('--depth=8 does not downgrade an HDR PNG, and it is EXPLAINED, not silent', async () => {
  // 8-bit PQ is the banding defect this path replaced, so the request is answered
  // rather than obeyed - and an unheard explanation is the same as no explanation,
  // so the note has to reach the terminal.
  const said: string[] = [];
  const realWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string | Uint8Array, ...rest: unknown[]): boolean => {
    said.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
    return (realWrite as (...a: unknown[]) => boolean)(chunk, ...rest);
  }) as typeof process.stderr.write;
  try {
    assert.equal(pngHeader(await cli('png', { hdr: '1', depth: '8' })).depth, 16);
  } finally {
    process.stderr.write = realWrite;
  }
  assert.ok(said.some(l => /depth=8 ignored for an HDR export/.test(l)), `expected the depth=8 note, got ${JSON.stringify(said)}`);

  assert.equal(pngHeader(await cli('png', { hdr: '1', depth: '16' })).depth, 16, '--depth=16 is what this path produces anyway');
});

test('--depth=8 on an HDR JPEG opts OUT to the legacy path, exactly as the web shell gates it', async () => {
  // Web parity: unlike the PNG case there IS a coherent 8-bit answer for a JPEG (the
  // legacy PQ encode), and the web shell's renderRaster gates the gain-map path on
  // this same value. So it must leave the browser-free path rather than quietly
  // writing a gain map the caller opted out of - on this fixture (no built web shell)
  // that shows up as the Tier-B refusal.
  await assert.rejects(
    () => runToolCli({ toolId: 'swatch', params: { hdr: '1', depth: '8' }, outputPath: join(root, 'jpg8.jpg'), format: 'jpg' }),
    /No built web shell/,
  );
});

// ─── 3. --hdr=1 --export=jpg: the ISO 21496-1 gain-map file ──────────────────

// BROWSER-FREE BY CONSTRUCTION: the fixture repo has no `shells/web/dist`, so a run
// that reached Tier B would fail with "No built web shell at …". A plain `--export=jpg`
// on this fixture does exactly that (JPEG has no resvg path). This case passing is
// therefore also the proof that the HDR JPEG is written from the Tier-A resvg frame,
// with no Chromium anywhere in the path.
test('--hdr=1 --export=jpg writes a gain-map JPEG with MPF, XMP and ISO 21496-1', async () => {
  const jpg = await cli('jpg', { hdr: '1' });
  const { primary, map } = splitGainMapJpeg(jpg);

  assert.ok(findJpegSegment(primary, 0xe2, 'MPF'), 'primary carries the MPF index');
  assert.ok(findJpegSegment(primary, 0xe1, JPEG_APP_IDS.XMP), 'primary carries the container XMP');
  assert.ok(findJpegSegment(map, 0xe1, JPEG_APP_IDS.XMP), 'gain map carries the hdrgm XMP');
  assert.ok(findJpegSegment(map, 0xe2, ISO_GAINMAP_URN), 'gain map carries the ISO 21496-1 metadata');
  assert.ok(findJpegSegment(primary, 0xe2, JPEG_APP_IDS.ICC), 'the SDR base carries its own (sRGB) profile');
  assert.equal(findJpegSegment(map, 0xe2, JPEG_APP_IDS.ICC), null, 'the map is data, not a picture');

  // The credential is on the delivered file, not lost to the two-image assembly.
  const store = extractC2paStore(jpg);
  assert.ok(store, 'the C2PA store is stamped and readable back out');
  assert.equal(store!.format, 'jpeg');

  // A decoder that has never heard of gain maps sees an ordinary SDR JPEG.
  const meta = await sharp(Buffer.from(jpg)).metadata();
  assert.equal(meta.format, 'jpeg');
  assert.equal(meta.width, W);
  assert.equal(meta.height, H);

  // The appended image is a real JPEG of the same size, grey, and not a flat plate.
  const mapMeta = await sharp(Buffer.from(map)).metadata();
  assert.equal(mapMeta.width, W);
  assert.equal(mapMeta.height, H);
  const mapPixels = new Uint8Array(await sharp(Buffer.from(map)).raw().toBuffer());
  let spread = 0, min = 255, max = 0;
  for (let i = 0; i < mapPixels.length; i += 3) {
    spread = Math.max(spread, Math.abs(mapPixels[i]! - mapPixels[i + 1]!), Math.abs(mapPixels[i]! - mapPixels[i + 2]!));
    min = Math.min(min, mapPixels[i]!); max = Math.max(max, mapPixels[i]!);
  }
  assert.ok(spread <= 6, `the gain map decodes neutral grey (max channel spread ${spread})`);
  assert.ok(max - min > 8, `the gain map carries structure (range ${min}..${max})`);
});

test('a plain --export=jpg still needs the browser tier - the HDR one does not', async () => {
  // The negative control for the case above, and the sharpest statement of what
  // changed: on this fixture (no built web shell) an ordinary JPEG export cannot be
  // produced at all, while the HDR one is written browser-free from the same resvg
  // frame. If a later change routed the HDR JPEG through Tier B, the case above would
  // start failing with this same message.
  await assert.rejects(
    () => runToolCli({ toolId: 'swatch', params: {}, outputPath: join(root, 'plain.jpg'), format: 'jpg' }),
    /No built web shell/,
  );
});

// ─── 4. the refusal: HDR and a durable credential cannot both be produced here ─

test('--hdr with --durable refuses by name and leaves no file behind', async () => {
  const out = join(root, 'hdr-durable.png');
  await assert.rejects(
    () => runToolCli({ toolId: 'swatch', params: { hdr: '1', durable: '1' }, outputPath: out, format: 'png' }),
    (e: Error) => {
      assert.match(e.message, /--hdr and --durable cannot be combined/);
      assert.match(e.message, /neural TrustMark encoder/);
      assert.equal((e as { kind?: string }).kind, 'HDR_DURABLE_UNAVAILABLE');
      return true;
    },
  );
  assert.equal(existsSync(out), false, 'a refused export must leave no file behind');
});

// ─── 5. the port did not drift: same pixels, same bytes as the web shell ──────

test('the Node HDR PNG encoder is byte-identical to the web shell\'s', async () => {
  // The device-independence contract: an HDR export is the same file on every
  // shell. Both encoders are orchestration over the same engine calls, so a
  // reordering on either side has to fail here rather than ship two files.
  const [{ encodeHdrPng }, web, { pqBt2020IccProfile }] = await Promise.all([
    import('../packages/node-shell/src/hdr.ts'),
    import('../shells/web/src/bridge/export-hdr-png.ts'),
    import('../engine/src/color.ts'),
  ]);

  const w = 96, h = 64;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      px[i] = (x * 5) & 0xff; px[i + 1] = (y * 7) & 0xff; px[i + 2] = (x * y) & 0xff; px[i + 3] = 255;
    }
  }
  const shared = {
    hdr: { targets: ['#30ba78', '#00c1b4'] },
    dpi: 300,
    icc: pqBt2020IccProfile(),
    imprint: true,
    imprintStrength: 0.6,
    depth: 16 as const,
  };
  const node = await encodeHdrPng({ data: px, width: w, height: h }, { ...shared });
  const browser = await web.encodeHdrPng16(px, { width: w, height: h, ...shared });
  assert.deepEqual([...node], [...browser], 'the two shells wrote different bytes for the same frame');
});
