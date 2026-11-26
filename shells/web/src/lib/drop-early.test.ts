// SPDX-License-Identifier: MPL-2.0
// A file dropped while Lolly is still loading is kept and given to the page under it
// once that page is ready (lib/drop-early.ts): from index.html's boot script, through a
// view's mount, until a router that loads after the mount listens. Before this, nothing
// took the drag in that time, so the browser opened the file instead.
/// <reference path="../vendor.d.ts" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body><div id="view"></div></body>', { url: 'https://instance.test/', runScripts: 'outside-only' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'AbortController']) Reflect.set(globalThis, key, Reflect.get(dom.window, key));

const { BOOT_DROPS, DROP_STAND_IN, holdEarlyDrops, installDropHold, viewFailed, viewLoading, viewReady } = await import('./drop-early.ts');
type DropNote = Parameters<Parameters<typeof installDropHold>[0]['tell']>[0];
const { attachDropRouter } = await import('./drop-router.ts');
type PickerHost = Parameters<typeof attachDropRouter>[1];

/** index.html's boot script, as the page runs it before any module. */
const BOOT_SCRIPT = (() => {
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const open = html.indexOf('<script id="lolly-drop-hold">');
  assert.ok(open > 0, 'index.html carries the early-drop script');
  const at = open + '<script id="lolly-drop-hold">'.length;
  assert.ok(open < html.indexOf('<link rel="stylesheet"'), 'it runs before the stylesheet, so it never waits for it');
  return html.slice(at, html.indexOf('</script>', at));
})();

function fire(el: Element, type: 'dragenter' | 'dragover' | 'drop', types: string[], files: File[] = [], at = { x: 0, y: 0 }): boolean {
  const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { types, files, getData: () => '' } });
  Object.defineProperty(event, 'clientX', { value: at.x });
  Object.defineProperty(event, 'clientY', { value: at.y });
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
/** Install the hold as main.ts does, recording what the person is told and what is left over. */
function install(): { notes: DropNote[]; unclaimed: File[][]; uninstall: () => void } {
  const notes: DropNote[] = [];
  const unclaimed: File[][] = [];
  const uninstall = installDropHold({ tell: note => notes.push(note), unclaimed: files => unclaimed.push(files) });
  return { notes, unclaimed, uninstall };
}
/** The drops `el` receives; `el` takes every file drag offered. */
function takesDrops(el: Element, opts: { stop?: boolean } = {}): string[][] {
  const got: string[][] = [];
  const accept = (e: Event): void => { e.preventDefault(); if (opts.stop) e.stopPropagation(); };
  el.addEventListener('dragover', accept);
  el.addEventListener('drop', (e) => {
    accept(e);
    got.push([...((e as DragEvent).dataTransfer?.files ?? [])].map(f => f.name));
  });
  return got;
}

test('a file dropped before the router loads reaches the router once it attaches', async () => {
  const { uninstall } = install();
  const view = freshView();
  try {
    viewLoading('gallery');
    holdEarlyDrops(view);
    viewReady('gallery');
    assert.equal(fire(view, 'dragover', ['Files']), true, 'the drag is accepted, so the browser does not open the file');
    const notes = file('notes.txt');
    assert.equal(fire(view, 'drop', ['Files'], [notes]), true, 'the drop is taken');
    const routed: File[][] = [];
    const stop = attachDropRouter(view, {} as PickerHost, { direct: async files => { routed.push(files); return true; } });
    try {
      await tick(); await tick();
      assert.deepEqual(routed, [[notes]], 'routed once, as if dropped now');
      // The router owns the root now: a later drop goes to it alone, once.
      const later = file('later.txt');
      fire(view, 'drop', ['Files'], [later]);
      await tick(); await tick();
      assert.deepEqual(routed, [[notes], [later]]);
    } finally { stop(); }
  } finally { uninstall(); }
});

test('without a drop, the router attaches as before and routes nothing', async () => {
  const { uninstall } = install();
  const view = freshView();
  try {
    viewLoading('gallery');
    holdEarlyDrops(view);
    viewReady('gallery');
    const routed: File[][] = [];
    const stop = attachDropRouter(view, {} as PickerHost, { direct: async files => { routed.push(files); return true; } });
    try {
      await tick();
      assert.deepEqual(routed, []);
      assert.equal(view.dataset.dropReady, '');
    } finally { stop(); }
  } finally { uninstall(); }
});

test('Lolly tile drags and plain drags are left to the page, even while a view loads', () => {
  const { notes, uninstall } = install();
  const view = freshView();
  try {
    viewLoading('gallery');
    assert.equal(fire(view, 'dragover', ['text/plain']), false);
    assert.equal(fire(view, 'drop', ['Files', 'application/x-lolly-local-items'], [file('thumb.png')]), false);
    assert.deepEqual(notes, []);
  } finally { uninstall(); }
});

test('with no view loading and no handler on the way, a drop is the browser\'s, as before', () => {
  const { uninstall } = install();
  const view = freshView();
  try {
    viewLoading('tool');
    viewReady('tool');
    assert.equal(fire(view, 'dragover', ['Files']), false);
    assert.equal(fire(view, 'drop', ['Files'], [file('notes.txt')]), false);
  } finally { uninstall(); }
});

test('a second drop while one waits is refused at once, and the first is opened once', async () => {
  const { notes, uninstall } = install();
  const view = freshView();
  try {
    viewLoading('gallery');
    assert.equal(fire(view, 'drop', ['Files'], [file('first.txt')]), true);
    assert.equal(fire(view, 'drop', ['Files'], [file('second.txt')]), true, 'the browser does not open the second either');
    assert.deepEqual(notes, [
      { kind: 'held', files: ['first.txt'] },
      { kind: 'busy', held: ['first.txt'], files: ['second.txt'] },
    ]);
    const got = takesDrops(view); // the view's own handler, attached as it mounts
    viewReady('gallery');
    await tick();
    assert.deepEqual(got, [['first.txt']], 'the first, once');
    assert.deepEqual(notes.at(-1), { kind: 'done' });
  } finally { uninstall(); }
});

test('a drop made while one view loads is not opened by the view the person moves to', async () => {
  const { notes, unclaimed, uninstall } = install();
  const view = freshView();
  try {
    viewLoading('start');
    fire(view, 'drop', ['Files'], [file('left.txt')]);
    viewLoading('gallery'); // the person went to the gallery before the studio was ready
    const got = takesDrops(view);
    viewReady('gallery');
    await tick();
    assert.deepEqual(got, [], 'never delivered to the gallery');
    assert.deepEqual(unclaimed, [], 'nor handed to the chooser');
    assert.deepEqual(notes.at(-1), { kind: 'left', files: ['left.txt'] }, 'and the person is told');
  } finally { uninstall(); }
});

test('a view that mounts again in place keeps the drop made for it', async () => {
  const { uninstall } = install();
  const view = freshView();
  try {
    viewLoading('gallery');
    fire(view, 'drop', ['Files'], [file('kept.txt')]);
    viewLoading('gallery'); // a forced re-mount of the same view
    const got = takesDrops(view);
    viewReady('gallery');
    await tick();
    assert.deepEqual(got, [['kept.txt']]);
  } finally { uninstall(); }
});

test('a view that re-mounts over a live router never routes one drop twice', async () => {
  const { uninstall } = install();
  const view = freshView();
  const routed: File[][] = [];
  const stop = attachDropRouter(view, {} as PickerHost, { direct: async files => { routed.push(files); return true; } });
  try {
    viewLoading('gallery');
    holdEarlyDrops(view); // the gallery's post-sync re-mount, with the router still attached
    const once = file('once.txt');
    fire(view, 'drop', ['Files'], [once]);
    attachDropRouter(view, {} as PickerHost, { direct: async files => { routed.push(files); return true; } });
    viewReady('gallery');
    await tick(); await tick();
    assert.deepEqual(routed, [[once]]);
  } finally { stop(); uninstall(); }
});

test('a drop on a stand-in goes to what the view shows at the same point, never to the stand-in', async () => {
  const { unclaimed, uninstall } = install();
  const view = freshView();
  const card = document.createElement('dialog');
  card.setAttribute(DROP_STAND_IN, '');
  card.innerHTML = '<span class="mark"><svg><path></path></svg></span>';
  document.body.append(card);
  const mark = card.querySelector('path')!;
  const tile = document.createElement('section');
  view.append(tile);
  const onTile = takesDrops(tile);
  let onCard = 0;
  card.addEventListener('drop', () => { onCard++; });
  Reflect.set(document, 'elementsFromPoint', (x: number, y: number): Element[] =>
    x === 40 && y === 60 ? [mark, card, tile, view, document.body] : [document.body]);
  try {
    viewLoading('projects');
    assert.equal(fire(mark, 'drop', ['Files'], [file('early.txt')], { x: 40, y: 60 }), true, 'held');
    viewReady('projects');
    await tick();
    assert.deepEqual(onTile, [['early.txt']], 'given to the view at the point of the drop');
    assert.equal(onCard, 1, 'the card saw only the person\'s own drop');
    assert.deepEqual(unclaimed, []);
  } finally { Reflect.deleteProperty(document, 'elementsFromPoint'); card.remove(); uninstall(); }
});

test('a drop on a zone painted before its handler goes to the zone; one beside the zone goes to the page', async () => {
  const { uninstall } = install();
  const view = freshView();
  view.innerHTML = '<div class="surface"><h1>Studio</h1><div class="zone"><span>Drop marks here</span></div></div>';
  const surface = view.querySelector('.surface')!;
  try {
    viewLoading('start');
    // Painted, not yet wired: both drops would have gone to the browser.
    assert.equal(fire(view.querySelector('.zone span')!, 'drop', ['Files'], [file('mark.svg')]), true);
    const onZone = takesDrops(view.querySelector('.zone')!, { stop: true });
    const onPage = takesDrops(surface);
    viewReady('start');
    await tick();
    assert.deepEqual(onZone, [['mark.svg']], 'the zone the person aimed at');
    assert.deepEqual(onPage, [], 'not the page around it');
    viewLoading('start');
    assert.equal(fire(view.querySelector('h1')!, 'drop', ['Files'], [file('photo.png')]), true);
    viewReady('start');
    await tick();
    assert.deepEqual(onPage, [['photo.png']], 'a drop beside the zone goes to the page');
    assert.deepEqual(onZone, [['mark.svg']]);
  } finally { uninstall(); }
});

test('a drop nothing on the page takes is handed on, never dropped in silence', async () => {
  const { unclaimed, uninstall } = install();
  const view = freshView();
  try {
    viewLoading('tool');
    const notes = file('notes.txt');
    fire(view, 'drop', ['Files'], [notes]);
    viewReady('tool');
    await tick();
    assert.deepEqual(unclaimed, [[notes]]);
  } finally { uninstall(); }
});

test('a view that fails to load does not open the drop, and the person is told', async () => {
  const { notes, unclaimed, uninstall } = install();
  const view = freshView();
  try {
    viewLoading('projects');
    fire(view, 'drop', ['Files'], [file('notes.txt')]);
    const got = takesDrops(view);
    viewFailed();
    await tick();
    assert.deepEqual(got, []);
    assert.deepEqual(unclaimed, []);
    assert.deepEqual(notes.at(-1), { kind: 'failed', files: ['notes.txt'] });
  } finally { uninstall(); }
});

test('index.html keeps a drop made before any app code runs, and the hold takes it over', async () => {
  const view = freshView();
  dom.window.eval(BOOT_SCRIPT);
  assert.equal(fire(view, 'dragover', ['Files']), true, 'before the app, the boot script takes the drag');
  assert.equal(fire(view, 'drop', ['Files', 'text/lolly-tile'], [file('tile.png')]), false, 'but never a tile drag');
  assert.equal(fire(view, 'drop', ['Files'], [file('boot.txt')]), true, 'and keeps the drop');
  const got = takesDrops(view);
  const { notes, uninstall } = install();
  try {
    assert.equal(Reflect.get(dom.window, BOOT_DROPS), undefined, 'the boot script has handed over and stopped');
    assert.deepEqual(notes, [{ kind: 'held', files: ['boot.txt'] }]);
    viewLoading('gallery');
    viewReady('gallery');
    await tick();
    assert.deepEqual(got, [['boot.txt']], 'given to the first view once it is ready');
  } finally { uninstall(); }
});
