// SPDX-License-Identifier: MPL-2.0
/** lib/template-ref.ts - the one string that names a template, and the shared resolver. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  formatTemplateRef, isUserTemplateRef, parseTemplateRef, resolveTemplateSeed,
  shippedTemplateRef, userTemplateRef,
} from './template-ref.ts';
import { createUserTemplateStore, type UserTemplateHost } from './user-templates.ts';

function memHost(seed: Record<string, unknown> = {}): UserTemplateHost {
  let profile: Record<string, unknown> = { ...seed };
  return { profile: { get: async () => profile as never, set: async (p) => { profile = p as Record<string, unknown>; } } };
}

test('parseTemplateRef: shipped, user, bare-with-tool, and junk', () => {
  assert.deepEqual(parseTemplateRef('design:poster'), { kind: 'shipped', toolId: 'design', id: 'poster' });
  assert.deepEqual(parseTemplateRef('user:abc-123'), { kind: 'user', id: 'abc-123' });
  assert.deepEqual(parseTemplateRef('poster', { toolId: 'design' }), { kind: 'shipped', toolId: 'design', id: 'poster' });
  assert.equal(parseTemplateRef('poster'), null, 'a bare id needs a tool');
  assert.equal(parseTemplateRef('user:'), null);
  assert.equal(parseTemplateRef(':poster'), null);
  assert.equal(parseTemplateRef('design:'), null);
  assert.equal(parseTemplateRef(''), null);
  assert.equal(parseTemplateRef(42), null);
  assert.equal(parseTemplateRef(null), null);
  // a template id may itself contain a colon-free slug only, but a second colon stays in the id
  assert.deepEqual(parseTemplateRef('chart:a:b'), { kind: 'shipped', toolId: 'chart', id: 'a:b' });
});

test('format/parse round-trip and the helpers agree', () => {
  assert.equal(shippedTemplateRef('qr-code', 'wifi'), 'qr-code:wifi');
  assert.equal(userTemplateRef('u1'), 'user:u1');
  assert.equal(formatTemplateRef(parseTemplateRef('qr-code:wifi')!), 'qr-code:wifi');
  assert.equal(formatTemplateRef(parseTemplateRef('user:u1')!), 'user:u1');
  assert.equal(isUserTemplateRef('user:u1'), true);
  assert.equal(isUserTemplateRef('user:'), false);
  assert.equal(isUserTemplateRef('design:poster'), false);
});

test('resolveTemplateSeed: a user ref reads the store inline, scoped to its tool', async () => {
  const host = memHost();
  const saved = await createUserTemplateStore(host).save({ toolId: 'qr-code', name: 'Mine', values: { url: 'https://suse.com' } });
  const hit = await resolveTemplateSeed(host, `user:${saved.id}`, { fetchShipped: async () => { throw new Error('must not fetch'); } });
  assert.ok(hit);
  assert.equal(hit.toolId, 'qr-code');
  assert.equal(hit.name, 'Mine');
  assert.deepEqual(hit.values, { url: 'https://suse.com' });
  assert.deepEqual(hit.ref, { kind: 'user', id: saved.id });
  // another tool asking for it gets nothing
  assert.equal(await resolveTemplateSeed(host, `user:${saved.id}`, { toolId: 'design' }), null);
  // a deleted / unknown user id is null, never a throw
  assert.equal(await resolveTemplateSeed(host, 'user:nope'), null);
});

test('resolveTemplateSeed: a shipped ref reads the file, then the inline manifest metadata', async () => {
  const host = memHost();
  const calls: string[] = [];
  const fetchShipped = async (toolId: string, tid: string, presetId?: string | null) => {
    calls.push(`${toolId}/${tid}/${presetId ?? ''}`);
    return tid === 'poster' ? { boxes: [] } : null;
  };
  const meta = [{ id: 'inline', name: 'Inline one', values: { a: 1 } }, { id: 'poster', name: 'Poster' }];
  const hit = await resolveTemplateSeed(host, 'design:poster', { templateMeta: meta, fetchShipped });
  assert.deepEqual(hit?.values, { boxes: [] });
  assert.equal(hit?.name, 'Poster');
  assert.deepEqual(calls, ['design/poster/']);
  // file missing → inline fallback
  const fb = await resolveTemplateSeed(host, 'inline', { toolId: 'design', templateMeta: meta, fetchShipped });
  assert.deepEqual(fb?.values, { a: 1 });
  assert.equal(fb?.toolId, 'design');
  // nothing anywhere → null
  assert.equal(await resolveTemplateSeed(host, 'design:ghost', { templateMeta: meta, fetchShipped }), null);
  // a shipped ref for another tool than asked → null without fetching
  calls.length = 0;
  assert.equal(await resolveTemplateSeed(host, 'chart:bars', { toolId: 'design', fetchShipped }), null);
  assert.deepEqual(calls, []);
  // preset id rides through to the reader
  await resolveTemplateSeed(host, 'design:poster', { presetId: 'a4', fetchShipped });
  assert.equal(calls.at(-1), 'design/poster/a4');
});
