// SPDX-License-Identifier: MPL-2.0
/**
 * Rule `owner-published-v1`: a row whose own work carries an owner, a declaration and an
 * asserted `own-work` grant with its terms travels, and says plainly that no open licence
 * covers the file. Every other record stays held back, whatever it claims.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OWNER_PUBLISHED, ownerPublished, redistribution } from '../engine/src/asset-rights.ts';
import { buildBrandPage, type BrandPageInputV1 } from '../engine/src/brand-page.ts';
import { deriveBrandTokens } from '../engine/src/brand-derive.ts';
import { RIGHTS_RULES_VERSION } from '../engine/src/rights-profiles.ts';
import { licenceLabel } from '../shells/web/src/lib/asset-rights.ts';
import { packCreditsText } from '../shells/web/src/lib/lolly-pack.ts';
import { packRights } from '../shells/web/src/lib/redistribution.ts';

const TERMS = 'These marks belong to Acme. Show them unaltered to refer to Acme.';
const REF = 'LicenseRef-Acme-Marks';

interface WorkEdit { [key: string]: unknown }
/** A complete record, with any part replaced by `edit`. */
function record(edit: WorkEdit = {}): Record<string, unknown> {
  return {
    works: [{
      id: 'acme/logo/primary',
      creators: [{ name: 'Acme Ltd', role: 'owner' }],
      rights: [{ declaration: REF, assertedBy: 'catalog', evidence: 'catalog-entry', status: 'unparsed' }],
      grants: [{ kind: 'own-work', scope: TERMS, asserted: true }],
      ...edit,
    }],
  };
}

test('the rule change moved the rules version', () => {
  assert.equal(RIGHTS_RULES_VERSION, 'rights-rules-2026-11-05.1');
});

test('a complete own-work record travels and says no open licence covers the file', () => {
  const answer = redistribution({ license: REF, rights: record() });
  assert.equal(answer.travels, true);
  assert.equal(answer.reason, '');
  assert.equal(answer.licence, OWNER_PUBLISHED);
  assert.equal(OWNER_PUBLISHED, 'Owner-published, not an open licence');
  assert.deepEqual(answer.owner, { holder: 'Acme Ltd', terms: TERMS });
  assert.deepEqual(answer.notices, [TERMS], 'the terms travel beside the bytes');
});

test('the structured record is enough, with no legacy licence string', () => {
  assert.equal(redistribution({ rights: record() }).travels, true);
});

test('a term the record already lists as a notice appears once', () => {
  const rights = record({ rights: [{ declaration: REF, notices: [TERMS], assertedBy: 'catalog', evidence: 'catalog-entry', status: 'unparsed' }] });
  assert.deepEqual(redistribution({ license: REF, rights }).notices, [TERMS]);
});

const PARTIAL: Array<[string, WorkEdit]> = [
  ['blank terms', { grants: [{ kind: 'own-work', scope: '   ', asserted: true }] }],
  ['no terms field', { grants: [{ kind: 'own-work', asserted: true }] }],
  ['terms that are not text', { grants: [{ kind: 'own-work', scope: 42, asserted: true }] }],
  ['a grant nobody asserted', { grants: [{ kind: 'own-work', scope: TERMS, asserted: false }] }],
  ['no owner', { creators: [] }],
  ['a creator who is not the owner', { creators: [{ name: 'Acme Ltd', role: 'creator' }] }],
  ['a blank owner name', { creators: [{ name: '  ', role: 'owner' }] }],
  ['no declaration', { rights: [] }],
  ['a blank declaration', { rights: [{ declaration: ' ', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'unparsed' }] }],
  ['a declaration looked for and not found', { rights: [{ declaration: REF, assertedBy: 'catalog', evidence: 'catalog-entry', status: 'missing' }] }],
];

for (const [name, edit] of PARTIAL) {
  test(`a record with ${name} is held back and says why`, () => {
    const answer = redistribution({ rights: record(edit) });
    assert.equal(answer.travels, false, name);
    assert.equal(answer.owner, undefined, name);
    assert.notEqual(answer.licence, OWNER_PUBLISHED, name);
    assert.equal(answer.kind, 'unknown', name);
    assert.match(answer.reason, /own-work record is missing/, name);
  });
}

test('another kind of grant is not an own-work record, and keeps the older answer', () => {
  for (const kind of ['specific-permission', 'public-licence', 'dedication', 'something-else']) {
    const answer = redistribution({ license: REF, rights: record({ grants: [{ kind, scope: TERMS, asserted: true }] }) });
    assert.equal(answer.travels, false, kind);
    assert.equal(answer.reason, `${REF} is recorded and not yet interpreted`, kind);
  }
});

test('a record of the wrong shape reads as nothing at all', () => {
  for (const rights of [null, 'own-work', 7, [], {}, { works: [] }, { works: [null] }, { works: ['x'] }, { works: [{}] }, { works: [{ grants: 'own-work' }] }]) {
    assert.equal(ownerPublished(rights), null, JSON.stringify(rights));
    assert.equal(redistribution({ rights }).travels, false, JSON.stringify(rights));
  }
});

test('only the asset\'s own work counts, not another work in the same record', () => {
  const rights = { works: [
    { id: 'someone/else', creators: [], rights: [{ declaration: 'unknown', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'unparsed' }] },
    (record().works as unknown[])[0],
  ] };
  assert.equal(redistribution({ rights }).travels, false);
});

test('a third party\'s mark with no such record stays held back', () => {
  assert.deepEqual(
    { ...redistribution({ attribution: 'Orbit Inc' }), notices: [] },
    { travels: false, kind: 'unknown', reason: 'licence not recorded', licence: '', notices: [] },
  );
  const named = redistribution({ license: 'LicenseRef-Orbit-Marks', attribution: 'Orbit Inc' });
  assert.equal(named.travels, false);
  assert.equal(named.reason, 'LicenseRef-Orbit-Marks is recorded and not yet interpreted');
  const noted = redistribution({ license: 'all-rights-reserved', rights: { works: [{ id: 'orbit/logo', creators: [{ name: 'Orbit Inc', role: 'creator' }], rights: [{ declaration: 'all-rights-reserved', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'unparsed' }] }] } });
  assert.equal(noted.travels, false);
});

test('a brand lock holds an own-work record back, as policy', () => {
  const answer = redistribution({ license: REF, rights: record(), brandLock: true });
  assert.equal(answer.travels, false);
  assert.equal(answer.kind, 'policy');
});

test('a reviewed licence answers first, so the owner\'s record never replaces the licence', () => {
  const open = redistribution({ license: 'CC0-1.0', rights: record() });
  assert.equal(open.travels, true);
  assert.equal(open.owner, undefined);
  assert.notEqual(open.licence, OWNER_PUBLISHED);
});

test('.lolly credits say owner-published, carry the terms and list a third party as held', () => {
  const owner = packRights({ license: REF, rights: record() });
  assert.equal(owner.licensed, false, 'the bytes need no sender\'s choice');
  assert.equal(owner.holdReason, undefined);
  assert.equal(owner.licence, OWNER_PUBLISHED);
  const orbit = packRights({ attribution: 'Orbit Inc' });
  assert.equal(orbit.licensed, true);
  const credits = packCreditsText(
    [{ label: 'Acme mark', id: 'acme/logo/primary', path: 'assets/acme.svg', licence: owner.licence ?? '', notices: owner.notices ?? [] }] as never,
    [{ label: 'Orbit mark', id: 'orbit/logo', reason: orbit.holdReason ?? '', kind: orbit.holdKind, licence: orbit.licence }] as never,
  );
  assert.match(credits, /licence: Owner-published, not an open licence/);
  assert.ok(credits.includes(`notice:  ${TERMS}`));
  assert.match(credits, /Orbit mark[\s\S]*reason: {2}licence not recorded/);
  assert.doesNotMatch(credits, /cleared|verified|legally safe/i);
});

test('the details sheet reads the same answer as the rule', () => {
  assert.equal(licenceLabel({ license: REF, rights: record() })?.full, OWNER_PUBLISHED);
  assert.equal(licenceLabel({ license: REF, rights: record() })?.declared, REF);
  assert.equal(licenceLabel({ license: REF })?.full, REF, 'no record, no such claim');
  assert.notEqual(licenceLabel({ license: 'CC0-1.0', rights: record() })?.full, OWNER_PUBLISHED);
});

const SVG = (fill: string): Uint8Array => new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="${fill}"/></svg>`);

function page(extra: Partial<BrandPageInputV1> = {}): BrandPageInputV1 {
  return {
    tokens: deriveBrandTokens({ primary: '#123456' } as never),
    name: 'Acme', id: 'acme',
    logos: [
      { id: 'acme/logo/primary', name: 'Acme mark', format: 'svg', bytes: SVG('#111111'), license: REF, rights: record(), tags: ['logo'] },
      { id: 'orbit/logo/primary', name: 'Orbit mark', format: 'svg', bytes: SVG('#222222'), tags: ['logo'] },
    ],
    ...extra,
  } as BrandPageInputV1;
}

const fileOf = (built: Awaited<ReturnType<typeof buildBrandPage>>, path: string): string => new TextDecoder().decode(built.files.find(f => f.path === path)!.bytes);

test('a brand page publishes an owner\'s mark with its terms, and holds a third party\'s', async () => {
  const built = await buildBrandPage(page());
  assert.equal(built.manifest.logos?.find(l => l.id === 'acme/logo/primary')?.licence, OWNER_PUBLISHED);
  assert.deepEqual(built.manifest.held.find(h => h.item === 'orbit/logo/primary'), { item: 'orbit/logo/primary', reason: 'licence not recorded', kind: 'unknown' });
  assert.ok(!built.manifest.files.some(f => f.path.startsWith('logos/orbit')));
  assert.equal(built.manifest.usage?.statement, TERMS);
  const html = fileOf(built, 'index.html');
  assert.match(html, /Owner-published, not an open licence\. <a href="#usage">/);
  assert.ok(html.includes(TERMS));
  assert.ok(fileOf(built, 'index.md').includes(OWNER_PUBLISHED));
  assert.ok(fileOf(built, 'AGENTS.md').includes(OWNER_PUBLISHED));
});

test('a page with a mix of logos says which ones are owner-published', async () => {
  const built = await buildBrandPage(page({ include: ['orbit/logo/primary'] }));
  assert.match(fileOf(built, 'index.html'), /Owner-published, not an open licence: Acme mark\./);
  assert.equal(built.manifest.logos?.find(l => l.id === 'orbit/logo/primary')?.licence, undefined, 'an included logo claims no licence');
});

test('the publisher\'s words stay first, and the terms join them once', async () => {
  const built = await buildBrandPage(page({ usage: { statement: 'Ask us first.', contact: 'brand@example.com' } }));
  assert.equal(built.manifest.usage?.statement, `Ask us first.\n\n${TERMS}`);
  assert.equal(built.manifest.usage?.contact, 'brand@example.com');
  const again = await buildBrandPage(page({ usage: { statement: `Ask us first. ${TERMS}` } }));
  assert.equal(again.manifest.usage?.statement, `Ask us first. ${TERMS}`);
});

test('no owner-published logo adds no note and no statement', async () => {
  const built = await buildBrandPage(page({ logos: [{ id: 'open/logo', name: 'Open', format: 'svg', bytes: SVG('#333333'), license: 'CC0-1.0', tags: ['logo'] }] as never }));
  assert.equal(built.manifest.usage, undefined);
  assert.doesNotMatch(fileOf(built, 'index.html'), /Owner-published/);
});

test('a brand page keeps a lock on an own-work record, and include does not get past the lock', async () => {
  const built = await buildBrandPage(page({
    logos: [{ id: 'acme/logo/primary', name: 'Acme mark', format: 'svg', bytes: SVG('#111111'), license: REF, rights: record(), brandLock: true, tags: ['logo'] }] as never,
    include: ['acme/logo/primary'],
  }));
  assert.ok(!built.manifest.files.some(f => f.path.startsWith('logos/')));
  assert.equal(built.manifest.held.find(h => h.item === 'acme/logo/primary')?.kind, 'policy');
});
