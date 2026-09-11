// SPDX-License-Identifier: MPL-2.0
/**
 * lib/sync-config.ts + the pure/gating bits of lib/sync-service.ts (plans/138 B1).
 * Config defaults + merge + the SyncState view; provider availability gated on a
 * connected credential; checkNewer short-circuits when sync is off; markSyncDirty
 * is a safe no-op before the scheduler is armed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  getSyncConfig, saveSyncConfig, syncStateOf, resetSyncConfigForTests,
} from './sync-config.ts';
import { availableSyncProviders, checkNewer, markSyncDirty, resetSyncServiceForTests } from './sync-service.ts';
import { connectS3, type S3Config } from './s3-send.ts';
import { connectWebdav, type WebdavConfig } from './nextcloud-send.ts';
import { resetConnectionsForTests } from './provider-connections.ts';

const S3: S3Config = {
  endpoint: 'https://s3.example.com', region: 'us-east-1', bucket: 'b',
  accessKeyId: 'k', secretAccessKey: 's', prefix: '',
};

test('config: defaults, merge, and the SyncState view', async () => {
  resetSyncConfigForTests();
  const def = await getSyncConfig();
  assert.deepEqual(def, { enabled: false, providerKind: '', lastSyncedRev: null, lastSyncedAt: null });

  await saveSyncConfig({ enabled: true, providerKind: 's3', passphrase: 'pw' });
  const one = await getSyncConfig();
  assert.equal(one.enabled, true);
  assert.equal(one.providerKind, 's3');
  assert.equal(one.passphrase, 'pw');

  // Merge, not replace: setting the rev leaves the rest intact.
  await saveSyncConfig({ lastSyncedRev: 'r3', lastSyncedAt: '2025-01-01T00:00:00Z' });
  const two = await getSyncConfig();
  assert.equal(two.providerKind, 's3', 'earlier fields survive a partial save');
  assert.deepEqual(syncStateOf(two), { lastSyncedRev: 'r3', lastSyncedAt: '2025-01-01T00:00:00Z' });
});

const DAV: WebdavConfig = { baseUrl: 'https://cloud.example.org', username: 'ada', appPassword: 'pw', folder: 'Lolly' };

test('availableSyncProviders reflects connected credentials', async () => {
  resetConnectionsForTests();
  assert.deepEqual(availableSyncProviders(), [], 'nothing connected → no sync providers');
  await connectS3(S3);
  assert.deepEqual(availableSyncProviders(), [{ kind: 's3', label: 'S3 bucket' }]);
  await connectWebdav(DAV);
  assert.deepEqual(
    availableSyncProviders().map((p) => p.kind).sort(),
    ['s3', 'webdav'],
    'both connected sync providers are offered',
  );
});

test('checkNewer is a no-op when no provider is configured (no network touched)', async () => {
  resetSyncConfigForTests();
  await saveSyncConfig({ enabled: true, providerKind: '' });
  assert.deepEqual(await checkNewer(), { hasNewer: false, meta: null });
});

test('markSyncDirty is safe before the scheduler is armed', () => {
  resetSyncServiceForTests();
  assert.doesNotThrow(() => markSyncDirty());
});
