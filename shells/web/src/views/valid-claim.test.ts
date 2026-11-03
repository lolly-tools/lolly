// SPDX-License-Identifier: MPL-2.0
/**
 * The /verify Claim panel's licence chooser and what it writes (plan 253, section 9.3).
 *
 * The bug this pins is a wording bug with real consequences: the chooser's empty
 * option used to be labelled "Proprietary - All rights reserved", so a person who
 * simply never picked a licence was shown as having declared one. Three states are
 * three facts - no public licence declared, a deliberate retained-rights notice,
 * and an actual public grant - and only the last two write anything into dc:rights.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/valid-claim.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
// valid.ts reads `window.__toolIndex` - the type-only augmentation, as in
// valid-sources.test.ts (nothing executes from sync.ts at runtime).
import type {} from '../catalog/sync.ts';
import { CLAIM_BASIS, CLAIM_LICENCES, claimRights, stripCreditNoteHtml } from './valid.ts';

test('the empty option means no public licence declared, and reports that', () => {
  const first = CLAIM_LICENCES[0]!;
  assert.equal(first.value, '', 'the empty value is still first');
  assert.equal(first.label, 'No public licence declared');
  assert.ok(!/proprietary/i.test(first.label), 'it no longer names a licence nobody chose');
  assert.ok(!/all rights reserved/i.test(first.label));
});

test('all rights reserved is its own option with its own notice', () => {
  const reserved = CLAIM_LICENCES.find((l) => l.label.startsWith('All rights reserved'));
  assert.ok(reserved, 'a retained-rights notice is offered');
  assert.equal(reserved!.value, 'All rights reserved', 'and it writes a notice of its own');
});

test('the three states write three different dc:rights lines', () => {
  // No declaration: nothing about a licence reaches the credential.
  assert.equal(claimRights('', ''), '');
  assert.equal(claimRights('© 2026 A. Person', ''), '© 2026 A. Person',
    'a typed copyright notice still travels; it is the claimant\'s own assertion');
  // Retained rights: the notice, exactly as chosen.
  assert.equal(claimRights('', 'All rights reserved'), 'All rights reserved');
  // A public grant: the licence name and its deed URL, unchanged.
  const by = CLAIM_LICENCES.find((l) => l.label.startsWith('CC BY 4.0'))!;
  assert.equal(claimRights('© 2026 A. Person', by.value), `© 2026 A. Person · ${by.value}`);
  assert.ok(by.value.includes('https://creativecommons.org/licenses/by/4.0/'),
    'the deed URL travels with the name so a reader can reach the terms');
});

test('a public licence option is never selected by default', () => {
  const publicGrants = CLAIM_LICENCES.filter((l) => l.value && l.value !== 'All rights reserved');
  assert.ok(publicGrants.length >= 6, 'the public grants are all still offered');
  assert.equal(CLAIM_LICENCES.indexOf(publicGrants[0]!), 2,
    'but they sit after the two non-grant states, so a browser default picks neither');
});

test('claiming states what the claim rests on, as an assertion and not a finding', () => {
  assert.equal(CLAIM_BASIS.length, 3);
  assert.deepEqual(CLAIM_BASIS.map((b) => b.value), ['author', 'contribution', 'distribution']);
  for (const basis of CLAIM_BASIS) {
    assert.ok(basis.sentence.includes('asserts'), `${basis.value} is recorded as an assertion`);
    assert.ok(!/verified|proven|owns/i.test(basis.sentence), `${basis.value} claims no finding`);
  }
  assert.ok(CLAIM_BASIS[1]!.sentence.includes('not in the rest of the work'),
    'a contribution claim is scoped away from the sources it sits beside');
});

test('no forbidden wording reaches the chooser', () => {
  const all = [...CLAIM_LICENCES.map((l) => l.label), ...CLAIM_BASIS.map((b) => b.sentence)].join(' ').toLowerCase();
  for (const phrase of ['copyright verified', 'legally safe', 'fully cleared', 'rights cleared', 'royalty-free']) {
    assert.ok(!all.includes(phrase), `never says "${phrase}"`);
  }
});

// ── Strip, and what leaves with the metadata (plan 253, section 10.2) ─────────

test('a strip that removed somebody else\'s credit says so, and offers the credit', () => {
  const html = stripCreditNoteHtml('0', 'JPEG', { count: 2, credits: 'Lorikeet by A. Person, CC BY 4.0.' });
  assert.ok(html.includes('All embedded metadata removed.'), 'the byte-removal promise is stated plainly');
  assert.ok(html.includes('2 sources'), 'and how many credits went with it');
  assert.ok(html.includes('include the accompanying credit when sharing'));
  assert.ok(html.includes('data-copy-credit="Lorikeet by A. Person, CC BY 4.0."'),
    'the credit the file used to carry is right there to paste');
  assert.ok(html.includes('Clean file with separate credits'),
    'and a delivery that does not put anything back into the bytes');
  assert.ok(html.includes('data-clean-package="1"'));
});

test('a file that recorded no sources gets no note at all', () => {
  assert.equal(stripCreditNoteHtml('0', 'PNG', { count: 0, credits: '' }), '');
  assert.equal(stripCreditNoteHtml('0', 'PNG', { count: 2, credits: '' }), '',
    'and none when the count is there but no credit could be assembled');
});

test('the strip note never claims the credit was handled', () => {
  const html = stripCreditNoteHtml('0', 'JPEG', { count: 1, credits: 'x' });
  for (const phrase of ['credits included', 'rights cleared', 'legally safe', 'handled']) {
    assert.ok(!html.toLowerCase().includes(phrase), `never says "${phrase}"`);
  }
});

test('a crafted credit cannot break out of the button attribute', () => {
  const html = stripCreditNoteHtml('0', 'JPEG', { count: 1, credits: '"><img src=x onerror=alert(1)>' });
  assert.ok(!html.includes('<img src=x'), 'the credit is escaped into the attribute');
  assert.ok(html.includes('&quot;&gt;&lt;img'), 'as entities, exactly');
});
