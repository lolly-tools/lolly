// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { TextAPI, TextToPathOpts } from '@lolly-tools/core/host-v1';
import { releaseTextAPI } from '../src/release-fonts.ts';
import { sha256Hex } from '../../../engine/src/bytes.ts';
import { pinnedFontAliases } from '../../../engine/src/token-font-pins.ts';

test('release font lookup uses verified bytes and passes weight-specific fallback faces to shaping', async () => {
  const raw = new Uint8Array(await readFile(new URL('../../../shells/web/public/fonts/SUSE[wght].woff2', import.meta.url)));
  const sha256 = await sha256Hex(raw);
  const pins = ['latin', 'extended'].map(id => ({ id, version: '1', sha256, font: { family: 'Pinned Sans', weight: '100 900', style: 'normal' } }));
  const shaped: TextToPathOpts[] = [];
  let ordinaryReads = 0;
  const base: TextAPI = { preload: async () => {}, fontUrl: async () => { ordinaryReads++; return null; }, toPath: async opts => { shaped.push(opts); return { d: '', advanceWidth: 0, bbox: null, notdef: 0 }; } };
  const text = await releaseTextAPI(base, pins, async () => raw);
  const alias = (await pinnedFontAliases(pins)).get('pinned sans')!;
  const heavy = await text.fontUrl!(alias, { weight: 700 });
  assert.match(heavy!.url, /^data:font\/ttf;base64,/);
  assert.deepEqual(heavy!.variations, ['wght=700']);
  await text.fontUrl!(alias, { weight: 400 });
  await text.toPath({ text: 'Łódź', fontUrl: heavy!.url, variations: heavy!.variations, fontSize: 18 });
  assert.deepEqual(shaped[0]!.fallbackFonts?.[0]?.variations, ['wght=700']);
  assert.equal(ordinaryReads, 0);
  await assert.rejects(() => text.fontUrl!(alias, { italic: true }), /no requested slant/);
  await assert.rejects(() => releaseTextAPI(base, pins, async () => new Uint8Array([1, 2])), /bytes changed/);
});
