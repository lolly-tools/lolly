// SPDX-License-Identifier: MPL-2.0
/**
 * Token links in the Batch grid: rows opened from sessions keep their token context,
 * linked cells show and copy the value they render, a value typed or pasted over a
 * link records it for Restore, and the Fill popover's Design token section writes
 * reviewed links into the rows in place.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/pro/token-links.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import type { InputValue } from '../../../../engine/src/inputs.ts';
import { createTokenSet } from '../../../../engine/src/tokens.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.test/#/batch', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, location: dom.window.location, history: dom.window.history,
  Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, AbortController: dom.window.AbortController,
  requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0),
});
const Dlg = dom.window.HTMLDialogElement.prototype as unknown as { showModal(): void; close(): void };
Dlg.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', ''); };
Dlg.close = function (this: HTMLDialogElement) { this.removeAttribute('open'); };

const { rowFromToolSession } = await import('./folder-rows.ts');
const { readCell, writeCell } = await import('./cell-data.ts');
const { batchToCsv } = await import('./io.ts');
const { deriveColumns } = await import('./model.ts');
const { bodyRow } = await import('./grid.ts');
const { mountBatchTokenSection } = await import('./token-links.ts');

const manifest = { id: 'poster', name: 'Poster', render: { width: 100, height: 100, formats: ['png'] }, inputs: [
  { id: 'gap', type: 'number', label: 'Gap', min: 0, max: 100 },
  { id: 'ink', type: 'color', label: 'Ink' },
] } as unknown as ToolManifest;
const linked = { ref: '{space.gap}', value: 36 };
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
async function until(ok: () => boolean): Promise<void> {
  for (let i = 0; i < 200 && !ok(); i++) await tick();
  assert.ok(ok(), 'timed out');
}

test('a row opened from a session keeps its theme choices and recorded links, and no other meta', () => {
  const row = rowFromToolSession({ __toolId: 'poster', __label: 'Card', __export_format: 'png', gap: 20, __tokenLinks: { gap: '{space.gap}' }, __tokenSelection: { appearance: 'night' } } as never);
  assert.deepEqual(row.values, { gap: 20, __tokenLinks: { gap: '{space.gap}' }, __tokenSelection: { appearance: 'night' } });
});

test('a linked cell copies and exports the value it shows, and a paste over it records the link', () => {
  const row = { uid: 'r1', toolId: 'poster', manifest, values: { gap: { ...linked } } as Record<string, unknown> };
  assert.equal(readCell(row, 'gap', { unit: 'px', dpi: 300 }), '36');
  const csv = batchToCsv([{ toolId: 'poster', manifest, values: { gap: { ...linked } } }], { unit: 'px', dpi: 300 });
  assert.match(csv, /\b36\b/);
  assert.doesNotMatch(csv, /object|space\.gap/);
  assert.equal(writeCell(row, 'gap', '12'), true);
  assert.deepEqual(row.values, { gap: 12, __tokenLinks: { gap: '{space.gap}' } });
});

test('the grid marks a linked cell and names its token for assistive technology', () => {
  const row = { uid: 'r1', toolId: 'poster', manifest, values: { gap: { ...linked } } };
  const columns = deriveColumns([row]);
  const html = bodyRow(row as never, columns as never, { tools: [{ id: 'poster', name: 'Poster' }], toolById: new Map([['poster', { id: 'poster', name: 'Poster' }]]), assetPicker: false } as never);
  const table = document.createElement('table');
  table.innerHTML = `<tbody>${html}</tbody>`;
  const cell = table.querySelector('td[data-col="gap"]')!;
  assert.ok(cell.classList.contains('pro-cell--linked'));
  assert.equal(cell.getAttribute('title'), 'Linked to design token space.gap');
  assert.equal(cell.querySelector('input')!.getAttribute('aria-label'), 'Gap, linked to design token space.gap');
  assert.equal(cell.querySelector('input')!.getAttribute('value'), '36');
});

test('the Fill popover links a token into the rows in scope after review, keeping overrides', async () => {
  const set = createTokenSet({ space: { gap: { $type: 'number', $value: 36 } } });
  const host = { tokens: { get: async () => set } } as unknown as HostV1;
  const rows = [
    { uid: 'a', toolId: 'poster', manifest, values: { gap: 4 } as Record<string, InputValue>, filename: 'first' },
    { uid: 'b', toolId: 'poster', manifest, values: { gap: 20, __tokenLinks: { gap: '{space.gap}' } } as Record<string, InputValue> },
  ];
  const container = document.createElement('div'); document.body.append(container);
  assert.equal(mountBatchTokenSection(container, { host, key: 'ink', label: 'Ink', type: 'color', rows, targets: rows, applied: () => {} }), undefined, 'colour keeps its own picker');
  assert.equal(mountBatchTokenSection(container, { host: {} as HostV1, key: 'gap', label: 'Gap', type: 'number', rows, targets: rows, applied: () => {} }), undefined, 'no design tokens, no section');
  let applied = -1;
  const dispose = mountBatchTokenSection(container, { host, key: 'gap', label: 'Gap', type: 'number', rows, targets: rows, applied: n => { applied = n; } })!;
  container.querySelector<HTMLButtonElement>('[data-token-choose]')!.click();
  await until(() => !container.querySelector<HTMLElement>('[data-token-options]')!.hidden);
  const chooser = container.querySelector<HTMLSelectElement>('select')!;
  chooser.value = 'space.gap';
  chooser.dispatchEvent(new dom.window.Event('change'));
  await until(() => !!document.querySelector('dialog.token-bulk-dialog'));
  const review = document.querySelector<HTMLDialogElement>('dialog.token-bulk-dialog')!;
  assert.deepEqual([...review.querySelectorAll('label')].map(label => label.textContent), ['Row 1: first', 'Row 2: Poster']);
  review.querySelector<HTMLButtonElement>('[data-act="apply"]')!.click();
  await until(() => applied === 1);
  assert.deepEqual(rows[0]!.values, { gap: { ref: '{space.gap}', value: 36 } }, 'the row map itself is written');
  assert.deepEqual(rows[1]!.values, { gap: 20, __tokenLinks: { gap: '{space.gap}' } }, 'the override is kept');
  dispose();
  assert.equal(container.children.length, 0);
});
