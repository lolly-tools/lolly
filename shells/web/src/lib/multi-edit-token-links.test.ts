// SPDX-License-Identifier: MPL-2.0
/**
 * Multi-edit's token actions: the Shared card's menu reviews a link across sessions
 * before writing, a session card's menu links that one session directly as the tool
 * sidebar does, colour inputs keep their own picker and the Design tool keeps its
 * own layer inspector.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/multi-edit-token-links.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import type { Runtime } from '../../../../engine/src/runtime.ts';
import { buildInputModel, updateInput } from '../../../../engine/src/inputs.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.test/#/multi', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history,
  Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, AbortController: dom.window.AbortController,
  MutationObserver: dom.window.MutationObserver, CSS: { escape: (value: string) => value },
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0),
});
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

const { mountMemberTokenActions, mountSharedTokenActions } = await import('./multi-edit-token-links.ts');
type TokenMember = import('./token-bulk-field.ts').TokenMember;

const inputs = [
  { id: 'gap', type: 'number', label: 'Gap', min: 0, max: 100 },
  { id: 'ink', type: 'color', label: 'Ink' },
  { id: 'title', type: 'text', label: 'Title' },
];
const poster = { id: 'poster', name: 'Poster', inputs } as unknown as ToolManifest;
const design = { id: 'design', name: 'Design', inputs } as unknown as ToolManifest;
const set = createTokenSet({ space: { gap: { $type: 'number', $value: 36 } } });
const host = { tokens: { get: async () => set } } as unknown as HostV1;
const member = (slot: string, manifest: ToolManifest, values: Record<string, InputValue> = { gap: 4 }): TokenMember => ({ slot, label: slot, tool: { manifest }, runtime: null, values, dirty: false });
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !ok(); i++) await tick();
  assert.ok(ok(), 'timed out');
}
function panel(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = inputs.map(input => `<div class="input-row"><label class="input-label">${input.label}</label><input data-input-id="${input.id}"></div>`).join('');
  document.body.append(el);
  return el;
}
const triggers = (el: HTMLElement): string[] => [...el.querySelectorAll<HTMLElement>('.input-rule-actions')].map(button => button.dataset.inputActions!);
async function pickGap(menu: HTMLElement): Promise<void> {
  menu.querySelector<HTMLButtonElement>('[data-token-choose]')!.click();
  await until(() => !menu.querySelector<HTMLElement>('[data-token-options]')!.hidden);
  const chooser = menu.querySelector<HTMLSelectElement>('[data-token-options] select')!;
  chooser.value = 'space.gap';
  chooser.dispatchEvent(new dom.window.Event('change'));
}

test('the Shared card reviews a link across sessions and closes its menu after Apply', async () => {
  const members = [member('a', poster), member('b', poster, { gap: 9, __tokenLinks: { gap: '{space.gap}' } })];
  const el = panel();
  let applied = 0;
  const dispose = mountSharedTokenActions(el, host, () => members, () => { applied++; });
  assert.deepEqual(triggers(el), ['gap', 'title'], 'colour keeps its own picker');
  el.querySelector<HTMLButtonElement>('[data-input-actions="gap"]')!.click();
  const menu = document.querySelector<HTMLElement>('.input-rule-menu')!;
  assert.match(menu.textContent!, /Applies to 2 designs/);
  await pickGap(menu);
  await until(() => !!document.querySelector('dialog.token-bulk-dialog'));
  assert.deepEqual(members.map(m => m.values.gap), [4, 9], 'nothing is written before Apply');
  document.querySelector<HTMLButtonElement>('dialog.token-bulk-dialog [data-act="apply"]')!.click();
  await until(() => applied === 1);
  assert.deepEqual(members[0]!.values.gap, { ref: '{space.gap}', value: 36 });
  assert.equal(members[1]!.values.gap, 9, 'the override is kept');
  assert.equal(document.querySelector('.input-rule-menu'), null);
  dispose(); el.remove();
});

test('the Design tool keeps its own inspector, so its sessions get no generic token menu', () => {
  const el = panel();
  const disposeShared = mountSharedTokenActions(el, host, () => [member('a', poster), member('d', design)], () => {});
  assert.deepEqual(triggers(el), []);
  disposeShared();
  const disposeCard = mountMemberTokenActions(el, member('d', design), host, () => {});
  assert.deepEqual(triggers(el), []);
  disposeCard(); el.remove();
});

test('a session card links its own runtime directly, with no review', async () => {
  let model = buildInputModel(poster, { initial: { gap: 4 } });
  const writes: InputValue[] = [];
  const runtime = {
    manifest: poster,
    tokenSelection: undefined,
    getModel: () => model,
    setInput: async (id: string, value: InputValue) => { writes.push(value); model = updateInput(model, id, value); },
  } as unknown as Runtime;
  const one = { ...member('a', poster), runtime };
  const el = panel();
  let applied = 0;
  const dispose = mountMemberTokenActions(el, one, host, () => { applied++; });
  assert.deepEqual(triggers(el), ['gap', 'title']);
  el.querySelector<HTMLButtonElement>('[data-input-actions="gap"]')!.click();
  await pickGap(document.querySelector<HTMLElement>('.input-rule-menu')!);
  await until(() => applied === 1);
  assert.deepEqual(writes, [{ ref: '{space.gap}', value: 36 }]);
  assert.equal(document.querySelector('dialog.token-bulk-dialog'), null);
  assert.equal(one.dirty, true);
  dispose(); el.remove();
});
