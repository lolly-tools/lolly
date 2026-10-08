// SPDX-License-Identifier: MPL-2.0
/**
 * Asset categories: audio is grouped by role (Music, Sound effects, Voice, Other
 * audio), from tags first and then the format, and is never filed under a picture
 * group because of a tag like "background".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { LIB_GROUPS, groupsFor, isAudioAsset, libCategory } from './asset-category.ts';

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
  assert.equal(groupsFor(picture).length + groupsFor(audio).length, LIB_GROUPS.length + 1, 'More appears in both lists');
  assert.equal(libCategory(audio, { 'x/y': 'voice' }), 'voice', 'an override wins');
});
