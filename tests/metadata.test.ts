// SPDX-License-Identifier: MPL-2.0
/**
 * Export provenance assembly tests.
 * Run with: node --test tests/metadata.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildExportMeta } from '../engine/src/metadata.ts';

const hostWith = (profile: Record<string, unknown>): any => ({
  profile: { get: async () => profile },
});

test('buildExportMeta: opted-in profile → author + contact, no copyright', async () => {
  const m = await buildExportMeta(hostWith({
    useDetails: true,
    firstname: 'Ada', lastname: 'Lovelace', email: 'ada@x.com', phone: '+1 555',
  }), { name: 'QR Code' });
  assert.equal(m.software, 'Lolly');
  assert.equal(m.source, 'https://lolly.tools');
  assert.equal(m.tool, 'QR Code');
  assert.equal(m.author, 'Ada Lovelace');
  assert.equal(m.contact, 'ada@x.com · +1 555');
  assert.match(m.description, /Made with https:\/\/lolly\.tools.*QR Code.*by Ada Lovelace/);
  // Provenance only - never assert ownership/licence.
  assert.equal('copyright' in m, false);
});

test('buildExportMeta: manifest id + version → toolId/toolVersion and the tool page as source', async () => {
  const m = await buildExportMeta(hostWith({}), { id: 'qr-code', name: 'QR Code', version: '2.6.0' });
  assert.equal(m.tool, 'QR Code');
  assert.equal(m.toolId, 'qr-code');
  assert.equal(m.toolVersion, '2.6.0');
  // The canonical share form of the tool's own page (engine/src/tool-url.ts) - an
  // identifier, never the inputs. Without an id the root stays (asserted above).
  assert.equal(m.source, 'https://lolly.tools/t/qr-code');
  // Absent fields stay absent (not ''), so a JSON dump of an id-less meta is byte-identical to before.
  const m2 = await buildExportMeta(hostWith({}), { name: 'Chart' });
  assert.equal('toolId' in m2, false);
  assert.equal('toolVersion' in m2, false);
});

test('buildExportMeta: details present but NOT opted in → no personal data embedded', async () => {
  const m = await buildExportMeta(hostWith({
    firstname: 'Ada', lastname: 'Lovelace', email: 'ada@x.com', phone: '+1 555',
  }), { name: 'QR Code' });
  assert.equal(m.author, '');          // opt-in (useDetails) is required
  assert.equal(m.contact, '');
  assert.equal(m.tool, 'QR Code');     // tool / platform attribution still stands
  assert.equal(m.software, 'Lolly');
  assert.equal(m.description, 'Made with https://lolly.tools : QR Code');
});

test('buildExportMeta: empty profile → software-only provenance', async () => {
  const m = await buildExportMeta(hostWith({}), { name: 'Chart' });
  assert.equal(m.author, '');
  assert.equal(m.contact, '');
  assert.equal(m.software, 'Lolly');
});

test('buildExportMeta: never emits a copyright symbol or the word copyright', async () => {
  const m = await buildExportMeta(hostWith({ firstname: 'Grace', lastname: 'Hopper' }), { name: 'Poster' });
  const blob = JSON.stringify(m).toLowerCase();
  assert.equal(blob.includes('copyright'), false);
  assert.equal(blob.includes('©'), false);
});

test('buildExportMeta: missing/throwing profile is tolerated', async () => {
  const m1 = await buildExportMeta({} as any, { id: 'x' });                 // no profile API
  assert.equal(m1.author, '');
  assert.equal(m1.tool, 'x');
  const m2 = await buildExportMeta({ profile: { get: async () => { throw new Error('nope'); } } } as any, { name: 'T' });
  assert.equal(m2.author, '');                                            // swallowed
  assert.equal(m2.software, 'Lolly');
});
