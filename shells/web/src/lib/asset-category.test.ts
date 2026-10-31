// SPDX-License-Identifier: MPL-2.0
/**
 * Asset categories: audio is grouped by role (Music, Sound effects, Voice, Other
 * audio), from tags first and then the format, and is never filed under a picture
 * group because of a tag like "background".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { LIB_GROUPS, categoryLabel, groupsFor, isAudioAsset, libCategory } from './asset-category.ts';

const ref = (type: AssetRef['type'], format: string, tags: string[], id = 'x/y'): AssetRef =>
  ({ id, type, format, url: '', meta: { tags } }) as unknown as AssetRef;

test('catalog music lands in Music, by tag or by format', () => {
  assert.equal(libCategory(ref('audio', 'opus', ['ambient', 'audio', 'beat', 'lofi', 'loop', 'neurospicy'])), 'music');
  assert.equal(libCategory(ref('audio', 'zzfxm', ['audio', 'calm', 'generated', 'song'])), 'music');
  assert.equal(libCategory(ref('audio', 'xm', ['audio', 'chill', 'module', 'music', 'tracker'])), 'music');
  // An upload has only generic tags; the format says what it is.
  assert.equal(libCategory(ref('audio', 'zzfxm', ['audio', 'neurospicy'])), 'music', 'a MIDI import');
  assert.equal(libCategory(ref('audio', 'mod', ['audio', 'neurospicy'])), 'music', 'a tracker upload');
  assert.equal(libCategory(ref('audio', 'rondo', ['audio', 'neurospicy', 'rondocode'])), 'music', 'a rondocode song');
});

test('speech and sound effects get their own groups', () => {
  assert.equal(libCategory(ref('audio', 'wav', ['audio', 'neurospicy', 'tts'])), 'voice');
  assert.equal(libCategory(ref('audio', 'wav', ['audio', 'sfx', 'whoosh'])), 'sound-effects');
});

test('audio with no stated role is Other audio, never guessed into Music', () => {
  assert.equal(libCategory(ref('audio', 'mp3', ['audio', 'neurospicy'])), 'other-audio');
  assert.equal(libCategory(ref('audio', 'm4a', [])), 'other-audio');
});

test('a picture tag never files audio under a picture group', () => {
  assert.equal(libCategory(ref('audio', 'opus', ['audio', 'background', 'music'])), 'music');
  assert.equal(libCategory(ref('raster', 'png', ['background'])), 'backgrounds', 'pictures keep their groups');
  assert.equal(libCategory(ref('vector', 'svg', [])), 'other');
});

test('a person can move an asset only among groups of its own kind', () => {
  const audio = ref('audio', 'mp3', ['audio']);
  const picture = ref('raster', 'png', ['photo']);
  assert.ok(isAudioAsset(audio) && !isAudioAsset(picture));
  assert.deepEqual(groupsFor(audio).map((g) => g.key), ['music', 'sound-effects', 'voice', 'other-audio', 'other']);
  assert.ok(groupsFor(picture).every((g) => !g.audio));
  const movable = LIB_GROUPS.filter((g) => !g.fixed);
  assert.equal(groupsFor(picture).length + groupsFor(audio).length, movable.length + 1, 'More appears in both lists');
  assert.equal(libCategory(audio, { 'x/y': 'voice' }), 'voice', 'an override wins');
});

test('a brand skill files under Guidelines by its type, whatever its tags say (plan 323)', () => {
  assert.equal(libCategory(ref('skill', 'md', ['skill', 'brand', 'guidelines'], 'lolly/skill/brand')), 'guidelines');
  assert.equal(libCategory(ref('skill', 'md', ['logo', 'background'], 'suse/skill/brand')), 'guidelines', 'a picture tag does not move it');
  assert.ok(LIB_GROUPS.some((g) => g.key === 'guidelines' && g.label === 'Guidelines' && !g.audio));
  assert.equal(libCategory(ref('skill', 'md', [], 'lolly/skill/brand'), { 'lolly/skill/brand': 'other' }), 'other', 'an override still wins');
});

test('an uploaded image files under Photos unless its tags or the person say otherwise', () => {
  const upload = (type: AssetRef['type'], format: string, tags: string[] = []) =>
    ({ id: 'user/upload/1761900000000-img', source: 'user', type, format, url: '', meta: { tags } }) as unknown as AssetRef;
  assert.equal(libCategory(upload('raster', 'jpg')), 'photos', 'a JPG straight off a camera');
  assert.equal(libCategory(upload('raster', 'png')), 'photos');
  assert.equal(libCategory(upload('raster', 'png', ['logo'])), 'logos', 'a tag still decides first');
  assert.equal(libCategory(upload('raster', 'jpg'), { 'user/upload/1761900000000-img': 'backgrounds' }), 'backgrounds', 'Recategorise still wins');
  assert.equal(libCategory(upload('vector', 'svg')), 'other', 'a drawing is not a photo');
  assert.equal(libCategory(ref('raster', 'png', [])), 'other', 'an untagged catalog picture keeps its section');
});

test('an emoji set files under Emoji sets, the section the Assets view shows it in', () => {
  const pack = { id: 'community/emoji/twemoji/color', source: 'library', type: 'data', format: 'json', url: '', meta: { tags: ['emoji-pack', 'emoji', 'twemoji'] } } as unknown as AssetRef;
  assert.equal(libCategory(pack), 'emoji-sets');
  assert.equal(categoryLabel('emoji-sets'), 'Emoji sets');
  assert.equal(libCategory(pack, { 'community/emoji/twemoji/color': 'logos' }), 'emoji-sets', 'an old override cannot file a set elsewhere');
  assert.equal(libCategory(ref('raster', 'png', ['photo']), { 'x/y': 'emoji-sets' }), 'photos', 'nor move a picture into the sets');
  for (const asset of [pack, ref('raster', 'png', ['photo']), ref('audio', 'mp3', ['audio'])]) {
    assert.ok(groupsFor(asset).every((g) => g.key !== 'emoji-sets'), 'Emoji sets is never offered as a place to move an asset');
  }
});
