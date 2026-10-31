// SPDX-License-Identifier: MPL-2.0
/**
 * Every still export holds a frame-clock tool at its still pose, through the real export entry.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/bridge/export-still-hold.test.ts
 *
 * Only the raster renderers used to call the frame clock. The vector, print and document
 * writers walked the live node as it stood, so Certificate's PDF or SVG, exported while its
 * preview reveal was playing, recorded a half-drawn sheet. A clock that declares its still
 * pose (`stillPose: true` on the function) is now held in the one entry every format passes
 * through; every other clock is left as it was. These drive host.export.render itself with
 * a text export, the cheapest format that reads the page, standing in for the walkers.
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

type Clocked = HTMLCanvasElement & { __lollyFrameRender?: ((t: number, clipSec?: number) => void) & { stillPose?: boolean }; __lollyFrameDriven?: boolean };

/**
 * A sheet whose part reads "half" while its entrance plays and "finished" once the clock
 * settles it, the way Certificate's template behaves, declaring that still pose as
 * Certificate does. `calls` records each clock call.
 */
function sheet(attrs = '', stillPose = true) {
  const root = document.createElement('div');
  root.innerHTML = `<div ${attrs}><p class="part">half</p><canvas width="0" height="0"></canvas></div>`;
  document.body.replaceChildren(root);
  const part = root.querySelector('.part')!;
  const clock = root.querySelector('canvas') as Clocked;
  const calls: Array<[number, number | undefined]> = [];
  clock.__lollyFrameRender = Object.assign((t: number, clipSec?: number) => {
    calls.push([t, clipSec]);
    if (!(clipSec! > 0)) part.textContent = 'finished';
  }, stillPose ? { stillPose: true } : {});
  return { root, part, clock, calls };
}

/**
 * A piece whose clock seeks a growth from zero, the way Growth's template behaves: t 0
 * is the bare seed, and the page shows whatever the tool's own loop has grown so far.
 * It declares no still pose.
 */
function growth() {
  const root = document.createElement('div');
  root.innerHTML = '<div><p class="part">grown</p><canvas width="0" height="0"></canvas></div>';
  document.body.replaceChildren(root);
  const part = root.querySelector('.part')!;
  const clock = root.querySelector('canvas') as Clocked;
  const calls: number[] = [];
  clock.__lollyFrameRender = (t: number) => { calls.push(t); part.textContent = t === 0 ? 'seed' : 'growing'; };
  return { root, clock, calls };
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

// Round 1 held every clock, and Growth's t 0 is the bare seed, so an SVG or PDF of a piece
// that had finished growing came out as a seed. On main the walker read the grown page
// (about 103 KB of SVG); with no declaration the export does so again.
test('a still of a tool whose clock declares no still pose reads the page as it stands', async () => {
  for (const format of ['txt', 'md']) {
    const { root, clock, calls } = growth();
    const part = root.querySelector('.part')!;
    let driven: boolean | undefined;
    const own = part.getAttribute.bind(part);
    part.getAttribute = (name: string) => { driven ??= clock.__lollyFrameDriven; return own(name); };
    const text = await (await api.render(root, format)).text();
    assert.equal(text.trim(), 'grown', `${format}: the grown piece, not the seed`);
    assert.deepEqual(calls, [], `${format}: the clock is never asked for t 0`);
    assert.notEqual(driven, true, `${format}: the tool's own loop is never frozen`);
    assert.equal(clock.__lollyFrameDriven, undefined, `${format}: the flag is never touched`);
  }
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
  }, {});
}

// Chart builds an animated SVG in beforeExport: one group per sampled frame, each switched
// on in turn by SMIL. Its clock redraws the plot from scratch, so round 1's still call,
// made after the hook, emptied the flipbook and the file came out a single static frame
// (282 KB and 60 animate elements on main, 5 KB and none with that call). Chart's clock
// declares no still pose, so nothing calls the clock.
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
  assert.equal(clock.__lollyFrameDriven, undefined, 'and its loop is never frozen');
});

test('a declared clock gets its finished pose through the runtime, before any beforeExport hook', async () => {
  for (const beforeExport of [false, true]) {
    const { root, calls, clock } = sheet();
    const atHook: Array<[string, boolean | undefined]> = [];
    const runtime = toolRuntime({ hooks: { beforeExport } }, (node) => { atHook.push([node.textContent!.trim(), clock.__lollyFrameDriven]); });
    const text = await (await runtime.export(root, 'txt')).text();
    assert.equal(text.trim(), 'finished');
    assert.deepEqual(calls, [[0, undefined]], 'one call for the whole export');
    assert.deepEqual(atHook, beforeExport ? [['finished', true]] : [], 'the hook already sees the finished, frozen sheet');
    assert.equal(clock.__lollyFrameDriven, false);
  }
});

// The docs capture (main.ts __lollyWalkerShot) and every other caller of
// host.export.render outside a runtime reach only the entry's hold. Round 2 skipped the
// clock only inside runtime.export, so a capture of a tool with a beforeExport hook still
// got the call. The declaration now decides alone, whatever the route.
test('outside a runtime, only a declared clock is posed', async () => {
  const declared = sheet();
  assert.equal((await (await api.render(declared.root, 'txt')).text()).trim(), 'finished');
  assert.deepEqual(declared.calls, [[0, undefined]]);
  const undeclared = sheet('', false);
  assert.equal((await (await api.render(undeclared.root, 'txt')).text()).trim(), 'half', 'the page as it stands');
  assert.deepEqual(undeclared.calls, []);
  assert.equal(undeclared.clock.__lollyFrameDriven, undefined);
});

type Presented = HTMLElement & { __lollyPresentation?: { prepare(format: string): () => void } };

// A declared presentation (Agenda) lays out every export in prepare() and puts its
// programme back afterwards. Agenda's clock declares no still pose, so prepare() runs with
// the programme as it stood and nothing calls the clock, as on main.
test('a presentation whose clock declares no still pose lays out its own still, untouched', async () => {
  const { root, part, clock, calls } = sheet('data-presentation', false);
  const stage = root.querySelector('[data-presentation]') as Presented;
  const driven: Array<boolean | undefined> = [];
  stage.__lollyPresentation = {
    prepare() { driven.push(clock.__lollyFrameDriven); part.textContent = 'laid out'; return () => { part.textContent = 'programme'; }; },
  };
  const text = await (await api.render(root, 'txt')).text();
  assert.equal(text.trim(), 'laid out');
  assert.deepEqual(calls, []);
  assert.deepEqual(driven, [undefined], 'the loop is not frozen');
  assert.equal(part.textContent, 'programme', 'the presentation put its programme back');
});

test('a declared clock in a presentation is posed and frozen before prepare(), and a refusal hands the loop back', async () => {
  const { root, part, clock, calls } = sheet('data-presentation');
  const stage = root.querySelector('[data-presentation]') as Presented;
  const seen: Array<[string, boolean | undefined]> = [];
  stage.__lollyPresentation = {
    prepare() { seen.push([part.textContent!, clock.__lollyFrameDriven]); return () => {}; },
  };
  await api.render(root, 'txt');
  assert.deepEqual(seen, [['finished', true]]);
  assert.deepEqual(calls, [[0, undefined]]);
  assert.equal(clock.__lollyFrameDriven, false);
  stage.__lollyPresentation = {
    prepare() { throw new Error('Set a reference time before exporting a rehearsal.'); },
  };
  await assert.rejects(api.render(root, 'pdf'), /reference time/);
  assert.equal(clock.__lollyFrameDriven, false, 'a refused export does not leave the programme frozen');
});
