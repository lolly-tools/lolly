// SPDX-License-Identifier: MPL-2.0
/**
 * lib/penpot-brand.ts at its seam: the brand a `.penpot` archive carries is read
 * through a tokens surface (raw document + resolved swatches), so a stub surface
 * proves the font roles become typographies and the `sans` / `mono` families the
 * Design tool's keys stand for, that swatches become library colours, and that a
 * shell with no tokens yields an empty brand rather than a failure.
 *
 * Run with: node --test shells/web/src/lib/penpot-brand.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brandFromTokens, googleFamiliesFrom } from './penpot-brand.ts';

const DOC = {
  $metadata: { tokenSetOrder: ['base'] },
  $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled' } }],
  base: {
    font: { $type: 'fontFamily', brand: { $value: 'SUSE' }, mono: { $value: ['SUSE Mono', 'monospace'] }, display: { $value: '{font.brand}' } },
    color: { $type: 'color', primary: { $value: '#30ba78' } },
  },
};
const SWATCHES = [
  { path: 'color.primary', name: 'Jungle', group: 'Brand', value: '#30ba78', description: null },
  { path: 'color.odd', name: 'Odd', group: null, value: 'rgb(1,2,3)', description: null },
];

test('font roles become the sans/mono families and typographies; an alias role is skipped', async () => {
  const brand = await brandFromTokens({ raw: async () => DOC, colors: async () => SWATCHES });
  assert.equal(brand.tokens, DOC);
  assert.deepEqual(brand.fonts, { sans: 'SUSE', mono: 'SUSE Mono' });
  assert.deepEqual(brand.typographies.map((t) => [t.name, t.fontFamily, t.fontWeight]), [['Brand', 'SUSE', 400], ['Mono', 'SUSE Mono', 400]]);
});

test('swatches become library colours; a non-hex value is left out', async () => {
  const brand = await brandFromTokens({ raw: async () => DOC, colors: async () => SWATCHES });
  assert.deepEqual(brand.palette, [{ name: 'Jungle', path: 'Brand', color: '#30ba78' }]);
});

test('no surface, or a surface that throws, yields an empty brand', async () => {
  assert.deepEqual(await brandFromTokens(null), { tokens: null, palette: [], typographies: [], fonts: {}, googleFamilies: [] });
  const brand = await brandFromTokens({ raw: async () => { throw new Error('locked'); }, colors: async () => { throw new Error('locked'); } });
  assert.equal(brand.tokens, null);
  assert.deepEqual(brand.palette, []);
  assert.deepEqual(brand.fonts, {});
});

test('the render snapshot is preferred: tokens come from the version document, the theme selection is carried (plans/222)', async () => {
  const RENDER_DOC = { ...DOC, $metadata: { tokenSetOrder: ['base'], activeThemes: ['dark'], activeSets: ['base'] } };
  const surface = {
    raw: async () => ({ marker: 'EDIT HEAD - must not be used when a snapshot exists' }),
    snapshot: async () => ({ document: RENDER_DOC, system: null, version: 'v2', selection: { activeThemes: ['dark'], activeSets: ['base'] } }),
    colors: async () => SWATCHES,
  };
  const brand = await brandFromTokens(surface);
  assert.equal(brand.tokens, RENDER_DOC, 'the render document is used, not the edit head');
  assert.deepEqual(brand.themeSelection, { activeThemes: ['dark'], activeSets: ['base'] });
  // The fonts/palette still resolve off the same (render) document.
  assert.deepEqual(brand.fonts, { sans: 'SUSE', mono: 'SUSE Mono' });
});

test('a host without snapshot falls back to the raw() head, and carries no theme selection', async () => {
  const brand = await brandFromTokens({ raw: async () => DOC, colors: async () => SWATCHES });
  assert.equal(brand.tokens, DOC);
  assert.equal(brand.themeSelection, undefined);
});

test('Google-sourced user font families are listed for gfont- ids; uploads and a missing surface are not', async () => {
  const assets = { list: async () => [
    { meta: { source: 'google-fonts', family: 'Work Sans' } },
    { meta: { source: 'google-fonts', family: 'Work Sans' } },
    { meta: { source: 'upload', family: 'SUSE' } },
    { meta: null },
  ] };
  assert.deepEqual(await googleFamiliesFrom(assets), ['Work Sans']);
  assert.deepEqual(await googleFamiliesFrom(null), []);
  const brand = await brandFromTokens({ raw: async () => DOC, colors: async () => SWATCHES }, assets);
  assert.deepEqual(brand.googleFamilies, ['Work Sans']);
});
