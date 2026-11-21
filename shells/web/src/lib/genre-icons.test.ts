// SPDX-License-Identifier: MPL-2.0
/**
 * The genre picker's genres (lib/genre-icons.ts): every genre the generator plays has an
 * icon and a title, the titles drop the station's family ("Ska", not "Lolly Sings · Ska"),
 * every genre is in exactly one of the six groups, and each group lists its genres A to Z.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/genre-icons.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GENRE_CATEGORIES, GENRE_CATEGORY, GENRE_GROUPS, GENRE_ICON, LOFI_CARD, LOFI_FAMILY, PICKER_GROUPS, cardTitle, genreCard, genreIconSvg, genreTitle, isLofiFlavour, shuffleIconSvg } from './genre-icons.ts';
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

test('every genre is in exactly one group, and the groups come in their order', () => {
  assert.deepEqual(GENRE_GROUPS.map(g => g.id), ['chill', 'rock', 'soul', 'club', 'bass', 'world']);
  assert.deepEqual([...GENRE_CATEGORIES], GENRE_GROUPS.map(g => g.id));
  // The seven newer flavours of Lofi have no page or card of their own: Lofi is one card,
  // and its chips reach them (LOFI_FAMILY).
  const newer = LOFI_FAMILY.filter(m => !['warm', 'lateNight', 'rainy'].includes(m));
  assert.equal(newer.length, 7);
  for (const mood of newer) assert.equal(GENRE_CATEGORY[mood], 'chill', `${mood} is a flavour of Lofi, with the calm styles`);
  const paged = LOFI_STATION_MOODS.filter(m => !newer.includes(m));
  for (const mood of paged) {
    const homes = GENRE_GROUPS.filter(g => g.moods.includes(mood)).map(g => g.id);
    assert.equal(homes.length, 1, `${mood} is in exactly one group, not ${JSON.stringify(homes)}`);
    assert.equal(GENRE_CATEGORY[mood], homes[0], `${mood}'s group reads the same both ways`);
  }
  const listed = GENRE_GROUPS.flatMap(g => g.moods);
  assert.equal(listed.length, 61, 'every genre with a page of its own');
  assert.deepEqual([...listed].sort(), [...paged].sort(), 'no group lists a genre the generator does not play');
  assert.deepEqual(Object.keys(GENRE_CATEGORY).sort(), [...LOFI_STATION_MOODS].sort());
  for (const lofi of ['warm', 'lateNight', 'rainy'] as const) assert.equal(GENRE_CATEGORY[lofi], 'chill', 'the Lofi stations are chill');
  assert.equal(GENRE_CATEGORY.ska, 'rock', 'ska is with rock and roots (Andy, 2026-11-14)');
  assert.deepEqual(GENRE_GROUPS.map(g => g.moods.length), [12, 9, 9, 9, 8, 14]);
  assert.equal(GENRE_CATEGORY.trailer, 'bass', 'trailer is with the bass-heavy and synth styles: its hits are a sub boom and a synth brass blast');
  assert.equal(GENRE_CATEGORY.noosa, 'chill', 'Noosacore is chill, beside botanica (Andy, 2026-11-14)');
  assert.equal(GENRE_CATEGORY.jungle, 'club', 'jungle is with breakbeat and D&B, the other break-driven club styles');
});

test('each group lists its genres A to Z by title', () => {
  for (const g of GENRE_GROUPS) {
    const titles = g.moods.map(genreTitle);
    assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), g.id);
  }
  assert.deepEqual(GENRE_GROUPS[0]!.moods.map(genreTitle), ['Balearic', 'Botanica', 'City pop', 'Dreamscape', 'Fantasy', 'Late night', 'Lofi house', 'Lolly Sings', 'Noosacore', 'Rainy', 'Trip hop', 'Warm']);
});

test('genres next to each other in the grid do not share an icon', () => {
  const key = (m: string): string => JSON.stringify(GENRE_ICON[m as keyof typeof GENRE_ICON]);
  for (const g of GENRE_GROUPS) for (let i = 1; i < g.moods.length; i++) assert.notEqual(key(g.moods[i]!), key(g.moods[i - 1]!), `${g.moods[i - 1]} and ${g.moods[i]}`);
});

test('the shuffle icon is the crossing arrows', () => {
  assert.match(shuffleIconSvg(26), /width="26"/);
  assert.equal((shuffleIconSvg(26).match(/<path /g) ?? []).length, 5);
});

test('Lofi is one card in the picker, whichever flavour plays', () => {
  const cards = PICKER_GROUPS.flatMap(g => g.moods);
  assert.equal(cards.length, 59, 'the paged genres, with Warm, Late night and Rainy as one card');
  assert.equal(cards.filter(isLofiFlavour).length, 1);
  assert.equal(cardTitle(LOFI_CARD), 'Lofi');
  for (const mood of LOFI_FAMILY) assert.equal(genreCard(mood), LOFI_CARD, `${mood} is on Lofi's card`);
  assert.equal(genreCard('lofiHouse'), 'lofiHouse', 'lofi house is a genre of its own');
  assert.equal(LOFI_FAMILY.length, 10);
  for (const g of PICKER_GROUPS) {
    const titles = g.moods.map(cardTitle);
    assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })), g.id);
  }
});
