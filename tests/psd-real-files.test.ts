// SPDX-License-Identifier: MPL-2.0
/**
 * The Photoshop reader against files Photoshop itself saved (psd-tools' test files,
 * MIT, see tests/fixtures/psd/README.md). Hand-made fixtures follow the published
 * format; these follow what Photoshop actually writes, which is where the reader
 * first went wrong (plans/289, 2026-10-02): shape fills in `vscg`, several shapes in
 * one layer, the join of each outline, dashed and aligned strokes, an empty Invert
 * block, and effects that are present but switched off.
 *
 * Run with: node --test tests/psd-real-files.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPsd } from '../engine/src/psd.ts';
import type { RasterLayer } from '../engine/src/raster-layers.ts';

const read = (name: string) => readPsd(new Uint8Array(readFileSync(new URL(`./fixtures/psd/${name}`, import.meta.url))));
const layer = (name: string, layerName: string): RasterLayer => {
  const found = read(name).layers.find(l => l.name === layerName);
  assert.ok(found, `${name} has a layer "${layerName}"`);
  return found;
};

test('type: text, font, size, colour, alignment and the box Photoshop placed', () => {
  const t = layer('text.psd', 'Line 1 Line 2 Line 3 and text').psd!.text!;
  assert.deepEqual(
    { text: t.text, family: t.family, weight: t.weight, italic: t.italic, size: t.size, color: t.color, align: t.align, paragraph: t.paragraph, runs: t.runs.length },
    { text: 'Line 1\nLine 2\nLine 3 and text', family: 'Arial', weight: 400, italic: false, size: 13, color: '#000000', align: 'left', paragraph: false, runs: 1 },
  );
  assert.ok(Math.abs(t.box.x - 84) < 1.5 && Math.abs(t.box.y - 108) < 1.5, `box ${JSON.stringify(t.box)}`);
  const a = layer('layers-minimal_type-layer.psd', 'A').psd!.text!;
  assert.deepEqual([a.text, a.size, a.color, a.align, a.paragraph], ['A', 30, '#ff0000', 'center', true]);
});

test('shapes: the fill comes from vscg, and dashes, caps, joins and alignment come with the stroke', () => {
  const rect = layer('stroke.psd', 'Rectangle 1').psd!.shape!;
  assert.deepEqual(rect, {
    kind: 'rect', box: { x: 44, y: 44, w: 73, h: 38 }, radius: 0, fill: null,
    stroke: { color: '#1d2088', width: 1.47, cap: 'butt', join: 'miter', align: 'inside', dash: [5.88, 2.94] },
  });
  const ellipse = layer('stroke.psd', 'Ellipse 1').psd!.shape!;
  assert.equal(ellipse.kind, 'ellipse');
  assert.equal(ellipse.fill, '#b3d465', 'read from vscg; the layer has no SoCo');
  assert.deepEqual([ellipse.stroke!.cap, ellipse.stroke!.dash], ['round', [0, 2.94]], 'dots are zero-length dashes with round caps');
});

test('what a Design shape cannot draw stays pixels, and the report says why', () => {
  for (const [name, why] of [
    ['Rounded Rectangle 1', /stroke is a gradient or pattern/],
    ['Polygon 1', /Pattern fill kept as pixels/],
    ['Shape 1', /Pattern fill kept as pixels/],
  ] as const) {
    const psd = layer('stroke.psd', name).psd!;
    assert.equal(psd.shape ?? psd.path, undefined, name);
    assert.match(psd.notes.join(' '), why, name);
  }
  const subtracted = layer('path-operations_subtract-all.psd', 'Ellipses').psd!;
  assert.equal(subtracted.path, undefined);
  assert.match(subtracted.notes.join(' '), /subtract, intersect or exclude/);
});

test('paths: a polygon, combined ellipses, and a clipped shape', () => {
  const polygon = layer('layers-minimal_shape-layer.psd', 'Polygon 1').psd!.path!;
  assert.deepEqual([polygon.subpaths.length, polygon.subpaths[0]!.knots.length, polygon.fill, polygon.stroke!.color], [1, 5, '#00ffff', '#ff00ff']);
  const combined = layer('path-operations_combine.psd', 'Ellipses').psd!.path!;
  assert.deepEqual(combined.subpaths.map(s => [s.knots.length, s.op]), [[4, 1], [4, 1], [4, 1]], 'three outlines, each joined by combine');
  assert.equal(combined.fill, '#009944');
  const clipped = layer('clipping-mask.psd', 'Shape 2');
  assert.equal(clipped.clipped, true);
  assert.equal(clipped.psd!.path!.fill, '#ffffff');
});

test('fills, adjustments and effects', () => {
  assert.equal(layer('layers-minimal_solid-color-fill.psd', 'Color Fill 1').psd!.fill, '#ff0000');
  const doc = read('fill_adjustments.psd');
  const adjustments = doc.layers.filter(l => l.psd?.adjustment).map(l => l.psd!.adjustment);
  assert.deepEqual(adjustments, [
    'Brightness/Contrast', 'Levels', 'Curves', 'Exposure', 'Vibrance', 'Hue/Saturation', 'Color Balance', 'Black & White',
    'Photo Filter', 'Channel Mixer', 'Color Lookup', 'Invert', 'Posterize', 'Threshold', 'Selective Color', 'Gradient Map',
  ], 'Invert is an empty block, kept all the same');
  const effects = doc.layers.filter(l => /^Rectangle/.test(l.name)).map(l => l.psd!.notes.join(' '));
  assert.deepEqual(effects, [
    'Layer effects were dropped: gradient overlay.',
    'Layer effects were dropped: pattern overlay.',
    'Layer effects were dropped: gradient overlay.',
  ], 'only the effects switched on are named');
});
