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
import { teamSessionAddress, teamSessionRole } from './team-open.ts';
import { registerSessionSource } from '../lib/session-source.ts';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

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

test('the role an origin carries: the session read\'s own, else the project row\'s (plan 75 J5)', async () => {
  assert.equal(await teamSessionRole({ myRole: 'viewer' }, 'proj-9'), 'viewer', 'the session read says');
  assert.equal(await teamSessionRole({}, 'proj-9'), undefined, 'no source, no list: unknown');
  const off = registerSessionSource({
    label: 'lolly.ing',
    listProjects: async () => [{ id: 'proj-9', name: 'Brand refresh', myRole: 'viewer' }, { id: 'proj-2', name: 'Drafts', myRole: 'editor' }],
    listSessions: async () => [], fetchSession: async () => null,
  });
  try {
    assert.equal(await teamSessionRole({}, 'proj-9'), 'viewer', 'an older instance: the project row says');
    assert.equal(await teamSessionRole({ myRole: 'editor' }, 'proj-9'), 'editor', 'the session read wins (a group can make a viewer row an editor)');
    assert.equal(await teamSessionRole({}, 'proj-404'), undefined);
    assert.equal(await teamSessionRole({}, undefined), undefined);
  } finally {
    off();
  }
});

test('the open carries the role and waits for the scope provider before navigating', () => {
  const src = readFileSync(resolve(import.meta.dirname, 'team-open.ts'), 'utf8');
  const open = src.slice(src.indexOf('export async function openTeamSession('));
  assert.match(open, /\.\.\.\(role \? \{ role \} : \{\}\)/);
  const prepared = open.indexOf('await prepareTeamScope();');
  assert.ok(prepared > 0, 'the provider is prepared');
  assert.ok(prepared < open.indexOf('rememberTeamSessionOrigin(origin, { hash });'), 'before the stash is armed for the mount');
  assert.ok(prepared < open.indexOf('adoptTeamSessionOrigin(origin);'), 'and before a same-address adopt');
});
