// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInputModel } from '../../../../engine/src/inputs.ts';
import { savedSessionEmbedUrl } from './picker-session-embed.ts';

test('saved session image URLs retain public values and exclude personal inputs', () => {
  const model = buildInputModel({ inputs: [
    { id: 'name', type: 'text', bindToProfile: 'firstname', default: '' },
    { id: 'title', type: 'text', default: '' },
    { id: 'picture', type: 'asset', default: null },
    { id: 'words', type: 'longtext', sharePrivacy: 'personal', default: '' },
  ] }, { initial: { title: 'Public title', words: 'Private words', picture: { id: 'user/upload.png', type: 'image' } }, profile: { firstname: 'Private name' } });
  const url = new URL(savedSessionEmbedUrl('design', model, 'png')!);
  assert.equal(url.pathname, '/tool/design.png');
  assert.equal(url.searchParams.get('title'), 'Public title');
  assert.equal(url.searchParams.get('picture'), 'user/upload.png', 'same-device rendering retains uploaded assets');
  assert.equal(url.searchParams.has('name'), false);
  assert.equal(url.searchParams.has('words'), false);
  assert.equal(model[0]!.value, 'Private name', 'preparing an embed leaves the session intact');
  assert.equal(savedSessionEmbedUrl('../invalid', model, 'png'), null);
  assert.equal(new URL(savedSessionEmbedUrl('design', [], 'mp4')!).pathname, '/tool/design.svg');
});
