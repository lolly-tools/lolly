// SPDX-License-Identifier: MPL-2.0
//
// Compress and Sign are operations of Pages. Their own ids are permanent, so the two
// older tools still load and run for an old link, the CLI and the MCP server, and their
// manifests point at Pages, which holds every input they had.
//
// Run with:
//   node --test tests/pages-compress-sign.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { matchesShowIf } from '../engine/src/inputs.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { validateManifest } from '../engine/src/validate.ts';
import { createPdfAPI } from '../shells/web/src/bridge/pdf.ts';
import { successorHref } from '../shells/web/src/lib/tool-successors.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id: string): Promise<any> => loadTool(id, (path) => readFile(join(ROOT, 'community', path), 'utf8'));
const PAGE_OPERATIONS = ['reorder', 'rotate', 'extract', 'delete', 'merge', 'split'];
const BARE_HOST: any = { version: '1', profile: { get: async () => ({ useDetails: false }) }, log: () => {} };
const fileRef = (bytes: Uint8Array, name: string, mime = 'application/pdf'): any => ({ __file: true, url: null, name, mime, size: bytes.length, bytes });

// Saved without object streams, so saving again with them makes a smaller file with no canvas.
async function compressiblePdf(pages = 40): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < pages; i++) d.addPage([300, 300]).drawText(`Page ${i} ` + 'lorem ipsum dolor sit amet '.repeat(4), { x: 10, y: 150, size: 8 });
  return d.save({ useObjectStreams: false });
}
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0x49, 0x44, 0x41, 0x54]);

function signHost(seen: { stamp?: any; previewed?: Uint8Array }): any {
  return {
    ...BARE_HOST,
    pdf: {
      pages: async (bytes: Uint8Array, opts: any) => {
        seen.previewed = bytes;
        const page = opts?.pageNumbers?.[0] ?? 1;
        return { pages: [{ page, widthPt: 612, heightPt: 792, svg: '<svg viewBox="0 0 612 792" />' }], totalPages: 3 };
      },
      stamp: async (bytes: Uint8Array, opts: any) => {
        seen.stamp = { bytes, opts };
        return { bytes: new Uint8Array([9]), pages: 3, stamps: opts.images.length + (opts.texts?.length ?? 0) };
      },
    },
    raster: {
      decode: async () => ({ width: 600, height: 180, close: () => {} }),
      encode: async () => ({ bytes: new Uint8Array([137, 80, 78, 71]), mime: 'image/png', width: 600, height: 180 }),
    },
  };
}

test('Compress and Sign are retired into Pages and no longer listed', async () => {
  for (const id of ['compress-pdf', 'sign']) {
    const { manifest } = await load(id);
    assert.equal(manifest.deprecated, true, id);
    assert.equal(manifest.replacedBy, 'pages', id);
    assert.equal(manifest.listed, false, id);
    assert.equal(validateManifest(manifest).valid, true, id);
  }
});

test('Pages keeps its inputs in place and adds the two operations after them', async () => {
  const { manifest } = await load('pages');
  const checked = validateManifest(manifest);
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  assert.equal(manifest.name, 'Pages');
  assert.deepEqual(manifest.inputs.map((input: any) => input.id), [
    'source', 'operation', 'pages', 'previewPage', 'rotation', 'imagePageSize', 'imageMargin',
    'level', 'grayscale',
    'signature', 'signatureInk', 'signaturePage', 'signaturePosition', 'initials', 'signatureDate', 'seal', 'lock',
  ]);
  const operation = manifest.inputs.find((input: any) => input.id === 'operation');
  assert.deepEqual(operation.options.map((option: any) => option.value), [...PAGE_OPERATIONS, 'compress', 'sign']);
  assert.equal(operation.default, 'reorder');
  for (const value of ['compress', 'sign']) assert.deepEqual(operation.options.find((option: any) => option.value === value).formats, ['pdf']);
  // Still an on-device file utility with no rendered export.
  assert.equal(manifest.privacy, 'on-device');
  assert.deepEqual([manifest.render.export, manifest.render.layout, manifest.render.actions], [false, 'canvas', []]);
  // A search for either retired tool's name finds the tile.
  for (const tag of ['compress', 'shrink', 'sign', 'signature']) assert.ok(manifest.tags.includes(tag), tag);
});

test('each input shows only for the operations it applies to', async () => {
  const { manifest } = await load('pages');
  const shown = (operation: string, more: Record<string, unknown> = {}): string[] =>
    manifest.inputs.filter((input: any) => matchesShowIf(input.showIf, { operation, imagePageSize: 'image', ...more })).map((input: any) => input.id);
  assert.deepEqual(shown('reorder'), ['source', 'operation', 'pages', 'previewPage', 'imagePageSize']);
  assert.deepEqual(shown('rotate', { imagePageSize: 'a4' }), ['source', 'operation', 'pages', 'previewPage', 'rotation', 'imagePageSize', 'imageMargin']);
  assert.deepEqual(shown('compress', { imagePageSize: 'a4' }), ['source', 'operation', 'level', 'grayscale']);
  assert.deepEqual(shown('sign'), ['source', 'operation', 'signature', 'signatureInk', 'signaturePage', 'signaturePosition', 'initials', 'signatureDate', 'seal', 'lock']);
});

test('Pages compresses the first PDF and leads with the saving', async () => {
  const tool = await load('pages');
  const pdf = await compressiblePdf();
  const host = { ...BARE_HOST, pdf: createPdfAPI() };
  const runtime = await createRuntime(tool, host, { operation: 'compress', level: 'strong', source: [fileRef(PNG, 'photo.png', 'image/png'), fileRef(pdf, 'report.pdf')] } as never);
  try {
    const html = runtime.getHydrated();
    assert.match(html, /class="saving"[^>]*><strong>\d+% smaller<\/strong><span>[^<]* → [^<]*<\/span>/);
    assert.match(html, /<option value="compress" selected>/);
    // The level is the sidebar's segmented control, with Strong chosen.
    assert.match(html, /class="badge-select badge-select--segmented" role="radiogroup"/);
    assert.match(html, /class="badge-select-opt is-on" data-level="strong" aria-checked="true"/);
    assert.equal((html.match(/aria-checked="true"/g) || []).length, 1);
    // What saving does to the document stays on the canvas, under the button.
    assert.match(html, /Download compressed PDF<\/button>\s*<p class="save-note">Only images are recompressed, and a digital signature on the PDF stops being valid once the file is saved again\.<\/p>/);
    assert.match(html, /Only report\.pdf is compressed\./);
    assert.doesNotMatch(html, /<figure class="page|class="ink-pad"/, 'the other two panels are not drawn');
    const result = await runtime.exportFile() as any;
    assert.equal(result.filename, 'report-compressed.pdf');
    assert.ok(result.bytes.length < pdf.length, 'the file is smaller');
    assert.equal((await PDFDocument.load(result.bytes, { updateMetadata: false })).getPageCount(), 40);
    // The operation the hooks report is the one chosen: a blank key must not write an input.
    assert.equal(runtime.getModel().find((input: any) => input.id === 'operation')!.value, 'compress');
    assert.equal(runtime.getModel().find((input: any) => input.id === 'imagePageSize')!.value, 'image');
  } finally { runtime.destroy(); }
});

test('Compress and Sign refuse a list with no PDF in it', async () => {
  const tool = await load('pages');
  for (const operation of ['compress', 'sign']) {
    const runtime = await createRuntime(tool, { ...BARE_HOST, pdf: createPdfAPI() }, { operation, source: [fileRef(PNG, 'photo.png', 'image/png')] } as never);
    try {
      assert.match(runtime.getHydrated(), /That file is not a PDF\./, operation);
      await assert.rejects(() => runtime.exportFile(), /not a PDF/, operation);
    } finally { runtime.destroy(); }
  }
});

test('Pages signs the chosen page of the first PDF under the new input ids', async () => {
  const tool = await load('pages');
  const seen: { stamp?: any; previewed?: Uint8Array } = {};
  const pdf = fileRef(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 1]), 'contract.pdf');
  const runtime = await createRuntime(tool, signHost(seen), {
    operation: 'sign', source: [pdf], signatureInk: 'M10,10L100,80', signaturePage: 2,
    signaturePosition: { x: 40, y: 50, width: 200 }, signatureDate: true, seal: false,
  } as never);
  try {
    const html = runtime.getHydrated();
    assert.match(html, /<option value="sign" selected>/);
    assert.match(html, /class="ink-pad"/);
    assert.match(html, /class="sign-page"[^>]*aspect-ratio:612\/792/);
    assert.match(html, /class="placed-signature"[^>]*viewBox=/);
    assert.match(html, /data-input-id="signaturePage"/);
    assert.match(html, /data-input-id="signatureDate" checked/);
    assert.match(html, /value="2" data-input-id="signaturePage"/);
    assert.match(html, /<p class="save-note">This is a visible signature, not an identity-verification service\.<\/p>/);
    assert.doesNotMatch(html, /<figure class="page|class="saving"/, 'the other two panels are not drawn');
    const result = await runtime.exportFile() as any;
    assert.equal(result.filename, 'contract-signed.pdf');
    assert.equal(seen.stamp.bytes, pdf.bytes);
    assert.deepEqual([seen.stamp.opts.images[0].page, seen.stamp.opts.images[0].x, seen.stamp.opts.images[0].y, seen.stamp.opts.images[0].width], [2, 40, 50, 200]);
    assert.equal(seen.stamp.opts.texts.length, 1, 'the date is stamped');
    assert.match(seen.stamp.opts.texts[0].text, /^\d{4}-\d\d-\d\d$/);
  } finally { runtime.destroy(); }
});

test('Sign shows whose name the credential records, and only when one is recorded', async () => {
  const tool = await load('pages');
  const pdf = fileRef(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 1]), 'contract.pdf');
  const named = { ...signHost({}), profile: { get: async () => ({ useDetails: true, firstname: 'Ana', lastname: 'Lima' }) }, c2pa: { sign: async (bytes: Uint8Array) => bytes } };
  for (const [seal, expected] of [[true, 'Signing as Ana Lima. This is a visible signature'], [false, '<p class="save-note">This is a visible signature']] as const) {
    const runtime = await createRuntime(tool, named, { operation: 'sign', source: [pdf], signatureInk: 'M10,10L100,80', seal } as never);
    try { assert.ok(runtime.getHydrated().includes(expected), String(seal)); } finally { runtime.destroy(); }
  }
});

test('in Reorder a thumbnail carries its number once, in the position field', async () => {
  const tool = await load('pages');
  const host = { ...BARE_HOST, pdf: {
    pages: async () => ({ pages: [1, 2, 3].map((page) => ({ page, widthPt: 400, heightPt: 500, svg: '<svg/>' })), totalPages: 3 }),
    organize: async () => ({ bytes: new Uint8Array([1]), beforePages: 3, afterPages: 3, beforeBytes: 20, afterBytes: 1, pageOrder: [1, 2, 3], operations: ['Reordered 3 pages'] }),
  } };
  const pdf = fileRef(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10, 1]), 'report.pdf');
  const reorder = await createRuntime(tool, host, { operation: 'reorder', source: [pdf] } as never);
  try {
    const html = reorder.getHydrated();
    assert.equal((html.match(/data-move-to/g) || []).length, 3 + 1, 'three fields and the script that wires them');
    assert.doesNotMatch(html, /class="page-number"/);
    assert.doesNotMatch(html, /<figcaption>/);
  } finally { reorder.destroy(); }
  const rotate = await createRuntime(tool, host, { operation: 'rotate', source: [pdf] } as never);
  try { assert.equal((rotate.getHydrated().match(/class="page-number"/g) || []).length, 3); } finally { rotate.destroy(); }
});

test('the empty state follows the operation and offers the picker', async () => {
  const tool = await load('pages');
  for (const [operation, heading] of [['reorder', 'Drop PDFs or images here'], ['compress', 'Drop a PDF here'], ['sign', 'Drop a PDF here']] as const) {
    const runtime = await createRuntime(tool, BARE_HOST, { operation } as never);
    try {
      const html = runtime.getHydrated();
      assert.match(html, new RegExp(`<h1>${heading}</h1>`));
      assert.equal((html.match(/<h1>/g) || []).length, 1);
      assert.match(html, new RegExp(`<option value="${operation}" selected>`));
      assert.match(html, /data-file-pick/);
    } finally { runtime.destroy(); }
  }
});

test('the file and the operation are each said once, and no surface sits inside the panel', async () => {
  const tool = await load('pages');
  const pdf = await compressiblePdf(3);
  const runtime = await createRuntime(tool, { ...BARE_HOST, pdf: createPdfAPI() }, { operation: 'compress', source: [fileRef(pdf, 'report.pdf')] } as never);
  try {
    const markup = runtime.getHydrated().replace(/<script>[\s\S]*$/, '');
    assert.equal((markup.match(/>report\.pdf</g) || []).length, 1, 'the file name is on its chip only');
    assert.equal((markup.match(/data-input-id="operation"/g) || []).length, 1);
    assert.equal((markup.match(/data-export-file/g) || []).length, 1);
  } finally { runtime.destroy(); }
  // The stylesheet gives a background, border or shadow of its own only to the root and to document paper.
  const css = await readFile(join(ROOT, 'community', 'pages', 'styles.css'), 'utf8');
  const boxed = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, , body]) => /(?:^|;)\s*(?:background|box-shadow)\s*:/.test(body!) && !/background:none/.test(body!))
    .map(([, selector]) => selector!.trim());
  assert.deepEqual(boxed.sort(), ['.draw-box', '.page-paper', '.page.chosen .page-paper,.page.drop-target .page-paper', '.sign-page', '.utility']);
  assert.equal((css.match(/dashed/g) || []).length, 2, 'dashed is the drop area only: its rule and the comment that explains it');
});

test('switching the operation leaves nothing of the last panel behind', async () => {
  const tool = await load('pages');
  const pdf = await compressiblePdf(3);
  const runtime = await createRuntime(tool, { ...BARE_HOST, pdf: createPdfAPI() }, { operation: 'compress', source: [fileRef(pdf, 'report.pdf')] } as never);
  try {
    assert.match(runtime.getHydrated(), /Download compressed PDF/);
    await runtime.setInput('operation', 'rotate');
    const html = runtime.getHydrated();
    assert.doesNotMatch(html, /Download compressed PDF|class="saving"/);
    assert.match(html, /<option value="rotate" selected>/);
    assert.match(html, /Download PDF/);
  } finally { runtime.destroy(); }
});

test('an old Compress or Sign link still opens the older tool with its own template', async () => {
  const compress = await load('compress-pdf');
  const one = await createRuntime(compress, BARE_HOST, parseUrlState('level=strong', compress.manifest).values as never);
  try { assert.match(one.getHydrated(), /class="cmp"/); } finally { one.destroy(); }
  const sign = await load('sign');
  const two = await createRuntime(sign, BARE_HOST, parseUrlState('page=2&lock=true', sign.manifest).values as never);
  try { assert.match(two.getHydrated(), /class="sign-root"/); } finally { two.destroy(); }
});

test('the address a retired tool hands over is one Pages reads back whole', async () => {
  const { manifest } = await load('pages');
  const compress = successorHref('compress-pdf', 'pages', { source: fileRef(PNG, 'x.pdf'), level: 'strong', grayscale: true });
  assert.ok(compress.startsWith('#/tool/pages?'));
  assert.deepEqual(parseUrlState(compress.split('?')[1]!, manifest).values, { operation: 'compress', level: 'strong', grayscale: true });
  const sign = successorHref('sign', 'pages', {
    source: fileRef(PNG, 'x.pdf'), signature: null, signatureInk: 'M10,10L100,80 M5,5L6,6', page: 3,
    position: { x: 300, y: 410.5, width: 120 }, initials: null, date: false, seal: false, lock: true,
  });
  assert.deepEqual(parseUrlState(sign.split('?')[1]!, manifest).values, {
    operation: 'sign', signatureInk: 'M10,10L100,80 M5,5L6,6', signaturePage: 3, signatureDate: false, seal: false, lock: true,
    signaturePosition: { x: 300, y: 410.5, width: 120 },
  });
});
