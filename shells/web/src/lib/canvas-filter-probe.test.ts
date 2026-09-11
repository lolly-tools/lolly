// SPDX-License-Identifier: MPL-2.0
/*
 * The ctx.filter functional probe - lib/canvas-filter-probe.ts (plan 104 section 11 S1).
 *
 * Run directly:  node --test shells/web/src/lib/canvas-filter-probe.test.ts
 *
 * jsdom has no raster canvas and Node has none at all, so what is testable here is
 * the DECISION, not the pixels: the module's core takes a structural 2D context, and
 * these stubs supply the four shapes a real engine can present - 
 *
 *   blurs        the property exists and spreads ink        -> supported
 *   ignores      the property exists, the value does nothing -> NOT supported
 *   absent       no `filter` property, but assignment silently sticks as an expando
 *                (measured on WebKit 26.5, 2026-08-11)       -> NOT supported
 *   hostile      getImageData throws / the control is dirty  -> NOT supported
 *
 * The pixels are proved in `tests/canvas-filter-probe.browser.test.ts`, which runs
 * this same module in a real engine on both context kinds and inside a Worker.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probeCanvasFilter,
  canvasFilterWorksForKind,
  canvasKindOf,
  canvasFilterVerdicts,
  resetCanvasFilterProbeCache,
  type ProbeContext2D,
} from './canvas-filter-probe.ts';

const SIZE = 16;

interface StubOpts {
  /** Does assigning a blur actually spread ink? */
  blurs?: boolean;
  /** Spread ink whatever the filter says - the control pass comes back dirty, so no
   *  spread can be ATTRIBUTED to the filter. */
  alwaysBlurs?: boolean;
  /** getImageData throws (a tainted or unsupported readback). */
  readThrows?: boolean;
}

/**
 * A one-channel stub canvas. `fillRect` paints a rect; when a blur filter is set AND
 * the stub implements it, the rect is box-blurred (radius 3) before compositing - 
 * enough spread to reach the probe's sample pixel, not so much that a broken
 * threshold would pass by luck.
 */
class StubCtx implements ProbeContext2D {
  filter = 'none';
  fillStyle: unknown = '#000';
  px: number[];
  reads = 0;
  opts: StubOpts;
  constructor(opts: StubOpts = {}) {
    this.opts = opts;
    this.px = new Array(SIZE * SIZE).fill(0);
  }
  clearRect(x: number, y: number, w: number, h: number): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.at(i, j, 0);
  }
  fillRect(x: number, y: number, w: number, h: number): void {
    const layer = new Array(SIZE * SIZE).fill(0);
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        if (i >= 0 && i < SIZE && j >= 0 && j < SIZE) layer[j * SIZE + i] = 255;
      }
    }
    const blur = /^blur\(\s*([\d.]+)px\s*\)$/.test(this.filter);
    const out = this.opts.alwaysBlurs || (blur && this.opts.blurs) ? boxBlur(layer, 3) : layer;
    for (let k = 0; k < out.length; k++) this.px[k] = Math.max(this.px[k] ?? 0, out[k] ?? 0);
  }
  getImageData(x: number, y: number, w: number, h: number): { data: ArrayLike<number> } {
    this.reads++;
    if (this.opts.readThrows) throw new Error('SecurityError: tainted canvas');
    const data: number[] = [];
    for (let j = y; j < y + h; j++) {
      for (let i = x; i < x + w; i++) {
        const a = this.px[j * SIZE + i] ?? 0;
        data.push(a, a, a, a);   // premultiplied white, exactly like a real readback
      }
    }
    return { data };
  }
  private at(x: number, y: number, v: number): void {
    if (x >= 0 && x < SIZE && y >= 0 && y < SIZE) this.px[y * SIZE + x] = v;
  }
}

function boxBlur(src: number[], r: number): number[] {
  const out = new Array(SIZE * SIZE).fill(0);
  const n = (2 * r + 1) ** 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let sum = 0;
      for (let j = y - r; j <= y + r; j++) {
        for (let i = x - r; i <= x + r; i++) {
          if (i >= 0 && i < SIZE && j >= 0 && j < SIZE) sum += src[j * SIZE + i] ?? 0;
        }
      }
      out[y * SIZE + x] = sum / n;
    }
  }
  return out;
}

test('a context whose filter really blurs is supported', () => {
  const ctx = new StubCtx({ blurs: true });
  assert.equal(probeCanvasFilter(ctx), true);
  // and it left the context neutral, so a caller can hand it a live scratch twice
  assert.equal(ctx.filter, 'none');
});

test('a context that stores the filter and ignores it is NOT supported', () => {
  const ctx = new StubCtx({ blurs: false });
  assert.equal(probeCanvasFilter(ctx), false);
  // the trap this module exists for: the property is there and reads back fine
  ctx.filter = 'blur(2px)';
  assert.equal('filter' in ctx, true);
  assert.equal(ctx.filter, 'blur(2px)');
});

test('a context with NO filter property is not supported - and assignment lies', () => {
  // Measured behavior of WebKit 26.5 / Safari 26 (2026-08-11): `filter` is on neither the
  // context nor CanvasRenderingContext2D.prototype, yet `ctx.filter = 'blur(2px)'`
  // succeeds as a plain expando and reads back verbatim. An assign-and-read-back
  // support check says YES there. The `in` test must come first, and does.
  const bare = {
    fillStyle: '#000',
    clearRect(): void {},
    fillRect(): void {},
    getImageData(): { data: ArrayLike<number> } { return { data: [0, 0, 0, 0] }; },
  };
  assert.equal('filter' in bare, false, 'the stub really lacks the property');
  assert.equal(probeCanvasFilter(bare as unknown as ProbeContext2D), false);
  (bare as Record<string, unknown>).filter = 'blur(2px)';
  assert.equal((bare as Record<string, unknown>).filter, 'blur(2px)', 'assignment still sticks');
});

test('a readback that throws is not supported', () => {
  assert.equal(probeCanvasFilter(new StubCtx({ blurs: true, readThrows: true })), false);
});

test('a dirty control pass is not supported - spread must be ATTRIBUTABLE', () => {
  // This stub spreads ink with the filter set to 'none' too, so ink at the sample
  // pixel says nothing about the filter. The probe refuses rather than claiming a
  // support it did not observe - false only ever costs the caller the slower lane.
  assert.equal(probeCanvasFilter(new StubCtx({ alwaysBlurs: true })), false);
});

test('no context at all is not supported', () => {
  assert.equal(probeCanvasFilter(null), false);
  assert.equal(probeCanvasFilter(undefined), false);
});

test('the verdict is cached per context kind, and probed at most once each', () => {
  resetCanvasFilterProbeCache();
  let canvasMade = 0, offMade = 0;
  const ask = (): boolean => canvasFilterWorksForKind('canvas', () => { canvasMade++; return new StubCtx({ blurs: true }); });
  assert.equal(ask(), true);
  assert.equal(ask(), true);
  assert.equal(ask(), true);
  assert.equal(canvasMade, 1, 'one probe for three questions');

  // The other kind is a separate implementation, so it gets its own probe...
  assert.equal(canvasFilterWorksForKind('offscreen', () => { offMade++; return new StubCtx({ blurs: false }); }), false);
  assert.equal(offMade, 1);
  assert.deepEqual(canvasFilterVerdicts(), { canvas: true, offscreen: false });

  // ...and a reset re-probes both.
  resetCanvasFilterProbeCache();
  assert.deepEqual(canvasFilterVerdicts(), {});
  assert.equal(ask(), true);
  assert.equal(canvasMade, 2);
  resetCanvasFilterProbeCache();
});

test('a factory that throws caches a false rather than propagating', () => {
  resetCanvasFilterProbeCache();
  let calls = 0;
  const ask = (): boolean => canvasFilterWorksForKind('canvas', () => {
    calls++;
    throw new Error('canvas allocation refused');
  });
  assert.equal(ask(), false);
  assert.equal(ask(), false);
  assert.equal(calls, 1);
  resetCanvasFilterProbeCache();
});

test('kind detection follows the canvas, then the realm', () => {
  class FakeOffscreen {}
  class FakeHtmlCanvas {}
  const g = globalThis as Record<string, unknown>;
  const hadOff = 'OffscreenCanvas' in g, hadEl = 'HTMLCanvasElement' in g;
  const prevOff = g.OffscreenCanvas, prevEl = g.HTMLCanvasElement;
  g.OffscreenCanvas = FakeOffscreen;
  g.HTMLCanvasElement = FakeHtmlCanvas;
  try {
    assert.equal(canvasKindOf({ canvas: new FakeOffscreen() } as never), 'offscreen');
    assert.equal(canvasKindOf({ canvas: new FakeHtmlCanvas() } as never), 'canvas');
    // No context and no document (this Node realm) reads as a worker-shaped realm.
    assert.equal(canvasKindOf(), 'offscreen');
    assert.equal(canvasKindOf(null), 'offscreen');
  } finally {
    if (hadOff) g.OffscreenCanvas = prevOff; else delete g.OffscreenCanvas;
    if (hadEl) g.HTMLCanvasElement = prevEl; else delete g.HTMLCanvasElement;
  }
  // Without an OffscreenCanvas global there is nothing else it could be.
  assert.equal(canvasKindOf(), 'canvas');
});
