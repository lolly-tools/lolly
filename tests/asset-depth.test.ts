// SPDX-License-Identifier: MPL-2.0
/**
 * Catalog assets carry depth (plans/61-deeprichpixels.md section 10 item 6).
 *
 * Governing principle: depth follows provenance - never emit bits the pipeline
 * did not produce. A `depth` label on an asset format IS an emission, so this
 * covers the three ways it could lie:
 *
 *   1. `depthForFormat` (scripts/checksum-assets.ts) - the gate. It reuses the
 *      ingest sniff (`depthHint`, shells/web/src/lib/image-sample.ts), so a
 *      catalog label and a user upload can never disagree about the same bytes.
 *      Fixture layouts mirror shells/web/src/lib/image-sample.test.ts, which
 *      derives them from the specs (PNG 3rd ed section 11.2.1, TIFF 6.0 tag 258,
 *      ITU-T T.81 section B.2.2).
 *   2. The schema (schemas/asset.schema.json + its packages/core/schema copy).
 *   3. The drift guard - scripts/validate-catalog.ts re-sniffs every label
 *      through the SAME function. Asserted here as the invariant it enforces,
 *      run against the real active catalog, with a negative control that the
 *      invariant actually fails on a wrong label.
 *
 * Run: node --import ./tests/css-stub.mjs --test "tests/asset-depth.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

import { depthForFormat, localPathForUrl, sriForFile } from '../scripts/checksum-assets.ts';
import { DATA_TYPES, VISUAL_TYPES } from '../shells/web/src/lib/asset-kinds.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── fixture builders (same layouts as shells/web/src/lib/image-sample.test.ts) ──

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
const u32be = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
const u16be = (n: number): Uint8Array => Uint8Array.of((n >>> 8) & 0xff, n & 0xff);
const u16le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff);
const u32le = (n: number): Uint8Array => Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);

const PNG_SIG = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

/** PNG signature + IHDR carrying the given bit depth (byte 24 of the datastream). */
function pngHead(bitDepth: number): Uint8Array {
  const ihdrData = concat([u32be(1), u32be(1), Uint8Array.of(bitDepth, 0, 0, 0, 0)]);
  return concat([PNG_SIG, u32be(13), bytesOf('IHDR'), ihdrData, u32be(0)]);
}

/** Single-IFD TIFF declaring BitsPerSample (tag 258, SHORT); count ≤ 2 is inline. */
function tiffFile(le: boolean, bits: number, samples = 1): Uint8Array {
  const u16 = le ? u16le : u16be;
  const u32 = le ? u32le : u32be;
  const header = concat([le ? bytesOf('II') : bytesOf('MM'), u16(42), u32(8)]);
  const inline = samples <= 2;
  const valueField = inline ? concat([u16(bits), u16(0)]) : u32(26);
  const entry = concat([u16(258), u16(3), u32(samples), valueField]);
  const ifd = concat([u16(1), entry, u32(0)]);
  const tail = inline ? new Uint8Array(0) : concat(Array.from({ length: samples }, () => u16(bits)));
  return concat([header, ifd, tail]);
}

/** SOI + SOF0 with the given sample-precision byte. */
function jpegHead(precision: number): Uint8Array {
  const sof = Uint8Array.of(precision, 0, 1, 0, 1, 1, 0x11, 0, 0);
  return concat([
    Uint8Array.of(0xff, 0xd8),
    Uint8Array.of(0xff, 0xc0), u16be(2 + sof.length), sof,
  ]);
}

const webpFile = (): Uint8Array => {
  const body = concat([bytesOf('WEBP'), bytesOf('VP8 '), u32le(2), Uint8Array.of(0, 0)]);
  return concat([bytesOf('RIFF'), u32le(body.length), body]);
};

/** ISOBMFF ftyp box with the given major brand. */
const ftypFile = (major: string): Uint8Array =>
  concat([u32be(12 + 4), bytesOf('ftyp'), bytesOf(major), u32be(0), new Uint8Array(16)]);

// ── 1. the gate ───────────────────────────────────────────────────────────────

test('depthForFormat reads the container header for raster assets', async () => {
  assert.equal(await depthForFormat('raster', pngHead(16)), 16);
  assert.equal(await depthForFormat('raster', tiffFile(true, 16)), 16);
  assert.equal(await depthForFormat('raster', tiffFile(false, 16, 3)), 16);
  assert.equal(await depthForFormat('raster', jpegHead(12)), 12);
});

test('depthForFormat never invents depth: 8-bit files read 8 (negative control)', async () => {
  // The failure mode worth guarding: a label that reads "deep" for a file that
  // is not. Every ordinary catalog raster must land on 8, not 16.
  assert.equal(await depthForFormat('raster', pngHead(8)), 8);
  assert.equal(await depthForFormat('raster', jpegHead(8)), 8);
  assert.equal(await depthForFormat('raster', webpFile()), 8);
  assert.equal(await depthForFormat('raster', tiffFile(true, 8, 3)), 8);
});

test('depthForFormat answers null rather than guessing', async () => {
  // heic/avif are recognised but bury depth in codec config boxes.
  assert.equal(await depthForFormat('raster', ftypFile('heic')), null);
  assert.equal(await depthForFormat('raster', ftypFile('avif')), null);
  // Malformed / truncated / not an image at all.
  assert.equal(await depthForFormat('raster', pngHead(3)), null); // illegal PNG depth byte
  assert.equal(await depthForFormat('raster', new Uint8Array(0)), null);
  assert.equal(await depthForFormat('raster', bytesOf('<svg xmlns="http://www.w3.org/2000/svg"/>')), null);
});

test('depthForFormat is gated on type "raster" - no depth on non-raster assets', async () => {
  // Negative control for the gate itself: identical bytes, different declared
  // type. An SVG/video/font/palette has no bits-per-channel to report, and a
  // mislabelled row must not smuggle one in through its file.
  const deep = pngHead(16);
  for (const type of ['vector', 'video', 'audio', 'lottie', 'palette', 'tokens', 'font', 'profile', 'ratecard', undefined]) {
    assert.equal(await depthForFormat(type, deep), null, `type ${String(type)} must not carry depth`);
  }
  assert.equal(await depthForFormat('raster', deep), 16, 'control: the same bytes DO answer as a raster');
  // model (3-D GLB) and lut (.cube) carry a rendered PNG poster - a real raster with a
  // real depth - so their poster bytes answer too (plans/61 depth-follows-the-bytes).
  assert.equal(await depthForFormat('model', deep), 16, 'a model poster carries depth');
  assert.equal(await depthForFormat('lut', deep), 16, 'a lut poster carries depth');
});

// ── 2. the schema (both copies) ───────────────────────────────────────────────

const SCHEMA_COPIES = ['schemas/asset.schema.json', 'packages/core/schema/asset.schema.json'] as const;

// ── asset TYPE enum stays in sync across all FOUR copies ──────────────────────
// Two JSON schemas + AssetQuery.type + asset-kinds' DATA_TYPES/VISUAL_TYPES.
// 1.73 drifted here: AssetQuery.type never gained 'profile'. This is the guard
// that would have caught it, and it forces every future type into all four.

// Members that are intentionally in NEITHER kind set in asset-kinds.ts: audio is
// tiled by the deny-list (isPlaceableAsset true) yet has no image thumbnail, so it
// is neither VISUAL nor DATA. Any new "neither" member must be added to this set deliberately.
const KIND_EXEMPT = new Set(['audio']);

function schemaEnum(rel: string): string[] {
  const schema = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
  return schema.properties.type.enum;
}

function assetQueryTypes(): string[] {
  const src = readFileSync(join(ROOT, 'packages/core/src/host-v1/assets.ts'), 'utf8');
  const m = /interface AssetQuery \{\s*type\?:\s*([^;]+);/.exec(src);
  assert.ok(m, 'could not find AssetQuery.type union');
  return [...m![1]!.matchAll(/'([a-z]+)'/g)].map((x) => x[1]!);
}

test('the two asset schema copies declare the identical type enum', () => {
  assert.deepEqual(schemaEnum(SCHEMA_COPIES[0]), schemaEnum(SCHEMA_COPIES[1]));
});

test('AssetQuery.type matches the schema type enum exactly (catches the 1.73 profile drift)', () => {
  const schema = new Set(schemaEnum(SCHEMA_COPIES[0]));
  const query = new Set(assetQueryTypes());
  assert.deepEqual([...query].sort(), [...schema].sort(),
    'AssetQuery.type and the asset schema enum must list the same asset types');
});

test('every asset type is classified in asset-kinds (visual, data, or an explicit exemption)', () => {
  for (const t of schemaEnum(SCHEMA_COPIES[0])) {
    const classified = VISUAL_TYPES.has(t) || DATA_TYPES.has(t) || KIND_EXEMPT.has(t);
    assert.ok(classified, `asset type "${t}" is in no kind set and is not exempt - folder/catalog tiling would guess`);
  }
  // ratecard is engine data: it must be on the deny-list so nothing tiles it.
  assert.ok(DATA_TYPES.has('ratecard'), 'ratecard must be a DATA type (nothing to tile)');
});

test('both asset schema copies declare the optional depth field', () => {
  for (const rel of SCHEMA_COPIES) {
    const schema = JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
    const depth = schema.properties.formats.items.properties.depth;
    assert.ok(depth, `${rel} is missing formats.items.depth`);
    assert.equal(depth.type, 'integer');
    assert.ok(!schema.properties.formats.items.required?.includes('depth'), `${rel}: depth must stay optional`);
    assert.match(depth.description, /SNIFFED, NOT ASSERTED/i, `${rel}: the description must say it is sniffed, not asserted`);
  }
});

test('the schema accepts a depth-labelled asset and rejects a bogus one', () => {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(JSON.parse(readFileSync(join(ROOT, 'schemas/asset.schema.json'), 'utf8')));
  const asset = (depth: unknown) => ({
    id: 'demo/photo', type: 'raster', version: '1.0.0', tier: 'catalog',
    formats: [{ format: 'png@1x', url: '/catalog/assets/demo/photo.png', checksum: 'sha256-x', ...(depth === undefined ? {} : { depth }) }],
  });
  assert.ok(validate(asset(16)), JSON.stringify(validate.errors));
  assert.ok(validate(asset(undefined)), 'absent depth is legal - it means unknown');
  assert.ok(!validate(asset('16')), 'a string depth must be rejected');
  assert.ok(!validate(asset(16.5)), 'a fractional depth must be rejected');
  assert.ok(!validate(asset(0)), 'depth 0 must be rejected');
  assert.ok(!validate(asset(128)), 'an absurd depth must be rejected');
});

// ── 3. the drift guard ────────────────────────────────────────────────────────

test('validate-catalog re-sniffs through the same function the writer uses', () => {
  // If these two ever stop sharing depthForFormat, the guard becomes a second
  // implementation that can agree with a wrong label.
  const src = readFileSync(join(ROOT, 'scripts/validate-catalog.ts'), 'utf8');
  assert.match(src, /import \{ depthForFormat \} from '\.\/checksum-assets\.ts'/);
  assert.match(src, /depthForFormat\(asset\.type, bytes\)/);
});

test('importing checksum-assets.ts does not rewrite the index (the guard imports it)', async () => {
  const indexPath = join(ROOT, 'catalog/assets/index.json');
  const before = readFileSync(indexPath);
  const mod = await import('../scripts/checksum-assets.ts');
  assert.equal(typeof mod.depthForFormat, 'function');
  assert.deepEqual(readFileSync(indexPath), before, 'the module must be side-effect-free on import');
});

test('every depth in the active catalog matches a re-sniff of the real bytes', async () => {
  // The guard's invariant, executed against the shipped pack. Also the report:
  // a label present on a file whose header says otherwise, or missing from a
  // file whose header states one, is stale-index drift.
  const index = JSON.parse(readFileSync(join(ROOT, 'catalog/assets/index.json'), 'utf8'));
  let checked = 0, labelled = 0, rasterByExt = 0;
  for (const asset of index.assets) {
    for (const formats of [asset.formats, ...Object.values(asset.locales ?? {}) as unknown[][]]) {
      for (const fmt of (formats ?? []) as { format: string; url: string; depth?: number }[]) {
        const abs = localPathForUrl(fmt.url);
        if (!existsSync(abs)) continue;
        const sri = sriForFile(abs)!;
        const expected = await depthForFormat(asset.type, sri.bytes);
        assert.equal(fmt.depth ?? null, expected, `${asset.id} → ${fmt.format} depth drifted (run npm run build:catalog)`);
        checked++;
        if (expected != null) labelled++;
        // Counted by EXTENSION, independent of the sniffer, so a sniffer that
        // regresses to always-null cannot make this invariant silently vacuous.
        if (/\.(png|jpe?g|webp|avif|tiff?)$/i.test(fmt.url)) rasterByExt++;
      }
    }
  }
  assert.ok(checked > 0, 'expected the active catalog to have format files on disk');
  if (rasterByExt > 0) {
    assert.ok(labelled > 0,
      `catalog has ${rasterByExt} raster format files but ZERO depth labels - sniffer or builder regressed`);
  }
  console.log(`  checked ${checked} catalog format files, ${labelled} depth-labelled`);
});

test('the invariant actually fails on a wrong label (negative control)', async () => {
  // Without this, the test above passes just as happily against a guard that
  // never compares anything.
  const bytes = pngHead(8);
  const claimed = 16;
  const expected = await depthForFormat('raster', bytes);
  assert.equal(expected, 8);
  assert.notEqual(claimed, expected);
  assert.throws(() => assert.equal(claimed, expected));
  // ...and the same for a label on something that states no depth at all.
  assert.equal(await depthForFormat('raster', ftypFile('avif')), null);
  assert.throws(() => assert.equal(8, null));
});
