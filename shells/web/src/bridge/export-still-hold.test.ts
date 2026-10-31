// SPDX-License-Identifier: MPL-2.0
/**
 * Every still export holds a frame-clock tool at its still pose, through the real export entry.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/bridge/export-still-hold.test.ts
 *
 * Only the raster renderers used to call the frame clock. The vector, print and document
 * writers walked the live node as it stood, so Certificate's PDF or SVG, exported while its
 * preview reveal was playing, recorded a half-drawn sheet. The hold now sits in the one entry
 * every format passes through, so these drive host.export.render itself with a text export,
 * the cheapest format that reads the page, standing in for the walkers.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
const g = globalThis as Record<string, unknown>;
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLCanvasElement', 'SVGElement', 'NodeFilter', 'MutationObserver', 'XMLSerializer', 'DOMParser', 'getComputedStyle']) {
  if (g[key] === undefined) g[key] = key === 'window' ? dom.window : key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : (dom.window as unknown as Record<string, unknown>)[key];
}

const { createExportAPI } = await import('./export.ts');
const { holdStillExports } = await import('./frame-clock.ts');
type Host = Parameters<typeof createExportAPI>[0];
const api = createExportAPI({ log: () => {} } as unknown as Host);

type Clocked = HTMLCanvasElement & { __lollyFrameRender?: (t: number, clipSec?: number) => void; __lollyFrameDriven?: boolean };

/**
 * A sheet whose part reads "half" while its entrance plays and "finished" once the clock
 * settles it, the way Certificate's template behaves. `seen` records each clock call and
 * whether the flag was up when the export read the part.
 */
function sheet(attrs = '') {
  const root = document.createElement('div');
  root.innerHTML = `<div ${attrs}><p class="part">half</p><canvas width="0" height="0"></canvas></div>`;
  document.body.replaceChildren(root);
  const part = root.querySelector('.part')!;
  const clock = root.querySelector('canvas') as Clocked;
  const calls: Array<[number, number | undefined]> = [];
  clock.__lollyFrameRender = (t, clipSec) => {
    calls.push([t, clipSec]);
    if (!(clipSec! > 0)) part.textContent = 'finished';
  };
  return { root, part, clock, calls };
}

test('a still export asks the clock for its still pose before reading the page', async () => {
  const { root, clock, calls } = sheet();
  const text = await (await api.render(root, 'txt')).text();
  assert.equal(text.trim(), 'finished', 'the export read the settled sheet, not the entrance');
  assert.deepEqual(calls, [[0, undefined]]);
  assert.equal(clock.__lollyFrameDriven, false, 'the tool gets its loop back once the file is written');
});

test('the tool loop stays frozen while the page is read', async () => {
  const { root, part, clock } = sheet();
  // The walk asks each element for aria-hidden before reading it, which is the moment a
  // live loop rewriting inline styles would corrupt the file.
  const flags: Array<boolean | undefined> = [];
  const own = part.getAttribute.bind(part);
  part.getAttribute = (name: string) => { flags.push(clock.__lollyFrameDriven); return own(name); };
  await api.render(root, 'txt');
  assert.ok(flags.length > 0, 'the export read the part');
  assert.deepEqual([...new Set(flags)], [true], 'the driven flag was up for every read');
  assert.equal(clock.__lollyFrameDriven, false);
});

test('a payload the engine already built reads no page, so the clock is left alone', async () => {
  const { root, calls } = sheet();
  const blob = await api.render(root, 'json', { dataText: '{}', dataMime: 'application/json' });
  assert.equal(await blob.text(), '{}');
  assert.deepEqual(calls, []);
});

test('a sequence stage keeps the frame its playhead posed', async () => {
  const { root, calls } = sheet('data-sequence');
  const text = await (await api.render(root, 'txt')).text();
  assert.equal(text.trim(), 'half');
  assert.deepEqual(calls, []);
});

/**
 * The engine's order for one export, on a runtime the web shell wrapped: the tool's
 * beforeExport hook, then host.export.render (this file's real entry), then afterExport.
 */
function toolRuntime(manifest: { hooks?: { beforeExport?: boolean } }, beforeExport: (node: Element, format: string) => void) {
  return holdStillExports({
    async export(node: unknown, format: string) {
      if (manifest.hooks?.beforeExport) beforeExport(node as Element, format);
      return api.render(node as Element, format);
    },
  }, { manifest });
}

// Chart builds an animated SVG in beforeExport: one group per sampled frame, each switched
// on in turn by SMIL. Its clock redraws the plot from scratch, so the hold's still call,
// made after the hook, emptied the flipbook and the file came out a single static frame
// (282 KB and 60 animate elements on main, 5 KB and none with that call).
test('an animated SVG a tool builds in beforeExport is the file, with every frame and animation', async () => {
  const root = document.createElement('div');
  root.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40"><g class="plot"></g></svg><canvas width="1" height="1" style="display:none"></canvas>';
  document.body.replaceChildren(root);
  const plot = root.querySelector('.plot')!;
  const clock = root.querySelector('canvas') as Clocked;
  const calls: number[] = [];
  const draw = (t: number) => { plot.innerHTML = `<rect width="${10 + 20 * t}" height="10"/>`; };
  clock.__lollyFrameRender = (t) => { calls.push(t); draw(t); };
  const flipbook = () => {
    const groups = [0, 0.25, 0.5, 0.75].map((t) => { draw(t); return `<g opacity="0">${plot.innerHTML}<animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite"/></g>`; });
    plot.innerHTML = groups.join('');
  };
  const runtime = toolRuntime({ hooks: { beforeExport: true } }, (_node, format) => { if (format === 'svg') flipbook(); });
  const svg = await (await runtime.export(root, 'svg')).text();
  assert.equal((svg.match(/<animate\b/g) ?? []).length, 4, 'every frame keeps its animation');
  assert.equal((svg.match(/<rect\b/g) ?? []).length, 4, 'and its drawing');
  assert.deepEqual(calls, [], 'the clock is never asked to redraw over the hook');
  assert.equal(clock.__lollyFrameDriven, false);
});

test('a tool with no beforeExport of its own still gets its finished pose through the runtime', async () => {
  const { root, calls, clock } = sheet();
  const runtime = toolRuntime({ hooks: { onInit: true } as { beforeExport?: boolean } }, () => {});
  const text = await (await runtime.export(root, 'txt')).text();
  assert.equal(text.trim(), 'finished');
  assert.deepEqual(calls, [[0, undefined]]);
  assert.equal(clock.__lollyFrameDriven, false);
});

type Presented = HTMLElement & { __lollyPresentation?: { prepare(format: string): () => void } };

// A declared presentation (Agenda) lays out every export in prepare() and puts its
// programme back afterwards. Its clock paints a programme moment, so a still call from
// the hold would restart the programme, and before prepare() it would also be the moment
// prepare() saved and restored.
test('a declared presentation lays out its own still: the hold freezes the loop first and never calls the clock', async () => {
  const { root, part, clock, calls } = sheet('data-presentation');
  const stage = root.querySelector('[data-presentation]') as Presented;
  const driven: Array<boolean | undefined> = [];
  stage.__lollyPresentation = {
    prepare() { driven.push(clock.__lollyFrameDriven); part.textContent = 'laid out'; return () => { part.textContent = 'programme'; }; },
  };
  const text = await (await api.render(root, 'txt')).text();
  assert.equal(text.trim(), 'laid out');
  assert.deepEqual(calls, []);
  assert.deepEqual(driven, [true], 'the loop was already frozen when prepare() laid the page out');
  assert.equal(part.textContent, 'programme', 'the presentation put its programme back');
  assert.equal(clock.__lollyFrameDriven, false);
});

test('a presentation that refuses the export hands the loop back', async () => {
  const { root, clock } = sheet('data-presentation');
  (root.querySelector('[data-presentation]') as Presented).__lollyPresentation = {
    prepare() { throw new Error('Set a reference time before exporting a rehearsal.'); },
  };
  await assert.rejects(api.render(root, 'pdf'), /reference time/);
  assert.equal(clock.__lollyFrameDriven, false, 'a refused export does not leave the programme frozen');
});
