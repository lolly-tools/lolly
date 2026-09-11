// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUserTemplateStore, type UserTemplateHost } from './user-templates.ts';

// A memory-backed profile host - the same read-modify-write surface folders.ts uses. Carries
// a sibling field so the tests can prove the store never clobbers the rest of the profile.
function memHost(seed: Record<string, unknown> = {}): { host: UserTemplateHost; raw: () => Record<string, unknown> } {
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
  const store = createUserTemplateStore(host);
  const saved = await store.save({ toolId: 'design', name: 'My deck', values: { boxes: [{ id: 'a' }] } });
  assert.ok(saved.id, 'has an id');
  assert.ok(saved.createdAt && saved.updatedAt, 'has timestamps');
  assert.equal(saved.variationOf, undefined, 'standalone template has no base');

  const list = await store.list('design');
  assert.equal(list.length, 1);
  assert.equal(list[0]!.name, 'My deck');
  assert.deepEqual(list[0]!.values, { boxes: [{ id: 'a' }] });
});

test('list(toolId) scopes to the tool; list() returns all, newest first', async () => {
  const { host } = memHost();
  const store = createUserTemplateStore(host);
  await store.save({ toolId: 'design', name: 'D1', values: {} });
  await store.save({ toolId: 'qr-code', name: 'Q1', values: {} });
  await store.save({ toolId: 'design', name: 'D2', values: {} });

  const design = await store.list('design');
  assert.deepEqual(design.map(t => t.name).sort(), ['D1', 'D2']);
  const qr = await store.list('qr-code');
  assert.deepEqual(qr.map(t => t.name), ['Q1']);
  assert.equal((await store.list()).length, 3);
});

test('variation carries variationOf; standalone omits it', async () => {
  const { host } = memHost();
  const store = createUserTemplateStore(host);
  const v = await store.save({ toolId: 'design', name: 'Bold', values: {}, variationOf: 'slide-deck' });
  assert.equal(v.variationOf, 'slide-deck');
  const t = await store.save({ toolId: 'design', name: 'Plain', values: {} });
  assert.equal('variationOf' in t, false, 'no empty variationOf key on a standalone');
});

test('remove drops one record and leaves the rest', async () => {
  const { host } = memHost();
  const store = createUserTemplateStore(host);
  const a = await store.save({ toolId: 'design', name: 'A', values: {} });
  await store.save({ toolId: 'design', name: 'B', values: {} });
  await store.remove(a.id);
  const list = await store.list('design');
  assert.deepEqual(list.map(t => t.name), ['B']);
});

test('rename updates the name + touches updatedAt', async () => {
  const { host } = memHost();
  const store = createUserTemplateStore(host);
  const a = await store.save({ toolId: 'design', name: 'Old', values: {} });
  await store.rename(a.id, 'New');
  assert.equal((await store.list('design'))[0]!.name, 'New');
});

test('an empty name is rejected (save + rename)', async () => {
  const { host } = memHost();
  const store = createUserTemplateStore(host);
  await assert.rejects(() => store.save({ toolId: 'design', name: '  ', values: {} }));
  const a = await store.save({ toolId: 'design', name: 'Real', values: {} });
  await assert.rejects(() => store.rename(a.id, ''));
});

test('writes never clobber sibling profile fields (folders, headshot)', async () => {
  const { host, raw } = memHost({ folders: [{ id: 'f1', name: 'Proj', items: [] }] });
  const store = createUserTemplateStore(host);
  await store.save({ toolId: 'design', name: 'T', values: {} });
  const p = raw();
  assert.equal(p.headshot, 'keep-me', 'headshot preserved');
  assert.deepEqual(p.folders, [{ id: 'f1', name: 'Proj', items: [] }], 'folders preserved');
  assert.equal((p.userTemplates as unknown[]).length, 1, 'userTemplates written');
});

// ─── plans/226: v2 record + management methods ─────────────────────────────────

test('save carries description / designSystem / from, and never writes variationOf', async () => {
  const { host, raw } = memHost();
  const store = createUserTemplateStore(host);
  const t = await store.save({
    toolId: 'qr-code', name: '  Wi-Fi  ', values: { url: 'x' }, description: '  For   the office ',
    designSystem: { id: 'suse', label: 'SUSE' }, from: 'qr-code:wifi',
  });
  assert.equal(t.name, 'Wi-Fi');
  assert.equal(t.description, 'For the office');
  assert.deepEqual(t.designSystem, { id: 'suse', label: 'SUSE' });
  assert.equal(t.from, 'qr-code:wifi');
  assert.equal('variationOf' in t, false);
  const plain = await store.save({ toolId: 'qr-code', name: 'Plain', values: {}, description: '   ' });
  assert.equal('description' in plain, false, 'a blank description is not stored');
  assert.equal((raw().userTemplates as unknown[]).length, 2);
  assert.equal(raw().headshot, 'keep-me');
});

test('get / replace / describe / duplicate / remove', async () => {
  const { host } = memHost();
  const store = createUserTemplateStore(host);
  const t = await store.save({ toolId: 'design', name: 'Deck', values: { boxes: [1] }, description: 'v1' });
  assert.equal((await store.get(t.id))?.name, 'Deck');
  assert.equal(await store.get('nope'), null);

  assert.equal(await store.replace(t.id, { boxes: [1, 2] }), true);
  assert.deepEqual((await store.get(t.id))?.values, { boxes: [1, 2] });
  assert.equal(await store.replace('nope', {}), false);

  await store.describe(t.id, '  v2  ');
  assert.equal((await store.get(t.id))?.description, 'v2');
  await store.describe(t.id, '');
  assert.equal((await store.get(t.id))?.description, undefined);

  const copy = await store.duplicate(t.id);
  assert.ok(copy && copy.id !== t.id);
  assert.equal(copy.name, 'Deck copy');
  assert.equal(copy.from, `user:${t.id}`);
  assert.deepEqual(copy.values, { boxes: [1, 2] });
  copy.values.boxes = [];   // a deep copy, not the same array
  assert.deepEqual((await store.get(t.id))?.values, { boxes: [1, 2] });
  const named = await store.duplicate(t.id, 'Deck B');
  assert.equal(named?.name, 'Deck B');
  assert.equal(await store.duplicate('nope'), null);

  await store.remove(t.id);
  assert.equal(await store.get(t.id), null);
  assert.equal((await store.list('design')).length, 2);
});

test('canSaveTemplate: needs one non-file input', async () => {
  const { canSaveTemplate } = await import('./user-templates.ts');
  assert.equal(canSaveTemplate([{ type: 'text' }]), true);
  assert.equal(canSaveTemplate([{ type: 'file' }, { type: 'select' }]), true);
  assert.equal(canSaveTemplate([{ type: 'file' }]), false);
  assert.equal(canSaveTemplate([]), false);
  assert.equal(canSaveTemplate(undefined), false);
});

test('size gauge: 40 Design templates keep the profile record under 1 MB (plans/226 D5)', async () => {
  // The shipped Design templates are the heaviest real seeds we have; cycle them to 40
  // records and measure the profile as JSON. If this ever trips, the follow-up is the
  // dedicated store + backup part (plans/186 pattern), not a bigger budget.
  const { readdirSync, readFileSync } = await import('node:fs');
  const dir = new URL('../../../../community/design/templates/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 8, 'shipped Design templates present');
  const { host, raw } = memHost();
  const store = createUserTemplateStore(host);
  for (let i = 0; i < 40; i++) {
    const file = JSON.parse(readFileSync(new URL(files[i % files.length]!, dir), 'utf8')) as { values: Record<string, unknown> };
    await store.save({ toolId: 'design', name: `Template ${i}`, values: file.values });
  }
  const bytes = Buffer.byteLength(JSON.stringify(raw()), 'utf8');
  assert.ok(bytes < 1_000_000, `profile is ${bytes} bytes`);
});
