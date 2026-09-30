// SPDX-License-Identifier: MPL-2.0
/**
 * lib/sync-changes.ts (plans/138 Tier D): the bridge reports every write the
 * person makes, a profile write that changes nothing is not a change, a record
 * changed in place before set() is, and an apply's own writes stay quiet.
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  trackHostChanges, onLocalChange, noteLocalChange, localChangeSeq, withoutLocalChanges, resetSyncChangesForTests,
} from './sync-changes.ts';

beforeEach(() => { resetSyncChangesForTests(); });

function fakeHost() {
  let profile: Record<string, unknown> = { name: 'Ada' };
  let active = 'one';
  const calls: string[] = [];
  return {
    calls,
    host: {
      state: {
        async save(slot: string) { calls.push(`save:${slot}`); },
        async delete(slot: string) { calls.push(`delete:${slot}`); },
        async load() { return null; },
      },
      profile: {
        async get() { return profile; },
        async set(next: Record<string, unknown>) { profile = next; },
      },
      assets: {
        async _uploadUserAsset() {}, async _deleteUserAsset() {}, async get() { return null; },
      },
      designSystems: {
        async put() {}, async remove() {},
        async activeId() { return active; },
        async setActive(id: string) { active = id; },
      },
    },
  };
}

test('writes report a change; reads do not; results pass through', async () => {
  const { host, calls } = fakeHost();
  trackHostChanges(host);
  let seen = 0;
  onLocalChange(() => { seen++; });

  await host.state.save('s1');
  await host.state.delete('s1');
  await host.state.load();
  await host.assets._uploadUserAsset();
  await host.assets._deleteUserAsset();
  await host.assets.get();
  await host.designSystems.put();
  await host.designSystems.remove();
  assert.equal(seen, 6);
  assert.deepEqual(calls, ['save:s1', 'delete:s1'], 'the original methods still run');
});

// plans/277 P7 review S3: a backup import writes restored sessions through
// state.restore, and a Trash move marks an upload; both are changes to push.
test('an import written through state.restore and a Trash mark on an upload report a change', async () => {
  const calls: string[] = [];
  const host = {
    state: { async restore(slot: string) { calls.push(`restore:${slot}`); } },
    assets: { async _setUserAssetTrashed(id: string) { calls.push(`trash:${id}`); return true; } },
  };
  trackHostChanges(host);
  const before = localChangeSeq();
  await host.state.restore('qr-code:1');
  assert.equal(localChangeSeq(), before + 1);
  assert.equal(await host.assets._setUserAssetTrashed('user/a'), true, 'the result passes through');
  assert.equal(localChangeSeq(), before + 2);
  assert.deepEqual(calls, ['restore:qr-code:1', 'trash:user/a']);
});

test('profile and active design system report only real changes', async () => {
  const { host } = fakeHost();
  trackHostChanges(host);
  let seen = 0;
  onLocalChange(() => { seen++; });

  await host.profile.set({ name: 'Ada' });               // unchanged
  assert.equal(seen, 0);
  const cached = await host.profile.get();
  cached.name = 'Grace';                                 // changed in place, then set
  await host.profile.set(cached);
  assert.equal(seen, 1);
  await host.profile.set(cached);                        // same again
  assert.equal(seen, 1);

  await host.designSystems.setActive('one');             // already active
  assert.equal(seen, 1);
  await host.designSystems.setActive('two');
  assert.equal(seen, 2);
});

test('an apply’s own writes are quiet; a failed write reports nothing', async () => {
  const { host } = fakeHost();
  host.state.save = async () => { throw new Error('quota'); };
  trackHostChanges(host);
  let seen = 0;
  onLocalChange(() => { seen++; });

  await withoutLocalChanges(async () => { await host.state.delete('x'); });
  assert.equal(seen, 0);
  await assert.rejects(() => host.state.save('x'), /quota/);
  assert.equal(seen, 0);
});

test('a change made before anyone listens is delivered once on subscribe', () => {
  noteLocalChange();
  const before = localChangeSeq();
  let seen = 0;
  onLocalChange(() => { seen++; });
  assert.equal(seen, 1);
  assert.equal(localChangeSeq(), before);
});

test('atomic brand adoption and recovery report one change each after success', async () => {
  const host = { brandAdoption: {
    async capture() { return {}; }, async prepare() { return {}; },
    async commit(fail = false) { if (fail) throw new Error('conflict'); }, async restore() {},
  } };
  trackHostChanges(host);
  let seen = 0;
  onLocalChange(() => { seen++; });
  await host.brandAdoption.capture(); await host.brandAdoption.prepare();
  assert.equal(seen, 0);
  await host.brandAdoption.commit(); await host.brandAdoption.restore();
  assert.equal(seen, 2);
  await assert.rejects(host.brandAdoption.commit(true), /conflict/);
  assert.equal(seen, 2);
});
