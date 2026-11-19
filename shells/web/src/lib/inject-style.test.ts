// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { injectStyleOnce } from './inject-style.ts';

function setDocument(t: TestContext, doc?: Document): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'document');
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'document', previous);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  if (doc) Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  else Reflect.deleteProperty(globalThis, 'document');
}

function makeDocument(t: TestContext): Document {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>');
  t.after(() => dom.window.close());
  return dom.window.document;
}

test('injects one style into the current document head with the exact CSS', (t) => {
  const doc = makeDocument(t);
  setDocument(t, doc);
  const css = '\n.example { color: red; }\n';
  injectStyleOnce('example-styles', css);
  const style = doc.getElementById('example-styles');
  assert.equal(style?.tagName, 'STYLE');
  assert.equal(style?.parentNode, doc.head);
  assert.equal(style?.textContent, css);
  assert.deepEqual(style?.getAttributeNames(), ['id']);
});

test('repeated injection leaves the first style and its CSS unchanged', (t) => {
  const doc = makeDocument(t);
  injectStyleOnce('example-styles', 'first', doc);
  const first = doc.getElementById('example-styles');
  injectStyleOnce('example-styles', 'second', doc);
  assert.equal(doc.getElementById('example-styles'), first);
  assert.equal(first?.textContent, 'first');
  assert.equal(doc.querySelectorAll('style').length, 1);
});

test('an existing id on any element prevents injection', (t) => {
  const doc = makeDocument(t);
  const existing = doc.createElement('div');
  existing.id = 'example-styles';
  doc.body.appendChild(existing);
  injectStyleOnce(existing.id, 'unused', doc);
  assert.equal(doc.querySelectorAll('style').length, 0);
});

test('does nothing without a document', (t) => {
  setDocument(t);
  assert.doesNotThrow(() => injectStyleOnce('example-styles', 'unused'));
  assert.doesNotThrow(() => injectStyleOnce('example-styles', 'unused', null));
});

test('honours a passed document and falls back to the current document for null', (t) => {
  const current = makeDocument(t);
  const passed = makeDocument(t);
  setDocument(t, current);
  injectStyleOnce('example-styles', 'passed', passed);
  assert.equal(passed.head.querySelector('style')?.textContent, 'passed');
  assert.equal(current.querySelector('style'), null);
  injectStyleOnce('example-styles', 'current', null);
  assert.equal(current.head.querySelector('style')?.textContent, 'current');
  assert.equal(passed.head.querySelector('style')?.textContent, 'passed');
});
