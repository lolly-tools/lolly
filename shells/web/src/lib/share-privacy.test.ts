// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInputModel } from '../../../../engine/src/inputs.ts';
import { serializeUrlState, parseUrlState } from '../../../../engine/src/url-mode.ts';
import { personalShareFields, partitionShareParts, shareUrlState } from './share-privacy.ts';
import { encodeAddressModelParam, encodeModelParam } from './url-budget.ts';

const manifest = { inputs: [
  { id: 'name', type: 'text' as const, label: 'Name', bindToProfile: 'firstname', default: '' },
  { id: 'words', urlKey: 'wrd', type: 'longtext' as const, sharePrivacy: 'personal' as const, default: '' },
  { id: 'title', type: 'text' as const, default: '' },
] };
test('generated shares and address updates omit personal fields without changing explicit URL input', () => {
  const model = buildInputModel(manifest, { initial: { words: 'fixture words', title: 'fixture title' }, profile: { firstname: 'Fixture Name' } });
  const query = new URLSearchParams(shareUrlState(model));
  assert.equal(query.get('title'), 'fixture title');
  assert.equal(query.has('name'), false); assert.equal(query.has('words'), false);
  assert.equal(encodeModelParam(model[0]!)[0]?.status, 'dropped-personal');
  assert.deepEqual(encodeAddressModelParam(model[0]!), []);
  const explicit = serializeUrlState(model);
  assert.equal(parseUrlState(new URLSearchParams(explicit), manifest).values.name, 'Fixture Name');
  assert.equal(parseUrlState(new URLSearchParams(explicit), manifest).values.words, 'fixture words');
  assert.deepEqual(personalShareFields(model).map(field => field.id), ['name', 'words']);
  assert.equal(model[0]!.value, 'Fixture Name');
});
test('raw share parts separate profile aliases, vector children and token restoration metadata', () => {
  const parts = ['title=fixture', 'n=Fixture', 'name.first=Fixture', '_restore.n=token', '_ref.name=token'];
  const result = partitionShareParts(parts, [{ id: 'name', urlKey: 'n', bindToProfile: 'firstname' }]);
  assert.deepEqual(result.publicParts, ['title=fixture']);
  assert.deepEqual(result.personal[0]?.parts, parts.slice(1));
});
