// SPDX-License-Identifier: MPL-2.0
/**
 * The licence label one asset carries (plan 302 PR 1): a short form for a
 * narrow list cell and the full name the details sheet prints, both read from
 * the same declaration through the engine's reviewed profiles.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/asset-rights.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { licenceLabel } from './asset-rights.ts';

const short = (license: string): string | undefined => licenceLabel({ license })?.short;

test('no declaration is no label, never an empty one', () => {
  assert.equal(licenceLabel(undefined), null);
  assert.equal(licenceLabel({}), null);
  assert.equal(licenceLabel({ license: '   ' }), null);
  assert.equal(licenceLabel({ rights: { works: [{ id: 'w', creators: [], rights: [{ declaration: 'CC0-1.0', status: 'missing' }] }] } }), null,
    'evidence that says the field was looked for and found empty is not a declaration');
});

test('the short form is the shorter of the licence name and its identifier, the name on a tie', () => {
  assert.equal(short('CC0-1.0'), 'CC0 1.0');
  assert.equal(short('cc0-1.0'), 'CC0 1.0');
  assert.equal(short('cc-by-4.0'), 'CC BY 4.0');
  assert.equal(short('CC BY-SA 4.0'), 'CC BY-SA 4.0');
  assert.equal(short('CC BY-NC 4.0'), 'CC BY-NC 4.0');
  assert.equal(short('CC-PDDC'), 'CC-PDDC');
  assert.equal(short('Apache-2.0'), 'Apache-2.0');
  assert.equal(short('MIT'), 'MIT');
  assert.equal(short('OFL-1.1'), 'OFL-1.1');
  assert.equal(short('CC BY 3.0'), 'CC-BY-3.0', 'a version this build has not reviewed keeps its own number');
});

test('the full form is the name the details sheet prints, with the declaration kept beside it', () => {
  assert.deepEqual(
    (({ short: s, full, declared }) => ({ short: s, full, declared }))(licenceLabel({ license: 'CC-PDDC' })!),
    { short: 'CC-PDDC', full: 'Creative Commons Public Domain Dedication and Certification', declared: 'CC-PDDC' },
  );
  assert.equal(licenceLabel({ license: 'cc-by-4.0' })?.declared, 'cc-by-4.0');
});

test('a declaration nothing recognises is shown as written, and is not reviewed', () => {
  const label = licenceLabel({ license: 'Internal use only' });
  assert.deepEqual(label, { short: 'Internal use only', full: 'Internal use only', declared: 'Internal use only', profile: null });
});

test('the reviewed profile rides along, so a caller can say what using the work asks', () => {
  assert.equal(licenceLabel({ license: 'CC BY-SA 4.0' })?.profile?.shareAlike, true);
  assert.equal(licenceLabel({ license: 'CC BY-NC 4.0' })?.profile?.reviewed, false, 'recognised, conditions recorded, not interpreted');
  assert.equal(licenceLabel({ license: 'LicenseRef-acme-brand' })?.profile, null);
});

test('the legacy licence string wins over the structured record, as everywhere else', () => {
  const label = licenceLabel({
    license: 'CC0-1.0',
    rights: { works: [{ id: 'w', creators: [], rights: [{ declaration: 'CC-BY-4.0', status: 'parsed' }] }] },
  });
  assert.equal(label?.short, 'CC0 1.0');
});
