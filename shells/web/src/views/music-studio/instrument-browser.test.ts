// SPDX-License-Identifier: MPL-2.0
/**
 * The instrument browser's previews (views/music-studio/instrument-browser.ts): a card
 * plays this tune's own part with the instrument set in the chosen kind of section only,
 * the composer's card takes the person's choices for that part away, a kit card plays the
 * drums even when they are off, and the part previewed is heard over the others.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/instrument-browser.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewMix, previewState, sectionsFor, instrumentName, instrumentWord } from './instrument-browser.ts';
import { composeTrack, parseMusicState } from '../../lib/music-state.ts';
import { instrumentsOf } from '../../lib/music-prefs.ts';

test('a card previews its instrument in the chosen kind of section, and the track stays as it is', () => {
  const state = parseMusicState('style=ska&seed=4&bars=64&lead=clarinet');
  const s = previewState(state, 'lead', 'flute', 'drop');
  assert.equal(s.sections.drop?.lead, 'flute');
  assert.equal(s.lead, 'clarinet', 'the rest of the track keeps its lead');
  assert.equal(state.sections.drop, undefined, 'the generator\'s own state is not changed');
  const bars = composeTrack(s);
  assert.ok(bars.filter(b => b.section === 'drop').every(b => b.voices?.lead === 'flute'));
});

test('the browser has no card for the retired soft lead, and a preview that asks for the soft lead plays the flute', () => {
  assert.ok(!instrumentsOf('lead').includes('soft'), 'the cards are instrumentsOf, which leaves it out');
  const s = previewState(parseMusicState('style=citypop&seed=4&bars=64'), 'lead', 'soft', 'drop');
  assert.equal(s.sections.drop?.lead, 'flute');
  assert.ok(composeTrack(s).filter(b => b.section === 'drop').every(b => b.voices?.lead === 'flute'));
});

test('the composer\'s card takes away the person\'s choices for that part', () => {
  const state = parseMusicState('style=ska&seed=4&bars=64&lead=clarinet&drop.lead=sax&drop.keys=organ');
  const s = previewState(state, 'lead', '', 'drop');
  assert.equal(s.lead, undefined);
  assert.deepEqual(s.sections.drop, { keys: 'organ' }, 'other parts keep their choices');
});

test('a kit card plays the drums with that kit, even when the track has them off', () => {
  const s = previewState(parseMusicState('style=ska&seed=4&drums=0'), 'drums', 'jazz', 'verse');
  assert.equal(s.kit, 'jazz');
  assert.equal(s.drums, true);
  assert.equal(previewState(s, 'drums', '', 'verse').kit, undefined, 'the style\'s own kit');
});

test('the part previewed is heard over the rest, and the effects stay out', () => {
  const m = previewMix({ keys: 1, bass: 1.2, lead: 0.2, drums: 1, fx: 1, reverb: 0.9, texture: 1 }, 'lead');
  assert.equal(m.lead, 1, 'a part turned down in the mix still sounds in its preview');
  assert.ok(m.keys < 0.5 && m.bass < 0.5 && m.drums < 0.5);
  assert.equal(m.fx, 0);
  assert.equal(m.reverb, 0.9);
});

test('the sections offered are the ones the part plays in, in order', () => {
  const bars = composeTrack(parseMusicState('style=ska&seed=4&bars=64'));
  const lead = sectionsFor(bars, 'lead');
  assert.ok(lead.length > 0 && !lead.includes('rest'));
  for (const sec of lead) assert.ok(bars.some(b => b.section === sec && b.notes.some(n => n.voice === 'lead')), sec);
  assert.ok(sectionsFor(bars, 'drums').length >= lead.length - 1);
});

test('names read as a card shows them and as a sentence carries them', () => {
  assert.equal(instrumentName('keys', 'felt'), 'Felt piano');
  assert.equal(instrumentWord('keys', 'felt'), 'felt piano');
  assert.equal(instrumentName('keys', 'electric'), 'Electric guitar');
  assert.equal(instrumentName('drums', 'jazz'), 'Jazz kit');
});
