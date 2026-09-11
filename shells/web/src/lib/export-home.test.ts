// SPDX-License-Identifier: MPL-2.0
/**
 * lib/export-home.ts (plans/138 A1) - the standing export-home auto-send. Fires
 * only when profile.exportHome names a currently-available storage kind, routes
 * through the same send-target registry, and reports through the job registry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { autoSendToExportHome, isExportHomeKind, EXPORT_HOME_KINDS } from './export-home.ts';
import { registerSendTarget, unregisterSendTarget, type SendTarget } from './send-target.ts';
import { jobsSnapshot, __resetJobsForTest } from './jobs.ts';

const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
const hostWith = (exportHome?: string) => ({ profile: { get: async () => ({ exportHome }) } });

function fakeTarget(kind: string, over: Partial<SendTarget> = {}): { target: SendTarget; sent: () => number } {
  let calls = 0;
  const target: SendTarget = {
    kind, label: kind, available: () => true,
    send: async () => { calls++; return { url: 'https://cloud/x.png', label: `Saved to ${kind}` }; },
    ...over,
  };
  return { target, sent: () => calls };
}

test('kind guard covers exactly the storage clouds, not the publish tier', () => {
  assert.deepEqual([...EXPORT_HOME_KINDS], ['gdrive', 'dropbox', 'o365', 's3', 'webdav']);
  assert.ok(isExportHomeKind('dropbox'));
  assert.ok(!isExportHomeKind('mastodon'));
  assert.ok(!isExportHomeKind(undefined));
});

test('no home set → no send, no job', async () => {
  __resetJobsForTest();
  const { target, sent } = fakeTarget('s3');
  registerSendTarget(target);
  try {
    await autoSendToExportHome(hostWith(undefined), { blob, format: 'png', name: 'x' });
    assert.equal(sent(), 0);
    assert.equal(jobsSnapshot().length, 0);
  } finally { unregisterSendTarget('s3'); }
});

test('home set + available → sends and finishes the job with the outcome', async () => {
  __resetJobsForTest();
  const { target, sent } = fakeTarget('s3');
  registerSendTarget(target);
  try {
    await autoSendToExportHome(hostWith('s3'), { blob, format: 'png', name: 'x' });
    assert.equal(sent(), 1);
    const job = jobsSnapshot().at(-1)!;
    assert.equal(job.status, 'done');
    assert.deepEqual(job.result, { url: 'https://cloud/x.png', label: 'Saved to s3' });
  } finally { unregisterSendTarget('s3'); }
});

test('home names a provider not connected on this device → silent no-op', async () => {
  __resetJobsForTest();
  await autoSendToExportHome(hostWith('dropbox'), { blob, format: 'png', name: 'x' });
  assert.equal(jobsSnapshot().length, 0);
});

test('home target that does not accept this format → no send', async () => {
  __resetJobsForTest();
  const { target, sent } = fakeTarget('s3', { formats: ['svg'] });
  registerSendTarget(target);
  try {
    await autoSendToExportHome(hostWith('s3'), { blob, format: 'png', name: 'x' });
    assert.equal(sent(), 0);
    assert.equal(jobsSnapshot().length, 0);
  } finally { unregisterSendTarget('s3'); }
});

test('a send failure fails the job, never throws to the caller', async () => {
  __resetJobsForTest();
  const { target } = fakeTarget('s3', { send: async () => { throw new Error('bucket denied'); } });
  registerSendTarget(target);
  try {
    await autoSendToExportHome(hostWith('s3'), { blob, format: 'png', name: 'x' });
    const job = jobsSnapshot().at(-1)!;
    assert.equal(job.status, 'failed');
    assert.equal(job.error, 'bucket denied');
  } finally { unregisterSendTarget('s3'); }
});
