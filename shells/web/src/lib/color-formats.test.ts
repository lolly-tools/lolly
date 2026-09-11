// SPDX-License-Identifier: MPL-2.0
/**
 * color-formats.ts - Hex/RGB/RGBA/OKLCH/CMYK ↔ canonical hex.
 * Run: node --test "shells/web/src/**\/*.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToRgba, rgbaToHex, formatColor, parseColor, rgbToHsl, hslToRgb } from './color-formats.ts';

test('hexToRgba parses #rgb / #rrggbb / #rrggbbaa (with or without #)', () => {
  assert.deepEqual(hexToRgba('#4f83cc'), { r: 79, g: 131, b: 204, a: 1 });
  assert.deepEqual(hexToRgba('4f83cc'), { r: 79, g: 131, b: 204, a: 1 });
  assert.deepEqual(hexToRgba('#08f'), { r: 0, g: 136, b: 255, a: 1 });
  const a = hexToRgba('#4f83cc80')!;
  assert.equal(a.r, 79); assert.ok(Math.abs(a.a - 0.5) < 0.01);
  assert.equal(hexToRgba('nope'), null);
});

test('rgbaToHex round-trips and only appends alpha when < 1', () => {
  assert.equal(rgbaToHex(79, 131, 204), '#4f83cc');
  assert.equal(rgbaToHex(79, 131, 204, 1), '#4f83cc');
  assert.equal(rgbaToHex(0, 136, 255, 0.5), '#0088ff80');
  assert.equal(rgbaToHex(300, -5, 128), '#ff0080'); // clamped to [0,255]
});

test('formatColor renders each space from a hex', () => {
  assert.equal(formatColor('hex', '#4f83cc'), '#4F83CC');
  assert.equal(formatColor('rgb', '#4f83cc'), '79, 131, 204');
  assert.equal(formatColor('rgba', '#4f83cc'), '79, 131, 204, 1');
  assert.equal(formatColor('rgba', '#0088ff80'), '0, 136, 255, 0.502'); // 0x80/255 = 0.502
  // OKLCH: "L% C H" - the perceptual triple the tokens speak.
  assert.match(formatColor('oklch', '#4f83cc'), /^\d+(\.\d+)?% [\d.]+ \d+(\.\d+)?$/);
  // CMYK: four integer percentages.
  assert.match(formatColor('cmyk', '#4f83cc'), /^\d+, \d+, \d+, \d+$/);
  assert.equal(formatColor('rgb', 'transparent'), '');
});

test('parseColor: hex accepts #, bare, and short forms', () => {
  assert.equal(parseColor('hex', '#4f83cc'), '#4f83cc');
  assert.equal(parseColor('hex', '4f83cc'), '#4f83cc');
  assert.equal(parseColor('hex', '#08f'), '#0088ff');
  assert.equal(parseColor('hex', 'not-a-colour!!'), null);
});

test('parseColor: RGB / RGBA are comma- or space-tolerant and clamp', () => {
  assert.equal(parseColor('rgb', '79, 131, 204'), '#4f83cc');
  assert.equal(parseColor('rgb', '79 131 204'), '#4f83cc');
  assert.equal(parseColor('rgb', 'rgb(79, 131, 204)'), '#4f83cc');
  assert.equal(parseColor('rgba', '0, 136, 255, 0.5'), '#0088ff80');
  assert.equal(parseColor('rgba', '0 136 255'), '#0088ff'); // missing alpha → opaque
  assert.equal(parseColor('rgb', '300, 0, 0'), '#ff0000'); // clamp
  assert.equal(parseColor('rgb', 'only two, 5'), null);
});

test('parseColor: OKLCH accepts "L% C H" and oklch(...) and round-trips near-exactly', () => {
  const hex = parseColor('oklch', '60% 0.1 250');
  assert.match(hex!, /^#[0-9a-f]{6}$/i);
  assert.equal(parseColor('oklch', 'oklch(60% 0.1 250)'), hex);
  // Round-trip: hex → oklch text → hex is stable to the byte.
  const back = parseColor('oklch', formatColor('oklch', hex!));
  assert.equal(back, hex);
  assert.equal(parseColor('oklch', '60% 0.1'), null); // needs all three
});

test('parseColor: CMYK (percentages) → rgb hex, and hex→cmyk→hex is close', () => {
  assert.equal(parseColor('cmyk', '0, 0, 0, 0'), '#ffffff');
  assert.equal(parseColor('cmyk', '0, 0, 0, 100'), '#000000');
  assert.equal(parseColor('cmyk', '100, 0, 0, 0'), '#00ffff');
  // A round-trip through the naïve separation lands within a couple of levels.
  const start = '#4f83cc';
  const round = parseColor('cmyk', formatColor('cmyk', start))!;
  const a = hexToRgba(start)!, b = hexToRgba(round)!;
  for (const ch of ['r', 'g', 'b'] as const) {
    assert.ok(Math.abs(a[ch] - b[ch]) <= 3, `${ch}: ${a[ch]} vs ${b[ch]}`);
  }
});

test('alpha survives every space that can carry it (hex8 / RGBA / OKLCH)', () => {
  const translucent = '#0088ff80'; // ~50% blue
  // Hex keeps the alpha byte.
  assert.equal(parseColor('hex', translucent), '#0088ff80');
  assert.equal(formatColor('hex', translucent), '#0088FF80');
  // RGBA shows + parses the 4th channel.
  assert.equal(formatColor('rgba', translucent), '0, 136, 255, 0.502');
  assert.equal(parseColor('rgba', '0, 136, 255, 0.5'), '#0088ff80');
  // OKLCH carries alpha as "… / a" and round-trips back to a hex8.
  const okText = formatColor('oklch', translucent);
  assert.match(okText, / \/ 0?\.\d+$/, `expected an "/ a" suffix, got ${okText}`);
  const round = parseColor('oklch', okText)!;
  assert.match(round, /^#[0-9a-f]{8}$/i);
  assert.ok(Math.abs(parseInt(round.slice(7, 9), 16) - 0x80) <= 2, 'alpha byte preserved via OKLCH');
  // CMYK has no alpha - it stays opaque (a 6-digit hex).
  assert.equal(formatColor('cmyk', translucent), formatColor('cmyk', '#0088ff'));
  assert.match(parseColor('cmyk', formatColor('cmyk', translucent))!, /^#[0-9a-f]{6}$/i);
});

test('empty / whitespace input parses to null (caller holds last good value)', () => {
  for (const f of ['hex', 'rgb', 'rgba', 'oklch', 'cmyk'] as const) {
    assert.equal(parseColor(f, '   '), null);
    assert.equal(parseColor(f, ''), null);
  }
});

test('rgbToHsl / hslToRgb round-trip a saturated colour', () => {
  const [h, s, l] = rgbToHsl(79, 131, 204);
  assert.ok(h > 200 && h < 230, `hue ~215, got ${h}`);
  const [r, g, b] = hslToRgb(h, s, l);
  assert.ok(Math.abs(r - 79) <= 1 && Math.abs(g - 131) <= 1 && Math.abs(b - 204) <= 1, `got ${r},${g},${b}`);
});

test('rgbToHsl: pure grey has zero saturation; hslToRgb honours it', () => {
  const [, s] = rgbToHsl(128, 128, 128);
  assert.equal(Math.round(s), 0);
  assert.deepEqual(hslToRgb(0, 0, 50), [128, 128, 128]);
  assert.deepEqual(hslToRgb(200, 80, 0), [0, 0, 0]);   // black regardless of h/s
  assert.deepEqual(hslToRgb(200, 80, 100), [255, 255, 255]); // white
});

test('serializeColor emits engine-parseable notations in every storage format', async () => {
  const { colorToHex } = await import('@lolly/engine');
  const { serializeColor } = await import('./color-formats.ts');
  const hex = '#4f83cc';
  assert.equal(serializeColor(hex, 'hex'), '#4f83cc');
  assert.equal(serializeColor(hex, 'rgb'), 'rgb(79, 131, 204)');
  assert.match(serializeColor(hex, 'hsl'), /^hsl\(\d+, \d+%, \d+%\)$/);
  assert.match(serializeColor(hex, 'lch'), /^oklch\(/);
  // Every emitted form must round-trip through the engine's parser near-losslessly.
  for (const fmt of ['hex', 'rgb', 'hsl', 'lch'] as const) {
    const back = colorToHex(serializeColor(hex, fmt));
    assert.ok(typeof back === 'string' && back.startsWith('#'), `${fmt} → ${serializeColor(hex, fmt)} → ${back}`);
    const d = (i: number): number => Math.abs(parseInt(back!.slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16));
    assert.ok(d(1) <= 2 && d(3) <= 2 && d(5) <= 2, `${fmt} drifted: ${back}`);
  }
});

test('serializeColor keeps alpha in every storage format', async () => {
  const { colorToHex } = await import('@lolly/engine');
  const { serializeColor } = await import('./color-formats.ts');
  const hex8 = '#0088ff80';
  assert.equal(serializeColor(hex8, 'hex'), '#0088ff80');
  assert.match(serializeColor(hex8, 'rgb'), /^rgba\(0, 136, 255, 0\.50?2?\)$/);
  assert.match(serializeColor(hex8, 'hsl'), /^hsla\(.+, 0\.50?2?\)$/);
  assert.match(serializeColor(hex8, 'lch'), /\/ 0\.50?2?\)$/);
  for (const fmt of ['hex', 'rgb', 'hsl', 'lch'] as const) {
    const back = colorToHex(serializeColor(hex8, fmt));
    assert.ok(typeof back === 'string' && back.length === 9, `${fmt} lost alpha: ${back}`);
  }
});

test('storageFormatOf detects stored notations and defaults to lch', async () => {
  const { storageFormatOf } = await import('./color-formats.ts');
  assert.equal(storageFormatOf('#4f83cc'), 'hex');
  assert.equal(storageFormatOf('rgb(1, 2, 3)'), 'rgb');
  assert.equal(storageFormatOf('rgba(1, 2, 3, .5)'), 'rgb');
  assert.equal(storageFormatOf('hsl(215, 55%, 55%)'), 'hsl');
  assert.equal(storageFormatOf('oklch(62% 0.11 250)'), 'lch');
  assert.equal(storageFormatOf('lch(52% 40 260)'), 'lch');
  assert.equal(storageFormatOf('{color.ramp.primary.5}'), 'lch');
  assert.equal(storageFormatOf(undefined), 'lch');
});
