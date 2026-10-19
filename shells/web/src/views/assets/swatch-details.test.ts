// SPDX-License-Identifier: MPL-2.0
/**
 * The swatch details sheet's content, without a browser: which value it leads
 * with, which linked values it lists, and that Transparent says it has no colour
 * instead of describing one. The modal, the dock and the chart are exercised in
 * a browser; this pins the facts they are given.
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/assets/swatch-details.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedHtml, notationsHtml, plotHtml, readabilityHtml, swatchFacts, tonesHtml } from './swatch-details.ts';
import { groupPalette, paletteInDisplayOrder } from '../../lib/swatches.ts';
import { toPaletteEntry } from '../../lib/live-palette.ts';
import type { PaletteEntry } from '../../palette.ts';

const pine: PaletteEntry = {
  hex: '#0c322c', label: 'Pine', cmyk: [65, 0, 35, 85],
  token: { ref: '{color.brand.pine}', path: 'color.brand.pine', css: 'color(srgb 0.047059 0.196078 0.172549)' },
};

test('an sRGB colour leads with its hex, and the authored value is listed as a linked value', () => {
  const f = swatchFacts(pine);
  assert.equal(f.lead, '#0C322C');
  assert.equal(f.desc?.inSrgb, true);
  const html = linkedHtml(f);
  assert.match(html, /C 65 {2}M 0 {2}Y 35 {2}K 85/);
  assert.match(html, /\{color\.brand\.pine\}/);
  assert.match(html, /Authored as/);
  assert.doesNotMatch(html, /sRGB fallback/, 'a colour inside sRGB has no fallback to state');
});

test('a colour wider than sRGB is described and led by its authored value, with the hex as its fallback', () => {
  const f = swatchFacts({
    hex: '#00ff00', label: 'Vivid', cmyk: null,
    token: { ref: '{color.brand.vivid}', path: 'color.brand.vivid', css: 'color(display-p3 0 1 0)' },
  });
  assert.equal(f.subject, 'color(display-p3 0 1 0)');
  assert.equal(f.lead, 'color(display-p3 0 1 0)');
  assert.equal(f.desc?.gamut, 'p3');
  assert.match(linkedHtml(f), /sRGB fallback[\s\S]*#00ff00/);
  assert.match(plotHtml(f), /Display-P3/);
  // The srgb row cannot hold it, so it is marked rather than passed off as exact.
  assert.match(notationsHtml(f), /is-inexact[\s\S]*clamped/);
});

test('a spot lock, its finish and the authored faces are all linked values, each copyable', () => {
  const f = swatchFacts({
    hex: '#c8102e', label: 'Signal', cmyk: null,
    spot: { name: 'Gold', book: 'House foils', finish: 'foil' },
    token: {
      ref: '{color.brand.signal}', path: 'color.brand.signal',
      faces: { 'display-p3': 'color(display-p3 0.75 0.1 0.2)', 'icc:abc123:relative': [0, 100, 80, 5] },
    },
  });
  const html = linkedHtml(f);
  assert.match(html, /Finish[\s\S]*Gold[\s\S]*House foils/);
  assert.match(html, /Applied as[\s\S]*foil/);
  assert.match(html, /Authored for Display-P3[\s\S]*color\(display-p3 0\.75 0\.1 0\.2\)/);
  assert.match(html, /Press profile \(relative\)[\s\S]*cmyk\(0% 100% 80% 5%\)/);
  assert.match(html, /data-swatch-copy="Gold"/);
  // No CMYK lock: the row says what an export does instead of inventing numbers.
  assert.match(html, /CMYK[\s\S]*Not set/);
});

test('every notation starts with the hex and each row carries its own copy value', () => {
  const html = notationsHtml(swatchFacts(pine));
  const copies = [...html.matchAll(/data-swatch-copy="([^"]+)"/g)].map(m => m[1]);
  assert.equal(copies[0], '#0C322C');
  assert.ok(copies.some(v => v.startsWith('oklch(')), 'oklch is listed');
  assert.ok(copies.length >= 10, 'hex plus the Colour Lab\'s nine spaces');
});

test('Transparent says it has no colour rather than describing one', () => {
  const f = swatchFacts({ hex: 'transparent', label: 'Transparent', cmyk: null });
  assert.equal(f.desc, null);
  for (const html of [notationsHtml(f), plotHtml(f), tonesHtml(f), readabilityHtml(f)]) {
    assert.doesNotMatch(html, /data-swatch-copy|data-swatch-chart/);
  }
  assert.doesNotMatch(linkedHtml(f), /Not set/, 'no ink to convert, so no CMYK line');
});

test('a token value that is not plainly a colour never becomes the painted value', () => {
  const f = swatchFacts({
    hex: '#112233', label: 'Odd', cmyk: null,
    token: { ref: '{color.odd}', path: 'color.odd', css: 'red; position: fixed' },
  });
  assert.equal(f.subject, '#112233');
});

test('display order is brand, spectrum, then each ramp, the order the Swatches panel indexes', () => {
  const palette: PaletteEntry[] = [
    { hex: '#111111', label: 'Ink 1', cmyk: null },
    { hex: '#222222', label: 'Primary', cmyk: null },
    { hex: '#333333', label: 'Teal', cmyk: null, group: 'spectrum' },
    { hex: '#444444', label: 'Ink 2', cmyk: null },
  ];
  const { brand, spectrum, ramps } = groupPalette(palette);
  assert.deepEqual(
    paletteInDisplayOrder(palette).map(c => c.label),
    [...brand, ...spectrum, ...ramps.flatMap(([, cols]) => cols)].map(c => c.label),
  );
  assert.deepEqual(paletteInDisplayOrder(palette).map(c => c.label), ['Primary', 'Teal', 'Ink 1', 'Ink 2']);
});

test('the live palette keeps what the token knows beyond its hex', () => {
  const entry = toPaletteEntry({
    path: 'color.brand.vivid', name: 'Vivid', group: 'Brand', value: '#00ff00', cmyk: null, spot: null,
    ref: '{color.brand.vivid}', css: 'color(display-p3 0 1 0)', description: 'A loud green',
    faces: { srgb: '#11ee11' },
  });
  assert.deepEqual(entry.token, {
    ref: '{color.brand.vivid}', path: 'color.brand.vivid', css: 'color(display-p3 0 1 0)',
    description: 'A loud green', faces: { srgb: '#11ee11' },
  });
});
