// SPDX-License-Identifier: MPL-2.0
//
// A PDF loaded into Pages may already carry a digital signature. Every operation saves
// the PDF again, so that signature does not verify on the saved copy. Pages says so in
// one line above the download button and never stops the download.
//
// Run with:
//   node --test tests/pages-signed-pdf.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createPdfAPI } from '../shells/web/src/bridge/pdf.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id: string): Promise<any> => loadTool(id, (path) => readFile(join(ROOT, 'community', path), 'utf8'));
const fixture = async (name: string): Promise<Uint8Array> => new Uint8Array(await readFile(join(ROOT, 'tests', 'fixtures', 'pages-signed', name)));
const fileRef = (bytes: Uint8Array, name: string): any => ({ __file: true, url: null, name, mime: 'application/pdf', size: bytes.length, bytes });
const ONE = 'This PDF is digitally signed: its signature will not verify on the saved copy, and the original file is not changed.';
// Muted ink, with only the two words "digitally signed" in the alert ink.
const LINE = /<p class="save-note save-note--signed" data-signed-note>([^<]*)<strong>digitally signed<\/strong>([^<]*)<\/p>/g;

/** A host on the real PDF bridge that keeps what the hooks log. */
function host(logged: string[], pdf: any = createPdfAPI()): any {
  return {
    version: '1', profile: { get: async () => ({ useDetails: false }) },
    log: (level: string, message: string) => { if (level === 'warn') logged.push(message); },
    pdf,
  };
}
/** The panel's markup without the script that wires the panel. */
const panel = (runtime: any): string => runtime.getHydrated().replace(/<script>[\s\S]*$/, '');
const lines = (html: string): string[] => [...html.matchAll(LINE)].map((m) => `${m[1]}digitally signed${m[2]}`);

/** A signature field nobody has signed: /FT /Sig with no /V. */
async function emptySignatureField(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([300, 300]);
  const field = doc.context.register(doc.context.obj({ FT: 'Sig', T: PDFString.of('approval') }));
  doc.catalog.set(PDFName.of('AcroForm'), doc.context.obj({ Fields: [field] }));
  return doc.save();
}

test('the analysis reports a filled signature, and neither an unsigned PDF nor an empty signature field', async () => {
  const pdf = createPdfAPI();
  const labels = async (bytes: Uint8Array): Promise<string[]> => (await pdf.analyze(bytes)).findings.map((f) => f.label);
  assert.ok((await labels(await fixture('signed.pdf'))).includes('Digital signature'));
  assert.ok(!(await labels(await fixture('unsigned.pdf'))).includes('Digital signature'));
  assert.ok(!(await labels(await emptySignatureField())).includes('Digital signature'));
});

test('a page operation on a signed PDF says so once, above the button, and still downloads', async () => {
  const tool = await load('pages');
  for (const operation of ['reorder', 'rotate', 'extract', 'delete', 'split']) {
    const logged: string[] = [];
    const runtime = await createRuntime(tool, host(logged), { operation, pages: operation === 'reorder' ? '2,1' : '1', source: [fileRef(await fixture('signed.pdf'), 'contract.pdf')] } as never);
    try {
      const html = panel(runtime);
      assert.deepEqual(lines(html), [ONE], operation);
      // Directly above the button, which is ready to press.
      const button = /data-signed-note>[^<]*<strong>digitally signed<\/strong>[^<]*<\/p><button type="button" class="btn btn--primary" data-export-file[^>]*>/.exec(html);
      assert.ok(button, `${operation}: the line sits above the button`);
      assert.doesNotMatch(button![0], /disabled/, `${operation}: the button is ready`);
      // The point is made once: the list of changes no longer repeats what happens to the signature.
      assert.equal((html.match(/digital/gi) || []).length, 1, operation);
      const saved = await runtime.exportFile() as any;
      const first = Array.isArray(saved) ? saved[0] : saved;
      assert.ok(first.bytes.length > 0, `${operation}: a file is saved`);
      assert.notDeepEqual(first.bytes, await fixture('signed.pdf'), `${operation}: the PDF was saved again`);
      assert.deepEqual(logged, [ONE], `${operation}: the same sentence reaches the log once`);
    } finally { runtime.destroy(); }
  }
});

test('an unsigned PDF and an empty signature field get no line and no log', async () => {
  const tool = await load('pages');
  for (const [name, bytes] of [['unsigned.pdf', await fixture('unsigned.pdf')], ['form.pdf', await emptySignatureField()]] as const) {
    for (const operation of ['rotate', 'compress']) {
      const logged: string[] = [];
      const runtime = await createRuntime(tool, host(logged), { operation, pages: '1', source: [fileRef(bytes, name)] } as never);
      try {
        const html = panel(runtime);
        assert.deepEqual(lines(html), [], `${name} ${operation}`);
        assert.doesNotMatch(html, /digitally signed/);
        await runtime.exportFile();
        assert.deepEqual(logged, []);
      } finally { runtime.destroy(); }
    }
  }
});

test('with several files loaded the line gives the signed file by name', async () => {
  const tool = await load('pages');
  const signed = await fixture('signed.pdf'), plain = await fixture('unsigned.pdf');
  const runtime = await createRuntime(tool, host([]), { operation: 'reorder', pages: '1-', source: [fileRef(plain, 'cover.pdf'), fileRef(signed, 'contract.pdf')] } as never);
  try {
    assert.deepEqual(lines(panel(runtime)), ['contract.pdf is digitally signed: its signature will not verify on the saved copy, and the original file is not changed.']);
  } finally { runtime.destroy(); }
  // Two signed files (the same signed bytes under two names) are both given.
  const both = await createRuntime(tool, host([]), { operation: 'reorder', pages: '1-', source: [fileRef(signed, 'a.pdf'), fileRef(signed.slice(), 'b.pdf')] } as never);
  try {
    assert.deepEqual(lines(panel(both)), ['a.pdf and b.pdf are digitally signed: their signatures will not verify on the saved copy, and the original files are not changed.']);
  } finally { both.destroy(); }
  // Compress works on the first PDF only, so a signed file further down the list is not saved again.
  const second = await createRuntime(tool, host([]), { operation: 'compress', source: [fileRef(plain, 'cover.pdf'), fileRef(signed, 'contract.pdf')] } as never);
  try { assert.deepEqual(lines(panel(second)), []); } finally { second.destroy(); }
});

test('in Compress the line takes the place of the general sentence about a signature', async () => {
  const tool = await load('pages');
  const logged: string[] = [];
  const signed = await fixture('signed.pdf');
  const runtime = await createRuntime(tool, host(logged), { operation: 'compress', source: [fileRef(signed, 'contract.pdf')] } as never);
  try {
    const html = panel(runtime);
    assert.deepEqual(lines(html), [ONE]);
    assert.match(html, /data-signed-note>[^<]*<strong>digitally signed<\/strong>[^<]*<\/p>\s*<button type="button" class="btn btn--primary" data-export-file data-busy-label="Compressing…">Download compressed PDF<\/button>\s*<p class="save-note">Only images are recompressed\.<\/p>/);
    assert.doesNotMatch(html, /stops being valid/);
    // Said once on the panel. The Action help tip, closed until asked for, still explains Compress in general.
    const shown = html.replace(/<span class="help-tip-pop"[\s\S]*?<\/span>/, '');
    assert.equal((shown.match(/digital/gi) || []).length, 1, 'said once');
    const saved = await runtime.exportFile() as any;
    assert.equal(saved.filename, 'contract-compressed.pdf');
    assert.ok(saved.bytes.length < signed.length);
    assert.deepEqual(logged, [ONE]);
  } finally { runtime.destroy(); }
});

test('a signed PDF that Compress hands back as it was gets no line: its signature still verifies', async () => {
  const tool = await load('pages');
  const signed = await fixture('signed.pdf');
  const logged: string[] = [];
  const pdf = { ...createPdfAPI(), compress: async (bytes: Uint8Array) => ({ bytes, before: bytes.length, after: bytes.length, images: 0 }) };
  const runtime = await createRuntime(tool, host(logged, pdf), { operation: 'compress', source: [fileRef(signed, 'contract.pdf')] } as never);
  try {
    const html = panel(runtime);
    assert.deepEqual(lines(html), []);
    assert.match(html, /Already well optimised/);
    assert.match(html, /<p class="save-note">Only images are recompressed\.<\/p>/);
    const saved = await runtime.exportFile() as any;
    assert.deepEqual(saved.bytes, signed);
    assert.deepEqual(logged, []);
  } finally { runtime.destroy(); }
});

test('in Sign the line shows above the button and the sentence about a visible signature stays', async () => {
  const tool = await load('pages');
  const logged: string[] = [];
  const pdf = {
    ...createPdfAPI(),
    pages: async (_bytes: Uint8Array, opts: any) => ({ pages: [{ page: opts?.pageNumbers?.[0] ?? 1, widthPt: 612, heightPt: 792, svg: '<svg viewBox="0 0 612 792" />' }], totalPages: 2 }),
    stamp: async (_bytes: Uint8Array, opts: any) => ({ bytes: new Uint8Array([9]), pages: 2, stamps: opts.images.length + (opts.texts?.length ?? 0) }),
  };
  const raster = {
    decode: async () => ({ width: 600, height: 180, close: () => {} }),
    encode: async () => ({ bytes: new Uint8Array([137, 80, 78, 71]), mime: 'image/png', width: 600, height: 180 }),
  };
  const values = { operation: 'sign', seal: false, signatureInk: 'M10,10L90,60', source: [fileRef(await fixture('signed.pdf'), 'contract.pdf')] };
  const runtime = await createRuntime(tool, { ...host(logged, pdf), raster }, values as never);
  try {
    const html = panel(runtime);
    assert.deepEqual(lines(html), [ONE]);
    const button = /data-signed-note>[^<]*<strong>digitally signed<\/strong>[^<]*<\/p><button type="button" class="btn btn--primary" data-export-file[^>]*>Download signed PDF/.exec(html);
    assert.ok(button, 'the line sits above the button');
    assert.doesNotMatch(button![0], /disabled/);
    assert.match(html, /<p class="save-note">This is a visible signature, not an identity-verification service\.<\/p>/);
    const saved = await runtime.exportFile() as any;
    assert.equal(saved.filename, 'contract-signed.pdf');
    assert.deepEqual(logged, [ONE]);
  } finally { runtime.destroy(); }
  const plain = await createRuntime(tool, { ...host([], pdf), raster }, { ...values, source: [fileRef(await fixture('unsigned.pdf'), 'plain.pdf')] } as never);
  try { assert.deepEqual(lines(panel(plain)), []); } finally { plain.destroy(); }
});

test('an app whose PDF bridge has no analysis shows no line and keeps the entry in the list of changes', async () => {
  const tool = await load('pages');
  const { analyze: _left, ...pdf } = createPdfAPI() as any;
  const runtime = await createRuntime(tool, host([], pdf), { operation: 'rotate', pages: '1', source: [fileRef(await fixture('signed.pdf'), 'contract.pdf')] } as never);
  try {
    const html = panel(runtime);
    assert.deepEqual(lines(html), []);
    assert.match(html, /1 digital signature no longer verifies because the PDF is saved again\./);
  } finally { runtime.destroy(); }
});

test('the line is read out once: the script fills a status region only when the words change', async () => {
  const template = await readFile(join(ROOT, 'community', 'pages', 'template.html'), 'utf8');
  assert.equal((template.match(/data-signed-note>\{\{signedLead\}\}<strong>digitally signed<\/strong>\{\{signedRest\}\}/g) || []).length, 3, 'page operations, Compress and Sign');
  // The visible line has no live role of its own, so a repaint does not read the sentence again.
  assert.doesNotMatch(template, /data-signed-note[^>]*role=|role="[^"]*"[^>]*data-signed-note/);
  assert.match(template, /canvas\.__pagesSignedSaid!==signedWords/);
  assert.match(template, /said\.setAttribute\('role','status'\)/);
});
