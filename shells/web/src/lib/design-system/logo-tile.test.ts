// SPDX-License-Identifier: MPL-2.0
/**
 * logo-tile.ts - a Logos room tile takes its lockup's shape, and an empty slot
 * is a drop area that says which logo goes there and shows no stand-in mark.
 * Run directly:  node --test shells/web/src/lib/design-system/logo-tile.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LOGO_VARIANTS, type LogoSlot } from '../brand-logos.ts';
import { MAGPIE_SLOT, emptySlotPrompt, logoTileHtml, logoTileShape } from './logo-tile.ts';

const slot = (variant: string, extra: Partial<LogoSlot> = {}): LogoSlot => ({
  variant, identity: 'default', label: 'Horizontal · Primary', assetId: `user/logo/${variant}`,
  url: 'blob:mark', format: 'svg', bytes: 10, custom: false, ...extra,
});

test('a horizontal lockup takes a wide tile and a vertical one a square tile', () => {
  for (const v of LOGO_VARIANTS) {
    assert.equal(logoTileShape(v), v.startsWith('horizontal-') ? 'wide' : 'square', v);
  }
});

test('a custom mark named for an orientation follows it, and any other mark is square', () => {
  assert.equal(logoTileShape('horizontal-on-brand'), 'wide', 'Lolly Demo\'s on-brand wordmark');
  assert.equal(logoTileShape('vertical-event'), 'square');
  assert.equal(logoTileShape('icon'), 'square');
  assert.equal(logoTileShape('crest'), 'square');
});

test('the tile carries its shape, so the stylesheet sizes it at the lockup\'s aspect', () => {
  assert.match(logoTileHtml('horizontal-mono', 'default', undefined), /data-shape="wide"/);
  assert.match(logoTileHtml('vertical-mono', 'default', slot('vertical-mono')), /data-shape="square"/);
});

test('an empty slot is a drop area that names its logo and draws no mark', () => {
  const html = logoTileHtml('horizontal-primary', 'default', undefined);
  assert.doesNotMatch(html, /<img/, 'nothing stands in for the person\'s mark');
  assert.doesNotMatch(html, /is-filled/);
  assert.match(html, /data-file-drop/, 'the tile takes a dropped file');
  assert.match(html, /Drop a horizontal logo/);
  assert.match(html, /data-drop-label="Drop to add"/);
  assert.equal(emptySlotPrompt('vertical-primary'), 'Drop a vertical logo');
  assert.equal(emptySlotPrompt('vertical-primary-reverse'), 'Drop to add', 'the other forms do not repeat the sentence');
});

test('one magpie per view: the room\'s drop zone carries it, no tile does, and it is empty and hidden from AT', () => {
  for (const v of LOGO_VARIANTS) assert.ok(!logoTileHtml(v, 'default', undefined).includes('fauna-slot'), v);
  const markup = readFileSync(new URL('../brand-editor/derive.ts', import.meta.url), 'utf8');
  assert.match(markup, /be-logo-intake-glyph[^\n]*\$\{MAGPIE_SLOT\}/);
  assert.match(MAGPIE_SLOT, /^<span class="fauna-slot" data-fauna="magpie" data-fauna-watch="\.be-logo-intake-drop" aria-hidden="true"><\/span>$/);
});

test('a filled slot shows the mark, solid, with a way to remove it unless it shipped', () => {
  const own = logoTileHtml('horizontal-primary', 'default', slot('horizontal-primary'));
  assert.match(own, /is-filled/);
  assert.match(own, /<img src="blob:mark"/);
  assert.match(own, /data-logo-del="horizontal-primary"/);
  const shipped = logoTileHtml('horizontal-primary', 'default', slot('horizontal-primary', { shipped: true }));
  assert.doesNotMatch(shipped, /data-logo-del/);
});

test('names and urls are escaped into the markup', () => {
  const html = logoTileHtml('icon', 'default', slot('icon', { label: '<b>x</b>', url: '"><script>' }), { label: '<b>x</b>' });
  assert.doesNotMatch(html, /<b>x<\/b>|<script>/);
});

test('the stylesheet sets each shape\'s aspect, clear space and contain, never a crop', () => {
  const css = readFileSync(new URL('../../styles/parts/brand-studio.css', import.meta.url), 'utf8');
  assert.match(css, /\.be-logo-slot\[data-shape="wide"\]\s*\{\s*--logo-ratio:\s*2;/);
  assert.match(css, /\.be-logo-drop\s*\{[^}]*aspect-ratio:\s*var\(--logo-ratio\)/);
  assert.match(css, /\.be-logo-drop\s*\{[^}]*container-type:\s*size/);
  assert.match(css, /\.be-logo-art\s*\{[^}]*padding:\s*calc\(100cqh \/ 6\)/, 'a quarter of the mark\'s height on every side');
  assert.match(css, /\.be-logo-art img\s*\{[^}]*object-fit:\s*contain/);
  // An empty slot is a drop target, so its border is dashed; a filled one is solid.
  assert.match(css, /\.be-logo-drop\s*\{[^}]*border:\s*1\.5px dashed/);
  assert.match(css, /\.be-logo-slot\.is-filled \.be-logo-drop\s*\{\s*border-style:\s*solid;/);
});

test('a matrix tile is named for its treatment, and assistive names keep the full slot', () => {
  const html = logoTileHtml('vertical-mono-reverse', 'default', slot('vertical-mono-reverse', { label: 'Vertical · Mono reverse' }));
  assert.match(html, /<span class="be-logo-slot-name">Mono reverse<\/span>/);
  assert.match(html, /aria-label="Remove the Vertical · Mono reverse mark"/);
  assert.match(logoTileHtml('vertical-mono', 'default', undefined), /<span class="be-logo-slot-name">Mono<\/span>/);
  assert.match(logoTileHtml('icon', 'default', slot('icon', { label: 'Icon', custom: true })), /<span class="be-logo-slot-name">Icon<\/span>/);
});
