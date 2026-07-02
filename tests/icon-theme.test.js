// SPDX-License-Identifier: MPL-2.0
// Themable two-colour icon contract: id round-trips and theme baking.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseThemedAssetId, buildThemedAssetId, isThemableIconSvg,
  applyIconTheme, restyleIconTheme,
} from '../engine/src/icon-theme.js';

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
  assert.ok(baked.includes('fill="#2453ff"'));
  assert.ok(baked.includes('fill="#192072"'));
  assert.ok(!baked.includes('<style>'));
  assert.ok(!baked.includes('class="c1"'));
  assert.ok(!baked.includes('class="c2"'));
  // Geometry untouched.
  assert.ok(baked.includes('d="M0 0h10v10H0z"'));
});

test('applyIconTheme returns null for non-themable SVGs and unsafe colours', () => {
  assert.equal(applyIconTheme('<svg><path fill="#000" d="M0 0"/></svg>', { c1: '#fff', c2: '#000' }), null);
  assert.equal(applyIconTheme(ICON, { c1: '"/><script>', c2: '#000' }), null);
  assert.equal(applyIconTheme(ICON, { c1: '#fff' }), null);
});

test('restyleIconTheme swaps default fills but keeps the class contract', () => {
  const restyled = restyleIconTheme(ICON, { c1: '#ffffff', c2: '#efefef' });
  assert.ok(restyled.includes('.c1{fill:#ffffff}.c2{fill:#efefef}'));
  assert.ok(restyled.includes('class="c1"'));
  assert.ok(isThemableIconSvg(restyled));
});

test('isThemableIconSvg detects the contract', () => {
  assert.equal(isThemableIconSvg(ICON), true);
  assert.equal(isThemableIconSvg('<svg/>'), false);
});
