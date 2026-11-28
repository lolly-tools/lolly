// SPDX-License-Identifier: MPL-2.0
/**
 * QR Code has two modes: it makes a code (the default) and it reads one (scan mode,
 * which was the scan-code tool). These tests hold the line between the two:
 *
 * - every input is shown in exactly one mode, so a new input cannot leak into the other;
 * - a document, link or CLI call from before the mode existed is a make document;
 * - the render settings follow the mode (`render.when`), and make mode has no camera;
 * - the reader's safety model is the retired tool's, word for word;
 * - the hooks stay free of the page, so the tool keeps running in a hook Worker;
 * - a browser with no OffscreenCanvas gets a message, not silence.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/qr-code-scan-mode.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { matchesShowIf } from '../engine/src/inputs.ts';
import { resolveRender } from '../engine/src/render-when.ts';
import { analyseIsolation } from '../scripts/tool-isolation.ts';
import { baseHost } from './helpers/host.ts';

const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const manifest = JSON.parse(readFileSync(join(COMMUNITY, 'qr-code', 'tool.json'), 'utf8'));
const hooks = readFileSync(join(COMMUNITY, 'qr-code', 'hooks.js'), 'utf8');
const retiredHooks = readFileSync(join(COMMUNITY, 'scan-code', 'hooks.js'), 'utf8');
const tool: any = await loadTool('qr-code', (path: string) => readFile(join(COMMUNITY, path), 'utf8'));

type Input = { id: string; type: string; default?: unknown; showIf?: Record<string, unknown>; options?: { value: string }[] };
const inputs = manifest.inputs as Input[];

/** The inputs that belong to scan mode. Every other input but `mode` belongs to make mode. */
const SCAN_INPUTS = ['source', 'scanImage', 'scanText'];
const defaults = (): Record<string, unknown> => Object.fromEntries(inputs.map(i => [i.id, i.default]));

// ─── Every input is shown in exactly one mode ────────────────────────────────

test('the mode opens on make, and is the one input with no condition', () => {
  const mode = inputs.find(i => i.id === 'mode')!;
  assert.equal(mode.default, 'make');
  assert.deepEqual(mode.options!.map(o => o.value), ['make', 'scan']);
  assert.deepEqual(inputs.filter(i => !i.showIf).map(i => i.id), ['mode']);
});

test('every input states its mode: the scan inputs scan, every other input make', () => {
  for (const input of inputs) {
    if (input.id === 'mode') continue;
    const want = SCAN_INPUTS.includes(input.id) ? 'scan' : 'make';
    assert.equal(input.showIf?.mode, want, `${input.id} must be shown in ${want} mode only`);
  }
  assert.deepEqual(inputs.filter(i => i.showIf?.mode === 'scan').map(i => i.id), SCAN_INPUTS);
});

test('in scan mode no make input is shown, whatever the make settings are', () => {
  const payload = inputs.find(i => i.id === 'payload')!;
  const symbology = inputs.find(i => i.id === 'symbology')!;
  for (const p of payload.options!) for (const s of symbology.options!) for (const source of ['camera', 'image', 'paste']) {
    const values = { ...defaults(), mode: 'scan', source, payload: p.value, symbology: s.value, fill: 'gradient', gradientType: 'linear', frame: 'label', moduleShape: 'square' };
    const shown = inputs.filter(i => matchesShowIf(i.showIf as never, values)).map(i => i.id);
    const want = ['mode', 'source', ...(source === 'image' ? ['scanImage'] : source === 'paste' ? ['scanText'] : [])];
    assert.deepEqual(shown, want, `payload ${p.value}, symbology ${s.value}, source ${source}`);
  }
});

test('in make mode no scan input is shown, and each make input is shown as its own condition says', () => {
  const payload = inputs.find(i => i.id === 'payload')!;
  const symbology = inputs.find(i => i.id === 'symbology')!;
  for (const p of payload.options!) for (const s of symbology.options!) for (const source of ['camera', 'image', 'paste']) {
    // `mode` is left out on purpose for half the runs: a document from before the mode
    // existed has no such value, and the engine fills in the default.
    const values = { ...defaults(), source, payload: p.value, symbology: s.value };
    for (const input of inputs) {
      const shown = matchesShowIf(input.showIf as never, values);
      if (SCAN_INPUTS.includes(input.id)) { assert.equal(shown, false, `${input.id} is hidden in make mode`); continue; }
      if (input.id === 'mode') { assert.equal(shown, true); continue; }
      // The input's condition as it was before the mode existed: the same keys, less `mode`.
      const { mode: _mode, ...own } = input.showIf!;
      const before = Object.keys(own).length ? matchesShowIf(own as never, values) : true;
      assert.equal(shown, before, `${input.id} with payload ${p.value}, symbology ${s.value}`);
    }
  }
});

test('the address aliases of the make inputs are kept, and the scan inputs claim none', () => {
  const alias = Object.fromEntries(inputs.filter(i => (i as { urlKey?: string }).urlKey).map(i => [i.id, (i as { urlKey?: string }).urlKey]));
  assert.deepEqual(alias, { payload: 'p', symbology: 'sym' });
});

test('the CLI still lists the make inputs it listed before the mode existed', () => {
  const root = join(COMMUNITY, '..');
  const run = spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'qr-code'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  // An input gated on the mode alone, at the value the tool opens with, is listed as
  // an input with no condition is. A scan input is not.
  for (const flag of ['--mode=', '--url=', '--payload=', '--color=', '--background=', '--transparentBg=']) assert.ok(run.stdout.includes(`  ${flag}`), `${flag} is listed`);
  for (const flag of ['--source=', '--scanImage=', '--scanText=']) assert.ok(!run.stdout.includes(`  ${flag}`), `${flag} is not in the short list`);
});

// ─── The render settings follow the mode ─────────────────────────────────────

test('make mode keeps the export, the three actions and no camera', () => {
  const make = resolveRender(manifest.render, defaults());
  assert.equal(make, manifest.render, 'the block as written');
  assert.equal(make.export, undefined);
  assert.equal(make.webPreview, undefined);
  assert.deepEqual(make.actions, ['copy', 'download', 'save']);
  assert.equal(make.live, false, 'no camera control beside the logo');
  assert.equal(make.liveCameraWhen, undefined);
  assert.deepEqual([make.width, make.height], [600, 600]);
});

test('scan mode has no export, a live page, an empty action bar and the rear camera on the Camera source', () => {
  const scan = resolveRender(manifest.render, { ...defaults(), mode: 'scan' });
  assert.equal(scan.export, false);
  assert.equal(scan.webPreview, true);
  assert.deepEqual(scan.actions, []);
  assert.equal(scan.live, true);
  assert.equal(scan.liveFacing, 'environment');
  assert.deepEqual(scan.liveCameraWhen, { input: 'source', value: 'camera' });
  assert.deepEqual(scan.formats, manifest.render.formats, 'the format list is the tool\'s own');
});

// ─── A make document draws as it always did ──────────────────────────────────

test('a document with no mode draws the code, and draws the same with mode=make', async () => {
  const vals = { url: 'https://lolly.tools', color: '#111111', background: '#ffffff' };
  const plain = await createRuntime(tool, baseHost(), vals);
  const stated = await createRuntime(tool, baseHost(), { ...vals, mode: 'make' });
  const svg = plain.getHydratedString('{{{svgContent}}}') as string;
  assert.match(svg, /^<svg /);
  assert.equal(stated.getHydratedString('{{{svgContent}}}'), svg);
  assert.equal(plain.getHydratedText('{{scanKind}}') ?? '', '', 'no reader output in a make document');
  assert.equal(plain.getHydratedText(manifest.a11yLabel), 'Scannable code holding https://lolly.tools');
});

test('a scan document draws the reader and none of the code', async () => {
  const rt = await createRuntime(tool, baseHost(), { mode: 'scan', source: 'paste', scanText: 'https://example.com/a' });
  assert.equal(rt.getHydratedText('{{scanKind}}'), 'url');
  assert.equal(rt.getHydratedString('{{{svgContent}}}') ?? '', '', 'the maker did not run');
  assert.equal(rt.getHydratedText(manifest.a11yLabel), 'Link. No safety notes.');
});

// ─── The hooks: one dispatch, and the page is out of reach ───────────────────

/** The hooks as the engine loads them: a Function body, with the entries returned. */
function loadHooks(globals: Record<string, unknown> = {}) {
  const names = Object.keys(globals);
  // eslint-disable-next-line no-new-func
  const make = new Function('host', ...names, hooks + '\n;return { onInit, onInput, onFrame, beforeExport, classify };');
  return make(undefined, ...names.map(n => globals[n])) as {
    onInput(a: unknown): Promise<Record<string, unknown>>;
    onFrame(a: unknown): Promise<Record<string, unknown> | null> | null;
    beforeExport(a: unknown): void;
  };
}
const frame = (t: number) => ({ data: new Uint8ClampedArray(8 * 8 * 4), width: 8, height: 8, t });

test('a camera frame in make mode is dropped', async () => {
  const { onFrame } = loadHooks();
  const host = { scan: { detect: async () => { throw new Error('the reader must not run in make mode'); } } };
  assert.equal(await onFrame({ frame: frame(1000), model: [{ id: 'mode', value: 'make' }], host }), null);
  assert.equal(await onFrame({ frame: frame(2000), model: [], host }), null, 'a model with no mode is a make document');
});

test('scan mode refuses an export in plain words', () => {
  const { beforeExport } = loadHooks();
  assert.throws(() => beforeExport({ model: [{ id: 'mode', value: 'scan' }], format: 'png', opts: {} }), /Scan mode reads a code and has nothing to export/);
});

test('the hooks reach for nothing a hook Worker lacks', () => {
  const found = analyseIsolation(hooks);
  assert.deepEqual(found.realmBound, [], 'QR Code runs in a hook Worker (isolate), so its hooks may not use the page');
  assert.equal(manifest.isolate, true);
});

test('the safety model is the retired tool\'s, word for word', () => {
  // From the first helper the classifier calls to the end of `classify`. `_esc` sits
  // above this span and is the one helper that took a prefix on the way across.
  const span = (src: string): string => {
    const from = src.indexOf('// Mask a secret completely');
    const to = src.indexOf('// ─── View model for the template');
    assert.ok(from > 0 && to > from, 'the classifier span was not found');
    return src.slice(from, to);
  };
  // One comment in the span mentions the view model builder, which took the prefix too.
  assert.equal(span(hooks).replace('_scViewModel escapes', '_viewModel escapes'), span(retiredHooks));
  assert.match(span(hooks), /function classify\(rawValue, format\)/);
});

// ─── No OffscreenCanvas: a message, not silence ──────────────────────────────

const scanModel = (source: string, extra: { id: string; value: unknown }[] = []) =>
  [{ id: 'mode', value: 'scan' }, { id: 'source', value: source }, ...extra];

test('an image cannot be read without OffscreenCanvas, and the tool says what to do', async () => {
  // `OffscreenCanvas` is shadowed as undefined, as on a browser that has none.
  const { onInput } = loadHooks({ OffscreenCanvas: undefined });
  const host = {
    raster: { decode: async () => ({ width: 4, height: 4 }) },
    scan: { detect: async () => { throw new Error('nothing to hand the decoder'); } },
  };
  const vm = await onInput({ model: scanModel('image', [{ id: 'scanImage', value: { bytes: new Uint8Array([1, 2, 3]) } }]), host });
  assert.equal(vm.scanNotice, 'This browser cannot read a code from an image. Switch Source to Text and paste the code\'s text.');
  assert.equal(vm.scanEmpty, true);
});

test('with OffscreenCanvas an image is read and no notice is shown', async () => {
  class Canvas {
    width: number; height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; }
    getContext() { return { drawImage() {}, getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) }; }
  }
  const { onInput } = loadHooks({ OffscreenCanvas: Canvas });
  const host = {
    raster: { decode: async () => ({ width: 4, height: 4 }) },
    scan: { detect: async () => [{ format: 'qr_code', rawValue: 'https://lolly.tools' }] },
  };
  const vm = await onInput({ model: scanModel('image', [{ id: 'scanImage', value: { bytes: new Uint8Array([1, 2, 3]) } }]), host });
  assert.equal(vm.scanNotice, '');
  assert.equal(vm.scanKind, 'url');
});

test('a camera frame that cannot be drawn is still read, and the tool says the picture is missing', async () => {
  const { onFrame } = loadHooks({ OffscreenCanvas: undefined });
  const host = { scan: { detect: async () => [{ format: 'qr_code', rawValue: 'https://lolly.tools', corners: [[0, 0], [8, 0], [8, 8], [0, 8]] }] } };
  const vm = (await onFrame({ frame: frame(1000), model: scanModel('camera'), host }))!;
  assert.equal(vm.scanNotice, 'This browser cannot show the camera picture. A code held in front of the camera is still read.');
  assert.equal(vm.scanKind, 'url', 'the code in view is read from the frame itself');
  assert.equal(Object.hasOwn(vm, 'scanFrameSrc'), false);
});

test('pasted text needs no canvas at all', async () => {
  const { onInput } = loadHooks({ OffscreenCanvas: undefined });
  const vm = await onInput({ model: scanModel('paste', [{ id: 'scanText', value: 'javascript:alert(1)' }]), host: {} });
  assert.equal(vm.scanNotice, '');
  assert.equal(vm.scanOpenUrl, '');
  assert.match(String(vm.scanWarnHtml), /never openable/);
});

// ─── In a hook Worker the shell refuses host.raster, and the Worker does the work ──

const REFUSED = (method: string) => async () => { throw new Error(`host.raster.${method} is not permitted from an isolated hook`); };

test('a camera frame the host refuses to encode is drawn on the Worker\'s own canvas', async () => {
  let asked = 0;
  class Canvas {
    width: number; height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; }
    getContext() { return { createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }; }
    async convertToBlob() { return { arrayBuffer: async () => new Uint8Array([7, 7, 7]).buffer }; }
  }
  const { onFrame } = loadHooks({ OffscreenCanvas: Canvas });
  const refuse = REFUSED('encode');
  const host = { raster: { encode: async () => { asked++; return refuse(); } }, scan: { detect: async () => [] } };
  const first = (await onFrame({ frame: frame(1000), model: scanModel('camera'), host }))!;
  assert.match(String(first.scanFrameSrc), /^data:image\/jpeg;base64,/);
  assert.equal(first.scanNotice, '');
  const second = (await onFrame({ frame: frame(1200), model: scanModel('camera'), host }))!;
  assert.match(String(second.scanFrameSrc), /^data:image\/jpeg;base64,/);
  assert.equal(asked, 1, 'a host that refused once is not asked for every frame');
});

test('an image the host refuses to decode is decoded in the Worker, turned by its EXIF', async () => {
  class Canvas {
    width: number; height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; }
    getContext() { return { drawImage() {}, getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }) }; }
  }
  const seen: unknown[] = [];
  const createImageBitmap = async (_blob: unknown, opts: unknown) => { seen.push(opts); return { width: 4, height: 4, close() {} }; };
  const { onInput } = loadHooks({ OffscreenCanvas: Canvas, createImageBitmap });
  const host = { raster: { decode: REFUSED('decode') }, scan: { detect: async () => [{ format: 'qr_code', rawValue: 'https://lolly.tools' }] } };
  const vm = await onInput({ model: scanModel('image', [{ id: 'scanImage', value: { bytes: new Uint8Array([1, 2, 3]) } }]), host });
  assert.equal(vm.scanKind, 'url');
  assert.deepEqual(seen, [{ imageOrientation: 'from-image' }]);
});

test('a picture over the shell\'s pixel limit is closed and not read', async () => {
  let closed = 0;
  const createImageBitmap = async () => ({ width: 9000, height: 9000, close() { closed++; } });
  const { onInput } = loadHooks({ OffscreenCanvas: class { getContext() { throw new Error('no canvas for a refused picture'); } }, createImageBitmap });
  const host = { raster: { decode: REFUSED('decode') }, scan: { detect: async () => { throw new Error('nothing to hand the decoder'); } } };
  const vm = await onInput({ model: scanModel('image', [{ id: 'scanImage', value: { bytes: new Uint8Array([1, 2, 3]) } }]), host });
  assert.equal(closed, 1);
  assert.equal(vm.scanEmpty, true);
});

// ─── The retired tool ────────────────────────────────────────────────────────

test('scan-code is retired into QR Code and keeps loading under its own id', async () => {
  const retired = JSON.parse(readFileSync(join(COMMUNITY, 'scan-code', 'tool.json'), 'utf8'));
  assert.equal(retired.deprecated, true);
  assert.equal(retired.replacedBy, 'qr-code');
  assert.equal(retired.listed, false);
  assert.equal(retired.featured, undefined, 'a retired tool holds no featured tile');
  const loaded: any = await loadTool('scan-code', (path: string) => readFile(join(COMMUNITY, path), 'utf8'));
  const rt = await createRuntime(loaded, baseHost(), { mode: 'paste', paste: 'https://example.com' });
  assert.equal(rt.getHydratedText('{{scanKind}}'), 'url');
});
