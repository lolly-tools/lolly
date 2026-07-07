// SPDX-License-Identifier: MPL-2.0
// Themable two-colour icon contract: id round-trips and theme baking.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseThemedAssetId, buildThemedAssetId, isThemableIconSvg,
  applyIconTheme, restyleIconTheme,
} from '../engine/src/icon-theme.ts';

const ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">' +
  '<defs><style>.c1{fill:#30ba78}.c2{fill:#0c322c}</style></defs>' +
  '<path class="c2" d="M0 0h10v10H0z"/><rect class="c1" x="1" y="1" width="2" height="2"/></svg>';

test('parseThemedAssetId splits a themed id and passes plain ids through', () => {
  assert.deepEqual(parseThemedAssetId('suse/icons/ai?theme=ocean'), { baseId: 'suse/icons/ai', theme: 'ocean' });
  assert.deepEqual(parseThemedAssetId('suse/icons/ai'), { baseId: 'suse/icons/ai', theme: null });
});

test('parseThemedAssetId never mistakes a tool embed URL for a themed id', () => {
  const url = 'https://lolly.tools/tool/qr-code.svg?theme=ocean';
  assert.deepEqual(parseThemedAssetId(url), { baseId: url, theme: null });
});

test('buildThemedAssetId round-trips with parse and rejects junk theme ids', () => {
  const id = buildThemedAssetId('suse/icons/ai', 'ocean');
  assert.equal(id, 'suse/icons/ai?theme=ocean');
  assert.deepEqual(parseThemedAssetId(id), { baseId: 'suse/icons/ai', theme: 'ocean' });
  assert.equal(buildThemedAssetId('suse/icons/ai', null), 'suse/icons/ai');
  assert.throws(() => buildThemedAssetId('suse/icons/ai', 'Not Valid!'));
});

test('applyIconTheme bakes fills as attributes and strips the style block', () => {
  const baked = applyIconTheme(ICON, { c1: '#2453ff', c2: '#192072' });
  assert.ok(baked!.includes('fill="#2453ff"'));
  assert.ok(baked!.includes('fill="#192072"'));
  assert.ok(!baked!.includes('<style>'));
  assert.ok(!baked!.includes('class="c1"'));
  assert.ok(!baked!.includes('class="c2"'));
  // Geometry untouched.
  assert.ok(baked!.includes('d="M0 0h10v10H0z"'));
});

test('applyIconTheme rejects unsafe or incomplete theme colours, and non-SVG input', () => {
  assert.equal(applyIconTheme(ICON, { c1: '"/><script>', c2: '#000' }), null);
  assert.equal(applyIconTheme(ICON, { c1: '#fff' }), null);
  assert.equal(applyIconTheme('not an svg at all', { c1: '#fff', c2: '#000' }), null);
});

test('applyIconTheme monochromatically remaps a non-icon (multi-colour) SVG', () => {
  // No .c1/.c2 contract → theme the whole thing to one hue, keeping each fill's lightness.
  const out = applyIconTheme(
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#204080" d="M0 0"/><rect fill="#ffffff"/></svg>',
    { c1: '#ff0000', c2: '#000000' }, // accent = pure red
  );
  assert.ok(out, 'a multi-colour SVG is recoloured, not dropped');
  assert.ok(out!.includes('<svg'), 'still an SVG');
  assert.ok(!out!.includes('#204080'), 'the original blue is remapped away');
  // A pure-white fill has lightness 1, so it survives as white regardless of hue.
  assert.ok(out!.includes('#ffffff'), 'highlights stay light');
  // The mid-tone fill takes the red hue (R channel dominant).
  const red = [...out!.matchAll(/#([0-9a-fA-F]{6})/g)]
    .map(m => m[1])
    .filter((h): h is string => h !== undefined)
    .find(h => parseInt(h.slice(0, 2), 16) > parseInt(h.slice(2, 4), 16) && parseInt(h.slice(0, 2), 16) > parseInt(h.slice(4, 6), 16));
  assert.ok(red, 'a red-dominant shade appears');
});

test('restyleIconTheme swaps default fills but keeps the class contract', () => {
  const restyled = restyleIconTheme(ICON, { c1: '#ffffff', c2: '#efefef' });
  assert.ok(restyled!.includes('.c1{fill:#ffffff}.c2{fill:#efefef}'));
  assert.ok(restyled!.includes('class="c1"'));
  assert.ok(isThemableIconSvg(restyled!));
});

test('isThemableIconSvg detects the contract', () => {
  assert.equal(isThemableIconSvg(ICON), true);
  assert.equal(isThemableIconSvg('<svg/>'), false);
});
