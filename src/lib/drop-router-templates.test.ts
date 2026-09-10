// SPDX-License-Identifier: MPL-2.0
/**
 * Registering the templates a shared `.lolly` handed over (plans/226 WP-6).
 *
 * The router's own file half is covered by lolly-pack.test.ts; this is the other end -
 * what arrives in the person's profile when a file carrying `templates.json` is opened.
 * Headless: an in-memory profile pair is the only seam the registration needs, and the
 * collision question is injected, so no dialog and no DOM are involved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importCarriedTemplates, type TemplateCollision } from './drop-router.ts';
import type { UserTemplate } from './user-templates.ts';

function memHost(seed: Record<string, unknown> = {}) {
  let profile = { ...seed } as { userTemplates?: UserTemplate[]; [key: string]: unknown };
  return {
    host: {
      profile: {
        get: async () => profile,
        set: async (p: typeof profile) => { profile = p; },
      },
    },
    list: (): UserTemplate[] => profile.userTemplates ?? [],
    profile: () => profile,
  };
}

const incoming = (over: Partial<UserTemplate> = {}): UserTemplate => ({
  id: 'sender-1',
  toolId: 'chart',
  name: 'Quarterly bars',
  description: 'The house chart',
  values: { title: 'Q3' },
  from: 'user:some-other-device-id',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over,
});

const never = async (): Promise<TemplateCollision> => {
  throw new Error('the collision question must not be asked');
};

test('a shared template joins the store under a fresh id, with the sender ancestry dropped', async () => {
  const store = memHost({ firstname: 'Ada' });
  const result = await importCarriedTemplates([incoming(), incoming({ id: 'sender-2', name: 'Pie', values: { kind: 'pie' } })], store.host, never);

  assert.deepEqual(result, { added: 2, replaced: 0, skipped: 0 });
  const saved = store.list();
  assert.equal(saved.length, 2);
  assert.deepEqual(saved.map(t => t.name).sort(), ['Pie', 'Quarterly bars']);
  assert.ok(saved.every(t => t.id !== 'sender-1' && t.id !== 'sender-2'), 'ids are re-minted on this device');
  assert.ok(saved.every(t => t.from === undefined), 'a ref naming the sender\'s own library never travels as ancestry');
  assert.deepEqual(saved.find(t => t.name === 'Quarterly bars')!.values, { title: 'Q3' });
  assert.equal(saved.find(t => t.name === 'Quarterly bars')!.description, 'The house chart');
  assert.equal(store.profile().firstname, 'Ada', 'the rest of the profile survives the read-modify-write');
});

test('the same name for the same tool asks, and Replace keeps the local record\'s identity', async () => {
  const store = memHost();
  await importCarriedTemplates([incoming({ values: { title: 'old' } })], store.host, never);
  const before = store.list()[0]!;

  const asked: string[] = [];
  const result = await importCarriedTemplates([incoming({ values: { title: 'new' }, description: 'Updated' })], store.host, async (inc, existing) => {
    asked.push(`${inc.name}/${existing.id === before.id}`);
    return 'replace';
  });

  assert.deepEqual(asked, ['Quarterly bars/true'], 'the question names the incoming template and the local one it collides with');
  assert.deepEqual(result, { added: 0, replaced: 1, skipped: 0 });
  const after = store.list();
  assert.equal(after.length, 1, 'Replace leaves one record, not two');
  assert.equal(after[0]!.id, before.id, 'the id survives, so a "Start with" pointing at it still resolves');
  assert.deepEqual(after[0]!.values, { title: 'new' });
  assert.equal(after[0]!.description, 'Updated');
});

test('Keep both saves a numbered sibling; a dismissed question skips that template', async () => {
  const store = memHost();
  await importCarriedTemplates([incoming()], store.host, never);

  await importCarriedTemplates([incoming({ values: { title: 'second' } })], store.host, async () => 'keep-both');
  assert.deepEqual(store.list().map(t => t.name).sort(), ['Quarterly bars', 'Quarterly bars 2']);

  await importCarriedTemplates([incoming({ values: { title: 'third' } })], store.host, async () => 'keep-both');
  assert.deepEqual(store.list().map(t => t.name).sort(), ['Quarterly bars', 'Quarterly bars 2', 'Quarterly bars 3']);

  const dismissed = await importCarriedTemplates([incoming({ values: { title: 'fourth' } })], store.host, async () => null);
  assert.deepEqual(dismissed, { added: 0, replaced: 0, skipped: 1 });
  assert.equal(store.list().length, 3, 'a dismissed question writes nothing');
});

test('a template for a different tool is not a collision', async () => {
  const store = memHost();
  await importCarriedTemplates([incoming()], store.host, never);
  const result = await importCarriedTemplates([incoming({ toolId: 'design' })], store.host, never);
  assert.deepEqual(result, { added: 1, replaced: 0, skipped: 0 });
  assert.equal(store.list().length, 2);
});

test('nothing to register is not an import', async () => {
  const store = memHost();
  assert.deepEqual(await importCarriedTemplates([], store.host, never), { added: 0, replaced: 0, skipped: 0 });
  assert.equal(store.profile().userTemplates, undefined, 'an empty part never even writes the profile');
});
