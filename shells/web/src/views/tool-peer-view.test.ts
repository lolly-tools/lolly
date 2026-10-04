// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountPeerViewport, jumpToPeer, mountPresentationPresence } from './tool-peer-view.ts';
import { registerCollabSurface, revealCollabViewport } from '../lib/collab-surface.ts';
import type { CollabSessionState } from '../lib/collab-session.ts';
import type { PresencePeer } from '../lib/collab-presence.ts';
import type { PresenceState } from '../lib/collab-presence.ts';

test('presentation navigation publishes its slide and restores editing presence on exit', () => {
  const dom = new JSDOM('<main></main>'), canvas = dom.window.document.querySelector('main')!, runtime = {}, patches: Partial<PresenceState>[] = [];
  const offSurface = registerCollabSurface(runtime, { id: () => 'editing', element: () => null, selection: () => ['title'], viewport: () => ({ x: 10, y: 20, zoom: 1 }), subscribe: () => () => {}, object: id => id === 'slide2' ? { element: null, x: 0, y: 0, w: 100, h: 100, rot: 0 } : null });
  const off = mountPresentationPresence(runtime, canvas, { updateSurface: patch => { patches.push(patch); } });
  const event = (id?: string) => canvas.dispatchEvent(new dom.window.CustomEvent('collab-present-view', { detail: id }));
  event('slide2'); assert.equal(patches[0]!.surface!.id, 'slide2'); assert.deepEqual(patches[0]!.selection, ['slide2']); assert.equal(patches[0]!.viewport, undefined);
  event('deleted'); assert.equal(patches.length, 1);
  event(); assert.equal(patches[1]!.surface!.id, 'editing'); assert.deepEqual(patches[1]!.viewport, { x: 10, y: 20, zoom: 1 });
  off(); event('slide2'); assert.equal(patches.length, 2); offSurface(); dom.window.close();
});

test('a peer viewport matches native pan and absolute zoom; teardown removes the navigator', () => {
  const dom = new JSDOM('<main><div></div></main>'), stage = dom.window.document.querySelector('main')!, canvas = stage.querySelector('div')!, runtime = {};
  stage.getBoundingClientRect = () => new dom.window.DOMRect(100, 80, 1000, 800);
  canvas.getBoundingClientRect = () => new dom.window.DOMRect(-100, -50, 2000, 1200);
  let camera = { scale: 1, x: 50, y: 10 }, zoom = 1, writes = 0;
  const off = mountPeerViewport(runtime, stage, canvas, { zoomTo(value) { zoom = value; }, actual: () => zoom, viewState: () => camera, applyView(value) { camera = value; writes++; } });
  revealCollabViewport(runtime, { x: 20, y: 30, zoom: 2 });
  assert.equal(zoom, 2); assert.deepEqual(camera, { scale: 1, x: 210, y: 80 });
  revealCollabViewport(runtime, { x: Infinity, y: 30, zoom: 2 }); assert.equal(writes, 1);
  off(); revealCollabViewport(runtime, { x: 0, y: 0, zoom: 1 }); assert.equal(writes, 1); dom.window.close();
});

test('jumps use fresh presence, open the current discussion, and ignore stale or closed rooms', () => {
  const runtime = {}, reveals: string[] = [], discussions: (string | undefined)[] = [];
  const self = { clientId: 'self', userId: 'me', name: 'Me', color: '#123456', colorIndex: 0, away: false, isSelf: true, isHost: false, inviteeIndex: 0 };
  let state: CollabSessionState = { connection: 'live', role: 'observer', self, peers: [] };
  let peer: PresencePeer = { id: 'peer', away: false, firstSeen: 0, lastSeen: 1, seq: 1, state: { userId: 'them', name: 'Them', color: '#123456', surface: { id: 'slide2', space: 'unit' }, selection: ['title'] } };
  const session = { state: () => state, presence: { roster: () => [peer] } }, comments = { async locate(context?: string) { discussions.push(context); } };
  const off = registerCollabSurface(runtime, { id: () => 'slide1', element: () => null, selection: () => [], subscribe: () => () => {}, revealPeer(value) { reveals.push(value.surface!.id); return true; } });
  jumpToPeer(runtime, session, 'peer', comments); assert.deepEqual(reveals, ['slide2']); assert.deepEqual(discussions, [undefined]);
  peer = { ...peer, state: { ...peer.state, surface: { id: 'comments:thread2', space: 'unit' } } };
  jumpToPeer(runtime, session, 'peer', comments); assert.deepEqual(discussions, [undefined, 'thread2']); assert.equal(reveals.length, 1);
  peer = { ...peer, away: true }; jumpToPeer(runtime, session, 'peer', comments);
  peer = { ...peer, away: false }; state = { ...state, connection: 'closed' }; jumpToPeer(runtime, session, 'peer', comments);
  state = { ...state, connection: 'live' }; jumpToPeer(runtime, session, 'departed', comments); assert.equal(discussions.length, 2); off();
});
