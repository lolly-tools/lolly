// SPDX-License-Identifier: MPL-2.0
/**
 * anim-svg-mount: an inlined animated SVG gets ids and a style scope of its own.
 *
 * Two boxes showing the same SVG used to inline two copies with the same ids into one
 * document, so `url(#…)` in the second resolved into the first. And an inlined
 * `<style>` was page-global. Both are pinned here on a jsdom document, together with
 * the ready event the sequence clock waits for and the SMIL that must survive.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/anim-svg-mount.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><body></body>');
for (const k of ['window', 'document', 'DOMParser', 'XMLSerializer', 'Node', 'Element', 'HTMLElement', 'CustomEvent', 'DocumentFragment']) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const { mountAnimSvgPlayers } = await import('./anim-svg-mount.ts');

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">'
  + '<defs><linearGradient id="g"><stop offset="0" stop-color="#0c0"/></linearGradient><clipPath id="c"><circle cx="5" cy="5" r="4"/></clipPath></defs>'
  + '<style>.leaf { fill: url(#g) }</style>'
  + '<g id="head" clip-path="url(#c)"><rect class="leaf" width="10" height="10" style="stroke:url(\'#g\')"/>'
  + '<animateTransform attributeName="transform" type="rotate" calcMode="spline" keySplines=".4 0 .6 1" keyTimes="0;1" values="0 5 5;4 5 5" dur="8s" repeatCount="indefinite" additive="sum"/></g>'
  + '</svg>';
const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(SVG)}`;

test('two inlined copies of one SVG never share an id, and every reference follows its own copy', async () => {
  document.body.innerHTML = `<div id="stage"><div data-anim-src="${url}"><img src="${url}"></div><div data-anim-src="${url}"></div></div>`;
  const stage = document.getElementById('stage')!;
  let ready = 0;
  stage.addEventListener('lolly:anim-svg-ready', () => { ready++; });
  await mountAnimSvgPlayers(stage);
  // The ready nudge waits a frame (or a timer, here): it follows the nested-timeline start.
  await new Promise((r) => setTimeout(r, 150));
  const [a, b] = [...stage.querySelectorAll<HTMLElement>('[data-anim-src]')];
  for (const m of [a!, b!]) {
    assert.ok(m.querySelector(':scope > svg'), 'inlined');
    assert.equal(m.querySelector('img'), null, 'the poster gives way to the live SVG');
  }
  assert.equal(ready, 2, 'one ready nudge per mount, for the clock');
  const ids = [...stage.querySelectorAll('[id]')].map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, `ids are unique on the page: ${ids.join(', ')}`);
  for (const m of [a!, b!]) {
    const own = new Set([...m.querySelectorAll('[id]')].map((n) => n.id));
    const head = m.querySelector('g')!;
    assert.ok(own.has(head.getAttribute('clip-path')!.match(/#([^)]+)/)![1]!), 'clip-path points inside its own copy');
    const rect = m.querySelector('rect')!;
    assert.ok(own.has(rect.getAttribute('style')!.match(/#([^'"]+)/)![1]!), 'a url() in a style attribute follows too');
    const css = m.querySelector('style')!.textContent!;
    const ref = css.match(/url\(#([^)]+)\)/)![1]!;
    assert.ok(own.has(ref), 'a url() in its stylesheet follows too');
    assert.match(css, new RegExp(`\\[data-anim-scope="${m.dataset.animScope}"\\] \\.leaf`), 'its stylesheet is scoped to its own marker');
    assert.ok(m.querySelector('style')!.hasAttribute('data-lolly-scope'), 'marked so an exporter can un-scope it');
  }
});

test('the SMIL loop survives the mount, eased timing included', async () => {
  document.body.innerHTML = `<div id="stage"><div data-anim-src="${url}"></div></div>`;
  await mountAnimSvgPlayers(document.getElementById('stage')!);
  const anim = document.querySelector('animateTransform')!;
  assert.equal(anim.getAttribute('additive'), 'sum');
  assert.equal(anim.getAttribute('calcMode'), 'spline', 'calcMode is no longer stripped');
  assert.equal(anim.getAttribute('repeatCount'), 'indefinite');
});
