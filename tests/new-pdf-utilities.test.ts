// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { validateManifest } from '../engine/src/validate.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PDF_BYTES = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10]);
const file = (name: string, marker: number): any => ({
  __file: true,
  name,
  mime: 'application/pdf',
  size: PDF_BYTES.length,
  url: `blob:${name}`,
  bytes: new Uint8Array([...PDF_BYTES, marker]),
});

async function communityTool(id: string): Promise<any> {
  return loadTool(id, (path) => readFile(join(ROOT, 'community', path), 'utf8'));
}

function wireTemplate(html: string, onCommit: (id: string, value: unknown) => void, model: any[] = []) {
  const script = /<script>([\s\S]*)<\/script>\s*$/.exec(html)?.[1];
  assert.ok(script, 'the interactive template includes its controller script');
  const markup = html.replace(/<script>[\s\S]*<\/script>\s*$/, '');
  const dom = new JSDOM('<!doctype html><body><div data-lolly-canvas></div></body>', {
    url: 'https://lolly.tools/', runScripts: 'outside-only',
  } as any);
  const canvas = dom.window.document.querySelector('[data-lolly-canvas]') as any;
  canvas.__lollyCommit = onCommit;
  canvas.__lollyModel = () => model;
  canvas.innerHTML = markup;
  dom.window.eval(script);
  return dom;
}

test('Pages exposes a multi-PDF draggable workspace and exports the complete file list', async () => {
  const tool = await communityTool('pages');
  const checked = validateManifest(tool.manifest);
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  assert.equal(tool.manifest.inputs.find((input: any) => input.id === 'source')?.multiple, true);

  let organized: any;
  const host: any = {
    version: '1',
    log: () => {},
    profile: { get: async () => ({}) },
    pdf: {
      pages: async (bytes: Uint8Array) => bytes.at(-1) === 1 ? {
        pages: [
          { page: 1, widthPt: 400, heightPt: 800, svg: '<svg viewBox="0 0 400 800" />' },
          { page: 2, widthPt: 800, heightPt: 400, svg: '<svg viewBox="0 0 800 400" />' },
        ], totalPages: 2, truncated: false,
      } : {
        pages: [{ page: 1, widthPt: 300, heightPt: 300, svg: '<svg viewBox="0 0 300 300" />' }],
        totalPages: 1, truncated: false,
      },
      organize: async (bytes: Uint8Array, opts: any) => {
        organized = { bytes, opts };
        return { bytes: new Uint8Array([1]), beforePages: 3, afterPages: 3, beforeBytes: 20, afterBytes: 1, pageOrder: [1, 2, 3], operations: ['Reordered 3 pages'] };
      },
    },
  };
  const first = file('portrait-and-landscape.pdf', 1), second = file('square.pdf', 2);
  const runtime = await createRuntime(tool, host, { source: [first, second], pages: '3,1-2' } as never);
  const html = runtime.getHydrated();
  assert.match(html, /portrait-and-landscape\.pdf/);
  assert.match(html, /square\.pdf/);
  assert.match(html, /data-page-card[^>]*data-page="3"[^>]*draggable="true"/);
  assert.match(html, /width:102px;height:205px/);
  assert.match(html, /width:142px;height:71px/);
  assert.match(html, /data-page-move="-1"/);

  const edits: Array<[string, unknown]> = [];
  const dom = wireTemplate(html, (id, value) => edits.push([id, value]));
  const page3 = dom.window.document.querySelector('[data-page="3"]')!;
  (page3.querySelector('[data-page-move="1"]') as HTMLElement).click();
  assert.deepEqual(edits.at(-1), ['pages', '1,3,2']);
  const page2 = dom.window.document.querySelector('[data-page="2"]')!;
  page2.dispatchEvent(new dom.window.Event('dragstart', { bubbles: true, cancelable: true }));
  page3.dispatchEvent(new dom.window.Event('drop', { bubbles: true, cancelable: true }));
  assert.deepEqual(edits.at(-1), ['pages', '1-3']);

  await runtime.exportFile();
  assert.equal(organized.bytes, first.bytes);
  assert.deepEqual(organized.opts.extras, [second.bytes]);
  assert.equal(organized.opts.pages, '3,1-2');
});

test('Pages previews every page in an open-ended range and selects that same range', async () => {
  const tool = await communityTool('pages');
  const host = {
    version: '1', log() {}, profile: { get: async () => ({}) },
    pdf: {
      pages: async () => ({ pages: [1, 2, 3].map(page => ({ page, widthPt: 400, heightPt: 500, svg: '<svg/>' })), totalPages: 3 }),
      organize: async () => ({ bytes: new Uint8Array([1]), beforePages: 3, afterPages: 3, beforeBytes: 10, afterBytes: 1, pageOrder: [1, 2, 3], operations: [] }),
    },
  } as unknown as Parameters<typeof createRuntime>[1];
  const runtime = await createRuntime(tool, host, { source: [file('three.pdf', 1)] } as never);
  try {
    const html = runtime.getHydrated();
    assert.match(html, /data-pages="1-"/);
    assert.equal((html.match(/data-page-card /g) || []).length, 3, 'the default open range shows all pages');
    const edits: Array<[string, unknown]> = [];
    const dom = wireTemplate(html, (id, value) => edits.push([id, value]));
    dom.window.document.querySelector<HTMLButtonElement>('[data-page="3"] [data-page-move="-1"]')!.click();
    assert.deepEqual(edits.at(-1), ['pages', '1,3,2'], 'moving a default-range page preserves every other page');
    dom.window.close();
    await runtime.setInput('pages', '2-');
    assert.equal((runtime.getHydrated().match(/data-page-card /g) || []).length, 2);
    await runtime.setInput('operation', 'extract');
    const chosen = [...runtime.getHydrated().matchAll(/data-page-card[^>]*data-page="(\d+)"[^>]*data-chosen="true"/g)].map(m => m[1]);
    assert.deepEqual(chosen, ['2', '3'], 'open ranges select through the final page');
  } finally { runtime.destroy(); }
});

const imageFile = (name: string, mime: string, head: number[], marker: number): any => {
  const bytes = new Uint8Array([...head, 0, 0, 0, 0, 0, 0, 0, 0, marker]);
  return { __file: true, name, mime, size: bytes.length, url: `blob:${name}`, bytes };
};

function imagePagesHost(calls: { fromImages: any[]; encode: any[]; organize: any[] }, effects: any[] = []): any {
  return {
    version: '1', log() {}, profile: { get: async () => ({}) },
    images: {
      encode: async (bytes: Uint8Array, opts: any) => { calls.encode.push({ bytes, opts }); return { bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9]), mime: 'image/png', width: 4, height: 4 }; },
    },
    pdf: {
      fromImages: async (images: any[], opts: any) => {
        calls.fromImages.push({ images, opts });
        const jpeg = images[0].bytes[0] === 0xff;
        return { bytes: new Uint8Array([...PDF_BYTES, 100 + calls.fromImages.length]), pages: 1, turned: jpeg ? 1 : 0, metadataLeftOut: jpeg ? 1 : 0, extraPicturesLeftOut: 0, notes: [] };
      },
      pages: async (bytes: Uint8Array) => ({ pages: [{ page: 1, widthPt: 300, heightPt: 200, svg: `<svg data-doc="${bytes.at(-1)}"/>` }], totalPages: 1 }),
      organize: async (bytes: Uint8Array, opts: any) => {
        calls.organize.push({ bytes, opts });
        return { bytes: new Uint8Array([7]), beforePages: 3, afterPages: 3, beforeBytes: 30, afterBytes: 1, pageOrder: [1, 2, 3], operations: ['Reordered 3 pages'], effects };
      },
    },
  };
}

test('Pages turns images into PDF pages, converting formats it cannot place directly', async () => {
  const tool = await communityTool('pages');
  assert.equal(validateManifest(tool.manifest).valid, true);
  assert.ok(tool.manifest.inputs.find((input: any) => input.id === 'source').accept.includes('image/jpeg'));
  const calls = { fromImages: [] as any[], encode: [] as any[], organize: [] as any[] };
  const effects = [{ feature: 'bookmarks', count: 2, outcome: 'removed', message: '2 bookmarks are not carried into the new PDF.' }];
  const photo = imageFile('holiday.jpg', 'image/jpeg', [0xff, 0xd8, 0xff, 0xe0], 1);
  const webp = imageFile('sticker.webp', 'image/webp', [...Buffer.from('RIFF\0\0\0\0WEBP')], 2);
  const runtime = await createRuntime(tool, imagePagesHost(calls, effects), { source: [photo, webp, file('report.pdf', 3)] } as never);
  try {
    const html = runtime.getHydrated();
    assert.equal(calls.encode.length, 1, 'only the WebP is converted');
    assert.equal(calls.encode[0].bytes, webp.bytes);
    assert.deepEqual(calls.encode[0].opts, { format: 'png' });
    assert.equal(calls.fromImages[0].images[0].bytes, photo.bytes, 'a JPEG goes onto its page unchanged');
    assert.deepEqual(calls.fromImages[0].opts, { pageSize: 'image', margin: 0 });
    assert.deepEqual(calls.organize.at(-1).opts.extras.map((b: Uint8Array) => b.at(-1)), [102, 3], 'image PDFs and the real PDF follow in order');
    assert.match(html, /data-input-id="imagePageSize"/);
    assert.match(html, /<span class="page-origin">Image 1<\/span>/);
    assert.match(html, /<span class="page-origin">PDF 3 · p1<\/span>/);
    const changes = [...html.matchAll(/data-change-outcome="(\w+)">([^<]+)</g)].map(m => [m[1], m[2]]);
    assert.deepEqual(changes, [
      ['kept', 'Converted 1 image to PNG before placing it.'],
      ['kept', 'Turned 1 photo upright using the camera orientation.'],
      ['removed', 'Left out photo details such as location and camera data from 1 image.'],
      ['removed', '2 bookmarks are not carried into the new PDF.'],
    ]);

    await runtime.setInput('imagePageSize', 'a4');
    await runtime.setInput('imageMargin', 10);
    assert.deepEqual(calls.fromImages.at(-1).opts, { pageSize: 'a4', margin: 28.35 });
    assert.match(runtime.getHydrated(), /data-input-id="imageMargin"/);
  } finally { runtime.destroy(); }
});

test('Pages names an images-only PDF after the first image and refuses what it cannot read', async () => {
  const tool = await communityTool('pages');
  const calls = { fromImages: [] as any[], encode: [] as any[], organize: [] as any[] };
  const png = imageFile('scan.png', 'image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a], 1);
  const runtime = await createRuntime(tool, imagePagesHost(calls), { source: [png] } as never);
  try {
    assert.match(runtime.getHydrated(), /1 image → 3 pages/);
    const result = await runtime.exportFile() as any;
    assert.equal(result.filename, 'scan.pdf');
  } finally { runtime.destroy(); }

  const older = imagePagesHost(calls);
  delete older.pdf.fromImages;
  const noImages = await createRuntime(tool, older, { source: [png] } as never);
  try { assert.match(noImages.getHydrated(), /Turning images into a PDF is not available in this app\./); } finally { noImages.destroy(); }

  const odd = await createRuntime(tool, imagePagesHost(calls), { source: [{ ...file('notes.txt', 1), mime: 'text/plain', bytes: new Uint8Array([104, 105]) }] } as never);
  try { assert.match(odd.getHydrated(), /notes\.txt is not a PDF or an image\./); } finally { odd.destroy(); }
});

test('Pages places an animated PNG as its still picture, through host.images', async () => {
  const tool = await communityTool('pages');
  // A PNG signature, an IHDR chunk, then the acTL chunk that makes it an APNG.
  const head = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...Buffer.from('IHDR'), 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 8, ...Buffer.from('acTL'), 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0];
  const apng = imageFile('wave.png', 'image/png', head, 1);
  const calls = { fromImages: [] as any[], encode: [] as any[], organize: [] as any[] };
  const runtime = await createRuntime(tool, imagePagesHost(calls), { source: [apng] } as never);
  try {
    const html = runtime.getHydrated();
    assert.equal(calls.encode.length, 1);
    assert.equal(calls.encode[0].bytes, apng.bytes);
    assert.notEqual(calls.fromImages[0].images[0].bytes, apng.bytes, 'the still picture is placed, not the animated file');
    const changes = [...html.matchAll(/data-change-outcome="(\w+)">([^<]+)</g)].map(m => [m[1], m[2]]);
    assert.deepEqual(changes, [['removed', 'Placed 1 animated PNG as a still picture, without the animation.']]);
  } finally { runtime.destroy(); }

  const noEncoder = imagePagesHost(calls);
  delete noEncoder.images;
  const refused = await createRuntime(tool, noEncoder, { source: [apng] } as never);
  try { assert.match(refused.getHydrated(), /wave\.png is an animated PNG; save it as a still image first\./); } finally { refused.destroy(); }
});

test('Sign renders direct drawing and asset controls on a mixed-size-aware page and exports drawn ink', async () => {
  const tool = await communityTool('sign');
  const checked = validateManifest(tool.manifest);
  assert.equal(checked.valid, true, JSON.stringify(checked.errors));
  let stamped: any;
  const host: any = {
    version: '1',
    log: () => {},
    profile: { get: async () => ({ useDetails: false }) },
    pdf: {
      pages: async () => ({
        pages: [{ page: 1, widthPt: 792, heightPt: 612, svg: '<svg viewBox="0 0 792 612" />' }],
        totalPages: 1,
        truncated: false,
      }),
      stamp: async (bytes: Uint8Array, opts: any) => {
        stamped = { bytes, opts };
        return { bytes: new Uint8Array([9]), pages: 1, stamps: opts.images.length };
      },
    },
    raster: {
      canRaster: () => true,
      measure: async () => ({ width: 600, height: 180, mime: 'image/svg+xml' }),
      decode: async () => ({ width: 600, height: 180, close: () => {} }),
      encode: async () => ({ bytes: new Uint8Array([137, 80, 78, 71]), mime: 'image/png', width: 600, height: 180 }),
    },
  };
  const source = file('landscape.pdf', 3);
  const runtime = await createRuntime(tool, host, {
    source,
    signatureInk: 'M10,10L100,80',
    position: { x: 40, y: 50, width: 200 },
    date: false,
    seal: false,
  } as never);
  const html = runtime.getHydrated();
  assert.match(html, /class="ink-pad"/);
  assert.match(html, /data-input-action="pick" data-input-id="signature"/);
  assert.match(html, /class="placed-signature"[^>]*viewBox=/);
  assert.match(html, /aspect-ratio:792\/612/);

  const edits: Array<[string, unknown]> = [];
  const dom = wireTemplate(html, (id, value) => edits.push([id, value]));
  const pad = dom.window.document.querySelector('.ink-pad') as any;
  pad.setPointerCapture = () => {};
  pad.getBoundingClientRect = () => ({ left: 0, top: 0, width: 600, height: 180, right: 600, bottom: 180, x: 0, y: 0, toJSON: () => ({}) });
  pad.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, clientX: 120, clientY: 70 }));
  pad.dispatchEvent(new dom.window.MouseEvent('pointermove', { bubbles: true, clientX: 180, clientY: 90 }));
  pad.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, clientX: 180, clientY: 90 }));
  assert.equal(edits.at(-1)?.[0], 'signatureInk');
  assert.match(String(edits.at(-1)?.[1]), /M120,70L180,90$/);

  const result = await runtime.exportFile() as any;
  assert.equal(result.filename, 'landscape-signed.pdf');
  assert.equal(stamped.bytes, source.bytes);
  assert.equal(stamped.opts.images[0].width, 200);
  assert.equal(stamped.opts.images[0].height, 60);
});
