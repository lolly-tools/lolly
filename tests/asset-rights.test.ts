// SPDX-License-Identifier: MPL-2.0
/**
 * The `.lolly` credits text, `packCreditsText` in `engine/src/asset-rights.ts`.
 *
 * It moved down from the web shell (plans/82 M4) so a `.lolly` pack and a Lolly Work
 * collection ZIP print one text from one function. These cases moved with it from
 * `shells/web/src/views/lolly-vehicle-rights.test.ts`, unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packCreditsText } from '../engine/src/asset-rights.ts';
import * as engine from '../engine/src/index.ts';

test('the credits file lists what travelled, what did not, and the reason for each', () => {
  const text = packCreditsText(
    [{ label: 'Lorikeet', id: 'lolly/photo/lorikeet', path: 'assets/catalog/lorikeet.jpg', licence: 'CC BY 4.0', credit: 'Lorikeet by A. Person, CC BY 4.0.', notices: ['Keep this notice.'] }],
    [{ label: 'Brand mark', id: 'suse/logo/primary', reason: 'licence not recorded' }],
  );
  assert.ok(text.includes('Travelled with this file (1):'));
  assert.ok(text.includes('assets/catalog/lorikeet.jpg'), 'each carried work names its file in the zip');
  assert.ok(text.includes('licence: CC BY 4.0'));
  assert.ok(text.includes('credit:  Lorikeet by A. Person, CC BY 4.0.'));
  assert.ok(text.includes('notice:  Keep this notice.'));
  assert.ok(text.includes('Held back (1)'));
  assert.ok(text.includes('reason:  licence not recorded'));
  assert.ok(text.includes('licence: not recorded'), 'a held-back work with no licence says so');
  assert.ok(text.includes('held by: nothing recorded about passing these bytes on'));
});

test('the credits file tells a deployment rule apart from a licence condition', () => {
  // Plan 253 section 11: a catalog lock must not be misrepresented as an extra
  // copyright term on open material.
  const text = packCreditsText([], [
    { label: 'Brand mark', id: 'suse/logo/primary', reason: 'this brand pack is authoritative on this device', kind: 'policy', licence: 'CC BY 4.0' },
    { label: 'Stock photo', id: 'x/stock', reason: 'CC BY-ND 4.0 does not record permission to pass on the source file', kind: 'licence', licence: 'CC BY-ND 4.0' },
  ]);
  assert.ok(text.includes('held by: deployment policy'));
  assert.ok(text.includes('held by: licence condition'));
});

test('the credits file records an inclusion the sender chose, as their choice', () => {
  const text = packCreditsText(
    [{ label: 'Brand mark', id: 'suse/logo/primary', path: 'assets/catalog/mark.svg', includedByChoice: true }],
    [],
  );
  assert.ok(text.includes('included by the sender, who chose to carry bytes held back by default'));
  assert.ok(!text.includes('Held back'), 'nothing is listed as held back when nothing was');
});

test('no catalog work at all writes no credits file', () => {
  assert.equal(packCreditsText([], []), '');
});

test('the credits file is a record, never a clearance', () => {
  const text = packCreditsText([{ label: 'x', id: 'x', path: 'p' }], [{ label: 'y', id: 'y', reason: 'licence not recorded' }]);
  for (const phrase of ['rights cleared', 'legally safe', 'fully cleared', 'copyright verified', 'royalty-free']) {
    assert.ok(!text.toLowerCase().includes(phrase), `never says "${phrase}"`);
  }
});

// ── Round trip: the credits file is a real part of a real file ────────────────

test('the engine barrel carries the credits text and the rights reader', () => {
  assert.equal(engine.packCreditsText, packCreditsText);
  for (const name of ['redistribution', 'ownerPublished', 'assetLicenceDeclaration', 'assetRightsNotices', 'readAssetRightsRecord', 'checkCompanionReadback']) {
    assert.equal(typeof (engine as Record<string, unknown>)[name], 'function', name);
  }
  assert.equal(engine.OWNER_PUBLISHED, 'Owner-published, not an open licence');
});
