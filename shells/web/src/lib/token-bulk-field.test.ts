// SPDX-License-Identifier: MPL-2.0
/**
 * The bulk token field end to end against stored documents (unbuilt multi-edit
 * cells and Batch rows): choosing a token opens the review and writes nothing;
 * Apply writes only the selected documents, each resolved in its own theme
 * choices; Cancel leaves every document unchanged; Make custom keeps each
 * document's own value and records its link for Restore.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/token-bulk-field.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';

const dom = new JSDOM('<!doctype html><html><body><main id="view"></main></body></html>', { url: 'https://lolly.test/#/multi', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history,
  Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, AbortController: dom.window.AbortController,
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0),
});
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

const { mountBulkTokenField } = await import('./token-bulk-field.ts');
type TokenMember = import('./token-bulk-field.ts').TokenMember;

const manifest = { id: 'poster', name: 'Poster', inputs: [{ id: 'gap', type: 'number', label: 'Gap', min: 0, max: 100, default: 0 }] } as unknown as ToolManifest;
const day = createTokenSet({ space: { gap: { $type: 'number', $value: 36 } } });
const night = createTokenSet({ space: { gap: { $type: 'number', $value: 48 } } });
const host = { tokens: { get: async (opts: { selection?: Record<string, string> } = {}) => opts.selection?.appearance === 'night' ? night : day } } as unknown as HostV1;
const member = (slot: string, values: Record<string, InputValue>): TokenMember => ({ slot, label: slot, tool: { manifest }, runtime: null, values, dirty: false });
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !ok(); i++) await tick();
  assert.ok(ok(), 'timed out');
}
const dialog = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>('dialog.token-bulk-dialog');

async function chooseToken(root: HTMLElement): Promise<void> {
  root.querySelector<HTMLButtonElement>('[data-token-choose]')!.click();
  await until(() => !root.querySelector<HTMLElement>('[data-token-options]')!.hidden);
  const chooser = root.querySelector<HTMLSelectElement>('select')!;
  chooser.value = 'space.gap';
  chooser.dispatchEvent(new dom.window.Event('change'));
  await until(() => !!dialog());
}

test('a link is reviewed per document and Apply writes only the selected ones', async () => {
  const members = [
    member('plain', { gap: 12 }),
    member('override', { gap: 20, __tokenLinks: { gap: '{space.gap}' } }),
    member('night', { gap: 5, __tokenSelection: { appearance: 'night' } }),
  ];
  const root = document.createElement('div'); document.body.append(root);
  const applied: number[] = [];
  const dispose = mountBulkTokenField(root, { host, id: 'gap', label: 'Gap', members, applied: n => { applied.push(n); } })!;
  await chooseToken(root);
  assert.deepEqual(members.map(m => m.values.gap), [12, 20, 5], 'choosing a token writes nothing before the review');
  const boxes = [...dialog()!.querySelectorAll<HTMLInputElement>('[data-bulk-item]')];
  assert.deepEqual(boxes.map(box => box.checked), [true, false, true], 'the override is kept by default');
  const details = [...dialog()!.querySelectorAll('.token-bulk-detail')].map(el => el.textContent);
  assert.equal(details[0], '12 becomes 36');
  assert.match(details[1]!, /previously linked to space\.gap/);
  assert.equal(details[2], '5 becomes 48', 'the night session resolves the token in its own theme choices');
  const apply = dialog()!.querySelector<HTMLButtonElement>('[data-act="apply"]')!;
  assert.equal(apply.textContent, 'Apply to 2');
  assert.match(dialog()!.querySelector('[data-bulk-summary]')!.textContent!, /Custom values kept: 1\./);
  apply.click();
  await until(() => applied.length === 1);
  assert.deepEqual(applied, [2]);
  assert.deepEqual(members[0]!.values, { gap: { ref: '{space.gap}', value: 36 } });
  assert.deepEqual(members[1]!.values, { gap: 20, __tokenLinks: { gap: '{space.gap}' } }, 'the unselected override is untouched');
  assert.deepEqual(members[2]!.values.gap, { ref: '{space.gap}', value: 48 });
  assert.deepEqual([members[0]!.dirty, members[1]!.dirty, members[2]!.dirty], [true, false, true]);
  dispose(); root.remove();
});

test('selecting an override replaces it, and Cancel changes nothing', async () => {
  const members = [member('a', { gap: 12 }), member('b', { gap: 20, __tokenLinks: { gap: '{space.gap}' } })];
  const root = document.createElement('div'); document.body.append(root);
  let applied = 0;
  const dispose = mountBulkTokenField(root, { host, id: 'gap', label: 'Gap', members, applied: () => { applied++; } })!;
  await chooseToken(root);
  dialog()!.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.click();
  await until(() => !dialog());
  assert.equal(applied, 0);
  assert.deepEqual(members.map(m => m.values), [{ gap: 12 }, { gap: 20, __tokenLinks: { gap: '{space.gap}' } }]);
  await chooseToken(root);
  const override = dialog()!.querySelectorAll<HTMLInputElement>('[data-bulk-item]')[1]!;
  override.checked = true;
  override.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(dialog()!.querySelector('[data-act="apply"]')!.textContent, 'Apply to 2');
  dialog()!.querySelector<HTMLButtonElement>('[data-act="apply"]')!.click();
  await until(() => applied === 1);
  assert.deepEqual(members[1]!.values, { gap: { ref: '{space.gap}', value: 36 } }, 'a link clears the recorded override');
  dispose(); root.remove();
});

test('Make custom keeps each linked document at its own value and offers Restore across them', async () => {
  const members = [member('a', { gap: { ref: '{space.gap}', value: 36 } }), member('b', { gap: { ref: '{space.gap}', value: 48 } }), member('c', { gap: 9 })];
  const root = document.createElement('div'); document.body.append(root);
  let applied = -1;
  let dispose = mountBulkTokenField(root, { host, id: 'gap', label: 'Gap', members, applied: n => { applied = n; } })!;
  assert.match(root.textContent!, /Mixed values/);
  root.querySelector<HTMLButtonElement>('[data-token-custom]')!.click();
  await until(() => applied === 2);
  assert.deepEqual(members.map(m => m.values), [
    { gap: 36, __tokenLinks: { gap: '{space.gap}' } },
    { gap: 48, __tokenLinks: { gap: '{space.gap}' } },
    { gap: 9 },
  ]);
  dispose();
  dispose = mountBulkTokenField(root, { host, id: 'gap', label: 'Gap', members: members.slice(0, 2), applied: () => {} })!;
  assert.ok(root.querySelector('[data-token-restore]'), 'Restore is offered when every document records the same link');
  root.querySelector<HTMLButtonElement>('[data-token-restore]')!.click();
  await until(() => !!dialog());
  assert.deepEqual([...dialog()!.querySelectorAll<HTMLInputElement>('[data-bulk-item]')].map(box => box.checked), [true, true], 'Restore selects the overrides of that token');
  dialog()!.querySelector<HTMLButtonElement>('[data-act="cancel"]')!.click();
  await until(() => !dialog());
  dispose(); root.remove();
});
