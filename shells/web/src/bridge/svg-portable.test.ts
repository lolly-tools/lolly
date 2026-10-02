// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parseSvgPath } from '@lolly/engine';
import { compactPathData, compactSvgPaths, portablePaint, portableSvgPaint } from './svg-portable.ts';

const svg = (body: string): Element => {
  const { window } = new JSDOM(`<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`, { contentType: 'image/svg+xml' });
  return window.document.documentElement;
};

test('paint SVG 1.1 cannot read moves its alpha to the paired opacity', () => {
  assert.equal(portablePaint('fill', 'rgb(12, 50, 44)'), null);
  assert.equal(portablePaint('fill', '#0c322c'), null);
  assert.equal(portablePaint('fill', 'url(#g)'), null);
  assert.equal(portablePaint('fill', 'currentColor'), null);
  assert.deepEqual(portablePaint('fill', 'rgba(12,50,44,0.13)'), { paint: '#0c322c', alpha: 0.13 });
  assert.deepEqual(portablePaint('stroke', 'oklch(0.5 0 0)'), { paint: '#636363', alpha: 1 });
  assert.deepEqual(portablePaint('fill', 'transparent'), { paint: 'none', alpha: 1 });
  assert.deepEqual(portablePaint('stop-color', 'rgba(0,0,0,0)'), { paint: '#000000', alpha: 0 });
});

test('the Snippet close button keeps its tint and its × in an SVG 1.1 reader', () => {
  const root = svg(
    '<rect fill="rgba(12,50,44,0.13)"/>'
    + '<line stroke="rgba(12,50,44,0.92)" style="stroke: rgba(12, 50, 44, 0.92); stroke-width: 1.5px;"/>'
    + '<g fill-opacity="0.5"><rect fill="rgba(0,0,0,0.25)"/></g>'
    + '<rect fill="rgba(0,0,0,0.5)" style="fill-opacity: 0.5"/>'
    + '<linearGradient><stop stop-color="rgba(255,0,0,0.4)" stop-opacity="0.5"/></linearGradient>',
  );
  portableSvgPaint(root);
  const [disc, inner, styled] = root.querySelectorAll('rect');
  assert.equal(disc!.getAttribute('fill'), '#0c322c');
  assert.equal(disc!.getAttribute('fill-opacity'), '0.13');
  const cross = root.querySelector('line')!;
  assert.equal(cross.getAttribute('stroke'), '#0c322c');
  assert.match(cross.getAttribute('style')!, /stroke: #0c322c;/);
  assert.equal(cross.getAttribute('stroke-opacity'), '0.92');
  assert.equal(inner!.getAttribute('fill-opacity'), '0.125', 'multiplied into the inherited opacity');
  assert.match(styled!.getAttribute('style')!, /fill-opacity: 0.25/, 'written where it wins');
  assert.equal(root.querySelector('stop')!.getAttribute('stop-opacity'), '0.2');
  assert.doesNotMatch(root.outerHTML, /rgba\(/);
});

const points = (d: string) => parseSvgPath(d).map(s => ({
  closed: s.closed,
  segments: s.segments.map(g => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 1e6) / 1e6 : v]))),
}));

test('path data packs without moving a point', () => {
  const glyphs = 'M2.47,0L2.47,-15.31Q2.47,-16.56 3.28,-17.38Q4.08,-18.2 5.36,-18.2L13.65,-18.2L13.65,-16.28Z'
    + 'M17.86,0L17.86,-18.2L23.53,-18.2C26.29,-18.2 27.96,-16.81 27.96,-14.16T25.2,-9.8S22.1,-8 20,-8L17.86,0Z';
  const packed = compactPathData(glyphs);
  assert.ok(packed.length < glyphs.length * 0.75, `${packed.length} of ${glyphs.length}`);
  assert.deepEqual(points(packed), points(glyphs));
  assert.equal(compactPathData('M0 0L10 0L10 5L0 5Z'), 'm0 0h10v5h-10z');
  // Relative input, implicit lineto after a move, and a move after a close.
  const mixed = 'm10.5 10 5 0 0 5z m 2 2 l .25-.25 h3 v-1 Z';
  assert.deepEqual(points(compactPathData(mixed)), points(mixed));
});

test('path data the packer cannot keep exact is left alone', () => {
  for (const d of ['M0 0A5 5 0 0 1 10 10', 'M1e3 0L0 0', 'M0.123456 0L1 1', 'L1 1', 'M0 0L1']) {
    assert.equal(compactPathData(d), d);
  }
});

test('passthrough markup keeps its path strings and paths the walker drew are packed', () => {
  const settled = 'M2.47,0L2.47,-15.31Z';
  const root = svg(`<g><path d="${settled}"/></g><g><svg><path d="${settled}"/></svg></g>`);
  compactSvgPaths(root);
  const [own, passthrough] = root.querySelectorAll('path');
  assert.equal(own!.getAttribute('d'), 'm2.47 0v-15.31z');
  assert.equal(passthrough!.getAttribute('d'), settled, 'a Design text frame exports its settled glyph paths verbatim');
});
