// SPDX-License-Identifier: MPL-2.0
// Run directly: node --test shells/web/src/lib/canvas-annotations.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { annotateTemplate, hydrate } from '@lolly/engine';
import { resolveCanvasAnnotations } from './canvas-annotations.ts';

/** A canvas hydrated the way the tool view hydrates one: the annotated template, rendered. */
function canvasOf(template: string, values: Record<string, unknown>, ids: string[]): HTMLElement {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>');
  const canvas = dom.window.document.getElementById('canvas') as HTMLElement;
  canvas.innerHTML = hydrate(annotateTemplate(template, ids), values);
  return canvas;
}

test('an input inside SVG text is wrapped in a tspan, so the words stay in the drawing', () => {
  // Contrast Check's sample panel: the 17 px line reads the `sample` input directly.
  const canvas = canvasOf(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><text x="2" y="20" font-size="17">{{sample}}</text></svg>',
    { sample: 'Readable at every size' }, ['sample'],
  );
  resolveCanvasAnnotations(canvas);
  const text = canvas.querySelector('text')!;
  const wrapper = text.firstElementChild!;
  assert.equal(wrapper.localName, 'tspan');
  assert.equal(wrapper.namespaceURI, 'http://www.w3.org/2000/svg', 'an SVG tspan, which is drawn, not an HTML span, which is not');
  assert.equal(wrapper.getAttribute('data-canvas-input'), 'sample');
  assert.equal(text.textContent, 'Readable at every size');
  assert.equal(canvas.querySelector('span'), null);
});

test('plain HTML text keeps its transparent span, and elements are marked in place', () => {
  const canvas = canvasOf('<p class="a">{{title}}</p><div>{{{body}}}</div>', { title: 'Hello', body: '<em>x</em>' }, ['title', 'body']);
  resolveCanvasAnnotations(canvas, (id) => id === 'title');
  const span = canvas.querySelector('p span')!;
  assert.equal(span.namespaceURI, 'http://www.w3.org/1999/xhtml');
  assert.equal(span.getAttribute('data-canvas-input'), 'title');
  assert.equal(span.hasAttribute('data-canvas-fixed'), true);
  assert.equal(canvas.querySelector('em')!.getAttribute('data-canvas-input'), 'body');
  assert.equal(canvas.innerHTML.includes('ci:'), false, 'every marker comment is removed');
});

test('text directly inside a non-text SVG element is left unwrapped', () => {
  const canvas = canvasOf('<svg xmlns="http://www.w3.org/2000/svg"><g>{{label}}</g></svg>', { label: 'x' }, ['label']);
  resolveCanvasAnnotations(canvas);
  const g = canvas.querySelector('g')!;
  assert.equal(g.children.length, 0);
  assert.equal(g.textContent, 'x');
  assert.equal(canvas.innerHTML.includes('ci:'), false);
});
