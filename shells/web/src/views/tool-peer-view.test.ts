// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountPeerViewport, mountPresentationPresence } from './tool-peer-view.ts';
import { isPresenting } from './tool-follow.ts';
import { registerCollabSurface, revealCollabViewport } from '../lib/collab-surface.ts';
import type { PresenceState } from '../lib/collab-presence.ts';

test('presentation navigation publishes its slide as presenting and restores editing presence on exit', () => {
  const dom = new JSDOM('<main></main>'), canvas = dom.window.document.querySelector('main')!, runtime = {}, patches: Partial<PresenceState>[] = [];
  const offSurface = registerCollabSurface(runtime, { id: () => 'editing', element: () => null, selection: () => ['title'], viewport: () => ({ x: 10, y: 20, zoom: 1 }), subscribe: () => () => {}, object: id => id === 'slide2' ? { element: null, x: 0, y: 0, w: 100, h: 100, rot: 0 } : null });
  const off = mountPresentationPresence(runtime, canvas, { updateSurface: patch => { patches.push(patch); } });
  const event = (id?: string) => canvas.dispatchEvent(new dom.window.CustomEvent('collab-present-view', { detail: id }));
  event('slide2'); assert.equal(patches[0]!.surface!.id, 'slide2'); assert.deepEqual(patches[0]!.selection, ['slide2']); assert.equal(patches[0]!.viewport, undefined);
  assert.equal(isPresenting(patches[0] as PresenceState), true, 'a presenter says so in presence');
  event('deleted'); assert.equal(patches.length, 1);
  event(); assert.equal(patches[1]!.surface!.id, 'editing'); assert.deepEqual(patches[1]!.viewport, { x: 10, y: 20, zoom: 1 });
  assert.ok('presenting' in patches[1]! && patches[1].presenting === undefined, 'leaving the presentation clears the flag');
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
