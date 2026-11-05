// SPDX-License-Identifier: MPL-2.0
/**
 * The versioned licence table (plan 253): every spelling in this tree reaches
 * one canonical identifier, the declaration itself is never rewritten, an
 * unknown declaration stays unknown, a LicenseRef stays data, and each reviewed
 * profile states the rules its citation supports.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  RIGHTS_RULES_VERSION,
  licenceDisplayName,
  licenceProfile,
  licenceProfiles,
  normaliseLicence,
  publicLocator,
  readLicenceExpression,
  roleObligation,
} from '../engine/src/rights-profiles.ts';

test('the rules version is pinned and every profile records its own version and citation', () => {
  assert.equal(RIGHTS_RULES_VERSION, 'rights-rules-2026-11-05.1');
  const profiles = licenceProfiles();
  assert.deepEqual([...profiles].map((p) => p.id).sort(), profiles.map((p) => p.id), 'profiles come back sorted by id');
  for (const profile of profiles) {
    assert.ok(profile.profileVersion.length > 0, `${profile.id} has a profile version`);
    assert.ok(profile.citation.length > 0, `${profile.id} cites its source`);
    assert.ok(profile.url.startsWith('https://'), `${profile.id} links its text`);
  }
  assert.deepEqual(profiles.filter((p) => p.reviewed).map((p) => p.id).sort(), [
    'Apache-2.0',
    'CC-BY-4.0',
    'CC-BY-SA-4.0',
    'CC-PDDC',
    'CC0-1.0',
    'ISC',
    'MIT',
    'OFL-1.1',
  ]);
});

test('every spelling found in this tree reaches one identifier, with the original kept', () => {
  const cases: [string, string][] = [
    ['cc-by-4.0', 'CC-BY-4.0'],
    ['CC BY 4.0', 'CC-BY-4.0'],
    ['CC-BY-4.0', 'CC-BY-4.0'],
    ['  cc-by-4.0  ', 'CC-BY-4.0'],
    ['cc0-1.0', 'CC0-1.0'],
    ['CC0', 'CC0-1.0'],
    ['CC0-1.0', 'CC0-1.0'],
    ['CC-PDDC', 'CC-PDDC'],
    ['Apache-2.0', 'Apache-2.0'],
    ['Apache 2.0', 'Apache-2.0'],
    ['MIT', 'MIT'],
    ['ISC', 'ISC'],
    ['isc license', 'ISC'],
    ['OFL-1.1', 'OFL-1.1'],
    ['OFL', 'OFL-1.1'],
    ['CC-BY-SA-4.0', 'CC-BY-SA-4.0'],
    ['CC BY-SA 4.0', 'CC-BY-SA-4.0'],
    ['CC BY-NC 4.0', 'CC-BY-NC-4.0'],
    ['CC-BY-ND-4.0', 'CC-BY-ND-4.0'],
    ['CC BY-NC-SA 4.0', 'CC-BY-NC-SA-4.0'],
    ['CC-BY-NC-ND-4.0', 'CC-BY-NC-ND-4.0'],
  ];
  for (const [text, id] of cases) {
    const read = normaliseLicence(text);
    assert.equal(read.id, id, text);
    assert.equal(read.original, text, 'the declaration as supplied is preserved');
  }
});

test('the reviewed identifiers carry their version, their link and reviewed: true', () => {
  const by = normaliseLicence('cc-by-4.0');
  assert.equal(by.reviewed, true);
  assert.equal(by.version, '4.0');
  assert.equal(by.url, 'https://creativecommons.org/licenses/by/4.0/');
  assert.equal(normaliseLicence('MIT').reviewed, true);
  assert.equal(normaliseLicence('CC BY-NC 4.0').reviewed, false, 'NonCommercial is recognised, not reviewed');
  assert.deepEqual(licenceProfile('CC-BY-NC-4.0')?.conditions, ['Attribution', 'NonCommercial']);
});

test('a version this rules set has not reviewed keeps its own version', () => {
  const three = normaliseLicence('CC BY 3.0');
  assert.equal(three.id, 'CC-BY-3.0', 'never upgraded to 4.0 because the chooser prefers it');
  assert.equal(three.version, '3.0');
  assert.equal(three.reviewed, false);
  assert.equal(licenceProfile('CC-BY-3.0'), null);
});

test('LicenseRef is data, and an unreadable declaration stays unparsed', () => {
  const ref = normaliseLicence('LicenseRef-acme-internal');
  assert.equal(ref.id, 'LicenseRef-acme-internal');
  assert.equal(ref.reviewed, false);
  assert.equal(ref.status, undefined, 'a reference is recognised, not an error');
  const unknown = normaliseLicence('see the website');
  assert.deepEqual(unknown, { id: null, original: 'see the website', reviewed: false, status: 'unparsed' });
  assert.deepEqual(normaliseLicence(''), { id: null, original: '', reviewed: false, status: 'unparsed' });
});

test('an OR is a choice with nothing selected, an AND is cumulative, anything else is one identifier', () => {
  const choice = readLicenceExpression('MIT OR Apache-2.0');
  assert.equal(choice.operator, 'or');
  assert.deepEqual(choice.terms.map((term) => term.id), ['MIT', 'Apache-2.0']);
  assert.equal(choice.selected, null, 'the reader never picks an alternative');

  const both = readLicenceExpression('OFL-1.1 AND Apache-2.0');
  assert.equal(both.operator, 'and');
  assert.deepEqual(both.terms.map((term) => term.id), ['OFL-1.1', 'Apache-2.0']);

  const mixed = readLicenceExpression('(MIT OR Apache-2.0) AND CC-BY-4.0');
  assert.equal(mixed.operator, 'single');
  assert.equal(mixed.terms[0]?.id, null, 'a mixed expression is never flattened to a most-restrictive label');

  const plain = readLicenceExpression('CC-BY-4.0');
  assert.equal(plain.operator, 'single');
  assert.deepEqual(plain.terms.map((term) => term.id), ['CC-BY-4.0']);
});

test('the reviewed rules match their citations', () => {
  // CC BY 4.0 section 3(a): the credit parts, and modification indicated.
  const by = licenceProfile('CC-BY-4.0')!;
  assert.equal(by.obligation, 'attribution');
  assert.deepEqual(by.attribution, { creator: true, title: true, copyrightNotice: true, licenceNameAndLink: true, sourceLink: true, modificationIndication: true });
  assert.equal(by.shareAlike, false);
  assert.deepEqual(by.limits, [], 'section 2(a)(1) permits any purpose, so nothing is forbidden');

  // CC BY-SA 4.0 section 3(b)(1): the adapter licence, from the CC list as data.
  // The published list of BY-SA Compatible Licenses names the Free Art License
  // 1.3 (approved 2014-10-21) and the GNU GPL v3 (approved 2015-10-08, one way
  // only), and both are carried beside the same-elements later-version rule.
  const sa = licenceProfile('CC-BY-SA-4.0')!;
  assert.equal(sa.shareAlike, true);
  assert.deepEqual(sa.compatibleOutputLicences.map((entry) => entry.id), ['CC-BY-SA-4.0', 'FAL-1.3', 'GPL-3.0-or-later']);
  assert.equal(sa.compatibleOutputLicences.find((entry) => entry.id === 'FAL-1.3')?.approved, '2014-10-21');
  const gpl = sa.compatibleOutputLicences.find((entry) => entry.id === 'GPL-3.0-or-later');
  assert.equal(gpl?.approved, '2015-10-08');
  assert.equal(gpl?.oneWay, true, 'compatibility with the GPLv3 runs one way only');
  for (const entry of sa.compatibleOutputLicences) {
    assert.ok(entry.name.length > 0, `${entry.id} has a readable name for a remedy button`);
    assert.ok(entry.url.startsWith('https://'), `${entry.id} links its text`);
    assert.equal(licenceDisplayName(entry.id), entry.name, `${entry.id} reads the same on every surface`);
  }

  // CC0 and CC-PDDC: no condition, a courtesy credit offered.
  for (const id of ['CC0-1.0', 'CC-PDDC']) {
    const profile = licenceProfile(id)!;
    assert.equal(profile.obligation, 'none', id);
    assert.equal(profile.courtesyCredit, true, id);
    assert.equal(profile.attribution.creator, false, id);
  }

  // Apache 2.0 section 4(4): the NOTICE text travels with a derivative work.
  const apache = licenceProfile('Apache-2.0')!;
  assert.equal(apache.noticeRequired, true);
  assert.equal(roleObligation(apache, 'incorporated'), 'attribution');
  assert.equal(roleObligation(apache, 'runtime'), 'none', 'a library Lolly ran is not credited on the poster');

  // MIT: the permission notice travels with a substantial portion.
  const mit = licenceProfile('MIT')!;
  assert.equal(mit.obligation, 'notice');
  assert.equal(mit.noticeRequired, true);
  assert.equal(mit.attribution.sourceLink, false);

  // ISC: the same notice condition as MIT, so the same obligations.
  const isc = licenceProfile('ISC')!;
  assert.equal(isc.obligation, 'notice');
  assert.equal(isc.noticeRequired, true);
  assert.equal(roleObligation(isc, 'runtime'), 'none');
  assert.deepEqual(isc.attribution, mit.attribution);

  // OFL 1.1: rendering text asks nothing; redistributing the binary asks for the notice.
  const ofl = licenceProfile('OFL-1.1')!;
  assert.equal(roleObligation(ofl, 'runtime'), 'none');
  assert.equal(roleObligation(ofl, 'incorporated'), 'none');
  assert.equal(roleObligation(ofl, 'source-distribution'), 'notice');
  assert.equal(ofl.redistributeSource, 'permitted-with-notices');
});

test('a declaration spelled like a JavaScript property is a miss, not a prototype hit', () => {
  // A declaration arrives from a catalog index, a pack manifest or a stranger's
  // credential, so the alias table must not be readable through Object.prototype.
  for (const text of ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty', 'prototype']) {
    const read = normaliseLicence(text);
    assert.equal(read.id, null, text);
    assert.equal(read.status, 'unparsed', text);
    assert.equal(read.original, text);
    assert.equal(licenceProfile(read.id), null, text);
  }
});

test('a locator prints only when it is an ordinary public address', () => {
  assert.equal(publicLocator('https://example.org/river.svg'), 'https://example.org/river.svg');
  assert.equal(publicLocator('http://example.org/a'), 'http://example.org/a');
  for (const bad of [
    'javascript:alert(1)',
    'file:///Users/andy/Private/receipts/invoice-4821.pdf',
    'data:image/svg+xml,<svg/>',
    'https://user:secret@example.org/a',
    '/Users/andy/Pictures/river.svg',
    `https://example.org/${'a'.repeat(4096)}`,
    'https://example.org/a b',
    '',
    undefined,
    7,
  ]) {
    assert.equal(publicLocator(bad), '', String(bad).slice(0, 40));
  }
});

test('a licence reads under one name on every surface', () => {
  assert.equal(licenceDisplayName('CC-BY-4.0'), 'CC BY 4.0');
  assert.equal(licenceDisplayName('CC-BY-SA-4.0'), 'CC BY-SA 4.0');
  assert.equal(licenceDisplayName('FAL-1.3'), 'Free Art License 1.3', 'a compatible-licence entry names itself');
  assert.equal(licenceDisplayName('Nonesuch-1.0'), 'Nonesuch-1.0', 'an identifier nothing carries prints as itself');
});

test('an extra profile shadows a built-in one and an unknown id has none', () => {
  const synthetic = { ...licenceProfile('CC-BY-4.0')!, id: 'CC-BY-4.0', profileVersion: 'synthetic' };
  assert.equal(licenceProfile('CC-BY-4.0', [synthetic])?.profileVersion, 'synthetic');
  assert.equal(licenceProfile('CC-BY-4.0')?.profileVersion, 'cc-by-4.0-2026-09-13', 'the built-in table is untouched');
  assert.equal(licenceProfile('Nonesuch-1.0'), null);
  assert.equal(licenceProfile(null), null);
});
