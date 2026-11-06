// SPDX-License-Identifier: MPL-2.0
/**
 * A redraw of the animation layer editor (components/lottie-layer-editor.ts) replaces
 * every field. A field the person was in but had not typed into comes back focused
 * with its value selected, the state Tab leaves it in, so the next key replaces the
 * value. Before, focus came back with nothing selected: a person who had tabbed into
 * R (0.5) and typed 0 just as an earlier edit's redraw arrived got 0.50, and the clip
 * kept 0.5 (tests/lottie-internal.browser.test.ts, CI on two pull requests).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/components/lottie-layer-editor.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { movingLottie } from '../../../../tests/helpers/lottie-fixtures.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/t/design' });
for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLButtonElement', 'Element', 'Node', 'Event', 'KeyboardEvent', 'getComputedStyle']) {
  Reflect.set(globalThis, key, Reflect.get(dom.window, key));
}
// The easing preview draws on animation frames; nothing here needs one drawn.
Reflect.set(globalThis, 'requestAnimationFrame', () => 0);
Reflect.set(globalThis, 'cancelAnimationFrame', () => {});
const { mountLottieLayerEditor } = await import('./lottie-layer-editor.ts');

function mount() {
  const root = document.createElement('div');
  document.body.replaceChildren(root);
  const edits: unknown[] = [];
  const handle = mountLottieLayerEditor(root, { frame: () => 12, seek() {}, edit: change => { edits.push(change); }, reset() {}, close() {} });
  handle.update(movingLottie(), false);
  return { root, handle, edits };
}
const field = (root: HTMLElement, label: string): HTMLInputElement => root.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

test('a field the person had not typed into comes back from a redraw with its value selected', async () => {
  const { root, handle } = mount();
  const before = field(root, 'Layer name');
  before.focus(); before.select(); // as Tab leaves it
  handle.update(movingLottie(), true); // an earlier edit's redraw arrives
  await tick();
  const after = field(root, 'Layer name');
  assert.notEqual(after, before, 'the redraw replaced the field');
  assert.equal(document.activeElement, after, 'focus moved to the replacement');
  assert.equal(after.selectionStart, 0);
  assert.equal(after.selectionEnd, after.value.length, 'the whole value is selected, so the next key replaces it');
});

test('a field with text typed into it is not redrawn under the person', async () => {
  const { root, handle } = mount();
  const name = field(root, 'Layer name');
  name.focus(); name.value = 'Typed'; name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  handle.update(movingLottie(), true);
  await tick();
  assert.equal(field(root, 'Layer name'), name, 'the field keeps the text being typed');
  assert.equal(name.value, 'Typed');
});
