// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import type { ToolManifest } from '@lolly-tools/core';
import { setupAnimTransport, type AnimState } from './anim-transport.ts';

function fixture(inputs: ToolManifest['inputs'] = []) {
  const dom = new JSDOM('<main><div id="canvas"></div></main>');
  const stageEl = dom.window.document.querySelector('main')!;
  const canvasEl = dom.window.document.getElementById('canvas')!;
  const w = dom.window as unknown as { __lollyAnim?: AnimState };
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  const globals = { window: dom.window, document: dom.window.document,
    requestAnimationFrame: (fn: FrameRequestCallback) => { frames.set(++next, fn); return next; },
    cancelAnimationFrame: (id: number) => { frames.delete(id); } };
  for (const [key, value] of Object.entries(globals)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  return { stageEl, canvasEl, w, frames,
    mount: () => setupAnimTransport({ stageEl, canvasEl, manifest: { inputs } }),
    tick: () => { const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(0); },
    bar: () => stageEl.querySelector<HTMLElement>('.anim-transport'),
    close: () => { dom.window.close(); for (const [key, value] of saved) {
      if (value) Object.defineProperty(globalThis, key, value); else Reflect.deleteProperty(globalThis, key);
    } },
  };
}

const clock = (extra: Partial<AnimState> = {}): AnimState => ({
  active: true, playing: true, curT: 0, labels: ['First', 'Second'], gen: 1, ...extra,
});

test('declared native timing owns playback, independent of tool id or video export', () => {
  const design = JSON.parse(readFileSync(new URL('../../../../community/design/tool.json', import.meta.url), 'utf8')) as ToolManifest;
  for (const inputs of [design.inputs, design.inputs.filter(i => i.type === 'blocks').map(i => ({ ...i, id: 'renamed-sequence' }))]) {
    const f = fixture(inputs);
    try {
      const native = clock(); f.w.__lollyAnim = native;
      const cleanup = f.mount(); f.tick();
      assert.equal(f.bar(), null); assert.equal(f.frames.size, 0);
      cleanup(); assert.equal(f.w.__lollyAnim, native);
    } finally { f.close(); }
  }
});

test('stale ownerless route clocks stay hidden; fresh clocks preserve playback and keyboard stepping', () => {
  const f = fixture();
  try {
    const stale = clock(); f.w.__lollyAnim = stale;
    const cleanup = f.mount(); f.tick();
    assert.equal(f.bar()!.hidden, true);
    f.bar()!.querySelector<HTMLButtonElement>('[data-act="play"]')!.click();
    assert.equal(stale.playing, true);
    const current = clock(); f.w.__lollyAnim = current; f.tick();
    assert.equal(f.bar()!.hidden, false);
    assert.equal(f.bar()!.querySelectorAll('.anim-transport-tick').length, 2);
    f.bar()!.querySelector<HTMLButtonElement>('[data-act="play"]')!.click();
    assert.equal(current.playing, false);
    const slider = f.bar()!.querySelector<HTMLElement>('[role="slider"]')!;
    slider.dispatchEvent(new f.canvasEl.ownerDocument.defaultView!.KeyboardEvent('keydown', { key: 'ArrowRight' }));
    assert.equal(current.scrubT, 0.5); assert.equal(slider.getAttribute('aria-valuenow'), '50');
    slider.dispatchEvent(new f.canvasEl.ownerDocument.defaultView!.KeyboardEvent('keydown', { key: 'Enter' }));
    assert.equal(current.scrubT, null); assert.equal(current.playing, true);
    // A tool repaint republishes the same generation with new frame labels.
    f.w.__lollyAnim = clock({ labels: ['Updated'], gen: 1 }); f.tick();
    assert.equal(f.bar()!.querySelectorAll('.anim-transport-tick').length, 1);
    cleanup(); assert.equal(f.frames.size, 0); assert.equal(f.bar(), null);
    assert.equal(f.w.__lollyAnim, undefined);
    // A delayed outgoing publisher cannot leak its bar into the next route.
    f.w.__lollyAnim = current;
    const nextCleanup = f.mount(); f.tick(); assert.equal(f.bar()!.hidden, true);
    nextCleanup(); assert.equal(f.w.__lollyAnim, current);
  } finally { f.close(); }
});

test('DOM-owned clocks must belong to the current canvas; cleanup leaves another owner intact', () => {
  const f = fixture();
  try {
    const owner = f.canvasEl.ownerDocument.createElement('div'); f.canvasEl.append(owner);
    const current = clock({ owner }); f.w.__lollyAnim = current;
    const cleanup = f.mount(); f.tick(); assert.equal(f.bar()!.hidden, false);
    owner.remove(); f.tick(); assert.equal(f.bar()!.hidden, true);
    const foreign = clock({ owner: f.canvasEl.ownerDocument.createElement('div') });
    f.w.__lollyAnim = foreign; f.tick(); assert.equal(f.bar()!.hidden, true);
    cleanup(); assert.equal(f.w.__lollyAnim, foreign); assert.equal(f.frames.size, 0);
  } finally { f.close(); }
});

test('partial timing declarations do not suppress an actual tool clock; inactive clocks hide', () => {
  const f = fixture([{ id: 'boxes', type: 'blocks', canvas: { startField: 'start', durField: 'dur' } }]);
  try {
    const cleanup = f.mount(); f.w.__lollyAnim = clock(); f.tick();
    assert.equal(f.bar()!.hidden, false);
    f.w.__lollyAnim!.active = false; f.tick(); assert.equal(f.bar()!.hidden, true);
    cleanup();
  } finally { f.close(); }
});
