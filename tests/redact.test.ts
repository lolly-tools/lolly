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

const fileRef = (name: string, mime: string, bytes: Uint8Array): any =>
  ({ __file: true, name, mime, size: bytes.length, bytes, url: null });

// A model in the shape hooks receive: [{id, value}] for every declared input.
function modelFor(source: any, over: Record<string, any> = {}): any[] {
  const values: Record<string, any> = {
    source, bars: [], quantise: true, grayscale: false, svgVector: false, resign: false,
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
  assert.match(svgOn.coverageText, /will cover about \d+% of the frame\./);
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
  await hooks.exportFile({ model: modelFor(fs, { svgVector: true, bars: [{ page: 1, x: 20, y: 30, w: 50, h: 20 }] }), host: BARE_HOST });
  assert.deepEqual(Array.from(svg), beforeSvg);
});

// ─── exportFile: SVG vector mode (the only path that runs headless) ──────────

test('redact: SVG vector export removes metadata/comments/scripts and appends opaque bars', async () => {
  const hooks = loadHooks();
  const bars = [{ page: 1, x: 20, y: 30, w: 50, h: 20 }];
  const res = await hooks.exportFile({
    model: modelFor(fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)), { svgVector: true, bars }),
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
  // 24px grid (54 → 72, centred) → x 9, y 28, 72x24 — opaque black.
  assert.match(out, /<rect x="9" y="28" width="72" height="24" fill="#000000" fill-opacity="1"\/>/);
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
      model: modelFor(fileRef('t.svg', 'image/svg+xml', svgBytes(svg)), { svgVector: true, bars: [{ page: 1, x: 380, y: 280, w: 80, h: 40 }] }),
      host: BARE_HOST,
    });
    const out = new TextDecoder().decode(res.bytes);
    // 380..460 inflated 2px → 378..462 (w 84), quantised UP to 96, centred →
    // 372..468; y 280..320 → 278..322. Mapped 1:1 into the viewBox.
    assert.match(out, /<rect x="372" y="278" width="96" height="44" fill="#000000" fill-opacity="1"\/>/, size || '(no width/height)');
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
    model: modelFor(fileRef('mm.svg', 'image/svg+xml', svgBytes(svg)), { svgVector: true, bars: [{ page: 1, x: 380, y: 280, w: 80, h: 40 }] }),
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

test('redact: pdfPages extras carry per-page preview URLs in PDF points (data-URL fallback)', async () => {
  const hooks = loadHooks();
  const saved = (URL as any).createObjectURL;
  (URL as any).createObjectURL = undefined; // force the data: fallback (node shells without object URLs)
  try {
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
      assert.match(p.url, /^data:image\/svg\+xml;charset=utf-8,/);
      assert.match(decodeURIComponent(p.url), new RegExp(`page ${i + 1}`));
    }
  } finally {
    (URL as any).createObjectURL = saved;
  }
});

// Retirement is DEFERRED (~1.5s): the runtime's pre-hook emit repaints the old
// extras, so fresh <img> elements can still be loading the old blob URLs for a
// beat after a new file lands. The tests wait the delay out.
const RETIRE_WAIT_MS = 1700;
const settleRetire = () => new Promise((r) => setTimeout(r, RETIRE_WAIT_MS));

test('redact: page object URLs are retired (on a delay) when the file changes, and the guard tolerates a missing revoke', async () => {
  const hooks = loadHooks();
  const savedCreate = (URL as any).createObjectURL;
  const savedRevoke = (URL as any).revokeObjectURL;
  const revoked: string[] = [];
  let n = 0;
  (URL as any).createObjectURL = () => `blob:test-${++n}`;
  (URL as any).revokeObjectURL = (u: string) => { revoked.push(u); };
  try {
    const host = pdfHost({ pdf: { pages: async () => TWO_PAGES } });
    await hooks.onInit({ model: modelFor(fileRef('doc-a.pdf', 'application/pdf', PDF_SRC)), host });
    assert.equal(revoked.length, 0);
    // A new file identity retires the previous job's URLs — but NOT
    // immediately: the pre-hook repaint may still be loading them.
    await hooks.onInit({ model: modelFor(fileRef('doc-b.pdf', 'application/pdf', PDF_SRC)), host });
    assert.equal(revoked.length, 0, 'revocation is deferred past the repaint window');
    await settleRetire();
    assert.deepEqual(revoked, ['blob:test-1', 'blob:test-2']);
    // No revokeObjectURL at all: the guard must not throw.
    (URL as any).revokeObjectURL = undefined;
    const res = await hooks.onInit({ model: modelFor(fileRef('doc-c.pdf', 'application/pdf', PDF_SRC)), host });
    assert.equal(res.hasPdfPages, true);
    // Drain doc-c's own retire timer while the missing-revoke guard is still
    // in place, so it cannot fire into a later test's spy.
    await settleRetire();
  } finally {
    (URL as any).createObjectURL = savedCreate;
    (URL as any).revokeObjectURL = savedRevoke;
  }
});

test('redact: replacing a PDF with an image retires the page URLs instead of leaking them', async () => {
  const hooks = loadHooks();
  const savedCreate = (URL as any).createObjectURL;
  const savedRevoke = (URL as any).revokeObjectURL;
  const revoked: string[] = [];
  let n = 0;
  (URL as any).createObjectURL = () => `blob:leak-${++n}`;
  (URL as any).revokeObjectURL = (u: string) => { revoked.push(u); };
  try {
    const host = pdfHost({ pdf: { pages: async () => TWO_PAGES } });
    await hooks.onInit({ model: modelFor(fileRef('doc.pdf', 'application/pdf', PDF_SRC)), host });
    assert.equal(revoked.length, 0);
    // The replacement never enters the PDF branch — the reset must run anyway.
    await hooks.onInit({ model: modelFor(fileRef('photo.png', 'image/png', buildDirtyPng())), host });
    await settleRetire();
    assert.deepEqual(revoked, ['blob:leak-1', 'blob:leak-2']);
  } finally {
    (URL as any).createObjectURL = savedCreate;
    (URL as any).revokeObjectURL = savedRevoke;
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
  assert.deepEqual(roundTrip[0], { page: 1, x: 5, y: 5, w: 0, h: 0 });
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
  // The stage element carries the empty bars array plus the rail's preset map.
  assert.match(html, /class="rd-stage" data-bars="\[\]" data-presets="/);
  // No bars yet: the download button is really disabled, with guidance as label.
  assert.match(html, /<button type="button" class="rd-download" data-export-file disabled>Draw a bar over what should go first<\/button>/);
});

test('redact (e2e): exportFile through the runtime returns verified SVG bytes', async () => {
  const rt = await createRuntime(redactTool(), BARE_HOST, {
    source: fileRef('art.svg', 'image/svg+xml', svgBytes(DIRTY_SVG)),
    svgVector: true,
    bars: [{ page: 1, x: 20, y: 30, w: 50, h: 20 }],
  });
  const { bytes, mime, filename } = await rt.exportFile() as any;
  assert.equal(mime, 'image/svg+xml');
  assert.equal(filename, 'art-redacted.svg');
  const out = new TextDecoder().decode(bytes);
  assert.doesNotMatch(out, /<metadata|<script|hushtoken/);
  assert.match(out, /fill="#000000"/);
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

  await hooks.exportFile({ model: modelFor(src, { bars, quantise: false }), host });
  assert.deepEqual(seen[1].bars, bars, 'off means the bars cross the bridge untouched');
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
  const bars = [{ page: 1, x: Math.round(5 * S), y: Math.round(10 * S), w: Math.round(45 * S), h: Math.round(15 * S) }];
  const out = new TextDecoder().decode(
    (await hooks.exportFile({
      model: modelFor(fileRef('mm.svg', 'image/svg+xml', svgBytes(svg)), { bars, svgVector: true }),
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
