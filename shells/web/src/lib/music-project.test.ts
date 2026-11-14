// SPDX-License-Identifier: MPL-2.0
/**
 * A music generator tune kept in Projects (lib/music-project.ts): the saved record brings
 * back every setting the studio has, through the same store round trip a saved session
 * takes, and Projects opens the record in the music generator, not in a tool.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/music-project.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOFI_SNARES, LOFI_HATS } from '../../../../engine/src/lofi-compose.ts';
import { parseMusicState, musicStateParams } from './music-state.ts';
import { MUSIC_SLOT_PREFIX, MUSIC_TOOL_ID, isMusicSlot, newMusicSlot, musicProjectHref, musicProjectRecord, musicProjectTitle, musicStateFromProject, musicSlotFromParams } from './music-project.ts';
import { sessionOpenHref, sessionRenderHref } from './search/projects-source.ts';

/** A tune with every setting away from its default: what a project has to keep. */
const EVERYTHING = [
  'style=funk', 'seed=4111860815', 'bars=48', 'bpm=128', 'transpose=3',
  'lead=riff', 'keys=wah', 'bass=slap', 'drums=0',
  'texture=0.6', 'bright=1.3', 'drive=2.4',
  'mix.lead=0.7', 'mix.keys=1.2', 'mix.bass=1.4', 'mix.drums=0.8', 'mix.fx=1.5', 'mix.reverb=0.5',
  'drop.lead=metal', 'build.keys=pad', `drop.snare=${LOFI_SNARES[1]}`, `verse.hats=${LOFI_HATS[1]}`,
  'kit=jazz', 'tag=whisper', 'quiet=console,sweeps',
].join('&');

test('a kept tune comes back with every setting, after the store\'s round trip', () => {
  const state = parseMusicState(EVERYTHING);
  // Not vacuous: every setting really is set away from its default.
  assert.equal(state.mood, 'funk');
  assert.equal(state.seed, 4111860815);
  assert.equal(state.bars, 48);
  assert.equal(state.bpm, 128);
  assert.equal(state.transpose, 3);
  assert.deepEqual([state.lead, state.keys, state.bass, state.drums], ['riff', 'wah', 'slap', false]);
  assert.deepEqual([state.texture, state.bright, state.drive], [0.6, 1.3, 2.4]);
  assert.deepEqual(state.mix, { lead: 0.7, keys: 1.2, bass: 1.4, drums: 0.8, fx: 1.5, reverb: 0.5, texture: state.mix.texture });
  assert.equal(state.sections.drop?.lead, 'metal');
  assert.equal(state.sections.drop?.snare, LOFI_SNARES[1]);
  assert.equal(state.sections.build?.keys, 'pad');
  assert.equal(state.sections.verse?.hats, LOFI_HATS[1]);
  assert.deepEqual([state.kit, state.tag, state.quiet], ['jazz', 'whisper', ['console', 'sweeps']]);

  const record = musicProjectRecord(state, 'Funk · seed 4111860815');
  // What the state store keeps is plain data: JSON in, JSON out.
  const stored: unknown = JSON.parse(JSON.stringify(record));
  const back = musicStateFromProject(stored);
  assert.ok(back, 'the record reads back as a tune');
  assert.deepEqual(back, state);
  assert.equal(musicStateParams(back), musicStateParams(state), 'and makes the same link');
  assert.equal((stored as { __label: string }).__label, 'Funk · seed 4111860815', 'Projects shows its name');
});

test('a record that is not a tune reads as nothing', () => {
  assert.equal(musicStateFromProject(null), null);
  assert.equal(musicStateFromProject({ __toolId: 'qr-code', url: 'x' }), null);
  assert.equal(musicStateFromProject({ __musicStudio: { params: 42 } }), null);
});

test('a kept tune has a slot of its own kind, and Projects opens it in the music generator', () => {
  const slot = newMusicSlot(1700000000000);
  assert.equal(slot, `${MUSIC_SLOT_PREFIX}1700000000000`);
  assert.ok(isMusicSlot(slot));
  assert.ok(!isMusicSlot('qr-code:1700000000000'));
  assert.ok(!isMusicSlot('__learning__:abc'));
  const href = musicProjectHref(slot);
  assert.equal(href, '#/music?slot=__music__%3A1700000000000');
  assert.equal(sessionOpenHref({ slot, toolId: '' }, false), href, 'the Projects tile and search open it there');
  assert.equal(musicSlotFromParams(href.slice('#/music?'.length)), slot, 'and the studio reads the slot back');
  assert.equal(musicSlotFromParams('style=ska&seed=7'), null);
  assert.equal(musicSlotFromParams('slot=qr-code%3A1'), null, 'a tool session is not a tune');
  assert.equal(sessionRenderHref(slot), href, 'Render in Projects opens the tune here, where its pill renders it');
  assert.equal(sessionRenderHref('qr-code:1'), null);
});

test('a copy made in Projects is a kept tune too', () => {
  // A copy made in Projects gets the slot `<toolId>:<time>` (views/projects.ts duplicateSessionCore).
  const record = musicProjectRecord(parseMusicState('style=ska&seed=7'), 'Ska');
  const copy = `${record.__toolId}:${Date.now()}`;
  assert.equal(record.__toolId, MUSIC_TOOL_ID);
  assert.ok(isMusicSlot(copy), copy);
});

test('a kept tune is named by its genre and its seed, short enough for a phone tile', () => {
  assert.equal(musicProjectTitle(parseMusicState('style=ska&seed=7')), 'Ska · 7');
  const longest = musicProjectTitle(parseMusicState('style=dnb&seed=999999'));
  assert.ok(!/Lolly Sings/.test(longest), longest);
  assert.ok(longest.length <= 24, `${longest} (${longest.length} characters)`);
});
