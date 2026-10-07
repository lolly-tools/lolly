// SPDX-License-Identifier: MPL-2.0
/**
 * views/tool-leave.ts: what Leave without saving does outside the storage bridge
 * (plan 277 P1). The discard order (close the writer, then discard), where the
 * entry being left points afterwards, and the entry marker that keeps an edit
 * brought back by a reload, Back or Forward counted as unsaved.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-leave.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import type { AutomaticHistory } from './automatic-history.ts';
import type { DiscardResult } from '../bridge/revision-history.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/t/qr-code?url=https%3A%2F%2Fedited.example' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;

const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { discardUnsavedWork, entryHoldsUnsavedEdits, leftEntryHref, localDocument, markEntryUnsaved, rewriteLeftEntry, syncEntryMark } = await import('./tool-leave.ts');
const { mountModal } = await import('../components/modal.ts');
const { historySettled } = await import('../lib/overlay-back.ts');

test('the entry being left points at the kept creation, or at the launch address without one-shot params', () => {
  assert.equal(leftEntryHref('/t/qr-code', '', 'qr-code:1 2'), '/t/qr-code?slot=qr-code%3A1%202');
  assert.equal(leftEntryHref('/t/qr-code', null, null), '/t/qr-code');
  assert.equal(leftEntryHref('/design', 'template=carousel', null), '/design?template=carousel');
  assert.equal(leftEntryHref('/t/qr-code', '?slot=qr-code:gone&url=https%3A%2F%2Fshared.example&export=png&copy&share', null),
    '/t/qr-code?url=https%3A%2F%2Fshared.example', 'a shared link reopens as shared, without replaying its export');
});

test('an edit marks its entry, a save clears the mark, and another tool does not read it', () => {
  history.replaceState({ lollyHistory: { toolId: 'qr-code', slot: 'qr-code:1' } }, '', location.href);
  assert.equal(entryHoldsUnsavedEdits('qr-code'), false);
  markEntryUnsaved('qr-code', true);
  assert.equal(entryHoldsUnsavedEdits('qr-code'), true);
  assert.equal(entryHoldsUnsavedEdits('chart'), false);
  assert.deepEqual((history.state as { lollyHistory: unknown }).lollyHistory, { toolId: 'qr-code', slot: 'qr-code:1' }, 'other entry state is kept');
  markEntryUnsaved('qr-code', false);
  assert.equal(entryHoldsUnsavedEdits('qr-code'), false);
});

test('rewriting the left entry drops the discarded edits and the unsaved mark', () => {
  history.replaceState({ lollyHistory: { toolId: 'qr-code', slot: 'qr-code:auto' }, lollyUnsaved: 'qr-code', other: 1 }, '', '/t/qr-code?url=edited');
  rewriteLeftEntry('/t/qr-code', 'qr-code', null);
  assert.equal(location.pathname + location.search, '/t/qr-code');
  assert.deepEqual(history.state, { other: 1 }, 'a removed creation is forgotten, so Back cannot reattach to its slot');
  history.replaceState({ lollyUnsaved: 'qr-code' }, '', '/t/qr-code?url=edited');
  rewriteLeftEntry('/t/qr-code?slot=qr-code%3Asaved', 'qr-code', 'qr-code:saved');
  assert.equal(location.search, '?slot=qr-code%3Asaved');
  assert.deepEqual(history.state, { lollyHistory: { toolId: 'qr-code', slot: 'qr-code:saved', explicit: true } });
});

function fakes(outcome: DiscardResult['outcome']) {
  const order: string[] = [];
  let slot: string | null = null;
  const controller = { close: async () => { order.push('close'); slot ??= 'qr-code:auto'; } } as unknown as AutomaticHistory;
  const host = { state: { history: { discard: async (s: string) => { order.push(`discard ${s}`); return { outcome, slot: outcome === 'removed' ? `__discarded__:x:${s}` : s }; } } } } as unknown as Pick<HostV1, 'state'>;
  return { order, controller, host, slot: () => slot, setSlot: (next: string | null) => { slot = next; } };
}

test('the writer closes before the discard, and a creation that left Projects is taken out of its folder', async () => {
  const f = fakes('removed');
  const unfiled: string[] = [];
  const result = await discardUnsavedWork({ host: f.host, controller: f.controller, slot: f.slot, unfile: async s => { unfiled.push(s); } });
  assert.deepEqual(f.order, ['close', 'discard qr-code:auto'], 'closing first means the teardown flush cannot write the edits back');
  assert.deepEqual(result, { outcome: 'removed', kept: null });
  assert.deepEqual(unfiled, ['qr-code:auto']);
});

test('a restored creation stays the entry to return to', async () => {
  const f = fakes('restored'); f.setSlot('qr-code:saved');
  assert.deepEqual(await discardUnsavedWork({ host: f.host, controller: f.controller, slot: f.slot }), { outcome: 'restored', kept: 'qr-code:saved' });
});

test('a tool without automatic history writes nothing and keeps its saved slot', async () => {
  const f = fakes('restored'); f.setSlot('link-card:1');
  assert.deepEqual(await discardUnsavedWork({ host: f.host, slot: f.slot }), { outcome: 'unchanged', kept: 'link-card:1' });
  assert.deepEqual(f.order, [], 'nothing is closed or discarded');
});

test('live collaboration and shared mounts are not local documents', () => {
  assert.equal(localDocument({ collab: null, ephemeral: null }), true);
  assert.equal(localDocument({ collab: {}, ephemeral: null }), false);
  assert.equal(localDocument({ collab: null, ephemeral: {} }), false);
});

test('a save made from a dialog clears the mark on the tool entry, not on the dialog copy that Back pops', async () => {
  history.replaceState({ lollyUnsaved: 'qr-code', entry: 'tool' }, '', '/t/qr-code?url=edited');
  const dialog = mountModal('<p>Save as</p>', { className: 'save-dialog' }); // pushes a same-URL copy, mark included
  history.replaceState({ ...(history.state as object), entry: 'dialog copy' }, '', location.href);
  let unsaved = false;
  syncEntryMark('qr-code', () => unsaved, () => true); // the save runs while the dialog, and its copy, are current
  dialog.close();                                   // its Back entry is popped on the next task
  await historySettled(2_000);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal((history.state as { entry?: string }).entry, 'tool', 'Back popped the dialog copy');
  assert.equal(entryHoldsUnsavedEdits('qr-code'), false, 'the tool entry is no longer marked');
  unsaved = true;
  syncEntryMark('qr-code', () => unsaved, () => false);
  assert.equal(entryHoldsUnsavedEdits('qr-code'), false, 'a tool that was left writes nothing');
});

// ── A document that belongs somewhere else (plan 75 J6 step 6) ───────────────────

test('a team document asks its own question and keeps its device draft on Leave without saving', async () => {
  const scope = await import('../lib/document-scope.ts');
  const { leaveQuestion } = await import('./tool-leave.ts');
  scope._resetDocumentScopeForTests();
  assert.equal(leaveQuestion(), null, 'no scope: the ordinary dialog');
  const off = scope.registerDocumentScope({
    chip: () => ({ label: 'Brand refresh · Can edit', role: 'edit' }),
    leavePrompt: () => 'Save changes to Brand refresh?',
  });
  const stop = scope.mountDocumentScope({
    toolId: 'qr-code', view: document.createElement('div'),
    document: () => ({ inputs: {} }), unsaved: () => true, saveOnDevice: async () => true,
  });
  assert.equal(leaveQuestion(), 'Save changes to Brand refresh?');
  const f = fakes('removed');
  const result = await discardUnsavedWork({ host: f.host, controller: f.controller, slot: f.slot });
  assert.deepEqual(f.order, ['close'], 'the writer protects the edits, and nothing is discarded');
  assert.deepEqual(result, { outcome: 'unchanged', kept: 'qr-code:auto' }, 'Back returns to the device draft');
  const g = fakes('removed');
  assert.deepEqual(await discardUnsavedWork({ host: g.host, controller: g.controller, slot: g.slot, keep: false }), { outcome: 'removed', kept: null },
    'an explicit keep: false still discards');
  stop();
  off();
  assert.equal(leaveQuestion(), null, 'the mount ended: back to the ordinary dialog');
  const h = fakes('removed');
  assert.deepEqual(await discardUnsavedWork({ host: h.host, controller: h.controller, slot: h.slot }), { outcome: 'removed', kept: null },
    'a local document discards exactly as before');
  scope._resetDocumentScopeForTests();
});
