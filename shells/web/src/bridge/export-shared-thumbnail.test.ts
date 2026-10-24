// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { swapBlobUrls, thumbnailClone, thumbnailPictures } from './export-shared.ts';
import type { DtoRenderOpts } from './export-shared.ts';

/** A jsdom page whose pictures report the sizes the layout and the decoder would give. */
function page(pictures: Array<{ src: string; natural: [number, number]; box: [number, number] }>) {
  const dom = new JSDOM('<!doctype html><div id="root"></div>');
  const root = dom.window.document.getElementById('root')!;
  const imgs = pictures.map(({ src, natural, box }) => {
    const img = dom.window.document.createElement('img');
    img.setAttribute('src', src);
    Object.defineProperties(img, {
      naturalWidth: { value: natural[0] }, naturalHeight: { value: natural[1] },
      offsetWidth: { value: box[0], configurable: true }, offsetHeight: { value: box[1], configurable: true },
    });
    root.appendChild(img);
    return img;
  });
  return { dom, root, imgs };
}

function withBrowserStubs<T>(dom: JSDOM, run: (resized: Array<{ width?: number; height?: number }>) => Promise<T>): Promise<T> {
  const g = globalThis as Record<string, unknown>;
  const saved = { document: g.document, fetch: g.fetch, createImageBitmap: g.createImageBitmap };
  const resized: Array<{ width?: number; height?: number }> = [];
  g.document = dom.window.document;
  g.fetch = async () => new Response(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));
  g.createImageBitmap = async (_blob: Blob, opts: { resizeWidth?: number; resizeHeight?: number }) => {
    resized.push({ width: opts.resizeWidth, height: opts.resizeHeight });
    return { close() {} };
  };
  const proto = dom.window.HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = () => ({ drawImage() {} });
  proto.toDataURL = function (this: HTMLCanvasElement, type: string) { return `data:${type};small=${this.width}x${this.height}`; };
  return run(resized).finally(() => { Object.assign(g, saved); dom.window.close(); });
}

test('a thumbnail inlines only pictures held at well above their drawn size, downscaled to twice it', async () => {
  const { dom, root, imgs } = page([
    { src: 'blob:photo', natural: [3000, 2000], box: [600, 400] },
    { src: 'blob:small', natural: [100, 75], box: [400, 300] },
    { src: 'data:image/png;base64,AA==', natural: [3000, 2000], box: [600, 400] },
  ]);
  await withBrowserStubs(dom, async resized => {
    // A 1920 px artboard drawn 360 px wide: 0.1875 output pixels per layout pixel.
    const pictures = await thumbnailPictures(root, 360 / 1920);
    assert.deepEqual([...pictures.keys()], [imgs[0]], 'only the oversized blob picture');
    assert.deepEqual(resized, [{ width: 225, height: 150 }], 'twice the drawn size of a picture that covers its box');
    assert.equal(pictures.get(imgs[0]!), 'data:image/jpeg;small=225x150', 'a JPEG stays a JPEG');
    assert.equal(imgs[0]!.getAttribute('src'), 'blob:photo', 'the live canvas keeps its own picture');
  });
});

test('without a decoder nothing is replaced, and a full-size render keeps twice the drawn size', async () => {
  const { dom, root } = page([{ src: 'blob:photo', natural: [3000, 2000], box: [600, 400] }]);
  const g = globalThis as Record<string, unknown>, saved = g.createImageBitmap;
  try {
    g.createImageBitmap = undefined;
    assert.equal((await thumbnailPictures(root, 0.2)).size, 0);
  } finally { g.createImageBitmap = saved; }
  await withBrowserStubs(dom, async resized => {
    // Drawn 600 px wide at full size, a 3000 px photo is five times its drawn size and is
    // halved; a box twice as large keeps its photo.
    assert.equal((await thumbnailPictures(root, 1)).size, 1);
    Object.defineProperties(root.firstElementChild!, { offsetWidth: { value: 1600 }, offsetHeight: { value: 1066 } });
    assert.equal((await thumbnailPictures(root, 1)).size, 0);
    assert.deepEqual(resized, [{ width: 1200, height: 800 }]);
  });
});

test('the clone takes the small picture and the live swap leaves that element alone', async () => {
  const { dom, root, imgs } = page([
    { src: 'blob:photo', natural: [3000, 2000], box: [600, 400] },
    { src: 'blob:icon', natural: [16, 16], box: [64, 64] },
  ]);
  await withBrowserStubs(dom, async () => {
    const dto: DtoRenderOpts = { width: 360, height: 203, style: { transform: '', transformOrigin: '', width: '', height: '' } };
    const kept = await thumbnailClone(root, dto, 1920);
    assert.ok(kept.has(imgs[0]!) && !kept.has(imgs[1]!));
    const clone = imgs[0]!.cloneNode(false) as Element;
    dto.adjustClonedNode!(imgs[0]!, clone, true);
    assert.equal(clone.getAttribute('src'), 'blob:photo', 'only the hook before the children runs');
    dto.adjustClonedNode!(imgs[0]!, clone, false);
    assert.equal(clone.getAttribute('src'), 'data:image/jpeg;small=225x150');
    const other = imgs[1]!.cloneNode(false) as Element;
    dto.adjustClonedNode!(imgs[1]!, other, false);
    assert.equal(other.getAttribute('src'), 'blob:icon');
    const g = globalThis as Record<string, unknown>;
    g.FileReader = class { result = ''; onload: () => void = () => {}; onerror: () => void = () => {};
      readAsDataURL() { this.result = 'data:image/png;base64,AA=='; queueMicrotask(() => this.onload()); } };
    const restore = await swapBlobUrls(root, kept);
    assert.equal(imgs[0]!.getAttribute('src'), 'blob:photo', 'kept for the clone');
    assert.match(imgs[1]!.getAttribute('src')!, /^data:/, 'the rest are inlined as before');
    restore();
    assert.equal(imgs[1]!.getAttribute('src'), 'blob:icon');
    delete g.FileReader;
  });
});
