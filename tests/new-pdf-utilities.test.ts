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
