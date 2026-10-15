// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import {
  acceptMatches,
  bindFileDropTiles,
  hasVisibleFileDrop,
  splitByAccept,
  withDroppedType,
} from './file-drop-tile.ts';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
globalThis.document = dom.window.document;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;

const MY_IMAGES =
  'image/svg+xml,image/png,image/apng,image/jpeg,image/webp,image/gif,image/avif,image/heic,image/heif,video/mp4,video/webm,.mp4,.webm,.mov';

const file = (name: string, type = '') => new File(['x'], name, { type });

test('acceptMatches follows the HTML accept rules', () => {
  assert.equal(acceptMatches(file('a.png', 'image/png'), 'image/png'), true);
  assert.equal(acceptMatches(file('a.PNG', 'IMAGE/PNG'), 'image/png'), true);
  assert.equal(acceptMatches(file('a.gif', 'image/gif'), 'image/*'), true);
  assert.equal(acceptMatches(file('clip.MOV', ''), '.mov'), true);
  assert.equal(acceptMatches(file('clip.mov', 'video/quicktime'), 'image/png, .mov'), true);
  assert.equal(acceptMatches(file('notes.txt', 'text/plain'), ''), true, 'an empty accept takes anything');
  assert.equal(acceptMatches(file('notes.txt', 'text/plain'), 'image/png'), false);
  assert.equal(acceptMatches(file('a.png', 'image/png'), 'video/*'), false);
});

test('withDroppedType gives a blank type the one a picker would report', () => {
  assert.equal(withDroppedType(file('logo.svg')).type, 'image/svg+xml');
  assert.equal(withDroppedType(file('clip.MOV')).type, 'video/quicktime');
  assert.equal(withDroppedType(file('logo.svg')).name, 'logo.svg');
  const typed = file('a.png', 'image/png');
  assert.equal(withDroppedType(typed), typed);
  const unknown = file('notes.txt');
  assert.equal(withDroppedType(unknown), unknown);
  const bare = file('README');
  assert.equal(withDroppedType(bare), bare);
});

test('splitByAccept sorts the My images list', () => {
  const png = file('a.png', 'image/png');
  const mov = file('b.mov', 'video/quicktime');
  const txt = file('notes.txt', 'text/plain');
  const pdf = file('deck.pdf', 'application/pdf');
  const { accepted, refused } = splitByAccept([png, txt, mov, pdf], MY_IMAGES);
  assert.deepEqual(accepted, [png, mov]);
  assert.deepEqual(refused, [txt, pdf]);
});

test('hasVisibleFileDrop ignores hidden tiles', () => {
  const none = document.createElement('div');
  assert.equal(hasVisibleFileDrop(none), false);
  const hidden = document.createElement('div');
  hidden.innerHTML = '<section hidden><label data-file-drop></label></section>';
  assert.equal(hasVisibleFileDrop(hidden), false);
  const shown = document.createElement('div');
  shown.innerHTML = '<section hidden><label data-file-drop></label></section><label data-file-drop></label>';
  assert.equal(hasVisibleFileDrop(shown), true);
  // A view can widen the search to a drop area of its own, such as an intake zone.
  const intake = document.createElement('div');
  intake.innerHTML = '<section hidden><label data-file-drop></label></section><div data-intake></div>';
  assert.equal(hasVisibleFileDrop(intake), false);
  assert.equal(hasVisibleFileDrop(intake, '[data-file-drop], [data-intake]'), true);
});

type Calls = { files: File[][]; refused: string[] };

function mount(opts: { multiple?: boolean; busy?: boolean } = {}) {
  const outer = document.createElement('div');
  const root = document.createElement('div');
  root.innerHTML = `
    <label data-file-drop id="tile"><span id="inner">Drop</span><input type="file"${opts.multiple ? ' multiple' : ''}></label>
    <p id="outside">Elsewhere</p>`;
  outer.append(root);
  document.body.append(outer);
  const calls: Calls = { files: [], refused: [] };
  let busy = !!opts.busy;
  const ac = new dom.window.AbortController();
  bindFileDropTiles(root, {
    inputOf: (tile) => tile.querySelector('input'),
    onFiles: (_tile, files) => {
      calls.files.push(files);
    },
    onRefuse: (_tile, reason) => {
      calls.refused.push(reason);
    },
    busy: () => busy,
    signal: ac.signal,
  });
  const parentSeen: string[] = [];
  for (const type of ['dragenter', 'dragover', 'drop']) outer.addEventListener(type, () => parentSeen.push(type));
  const q = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel) as T;
  return { root, outer, calls, parentSeen, ac, q, setBusy: (v: boolean) => { busy = v; } };
}

function drag(target: Element, type: string, files: File[] = [], types: string[] = ['Files'], relatedTarget: Element | null = null) {
  const event = new dom.window.Event(type, { bubbles: true, cancelable: true });
  const transfer = { files, types, dropEffect: 'none' };
  Object.assign(event, { dataTransfer: transfer, relatedTarget });
  target.dispatchEvent(event);
  return { event, transfer };
}

const png = () => file('a.png', 'image/png');

test('a file dragover marks the tile, is prevented and stays off the parent', () => {
  const m = mount();
  const { event, transfer } = drag(m.q('#inner'), 'dragover', [png()]);
  assert.equal(event.defaultPrevented, true);
  assert.equal(transfer.dropEffect, 'copy');
  assert.equal(m.q('#tile').classList.contains('is-dragover'), true);
  assert.deepEqual(m.parentSeen, []);
});

test('dragenter marks the tile the same way', () => {
  const m = mount();
  const { event } = drag(m.q('#tile'), 'dragenter', [png()]);
  assert.equal(event.defaultPrevented, true);
  assert.equal(m.q('#tile').classList.contains('is-dragover'), true);
});

test('a text drag keeps its own meaning', () => {
  const m = mount();
  const { event } = drag(m.q('#tile'), 'dragover', [], ['text/plain']);
  assert.equal(event.defaultPrevented, false);
  assert.equal(m.q('#tile').classList.contains('is-dragover'), false);
  assert.deepEqual(m.parentSeen, ['dragover']);
});

test('dragleave to outside clears the cue and to a child keeps it', () => {
  const m = mount();
  drag(m.q('#tile'), 'dragover', [png()]);
  drag(m.q('#tile'), 'dragleave', [], ['Files'], m.q('#inner'));
  assert.equal(m.q('#tile').classList.contains('is-dragover'), true);
  drag(m.q('#tile'), 'dragleave', [], ['Files'], m.q('#outside'));
  assert.equal(m.q('#tile').classList.contains('is-dragover'), false);
});

test('a drop calls onFiles once with the files and not the parent', () => {
  const m = mount();
  const one = png();
  drag(m.q('#inner'), 'dragover', [one]);
  const { event } = drag(m.q('#inner'), 'drop', [one]);
  assert.equal(event.defaultPrevented, true);
  assert.equal(m.calls.files.length, 1);
  assert.equal(m.calls.files[0]?.[0]?.name, 'a.png');
  assert.equal(m.q('#tile').classList.contains('is-dragover'), false);
  assert.deepEqual(m.parentSeen, []);
});

test('a blank-typed drop reaches onFiles with the picker type', () => {
  const m = mount();
  drag(m.q('#tile'), 'drop', [file('logo.svg')]);
  assert.equal(m.calls.files[0]?.[0]?.type, 'image/svg+xml');
});

test('two files on a single input are refused by count', () => {
  const m = mount();
  drag(m.q('#tile'), 'drop', [png(), png()]);
  assert.deepEqual(m.calls.refused, ['count']);
  assert.equal(m.calls.files.length, 0);
});

test('two files on a multiple input go through', () => {
  const m = mount({ multiple: true });
  drag(m.q('#tile'), 'drop', [png(), png()]);
  assert.deepEqual(m.calls.refused, []);
  assert.equal(m.calls.files[0]?.length, 2);
});

test('a busy tile prevents the browser default but neither marks nor calls', () => {
  const m = mount({ busy: true });
  const over = drag(m.q('#tile'), 'dragover', [png()]);
  assert.equal(over.event.defaultPrevented, true);
  assert.equal(over.transfer.dropEffect, 'none');
  assert.equal(m.q('#tile').classList.contains('is-dragover'), false);
  const dropped = drag(m.q('#tile'), 'drop', [png()]);
  assert.equal(dropped.event.defaultPrevented, true);
  assert.equal(m.calls.files.length, 0);
  m.setBusy(false);
  drag(m.q('#tile'), 'drop', [png()]);
  assert.equal(m.calls.files.length, 1);
});

test('a drop outside any tile is ignored', () => {
  const m = mount();
  const { event } = drag(m.q('#outside'), 'drop', [png()]);
  assert.equal(event.defaultPrevented, false);
  assert.equal(m.calls.files.length, 0);
  assert.deepEqual(m.parentSeen, ['drop']);
});

test('nothing reacts once the signal aborts', () => {
  const m = mount();
  m.ac.abort();
  const { event } = drag(m.q('#tile'), 'dragover', [png()]);
  drag(m.q('#tile'), 'drop', [png()]);
  assert.equal(event.defaultPrevented, false);
  assert.equal(m.q('#tile').classList.contains('is-dragover'), false);
  assert.equal(m.calls.files.length, 0);
});

test('a repainted tile keeps working', () => {
  const m = mount();
  m.root.innerHTML = '<label data-file-drop id="tile"><input type="file"></label>';
  drag(m.q('#tile'), 'drop', [png()]);
  assert.equal(m.calls.files.length, 1);
});
