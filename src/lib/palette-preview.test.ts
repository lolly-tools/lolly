// SPDX-License-Identifier: MPL-2.0
/**
 * palette-preview.ts - the three illustrative brand-palette mockups.
 * Focus: shape (3 self-contained SVGs), that real palette colours land in the
 * markup, that hostile colour strings are sanitised out (these SVGs are injected
 * via innerHTML), and that empty / single-colour palettes never throw.
 * Run:  node --test "shells/web/src/lib/palette-preview.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from '@lolly/engine';
import { palettePreviewSvgs } from './palette-preview.ts';

const SUSE = ['#30ba78', '#0c322c', '#efefef', '#fe7c3f', '#2453ff'];

test('returns exactly 3 previews, each a non-empty SVG starting with <svg', () => {
  const previews = palettePreviewSvgs(SUSE);
  assert.equal(previews.length, 3);
  for (const p of previews) {
    assert.ok(typeof p.label === 'string' && p.label.length > 0, 'has a label');
    assert.ok(typeof p.svg === 'string' && p.svg.length > 0, 'has svg content');
    assert.ok(p.svg.startsWith('<svg'), `svg starts with <svg, got: ${p.svg.slice(0, 12)}`);
    assert.ok(p.svg.trimEnd().endsWith('</svg>'), 'svg is closed');
    assert.ok(p.svg.includes('viewBox='), 'svg is viewBox\'d');
    assert.ok(p.svg.includes('width:100%') && p.svg.includes('height:auto'), 'svg is responsive');
  }
});

test('the scenes are self-contained - no <script>, external <image>, or url() refs', () => {
  const all = palettePreviewSvgs(SUSE).map((p) => p.svg).join('\n');
  assert.ok(!/<script/i.test(all), 'no <script>');
  assert.ok(!/<image/i.test(all), 'no <image>');
  assert.ok(!/href/i.test(all), 'no href');
  assert.ok(!/url\(/i.test(all), 'no url() references');
});

test('a passed palette colour appears verbatim in the output', () => {
  const all = palettePreviewSvgs(SUSE).map((p) => p.svg).join('\n');
  assert.ok(all.includes('#30ba78'), 'primary colour is painted somewhere');
  // primary specifically drives the poster background
  const [poster] = palettePreviewSvgs(SUSE);
  assert.ok(poster!.svg.includes('#30ba78'), 'primary is used in the poster');
});

test('malicious colour strings are sanitised - never emitted verbatim', () => {
  const evil = ['#000;url(x)', 'red"/><script>alert(1)</script>', 'javascript:alert(1)', '#12'];
  const all = palettePreviewSvgs(evil).map((p) => p.svg).join('\n');
  for (const bad of evil) {
    assert.ok(!all.includes(bad), `sanitised: ${bad}`);
  }
  assert.ok(!/<script>alert/i.test(all), 'no injected script markup');
  assert.ok(!all.includes('url(x)'), 'no attribute-breakout url()');
});

test('a valid colour mixed in with hostile ones still lands, hostile ones do not', () => {
  const mixed = ['#abcdef', 'red"/>', '#000;url(x)'];
  const all = palettePreviewSvgs(mixed).map((p) => p.svg).join('\n');
  assert.ok(all.includes('#abcdef'), 'the good colour is used');
  assert.ok(!all.includes('red"/>'), 'the bad colour is dropped');
  assert.ok(!all.includes('#000;url(x)'), 'the injection attempt is dropped');
});

test('empty palette does not throw and still renders 3 valid scenes', () => {
  const previews = palettePreviewSvgs([]);
  assert.equal(previews.length, 3);
  for (const p of previews) assert.ok(p.svg.startsWith('<svg') && p.svg.includes('</svg>'));
});

test('single-colour palette does not throw and paints that colour', () => {
  const previews = palettePreviewSvgs(['#ff5d5d']);
  assert.equal(previews.length, 3);
  const all = previews.map((p) => p.svg).join('\n');
  assert.ok(all.includes('#ff5d5d'), 'the single colour appears');
  for (const p of previews) assert.ok(p.svg.startsWith('<svg'));
});

test('chart bar count reflects opts.steps', () => {
  const countRects = (svg: string): number => (svg.match(/<rect/g) ?? []).length;
  const few = palettePreviewSvgs(SUSE, { steps: 3 })[1]!.svg;
  const many = palettePreviewSvgs(SUSE, { steps: 10 })[1]!.svg;
  assert.ok(countRects(many) > countRects(few), 'more steps → more bars');
});

test('is deterministic - same input yields identical SVGs', () => {
  const a = palettePreviewSvgs(SUSE, { steps: 6 });
  const b = palettePreviewSvgs(SUSE, { steps: 6 });
  assert.deepEqual(a, b);
});

test('non-array / junk input is tolerated', () => {
  // deliberately abusive inputs the type system would reject at the call site
  assert.doesNotThrow(() => palettePreviewSvgs(undefined as unknown as string[]));
  assert.doesNotThrow(() => palettePreviewSvgs([null, 42, {}, 'transparent'] as unknown as string[]));
});

test('real scene text stays readable on saturated and middle-lightness backgrounds', () => {
  for (const background of ['#4f9ab1', '#777777', '#29fe4d', '#7c3aed', '#ffeaff']) {
    const poster = palettePreviewSvgs([background])[0]!.svg;
    const fills = [...poster.matchAll(/<text[^>]+fill="(#[a-f0-9]+)"/g)].map(match => match[1]!);
    assert.ok(fills.length > 3, 'real text replaces the old placeholder stripes');
    assert.ok(fills.every(fill => contrastRatio(background, fill) >= 4.5), background);
  }
});

test('scene typography follows loaded brand and display font roles', () => {
  const all = palettePreviewSvgs(SUSE).map(p => p.svg).join('');
  assert.doesNotMatch(all, /Arial|Helvetica/);
  assert.match(all, /font-family="var\(--font-display, var\(--font-brand, sans-serif\)\)"/);
  assert.match(all, /font-family="var\(--font-brand, sans-serif\)"/);
});

test('assigned brand roles paint the actual surfaces and text without invented tints', () => {
  const roles = { primary: '#713184', secondary: '#ff9138', surface: '#faf1e4', text: '#251b34', onPrimary: '#faf1e4' };
  const scenes = palettePreviewSvgs(SUSE, { roles });
  assert.match(scenes[0]!.svg, /<rect width="480" height="360" fill="#713184"/);
  for (const scene of scenes.slice(1)) {
    assert.match(scene.svg, /<rect width="480" height="360" fill="#faf1e4"/);
    assert.match(scene.svg, /<text[^>]+fill="#251b34"/);
  }
  const allowed = new Set([...SUSE, ...Object.values(roles), '#ffffff', '#000000']);
  for (const scene of scenes) {
    for (const [, colour] of scene.svg.matchAll(/(?:fill|stroke)="(#[a-f0-9]+)"/g)) assert.ok(allowed.has(colour!), colour!);
  }
});

test('brand role values have the same attribute safety as palette values', () => {
  const bad = '#000"/><script>alert(1)</script>';
  const all = palettePreviewSvgs(SUSE, { roles: { primary: bad, secondary: bad, surface: bad, text: bad, onPrimary: bad } }).map(p => p.svg).join('');
  assert.doesNotMatch(all, /<script|alert\(1\)/);
});
