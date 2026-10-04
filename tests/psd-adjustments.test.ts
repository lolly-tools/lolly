// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/psd-adjustments.ts and the adjustment-mask check in psd.ts (plans/289
 * M3, item 5): Photoshop adjustment layers read as values. The real file is
 * psd-tools' fill_adjustments.psd (tests/fixtures/psd/), saved by Photoshop with
 * sixteen adjustment layers; the hand-built blocks cover what that file does not.
 *
 * Run with: node --test tests/psd-adjustments.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readPsd } from '../engine/src/psd.ts';
import { writePsd } from '../engine/src/psd-write.ts';
import { readPsdAdjustment, type PsdAdjustmentValue } from '../engine/src/psd-adjustments.ts';
import { D, versioned } from './helpers/psd-fixtures.ts';

const real = readPsd(new Uint8Array(readFileSync(new URL('./fixtures/psd/fill_adjustments.psd', import.meta.url))));
const byName = (name: string) => real.layers.find((l) => l.name === name)!;
const value = (name: string) => byName(name).psd?.adjustmentValue as PsdAdjustmentValue;

test('a real Photoshop file: Levels, Curves, Exposure, Hue/Saturation and Color Balance read as values', () => {
  assert.deepEqual(value('Levels 1'), {
    kind: 'levels',
    channels: [
      { inBlack: 7, inWhite: 235, outBlack: 0, outWhite: 255, gamma: 0.72 },
      ...[1, 2, 3].map(() => ({ inBlack: 0, inWhite: 255, outBlack: 0, outWhite: 255, gamma: 1 })),
    ],
  });
  assert.deepEqual(value('Curves 1'), { kind: 'curves', channels: [[[0, 5], [131, 102], [248, 236]], null, null, null] });
  const ex = value('Exposure 1') as Extract<PsdAdjustmentValue, { kind: 'exposure' }>;
  assert.equal(ex.kind, 'exposure');
  assert.ok(Math.abs(ex.exposure + 0.39) < 1e-6 && Math.abs(ex.gamma - 0.91) < 1e-6);
  const hs = value('Hue/Saturation 1') as Extract<PsdAdjustmentValue, { kind: 'hue-saturation' }>;
  assert.deepEqual([hs.colorize, hs.master], [false, { hue: -17, saturation: 19, lightness: 4 }]);
  assert.equal(hs.ranges.length, 6);
  assert.deepEqual(value('Color Balance 1'), {
    kind: 'color-balance', shadows: [-4, 2, -5], midtones: [10, 4, -9], highlights: [1, -9, -3], preserveLuminosity: true,
  });
});

test('Brightness/Contrast reads the modern values from CgEd, not the zeros left in brit', () => {
  assert.deepEqual(value('Brightness/Contrast 1'), { kind: 'brightness-contrast', brightness: 34, contrast: 18, legacy: false });
  const legacyOnly = new Uint8Array([0x00, 0x14, 0xff, 0xf6, 0x00, 0x7f, 0x00]); // brightness 20, contrast -10
  assert.deepEqual(readPsdAdjustment((k) => (k === 'brit' ? legacyOnly : undefined)), { kind: 'brightness-contrast', brightness: 20, contrast: -10, legacy: true });
});

test('a kind Darkroom has no reader for stays unread; hidden layers and Invert keep their flags', () => {
  for (const name of ['Vibrance 1', 'Photo Filter 1', 'Channel Mixer 1', 'Selective Color 1', 'Color Lookup 1']) {
    assert.equal(byName(name).psd?.adjustmentValue, undefined, name);
    assert.ok(byName(name).psd?.adjustment, `${name} is still named as an adjustment`);
  }
  assert.deepEqual(value('Invert 1'), { kind: 'invert' });
  assert.equal(byName('Invert 1').visible, false);
  for (const l of real.layers) if (l.psd?.adjustment) assert.equal(l.psd.adjustmentMask, 'none', l.name);
});

test('Hue/Saturation with Colorize, and Black & White with a tint colour', () => {
  const hue2 = new Uint8Array(4 + 12 + 6 * 14);
  const v = new DataView(hue2.buffer);
  v.setUint16(0, 2); hue2[2] = 1; // version 2, colorize on
  v.setInt16(4, 210); v.setInt16(6, 40); v.setInt16(8, -5); // the colorize triple
  v.setInt16(16 + 8, 12); // reds: hue +12
  const hs = readPsdAdjustment((k) => (k === 'hue2' ? hue2 : undefined)) as Extract<PsdAdjustmentValue, { kind: 'hue-saturation' }>;
  assert.equal(hs.colorize, true);
  assert.deepEqual(hs.colorized, { hue: 210, saturation: 40, lightness: -5 });
  assert.equal(hs.ranges[0]!.hue, 12);

  const blwh = versioned([
    ['Rd  ', D.long(55)], ['Yllw', D.long(70)], ['Grn ', D.long(-10)], ['Cyn ', D.long(60)], ['Bl  ', D.long(20)], ['Mgnt', D.long(300)],
    ['useTint', D.bool(true)], ['tintColor', D.objc([['Rd  ', D.doub(225)], ['Grn ', D.doub(211)], ['Bl  ', D.doub(179)]])],
  ]);
  assert.deepEqual(readPsdAdjustment((k) => (k === 'blwh' ? blwh : undefined)), {
    kind: 'black-white', reds: 55, yellows: 70, greens: -10, cyans: 60, blues: 20, magentas: 300, tint: '#e1d3b3',
  });
});

test('short blocks and unknown versions read as nothing rather than a guess', () => {
  const get = (k: string, b: Uint8Array) => (key: string) => (key === k ? b : undefined);
  assert.equal(readPsdAdjustment(get('levl', new Uint8Array(10))), null);
  assert.equal(readPsdAdjustment(get('curv', Uint8Array.from([0, 0, 2, 0, 0, 0, 1]))), null, 'curves version 2 is not one Photoshop wrote');
  assert.equal(readPsdAdjustment(get('curv', Uint8Array.from([0, 0, 1, 0, 0, 0, 1, 0, 5]))), null, 'a point list cut short');
  assert.equal(readPsdAdjustment(get('blnc', new Uint8Array(18))), null);
  assert.equal(readPsdAdjustment(get('expA', new Uint8Array(13))), null);
  assert.equal(readPsdAdjustment(() => undefined), null);
});

test('the mask decides where an adjustment applies: none, hidden, partial', () => {
  const W = 8, H = 6;
  const base = { name: 'Photo', x: 0, y: 0, width: W, height: H, pixels: new Uint8Array(W * H * 4).fill(200) };
  const levl = new Uint8Array(2 + 29 * 10);
  const adj = (name: string, extra: Partial<Parameters<typeof writePsd>[0]['layers'][number]> = {}) =>
    ({ name, x: 0, y: 0, width: 0, height: 0, pixels: new Uint8Array(0), extraBlocks: [['levl', levl] as [string, Uint8Array]], ...extra });
  const doc = readPsd(writePsd({
    width: W, height: H,
    layers: [
      base,
      adj('No mask'),
      adj('White mask', { mask: { x: 0, y: 0, width: W, height: H, defaultColor: 255, pixels: new Uint8Array(W * H).fill(255) } }),
      adj('Empty black mask', { mask: { x: 0, y: 0, width: 0, height: 0, defaultColor: 0, pixels: new Uint8Array(0) } }),
      adj('Half mask', { mask: { x: 0, y: 0, width: W, height: H, defaultColor: 255, pixels: Uint8Array.from({ length: W * H }, (_, i) => (i % W < W / 2 ? 0 : 255)) } }),
      adj('Small white mask, black outside', { mask: { x: 2, y: 2, width: 2, height: 2, defaultColor: 0, pixels: new Uint8Array(4).fill(255) } }),
    ],
  }));
  const mask = (name: string) => doc.layers.find((l) => l.name === name)!.psd?.adjustmentMask;
  assert.equal(mask('No mask'), 'none');
  assert.equal(mask('White mask'), 'none');
  assert.equal(mask('Empty black mask'), 'hidden');
  assert.equal(mask('Half mask'), 'partial');
  assert.equal(mask('Small white mask, black outside'), 'partial');
  assert.equal(doc.layers.find((l) => l.name === 'Photo')!.pixels[0], 200, 'the picture layer is unchanged');
});
