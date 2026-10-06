// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWebEmbed } from '../../../../engine/src/web-embed.ts';
import { changeWebPlayback, webPlaybackRows } from './design-web-playback.ts';

test('playback edits preserve the shared video link and use its current settings', () => {
  const embed = parseWebEmbed('https://youtu.be/M7lc1UVf-VE?t=1m&controls=0', { appOrigin: 'https://lolly.ing' }); assert.ok(embed);
  const playing = changeWebPlayback(embed, 'autoplay', '1'); assert.ok(playing);
  const updated = parseWebEmbed(playing, { appOrigin: 'https://lolly.ing' }); assert.ok(updated);
  const params = new URL(updated.src).searchParams;
  assert.equal(params.get('start'), '60'); assert.equal(params.get('controls'), '0'); assert.equal(params.get('autoplay'), '1'); assert.equal(params.get('mute'), '1');
  const start = changeWebPlayback(updated, 'start', '30'); assert.ok(start);
  assert.equal(new URL(start).searchParams.has('t'), false);
  assert.equal(new URL(start).searchParams.get('start'), '30');
  assert.equal(changeWebPlayback(updated, 'start', '-1'), null);
  assert.equal(changeWebPlayback(updated, 'start', 'Infinity'), null);
  assert.equal(changeWebPlayback(updated, 'origin', 'https://other.example'), null);
  assert.equal(changeWebPlayback(updated, 'autoplay', 'true'), null);
});

test('provider options are limited to supported players and carry normal input focus identifiers', () => {
  const video = parseWebEmbed('https://youtu.be/M7lc1UVf-VE', { appOrigin: 'https://lolly.ing' }); assert.ok(video);
  const rows = webPlaybackRows(video); assert.equal((rows.match(/data-fld="web"/g) || []).length, 8);
  assert.match(rows, /data-web-param="controls" checked/);
  const page = parseWebEmbed('https://commons.wikimedia.org', { appOrigin: 'https://lolly.ing' }); assert.ok(page);
  assert.equal(webPlaybackRows(page), ''); assert.equal(changeWebPlayback(page, 'autoplay', '1'), null);
});
