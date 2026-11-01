// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { createTokenSet, TOKEN_EXT } from '../../../../engine/src/tokens.ts';
import { swatchFace, tokenColorVar } from '../../../../engine/src/color-face.ts';
import { designColorValue, designStopColorValue } from './design-color.ts';

test('inspector and canvas colour policy retain a token link with authored sRGB and P3 faces', () => {
  const tokens = createTokenSet({ color: { $type: 'color', brand: { green: {
    $value: '#00aa44', $extensions: { [TOKEN_EXT]: { faces: {
      srgb: { value: '#00aa44' }, 'display-p3': { value: 'color(display-p3 0 1 0)' },
    } } },
  } }, semantic: { primary: { $value: '{color.brand.green}' } } } });
  const swatch = tokens.colors().find(s => s.path === 'color.semantic.primary')!;
  const ref = '{color.semantic.primary}';
  const linked = { ref, value: swatch.value };
  for (const range of ['sdr', 'hdr']) {
    assert.equal(designColorValue(linked, range), `var(${tokenColorVar(ref)}, #00aa44)`);
  }
  assert.equal(swatchFace(swatch, 'srgb'), '#00aa44');
  assert.equal(swatchFace(swatch, 'display-p3'), 'color(display-p3 0 1 0)');
});

test('a gradient stop takes a picked swatch as its plain colour, so the stop changes at once', () => {
  const linked = { ref: '{color.semantic.primary}', value: '#00aa44' };
  assert.equal(designStopColorValue(linked, 'sdr'), '#00aa44');
  assert.equal(designStopColorValue('#00aa4480', 'sdr'), '#00aa4480', 'a colour with opacity passes through');
  assert.match(designColorValue(linked, 'sdr'), /^var\(/, 'an ordinary fill keeps its token link');
});
