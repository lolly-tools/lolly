// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountCommentPresence, type CommentPresenceSession } from './tool-comment-presence.ts';
import type { PresencePeer, PresenceState } from '../lib/collab-presence.ts';
import type { CollabParticipant, CollabSessionState } from '../lib/collab-session.ts';

function fixture() {
  const dom = new JSDOM('<main>Artwork</main><aside><textarea></textarea></aside>', { pretendToBeVisual: true });
  const panel = dom.window.document.querySelector('aside')!, input = panel.querySelector('textarea')!;
  const participant = (id: string, name: string): CollabParticipant => ({ clientId: id, userId: id, name, color: '#008657', colorIndex: 0, away: false, isSelf: false, isHost: false, inviteeIndex: 0 });
  let state: CollabSessionState = { connection: 'live', role: 'writer', self: participant('me', 'Me'), peers: [participant('peer', 'Bea')] };
  let peers: PresencePeer[] = [];
  const patches: Partial<PresenceState>[] = [], listeners = new Set<(state: CollabSessionState) => void>();
  const session: CommentPresenceSession = { presence: { roster: () => peers }, state: () => state,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; }, updateSurface: patch => { patches.push(patch); }, setFocus() {} };
  const ui = mountCommentPresence(panel, session, () => 'thread');
  return { dom, panel, input, patches, ui, peer(surface: string, typing = true) {
    peers = [{ id: 'peer', state: { userId: 'peer', name: 'Bea', color: '#008657', selection: [], surface: { id: surface, space: 'unit' }, cursor: { x: .4, y: .6 }, ...(typing ? { chat: 'typing' } : {}) }, seq: 1, away: false, firstSeen: 0, lastSeen: 0 }];
    for (const fn of listeners) fn(state);
  }, close() { state = { ...state, connection: 'closed' }; for (const fn of listeners) fn(state); },
    dispose() { ui.dispose(); assert.equal(listeners.size, 0); dom.window.close(); } };
}
test('discussion presence is scoped to the selected thread and disappears when the room closes', () => {
  const f = fixture();
  try {
    f.peer('comments:other'); assert.equal(f.panel.querySelector('.collab-comment-typing')!.textContent, '');
    f.peer('comments:thread'); assert.match(f.panel.querySelector('.collab-comment-typing')!.textContent!, /Bea.*typing/);
    assert.equal(f.panel.querySelector('.collab-cursor-label')!.textContent, 'Bea');
    assert.equal(f.dom.window.document.querySelector('main')!.textContent, 'Artwork');
    f.close(); assert.equal(f.panel.querySelector('.collab-comment-typing')!.textContent, '');
    assert.equal(f.panel.querySelectorAll('.collab-cursor:not([hidden])').length, 0);
  } finally { f.dispose(); }
});
test('typing presence expires and never includes the unsent reply', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  try {
    f.input.value = 'Private draft which has not been sent'; f.input.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    assert.equal(f.patches.at(-1)!.chat, 'typing');
    assert.equal(f.patches.at(-1)!.surface!.id, 'comments:thread');
    assert.equal(JSON.stringify(f.patches).includes(f.input.value), false);
    f.panel.dispatchEvent(new f.dom.window.Event('submit', { bubbles: true }));
    assert.equal(f.patches.at(-1)!.chat, undefined);
    f.input.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
    t.mock.timers.tick(3_000); assert.equal(f.patches.at(-1)!.chat, undefined);
    assert.equal(f.input.value, 'Private draft which has not been sent');
  } finally { f.dispose(); }
});
