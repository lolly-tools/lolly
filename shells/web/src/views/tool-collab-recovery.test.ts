// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { retainCanvasRecovery, canvasRecoveryValues } from '../lib/canvas-recovery.ts';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { mountCollabRecovery } from './tool-collab-recovery.ts';

test('interrupted work saves to a new device slot without changing the shared canvas or an earlier save', async () => {
  const dom = new JSDOM('<div id="stage"><div id="canvas">Team canvas</div></div>');
  const stage = dom.window.document.getElementById('stage')!, canvas = dom.window.document.getElementById('canvas')!;
  const saved = new Map<string, object>([['earlier', { title: 'Earlier device save' }]]), runtime = {};
  const host = { state: { load: async (slot: string) => saved.get(slot), save: async (slot: string, value: object) => { saved.set(slot, value); } } } as unknown as HostV1;
  const ui = mountCollabRecovery(runtime, host, stage, () => ({ state: { __toolId: 'design', title: 'Shared title' }, label: 'Design' }));
  try {
    retainCanvasRecovery(runtime, { title: 'Interrupted local title' }, 'Interrupted text', 'draft-one');
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(saved.get('collab-recovery:draft-one'), { __toolId: 'design', title: 'Interrupted local title', __label: 'Design · Interrupted text' });
    assert.deepEqual(saved.get('earlier'), { title: 'Earlier device save' });
    assert.equal(canvas.outerHTML, '<div id="canvas">Team canvas</div>');
    assert.match(stage.querySelector('[role="status"]')!.textContent!, /saved on this device/);
    retainCanvasRecovery(runtime, { title: 'Different value' }, 'Interrupted text', 'draft-one');
    assert.equal((saved.get('collab-recovery:draft-one') as { title: string }).title, 'Interrupted local title');
    ui.teardown(); assert.equal(stage.querySelector('.collab-recovery'), null);
  } finally { ui.teardown(); dom.window.close(); }
});
test('a device quota failure keeps the downloadable draft and never says saved', async () => {
  const dom = new JSDOM('<div></div>'), stage = dom.window.document.querySelector('div')!;
  const downloads: Array<{ name: string; value: unknown }> = [];
  const host = { state: { load: async () => null, save: async () => { throw new Error('quota'); } },
    export: { download: async (blob: Blob, name: string) => { downloads.push({ name, value: JSON.parse(await blob.text()) }); } } } as unknown as HostV1;
  const runtime = {}, ui = mountCollabRecovery(runtime, host, stage, () => ({ state: {} }));
  try {
    retainCanvasRecovery(runtime, { title: 'Keep this' }, 'Interrupted text');
    await new Promise(resolve => setImmediate(resolve));
    assert.match(stage.querySelector('[role="status"]')!.textContent!, /could not be saved/);
    assert.ok(stage.querySelector('button')); assert.equal(stage.querySelector('a')!.hidden, true);
    stage.querySelector('button')!.click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(downloads[0]!.name, 'lolly-recovery.json');
    assert.equal((downloads[0]!.value as { title: string }).title, 'Keep this');
  } finally { ui.teardown(); dom.window.close(); }
});
test('an archived projection restores declared row IDs and keeps compound fields without resurrecting deleted rows', () => {
  const model = [{ id: 'boxes', type: 'blocks', canvas: { idField: 'uid' }, fields: [{ id: 'uid' }], value: [{ uid: 'one', x: 5, effect: { blur: 2 } }, { uid: 'gone', x: 5 }] },
    { id: 'title', type: 'text', value: 'Current' }] as InputModelItem[];
  const origin = { client: 'seed', clock: 0 };
  const values = canvasRecoveryValues(model, [
    { k: 'add', col: 'boxes', id: 'one', row: { x: 90 }, orderKey: 'a', origin }, { k: 'param', key: 'title', value: 'Draft', origin },
  ]);
  assert.deepEqual(values, { title: 'Draft', boxes: [{ uid: 'one', x: 90, effect: { blur: 2 } }] });
  assert.equal((model[0]!.value as { x: number }[])[0]!.x, 5);
});
