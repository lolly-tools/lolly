// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import type { InputValue } from '../engine/src/inputs.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { baseHost } from './helpers/host.ts';

const fetchTool = (path: string) => readFile(new URL('../community/' + path, import.meta.url), 'utf8');
async function render(id: string, values: Record<string, InputValue> = {}, overrides = {}) {
  const tool = await loadTool(id, fetchTool);
  const runtime = await createRuntime(tool, baseHost({ color: makeColorApi(), ...overrides }), values);
  return runtime.getHydrated() as string;
}

for (const id of ['color-palette', 'contrast-check', 'diagram-builder']) {
  test(`${id}: standalone SVG carries the active brand fonts, including nested labels`, async () => {
    const html = await render(id, {}, { tokens: { resolve: async (ref: string) =>
      ref === '{font.brand}' ? 'Example Sans' : ref === '{font.mono}' ? 'Example Mono' : null } });
    const dom = new JSDOM(html);
    const texts = [...dom.window.document.querySelectorAll('svg text')];
    assert.ok(texts.length > 5);
    for (const text of texts) assert.match(text.getAttribute('font-family') || '', /^Example (Sans|Mono)$/);
    dom.window.close();
  });
}

test('diagram default labels retain their full content; constrained text produces a visible repair message', async () => {
  const normal = new JSDOM(await render('diagram-builder'));
  const text = normal.window.document.querySelector('svg')!.textContent!.replace(/\s/g, '');
  assert.ok(text.includes('CorporateDevelopment'));
  assert.ok(text.includes('InformationTechnology'));
  assert.ok(!text.includes('…'));
  normal.window.close();
  const constrained = new JSDOM(await render('diagram-builder', {
    cardWidth: 120, labelSize: 28,
    nodes: [{ nodeId: 'long', label: 'Very long label '.repeat(30), detail: 'Long detail '.repeat(30) }],
  }));
  assert.match(constrained.window.document.querySelector('[role="status"]')?.textContent || '', /Increase Card width/);
  constrained.window.close();
});

test('URL Capture omits unavailable preview controls and explains the required host', async () => {
  const unavailable = new JSDOM(await render('url-shot', {}, { capabilities: [] }));
  assert.equal(unavailable.window.document.querySelector('[data-preview]'), null);
  assert.match(unavailable.window.document.querySelector('.hint')!.textContent!, /browser extension/);
  unavailable.window.close();
  const available = new JSDOM(await render('url-shot', {}, { capabilities: ['capture'] }));
  assert.ok(available.window.document.querySelector('[data-preview]'));
  available.window.close();
});

test('Scan Copy waits for the clipboard and exposes rejection without false success', async () => {
  const raw = await fetchTool('scan-code/template.html');
  const script = raw.match(/<script>([\s\S]*?)<\/script>/)![1];
  let finish: (() => void) | undefined;
  const dom = new JSDOM(`<div><button data-copy="exact payload">Copy</button><p class="sc-copy-status"></p><script>${script}</script></div>`, {
    runScripts: 'dangerously', beforeParse(window) {
      Object.defineProperty(window.navigator, 'clipboard', { value: { writeText: (value: string) => {
        assert.equal(value, 'exact payload'); return new Promise<void>(resolve => { finish = resolve; });
      } }, configurable: true });
    },
  });
  const button = dom.window.document.querySelector('button')!;
  const status = dom.window.document.querySelector('p')!;
  button.click();
  assert.equal(button.disabled, true);
  assert.equal(status.textContent, '');
  finish!(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(status.textContent, 'Copied');
  Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async () => { throw new Error('NotAllowedError'); } } });
  button.click(); await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(status.textContent!, /Could not copy/);
  assert.equal(button.disabled, false);
  dom.window.close();
});

test('Spatial Photo only signals readiness after depth, and a cancelled read can be retried', async () => {
  const template = (await fetchTool('spatial-photo/template.html')).replace('{{{_state}}}', JSON.stringify({ move: 'orbit', photoUrl: 'photo:test' }));
  let calls = 0, painted = 0, ready = 0;
  const dom = new JSDOM(`<div class="tool-canvas-outer">${template}</div>`, {
    runScripts: 'dangerously', beforeParse(window) {
      const w = window as unknown as Record<string, any>;
      w.LollySpatial = { create: () => ({
        setPhoto() {}, dispose() {}, renderLoopFrame() {},
        setDepth(map: { data: Float32Array }, immediate: boolean) { assert.equal(immediate, true); assert.equal(map.data.length, 4); painted++; },
      }) };
      w.Image = class { onload?: () => void; set src(_value: string) { queueMicrotask(() => this.onload?.()); } };
      w.__lollyDepth = { forImage: async () => ++calls === 1 ? null : { width: 2, height: 2, data: new Float32Array([0, 0.2, 0.8, 1]) } };
      window.document.addEventListener('tool:ready', () => { ready++; });
    },
  });
  await new Promise(resolve => setTimeout(resolve, 0));
  const doc = dom.window.document;
  assert.equal(ready, 0);
  assert.match(doc.querySelector('[data-export-error]')!.getAttribute('data-export-error')!, /cancelled/);
  const status = doc.querySelector('.sp-status')!;
  assert.equal(status.parentElement!.className, 'tool-canvas-outer', 'status is outside the scaled artwork');
  (status.querySelector('button') as HTMLButtonElement).click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls, 2);
  assert.equal(painted, 1);
  assert.equal(ready, 1);
  assert.equal(doc.querySelector('[data-export-error]'), null);
  assert.equal(doc.querySelector('.sp-status'), null);
  dom.window.close();
});
