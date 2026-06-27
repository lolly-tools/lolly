/**
 * Compress PDF — the on-device PDF compressor utility, end-to-end.
 *
 * Drives the REAL on-disk tools/compress-pdf/{tool.json,hooks.js,template.html}
 * through the engine runtime against a pdf-capable host built from the web bridge's
 * real pdf.js (host.pdf.compress). node has no canvas, so the bridge does its
 * structural pass only (object-stream re-save) — image recompression is exercised
 * in the browser, not here — but the contract (shape, never-larger guarantee, page
 * preservation, settings flow, graceful degradation) is all checkable in node.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PDFDocument } from 'pdf-lib';

import { createRuntime } from '../engine/src/runtime.js';
import { buildInputModel } from '../engine/src/inputs.js';
import { parseUrlState, serializeUrlState } from '../engine/src/url-mode.js';
import { validateManifest } from '../engine/src/validate.js';
import { createPdfAPI, compressPdf } from '../shells/web/src/bridge/pdf.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const BARE_HOST = { version: '1', profile: { get: async () => ({}) }, log: () => {} };
const PDF_HOST = { ...BARE_HOST, pdf: createPdfAPI() };

function compressTool() {
  return {
    manifest: JSON.parse(readFileSync(join(ROOT, 'tools/compress-pdf/tool.json'), 'utf8')),
    hooksSource: readFileSync(join(ROOT, 'tools/compress-pdf/hooks.js'), 'utf8'),
    template: readFileSync(join(ROOT, 'tools/compress-pdf/template.html'), 'utf8'),
  };
}

const fileRef = (o) => ({ __file: true, url: null, ...o });
const pdfFile = (bytes, name = 'report.pdf') =>
  fileRef({ name, mime: 'application/pdf', size: bytes.length, bytes });

async function tinyPdf() {
  const d = await PDFDocument.create();
  d.addPage([200, 200]);
  d.setAuthor('Jane Doe');
  return d.save();
}

// A doc saved WITHOUT object streams + many pages — so the structural re-save
// (object streams, on by default) reliably shrinks it even with no canvas.
async function compressiblePdf(pages = 40) {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const p = d.addPage([300, 300]);
    p.drawText(`Page ${i} ` + 'lorem ipsum dolor sit amet '.repeat(4), { x: 10, y: 150, size: 8 });
  }
  return d.save({ useObjectStreams: false });
}

// ─── manifest ───────────────────────────────────────────────────────────────

test('compress-pdf: manifest validates and is wired as a no-sidebar exportFile utility', () => {
  const { manifest } = compressTool();
  const { valid, errors } = validateManifest(manifest);
  assert.equal(valid, true, JSON.stringify(errors));
  assert.equal(manifest.render.layout, 'canvas');     // no sidebar — file is the canvas
  assert.equal(manifest.render.export, false);        // no DOM-render export
  assert.equal(manifest.privacy, 'on-device');        // shows the no-upload badge
  assert.notEqual(manifest.status, 'experimental');   // never watermark a user's file
  assert.equal(manifest.hooks.exportFile, true);
  // Settings travel as ordinary declared inputs (so URL/CLI carry them), and avoid
  // the reserved 'dpi' id.
  const ids = manifest.inputs.map(i => i.id);
  assert.deepEqual(ids, ['source', 'level', 'grayscale']);
});

// ─── host.pdf.compress bridge ─────────────────────────────────────────────────

test('host.pdf.compress: returns the documented shape and never grows the input', async () => {
  const big = await compressiblePdf(60);
  const res = await compressPdf(big, { level: 'strong' });
  assert.ok(res.bytes instanceof Uint8Array);
  assert.equal(res.before, big.length);
  assert.equal(res.after, res.bytes.length);
  assert.ok(res.after <= res.before);                 // hard guarantee
  assert.ok(res.after < res.before);                  // object streams shrink this one
  assert.equal(res.images, 0);                        // node has no canvas → structural only

  const out = await PDFDocument.load(res.bytes, { updateMetadata: false });
  assert.equal(out.getPageCount(), 60);               // pages preserved
  assert.equal(out.getSubject(), 'Compressed with lolly.tools'); // neutral tool credit
  assert.equal(out.getProducer(), 'Lolly');
});

test('host.pdf.compress: a tiny already-optimised PDF is returned no larger', async () => {
  const tiny = await tinyPdf();
  const res = await compressPdf(tiny, { level: 'balanced' });
  assert.ok(res.after <= res.before);
  assert.equal((await PDFDocument.load(res.bytes, { updateMetadata: false })).getPageCount(), 1);
});

// ─── tool, end-to-end ─────────────────────────────────────────────────────────

test('compress-pdf: onInit shows the file, a before→after saving and the level control', async () => {
  const pdf = await compressiblePdf(40);
  const rt = await createRuntime(compressTool(), PDF_HOST, { source: pdfFile(pdf, 'report.pdf') });
  const html = rt.getHydrated();
  assert.match(html, /report\.pdf/);
  assert.match(html, /→/);                 // before → after line rendered
  assert.match(html, /smaller/);           // savings reported
  // The segmented control renders with Balanced checked by default.
  assert.match(html, /value="balanced" data-input-id="level"[^>]*\bchecked\b/);
  assert.doesNotMatch(html, /value="strong" data-input-id="level"[^>]*\bchecked\b/);
});

test('compress-pdf: exportFile returns a smaller, valid PDF with the page count preserved', async () => {
  const pdf = await compressiblePdf(40);
  const rt = await createRuntime(compressTool(), PDF_HOST, { source: pdfFile(pdf, 'report.pdf') });
  const { bytes, mime, filename } = await rt.exportFile();
  assert.equal(mime, 'application/pdf');
  assert.equal(filename, 'report-compressed.pdf');
  assert.ok(bytes.length <= pdf.length);
  assert.equal((await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount(), 40);
});

test('compress-pdf: a non-PDF file is reported as unsupported, and exportFile rejects', async () => {
  const notPdf = fileRef({ name: 'note.txt', mime: 'text/plain', size: 5, bytes: new Uint8Array([1, 2, 3, 4, 5]) });
  const rt = await createRuntime(compressTool(), PDF_HOST, { source: notPdf });
  assert.match(rt.getHydrated(), /doesn't look like a PDF/i);
  await assert.rejects(() => rt.exportFile(), /isn't a PDF/i);
});

test('compress-pdf: degrades gracefully when the host has no compress capability', async () => {
  const pdf = await tinyPdf();
  // host.pdf with analyze/strip but NO compress — an older shell.
  const legacy = { ...BARE_HOST, pdf: { analyze: async () => ({ findings: [] }), strip: async (b) => ({ bytes: b }) } };
  const rt = await createRuntime(compressTool(), legacy, { source: pdfFile(pdf) });
  assert.match(rt.getHydrated(), /isn't available/i);
  await assert.rejects(() => rt.exportFile(), /available/i);
});

// ─── settings: URL / CLI parity ────────────────────────────────────────────────

test('compress-pdf: the level setting round-trips through URL mode; the file never does', () => {
  const { manifest } = compressTool();
  const model = buildInputModel(manifest, {
    initial: { level: 'strong', source: fileRef({ name: 'x.pdf', mime: 'application/pdf', size: 3, bytes: new Uint8Array([1, 2, 3]) }) },
  });
  const qs = serializeUrlState(model);
  const params = new URLSearchParams(qs);
  assert.equal(params.get('level'), 'strong');   // a shared link reproduces the setting
  assert.equal(params.has('source'), false);     // binary user content is never serialised

  const { values } = parseUrlState('level=light', manifest);
  assert.equal(values.level, 'light');
});
