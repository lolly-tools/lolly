// SPDX-License-Identifier: MPL-2.0
/**
 * Every still raster export drives the frame clock, at the size of the file it is
 * about to write (plan 265 milestone 2, E1).
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test tests/export-still-frame-clock.test.ts
 *
 * A tool that registers `__lollyFrameRender` on its canvas (the 3D studio) is asked
 * for one deterministic frame before the capture, and is told how big the output is
 * so it can re-render at that size instead of handing back the on-screen preview for
 * the capture to enlarge. PNG/JPEG (renderRaster) and WebP/AVIF (renderBitmap) already
 * did; TIFF, BMP and CMYK TIFF did not, so a 3D Studio TIFF at any size other than the
 * canvas was an upscaled preview while the guide said it was rendered again.
 *
 * The technique is `shells/web/src/bridge/frame-source-canvas.test.ts`'s: a fake
 * dom-to-image and a plain-object node, so the real renderers run with no browser.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createExportAPI, __setDomToImageForTest } from '../shells/web/src/bridge/export.ts';
import type { WebHost } from '../shells/web/src/bridge/export-shared.ts';

type ClockCall = [number, number | undefined, { width: number; height: number } | undefined];

/** A canvas double: fixed size, readable pixels, encodable to a blob. */
function fakeCanvas(width: number, height: number) {
  const data = new Uint8ClampedArray(width * height * 4).fill(200);
  return {
    width,
    height,
    getContext: () => ({
      getImageData: () => ({ data, width, height }),
      putImageData: () => {},
      drawImage: () => {},
      fillRect: () => {},
      clearRect: () => {},
      fillStyle: '',
    }),
    toBlob: (cb: (b: Blob) => void, type?: string) => cb(new Blob([new Uint8Array([1, 2, 3])], { type: type || 'image/png' })),
  };
}

// A 1x1 transparent PNG - what the dataURL path of renderRaster fetches and stamps.
const ONE_PX_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** dom-to-image, faked: every capture hands back a canvas of the size it was asked for. */
function fakeDomToImage() {
  const sizes: Array<{ width: number; height: number }> = [];
  const capture = (_node: unknown, opts: { width: number; height: number }) => {
    sizes.push({ width: opts.width, height: opts.height });
    return fakeCanvas(opts.width, opts.height);
  };
  return {
    sizes,
    lib: {
      toCanvas: capture,
      toPng: (_n: unknown, o: { width: number; height: number }) => { sizes.push({ width: o.width, height: o.height }); return ONE_PX_PNG; },
      toJpeg: (_n: unknown, o: { width: number; height: number }) => { sizes.push({ width: o.width, height: o.height }); return ONE_PX_PNG; },
    },
  };
}

/** The export node: 200x150 on screen, with the frame-clock hook a studio registers. */
function clockedNode(calls: ClockCall[]) {
  return {
    getBoundingClientRect: () => ({ width: 200, height: 150, x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 150 }),
    querySelectorAll: () => [] as unknown[],
    querySelector: () => null,
    matches: () => false,
    __lollyFrameRender: (t: number, clipSec?: number, size?: { width: number; height: number }) => { calls.push([t, clipSec, size]); },
    __lollyFrameDriven: false,
  } as unknown as Element;
}

/** A host with only what the export entry reads. */
const host = { log: () => {} } as unknown as WebHost;

/** The export entry reads `document` and `window`, and neither exists in Node, so give
 *  it inert stand-ins for the run. */
async function withNeutralGlobals(run: () => Promise<void>) {
  const g = globalThis as Record<string, unknown>;
  const saved = { doc: g.document, win: g.window };
  g.document = { fonts: { ready: Promise.resolve() }, createElement: () => fakeCanvas(1, 1) };
  g.window = {};
  try { await run(); } finally { g.document = saved.doc; g.window = saved.win; }
}

// One case per still renderer. The size asked for is 640x480, which is neither the
// node's own box nor anything a default could produce by accident.
const STILLS: Array<[string, string]> = [
  ['png', 'renderRaster'],
  ['jpg', 'renderRaster'],
  ['webp', 'renderBitmap'],
  ['avif', 'renderBitmap'],
  ['tiff', 'renderTiff'],
  ['bmp', 'renderBmp'],
  ['cmyk-tiff', 'renderCmykTiff'],
];

for (const [format, renderer] of STILLS) {
  test(`${format}: ${renderer} drives the frame clock once, at the export size`, async () => {
    await withNeutralGlobals(async () => {
      const { lib, sizes } = fakeDomToImage();
      __setDomToImageForTest(lib);
      const calls: ClockCall[] = [];
      const node = clockedNode(calls);
      try {
        const blob = await createExportAPI(host).render(node, format, { width: 640, height: 480 });
        assert.ok(blob.size > 0, 'the export produced bytes');
        assert.equal(calls.length, 1, 'exactly one deterministic frame is asked for');
        assert.deepEqual(calls[0]![0], 0, 'a still is the base frame, t=0');
        assert.equal(calls[0]![1], undefined, 'a still names no clip length');
        assert.deepEqual(calls[0]![2], { width: 640, height: 480 }, 'the tool is told the size of the file being written');
        assert.deepEqual(sizes[0], { width: 640, height: 480 }, 'and the capture is taken at that size');
        assert.equal((node as unknown as { __lollyFrameDriven: boolean }).__lollyFrameDriven, false, 'the clock is released afterwards');
      } finally {
        __setDomToImageForTest(null);
      }
    });
  });
}

test('a node with no frame-clock hook exports exactly as before', async () => {
  await withNeutralGlobals(async () => {
    const { lib, sizes } = fakeDomToImage();
    __setDomToImageForTest(lib);
    const node = {
      getBoundingClientRect: () => ({ width: 200, height: 150, x: 0, y: 0, top: 0, left: 0, right: 200, bottom: 150 }),
      querySelectorAll: () => [] as unknown[],
      querySelector: () => null,
      matches: () => false,
    } as unknown as Element;
    try {
      const blob = await createExportAPI(host).render(node, 'tiff', { width: 320, height: 240 });
      assert.ok(blob.size > 0);
      assert.deepEqual(sizes[0], { width: 320, height: 240 });
    } finally {
      __setDomToImageForTest(null);
    }
  });
});
