// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-open.ts - the address a team session opens at (plan 74).
 *
 * A teammate who opened a session with an uploaded image got the tool with no
 * image: the project file had been put on their device, but the address was built with
 * the share-link rules, which leave out every `user/` id. These cases pin the address
 * itself, the one place a session's model becomes the route its mount reads.
 *
 * Run directly:  node --test shells/web/src/org/team-open.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAssetVersion } from '@lolly/engine';
import { teamSessionAddress } from './team-open.ts';

type Model = Parameters<typeof teamSessionAddress>[1];

const query = (hash: string): URLSearchParams => new URLSearchParams(hash.slice(hash.indexOf('?') + 1));

const teamImage = { id: 'user/team/fil_abc', source: 'user', type: 'raster', format: 'png', url: 'blob:x' };

test('a project file the session uses stays in the address', () => {
  const model = [
    { id: 'image', type: 'asset', value: teamImage },
    { id: 'title', type: 'text', value: 'Launch' },
  ] as unknown as Model;
  const hash = teamSessionAddress('frame', model);
  assert.match(hash, /^#\/tool\/frame\?/);
  assert.equal(query(hash).get('image'), 'user/team/fil_abc', 'the image the teammate restored is named');
  assert.equal(query(hash).get('title'), 'Launch');
});

test('a pinned project file keeps its version through the address', () => {
  const model = [
    { id: 'image', type: 'asset', value: { ...teamImage, pin: { version: 'sha256-abc' } } },
  ] as unknown as Model;
  const raw = query(teamSessionAddress('frame', model)).get('image') ?? '';
  assert.deepEqual(decodeAssetVersion(raw), { id: 'user/team/fil_abc', pin: { version: 'sha256-abc' } });
});

test('a project file inside a block row stays in the address', () => {
  const model = [{
    id: 'slides',
    type: 'blocks',
    fields: [{ id: 'heading', type: 'text' }, { id: 'photo', type: 'asset' }],
    value: [{ heading: 'One', photo: teamImage }],
  }] as unknown as Model;
  const slides = query(teamSessionAddress('deck', model)).get('slides') ?? '';
  assert.match(slides, /user%2Fteam%2Ffil_abc/, 'the block cell keeps the id instead of a blank');
});

test('an upload kept on this device stays too, so its owner still sees the upload', () => {
  const model = [
    { id: 'image', type: 'asset', value: { ...teamImage, id: 'user/upl_1' } },
  ] as unknown as Model;
  assert.equal(query(teamSessionAddress('frame', model)).get('image'), 'user/upl_1');
});

test('the emoji set the session draws with rides along, and an empty model opens the bare tool', () => {
  const hash = teamSessionAddress('frame', [] as unknown as Model, { emoji: { emoji: 'noto', emojifx: 'original' } });
  assert.equal(query(hash).get('emoji'), 'noto');
  assert.equal(teamSessionAddress('frame', [] as unknown as Model), '#/tool/frame');
});
