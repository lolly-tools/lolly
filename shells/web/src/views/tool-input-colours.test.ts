// SPDX-License-Identifier: MPL-2.0
/**
 * The tool sidebar's colour fields and the automatic (empty) state
 * (views/tool-input-colours.ts, components/color-field.ts ColorFieldAuto).
 *
 * Certificate's Ink, Paper and Accent, Chart's empty colours and Timezone's
 * overrides showed a black chip announced as "#000000" while the tool drew a
 * design-system colour. These pin the host half: which inputs get the automatic
 * state, the label in the accessible name, and the colour read back from the
 * hook's `autoColors` extra.
 *
 * Run: node --test shells/web/src/views/tool-input-colours.test.ts
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true });
Object.assign(globalThis, {
  window: dom.window, document: dom.window.document, HTMLElement: dom.window.HTMLElement, Element: dom.window.Element,
  Event: dom.window.Event, Node: dom.window.Node, getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
});

const { colourInputHtml, blockColourFieldHtml, readAutoColours, paintAutoColours } = await import('./tool-input-colours.ts');
const { setSwatches } = await import('../components/color-field.ts');

/** A runtime stand-in: getHydratedText over a fixed set of extras, the way the engine hydrates. */
function runtimeWith(extras: Record<string, unknown>) {
  const read = (path: string): string => {
    let v: unknown = extras;
    for (const k of path.split('.')) v = v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined;
    return v == null ? '' : String(v);
  };
  return { getHydratedText: (tpl: string) => tpl.replace(/\{\{([\w.]+)\}\}/g, (_m, p: string) => read(p)) };
}

test('only an input whose default is empty gets the automatic state, and every field leads with its label', () => {
  const host = document.getElementById('host')!;
  host.innerHTML = colourInputHtml('color', { value: '', default: '', label: 'Ink' })
    + colourInputHtml('accent', { value: '#033633', default: '{color.semantic.primary}', label: 'Accent' });
  const [ink, accent] = [...host.querySelectorAll<HTMLElement>('[data-color-field]')];
  assert.ok(ink!.hasAttribute('data-color-auto') && ink!.hasAttribute('data-color-empty'));
  assert.equal(ink!.querySelector('.color-trigger')!.getAttribute('aria-label'), 'Ink: automatic');
  assert.equal(accent!.hasAttribute('data-color-auto'), false, 'a token default is never emptied from the picker');
  assert.match(accent!.querySelector('.color-trigger')!.getAttribute('aria-label')!, /^Accent: /);
  host.innerHTML = blockColourFieldHtml('locations:0:color', '', {});
  assert.ok(host.querySelector('[data-color-field]')!.hasAttribute('data-color-empty'), 'a block field with no default reads as automatic too');
});

test('the colour the tool reports for an empty input reaches its chip and its accessible name', () => {
  setSwatches([{ value: '#09141a', label: 'Liquorice', group: 'Brand', ref: null }]);
  const host = document.getElementById('host')!;
  host.innerHTML = colourInputHtml('color', { value: '', default: '', label: 'Ink' })
    + colourInputHtml('textColor', { value: '', default: '', label: 'Text & axis colour' });
  const runtime = runtimeWith({ autoColors: { color: { value: '#09141a', source: 'design-system' } } });
  paintAutoColours(host, runtime);
  const ink = host.querySelector<HTMLElement>('[data-color-field="color"]')!;
  assert.equal(ink.querySelector('.color-trigger')!.getAttribute('aria-label'), 'Ink: follows the design system (Liquorice)');
  assert.equal(ink.querySelector<HTMLElement>('.color-trigger-preview')!.style.background.replace(/\s/g, ''), 'rgb(9,20,26)');
  const text = host.querySelector<HTMLElement>('[data-color-field="textColor"]')!;
  assert.equal(text.querySelector('.color-trigger')!.getAttribute('aria-label'), 'Text & axis colour: automatic', 'no report: the neutral automatic chip');
});

test('readAutoColours reads every field in one pass and skips ids a template path cannot hold', () => {
  const calls: string[] = [];
  const runtime = { getHydratedText: (tpl: string) => { calls.push(tpl); return runtimeWith({ autoColors: { a: { value: '#fff' }, b: { value: '#000', source: 'design-system' } } }).getHydratedText(tpl); } };
  const out = readAutoColours(runtime, ['a', 'b', 'not-a-path', 'blocks:0:c']);
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.fromEntries(out), { a: { color: '#fff', source: 'tool' }, b: { color: '#000', source: 'design-system' } });
  assert.equal(readAutoColours({ getHydratedText: () => { throw new Error('destroyed'); } }, ['a']).size, 0, 'a runtime that cannot answer leaves the chips as they are');
});
