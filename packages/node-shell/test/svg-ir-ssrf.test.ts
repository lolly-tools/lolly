// SPDX-License-Identifier: MPL-2.0
/**
 * The EMF/EPS/DXF/WMF walk never turns an `<image href>` into a request.
 *
 * Run directly:  node --test packages/node-shell/test/svg-ir-ssrf.test.ts
 *
 * `svgDomToIr` decodes an `<image>` to RGB when the realm has a canvas. Once the
 * Node shells installed one (installNodeCanvas, including on the MCP server) the
 * decode called the bare global `fetch(href)` for whatever the href said, so a
 * caller who could put a URL in a tool's output could make the server request an
 * internal address and get the pixels back in the file. The walk now reads only
 * inline `data:` and `blob:` pictures unless its caller hands it a reader (the
 * web shell hands over the page's own fetch).
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { JSDOM } from 'jsdom';
import { installNodeCanvas, isCanvasAvailable, nodeCanvas } from '../src/canvas.ts';
import { readInlineImage, svgDomToIr } from '../src/svg-ir.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

const SKIP = !isCanvasAvailable() && '@napi-rs/canvas is not installed here';

const hits: string[] = [];
const server = createServer((req, res) => {
  hits.push(req.url ?? '');
  res.writeHead(200, { 'content-type': 'image/png' }).end();
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;
after(() => new Promise<void>((resolve) => server.close(() => resolve())));

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
const g = globalThis as unknown as { window?: unknown; document?: unknown; Element?: unknown };
g.window = dom.window;
g.document = dom.window.document;
g.Element = dom.window.Element;
if (!SKIP) await installNodeCanvas(dom.window as unknown as { HTMLCanvasElement?: { prototype: Record<string, unknown> } });

async function redPng(): Promise<string> {
  const mod = (await nodeCanvas())!;
  const c = mod.createCanvas(4, 4);
  const cx = c.getContext('2d');
  cx.fillStyle = '#ff0000';
  cx.fillRect(0, 0, 4, 4);
  return `data:image/png;base64,${c.toBuffer('image/png').toString('base64')}`;
}

function svgWith(href: string): Element {
  const doc = new dom.window.DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><image href="${href}" x="0" y="0" width="10" height="10"/></svg>`,
    'image/svg+xml',
  );
  return doc.documentElement as unknown as Element;
}

function logHost(lines: string[]): HostV1 {
  return { log: (_level: string, msg: string) => { lines.push(msg); } } as unknown as HostV1;
}

test('an image href to a local listener makes no request', { skip: SKIP }, async () => {
  assert.equal(typeof (globalThis as { createImageBitmap?: unknown }).createImageBitmap, 'function', 'the realm can decode');
  const lines: string[] = [];
  for (const href of [
    `http://127.0.0.1:${port}/latest/meta-data/`,
    ` HTTP://127.0.0.1:${port}/upper`,
    `//127.0.0.1:${port}/scheme-relative`,
    `/catalog/relative`,
  ]) {
    for (const label of ['EMF', 'EPS', 'DXF', 'WMF']) {
      const ir = await svgDomToIr(svgWith(href), { host: logHost(lines), label });
      assert.equal(ir.prims.filter((p) => p.type === 'image').length, 0, `${label}: ${href} is not drawn`);
    }
  }
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(hits, [], 'the listener heard nothing');
  assert.ok(lines.some((l) => /links to its picture instead of carrying it/.test(l)), 'the skip is reported');
});

test('an inline picture is still drawn', { skip: SKIP }, async () => {
  const ir = await svgDomToIr(svgWith(await redPng()), {});
  const image = ir.prims.find((p) => p.type === 'image') as { pxW: number; rgb: Uint8Array } | undefined;
  assert.ok(image, 'the data: picture becomes an image prim');
  assert.equal(image.pxW, 4);
  assert.deepEqual([...image.rgb.subarray(0, 3)], [255, 0, 0]);
});

test('a caller with a reader of its own reads through it', { skip: SKIP }, async () => {
  const asked: string[] = [];
  const png = await redPng();
  const ir = await svgDomToIr(svgWith('/catalog/a.png'), {
    readImage: async (href) => { asked.push(href); return (await fetch(png)).blob(); },
  });
  assert.deepEqual(asked, ['/catalog/a.png']);
  assert.equal(ir.prims.filter((p) => p.type === 'image').length, 1);
  assert.deepEqual(hits, []);
});

test('readInlineImage opens data: and blob: only', async () => {
  assert.equal(await readInlineImage(`http://127.0.0.1:${port}/x`), null);
  assert.equal(await readInlineImage(`  https://example.invalid/x`), null);
  assert.equal(await readInlineImage('/relative.png'), null);
  assert.equal(await (await readInlineImage('data:text/plain,hi'))?.text(), 'hi');
  const url = URL.createObjectURL(new Blob(['blob bytes']));
  assert.equal(await (await readInlineImage(url))?.text(), 'blob bytes');
  assert.deepEqual(hits, []);
});
