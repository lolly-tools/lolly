/**
 * Contract tests for the `file` input type + the transform output path
 * (host.export.file / the exportFile hook / runtime.exportFile) and the
 * on-device utility guarantees — the Phase-0 infra for content-transform tools.
 *
 * Also exercises the real EXIF & Metadata Stripper tool end-to-end: a crafted
 * JPEG (with GPS + camera EXIF) and PNG are run through the actual hooks.js to
 * prove the metadata is found and losslessly stripped.
 *
 * Run with: node --test tests/file-input.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildInputModel, updateInput } from '../engine/src/inputs.js';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.js';
import { validateManifest } from '../engine/src/validate.js';
import { createRuntime } from '../engine/src/runtime.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILE_MANIFEST = { inputs: [{ id: 'photo', type: 'file', accept: ['image/jpeg'] }] };
const fileRef = (over = {}) => ({ __file: true, name: 'a.jpg', mime: 'image/jpeg', size: 3, bytes: new Uint8Array([1, 2, 3]), url: null, ...over });

// ─── input model ──────────────────────────────────────────────────────────────

test('file input: default value is null, control is file-picker', () => {
  const [m] = buildInputModel(FILE_MANIFEST);
  assert.equal(m.value, null);
  assert.equal(m.control, 'file-picker');
  assert.equal(m.isDirty, false);
});

test('file input: a loaded FileRef in initial state is kept; an unresolved/junk ref is dropped to null', () => {
  const loaded = buildInputModel(FILE_MANIFEST, { initial: { photo: fileRef() } })[0];
  assert.equal(loaded.value.name, 'a.jpg');
  assert.ok(loaded.value.bytes instanceof Uint8Array);

  // A {__file, path} ref with no bytes (web-side stray URL param) → blank.
  const unresolved = buildInputModel(FILE_MANIFEST, { initial: { photo: { __file: true, path: './x.jpg', _unresolved: true } } })[0];
  assert.equal(unresolved.value, null);

  // A stray string → blank.
  const stray = buildInputModel(FILE_MANIFEST, { initial: { photo: 'whatever' } })[0];
  assert.equal(stray.value, null);
});

test('file input: constrain accepts a FileRef or null, rejects anything else', () => {
  const model = buildInputModel(FILE_MANIFEST, { initial: { photo: fileRef() } });
  // A new FileRef replaces it.
  const replaced = updateInput(model, 'photo', fileRef({ name: 'b.png' }));
  assert.equal(replaced[0].value.name, 'b.png');
  // null clears it.
  assert.equal(updateInput(model, 'photo', null)[0].value, null);
  // A garbage string is ignored — the prior value stays.
  assert.equal(updateInput(model, 'photo', 'nope')[0].value.name, 'a.jpg');
});

// ─── url-mode ─────────────────────────────────────────────────────────────────

test('url-mode: a file param parses to an unresolved path-ref (CLI loads the bytes)', () => {
  const { values } = parseUrlState('photo=./pic.jpg', FILE_MANIFEST);
  assert.deepEqual(values.photo, { __file: true, path: './pic.jpg', _unresolved: true });
});

test('url-mode: a file input is never serialised (binary has no URL form)', () => {
  const model = buildInputModel(FILE_MANIFEST, { initial: { photo: fileRef() } });
  const qs = serializeUrlState(model);
  assert.equal(new URLSearchParams(qs).has('photo'), false);
});

// ─── schema / validation ──────────────────────────────────────────────────────

test('validate: a file input + privacy:on-device + exportFile hook is well-formed', () => {
  const manifest = {
    id: 'util-x', name: 'U', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
    privacy: 'on-device',
    render: { width: 1, height: 1, formats: ['jpg'], export: false, actions: [] },
    hooks: { exportFile: true },
    inputs: [{ id: 'photo', type: 'file', accept: ['image/jpeg', '.png'], maxSize: 1000 }],
  };
  const { valid, errors } = validateManifest(manifest);
  assert.equal(valid, true, JSON.stringify(errors));
});

// ─── runtime.exportFile (transform output path) ────────────────────────────────

function toolWith({ manifest, hooksSource, template = '' }) {
  return { manifest, hooksSource, template };
}
const BARE_HOST = { version: '1', profile: { get: async () => ({}) }, log: () => {} };

test('runtime.exportFile: runs the exportFile hook and returns its bytes; hasExportFile reflects the manifest', async () => {
  const tool = toolWith({
    manifest: {
      id: 't', name: 'T', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 1, height: 1, formats: ['jpg'] },
      hooks: { exportFile: true },
      inputs: [{ id: 'photo', type: 'file' }],
    },
    hooksSource: `function exportFile({ model }) {
      const f = Object.fromEntries(model.map(i => [i.id, i.value])).photo;
      const out = f.bytes.map(b => b + 1);
      return { bytes: out, mime: 'image/jpeg', filename: 'out.jpg' };
    }`,
  });
  const rt = await createRuntime(tool, BARE_HOST, { photo: fileRef() });
  assert.equal(rt.hasExportFile, true);
  const res = await rt.exportFile();
  assert.deepEqual(Array.from(res.bytes), [2, 3, 4]);
  assert.equal(res.mime, 'image/jpeg');
  assert.equal(res.filename, 'out.jpg');
});

test('runtime.exportFile: a tool without the hook reports hasExportFile=false and throws if called', async () => {
  const tool = toolWith({
    manifest: {
      id: 't2', name: 'T2', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 1, height: 1, formats: ['png'] }, inputs: [],
    },
  });
  const rt = await createRuntime(tool, BARE_HOST, {});
  assert.equal(rt.hasExportFile, false);
  await assert.rejects(() => rt.exportFile(), /no exportFile hook/);
});

// ─── on-device: no provenance metadata, no watermark, even on the render path ──

test('runtime.export: on-device tools embed NO provenance metadata and never watermark', async () => {
  let captured = null;
  const host = {
    ...BARE_HOST,
    export: { render: async (_node, _fmt, opts) => { captured = opts; return new Blob(['x']); } },
  };
  const onDevice = {
    manifest: {
      id: 'od', name: 'OD', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      privacy: 'on-device', render: { width: 1, height: 1, formats: ['png'] }, inputs: [],
    },
    template: '<div></div>',
  };
  const rt = await createRuntime(onDevice, host, {});
  await rt.export({}, 'png', {});
  assert.equal(captured.meta, undefined, 'on-device output must carry no provenance metadata');
  assert.ok(!captured.watermark, 'on-device output must never be watermarked');

  // A normal (non-on-device) tool DOES get provenance assembled.
  const normal = {
    manifest: {
      id: 'nm', name: 'NM', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 1, height: 1, formats: ['png'] }, inputs: [],
    },
    template: '<div></div>',
  };
  const rt2 = await createRuntime(normal, host, {});
  await rt2.export({}, 'png', {});
  assert.ok(captured.meta && typeof captured.meta === 'object', 'normal tools still embed provenance');
});

// ─── EXIF & Metadata Stripper — real hooks, end-to-end ─────────────────────────

// Build a TIFF (little-endian) with IFD0 {Make, GPS-pointer} → GPS IFD with a
// known latitude/longitude, laid out at fixed offsets relative to the TIFF start.
function buildExifTiff() {
  const buf = new Uint8Array(148);
  const dv = new DataView(buf.buffer);
  const LE = true;
  const MAKE_OFF = 38, GPS_IFD = 46, LAT_OFF = 100, LON_OFF = 124;
  // Header
  buf[0] = 0x49; buf[1] = 0x49;            // "II"
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, 8, LE);                  // IFD0 at offset 8
  // IFD0: 2 entries
  dv.setUint16(8, 2, LE);
  const entry = (off, tag, type, count) => { dv.setUint16(off, tag, LE); dv.setUint16(off + 2, type, LE); dv.setUint32(off + 4, count, LE); };
  entry(10, 0x010F, 2, 8); dv.setUint32(18, MAKE_OFF, LE);          // Make → out-of-line
  entry(22, 0x8825, 4, 1); dv.setUint32(30, GPS_IFD, LE);          // GPS IFD pointer
  dv.setUint32(34, 0, LE);                                          // next IFD: none
  // Make string "TestCam\0"
  'TestCam'.split('').forEach((c, i) => { buf[MAKE_OFF + i] = c.charCodeAt(0); });
  // GPS IFD: 4 entries
  dv.setUint16(GPS_IFD, 4, LE);
  entry(48, 0x0001, 2, 2); buf[56] = 0x4E;                          // LatRef "N" (inline)
  entry(60, 0x0002, 5, 3); dv.setUint32(68, LAT_OFF, LE);          // Latitude → 3 rationals
  entry(72, 0x0003, 2, 2); buf[80] = 0x57;                          // LonRef "W" (inline)
  entry(84, 0x0004, 5, 3); dv.setUint32(92, LON_OFF, LE);          // Longitude → 3 rationals
  dv.setUint32(96, 0, LE);                                          // next IFD: none
  const rat = (off, n, d) => { dv.setUint32(off, n, LE); dv.setUint32(off + 4, d, LE); };
  rat(LAT_OFF, 37, 1); rat(LAT_OFF + 8, 48, 1); rat(LAT_OFF + 16, 30, 1);   // 37°48'30"N
  rat(LON_OFF, 122, 1); rat(LON_OFF + 8, 25, 1); rat(LON_OFF + 16, 0, 1);   // 122°25'00"W
  return buf;
}

function buildExifJpeg() {
  const tiff = buildExifTiff();
  const parts = [];
  parts.push(Uint8Array.from([0xFF, 0xD8]));                                  // SOI
  // APP0 JFIF (kept by the stripper)
  parts.push(Uint8Array.from([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]));
  // APP1 EXIF (stripped)
  const exifId = Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);       // "Exif\0\0"
  const segLen = 2 + exifId.length + tiff.length;
  const app1 = new Uint8Array(4 + exifId.length + tiff.length);
  app1[0] = 0xFF; app1[1] = 0xE1; app1[2] = (segLen >> 8) & 0xFF; app1[3] = segLen & 0xFF;
  app1.set(exifId, 4); app1.set(tiff, 4 + exifId.length);
  parts.push(app1);
  // SOS + a little scan data + EOI (all preserved verbatim)
  parts.push(Uint8Array.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xAA, 0xBB, 0xFF, 0xD9]));
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

function buildTextPng() {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  const chunk = (type, data) => {
    const out = new Uint8Array(12 + data.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, data.length);
    for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8);
    dv.setUint32(8 + data.length, 0); // CRC left zero — the stripper copies, never validates
    return out;
  };
  const parts = [Uint8Array.from(sig),
    chunk('IHDR', new Uint8Array(13)),
    chunk('tEXt', Uint8Array.from('Author\0Jane'.split('').map(c => c.charCodeAt(0)))),
    chunk('IDAT', Uint8Array.from([0, 1, 2, 3])),
    chunk('IEND', new Uint8Array(0))];
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// Synthesise a tool from the real on-disk exif-stripper files so the actual
// hook logic (analyze + strip) is what's under test.
function exifStripperTool() {
  return {
    manifest: JSON.parse(readFileSync(join(ROOT, 'tools/exif-stripper/tool.json'), 'utf8')),
    hooksSource: readFileSync(join(ROOT, 'tools/exif-stripper/hooks.js'), 'utf8'),
    template: readFileSync(join(ROOT, 'tools/exif-stripper/template.html'), 'utf8'),
  };
}

test('exif-stripper: finds GPS coordinates + camera in a JPEG (onInit analysis)', async () => {
  const jpeg = buildExifJpeg();
  const rt = await createRuntime(exifStripperTool(), BARE_HOST, {
    source: fileRef({ name: 'beach.jpg', mime: 'image/jpeg', size: jpeg.length, bytes: jpeg }),
  });
  const html = rt.getHydrated();
  assert.match(html, /GPS location/);
  assert.match(html, /37\.80833, -122\.41667/);   // decoded from the crafted EXIF GPS IFD
  assert.match(html, /TestCam/);                    // camera/device finding
});

test('strip-data: a Show-details toggle is present and defaults to OFF (collapsed)', async () => {
  const jpeg = buildExifJpeg();
  const rt = await createRuntime(exifStripperTool(), BARE_HOST, {
    source: fileRef({ name: 'beach.jpg', mime: 'image/jpeg', size: jpeg.length, bytes: jpeg }),
  });
  const html = rt.getHydrated();
  // The toggle exists as a real (keyboard-reachable) checkbox, labelled "Show details".
  assert.match(html, /id="exif-show-details"/);
  assert.match(html, /Show details/);
  // It defaults OFF: the checkbox carries no `checked`, so the CSS keeps the
  // .exif-finding-detail values hidden until the user toggles it on.
  assert.doesNotMatch(html, /id="exif-show-details"[^>]*\bchecked\b/);
  assert.match(html, /class="exif-finding-detail"/);
});

test('exif-stripper: strips APP1/EXIF from a JPEG losslessly (keeps APP0 + scan data)', async () => {
  const jpeg = buildExifJpeg();
  const rt = await createRuntime(exifStripperTool(), BARE_HOST, {
    source: fileRef({ name: 'beach.jpg', mime: 'image/jpeg', size: jpeg.length, bytes: jpeg }),
  });
  const { bytes, filename, mime } = await rt.exportFile();
  assert.equal(mime, 'image/jpeg');
  assert.equal(filename, 'beach-clean.jpg');
  // SOI preserved, APP0 (FFE0) kept right after it, EOI preserved.
  assert.equal(bytes[0], 0xFF); assert.equal(bytes[1], 0xD8);
  assert.equal(bytes[2], 0xFF); assert.equal(bytes[3], 0xE0);
  assert.equal(bytes[bytes.length - 2], 0xFF); assert.equal(bytes[bytes.length - 1], 0xD9);
  // The "Exif" marker is gone, and the result is smaller than the original.
  const hasExif = (b) => { for (let i = 0; i < b.length - 4; i++) if (b[i] === 0x45 && b[i + 1] === 0x78 && b[i + 2] === 0x69 && b[i + 3] === 0x66) return true; return false; };
  assert.equal(hasExif(jpeg), true);
  assert.equal(hasExif(bytes), false);
  assert.ok(bytes.length < jpeg.length);
  // The preserved scan data (AA BB) is still present — pixels untouched.
  assert.ok((() => { for (let i = 0; i < bytes.length - 1; i++) if (bytes[i] === 0xAA && bytes[i + 1] === 0xBB) return true; return false; })());
});

test('exif-stripper: removes tEXt chunks from a PNG, keeps IHDR/IDAT/IEND', async () => {
  const png = buildTextPng();
  const rt = await createRuntime(exifStripperTool(), BARE_HOST, {
    source: fileRef({ name: 'art.png', mime: 'image/png', size: png.length, bytes: png }),
  });
  const html = rt.getHydrated();
  assert.match(html, /Text chunks/);

  const { bytes, filename } = await rt.exportFile();
  assert.equal(filename, 'art-clean.png');
  const typeAt = (b, type) => { for (let i = 8; i < b.length - 8; i++) { if (String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]) === type) return true; } return false; };
  assert.equal(typeAt(bytes, 'tEXt'), false);
  assert.equal(typeAt(bytes, 'IHDR'), true);
  assert.equal(typeAt(bytes, 'IDAT'), true);
  assert.equal(typeAt(bytes, 'IEND'), true);
  assert.ok(bytes.length < png.length);
});

// ─── Strip Data from Images: SVG — real hooks, end-to-end ──────────────────────
// The converged tool (exifStripperTool) now also cleans SVG, so these drive the
// same on-disk tool as the JPEG/PNG cases above.

// An Illustrator/Inkscape-style SVG carrying every kind of cruft the cleaner reports.
const DIRTY_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generator: Adobe Illustrator 27.0.0, SVG Export Plug-In . SVG Version: 6.00 -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:cc="http://creativecommons.org/ns#"
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.0.dtd"
  xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  inkscape:version="1.1 (c68e22c387)" sodipodi:docname="secret-logo.ai" viewBox="0 0 10 10">
  <metadata><rdf:RDF><cc:Work><dc:creator><dc:title>Jane Doe</dc:title></dc:creator></cc:Work></rdf:RDF></metadata>
  <sodipodi:namedview inkscape:zoom="2.4"/>
  <title>Confidential Logo</title>
  <rect width="10" height="10" fill="#30ba78" data-name="bg" inkscape:label="layer1"/>
</svg>`;

const svgFile = (text, name = 'logo.svg') => {
  const bytes = new TextEncoder().encode(text);
  return fileRef({ name, mime: 'image/svg+xml', size: bytes.length, bytes });
};

test('strip-data (svg): reports editor, author, original filename + title (onInit analysis)', async () => {
  const rt = await createRuntime(exifStripperTool(), BARE_HOST, { source: svgFile(DIRTY_SVG) });
  const html = rt.getHydrated();
  assert.match(html, /Created with/);
  assert.match(html, /Adobe Illustrator 27\.0\.0/);   // generator, with the "SVG Export" tail trimmed
  assert.match(html, /Original filename/);
  assert.match(html, /secret-logo\.ai/);
  assert.match(html, /Author/);
  assert.match(html, /Jane Doe/);                       // dug out of the RDF metadata block
  assert.match(html, /Confidential Logo/);              // <title> reported
});

test('strip-data (svg): strips metadata/comments/editor cruft, keeps the artwork', async () => {
  const rt = await createRuntime(exifStripperTool(), BARE_HOST, { source: svgFile(DIRTY_SVG) });
  const { bytes, filename, mime } = await rt.exportFile();
  assert.equal(mime, 'image/svg+xml');
  assert.equal(filename, 'logo-clean.svg');
  const out = new TextDecoder().decode(bytes);
  // Cruft is gone.
  assert.doesNotMatch(out, /Generator|Illustrator/);
  assert.doesNotMatch(out, /<metadata|Jane Doe/);
  assert.doesNotMatch(out, /sodipodi:|inkscape:|data-name|xmlns:dc/);
  // Artwork + meaningful structure preserved.
  assert.match(out, /<rect width="10" height="10" fill="#30ba78"\/?>/);
  assert.match(out, /<title>Confidential Logo<\/title>/);
  assert.match(out, /viewBox="0 0 10 10"/);
  assert.ok(bytes.length < new TextEncoder().encode(DIRTY_SVG).length);
});

test('strip-data (svg): a non-SVG file is reported as such and handed back untouched', async () => {
  const original = svgFile('this is not markup at all', 'notes.txt');
  const rt = await createRuntime(exifStripperTool(), BARE_HOST, { source: original });
  assert.match(rt.getHydrated(), /doesn't look like a supported image/);
  const { bytes } = await rt.exportFile();
  assert.deepEqual(Array.from(bytes), Array.from(original.bytes)); // byte-for-byte passthrough
});
