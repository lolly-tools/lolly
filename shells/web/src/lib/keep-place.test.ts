// SPDX-License-Identifier: MPL-2.0
/**
 * keepPlace (lib/keep-place.ts): a focused field keeps its focus and its caret
 * when the panel holding it is moved to another parent, as the edge dock does on
 * a fold. jsdom does no layout, so scroll offsets are not exercised here; the
 * focus and the selection are.
 *
 * Run directly:  node --test shells/web/src/lib/keep-place.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="a"><div id="panel"><input id="f" value="Half typed"><textarea id="t">two\nlines</textarea></div></div><div id="b"></div></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;

const { keepPlace } = await import('./keep-place.ts');
const $ = (id: string): HTMLElement => document.getElementById(id)!;

test('a moved panel keeps the focused field and its caret', () => {
  const input = $('f') as HTMLInputElement;
  input.focus();
  input.setSelectionRange(4, 4);
  const result = keepPlace([$('panel')], () => { $('b').appendChild($('panel')); return 'moved'; });
  assert.equal(result, 'moved');
  assert.equal($('panel').parentElement?.id, 'b');
  assert.equal(document.activeElement, input);
  assert.equal(input.selectionStart, 4);
  assert.equal(input.selectionEnd, 4);
});

test('a selection range in a textarea survives too', () => {
  const area = $('t') as HTMLTextAreaElement;
  area.focus();
  area.setSelectionRange(1, 6, 'backward');
  keepPlace([$('panel')], () => { $('a').appendChild($('panel')); });
  assert.equal(document.activeElement, area);
  assert.deepEqual([area.selectionStart, area.selectionEnd], [1, 6]);
});

test('focus outside the moved roots is left alone', () => {
  const outside = document.createElement('button');
  document.body.append(outside);
  outside.focus();
  keepPlace([$('panel')], () => { $('b').appendChild($('panel')); });
  assert.equal(document.activeElement, outside);
});
