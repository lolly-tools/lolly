// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { featuredStartIndex, recordFeaturedActivity, recordFeaturedRoute, recordNewFavourites } from './featured-activity.ts';

test('latest use or new star centres the next visit, with removed items skipped and collections independent', t => {
  const dom = new JSDOM('', { url: 'https://lolly.test' });
  Object.assign(globalThis, { localStorage: dom.window.localStorage });
  t.after(() => dom.window.close());
  const ids = ['qr', 'logo', 'badge'];
  assert.equal(featuredStartIndex('tools', ids), 0);
  assert.equal(featuredStartIndex('tools', ids, ['qr', 'logo']), 1);
  recordFeaturedRoute({ name: 'tool', toolId: 'logo', params: 'slot=saved-logo' });
  assert.equal(featuredStartIndex('tools', ids), 1);
  assert.equal(featuredStartIndex('projects', ['other', 'saved-logo']), 1);
  recordNewFavourites('tools', ['logo'], new Set(['logo', 'badge']));
  assert.equal(featuredStartIndex('tools', ids), 2);
  recordFeaturedActivity('assets', 'qr');
  assert.equal(featuredStartIndex('tools', ids), 2, 'asset identities cannot move tool focus');
  assert.equal(featuredStartIndex('tools', ['qr', 'logo']), 1, 'deleted/hidden favourite is skipped');
  recordNewFavourites('tools', ['logo', 'badge'], new Set(['badge']));
  recordFeaturedRoute({ name: 'tool', toolId: 'qr' });
  assert.equal(featuredStartIndex('tools', ids), 0, 'opening after starring takes precedence');
  recordFeaturedRoute({ name: 'script' });
  assert.equal(featuredStartIndex('tools', ['view:compare', 'view:script-audio']), 1);
  recordFeaturedRoute({ name: 'projects', folderId: 'folder' });
  assert.equal(featuredStartIndex('projects', ['saved-logo', 'folder']), 1);
});

test('corrupt or blocked storage falls back to the favourite order', t => {
  const dom = new JSDOM('', { url: 'https://lolly.test' });
  Object.assign(globalThis, { localStorage: dom.window.localStorage });
  t.after(() => dom.window.close());
  localStorage.setItem('lolly-featured-activity:tools', '{bad');
  assert.equal(featuredStartIndex('tools', ['a', 'b'], ['b']), 1);
  t.mock.method(localStorage, 'setItem', () => { throw new Error('quota'); });
  assert.doesNotThrow(() => recordFeaturedActivity('tools', 'a'));
});
