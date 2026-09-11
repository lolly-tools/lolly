// SPDX-License-Identifier: MPL-2.0
/**
 * Id-namespacing for inlined SVG subtrees (svg-inline-ids.ts).
 * Run directly:  node --test shells/web/src/bridge/svg-inline-ids.test.ts
 *
 * Pins the duplicate-id collision fix found 2026-08-10: pre-rendered files
 * inlined by the walker each carried their own `fcovclip-1`, so every
 * reference bound to the first file's clip geometry and later covers' titles
 * were clipped to nothing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { namespaceInlinedSvgIds } from './svg-inline-ids.ts';

const parse = (xml: string): Element => {
  const dom = new JSDOM(xml, { contentType: 'image/svg+xml' });
  return dom.window.document.documentElement;
};

test('ids and url()/href references are rewritten together', () => {
  const svg = parse(`<svg xmlns="http://www.w3.org/2000/svg">
    <clipPath id="fcovclip-1"><rect width="10" height="10"/></clipPath>
    <linearGradient id="grad"><stop stop-color="#fff"/></linearGradient>
    <g clip-path="url(#fcovclip-1)"><rect fill="url('#grad')" width="20" height="20"/></g>
    <use href="#fcovclip-1"/><use xlink:href="#grad" xmlns:xlink="http://www.w3.org/1999/xlink"/>
  </svg>`);
  namespaceInlinedSvgIds(svg, '/catalog/previews/battlecards.svg');

  const clip = svg.querySelector('clipPath')!;
  assert.match(clip.getAttribute('id')!, /^i[0-9a-z]+-fcovclip-1$/);
  const p = clip.getAttribute('id')!.slice(0, clip.getAttribute('id')!.indexOf('-') + 1);
  assert.equal(svg.querySelector('g')!.getAttribute('clip-path'), `url(#${p}fcovclip-1)`);
  assert.equal(svg.querySelector('rect[fill]')!.getAttribute('fill'), `url('#${p}grad')`);
  assert.equal(svg.querySelector('use[href]')!.getAttribute('href'), `#${p}fcovclip-1`);
  assert.equal(svg.querySelector('use[*|href]:not([href])')!.getAttribute('xlink:href'), `#${p}grad`);
});

test('two different sources get different prefixes; the same source is stable', () => {
  const mk = () => parse('<svg xmlns="http://www.w3.org/2000/svg"><clipPath id="c"/><g clip-path="url(#c)"/></svg>');
  const a1 = mk(), a2 = mk(), b = mk();
  namespaceInlinedSvgIds(a1, 'a.svg');
  namespaceInlinedSvgIds(a2, 'a.svg');
  namespaceInlinedSvgIds(b, 'b.svg');
  const idOf = (s: Element): string => s.querySelector('clipPath')!.getAttribute('id')!;
  assert.equal(idOf(a1), idOf(a2), 'same source, same prefix - repeat exports stay byte-identical');
  assert.notEqual(idOf(a1), idOf(b), 'different sources cannot collide');
});

test('style blocks are rewritten; foreign ids and plain text are left alone', () => {
  const svg = parse(`<svg xmlns="http://www.w3.org/2000/svg">
    <style>#mine{fill:red} .x{clip-path:url(#mine)} #other{fill:blue}</style>
    <rect id="mine" width="5" height="5"/>
    <g clip-path="url(#not-mine)"/>
  </svg>`);
  namespaceInlinedSvgIds(svg, 'c.svg');
  const css = svg.querySelector('style')!.textContent!;
  assert.match(css, /#i[0-9a-z]+-mine\{fill:red\}/);
  assert.match(css, /url\(#i[0-9a-z]+-mine\)/);
  assert.match(css, /#other\{fill:blue\}/, 'ids not defined in this subtree are untouched');
  assert.equal(svg.querySelector('g')!.getAttribute('clip-path'), 'url(#not-mine)');
});

test('a subtree with no ids is untouched', () => {
  const svg = parse('<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1" fill="url(#ext)"/></svg>');
  namespaceInlinedSvgIds(svg, 'd.svg');
  assert.equal(svg.querySelector('rect')!.getAttribute('fill'), 'url(#ext)');
});
