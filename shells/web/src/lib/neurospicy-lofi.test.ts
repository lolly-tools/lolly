// SPDX-License-Identifier: MPL-2.0
/**
 * The Lofi stations in the Neurospicy player: their ids, their place in the track list,
 * shared links, and the visualizer feed's level.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/neurospicy-lofi.test.ts
 *
 * What is pinned:
 *  - four stations, the Lofi moods warm, late night and rainy, and Lolly Sings, with ids
 *    that round-trip to their mood;
 *  - a selection that was a retired catalog track carries on with the nearest station;
 *  - a shared link carries a mood and a 32-bit seed, and anything else is ignored;
 *  - taking the link out of the address keeps every other parameter and the route;
 *  - the stations are in the track list in their own group, always (no catalog needed),
 *    and are never mistaken for evidence that the catalog has loaded;
 *  - the visualizer feed lifts a quiet track and holds its gain through silence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLofiId, lofiId, lofiMoodOf, lofiTracks, parseLofiLink, lofiLinkValue, readLofiLink, withoutLofiLink, retiredTrackStation,
  LOFI_STATION_MOODS,
} from './neurospicy-lofi.ts';
import { listLoops, trackCategory, invalidateNeurospicyTracks, feedGainFor, type NeurospicyHost } from './neurospicy.ts';
import { LOFI_MOODS } from '../../../../engine/src/lofi-compose.ts';

test('four stations whose ids round-trip to their mood', () => {
  assert.deepEqual([...LOFI_STATION_MOODS].sort(), [...LOFI_MOODS].sort(), 'the player offers every mood the composer has');
  for (const mood of LOFI_STATION_MOODS) {
    assert.equal(lofiMoodOf(lofiId(mood)), mood);
    assert.ok(isLofiId(lofiId(mood)));
  }
  assert.equal(lofiMoodOf('lofi:sunny'), null, 'an unknown mood is not a station');
  assert.equal(isLofiId('lolly/songs/amber-glow'), false);
  assert.deepEqual(lofiTracks().map(t => t.name), [
    'Lolly Sings', 'Lolly Sings · Sugar', 'Lolly Sings · Chiptune', 'Lolly Sings · City pop', 'Lolly Sings · Funk', 'Lolly Sings · Soul', 'Lolly Sings · Nu-disco', 'Lolly Sings · Hip hop', 'Lolly Sings · Trip hop', 'Lolly Sings · Reggae', 'Lolly Sings · Spanish guitar', 'Lolly Sings · Rock', 'Lolly Sings · Synthwave', 'Lolly Sings · Acid', 'Lolly Sings · Electro', 'Lolly Sings · Dubstep', 'Lolly Sings · Brostep', 'Lolly Sings · D&B', 'Lofi · Warm', 'Lofi · Late night', 'Lofi · Rainy',
  ]);
});

test('a retired catalog track hands over to the nearest station', () => {
  assert.equal(retiredTrackStation('lolly/songs/amber-glow'), 'lofi:sings');
  assert.equal(retiredTrackStation('lolly/loops/rain-on-the-boulevard'), 'lofi:rainy');
  assert.equal(retiredTrackStation('lolly/loops/3-am-echoes'), 'lofi:lateNight');
  assert.equal(retiredTrackStation('lolly/modules/headspin'), 'lofi:warm');
  assert.equal(retiredTrackStation('suse/music/a-beautiful-dream'), null, 'a track still in a catalog is left alone');
  assert.equal(retiredTrackStation('lofi:warm'), null);
  assert.equal(retiredTrackStation('user/abc'), null);
});

test('a shared link carries a mood and a seed; anything else is ignored', () => {
  assert.deepEqual(parseLofiLink('warm.123456'), { mood: 'warm', seed: 123456 });
  assert.deepEqual(parseLofiLink(lofiLinkValue({ mood: 'lateNight', seed: 4294967295 })), { mood: 'lateNight', seed: 4294967295 });
  for (const bad of ['', 'warm', 'warm.', 'sunny.12', 'warm.-1', 'warm.4294967296', 'warm.1e5', 'warm.12.3', 'WARM.1<script>']) {
    assert.equal(parseLofiLink(bad), null, `"${bad}" is ignored`);
  }
  assert.deepEqual(readLofiLink({ hash: '#/gallery?lofi=rainy.42&lang=de', search: '' }), { mood: 'rainy', seed: 42 });
  assert.deepEqual(readLofiLink({ hash: '#/', search: '?lofi=warm.7' }), { mood: 'warm', seed: 7 });
  assert.equal(readLofiLink({ hash: '#/', search: '' }), null);
});

test('taking the link out of the address keeps the route and every other parameter', () => {
  assert.equal(withoutLofiLink({ pathname: '/', hash: '#/gallery?lofi=rainy.42&lang=de', search: '' }), '/#/gallery?lang=de');
  assert.equal(withoutLofiLink({ pathname: '/', hash: '#/?lofi=warm.1', search: '' }), '/#/');
  assert.equal(withoutLofiLink({ pathname: '/app', hash: '#/', search: '?lofi=warm.7&x=1' }), '/app?x=1#/');
});

const emptyHost: NeurospicyHost = {
  assets: { get: async () => { throw new Error('none'); }, query: async () => [] as never },
  profile: { get: async () => ({}), set: async () => ({}) },
};

test('the stations are always in the track list, all in the Lolly Sings group', async () => {
  invalidateNeurospicyTracks();
  const loops = await listLoops(emptyHost);   // no catalog at all: a cold or offline boot
  assert.deepEqual(loops.filter(t => isLofiId(t.id)).map(t => t.id), [
    'lofi:sings', 'lofi:sugar', 'lofi:chiptune', 'lofi:citypop', 'lofi:funk', 'lofi:soul', 'lofi:nudisco', 'lofi:hiphop', 'lofi:triphop', 'lofi:reggae', 'lofi:spanish', 'lofi:rock', 'lofi:synthwave', 'lofi:acid', 'lofi:electro', 'lofi:dubstep', 'lofi:brostep', 'lofi:dnb', 'lofi:warm', 'lofi:lateNight', 'lofi:rainy',
  ]);
  assert.deepEqual(loops.filter(t => trackCategory(t) === 'lolly').map(t => t.name), [
    'Lolly Sings', 'Lolly Sings · Sugar', 'Lolly Sings · Chiptune', 'Lolly Sings · City pop', 'Lolly Sings · Funk', 'Lolly Sings · Soul', 'Lolly Sings · Nu-disco', 'Lolly Sings · Hip hop', 'Lolly Sings · Trip hop', 'Lolly Sings · Reggae', 'Lolly Sings · Spanish guitar', 'Lolly Sings · Rock', 'Lolly Sings · Synthwave', 'Lolly Sings · Acid', 'Lolly Sings · Electro', 'Lolly Sings · Dubstep', 'Lolly Sings · Brostep', 'Lolly Sings · D&B', 'Lofi · Warm', 'Lofi · Late night', 'Lofi · Rainy',
  ], 'the family genres first, then the Lofi moods');
});

test('the visualizer feed lifts a quiet track, caps a loud one, and holds through silence', () => {
  assert.ok(feedGainFor(0.01, 4) > 10, 'a quiet track is lifted');
  assert.equal(feedGainFor(0.5, 4), 1, 'a loud one is never turned down below unity');
  assert.equal(feedGainFor(0.001, 24), 24, 'the lift is capped');
  assert.equal(feedGainFor(0, 7.5), 7.5, 'silence holds the gain where it was');
  assert.equal(feedGainFor(Number.NaN, 7.5), 7.5);
});
