// SPDX-License-Identifier: MPL-2.0
/**
 * Installing the realm canvas does not scan the catalog's fonts; the first text a
 * realm canvas sets, draws or measures does, once.
 *
 * Run directly:  node --test packages/node-shell/test/canvas-fonts-lazy.test.ts
 *
 * The CLI installs the canvas on every tool run and the TUI at start, and a
 * brand that ships its faces takes a couple of hundred milliseconds to scan, so a
 * `lolly qr-code --export=svg` that never touches a canvas paid for the scan on
 * every call. The scan is counted through the module's own
 * GlobalFonts.loadFontsFromDir, in a process of its own (node --test runs each
 * file alone), since registration happens once per process.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { decodeToCanvas, installNodeCanvas, isCanvasAvailable } from '../src/canvas.ts';

const SKIP = !isCanvasAvailable() && '@napi-rs/canvas is not installed here';

interface Napi {
  GlobalFonts: { loadFontsFromDir(dir: string): number };
  createCanvas(w: number, h: number): { toBuffer(mime: string): Buffer };
}

test('the font scan waits for the first text a realm canvas draws', { skip: SKIP }, async () => {
  const loaded = await import('@napi-rs/canvas' as string) as { default?: unknown };
  const napi = (loaded.default ?? loaded) as Napi;
  const original = napi.GlobalFonts.loadFontsFromDir.bind(napi.GlobalFonts);
  let scans = 0;
  napi.GlobalFonts.loadFontsFromDir = (dir: string): number => { scans++; return original(dir); };
  try {
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    assert.equal(await installNodeCanvas(dom.window as never, { URL }), true);
    assert.equal(scans, 0, 'installing the canvas does not scan');

    const c = dom.window.document.createElement('canvas');
    c.width = 20; c.height = 20;
    const cx = c.getContext('2d')!;
    cx.fillRect(0, 0, 4, 4);
    cx.getImageData(0, 0, 1, 1);
    assert.equal(scans, 0, 'drawing shapes does not scan');

    const png = napi.createCanvas(8, 8).toBuffer('image/png');
    assert.equal((await decodeToCanvas(new Uint8Array(png)))?.width, 8);
    assert.equal(scans, 0, 'a raster decode draws no text, so it does not scan');

    cx.font = '12px sans-serif';
    assert.equal(scans, 1, 'setting a font registers the catalog faces first');
    cx.fillText('Hello', 2, 12);
    cx.measureText('Hello');
    assert.equal(scans, 1, 'once per process');
  } finally {
    napi.GlobalFonts.loadFontsFromDir = original;
  }
});
