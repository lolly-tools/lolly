// SPDX-License-Identifier: MPL-2.0
/**
 * views/psd-grade.ts: which Photoshop adjustment layers become Darkroom's grade,
 * the values they become, and the report lines for the ones that do not. The last
 * test runs psd-tools' fill_adjustments.psd, a file Photoshop saved, through the whole mapping.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { RasterLayer } from '../../../../engine/src/raster-layers.ts';
import type { PsdAdjustmentValue } from '../../../../engine/src/psd-adjustments.ts';
import { readPsd } from '../../../../engine/src/psd.ts';
import { darkroomGradeFromLayers, hueSat, mapAdjustment } from './psd-grade.ts';

const picture = (name = 'Photo'): RasterLayer => ({
  name, x: 0, y: 0, width: 4, height: 4, pixels: new Uint8Array(64), opacity: 1, blend: 'normal', blendRaw: 'psd:norm',
  blendLossy: false, visible: true, clipped: false, isGroup: false, groupPath: [],
});
const adjustment = (name: string, value: PsdAdjustmentValue | undefined, extra: Partial<RasterLayer> = {}, mask: 'none' | 'hidden' | 'partial' = 'none'): RasterLayer => ({
  ...picture(name), width: 0, height: 0, pixels: new Uint8Array(0),
  psd: { notes: [], adjustment: name, ...(value ? { adjustmentValue: value } : {}), adjustmentMask: mask }, ...extra,
});
const levels = (inBlack: number, gamma = 1): PsdAdjustmentValue => ({
  kind: 'levels', channels: [{ inBlack, inWhite: 255, outBlack: 0, outWhite: 255, gamma }, null, null, null],
});

test('top-of-stack Levels and Color Balance become the grade, value for value', () => {
  const g = darkroomGradeFromLayers([
    picture(),
    adjustment('Levels 1', levels(12, 1.4)),
    adjustment('Balance', { kind: 'color-balance', shadows: [1, 2, 3], midtones: [4, 5, 6], highlights: [-7, -8, -9], preserveLuminosity: false }),
  ]);
  assert.deepEqual(g.inputs, {
    levelsInBlack: 12, levelsInWhite: 255, levelsOutBlack: 0, levelsOutWhite: 255, levelsGamma: 1.4,
    cbShadowsCR: 1, cbShadowsMG: 2, cbShadowsYB: 3, cbMidtonesCR: 4, cbMidtonesMG: 5, cbMidtonesYB: 6,
    cbHighlightsCR: -7, cbHighlightsMG: -8, cbHighlightsYB: -9, cbPreserve: false,
  });
  assert.deepEqual(g.kept, ['Levels 1: kept.', 'Balance: kept.']);
  assert.deepEqual(g.notes, []);
});

test('an adjustment under a picture, clipped, masked, faded or in a group is reported, not applied', () => {
  const g = darkroomGradeFromLayers([
    picture('Back'),
    adjustment('Under', levels(5)),
    picture('Front'),
    adjustment('Clipped', levels(5), { clipped: true }),
    adjustment('Masked', { kind: 'invert' }, {}, 'partial'),
    adjustment('Faded', { kind: 'exposure', exposure: 1, offset: 0, gamma: 1 }, { opacity: 0.5 }),
    adjustment('Grouped', { kind: 'black-white', reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80, tint: null }, { groupPath: [0] }),
    adjustment('Black mask', levels(9), {}, 'hidden'),
    adjustment('Hidden', levels(9), { visible: false }),
    adjustment('Vibrance 1', undefined),
  ]);
  assert.deepEqual(g.inputs, {});
  assert.deepEqual(g.kept, []);
  const text = g.notes.join('\n');
  for (const [name, why] of [['Under', /layers under it/], ['Clipped', /clipped/], ['Masked', /part of the picture/], ['Faded', /50% opacity/], ['Grouped', /inside a group/], ['Vibrance 1', /no control/]] as const) {
    assert.match(text, new RegExp(`${name}[^\\n]*`), name);
    assert.match(g.notes.find((n) => n.startsWith(name))!, why, name);
  }
  assert.ok(!/Black mask|Hidden/.test(text), 'an adjustment that shows nowhere needs no line');
});

test('two adjustments for one control: the lower one wins and the upper one is reported', () => {
  const g = darkroomGradeFromLayers([picture(), adjustment('Curves', { kind: 'curves', channels: [[[0, 0], [128, 160], [255, 255]], null, null, null] }), adjustment('Invert', { kind: 'invert' })]);
  assert.equal(g.inputs.curveRgb, '0-0_128-160_255-255');
  assert.equal(g.notes[0], 'Invert was not applied. Curves, lower in the stack, already sets the same Darkroom control.');
});

test('an order Darkroom does not follow gets one line', () => {
  const inOrder = darkroomGradeFromLayers([picture(), adjustment('L', levels(3)), adjustment('B', { kind: 'color-balance', shadows: [0, 0, 0], midtones: [5, 0, 0], highlights: [0, 0, 0], preserveLuminosity: true })]);
  assert.equal(inOrder.notes.length, 0);
  const reversed = darkroomGradeFromLayers([picture(), adjustment('B', { kind: 'color-balance', shadows: [0, 0, 0], midtones: [5, 0, 0], highlights: [0, 0, 0], preserveLuminosity: true }), adjustment('L', levels(3))]);
  assert.match(reversed.notes.join(' '), /fixed order/);
});

test('values: Invert, Colorize, a tint colour, Hue/Saturation bands and Exposure limits', () => {
  assert.deepEqual(mapAdjustment({ kind: 'invert' }).inputs, { curveRgb: '0-255_255-0' });
  const colorize = mapAdjustment({ kind: 'hue-saturation', colorize: true, colorized: { hue: -30, saturation: 40, lightness: 0 }, master: { hue: 0, saturation: 0, lightness: 0 }, ranges: [] });
  assert.deepEqual(colorize.inputs, { bwMode: true, bwTint: true, bwTintHue: 330, bwTintSat: 40 });
  assert.deepEqual(hueSat('#e1d3b3'), { hue: 42, sat: 43 });
  const hs = mapAdjustment({
    kind: 'hue-saturation', colorize: false, colorized: { hue: 0, saturation: 0, lightness: 0 },
    master: { hue: 20, saturation: -30, lightness: 0 },
    ranges: [{ hue: 10, saturation: 25, lightness: -5 }, ...Array.from({ length: 5 }, () => ({ hue: 0, saturation: 0, lightness: 0 }))],
  });
  assert.equal(hs.inputs.saturation, 70);
  assert.equal(hs.inputs.hslHueRed, 75, '20 + 10 degrees at 0.4 degrees a step');
  assert.equal(hs.inputs.hslHueOrange, 50);
  assert.equal(hs.inputs.hslSatRed, 25);
  assert.equal(hs.inputs.hslLumRed, -5);
  const ev = mapAdjustment({ kind: 'exposure', exposure: 5, offset: 0.1, gamma: 1 });
  assert.equal(ev.inputs.exposure, 3);
  assert.equal(ev.approximate.length, 2);
});

test('the real file: the adjustments above the shapes, reported line by line', () => {
  const doc = readPsd(new Uint8Array(readFileSync(new URL('../../../../tests/fixtures/psd/fill_adjustments.psd', import.meta.url))));
  const g = darkroomGradeFromLayers(doc.layers);
  // Brightness/Contrast and Exposure both want exposure: the lower one (B/C) wins.
  assert.equal(g.inputs.exposure, 0.23);
  assert.equal(g.inputs.contrast, 18);
  assert.equal(g.inputs.levelsInBlack, 7);
  assert.equal(g.inputs.levelsGamma, 0.72);
  assert.equal(g.inputs.curveRgb, '0-5_131-102_248-236');
  assert.equal(g.inputs.saturation, 119);
  assert.equal(g.inputs.cbMidtonesCR, 10);
  assert.ok(!('bwMode' in g.inputs), 'Black & White is hidden in the file');
  assert.equal(g.kept.length, 5);
  assert.match(g.notes.join('\n'), /Exposure 1 was not applied\. Brightness\/Contrast 1, lower in the stack, already sets the same Darkroom control/);
  assert.match(g.notes.join('\n'), /Selective Color 1 was not applied\. Darkroom has no control/);
});
