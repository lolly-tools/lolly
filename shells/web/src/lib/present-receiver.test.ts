// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  attachPresentReceiver, boundedPresentNumber, dispatchPresentKey, readPresentCommand,
  readPresentDepth, scrollPresentPage, validPresentTarget,
} from '../../../../packages/core/src/present-receiver.ts';

function page() {
  const dom = new JSDOM('<!doctype html><body><button>Demo</button></body>', { url: 'https://demo.test/', pretendToBeVisual: true });
  const root = dom.window.document.documentElement;
  for (const [key, value] of Object.entries({ scrollHeight: 2000, clientHeight: 400, clientWidth: 800 })) Object.defineProperty(root, key, { value, configurable: true });
  return dom;
}
test('protocol reads only the closed vocabulary and creates no inherited options', () => {
  for (const value of [null, [], { type: 'lolly:present', v: 2, kind: 'hello' }, { type: 'lolly:present', v: 1, kind: '__proto__' }, { type: 'lolly:present', v: 1, kind: 'key', key: 'Escape' }, { type: 'lolly:present', v: 1, kind: 'scroll', to: 'javascript:alert(1)' }]) assert.equal(readPresentCommand(value), null);
  const value = readPresentCommand({ type: 'lolly:present', v: 1, kind: 'scroll', to: Infinity });
  assert.equal(value, null);
  const command = readPresentCommand({ type: 'lolly:present', v: 1, kind: 'key', key: 'ArrowDown', document: 'private', constructor: 'bad' })!;
  assert.equal(Object.getPrototypeOf(command), null);
  assert.deepEqual(Object.keys(command), ['type', 'v', 'kind', 'key']);
  assert.equal(boundedPresentNumber(-20), 0);
  assert.equal(boundedPresentNumber(1e12), 1_000_000);
  assert.equal(validPresentTarget('120%'), '100%');
  assert.equal(validPresentTarget('#x y'), null);
});
test('same-origin page scrolls document, percentages and the largest inner panel', () => {
  const dom = page();
  try {
    const doc = dom.window.document;
    assert.equal(scrollPresentPage(doc, '50%'), true);
    assert.deepEqual(readPresentDepth(doc), { y: 800, max: 1600 });
    const target = doc.createElement('div'); target.id = 'section%'; doc.body.append(target);
    target.getBoundingClientRect = () => ({ top: 200 } as DOMRect);
    doc.documentElement.getBoundingClientRect = () => ({ top: -800 } as DOMRect);
    assert.equal(scrollPresentPage(doc, '#section%'), true);
    assert.equal(readPresentDepth(doc).y, 1000, 'document anchors use viewport top once');
    Object.defineProperty(dom.window.performance, 'now', { value: () => 2000 });
    const inner = doc.createElement('div'); inner.style.overflowY = 'auto'; doc.body.append(inner);
    for (const [key, value] of Object.entries({ scrollHeight: 4000, clientHeight: 300, clientWidth: 800 })) Object.defineProperty(inner, key, { value });
    assert.equal(scrollPresentPage(doc, 1200), true);
    assert.equal(inner.scrollTop, 1200);
    assert.deepEqual(readPresentDepth(doc), { y: 1200, max: 3700 });
    assert.equal(scrollPresentPage(doc, '#missing'), false);
    assert.equal(scrollPresentPage(doc, 'not a depth'), false);
  } finally { dom.window.close(); }
});
test('cancelled page keyboard handles arrow without a second scroll', () => {
  const dom = page();
  try {
    const button = dom.window.document.querySelector('button')!; button.focus();
    const heard: string[] = [];
    button.addEventListener('keydown', event => { heard.push(event.key); event.preventDefault(); });
    button.addEventListener('keyup', event => heard.push(event.key));
    assert.equal(dispatchPresentKey(dom.window as unknown as Window, 'ArrowDown'), true);
    assert.deepEqual(heard, ['ArrowDown', 'ArrowDown']);
    assert.equal(readPresentDepth(dom.window.document).y, 0);
    const second = dom.window.document.createElement('button'); dom.window.document.body.append(second); second.focus();
    dispatchPresentKey(dom.window as unknown as Window, 'ArrowDown');
    assert.equal(readPresentDepth(dom.window.document).y, 40);
  } finally { dom.window.close(); }
});
test('receiver refuses wrong parent and origin, replies with depth only, and forwards handover clicker keys', () => {
  const dom = page();
  const posts: { data: Record<string, unknown>; origin: string }[] = [];
  const parent = { postMessage: (data: Record<string, unknown>, origin: string) => posts.push({ data, origin }) };
  Object.defineProperty(dom.window, 'parent', { value: parent });
  const release = attachPresentReceiver(dom.window as unknown as Window, { allowedOrigins: ['https://deck.test'] });
  const send = (data: unknown, origin = 'https://deck.test', source: unknown = parent): void => {
    dom.window.dispatchEvent(new dom.window.MessageEvent('message', { data, origin, source: source as Window }));
  };
  try {
    const hello = { type: 'lolly:present', v: 1, kind: 'hello' };
    send(hello, 'https://evil.test'); send(hello, 'https://deck.test', {}); send(hello, 'null');
    assert.equal(posts.length, 0);
    send(hello);
    assert.deepEqual(posts.map(post => post.data.kind), ['ready', 'depth']);
    assert.ok(posts.every(post => post.origin === 'https://deck.test'));
    assert.deepEqual(Object.keys(posts[1]!.data), ['type', 'v', 'kind', 'y', 'max']);
    send({ ...hello, kind: 'scroll', to: '50%' }); assert.equal(readPresentDepth(dom.window.document).y, 800);
    send({ ...hello, kind: 'handover', hand: true });
    const key = new dom.window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
    dom.window.document.body.dispatchEvent(key);
    assert.equal(key.defaultPrevented, true);
    assert.equal(posts.at(-1)!.data.type, 'lolly:deck-key');
    assert.equal(posts.at(-1)!.data.key, 'ArrowRight');
    release(); const count = posts.length; send(hello); assert.equal(posts.length, count);
  } finally { release(); dom.window.close(); }
});
