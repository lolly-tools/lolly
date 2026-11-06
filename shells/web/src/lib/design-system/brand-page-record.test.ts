// SPDX-License-Identifier: MPL-2.0
/** The per-brand setting behind "Record the page address in exports" (plan 351 B5). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readBrandPageSetting, writeBrandPageSetting } from './brand-page-record.ts';
import { readRecordedBrandPage } from '../../../../../engine/src/brand-page-address.ts';

const PAGE = 'https://acme.example/brand/acme/';

function fakeHost(start: unknown, locked = false) {
  let head = start;
  const writes: unknown[] = [];
  return {
    get head() { return head; }, writes,
    tokens: { raw: async () => head, isLocked: async () => locked, bust: () => {} },
    assets: {
      _uploadUserAsset: async (row: { blob: Blob }) => { head = JSON.parse(await row.blob.text()); writes.push(head); },
      _getUserRecord: async () => null,
    },
  };
}
type Host = Parameters<typeof writeBrandPageSetting>[0];

test('off until asked for, and each change is one write to the head', async () => {
  const doc = { color: { a: { $type: 'color', $value: '#123456' } } };
  const host = fakeHost(doc);
  assert.deepEqual(await readBrandPageSetting(host as unknown as Host), { address: null, locked: false });
  assert.equal(host.writes.length, 0, 'reading the setting writes nothing');
  await writeBrandPageSetting(host as unknown as Host, PAGE, 'Acme');
  assert.equal(readRecordedBrandPage(host.head), PAGE);
  assert.equal((await readBrandPageSetting(host as unknown as Host)).address, PAGE);
  await writeBrandPageSetting(host as unknown as Host, null, 'Acme');
  assert.equal(JSON.stringify(host.head), JSON.stringify(doc), 'off leaves the document as it was');
  assert.equal(host.writes.length, 2);
});

test('an address that cannot be recorded is refused before anything is written', async () => {
  const host = fakeHost({});
  for (const bad of ['http://acme.example/', 'javascript:alert(1)']) {
    await assert.rejects(writeBrandPageSetting(host as unknown as Host, bad, 'Acme'), /plain https address/);
  }
  assert.equal(host.writes.length, 0);
});

test('a locked system reports that, so the sheet offers no switch', async () => {
  assert.equal((await readBrandPageSetting(fakeHost({}, true) as unknown as Host)).locked, true);
});
