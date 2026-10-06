// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAuthorDeclaration, withAuthorDeclaration } from './asset-authorship.ts';

const at = '2026-10-06T12:00:00.000Z';

test('authorship declarations preserve source credits, AI origins and credential metadata', () => {
  const source = {
    rights: { works: [{ id: 'source', creators: [{ name: 'Original creator' }], rights: [] }] },
    aiGenerated: 'partial',
    aiOriginsDeclared: true,
    credential: 'preserved-store',
    attribution: 'Original credit',
  };
  const claimed = withAuthorDeclaration(source, '  Andy  ', at);
  assert.deepEqual(readAuthorDeclaration(claimed), { name: 'Andy', assertedBy: 'user', declaredAt: at });
  assert.deepEqual(withAuthorDeclaration(claimed, null, at), source);
  assert.equal(source.rights.works[0]?.creators[0]?.name, 'Original creator');
  assert.ok(!('authorDeclaration' in source));
});

test('changing the declared name preserves unrelated metadata and records the new date', () => {
  const original = withAuthorDeclaration({ name: 'Artwork', tags: ['photo'] }, 'Andy', at);
  const later = '2026-10-07T12:00:00.000Z';
  const edited = withAuthorDeclaration(original, 'A. Person', later);
  assert.equal(readAuthorDeclaration(edited)?.name, 'A. Person');
  assert.equal(readAuthorDeclaration(edited)?.declaredAt, later);
  assert.equal(readAuthorDeclaration(original)?.name, 'Andy');
  assert.deepEqual(edited.tags, ['photo']);
});

test('untrusted or incomplete author records never become a self-declaration', () => {
  for (const value of [null, [], 'Andy', { name: 'Andy' }, { name: 'Andy', assertedBy: 'credential', declaredAt: at },
    { name: '', assertedBy: 'user', declaredAt: at }, { name: 'Andy', assertedBy: 'user', declaredAt: 'invalid' },
    { name: 'A'.repeat(201), assertedBy: 'user', declaredAt: at }]) {
    assert.equal(readAuthorDeclaration({ authorDeclaration: value }), null);
  }
  assert.throws(() => withAuthorDeclaration({}, '  ', at));
  assert.throws(() => withAuthorDeclaration({}, 'A'.repeat(201), at));
});
