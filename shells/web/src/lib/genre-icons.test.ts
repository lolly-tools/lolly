// SPDX-License-Identifier: MPL-2.0
/**
 * The genre picker's genres (lib/genre-icons.ts): every genre the generator plays has an
 * icon and a title, the titles drop the station's family ("Ska", not "Lolly Sings · Ska"),
 * and the two groups list every genre once.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/genre-icons.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENRE_GROUPS, GENRE_ICON, genreIconSvg, genreTitle, shuffleIconSvg } from './genre-icons.ts';
import { LOFI_STATION_MOODS, lofiStationName } from './neurospicy-lofi.ts';

test('every genre has an icon with shapes in it, and a title', () => {
  for (const mood of LOFI_STATION_MOODS) {
    assert.ok(GENRE_ICON[mood], `${mood} has an icon`);
    const svg = genreIconSvg(mood, 24);
    assert.match(svg, /^<svg [^>]*viewBox="0 0 24 24"[^>]*>.*<(path|circle|ellipse|line|polyline|polygon|rect)\b.*<\/svg>$/s, `${mood}: ${svg.slice(0, 80)}`);
    const title = genreTitle(mood);
    assert.ok(title.length > 0, `${mood} has a title`);
    assert.ok(!title.includes('·'), `${mood}: "${title}" carries no station family`);
  }
  assert.equal(genreTitle('ska'), 'Ska');
  assert.equal(genreTitle('lateNight'), 'Late night');
  assert.equal(genreTitle('sings'), 'Lolly Sings');
  assert.equal(lofiStationName('ska'), 'Lolly Sings · Ska', 'station names elsewhere keep their family');
});

test('the groups list every genre once, Lolly Sings first', () => {
  const listed = GENRE_GROUPS.flatMap(g => g.moods);
  assert.deepEqual([...listed].sort(), [...LOFI_STATION_MOODS].sort());
  assert.equal(new Set(listed).size, listed.length);
  assert.deepEqual(GENRE_GROUPS.map(g => g.title), ['Lolly Sings', 'Lofi']);
  assert.deepEqual(GENRE_GROUPS[1]!.moods, ['warm', 'lateNight', 'rainy']);
});

test('genres next to each other in the grid do not share an icon', () => {
  const key = (m: string): string => JSON.stringify(GENRE_ICON[m as keyof typeof GENRE_ICON]);
  for (const g of GENRE_GROUPS) for (let i = 1; i < g.moods.length; i++) assert.notEqual(key(g.moods[i]!), key(g.moods[i - 1]!), `${g.moods[i - 1]} and ${g.moods[i]}`);
});

test('the shuffle icon is the crossing arrows', () => {
  assert.match(shuffleIconSvg(26), /width="26"/);
  assert.equal((shuffleIconSvg(26).match(/<path /g) ?? []).length, 5);
});
