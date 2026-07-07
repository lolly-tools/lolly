/**
 * Colour-profile contract tests: the generated sRGB ICC profile is structurally
 * valid, RGB→CMYK matches the documented formula, and the press-condition
 * registry resolves sanely.
 * Run with: node --test tests/color.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  srgbIccProfile, iccProfileBytes, COLOR_PROFILES,
  rgbToCmyk, cmykCondition, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION,
} from '../engine/src/color.ts';

const sig = (buf: Uint8Array, off: number): string =>
  String.fromCharCode(buf[off]!, buf[off + 1]!, buf[off + 2]!, buf[off + 3]!);
const u32 = (buf: Uint8Array, off: number): number =>
  ((buf[off]! << 24) | (buf[off + 1]! << 16) | (buf[off + 2]! << 8) | buf[off + 3]!) >>> 0;

test('srgbIccProfile: valid ICC header', () => {
  const p = srgbIccProfile();
  assert.ok(p instanceof Uint8Array);
  assert.equal(sig(p, 36), 'acsp');           // required profile file signature
  assert.equal(u32(p, 0), p.length);          // header size field === actual size
  assert.equal(u32(p, 8) >>> 0, 0x02100000);  // version 2.1
  assert.equal(sig(p, 12), 'mntr');           // display device class
  assert.equal(sig(p, 16), 'RGB ');           // data colour space
  assert.equal(sig(p, 20), 'XYZ ');           // PCS
});

test('srgbIccProfile: required tags are present and in-bounds', () => {
  const p = srgbIccProfile();
  const count = u32(p, 128);
  const tags = new Map<string, { offset: number; size: number }>();
  for (let i = 0; i < count; i++) {
    const o = 132 + i * 12;
    tags.set(sig(p, o), { offset: u32(p, o + 4), size: u32(p, o + 8) });
  }
  for (const t of ['desc', 'wtpt', 'rXYZ', 'gXYZ', 'bXYZ', 'rTRC', 'gTRC', 'bTRC', 'cprt']) {
    assert.ok(tags.has(t), `missing tag ${t}`);
    const { offset, size } = tags.get(t)!;
    assert.ok(offset + size <= p.length, `tag ${t} runs past end of profile`);
  }
  // The three TRC tags share one curve blob (offset reuse) to stay compact.
  assert.equal(tags.get('rTRC')!.offset, tags.get('gTRC')!.offset);
  assert.equal(tags.get('gTRC')!.offset, tags.get('bTRC')!.offset);
});

test('srgbIccProfile: memoised (stable identity)', () => {
  assert.equal(srgbIccProfile(), srgbIccProfile());
});

test('iccProfileBytes: resolves names, null for none', () => {
  assert.equal(iccProfileBytes('none'), null);
  assert.equal(iccProfileBytes(null), null);
  assert.ok(iccProfileBytes('srgb') instanceof Uint8Array);
  // Unknown but truthy → safe sRGB fallback (canvas output really is sRGB).
  assert.equal(iccProfileBytes('rec2020'), iccProfileBytes('srgb'));
  assert.equal(COLOR_PROFILES.srgb.space, 'RGB');
});

test('rgbToCmyk: corners and a primary', () => {
  assert.deepEqual(rgbToCmyk(1, 1, 1), [0, 0, 0, 0]);   // white → no ink
  assert.deepEqual(rgbToCmyk(0, 0, 0), [0, 0, 0, 1]);   // black → full K
  assert.deepEqual(rgbToCmyk(1, 0, 0), [0, 1, 1, 0]);   // red → magenta + yellow
  assert.deepEqual(rgbToCmyk(0, 0, 1), [1, 1, 0, 0]);   // blue → cyan + magenta
});

test('cmykCondition: default, named, and unknown fallback', () => {
  assert.equal(cmykCondition().identifier, CMYK_CONDITIONS[DEFAULT_CMYK_CONDITION].identifier);
  assert.equal(cmykCondition('swop').identifier, 'CGATS TR 001');
  assert.equal(cmykCondition('nope').identifier, CMYK_CONDITIONS.fogra39.identifier);
});
