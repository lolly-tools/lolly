// SPDX-License-Identifier: MPL-2.0
// Run with node --import ./tests/css-stub.mjs --test <this file>.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenPreviewHtml, tokenTypeLabel, tokenValueText, TOKEN_TYPE_LABELS } from './token-preview.ts';

test('each type draws its own preview', () => {
  assert.match(tokenPreviewHtml('color', '#033633'), /class="tk-chip" style="--sw:#033633"/);
  assert.match(tokenPreviewHtml('color', 'oklch(70% .1 150)'), /--sw:#[0-9a-f]{6}"/);
  assert.match(tokenPreviewHtml('color', '#00000040'), /--sw:#00000040/, 'alpha is kept');
  assert.match(tokenPreviewHtml('shadow', { offsetX: '0px', offsetY: '2px', blur: '8px', spread: '0px', color: '#00000040' }), /box-shadow:0px 2px 8px 0px #00000040/);
  assert.match(tokenPreviewHtml('fontFamily', ['SUSE', 'sans-serif']), /class="tk-face-aa" style="font-family:&#39;SUSE&#39;/);
  assert.match(tokenPreviewHtml('dimension', '16px'), /class="tk-bar" style="--len:16px"/);
  assert.match(tokenPreviewHtml('dimension', { value: 4, unit: 'px' }), /--len:4px/);
  assert.match(tokenPreviewHtml('dimension', '2px', { path: 'stroke.hairline' }), /tk-bar tk-bar--stroke/);
  assert.match(tokenPreviewHtml('number', 0.5, { path: 'opacity.half' }), /tk-chip--opacity" style="--op:0.5"/);
  assert.match(tokenPreviewHtml('number', 45, { path: 'rotation.tilt' }), /class="tk-turn" style="--turn:45deg"/);
  assert.equal(tokenPreviewHtml('number', 3, { path: 'number.columns' }), '', 'a plain number has nothing to draw');
  assert.match(tokenPreviewHtml('cubicBezier', [0.2, 0, 0, 1]), /<svg class="tk-ease"[^>]*><path d="M0 24 C8 24, 0 0, 40 0"/);
  assert.match(tokenPreviewHtml('gradient', null, { css: 'linear-gradient(90deg in oklch, #ff0000 0%, #0000ff 100%)' }), /tk-chip--wide" style="background:linear-gradient/);
});

test('unknown types and unusable values draw nothing', () => {
  assert.equal(tokenPreviewHtml('asset', 'lolly/logo/primary'), '');
  assert.equal(tokenPreviewHtml(undefined, '#fff'), '');
  assert.equal(tokenPreviewHtml('color', 'SUSE'), '', 'a bare word is not a colour');
  assert.equal(tokenPreviewHtml('dimension', '1.5re'), '');
  assert.equal(tokenPreviewHtml('cubicBezier', [0, 0, 1]), '');
  assert.equal(tokenPreviewHtml('gradient', null, { css: 'url(x)' }), '');
});

test('an unsafe shadow string yields no chip', () => {
  assert.equal(tokenPreviewHtml('shadow', '0 0 0 red; position: fixed'), '');
  assert.equal(tokenPreviewHtml('shadow', { offsetX: '0px; position:fixed', offsetY: '0px', blur: '0px', spread: '0px', color: '#000000' }), '');
  assert.equal(tokenPreviewHtml('shadow', { offsetX: '0px', offsetY: '0px', blur: '0px', spread: '0px', color: 'red' }), '');
});

test('a hostile value is escaped or refused, never written raw', () => {
  const hostile = '"><img src=x onerror=alert(1)>';
  for (const type of ['color', 'shadow', 'fontFamily', 'dimension', 'number', 'cubicBezier', 'gradient', 'asset']) {
    const html = tokenPreviewHtml(type, hostile, { css: hostile, path: hostile });
    assert.doesNotMatch(html, /<img/, type);
    assert.doesNotMatch(html, /onerror=alert/, type);
  }
  assert.equal(tokenPreviewHtml('fontFamily', 'Evil"; background:url(x)'), '', 'a family that is not a plain name draws nothing');
});

test('values read as text, types read as words', () => {
  assert.equal(tokenValueText('color', '#033633'), '#033633');
  assert.equal(tokenValueText('fontFamily', ['SUSE', 'sans-serif']), 'SUSE, sans-serif');
  assert.equal(tokenValueText('shadow', { offsetX: '0px', offsetY: '2px', blur: '8px', spread: '0px', color: '#00000040' }), '0px 2px 8px 0px #00000040');
  assert.equal(tokenValueText('dimension', { value: 4, unit: 'px' }), '4px');
  assert.equal(tokenValueText('number', 3), '3');
  assert.equal(tokenValueText('cubicBezier', [0.2, 0, 0, 1]), '[0.2,0,0,1]');
  assert.equal(tokenTypeLabel('color'), 'Colour');
  assert.equal(tokenTypeLabel('dimension'), 'Size');
  assert.equal(tokenTypeLabel('fontFamily'), 'Font family');
  assert.equal(tokenTypeLabel('somethingNew'), 'somethingNew');
  assert.equal(tokenTypeLabel(undefined), 'Unknown type');
  for (const [type, label] of Object.entries(TOKEN_TYPE_LABELS)) assert.equal(tokenTypeLabel(type), label, type);
});
