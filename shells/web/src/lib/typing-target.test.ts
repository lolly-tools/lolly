// SPDX-License-Identifier: MPL-2.0
/**
 * typing-target tests - the shadow-DOM focus walk behind every "don't hijack a
 * keystroke while the user is typing" guard.
 *
 * The regression that motivated this module: the sidebar's text fields are
 * <jelly-input> custom elements whose real <input> lives in a shadow root, so
 * `document.activeElement` reports the HOST. Every guard tested tagName on the
 * host, read "not typing", and let the tool stage's single-key shortcuts fire - 
 * `0` (fit) and `1` (100%) could not be typed into any text field at all.
 *
 * Driven against real jsdom elements with real attached shadow roots, so what is
 * pinned is the actual focus shape, not a stand-in for it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { deepActiveElement, deepestFocus, isTypingTarget, isTextEditingTarget } from './typing-target.ts';

const dom = new JSDOM('<!doctype html><body></body>');
const doc = dom.window.document;

/** A custom-element host with an open shadow root holding one focusable control. */
function jellyHost(tag: string, inner: 'input' | 'textarea', type?: string) {
  const host = doc.createElement(tag);
  doc.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  const field = doc.createElement(inner);
  if (type) (field as HTMLInputElement).type = type;
  root.appendChild(field);
  return { host, field: field as HTMLInputElement | HTMLTextAreaElement };
}

test('deepestFocus descends an open shadow root to the focused control', () => {
  const { host, field } = jellyHost('jelly-input', 'input');
  field.focus();
  assert.equal(doc.activeElement, host, 'the document reports the HOST - the whole problem');
  assert.equal(deepestFocus(host), field, 'the walk finds the real <input>');
  assert.equal(deepActiveElement(doc), field);
});

test('deepestFocus stops at a host with nothing focused inside it', () => {
  const { host } = jellyHost('jelly-empty', 'input');
  assert.equal(deepestFocus(host), host, 'no inner focus → the host is the best answer');
  assert.equal(deepestFocus(null), null);
  assert.equal(deepestFocus(undefined), null);
});

test('deepestFocus walks nested shadow roots', () => {
  const outer = doc.createElement('jelly-outer');
  doc.body.appendChild(outer);
  const outerRoot = outer.attachShadow({ mode: 'open' });
  const middle = doc.createElement('jelly-middle');
  outerRoot.appendChild(middle);
  const middleRoot = middle.attachShadow({ mode: 'open' });
  const field = doc.createElement('input');
  middleRoot.appendChild(field);
  field.focus();
  assert.equal(deepestFocus(outer), field);
});

test('isTypingTarget sees through the shadow boundary', () => {
  const { host, field } = jellyHost('jelly-input-2', 'input');
  field.focus();
  assert.equal(isTypingTarget(host), true, 'a focused jelly field IS typing');
  const { host: taHost, field: ta } = jellyHost('jelly-textarea-2', 'textarea');
  ta.focus();
  assert.equal(isTypingTarget(taHost), true);
});

test('isTypingTarget classifies plain elements as before', () => {
  const mk = (tag: string) => doc.createElement(tag);
  assert.equal(isTypingTarget(mk('input')), true);
  assert.equal(isTypingTarget(mk('textarea')), true);
  assert.equal(isTypingTarget(mk('select')), true);
  assert.equal(isTypingTarget(mk('button')), false);
  assert.equal(isTypingTarget(mk('div')), false);
  assert.equal(isTypingTarget(null), false);
  const ce = mk('div');
  Object.defineProperty(ce, 'isContentEditable', { value: true });
  assert.equal(isTypingTarget(ce), true);
});

test('isTextEditingTarget is the narrower, caret-bearing subset', () => {
  const typed = (t: string) => { const el = doc.createElement('input'); el.type = t; return el; };
  assert.equal(isTextEditingTarget(typed('text')), true);
  assert.equal(isTextEditingTarget(typed('tel')), true, 'a phone field is text editing');
  assert.equal(isTextEditingTarget(doc.createElement('input')), true, 'no type attribute ⇒ text');
  assert.equal(isTextEditingTarget(doc.createElement('textarea')), true);
  // These ARE inputs but have no caret and no native undo, so ⌘Z must not fall through.
  assert.equal(isTextEditingTarget(typed('range')), false);
  assert.equal(isTextEditingTarget(typed('color')), false);
  assert.equal(isTextEditingTarget(typed('checkbox')), false);
  assert.equal(isTextEditingTarget(typed('number')), false);
  assert.equal(isTextEditingTarget(doc.createElement('select')), false, 'a select is typing, not text editing');
  // …and the same narrow test still reaches through a shadow root.
  const { host, field } = jellyHost('jelly-input-3', 'input', 'text');
  field.focus();
  assert.equal(isTextEditingTarget(host), true);
});
