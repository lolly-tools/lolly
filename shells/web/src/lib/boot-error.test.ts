// SPDX-License-Identifier: MPL-2.0
// The unsupported-environment card is a door, not an error (plan 346, changes 13
// and 21): calm and neutral, the browsers that work, the desktop app, the page
// that explains why, and Reload. A failure that is not "no WebGPU here" keeps its
// own sentence, because the browser list does not answer that failure.
// Run with node --import ./tests/css-stub.mjs --test <this file>.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><main id="view"></main></body>', { url: 'http://localhost/' });
const original = new Map<string, PropertyDescriptor | undefined>();
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'location', 'localStorage', 'navigator', 'CustomEvent', 'Event', 'MutationObserver', 'getComputedStyle']) {
  original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (dom.window as unknown as Record<string, unknown>)[key] });
}
after(() => {
  for (const [key, desc] of original) { if (desc) Object.defineProperty(globalThis, key, desc); else delete (globalThis as Record<string, unknown>)[key]; }
  dom.window.close();
});

const { webGpuGate, showBootError } = await import('./boot-error.ts');
const { createWebGpuDeviceService, WebGpuError } = await import('./webgpu/device.ts');

/** The real failure the startup check raises when the browser has no WebGPU at all. */
async function missing(): Promise<InstanceType<typeof WebGpuError>> {
  return createWebGpuDeviceService(() => undefined, 1000).check().then(() => { throw new Error('no failure'); }, e => e as InstanceType<typeof WebGpuError>);
}
async function insecure(): Promise<InstanceType<typeof WebGpuError>> {
  return createWebGpuDeviceService(() => undefined, 1000, { secureContext: () => false }).check().then(() => { throw new Error('no failure'); }, e => e as InstanceType<typeof WebGpuError>);
}

test('no WebGPU: the plain sentence, the browsers that work and three ways forward', async () => {
  let reloaded = 0;
  const gate = webGpuGate(await missing(), () => { reloaded++; });
  assert.equal(gate.dataset.webgpuUnsupported, 'WEBGPU_REQUIRED');
  assert.equal(gate.querySelector('h1')?.textContent, 'Lolly can’t draw in this browser yet');
  assert.equal(gate.querySelector('.webgpu-gate-lead')?.textContent, 'Lolly draws with WebGPU, which this browser doesn’t offer yet.');
  assert.deepEqual([...gate.querySelectorAll('.webgpu-gate-browsers li')].map(li => li.textContent), [
    'Chrome or Edge, kept up to date', 'Safari 26 or later', 'Firefox, where WebGPU is turned on',
  ]);
  const actions = [...gate.querySelectorAll<HTMLElement>('.webgpu-gate-actions > *')];
  assert.deepEqual(actions.map(a => a.textContent), ['Get the desktop app', 'Read why', 'Reload']);
  assert.equal(actions[0]!.getAttribute('href'), '/info/install.html');
  assert.equal(actions[1]!.getAttribute('href'), '/info/supported-environments.html');
  assert.ok(actions[0]!.classList.contains('btn--primary'), 'the one way that always works is the filled action');
  (actions[2] as HTMLButtonElement).click();
  assert.equal(reloaded, 1);
});

test('no WebGPU: calm, never styled as an error, with the koala\'s place', async () => {
  const gate = webGpuGate(await missing());
  assert.equal(gate.classList.contains('error'), false, 'not the red error card');
  const slot = gate.querySelector<HTMLElement>('.fauna-slot');
  assert.equal(slot?.dataset.fauna, 'koala');
  assert.equal(slot?.getAttribute('aria-hidden'), 'true');
  assert.equal(slot?.childElementCount, 0, 'empty until the art is drawn');
  const css = readFileSync(new URL('../styles/parts/webgpu-gate.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(css, /destructive|danger/, 'no error colours');
  assert.doesNotMatch(css, /\bborder(?:-(?:top|right|bottom|left|inline|block|color|width|style)[a-z-]*)?\s*:/, 'no border: the surface ring carries the edge');
});

test('an insecure page keeps its own sentence; the ways forward stay', async () => {
  const gate = webGpuGate(await insecure());
  assert.equal(gate.dataset.webgpuUnsupported, 'WEBGPU_INSECURE_CONTEXT');
  assert.match(gate.querySelector('.webgpu-gate-lead')?.textContent ?? '', /plain HTTP/);
  assert.ok(gate.querySelector('button'), 'Reload is still there');
});

test('showBootError puts the card in the view, replacing what was there', async () => {
  const view = document.getElementById('view')!;
  view.textContent = 'old';
  showBootError(await missing());
  assert.equal(view.childElementCount, 1);
  assert.ok(view.querySelector('.webgpu-gate[data-webgpu-unsupported="WEBGPU_REQUIRED"]'));
  assert.ok(view.querySelector('.webgpu-gate > .fauna-slot[data-fauna="koala"] > svg.fauna--koala'), 'the koala is drawn once the card is in the view');
  showBootError(await missing());
  assert.equal(view.querySelectorAll('.webgpu-gate').length, 1, 'a repaint replaces the card');
  showBootError(new Error('kaput'));
  assert.ok(view.querySelector('.error'), 'any other boot failure keeps the error card');
});
