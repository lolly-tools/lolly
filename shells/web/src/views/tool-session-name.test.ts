// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { sessionName } from './tool-session-name.ts';

test('a top-bar rename reaches the snapshot field and recovery listener after Export moves outside the editor', () => {
  const dom = new JSDOM('<main><section><input data-action="filename" value="Original" placeholder="Untitled"></section></main><aside></aside>');
  const prior = globalThis.Event; globalThis.Event = dom.window.Event;
  try {
    const root = dom.window.document.querySelector('section')!, input = root.querySelector('input')!;
    const name = sessionName(root); let changes = 0;
    root.addEventListener('input', () => { changes++; });
    dom.window.document.querySelector('aside')!.append(root);
    name.set('Recovered name');
    assert.equal(input.value, 'Recovered name'); assert.equal(name.get(), 'Recovered name');
    assert.equal(name.placeholder(), 'Untitled'); assert.equal(changes, 1);
  } finally { globalThis.Event = prior; dom.window.close(); }
});
