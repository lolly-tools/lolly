// SPDX-License-Identifier: MPL-2.0
/**
 * The trip from the Sound room to the music generator and back (lib/sound-edit-handoff.ts):
 * the draft survives a storage that refuses it, an old trip is dropped, and the address
 * only ever carries the music settings and the marker.
 *
 * Run directly:
 *   node --test shells/web/src/lib/sound-edit-handoff.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starterSonicProfile } from './sonic-music.ts';
import {
  clearSoundEdit,
  finishSoundEdit,
  isSoundEditLink,
  readSoundEdit,
  soundEditHref,
  writeSoundEdit,
  type SoundEditTrip,
} from './sound-edit-handoff.ts';

const trip = (at = Date.now()): SoundEditTrip => {
  const profile = starterSonicProfile('sound', 'Harbour');
  profile.identity.character = 'Private: not for the address bar';
  return { v: 1, system: 'harbour', label: 'Harbour', base: null, profile, contextId: 'explain', picked: true, dirty: true, at };
};

test('a trip is written, answered and cleared', () => {
  clearSoundEdit();
  assert.equal(readSoundEdit(), null);
  writeSoundEdit(trip());
  assert.equal(readSoundEdit()?.contextId, 'explain');
  finishSoundEdit({ parameters: 'style=warm&seed=3' });
  assert.deepEqual(readSoundEdit()?.result, { parameters: 'style=warm&seed=3' });
  clearSoundEdit();
  assert.equal(readSoundEdit(), null);
});

test('a reader gets its own copy, and an old trip is dropped', () => {
  clearSoundEdit();
  writeSoundEdit(trip());
  readSoundEdit()!.profile.label = 'Changed';
  assert.equal(readSoundEdit()!.profile.label, 'Harbour');
  writeSoundEdit(trip(Date.now() - 2 * 24 * 60 * 60 * 1000));
  assert.equal(readSoundEdit(), null);
});

test('the address carries the settings and the marker, never the draft', () => {
  const href = soundEditHref('style=warm&seed=3');
  assert.equal(href, '#/music?style=warm&seed=3&sound=edit');
  assert.ok(isSoundEditLink(href));
  assert.ok(isSoundEditLink('style=warm&sound=edit'));
  assert.equal(isSoundEditLink('style=warm&seed=3'), false);
  assert.doesNotMatch(href, /Private/);
});
