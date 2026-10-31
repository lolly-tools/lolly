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
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLCanvasElement', 'NodeFilter', 'MutationObserver', 'getComputedStyle']) {
  if (g[key] === undefined) g[key] = key === 'window' ? dom.window : key === 'getComputedStyle' ? dom.window.getComputedStyle.bind(dom.window) : (dom.window as unknown as Record<string, unknown>)[key];
}

const { createExportAPI } = await import('./export.ts');
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
