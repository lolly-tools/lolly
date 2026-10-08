// SPDX-License-Identifier: MPL-2.0
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CommentAnchor, CommentThread } from '@lolly-tools/core/canvas-review-v1';
import { registerCollabSurface, type CollabSurface } from '../lib/collab-surface.ts';
import { createTargetOpener, jumpToAnchor, objectPoint, pinsHidden, rememberPinsHidden, savedPoint, stepThread, type TargetOutcome } from './tool-comment-navigation.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
const objectAnchor = (extra: object = {}): CommentAnchor => ({ kind: 'object', collection: 'boxes', objectId: 'box', surface: 'page', x: 0, y: 1, ...extra });

test('a saved pin point is used only when it is a finite point within the document range', () => {
  assert.deepEqual(savedPoint(objectAnchor({ at: { x: -3, y: 4.5 } })), { x: -3, y: 4.5 });
  for (const at of [undefined, null, 'here', { x: 1 }, { x: '1', y: 2 }, { x: Number.NaN, y: 0 }, { x: 0, y: 2e6 }])
    assert.equal(savedPoint(objectAnchor(at === undefined ? {} : { at })), undefined, JSON.stringify(at));
  assert.equal(savedPoint({ kind: 'canvas', surface: 'page', x: 1, y: 2 }), undefined);
  assert.deepEqual(objectPoint({ x: 1, y: .5 }, { x: 0, y: 0, w: 100, h: 50, rot: 0 }), { x: 100, y: 25 });
});

test('jumping uses whatever the surface offers and never fails when a method is missing', () => {
  const calls: string[] = [];
  const runtime = {};
  const base: CollabSurface = { id: () => 'page', element: () => null, selection: () => [], subscribe: () => () => {}, collection: 'boxes' };
  let off = registerCollabSurface(runtime, base);
  assert.equal(jumpToAnchor(runtime, { kind: 'canvas', surface: 'page', x: 1, y: 2 }), 'unavailable');
  assert.equal(jumpToAnchor(runtime, objectAnchor({ at: { x: 1, y: 1 } })), 'unavailable');
  off();
  off = registerCollabSurface(runtime, { ...base,
    object: id => id === 'box' ? { element: null, x: 0, y: 0, w: 10, h: 10, rot: 0 } : null,
    reveal: id => { calls.push(`reveal:${id}`); },
    focusSurface: id => { calls.push(`focus:${id}`); return id !== 'nowhere'; },
    revealPoint: (id, point) => { calls.push(`point:${id}:${point.x},${point.y}`); return id !== 'nowhere'; } });
  assert.equal(jumpToAnchor(runtime, objectAnchor()), 'object');
  assert.equal(jumpToAnchor(runtime, objectAnchor({ objectId: 'lost', at: { x: 7, y: 8 } })), 'deleted');
  assert.equal(jumpToAnchor(runtime, objectAnchor({ objectId: 'lost' })), 'unavailable');
  assert.equal(jumpToAnchor(runtime, objectAnchor({ collection: 'other' })), 'unavailable', 'an object from another collection is not this one');
  assert.equal(jumpToAnchor(runtime, { kind: 'canvas', surface: 'nowhere', x: 3, y: 4 }), 'unavailable');
  assert.deepEqual(calls, ['reveal:box', 'point:page:0,10', 'point:page:7,8', 'focus:nowhere', 'point:nowhere:3,4']);
  off();
  assert.equal(jumpToAnchor(runtime, objectAnchor()), 'unavailable', 'no surface, no jump');
});

test('walking threads wraps at both ends and starts from either end when nothing is selected', () => {
  const list = ['a', 'b', 'c'].map(id => ({ id }) as CommentThread);
  assert.equal(stepThread(list, 'c', 1)?.id, 'a'); assert.equal(stepThread(list, 'a', -1)?.id, 'c');
  assert.equal(stepThread(list, undefined, 1)?.id, 'a'); assert.equal(stepThread(list, 'gone', -1)?.id, 'c');
  assert.equal(stepThread([], 'a', 1), undefined);
});

test('Hide pins is stored per device and storage failures leave pins shown', () => {
  const dom = new JSDOM('', { url: 'https://lolly.ing/' });
  try {
    assert.equal(pinsHidden(dom.window), false);
    rememberPinsHidden(dom.window, true); assert.equal(dom.window.localStorage.getItem('lolly.comments.pins'), 'hidden'); assert.equal(pinsHidden(dom.window), true);
    rememberPinsHidden(dom.window, false); assert.equal(pinsHidden(dom.window), false);
  } finally { dom.window.close(); }
  const opaque = new JSDOM('');
  try {
    assert.equal(pinsHidden(opaque.window), false); assert.doesNotThrow(() => { rememberPinsHidden(opaque.window, true); });
    assert.equal(pinsHidden(null), false);
  } finally { opaque.window.close(); }
});

test('a review target waits for the first list and a live document, is taken once, and later targets follow', async () => {
  let live = false, waiting: string | undefined = 'first', listener: ((id: string) => void) | undefined;
  const said: string[] = [], opened: string[] = [];
  const opener = createTargetOpener({
    capability: { pendingTarget() { const id = waiting; waiting = undefined; return id; }, onTarget(fn) { listener = fn; return () => { listener = undefined; }; } },
    live: () => live, say: text => { said.push(text); },
    async open(id): Promise<TargetOutcome> { opened.push(id); return id === 'gone' ? 'missing' : 'opened'; },
  });
  opener.retry(); await tick(); assert.deepEqual([said, opened], [[], []], 'nothing happens before the first list');
  opener.ready(); await tick();
  assert.deepEqual(said, ['Comments open when the live document connects.']); assert.equal(opener.waiting, true);
  live = true; opener.retry(); await tick();
  assert.deepEqual(opened, ['first']); assert.equal(said.at(-1), 'Opening the thread…');
  opener.ready(); await tick(); assert.deepEqual(opened, ['first'], 'a target is taken once');
  listener!('gone'); await tick(); await tick();
  assert.deepEqual(opened, ['first', 'gone']); assert.equal(said.at(-1), 'This thread was deleted or is no longer available.');
  opener.dispose(); assert.equal(listener, undefined);
});

test('a review target held while the document connects expires after the same 120 seconds as the link', async () => {
  mock.timers.enable({ apis: ['Date'], now: 0 });
  try {
    let live = false;
    const said: string[] = [], opened: string[] = [];
    const opener = createTargetOpener({
      capability: { pendingTarget: () => 'late' }, live: () => live, say: text => { said.push(text); },
      async open(id): Promise<TargetOutcome> { opened.push(id); return 'opened'; },
    });
    opener.ready(); await tick();
    mock.timers.tick(120_000); live = true; opener.retry(); await tick();
    assert.deepEqual(opened, [], 'a stale target never moves the view');
    assert.deepEqual(said, ['Comments open when the live document connects.', ''], 'the waiting note is cleared');
    assert.equal(opener.waiting, false);
  } finally { mock.timers.reset(); }
});
