// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CollabHistoryEntry } from '../lib/collab-history.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, Option: dom.window.Option,
  HTMLElement: dom.window.HTMLElement, location: dom.window.location,
});
const { openHistoryPanel } = await import('./history-panel.ts');
const entry = (actor: CollabHistoryEntry['actor'], revision: number): CollabHistoryEntry => ({
  id: `session:${revision}`, documentId: 'session', toolId: 'design', label: `Revision ${revision}`,
  actor, revision, reason: 'checkpoint', at: '2026-10-05T10:00:00Z',
});

test('shared history shows editor names as text with honest fallbacks for older revisions', async () => {
  const container = document.createElement('div'); document.body.append(container);
  const dispose = openHistoryPanel({
    container, state: {} as never,
    collab: {
      scope: 'shared', durability: 'durable', canRestore: false, canSaveCopy: true,
      list: async () => ({ entries: [entry({ id: 'u1', label: '<img src=x> Alex' }, 4),
        entry({ id: 'collab' }, 3), entry({ id: 'guest:link' }, 2), entry({ id: 'deleted-user' }, 1)] }),
      read: async () => null,
    },
  });
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual([...container.querySelectorAll('.revision-history-editor')].map(line => line.textContent), [
      'Edited by <img src=x> Alex', 'Edited by Collaboration', 'Edited by Guest', 'Edited by Unknown editor',
    ]);
    assert.equal(container.querySelector('.revision-history-editor img'), null, 'names cannot inject markup');
  } finally { dispose(); container.remove(); }
});

test('negotiated peer history also identifies the editor', async () => {
  const container = document.createElement('div'); document.body.append(container);
  const dispose = openHistoryPanel({ container, state: {} as never, collaborating: true,
    peer: { list: async () => [entry({ id: 'peer', label: 'Jamie' }, 1)], fetch: async () => ({}) },
  });
  try {
    [...container.querySelectorAll('button')].find(button => button.textContent === 'Load from peer')!.click();
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(container.querySelector('.revision-history-peer .revision-history-editor')?.textContent, 'Edited by Jamie');
  } finally { dispose(); container.remove(); }
});

test('Work versions show their reason, contributors, preview and the Save version form for writers', async () => {
  dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const container = document.createElement('div'); document.body.append(container);
  const saved: string[] = [];
  let lists = 0;
  const previews: string[] = [];
  const version = (id: string, reason: CollabHistoryEntry['reason'], contributors?: CollabHistoryEntry['contributors']): CollabHistoryEntry => ({
    id, documentId: 'session', toolId: 'design', label: reason === 'named' ? 'Final draft' : 'Spring poster', actor: { id: 'collab' },
    revision: 1, reason, at: '2026-10-08T09:00:00Z', ...(contributors ? { contributors } : {}),
  });
  const dispose = openHistoryPanel({
    container, state: {} as never,
    collab: {
      scope: 'shared', durability: 'durable', canRestore: true, canSaveCopy: true,
      list: async () => { lists++; return { entries: [
        version('ver_named', 'named', [{ id: 'u1', label: 'Ana' }, { id: 'guest' }]),
        version('ver_restore', 'restore'), version('ver_auto', 'checkpoint', []),
      ] }; },
      read: async () => null,
      preview: async id => { previews.push(id); return 'data:image/png;base64,AAAA'; },
      saveVersion: async label => { saved.push(label); },
    },
  });
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    const rows = [...container.querySelectorAll('.revision-history-entry')];
    assert.deepEqual(rows.map(row => [...row.querySelectorAll('div > span')].map(span => span.textContent)), [
      ['Edited by Ana and Guest', 'Saved version'],
      ['Edited by Collaboration', 'Restored version'],
      ['Edited by Collaboration', 'Automatic version'],
    ]);
    assert.ok(rows.every(row => [...row.querySelectorAll('button')].some(button => button.textContent === 'Preview')));
    assert.deepEqual(previews.sort(), ['ver_auto', 'ver_named', 'ver_restore'], 'thumbnails load through the shared lazy previews');
    const form = container.querySelector<HTMLFormElement>('.revision-history-save')!;
    assert.equal(form.hidden, false);
    form.querySelector('input')!.value = 'Launch';
    form.requestSubmit();
    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(saved, ['Launch']);
    assert.equal(lists, 2, 'saving refreshes the list');
    assert.equal(container.querySelector('.revision-history-status')?.textContent, 'Version saved.');
    [...rows[0]!.querySelectorAll('button')].find(button => button.textContent === 'Preview')!.click();
    const dialog = document.querySelector('dialog.history-version-preview')!;
    assert.equal(dialog.querySelector('h2')?.textContent, 'Final draft');
    dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  } finally { dispose(); container.remove(); }
});

test('a viewer gets no Save version form and no restore', async () => {
  const container = document.createElement('div'); document.body.append(container);
  const dispose = openHistoryPanel({
    container, state: {} as never,
    collab: {
      scope: 'shared', durability: 'durable', canRestore: false, canSaveCopy: true,
      list: async () => ({ entries: [entry({ id: 'u1', label: 'Alex' }, 1)] }), read: async () => null,
      preview: async () => null, saveVersion: async () => { throw new Error('not offered'); }, restore: async () => { throw new Error('not offered'); },
    },
  });
  try {
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(container.querySelector<HTMLFormElement>('.revision-history-save')?.hidden, true);
    [...container.querySelectorAll('button')].find(button => button.textContent === 'Preview')!.click();
    const dialog = document.querySelector('dialog.history-version-preview')!;
    assert.equal([...dialog.querySelectorAll('button')].some(button => button.textContent === 'Restore this version'), false);
    dialog.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  } finally { dispose(); container.remove(); }
});
