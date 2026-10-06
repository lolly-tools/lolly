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
