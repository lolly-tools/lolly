// SPDX-License-Identifier: MPL-2.0
/**
 * The genre picker's tile colours (views/music-studio/genre-colours.ts): every genre gets
 * a wash of the brand's colours that keeps the title at 4.5:1 in light and dark, the same
 * wash every time, a different colour from the tile beside it, and no hue the brand does
 * not own.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/genre-colours.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio, hexToOklch } from '../../../../../engine/src/brand-derive.ts';
import { GENRE_GROUPS } from '../../lib/genre-icons.ts';
import { TITLE_CONTRAST, cssHex, genreTiles } from './genre-colours.ts';

const LIGHT = { surface: '#ffffff', text: '#1a1d21' };
const DARK = { surface: '#1c2026', text: '#f1f3f5' };
/** A wide brand: several leads and supporting colours, light and deep. */
const WIDE = ['#50c369', '#033633', '#f2b134', '#e5577e', '#4f7cf0', '#8a5cd6'];
/** A narrow brand: one colour. */
const ONE = ['#30ba78'];
/** Colours at the ends of lightness, the hardest on the title. */
const HARD = ['#0b0b0b', '#fafafa', '#ffe600'];

const lab = (hex: string): [number, number, number] => {
  const o = hexToOklch(hex)!;
  const r = (o.h * Math.PI) / 180;
  return [o.l, o.c * Math.cos(r), o.c * Math.sin(r)];
};
const distance = (a: string, b: string): number => {
  const [x, y] = [lab(a), lab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

test('every genre gets a wash, and both stops keep the title at 4.5:1, in light and dark, for any brand', () => {
  const moods = GENRE_GROUPS.flatMap((g) => g.moods);
  for (const theme of [LIGHT, DARK]) {
    for (const pool of [WIDE, ONE, HARD]) {
      const tiles = genreTiles(pool, theme.surface, theme.text);
      assert.equal(tiles.size, moods.length, 'one wash per genre');
      for (const [mood, tile] of tiles) {
        for (const stop of [tile.from, tile.to]) {
          assert.ok(contrastRatio(stop, theme.text) >= TITLE_CONTRAST, `${mood} ${stop} on ${theme.surface}: ${contrastRatio(stop, theme.text).toFixed(2)}`);
        }
      }
    }
  }
});

test('a genre keeps its wash, and an empty pool leaves the cards plain', () => {
  assert.deepEqual([...genreTiles(WIDE, LIGHT.surface, LIGHT.text)], [...genreTiles(WIDE, LIGHT.surface, LIGHT.text)]);
  assert.equal(genreTiles([], LIGHT.surface, LIGHT.text).size, 0);
});

test('tiles side by side differ, and each category starts on a different colour', () => {
  for (const theme of [LIGHT, DARK]) {
    const tiles = genreTiles(WIDE, theme.surface, theme.text);
    for (const g of GENRE_GROUPS) {
      g.moods.slice(1).forEach((mood, i) => {
        const [a, b] = [tiles.get(g.moods[i]!)!, tiles.get(mood)!];
        assert.ok(distance(a.from, b.from) >= 0.05, `${g.moods[i]} and ${mood} read apart (${distance(a.from, b.from).toFixed(3)})`);
      });
    }
    const firsts = GENRE_GROUPS.map((g) => tiles.get(g.moods[0]!)!.from);
    assert.equal(new Set(firsts).size, firsts.length, 'four categories, four opening colours');
  }
});

test('a one-colour brand varies by strength and direction, never by a hue of its own', () => {
  const brandHue = hexToOklch(ONE[0]!)!.h;
  for (const theme of [LIGHT, DARK]) {
    const tiles = genreTiles(ONE, theme.surface, theme.text);
    for (const tile of tiles.values()) {
      for (const stop of [tile.from, tile.to]) {
        const o = hexToOklch(stop)!;
        if (o.c < 0.02) continue;
        const off = Math.abs(((o.h - brandHue) % 360 + 540) % 360 - 180);
        assert.ok(off < 12, `${stop} stays on the brand's hue (${off.toFixed(1)} degrees off)`);
      }
    }
    for (const g of GENRE_GROUPS) {
      g.moods.slice(1).forEach((mood, i) => {
        const [a, b] = [tiles.get(g.moods[i]!)!, tiles.get(mood)!];
        assert.ok(a.from !== b.from || a.angle !== b.angle, `${g.moods[i]} and ${mood} still differ`);
      });
    }
  }
});

test('a computed colour reads as hex only when it is opaque enough to judge contrast on', () => {
  assert.equal(cssHex('rgb(255, 255, 255)'), '#ffffff');
  assert.equal(cssHex('rgb(28 32 38)'), '#1c2026');
  assert.equal(cssHex('rgba(255, 255, 255, 0.5)'), null);
  assert.equal(cssHex('transparent'), null);
  assert.equal(cssHex(''), null);
});
