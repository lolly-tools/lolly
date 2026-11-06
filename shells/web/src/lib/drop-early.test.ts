// SPDX-License-Identifier: MPL-2.0
// A file dropped on the gallery or Projects before the drop router has loaded is kept
// and handed to the router when it attaches (lib/drop-early.ts), and so is a file
// dropped on the Loading card that covers Projects while it reads the library. Before
// this, nothing took the drag in that time, so the browser opened the file instead.
/// <reference path="../vendor.d.ts" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><div id="view"></div></body>', { url: 'https://instance.test/' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'AbortController']) Reflect.set(globalThis, key, Reflect.get(dom.window, key));

const { DROP_STAND_IN, holdEarlyDrops, takeEarlyDrops } = await import('./drop-early.ts');
const { attachDropRouter } = await import('./drop-router.ts');
type PickerHost = Parameters<typeof attachDropRouter>[1];

function fire(el: HTMLElement, type: 'dragover' | 'drop', types: string[], files: File[] = []): boolean {
  const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { types, files, getData: () => '' } });
  el.dispatchEvent(event);
  return event.defaultPrevented;
}
const file = (name: string): File => new dom.window.File(['x'], name, { type: 'text/plain' }) as unknown as File;
const tick = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
const freshView = (): HTMLElement => {
  const view = document.createElement('div');
  view.id = 'view';
  document.getElementById('view')!.replaceWith(view);
  return view;
};

test('a file dropped before the router loads reaches the router once it attaches', async () => {
  const view = freshView();
  holdEarlyDrops(view);
  assert.equal(fire(view, 'dragover', ['Files']), true, 'the drag is accepted, so the browser does not open the file');
  const notes = file('notes.txt');
  assert.equal(fire(view, 'drop', ['Files'], [notes]), true, 'the drop is taken');
  const routed: File[][] = [];
  const stop = attachDropRouter(view, {} as PickerHost, { direct: async files => { routed.push(files); return true; } });
  try {
    await tick();
    assert.deepEqual(routed, [[notes]], 'routed once, as if dropped now');
    // The router owns the root now: a later drop goes to it alone, once.
    const later = file('later.txt');
    fire(view, 'drop', ['Files'], [later]);
    await tick();
    assert.deepEqual(routed, [[notes], [later]]);
  } finally { stop(); }
});

test('without a drop, the router attaches as before and routes nothing', async () => {
  const view = freshView();
  holdEarlyDrops(view);
  const routed: File[][] = [];
  const stop = attachDropRouter(view, {} as PickerHost, { direct: async files => { routed.push(files); return true; } });
  try {
    await tick();
    assert.deepEqual(routed, []);
    assert.equal(view.dataset.dropReady, '');
  } finally { stop(); }
});

test('Lolly tile drags and plain drags are left to the page', () => {
  const view = freshView();
  holdEarlyDrops(view);
  assert.equal(fire(view, 'dragover', ['text/plain']), false);
  assert.equal(fire(view, 'drop', ['Files', 'application/x-lolly-local-items'], [file('thumb.png')]), false);
  assert.equal(takeEarlyDrops(view), null);
});

test('a newer drop replaces an older one, and leaving the view forgets both', () => {
  const view = freshView();
  holdEarlyDrops(view);
  fire(view, 'drop', ['Files'], [file('first.txt')]);
  const second = file('second.txt');
  fire(view, 'drop', ['Files'], [second]);
  assert.deepEqual(takeEarlyDrops(view), [second]);
  assert.equal(takeEarlyDrops(view), null, 'taken once');
  holdEarlyDrops(view);
  fire(view, 'drop', ['Files'], [file('left.txt')]);
  window.dispatchEvent(new dom.window.Event('hashchange'));
  assert.equal(takeEarlyDrops(view), null, 'a navigation away drops what was kept');
  assert.equal(fire(view, 'drop', ['Files'], [file('after.txt')]), false, 'and stops taking drops');
});

test('a view that re-mounts over a live router never routes one drop twice', async () => {
  const view = freshView();
  const routed: File[][] = [];
  const stop = attachDropRouter(view, {} as PickerHost, { direct: async files => { routed.push(files); return true; } });
  try {
    holdEarlyDrops(view); // the gallery's post-sync re-mount, with the router still attached
    const once = file('once.txt');
    fire(view, 'drop', ['Files'], [once]);
    attachDropRouter(view, {} as PickerHost, { direct: async files => { routed.push(files); return true; } });
    await tick();
    assert.deepEqual(routed, [[once]]);
  } finally { stop(); }
});

test('a drop on the Loading card is held for the view the card stands in for', () => {
  const view = freshView();
  const card = document.createElement('dialog');
  card.setAttribute(DROP_STAND_IN, '');
  card.innerHTML = '<span class="mark"><svg><path></path></svg></span>';
  document.body.append(card);
  const elsewhere = document.createElement('header');
  document.body.append(elsewhere);
  const mark = card.querySelector<HTMLElement>('path')!;
  try {
    assert.equal(fire(mark, 'drop', ['Files'], [file('early.txt')]), false, 'with no view holding drops, the card takes nothing');
    holdEarlyDrops(view);
    assert.equal(fire(mark, 'dragover', ['Files']), true, 'the drag over the card is accepted');
    const early = file('early.txt');
    assert.equal(fire(mark, 'drop', ['Files'], [early]), true, 'and the drop is taken');
    assert.equal(fire(elsewhere, 'drop', ['Files'], [file('header.txt')]), false, 'a drop on other chrome is left to the page');
    assert.deepEqual(takeEarlyDrops(view), [early], 'kept for the view');
    assert.equal(fire(mark, 'drop', ['Files'], [file('late.txt')]), false, 'once the router has it, the card holds nothing');
  } finally { card.remove(); elsewhere.remove(); }
});
