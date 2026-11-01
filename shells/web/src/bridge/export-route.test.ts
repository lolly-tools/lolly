// SPDX-License-Identifier: MPL-2.0
/**
 * The Design still route on the web shell (plan 326): which renderer draws the page,
 * what the credential records, and that every failure on the GPU route falls back to
 * the browser renderer without bothering the person (decision 1, 2026-10-30).
 *
 * The GPU itself is stubbed here; the real renderer, its pixels against the browser's
 * and the credentials of both routes are compared in tests/export-route-parity.browser.test.ts.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/bridge/export-route.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { COMPATIBILITY_RASTER_RENDERER, describeDesignExportRoute, designExportRouteFields, designGpuRefusals, parseDesignExportRouteChoice } from '../../../../engine/src/design-export-route.ts';

const dom = new JSDOM('<!doctype html><html><body><div data-frame-id="cover" style="width:320px;height:200px"></div></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const { setExportHost } = await import('./export-shared.ts');
const { routeDesignStill, GPU_ROUTE_BUDGET } = await import('./export-route.ts');
const { EXPORT_ROUTE_KEY, exportRouteChoice, setFlagMirror, EXPORT_GPU_FLAG } = await import('../feature-flags.ts');
const { WebGpuError } = await import('../lib/webgpu/device.ts');
type Opts = Parameters<typeof routeDesignStill>[2];
type Deps = Parameters<typeof routeDesignStill>[3];

const rows = [
  { id: 'cover', kind: 'frame', x: 0, y: 0, w: 320, h: 200, bg: '#f4f1ea' },
  { id: 'chip', frame: 'cover', kind: 'box', x: 20, y: 20, w: 120, h: 80, bg: '#d9480f' },
];
const logs: Array<[string, string]> = [];
setExportHost({
  log: (level: string, message: string) => { logs.push([level, message]); },
  text: { toPath: async () => ({ d: '', advance: 0 }) },
  assets: { get: async () => null },
} as never);
const node = document.querySelector('[data-frame-id]')!;
const doc = (extra: object = {}): Opts => ({ sourceDocument: { toolId: 'design', values: { boxes: rows } }, c2pa: true, _ingredientSink: [], ...extra } as Opts);
const legacyBlob = new Blob(['compatibility'], { type: 'image/png' });

function deps(over: Partial<Deps> = {}): Deps & { calls: number } {
  const d = {
    calls: 0,
    compatibility: async () => { d.calls++; return legacyBlob; },
    size: () => ({ width: 640, height: 400, nodeWidth: 320, nodeHeight: 200, dpi: 192 }),
    finishPng: async () => new Blob(['gpu'], { type: 'image/png' }),
    ...over,
  };
  return d;
}
const withGpu = <T>(run: () => Promise<T>): Promise<T> => {
  Object.defineProperty(globalThis, 'navigator', { value: { gpu: {} }, configurable: true, writable: true });
  return run();
};
const reset = () => { logs.length = 0; localStorage.clear(); };

test('the choice reads the stored override first, then the internal flag, and is off by default', async () => {
  reset();
  assert.equal(EXPORT_GPU_FLAG.default, false);
  assert.equal(await exportRouteChoice(), 'auto');
  setFlagMirror(EXPORT_GPU_FLAG.id, true);
  assert.equal(await exportRouteChoice(), 'ops');
  localStorage.setItem(EXPORT_ROUTE_KEY, 'legacy');
  assert.equal(await exportRouteChoice(), 'legacy', 'the stored override wins over the flag');
  localStorage.setItem(EXPORT_ROUTE_KEY, 'sideways');
  assert.equal(await exportRouteChoice(), 'ops', 'an unknown value is ignored');
  assert.equal(parseDesignExportRouteChoice(' OPS '), 'ops');
  assert.equal(parseDesignExportRouteChoice(undefined), null);
});

test('the request alone refuses what the GPU route does not draw', () => {
  const base = { sourceDocument: { toolId: 'design', values: {} } };
  assert.deepEqual(designGpuRefusals('png', base, 'ops'), []);
  assert.match(designGpuRefusals('png', base, 'auto').join(), /not switched on/);
  assert.match(designGpuRefusals('png', base, 'legacy').join(), /forced/);
  assert.match(designGpuRefusals('jpeg', base, 'ops').join(), /does not draw JPEG yet/);
  assert.match(designGpuRefusals('png', { ...base, hdr: true }, 'ops').join(), /HDR/);
  assert.match(designGpuRefusals('png', { sourceDocument: { toolId: 'design', values: { editingRange: 'hdr' } } }, 'ops').join(), /HDR/);
  assert.match(designGpuRefusals('png', { ...base, watermark: true }, 'ops').join(), /watermark/);
  assert.match(designGpuRefusals('png', { ...base, thumbnail: true }, 'ops').join(), /thumbnail/);
  assert.match(designGpuRefusals('png', { ...base, background: 'transparent' }, 'ops').join(), /background/);
  assert.match(designGpuRefusals('png', {}, 'ops').join(), /no authored Design document/);
});

test('the credential keys are flat text, and absent when no route was chosen', () => {
  assert.deepEqual(designExportRouteFields(null), {});
  assert.deepEqual(designExportRouteFields({ route: 'gpu', renderer: 'recipe-v4' }), { route: 'gpu', renderer: 'recipe-v4' });
  assert.equal(describeDesignExportRoute('png', { route: 'compatibility', renderer: COMPATIBILITY_RASTER_RENDERER }, ['a reason']),
    'Design PNG export: drawn by the compatibility renderer (dom-to-image) because a reason.');
});

test('by default a Design PNG is drawn by the browser renderer, recorded as such and logged', async () => {
  reset();
  const opts = doc(), d = deps();
  assert.equal(await routeDesignStill(node, 'png', opts, d), legacyBlob);
  assert.equal(d.calls, 1);
  assert.deepEqual(opts._exportRoute, { route: 'compatibility', renderer: 'dom-to-image' });
  assert.deepEqual(logs, [['info', 'Design PNG export: drawn by the compatibility renderer (dom-to-image) because the GPU route is not switched on.']]);
});

test('with the GPU route on, a refused page goes to the browser renderer with the findings named', async () => {
  reset(); localStorage.setItem(EXPORT_ROUTE_KEY, 'ops');
  await withGpu(async () => {
    const opts = { ...doc(), sourceDocument: { toolId: 'design', values: { boxes: [...rows, { id: 'blurred', frame: 'cover', kind: 'box', x: 10, y: 10, w: 40, h: 40, bg: '#1c7ed6', blur: 4 }] } } } as Opts;
    const d = deps({ raster: async () => { throw new Error('the renderer must not run for a refused page'); } });
    assert.equal(await routeDesignStill(node, 'png', opts, d), legacyBlob);
    assert.equal(d.calls, 1);
    assert.equal(opts._exportRoute?.route, 'compatibility');
    assert.equal(logs[0]![0], 'info');
    assert.match(logs[0]![1], /does not carry yet: .*blurred/);
  });
});

test('a lost device falls back silently: one compatibility render, a warning in the log, nothing thrown', async () => {
  reset(); localStorage.setItem(EXPORT_ROUTE_KEY, 'ops');
  await withGpu(async () => {
    const opts = doc(), d = deps({ raster: async () => { throw new WebGpuError('WEBGPU_DEVICE_LOST', 'The graphics device was lost.'); } });
    assert.equal(await routeDesignStill(node, 'png', opts, d), legacyBlob);
    assert.equal(d.calls, 1);
    assert.deepEqual(opts._exportRoute, { route: 'compatibility', renderer: 'dom-to-image' });
    assert.deepEqual(logs.map(([level]) => level), ['warn']);
    assert.match(logs[0]![1], /because the GPU route failed \(WebGpuError: The graphics device was lost\.\)/);
  });
});

test('a GPU route past its time budget falls back the same way', async () => {
  reset(); localStorage.setItem(EXPORT_ROUTE_KEY, 'ops');
  const budget = GPU_ROUTE_BUDGET.ms;
  GPU_ROUTE_BUDGET.ms = 20;
  try {
    await withGpu(async () => {
      const opts = doc(), d = deps({ raster: (_e, signal) => new Promise((_resolve, reject) => { signal.addEventListener('abort', () => reject(signal.reason), { once: true }); }) });
      assert.equal(await routeDesignStill(node, 'png', opts, d), legacyBlob);
      assert.equal(d.calls, 1);
      assert.match(logs[0]![1], /TimeoutError: The GPU route ran past its time budget/);
    });
  } finally { GPU_ROUTE_BUDGET.ms = budget; }
});

test('a wrong-sized result and an encoder failure after drawing both fall back', async () => {
  reset(); localStorage.setItem(EXPORT_ROUTE_KEY, 'ops');
  await withGpu(async () => {
    const tiny = { width: 2, height: 2, data: new Uint8ClampedArray(16), identity: 'x', allocation: { peakBytes: 0, created: 0, destroyed: 0, liveBytes: 0 } };
    const opts = doc(), d = deps({ raster: async () => tiny });
    assert.equal(await routeDesignStill(node, 'png', opts, d), legacyBlob);
    assert.match(logs[0]![1], /returned 2 x 2 pixels for a 640 x 400 export/);
    // The pixels are right, but the finishing step fails (here: no 2D canvas in this DOM).
    const full = { ...tiny, width: 640, height: 400, data: new Uint8ClampedArray(640 * 400 * 4) };
    const after = deps({ raster: async () => full });
    assert.equal(await routeDesignStill(node, 'png', doc(), after), legacyBlob);
    assert.equal(after.calls, 1);
    assert.equal(logs.at(-1)![0], 'warn');
  });
});

test('the person cancelling the export is passed on, not drawn again', async () => {
  reset(); localStorage.setItem(EXPORT_ROUTE_KEY, 'ops');
  await withGpu(async () => {
    const cancel = new AbortController();
    const opts = doc({ signal: cancel.signal }), d = deps({ raster: async () => { cancel.abort(new DOMException('Cancelled', 'AbortError')); throw cancel.signal.reason; } });
    await assert.rejects(() => routeDesignStill(node, 'png', opts, d), /Cancelled/);
    assert.equal(d.calls, 0);
  });
});

test('a request that changes the page proportions, or a page not at its authored size, keeps the browser renderer', async () => {
  reset(); localStorage.setItem(EXPORT_ROUTE_KEY, 'ops');
  await withGpu(async () => {
    const stretched = deps({ size: () => ({ width: 640, height: 640, nodeWidth: 320, nodeHeight: 200, dpi: 96 }) });
    await routeDesignStill(node, 'png', doc(), stretched);
    assert.match(logs.at(-1)![1], /changes the page's proportions/);
    const zoomed = deps({ size: () => ({ width: 320, height: 200, nodeWidth: 160, nodeHeight: 100, dpi: 96 }) });
    await routeDesignStill(node, 'png', doc(), zoomed);
    assert.match(logs.at(-1)![1], /not at its authored size/);
  });
});
