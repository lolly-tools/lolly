// SPDX-License-Identifier: MPL-2.0
/**
 * lib/svg-bindings.ts (plans/222): a native-SVG tool that paints with a brand var
 * keeps that inheritance through the export. The full path is exercised - stamp the
 * source onto the clone, serialise, lower through the engine, build the archive -
 * so the assertion is the real appliedTokens the writer emits, not just the
 * attribute text.
 *
 * Run with: node --test shells/web/src/lib/svg-bindings.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { svgInlinePaint, stampSvgBindings } from './svg-bindings.ts';
import { svgToPenpotDoc, buildPenpotEntries, seededPenpotUuid } from '../../../../engine/src/penpot-file.ts';

const brandTokens = { color: { $type: 'color', semantic: { primary: { $value: '#30ba78' }, edge: { $value: '#cccccc' } } } };
// The shell's resolver: a {alias} directly, a var(--brand-*) through the (test) map.
const resolve = (css: string): string | null => {
  const s = css.trim();
  const alias = /^\{([A-Za-z0-9_.-]+)\}$/.exec(s);
  if (alias) return alias[1]!;
  const v = /^var\(\s*(--[\w-]+)/.exec(s);
  if (v) return ({ '--brand-primary': 'color.semantic.primary', '--brand-edge': 'color.semantic.edge' } as Record<string, string>)[v[1]!] ?? null;
  return null;
};

test('svgInlinePaint reads a var from the style declaration first, then the attribute', () => {
  const dom = new JSDOM('<svg><rect style="fill: var(--brand-primary)" stroke="var(--brand-edge)"/><rect fill="#123456"/></svg>');
  const [a, b] = Array.from(dom.window.document.querySelectorAll('rect'));
  assert.equal(svgInlinePaint(a!, 'fill'), 'var(--brand-primary)');
  assert.equal(svgInlinePaint(a!, 'stroke'), 'var(--brand-edge)');
  assert.equal(svgInlinePaint(b!, 'fill'), '#123456');
  dom.window.close();
});

test('a var-painted SVG shape keeps its token binding through stamp → lower → build', () => {
  const dom = new JSDOM('<!doctype html><body><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    '<rect id="surface" x="10" y="10" width="80" height="70" fill="var(--brand-primary, #30ba78)" stroke="var(--brand-edge, #cccccc)" stroke-width="2"/>' +
    '<rect id="plain" x="10" y="85" width="10" height="10" fill="#ff0000"/>' +
    '</svg></body>');
  const svg = dom.window.document.querySelector('svg')!;

  stampSvgBindings(svg, resolve);
  assert.equal(svg.querySelector('#surface')!.getAttribute('data-lolly-bind'), 'fill:color.semantic.primary;strokeColor:color.semantic.edge');
  assert.equal(svg.querySelector('#plain')!.getAttribute('data-lolly-bind'), null, 'a literal is not stamped');

  // The engine reads the attribute even after the var is baked to a hex (simulate the
  // bake by setting a concrete fill; the binding must not depend on the var surviving).
  svg.querySelector('#surface')!.setAttribute('fill', '#30ba78');
  svg.querySelector('#surface')!.setAttribute('stroke', '#cccccc');
  const xml = new dom.window.XMLSerializer().serializeToString(svg);
  dom.window.close();

  const lowered = svgToPenpotDoc(xml, { name: 'Native SVG', tokens: brandTokens });
  assert.ok(lowered, 'the svg lowered');
  const build = buildPenpotEntries(lowered!.doc, { uuid: seededPenpotUuid(71), now: () => '2026-09-07T00:00:00Z' });
  const shapes = Object.entries(build.entries)
    .filter(([p]) => /\/pages\/[^/]+\/[^/]+\.json$/.test(p))
    .map(([, v]) => JSON.parse(v as string));
  const surface = shapes.find(s => s.name === 'surface');
  assert.deepEqual(surface.appliedTokens, { fill: 'color.semantic.primary', strokeColor: 'color.semantic.edge' });
  assert.ok(!shapes.some(s => s.name === 'plain' && s.appliedTokens), 'the literal rect is unbound');
  assert.deepEqual(build.warnings, []);
});
