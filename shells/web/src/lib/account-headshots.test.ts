// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { encodeCanvasAsset } from '@lolly-tools/core/canvas-asset-v1';
import type { CollabSession, CollabSessionHandle, CollabSessionState } from './collab-session.ts';
import { accountAvatar, mountWorkHeadshots } from './account-headshots.ts';

test('workspace portraits use project capabilities; private pairing and observers do not upload a profile image', async () => {
  const dom = new JSDOM('<body></body>', { url: 'https://lolly.ing/' });
  const doc = dom.window.document, shared = { type: 'raster' as const, source: 'user' as const, id: 'user/team/photo', format: 'png', pin: { version: 'v1' } };
  let uploads = 0, profileReads = 0;
  const published: unknown[] = [];
  let state = { role: 'writer', self: { userId: 'portrait-test', color: '#008657', isSelf: true }, peers: [] } as unknown as CollabSessionState;
  const session = { state: () => state, updateSurface: (value: unknown) => published.push(value), subscribe: (fn: (s: CollabSessionState) => void) => { fn(state); return () => {}; } } as unknown as CollabSession;
  const handle = { admission: 'work-room', self: { userId: 'portrait-test' }, assets: { prepare: async () => { uploads++; return shared; }, resolve: async () => ({ url: 'https://lolly.ing/project-photo.png' }) } } as unknown as CollabSessionHandle;
  const host = { profile: { get: async () => { profileReads++; return { headshot: { type: 'raster', id: 'personal/photo' } }; }, subscribe: () => () => {} }, assets: { get: async () => ({ url: 'https://lolly.ing/local-photo.png' }) } } as unknown as HostV1;
  try {
    mountWorkHeadshots(session, { ...handle, admission: undefined }, host, doc)();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(profileReads, 0, 'private pairing never reads or publishes the account portrait');
    const avatar = accountAvatar(doc, 'portrait-test', 'Photo Owner'); doc.body.append(avatar);
    const stop = mountWorkHeadshots(session, handle, host, doc);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(uploads, 1);
    assert.deepEqual(published, [{ headshot: encodeCanvasAsset(shared) }]);
    assert.ok(avatar.querySelector('img'), 'an existing account placeholder gets its available portrait');
    stop(); uploads = 0; published.length = 0;
    state = { ...state, role: 'observer' };
    const stopObserver = mountWorkHeadshots(session, handle, host, doc);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(uploads, 0); assert.equal(published.length, 0);
    stopObserver();
  } finally { dom.window.close(); }
});
