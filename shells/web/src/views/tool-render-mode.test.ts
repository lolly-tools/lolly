// SPDX-License-Identifier: MPL-2.0
/**
 * Render settings that follow an input (`render.when`): what the tool view reads, the
 * watch that asks for a new mount when the block in effect changes, and what crosses
 * that mount. The export bar's own reading of the block is in tool-actions.test.ts.
 *
 * Run directly: node --test shells/web/src/views/tool-render-mode.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { resolveRender } from '../../../../engine/src/render-when.ts';
import {
  carryRenderMount, renderInEffect, restoreRenderFocus, restoreRenderFocusOnArrival, takeRenderMount, watchRenderMode, willRemountForRender,
} from './tool-render-mode.ts';
import { toolCanvasRole } from './tool-canvas-role.ts';

const render = {
  width: 600, height: 600, formats: ['svg', 'png'], actions: ['copy', 'download', 'save'],
  when: { input: 'mode', value: 'scan', set: { export: false, webPreview: true, actions: [] } },
};
const manifest = { id: 'two-modes', render } as never as { id: string; render: import('@lolly/engine').ToolManifest['render'] };

/** A runtime that resolves the block the way the engine's does, over a plain value map. */
function fakeRuntime(values: Record<string, unknown>) {
  const listeners = new Set<() => void>();
  let matched = false;
  let inEffect = manifest.render;
  return {
    values,
    getRender() {
      const now = resolveRender(manifest.render, values);
      if ((now !== manifest.render) !== matched) { matched = now !== manifest.render; inEffect = now; }
      return inEffect;
    },
    set(id: string, value: unknown) { values[id] = value; for (const fn of listeners) fn(); },
    subscribe(fn: () => void) { listeners.add(fn); fn(); return () => { listeners.delete(fn); }; },
    listeners,
  };
}

test('the block in effect is the runtime answer, or the manifest block when a runtime gives none', () => {
  const runtime = fakeRuntime({ mode: 'scan' });
  assert.equal(renderInEffect(runtime, manifest).export, false);
  assert.equal(renderInEffect({}, manifest), manifest.render);
  assert.equal(renderInEffect(null, manifest), manifest.render);
});

test('the canvas role follows the block in effect', () => {
  const make = fakeRuntime({ mode: 'make' });
  const scan = fakeRuntime({ mode: 'scan' });
  assert.equal(toolCanvasRole({ id: manifest.id, render: renderInEffect(make, manifest) }, false, false), 'img');
  assert.equal(toolCanvasRole({ id: manifest.id, render: renderInEffect(scan, manifest) }, false, false), 'group');
});

test('a change that leaves the block in effect alone asks for nothing', () => {
  const runtime = fakeRuntime({ mode: 'make', title: 'a' });
  let remounts = 0;
  const off = watchRenderMode({
    toolId: 'two-modes', manifest, runtime, mounted: runtime.getRender(), inputs: () => null,
    remount: () => { remounts++; }, defer: (fn) => fn(),
  });
  runtime.set('title', 'b');
  runtime.set('mode', 'make');
  assert.equal(remounts, 0);
  assert.equal(willRemountForRender('two-modes'), false);
  off();
});

test('flipping the keyed input asks for one new mount, and the values cross by reference', () => {
  const file = { name: 'photo.png', bytes: new Uint8Array([1, 2, 3]) };
  const runtime = fakeRuntime({ mode: 'make', title: 'a', image: file });
  let remounts = 0;
  const off = watchRenderMode({
    toolId: 'two-modes', manifest, runtime, mounted: runtime.getRender(), inputs: () => null,
    remount: () => {
      remounts++;
      // The outgoing view's teardown, as views/tool/stage-layout.ts runs: hand the values over.
      assert.equal(willRemountForRender('two-modes'), true);
      carryRenderMount('two-modes', 'slot-1', runtime.values, new Set(['title', 'mode']));
    },
    defer: (fn) => fn(),
  });
  runtime.set('mode', 'scan');
  runtime.set('title', 'later');
  assert.equal(remounts, 1, 'one request, however many changes follow');
  off();

  const carried = takeRenderMount('two-modes');
  assert.ok(carried);
  assert.equal(carried.slot, 'slot-1');
  assert.equal(carried.values.mode, 'scan');
  assert.equal(carried.values.image, file, 'a picked file is the same object, not a copy');
  assert.deepEqual(carried.edited, ['title', 'mode'], 'the inputs the person changed stay written to the address');
  assert.equal(takeRenderMount('two-modes'), null, 'spent on read');

  // The new mount is built from the new answer.
  const next = fakeRuntime(carried.values);
  assert.equal(renderInEffect(next, manifest).export, false);
  assert.deepEqual(renderInEffect(next, manifest).actions, []);
});

test('the carry is for the tool that armed, and nothing is kept for another', () => {
  const runtime = fakeRuntime({ mode: 'make' });
  const off = watchRenderMode({
    toolId: 'two-modes', manifest, runtime, mounted: runtime.getRender(), inputs: () => null,
    remount: () => { carryRenderMount('two-modes', null, runtime.values); }, defer: (fn) => fn(),
  });
  runtime.set('mode', 'scan');
  off();
  assert.equal(takeRenderMount('another-tool'), null);
  assert.equal(takeRenderMount('two-modes'), null, 'a mount of another tool in between drops the carry');
  // A stray call with nothing armed keeps nothing.
  carryRenderMount('two-modes', null, { mode: 'scan' });
  assert.equal(takeRenderMount('two-modes'), null);
});

test('a view that left before the deferred remount ran is not mounted again', () => {
  const runtime = fakeRuntime({ mode: 'make' });
  let run: (() => void) | null = null;
  let remounts = 0;
  const off = watchRenderMode({
    toolId: 'two-modes', manifest, runtime, mounted: runtime.getRender(), inputs: () => null,
    remount: () => { remounts++; }, defer: (fn) => { run = fn; },
  });
  runtime.set('mode', 'scan');
  off();
  takeRenderMount('some-other-tool'); // the next view mounted first
  (run as (() => void) | null)?.();
  assert.equal(remounts, 0);
});

test('focus goes back into a section the new mount drew folded', () => {
  const dom = new JSDOM(`<div id="inputs"><details class="input-section"><summary>Setup</summary>
    <select data-input-id="mode"><option value="make">Make</option><option value="scan" selected>Scan</option></select>
  </details><details class="input-section"><summary>Other</summary><input data-input-id="title"></details></div>`);
  const doc = dom.window.document;
  restoreRenderFocus(doc.getElementById('inputs'), 'mode');
  const [setup, other] = [...doc.querySelectorAll('details')];
  assert.equal(setup!.open, true, 'the section that holds the control is opened');
  assert.equal(other!.open, false, 'no other section is touched');
  assert.equal(doc.activeElement?.getAttribute('data-input-id'), 'mode');
  // Nothing noted, nothing done.
  setup!.open = false;
  restoreRenderFocus(doc.getElementById('inputs'), null);
  assert.equal(setup!.open, false);
});

test('focus is tried again when the router puts focus on the view, and only then', async () => {
  const dom = new JSDOM('<main id="view" tabindex="-1"><div id="inputs"><select data-input-id="mode"></select><input data-input-id="title"></div></main>');
  const doc = dom.window.document;
  const view = doc.getElementById('view')!;
  const select = doc.querySelector<HTMLElement>('[data-input-id="mode"]')!;
  // While the view mounts the control cannot take focus.
  select.setAttribute('disabled', '');
  restoreRenderFocusOnArrival(view, () => doc.getElementById('inputs'), 'mode', 30);
  assert.notEqual(doc.activeElement, select);
  select.removeAttribute('disabled');
  view.focus(); // the router arrives
  assert.equal(doc.activeElement, select);
  // One second chance only: the next focus on the view stays on the view.
  view.focus();
  assert.equal(doc.activeElement, view);

  // The chance lapses, so a click on the view much later moves nothing.
  doc.querySelector<HTMLElement>('[data-input-id="title"]')!.focus();
  restoreRenderFocusOnArrival(view, () => doc.getElementById('inputs'), 'title', 5);
  await new Promise((done) => setTimeout(done, 25));
  view.focus();
  assert.equal(doc.activeElement, view);
});

test('a tool with no `when` is not watched', () => {
  const plain = { id: 'plain', render: { width: 1, height: 1, formats: ['png'] } } as never as typeof manifest;
  const runtime = fakeRuntime({});
  watchRenderMode({ toolId: 'plain', manifest: plain, runtime, mounted: plain.render, inputs: () => null, remount: () => {} });
  assert.equal(runtime.listeners.size, 0);
});

test('focus on the keyed control is noted, and goes back to the chosen button after the mount', () => {
  const dom = new JSDOM(`<div id="inputs">
    <div class="badge-select" role="radiogroup" data-badge-select="mode">
      <button type="button" role="radio" aria-checked="false" data-v="make">Make</button>
      <button type="button" role="radio" aria-checked="true" data-v="scan">Scan</button>
    </div>
    <input data-input-id="title">
  </div>`);
  const doc = dom.window.document;
  const inputs = doc.getElementById('inputs')!;
  const runtime = fakeRuntime({ mode: 'make' });
  doc.querySelector<HTMLElement>('[data-v="make"]')!.focus();
  const off = watchRenderMode({
    toolId: 'two-modes', manifest, runtime, mounted: runtime.getRender(), inputs: () => inputs,
    remount: () => { carryRenderMount('two-modes', null, runtime.values); }, defer: (fn) => fn(),
  });
  runtime.set('mode', 'scan');
  off();
  const carried = takeRenderMount('two-modes');
  assert.equal(carried?.focusInput, 'mode');

  doc.querySelector<HTMLElement>('[data-input-id="title"]')!.focus();
  restoreRenderFocus(inputs, carried!.focusInput);
  assert.equal(doc.activeElement?.getAttribute('data-v'), 'scan');

  // Focus on another control is not noted, so the new mount leaves focus alone.
  doc.querySelector<HTMLElement>('[data-input-id="title"]')!.focus();
  const other = fakeRuntime({ mode: 'make' });
  const off2 = watchRenderMode({
    toolId: 'two-modes', manifest, runtime: other, mounted: other.getRender(), inputs: () => inputs,
    remount: () => { carryRenderMount('two-modes', null, other.values); }, defer: (fn) => fn(),
  });
  other.set('mode', 'scan');
  off2();
  assert.equal(takeRenderMount('two-modes')?.focusInput, null);
});
