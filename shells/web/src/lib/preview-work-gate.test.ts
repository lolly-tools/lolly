// SPDX-License-Identifier: MPL-2.0
/**
 * The draw gate (plan 371): a look that is not stored yet is drawn only when the page
 * is at rest (visible, off the tool routes, no export, no playback, no input for a
 * moment), and only as far from the screen as the device allows.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/preview-work-gate.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const page = { visibilityState: 'visible', held: false, playing: false };
const listeners = new Map<string, Set<() => void>>();
Object.assign(globalThis, {
  document: {
    get visibilityState() { return page.visibilityState; },
    querySelector: (s: string) => (s === '.view-fade--hold' && page.held ? {} : null),
    querySelectorAll: (s: string) => (s === 'audio, video' && page.playing ? [{ paused: false, ended: false }] : []),
    addEventListener: (type: string, fn: () => void) => { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn); },
    removeEventListener: (type: string, fn: () => void) => { listeners.get(type)?.delete(fn); },
  },
  window: {
    addEventListener: (type: string, fn: () => void) => { (listeners.get(type) ?? listeners.set(type, new Set()).get(type)!).add(fn); },
    removeEventListener: (type: string, fn: () => void) => { listeners.get(type)?.delete(fn); },
  },
  location: { hash: '#/' },
});
const fire = (type: string): void => { for (const fn of [...(listeners.get(type) ?? [])]) fn(); };
const setNavigator = (value: Record<string, unknown>): void => { Object.defineProperty(globalThis, 'navigator', { configurable: true, value }); };
setNavigator({ deviceMemory: 8, hardwareConcurrency: 8 });

const gate = await import('./preview-work-gate.ts');
const busy = await import('./render-busy.ts');
gate.watchPreviewInput();

test('a missing look is drawn only while the page is at rest', () => {
  gate.resetPreviewInput();
  assert.equal(gate.lookDrawAllowed(), true, 'the gallery, visible, nothing running, no input');
  page.visibilityState = 'hidden';
  assert.equal(gate.lookDrawAllowed(), false, 'never in a hidden tab');
  page.visibilityState = 'visible';
  (globalThis.location as { hash: string }).hash = '#/tool/qr-code';
  assert.equal(gate.lookDrawAllowed(), false, 'never with a tool open');
  (globalThis.location as { hash: string }).hash = '#/';
  page.held = true;
  assert.equal(gate.lookDrawAllowed(), false, 'never while a tool opens');
  page.held = false;
  const end = busy.beginRender();
  assert.equal(gate.lookDrawAllowed(), false, 'never during an export');
  end();
  page.playing = true;
  assert.equal(gate.lookDrawAllowed(), false, 'never while audio or video plays');
  page.playing = false;
  assert.equal(gate.lookDrawAllowed(), true);
});

test('input holds draws back until the page has rested, then wakes whoever waits', async () => {
  gate.resetPreviewInput();
  fire('pointerdown');
  assert.equal(gate.inputRested(), false);
  assert.equal(gate.lookDrawAllowed(), false, 'not straight after a tap');
  let woken = 0;
  gate.whenLookDrawMayResume(() => { woken++; }, 60_000);
  await new Promise(resolve => setTimeout(resolve, gate.INPUT_REST_MS / 2));
  fire('wheel');
  await new Promise(resolve => setTimeout(resolve, gate.INPUT_REST_MS - 100));
  assert.equal(woken, 0, 'more input pushes the rest back');
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(woken, 1, 'woken once the rest has lasted');
  assert.equal(gate.inputRested(), true);
  assert.equal(gate.lookDrawAllowed(), true);
  fire('hashchange');
  assert.equal(woken, 1, 'woken only once');
});

test('the page\'s own scroll counts as input; it is heard on the window, not in the capture phase', () => {
  gate.resetPreviewInput();
  fire('scroll');
  assert.equal(gate.inputRested(), false);
  gate.resetPreviewInput();
});

test('how far from the screen a missing look may be drawn depends on the device', () => {
  setNavigator({ deviceMemory: 8, hardwareConcurrency: 8 });
  assert.equal(gate.lookDrawReach(), 'near');
  setNavigator({ deviceMemory: 2, hardwareConcurrency: 8 });
  assert.equal(gate.previewDeviceLowEnd(), true);
  assert.equal(gate.lookDrawReach(), 'screen', 'little memory: on the screen only');
  setNavigator({ deviceMemory: 8, hardwareConcurrency: 2 });
  assert.equal(gate.lookDrawReach(), 'screen', 'two cores: on the screen only');
  setNavigator({ deviceMemory: 8, hardwareConcurrency: 8, connection: { saveData: true } });
  assert.equal(gate.lookDrawReach(), 'screen', 'Save-Data: on the screen only');
  setNavigator({});
  assert.equal(gate.previewDeviceLowEnd(), false, 'a browser that says nothing is not low-end');
  assert.equal(gate.lookDrawReach(), 'near');
});

test('a capture or a cover bake draws every look as before', () => {
  assert.equal(gate.drawsEverywhere(true), true);
  assert.equal(gate.drawsEverywhere(false), false);
  (globalThis as { __lollyBakeCovers?: boolean }).__lollyBakeCovers = true;
  try { assert.equal(gate.drawsEverywhere(false), true); }
  finally { delete (globalThis as { __lollyBakeCovers?: boolean }).__lollyBakeCovers; }
});
