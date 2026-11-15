// SPDX-License-Identifier: MPL-2.0
/**
 * The music generator's track names and Auto labels (views/music-studio/track-names.ts):
 * the tracks are named for their part (Melody, Chords, Bass, Drums, Ear candy) while the
 * link keeps its ids, a control left to the composer reads "Auto · " and what plays, and
 * an instrument's name is capitalised at display time without changing the name tables.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/track-names.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { autoLabel, composedTag, laneHeadName, sentenceCase, styleKitName, trackName } from './track-names.ts';
import { LOFI_BASS_NAME, LOFI_KEYS_NAME, LOFI_LEAD_NAME } from '../../lib/lofi-names.ts';
import { musicStateParams, parseMusicState, composeTrack } from '../../lib/music-state.ts';

test('the tracks are named for the part they play', () => {
  assert.deepEqual((['lead', 'keys', 'bass', 'drums', 'fx'] as const).map(trackName), ['Melody', 'Chords', 'Bass', 'Drums', 'Ear candy']);
});

test('the names are labels only: a link keeps the ids lead, keys, bass and fx', () => {
  const s = parseMusicState('style=straya&seed=9&bars=32&lead=banjo&keys=steel&bass=didgeridoo&mix.fx=1.5&drop.lead=fiddle');
  const link = musicStateParams(s);
  assert.match(link, /(^|&)lead=banjo(&|$)/);
  assert.match(link, /(^|&)keys=steel(&|$)/);
  assert.match(link, /(^|&)bass=didgeridoo(&|$)/);
  assert.match(link, /(^|&)mix\.fx=1\.5(&|$)/);
  assert.match(link, /(^|&)drop\.lead=fiddle(&|$)/);
  assert.doesNotMatch(link, /melody|chords|candy/i);
});

test('an instrument shows in sentence case, and the name tables stay as a sentence carries them', () => {
  assert.equal(sentenceCase('banjo'), 'Banjo');
  assert.equal(sentenceCase('jazz guitar'), 'Jazz guitar');
  assert.equal(sentenceCase('Rhodes'), 'Rhodes');
  assert.equal(sentenceCase('808'), '808');
  assert.equal(sentenceCase(''), '');
  assert.equal(sentenceCase('istanbul', 'tr'), 'İstanbul', 'capitalised for the page\'s language');
  assert.equal(LOFI_KEYS_NAME.banjo, 'banjo', 'the tables are unchanged');
  assert.equal(LOFI_LEAD_NAME.fiddle, 'fiddle');
  assert.equal(LOFI_BASS_NAME.didgeridoo, 'didgeridoo');
});

test('a control left to the composer reads Auto and what plays', () => {
  assert.equal(autoLabel('yidaki'), 'Auto · Yidaki');
  assert.equal(autoLabel('jazz guitar'), 'Auto · Jazz guitar');
  assert.equal(autoLabel(''), 'Auto');
});

test('a lane head cut short keeps its whole name for the tooltip and the screen reader', () => {
  // One instrument across the tune: just the label, with nothing cut.
  assert.equal(laneHeadName('Auto · Synthwave lead', 'Synthwave lead', false), 'Auto · Synthwave lead');
  // Others in the lane: the label in full, then the lane's instruments across the tune.
  assert.equal(laneHeadName('Auto · Synthwave lead', 'Synthwave lead, Pad +1', true), 'Auto · Synthwave lead. In this tune: Synthwave lead, Pad +1');
  // Nothing to list (a part that plays nowhere): the label only.
  assert.equal(laneHeadName('Not playing', '', true), 'Not playing');
  // The view sets both from it, after the label, and the label truncates inside the button.
  const view = readFileSync(new URL('../music-studio.ts', import.meta.url), 'utf8');
  assert.match(view, /head\.title = whole; head\.setAttribute\('aria-label', tRaw\('\{track\}: \{names\}\. Browse and hear the instruments\.', \{ track: partName\(tr\), names: whole \}\)\)/);
  const css = readFileSync(new URL('../../styles/parts/music-studio.css', import.meta.url), 'utf8');
  assert.match(css, /\.ms-browse > \[data-short\] \{ display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; \}/);
});

test('the drums left to the genre name the genre\'s own kit', () => {
  assert.equal(styleKitName('jazz'), 'Jazz kit', 'a genre a named kit comes from takes that kit\'s name');
  assert.equal(styleKitName('rock'), 'Acoustic kit');
  assert.equal(styleKitName('straya'), 'Straya kit', 'any other genre, its own kit by its name');
});

test('the composer\'s own tag is read from the tune', () => {
  const own = composeTrack(parseMusicState('style=rock&seed=3&bars=64'));
  const sung = composeTrack(parseMusicState('style=rock&seed=3&bars=64&tag=sung'));
  const off = composeTrack(parseMusicState('style=rock&seed=3&bars=64&tag=off'));
  assert.equal(composedTag(sung), 'sung');
  assert.equal(composedTag(off), 'off', 'no tag at all');
  assert.ok(['off', 'spoken', 'shout', 'crowd', 'sung', 'whisper', 'high', 'deep', 'robot', 'stutter', 'echo'].includes(composedTag(own)));
});

test('the studio shows the new names and no "Style kit" or "As composed"', () => {
  const read = (f: string): string => readFileSync(new URL(f, import.meta.url), 'utf8');
  const studio = read('../music-studio.ts') + read('./instrument-browser.ts');
  assert.doesNotMatch(studio, /t\('Style kit'\)|t\('As composed'\)|Lolly tag: as composed|Let the composer choose/);
  assert.doesNotMatch(studio, /t\('Lead instruments'\)|t\('Keys instruments'\)|t\('Effects'\)/);
  for (const tr of ['lead', 'keys', 'bass', 'drums', 'fx']) assert.match(studio, new RegExp(`slider\\('${tr}', partName\\('${tr}'\\)`), `the ${tr} level slider takes the part's name`);
  assert.match(studio, /icon\('headphones'/, 'solo is headphones');
  assert.doesNotMatch(read('../music-studio.ts'), /data-solo[^\n]*icon\('star'/, 'the star is only ever a favourite');
});
