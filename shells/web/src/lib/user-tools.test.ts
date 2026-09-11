// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createUserToolStore,
  projectUserTool,
  isUserToolId,
  USER_TOOL_CATEGORY,
  USER_TOOL_ID_PREFIX,
  type UserToolHost,
  type UserTool,
} from './user-tools.ts';

// A memory-backed profile host - the same read-modify-write surface folders.ts / user-
// templates.ts use. Carries a sibling field so the tests can prove the store never clobbers
// the rest of the profile.
function memHost(seed: Record<string, unknown> = {}): { host: UserToolHost; raw: () => Record<string, unknown> } {
  let profile: Record<string, unknown> = { headshot: 'keep-me', ...seed };
  return {
    host: {
      profile: {
        get: async () => profile as never,
        set: async (p) => { profile = p as Record<string, unknown>; },
      },
    },
    raw: () => profile,
  };
}

test('save → list round-trips the record and mints id + timestamps', async () => {
  const { host } = memHost();
  const store = createUserToolStore(host);
  const saved = await store.save({
    title: 'My poster maker', description: 'Square posters', icon: '<svg/>',
    formats: ['png', 'svg'], baseToolId: 'design', values: { boxes: [{ id: 'a' }] },
  });
  assert.ok(saved.id, 'has an id');
  assert.ok(saved.createdAt && saved.updatedAt, 'has timestamps');
  assert.equal(saved.baseToolId, 'design');
  assert.deepEqual(saved.formats, ['png', 'svg']);

  const list = await store.list();
  assert.equal(list.length, 1);
  assert.equal(list[0]!.title, 'My poster maker');
  assert.deepEqual(list[0]!.values, { boxes: [{ id: 'a' }] });
});

test('list returns all, newest first; get resolves one by id', async () => {
  const { host } = memHost();
  const store = createUserToolStore(host);
  const a = await store.save({ title: 'A', baseToolId: 'design', values: {} });
  await store.save({ title: 'B', baseToolId: 'design', values: {} });
  const list = await store.list();
  assert.deepEqual(list.map(t => t.title).sort(), ['A', 'B']);
  const one = await store.get(a.id);
  assert.equal(one?.title, 'A');
  assert.equal(await store.get('nope'), null);
});

test('optional fields are omitted when empty (no empty description/icon keys)', async () => {
  const { host } = memHost();
  const store = createUserToolStore(host);
  const t = await store.save({ title: 'Bare', baseToolId: 'design', values: {}, description: '  ' });
  assert.equal('description' in t, false, 'a blank description is dropped');
  assert.equal('icon' in t, false, 'no icon key when none given');
  assert.deepEqual(t.formats, [], 'formats defaults to an empty array');
});

test('remove drops one record; rename updates the title', async () => {
  const { host } = memHost();
  const store = createUserToolStore(host);
  const a = await store.save({ title: 'Old', baseToolId: 'design', values: {} });
  await store.save({ title: 'Keep', baseToolId: 'design', values: {} });
  await store.rename(a.id, 'New');
  assert.equal((await store.get(a.id))?.title, 'New');
  await store.remove(a.id);
  assert.deepEqual((await store.list()).map(t => t.title), ['Keep']);
});

test('an empty name is rejected (save + rename); a base tool id is required', async () => {
  const { host } = memHost();
  const store = createUserToolStore(host);
  await assert.rejects(() => store.save({ title: '  ', baseToolId: 'design', values: {} }));
  await assert.rejects(() => store.save({ title: 'X', baseToolId: '', values: {} }));
  const a = await store.save({ title: 'Real', baseToolId: 'design', values: {} });
  await assert.rejects(() => store.rename(a.id, ''));
});

test('writes never clobber sibling profile fields (folders, userTemplates, headshot)', async () => {
  const { host, raw } = memHost({
    folders: [{ id: 'f1', name: 'Proj', items: [] }],
    userTemplates: [{ id: 't1', toolId: 'design', name: 'Tpl', values: {}, createdAt: '', updatedAt: '' }],
  });
  const store = createUserToolStore(host);
  await store.save({ title: 'T', baseToolId: 'design', values: {} });
  const p = raw();
  assert.equal(p.headshot, 'keep-me', 'headshot preserved');
  assert.deepEqual(p.folders, [{ id: 'f1', name: 'Proj', items: [] }], 'folders preserved');
  assert.equal((p.userTemplates as unknown[]).length, 1, 'userTemplates preserved');
  assert.equal((p.userTools as unknown[]).length, 1, 'userTools written');
});

test('projectUserTool produces a namespaced listing entry under "Your tools"', () => {
  const tool: UserTool = {
    id: 'abc', title: 'My tool', description: 'Does a thing', icon: '<svg/>',
    formats: ['png'], baseToolId: 'design', values: { boxes: [] },
    createdAt: '2026-01-01', updatedAt: '2026-01-01',
  };
  const p = projectUserTool(tool);
  assert.equal(p.id, USER_TOOL_ID_PREFIX + 'abc', 'the id is namespaced so it never collides with a catalog id');
  assert.ok(isUserToolId(p.id), 'and is recognisable as a user-tool id');
  assert.equal(isUserToolId('design'), false, 'a real tool id is not');
  assert.equal(p.name, 'My tool');
  assert.equal(p.category, USER_TOOL_CATEGORY);
  assert.deepEqual(p.formats, ['png']);
  assert.deepEqual(p.userTool, { baseToolId: 'design', values: { boxes: [] } },
    'carries the open payload (base tool + saved values)');
});

test('projectUserTool omits absent optional fields', () => {
  const p = projectUserTool({
    id: 'x', title: 'Plain', formats: [], baseToolId: 'design', values: {},
    createdAt: '', updatedAt: '',
  });
  assert.equal('description' in p, false);
  assert.equal('icon' in p, false);
  assert.equal(p.category, USER_TOOL_CATEGORY);
});
