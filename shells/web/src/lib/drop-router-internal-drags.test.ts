// SPDX-License-Identifier: MPL-2.0
// The desktop file drop (attachDropRouter) and Lolly's own tile drags must never react
// to each other's drops (plan 296): a drag of Projects tiles carries its own type, and
// a browser may add the tile's picture as a file, which must not become an import.
/// <reference path="../vendor.d.ts" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { attachDropRouter } from './drop-router.ts';
import type { PickerHost } from '../views/picker.ts';

const dom = new JSDOM('<!doctype html><body><div id="view"></div></body>', { url: 'https://instance.test/#/p' });
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'AbortController']) Reflect.set(globalThis, key, Reflect.get(dom.window, key));

function drop(el: HTMLElement, types: string[], files: File[]): boolean {
  const event = new dom.window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: { types, files, getData: () => '' } });
  el.dispatchEvent(event);
  return event.defaultPrevented;
}

test('a drop of Lolly tiles is never read as a file import, even when the browser adds a file', async () => {
  const view = document.getElementById('view')!, direct: File[][] = [];
  const stop = attachDropRouter(view, {} as PickerHost, { direct: async files => { direct.push(files); return true; } });
  try {
    const picture = new dom.window.File(['x'], 'thumb.png', { type: 'image/png' }) as unknown as File;
    assert.equal(drop(view, ['Files', 'application/x-lolly-local-items', 'text/lolly-session'], [picture]), false);
    assert.equal(drop(view, ['Files', 'application/x-lolly-team-items'], [picture]), false);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(direct, []);
    // A real desktop file is still taken.
    assert.equal(drop(view, ['Files'], [picture]), true);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(direct.length, 1);
  } finally { stop(); }
});
