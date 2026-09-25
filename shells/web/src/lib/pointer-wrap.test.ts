// SPDX-License-Identifier: MPL-2.0
/**
 * lib/pointer-wrap.ts - endless drag travel. jsdom has no Pointer Lock, so the test
 * gives the target a requestPointerLock that records the request, and plays the
 * browser's part by setting document.pointerLockElement and firing pointerlockchange.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { dragTravel, EDGE_PX } from './pointer-wrap.ts';

function fixture() {
  const dom = new JSDOM('<!doctype html><div id="t"></div>', { pretendToBeVisual: true });
  const w = dom.window;
  Object.assign(globalThis, { window: w, document: w.document });
  Object.defineProperty(w, 'innerWidth', { value: 1000, configurable: true });
  let lockEl: Element | null = null;
  Object.defineProperty(w.document, 'pointerLockElement', { get: () => lockEl, configurable: true });
  const target = w.document.getElementById('t')!;
  const requests: unknown[] = [];
  let exits = 0;
  (target as unknown as { requestPointerLock: (o?: unknown) => Promise<void> }).requestPointerLock = (o) => { requests.push(o); return Promise.resolve(); };
  w.document.exitPointerLock = () => { exits++; lockEl = null; w.document.dispatchEvent(new w.Event('pointerlockchange')); };
  const lock = (on: boolean): void => { lockEl = on ? target : null; w.document.dispatchEvent(new w.Event('pointerlockchange')); };
  const ev = (clientX: number, movementX = 0, pointerType = 'mouse') =>
    ({ clientX, clientY: 300, movementX, pointerType } as unknown as PointerEvent);
  return { w, target, requests, lock, ev, exits: () => exits, cursor: () => w.document.querySelector<HTMLElement>('.drag-wrap-cursor') };
}

test('a drag that stays clear of the edges is plain clientX travel and never locks', () => {
  const f = fixture();
  const travel = dragTravel(f.target, f.ev(500));
  assert.equal(travel.move(f.ev(620, 5)), 120);
  assert.equal(travel.move(f.ev(400, -5)), -100);
  assert.deepEqual(f.requests, []);
  assert.equal(travel.engaged(), false);
  travel.end();
});

test('reaching an edge while moving outward locks, and the travel carries on past it', () => {
  const f = fixture();
  const travel = dragTravel(f.target, f.ev(500));
  // At the edge but moving back inward: no lock.
  assert.equal(travel.move(f.ev(1000 - EDGE_PX + 2, -3)), 478);
  assert.equal(f.requests.length, 0);
  assert.equal(travel.move(f.ev(1000 - EDGE_PX + 4, 3)), 480);
  assert.equal(f.requests.length, 1);
  assert.equal(travel.engaged(), true);
  f.lock(true);
  // clientX is frozen under the lock; movementX keeps counting, lap after lap.
  assert.equal(travel.move(f.ev(1000 - EDGE_PX + 4, 300)), 780);
  assert.equal(travel.move(f.ev(1000 - EDGE_PX + 4, 900)), 1680);
  // The stand-in cursor laps round the window: 500 + 1680 = 2180, 180 in from the left.
  assert.match(f.cursor()!.style.transform, /translate3d\(180px, 300px/);
  travel.end();
  assert.equal(f.cursor(), null);
  assert.equal(f.exits(), 1);
});

test('a lock lost mid-drag (Escape) removes the cursor and tells the caller once', () => {
  const f = fixture();
  let lost = 0;
  const travel = dragTravel(f.target, f.ev(500), { onLost: () => { lost++; } });
  travel.move(f.ev(EDGE_PX - 4, -3));
  f.lock(true);
  f.lock(false);
  assert.equal(lost, 1);
  assert.equal(f.cursor(), null);
  travel.end();
  assert.equal(lost, 1);
});

test('touch never asks for a lock', () => {
  const f = fixture();
  const travel = dragTravel(f.target, f.ev(500, 0, 'touch'));
  travel.move(f.ev(1000 - 2, 5, 'touch'));
  assert.deepEqual(f.requests, []);
  travel.end();
});
