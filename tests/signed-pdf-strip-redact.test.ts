// SPDX-License-Identifier: MPL-2.0
//
// Strip Hidden Data and Redact save a PDF again, so a digital signature the PDF
// already carries does not verify on the saved copy. Like Pages, each shows one
// line above its download button for a signed PDF and never stops the download.
// The findings list still lists the signature, without a second sentence about
// what saving does to the signature.
//
// Run with:
//   node --test tests/signed-pdf-strip-redact.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createPdfAPI } from '../shells/web/src/bridge/pdf.ts';
import { buildImagePdf } from '../shells/web/src/bridge/pdf-redact-core.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id: string): Promise<any> => loadTool(id, (path) => readFile(join(ROOT, 'community', path), 'utf8'));
const fixture = async (name: string): Promise<Uint8Array> => new Uint8Array(await readFile(join(ROOT, 'tests', 'fixtures', 'pages-signed', name)));
const fileRef = (bytes: Uint8Array, name: string, mime = 'application/pdf'): any => ({ __file: true, url: null, name, mime, size: bytes.length, bytes });
const ONE = 'This PDF is digitally signed: its signature will not verify on the saved copy, and the original file is not changed.';
const LINE = /<p class="[^"]*" data-signed-note>([^<]*)<strong>digitally signed<\/strong>([^<]*)<\/p>/g;
const TINY_JPEG = new Uint8Array(Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a'
  + 'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AN//Z', 'base64'));
const TINY_PNG = new Uint8Array(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'));

/** A host on the real PDF bridge that keeps what the hooks log. */
function host(logged: string[], pdf: any = createPdfAPI()): any {
  return {
    version: '1', profile: { get: async () => ({ useDetails: false }) },
    log: (level: string, message: string) => { if (level === 'warn') logged.push(message); },
    pdf,
  };
}
/** The real analysis, with a redaction that rebuilds the pages as pictures the way the web shell does. */
async function redactPdf(): Promise<any> {
  const rebuilt = await buildImagePdf([{ jpeg: TINY_JPEG, widthPt: 612, heightPt: 792 }]);
  const { pages: _none, ...pdf } = createPdfAPI() as any;
  return { ...pdf, redact: async () => ({ bytes: rebuilt, pages: 2 }) };
}
/** The panel's markup without the script that wires the panel. */
const panel = (runtime: any): string => runtime.getHydrated().replace(/<script>[\s\S]*$/, '');
const lines = (html: string): string[] => [...html.matchAll(LINE)].map((m) => `${m[1]}digitally signed${m[2]}`);
const BAR = [{ page: 1, x: 10, y: 10, w: 40, h: 12 }];

/** A signature field nobody has signed: /FT /Sig with no /V. */
async function emptySignatureField(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]);
  const field = doc.context.register(doc.context.obj({ FT: 'Sig', T: PDFString.of('approval') }));
  doc.catalog.set(PDFName.of('AcroForm'), doc.context.obj({ Fields: [field] }));
  return doc.save();
}

test('Strip Hidden Data: a signed PDF gets the line once, above the button, and still downloads', async () => {
  const tool = await load('strip-data');
  const logged: string[] = [];
  const signed = await fixture('signed.pdf');
  const runtime = await createRuntime(tool, host(logged), { source: fileRef(signed, 'contract.pdf') } as never);
  try {
    const html = panel(runtime);
    assert.deepEqual(lines(html), [ONE]);
    // Directly above the button, which is ready to press.
    const button = /data-signed-note>[^<]*<strong>digitally signed<\/strong>[^<]*<\/p>\s*<button type="button" class="btn btn--primary exif-download" data-export-file[^>]*>Download clean PDF/.exec(html);
    assert.ok(button, 'the line sits above the button');
    assert.doesNotMatch(button![0], /disabled/);
    // The list still lists the signature. What saving does to the signature is said once, by the line.
    assert.match(html, /<span class="exif-finding-label">Digital signature<\/span>\s*<span class="exif-finding-detail" title="1 signed field">1 signed field<\/span>/);
    assert.doesNotMatch(html, /invalidates/);
    assert.match(html, /\(A re-save isn't byte-for-byte\.\)|\(A re-save isn&#x27;t byte-for-byte\.\)/);
    assert.equal((html.match(/digitally signed/g) || []).length, 1, 'said once');
    const saved = await runtime.exportFile() as any;
    assert.equal(saved.filename, 'contract-clean.pdf');
    assert.ok(saved.bytes.length > 0);
    assert.notDeepEqual(saved.bytes, signed, 'the PDF was saved again');
    assert.deepEqual(logged, [ONE], 'the same sentence reaches the log once');
  } finally { runtime.destroy(); }
});

test('Strip Hidden Data: an unsigned PDF, an empty signature field and a picture get no line and no log', async () => {
  const tool = await load('strip-data');
  const cases: Array<[string, Uint8Array, string]> = [
    ['unsigned.pdf', await fixture('unsigned.pdf'), 'application/pdf'],
    ['form.pdf', await emptySignatureField(), 'application/pdf'],
    ['dot.png', TINY_PNG, 'image/png'],
  ];
  for (const [name, bytes, mime] of cases) {
    const logged: string[] = [];
    const runtime = await createRuntime(tool, host(logged), { source: fileRef(bytes, name, mime) } as never);
    try {
      const html = panel(runtime);
      assert.deepEqual(lines(html), [], name);
      assert.doesNotMatch(html, /digitally signed|data-signed-note/, name);
      // With no signed PDF loaded the general sentence under the button is the one statement.
      if (name === 'unsigned.pdf') assert.match(html, /invalidates any digital signature/);
      const saved = await runtime.exportFile() as any;
      assert.ok(saved.bytes.length > 0, name);
      assert.deepEqual(logged, [], name);
    } finally { runtime.destroy(); }
  }
});

test('Redact: a signed PDF gets the line once, above the button, and the saved copy has no signature', async () => {
  const tool = await load('redact');
  for (const bars of [[], BAR]) {
    const logged: string[] = [];
    const signed = await fixture('signed.pdf');
    const pdf = await redactPdf();
    const runtime = await createRuntime(tool, host(logged, pdf), { source: fileRef(signed, 'contract.pdf'), bars } as never);
    try {
      const html = panel(runtime);
      assert.deepEqual(lines(html), [ONE]);
      // Directly above the button. With no bar the button waits for one, as it does for any PDF.
      const button = /data-signed-note>[^<]*<strong>digitally signed<\/strong>[^<]*<\/p>\s*<button type="button" class="btn btn--primary rd-download" data-export-file[^>]*>/.exec(html);
      assert.ok(button, 'the line sits above the button');
      assert.equal(/disabled/.test(button![0]), bars.length === 0);
      assert.match(html, /<span class="rd-finding-label">Digital signature<\/span>\s*<span class="rd-finding-detail" title="1 signed field">1 signed field<\/span>/);
      assert.doesNotMatch(html, /invalidates/);
      assert.equal((html.match(/digitally signed/g) || []).length, 1, 'said once');
      // Every safety statement stays where it was.
      assert.match(html, /Re-read and checked before it downloads\. If a check fails, nothing downloads\./);
      if (!bars.length) continue;
      const saved = await runtime.exportFile() as any;
      assert.equal(saved.mime, 'application/pdf');
      const labels = (await createPdfAPI().analyze(saved.bytes)).findings.map((f) => f.label);
      assert.ok(!labels.includes('Digital signature'), 'the rebuilt PDF carries no signature');
      assert.deepEqual(logged, [ONE], 'the same sentence reaches the log once');
    } finally { runtime.destroy(); }
  }
});

test('Redact: an unsigned PDF, an empty signature field and a picture get no line and no log', async () => {
  const tool = await load('redact');
  const cases: Array<[string, Uint8Array, string]> = [
    ['unsigned.pdf', await fixture('unsigned.pdf'), 'application/pdf'],
    ['form.pdf', await emptySignatureField(), 'application/pdf'],
    ['dot.png', TINY_PNG, 'image/png'],
  ];
  for (const [name, bytes, mime] of cases) {
    const logged: string[] = [];
    const runtime = await createRuntime(tool, host(logged, await redactPdf()), { source: fileRef(bytes, name, mime), bars: BAR } as never);
    try {
      const html = panel(runtime);
      assert.deepEqual(lines(html), [], name);
      assert.doesNotMatch(html, /digitally signed|data-signed-note/, name);
      if (mime === 'application/pdf') {
        const saved = await runtime.exportFile() as any;
        assert.ok(saved.bytes.length > 0, name);
      }
      assert.deepEqual(logged, [], name);
    } finally { runtime.destroy(); }
  }
});

test('the three tools carry one shared sentence, and each line is read out once', async () => {
  const shared = await readFile(join(ROOT, 'community', '_shared', 'signed-pdf.js'), 'utf8');
  const region = /\/\/ === lolly:shared signedPdf[^\n]*\n([\s\S]*?)\/\/ === \/lolly:shared signedPdf ===/;
  const canonical = region.exec(shared)![1];
  for (const id of ['pages', 'strip-data', 'redact']) {
    const hooks = await readFile(join(ROOT, 'community', id, 'hooks.js'), 'utf8');
    assert.equal(region.exec(hooks)?.[1], canonical, `${id} carries the shared region`);
    assert.equal((hooks.match(/will not verify on the saved copy/g) || []).length, 2, `${id} has no sentence of its own`);
    const template = await readFile(join(ROOT, 'community', id, 'template.html'), 'utf8');
    // The visible line has no live role of its own, so a repaint does not read the sentence again.
    assert.doesNotMatch(template, /data-signed-note[^>]*role=|role="[^"]*"[^>]*data-signed-note/, id);
    assert.match(template, /SignedSaid\s*!==\s*signedWords/, id);
    assert.match(template, /said\.setAttribute\('role',\s*'status'\)/, id);
  }
});
