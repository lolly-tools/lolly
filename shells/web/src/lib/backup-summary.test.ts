// SPDX-License-Identifier: MPL-2.0
/**
 * The backup's human summary - what `lolly.txt` says is in the zip.
 *
 * The templates a person saved and the tools they built ride inside `profile.json`, so
 * a backup has always carried them; what plans/226 section 4.7 adds is SAYING so, in
 * the one file someone opens when they want to know what they are holding. The count
 * helper is unit-tested here, and the readme line is asserted against a real exported
 * bundle so the two can never drift apart silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync, strFromU8 } from 'fflate';
import { backupOwnCounts, backupHistoryNote } from './backup-summary.ts';
import { exportBackup } from '../data-transfer.ts';

test('backupOwnCounts counts what the person made, and tolerates a profile without it', () => {
  assert.deepEqual(backupOwnCounts({ userTemplates: [{}, {}, {}], userTools: [{}] }), { templates: 3, userTools: 1 });
  assert.deepEqual(backupOwnCounts({}), { templates: 0, userTools: 0 }, 'a profile that has neither reads as zero');
  assert.deepEqual(backupOwnCounts(null), { templates: 0, userTools: 0 });
  assert.deepEqual(backupOwnCounts({ userTemplates: 'lots', userTools: 7 }), { templates: 0, userTools: 0 }, 'a field that is not a list is not a count');
});

test('backupHistoryNote still reports only the parts that are present', () => {
  assert.equal(backupHistoryNote({}), '', 'nothing to say, nothing said');
  assert.match(backupHistoryNote({ revisions: 2 }), /2/);
});

function memHost(profile: Record<string, unknown>) {
  return {
    profile: { get: async () => profile, set: async () => {} },
    state: { list: async () => [], load: async () => null, save: async () => {} },
    assets: { _exportUserAssets: async () => [], _importUserAsset: async () => {} },
  };
}
const memStorage = () => {
  const map = new Map<string, string>();
  return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); } };
};

async function readmeOf(profile: Record<string, unknown>): Promise<string> {
  const { blob } = await exportBackup({
    host: memHost(profile) as unknown as Parameters<typeof exportBackup>[0]['host'],
    storage: memStorage(),
  });
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  return strFromU8(files['lolly.txt']!);
}

test('lolly.txt counts the templates and the tools the person made', async () => {
  const readme = await readmeOf({
    firstname: 'Ada',
    userTemplates: [{ id: 'a' }, { id: 'b' }],
    userTools: [{ id: 'mine' }],
  });
  assert.match(readme, /Templates {13}2/, 'the templates line reads its count');
  assert.match(readme, /Tools you made {8}1/);
  // The lines that were already there keep their place and their order.
  const order = ['Saved sessions', 'Preferences', 'File batch manifests', 'Templates', 'Tools you made'];
  let at = -1;
  for (const label of order) {
    const next = readme.indexOf(label);
    assert.ok(next > at, `${label} follows the line before it`);
    at = next;
  }
});

test('lolly.txt says zero rather than going quiet when nothing was made', async () => {
  const readme = await readmeOf({ firstname: 'Ada' });
  assert.match(readme, /Templates {13}0/);
  assert.match(readme, /Tools you made {8}0/);
});
