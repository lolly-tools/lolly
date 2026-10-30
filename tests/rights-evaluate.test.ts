// SPDX-License-Identifier: MPL-2.0
/**
 * The rights evaluator (plan 253) against hand-authored expectations in
 * tests/fixtures/rights, plus the properties the plan asks of it: the same
 * facts in any order give the same answer, every meaningful input changes the
 * fingerprint, a reviewed rule that forbids a use is reported as such, and no
 * clock is read.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import type { CreativeUseV1, CreativeWorkRecordV1, RightsDecisionV1, UseContextV1 } from '../packages/core/src/rights-v1.ts';
import type { SourceDetailV1 } from '../engine/src/rights-attribution.ts';
import { RIGHTS_RULES_VERSION, licenceProfile } from '../engine/src/rights-profiles.ts';
import type { LicenceProfileV1 } from '../engine/src/rights-profiles.ts';
import { evaluateCreativeUses } from '../engine/src/rights-evaluate.ts';

interface Fixture {
  name: string;
  title: string;
  citations: string[];
  input: { works: CreativeWorkRecordV1[]; uses: CreativeUseV1[]; context: UseContextV1; decisions?: RightsDecisionV1[]; details?: Record<string, SourceDetailV1> };
  expect: {
    status: string;
    issues: string[];
    uses: { work: string; classification: string; rule: string; licence: string | null; reviewed: boolean; issues: string[] }[];
    required: { work: string; credit: string; changes: string; noticeText?: string }[];
    optional: { work: string; credit: string; changes: string }[];
    channels: string[];
    changes: string[];
    unresolved: string[];
  };
}

const fixtureDir = new URL('./fixtures/rights/', import.meta.url);
const fixtures: Fixture[] = readdirSync(fixtureDir)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(new URL(name, fixtureDir), 'utf8')) as Fixture);

test('every expectation file has a case, a citation and a matching name', () => {
  assert.ok(fixtures.length >= 16, `expected the full fixture set, found ${fixtures.length}`);
  for (const fixture of fixtures) {
    assert.ok(fixture.title.length > 0, `${fixture.name} states its case`);
    assert.ok(fixture.citations.length > 0, `${fixture.name} cites the text it was written from`);
  }
});

for (const fixture of fixtures) {
  test(`fixture: ${fixture.name} - ${fixture.title}`, () => {
    const result = evaluateCreativeUses(fixture.input);
    assert.equal(result.rulesVersion, RIGHTS_RULES_VERSION);
    assert.equal(result.status, fixture.expect.status, fixture.citations.join(' '));
    assert.deepEqual(result.issues.map((issue) => issue.code).sort(), [...fixture.expect.issues].sort());
    assert.deepEqual(
      result.uses.map((use) => ({ work: use.work, classification: use.classification, rule: use.rule, licence: use.licence, reviewed: use.reviewed, issues: use.issues })),
      fixture.expect.uses,
    );
    assert.deepEqual(
      result.plan.required.map((notice) => ({ work: notice.work, credit: notice.credit, changes: notice.changes ?? '', ...(notice.noticeText ? { noticeText: notice.noticeText } : {}) })),
      fixture.expect.required,
    );
    assert.deepEqual(
      result.plan.optional.map((notice) => ({ work: notice.work, credit: notice.credit, changes: notice.changes ?? '' })),
      fixture.expect.optional,
    );
    assert.deepEqual(result.plan.channels, fixture.expect.channels);
    assert.deepEqual(result.plan.changes, fixture.expect.changes);
    assert.deepEqual(result.plan.unresolved, fixture.expect.unresolved);
    for (const issue of result.issues) {
      assert.ok(issue.summary.length > 0, `${issue.code} says what it is in words`);
      assert.ok(issue.rule, `${issue.code} names the rule that raised it`);
    }
    assert.notEqual(result.status, 'delivery-failed', 'only a receipt can report a failed delivery');
  });
}

const artwork: CreativeWorkRecordV1 = {
  id: 'example/artwork',
  title: 'Artwork',
  creators: [{ name: 'Example Artist', role: 'creator' }],
  sourceUrl: 'https://example.org/artwork.svg',
  sourceHash: `sha256:${'a'.repeat(64)}`,
  rights: [{ declaration: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }],
};
const second: CreativeWorkRecordV1 = { ...artwork, id: 'example/second', title: 'Second', sourceUrl: 'https://example.org/second.svg', sourceHash: `sha256:${'b'.repeat(64)}` };
const context: UseContextV1 = {
  operation: 'render',
  delivery: { format: 'png', route: 'file-with-c2pa', canCarryCredential: true, canCarryReadableCredit: true },
  audience: 'shared',
};
const placed = (work: string): CreativeUseV1 => ({ work, role: 'incorporated', operations: ['placed'] });

test('the same facts in any order give the same answer and the same fingerprint', () => {
  const forwards = evaluateCreativeUses({ works: [artwork, second], uses: [placed(artwork.id), placed(second.id)], context });
  const backwards = evaluateCreativeUses({ works: [second, artwork], uses: [placed(second.id), placed(artwork.id)], context });
  assert.equal(forwards.fingerprint, backwards.fingerprint);
  assert.deepEqual(forwards.uses, backwards.uses);
  assert.deepEqual(forwards.plan, backwards.plan);
  assert.deepEqual(forwards.uses.map((use) => use.work), ['example/artwork', 'example/second'], 'works are sorted by id');
  const reordered = evaluateCreativeUses({
    works: [artwork],
    uses: [{ work: artwork.id, role: 'incorporated', operations: ['recoloured', 'placed'] }],
    context,
  });
  const straight = evaluateCreativeUses({
    works: [artwork],
    uses: [{ work: artwork.id, role: 'incorporated', operations: ['placed', 'recoloured'] }],
    context,
  });
  assert.equal(reordered.fingerprint, straight.fingerprint, 'operation order is not a fact about the use');
});

test('the fingerprint is a sha256 and moves on every meaningful input', () => {
  const base = evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context });
  assert.match(base.fingerprint, /^sha256:[0-9a-f]{64}$/);
  const changes: [string, ReturnType<typeof evaluateCreativeUses>][] = [
    ['a different source revision', evaluateCreativeUses({ works: [{ ...artwork, sourceHash: `sha256:${'c'.repeat(64)}` }], uses: [placed(artwork.id)], context })],
    ['a different declaration', evaluateCreativeUses({ works: [{ ...artwork, rights: [{ ...artwork.rights[0]!, declaration: 'CC-BY-SA-4.0' }] }], uses: [placed(artwork.id)], context })],
    ['another operation', evaluateCreativeUses({ works: [artwork], uses: [{ work: artwork.id, role: 'incorporated', operations: ['placed', 'recoloured'] }], context })],
    ['another role', evaluateCreativeUses({ works: [artwork], uses: [{ work: artwork.id, role: 'source-distribution', operations: ['placed'] }], context })],
    ['a different route', evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context: { ...context, delivery: { ...context.delivery, route: 'clipboard' } } })],
    ['a different audience', evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context: { ...context, audience: 'public' } })],
    ['a chosen output licence', evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context: { ...context, outputLicence: 'CC-BY-SA-4.0' } })],
    ['a recorded decision', evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context, decisions: [{ work: artwork.id, kind: 'output-licence', licence: 'CC-BY-SA-4.0' }] })],
    ['a swapped profile', evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context, extraProfiles: [{ ...licenceProfile('CC-BY-4.0')!, profileVersion: 'synthetic' }] })],
  ];
  for (const [what, result] of changes) assert.notEqual(result.fingerprint, base.fingerprint, what);
  const dated = evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context: { ...context, evaluatedAt: '2026-09-13T00:00:00Z' } });
  assert.equal(dated.fingerprint, base.fingerprint, 'a date the caller supplied is not a rule input');
});

test('the fingerprint is a pinned value for pinned inputs', () => {
  // Golden digests, three payload lengths apart so the block padding is
  // exercised on both sides of a 64-byte boundary. They move when the rules
  // version moves or when a recorded fact changes, which is the review step;
  // they must not move because the digest was computed differently.
  const golden: [number, string, string][] = [
    [0, 'sha256:add14aecd33d29258ac2c22e02e43f68ae683f3b4ce07ff957803909985fb3da', 'sha256:4e45aba09ca68bfe1d597567ae6289f165e80d09dbda2b69f46106718f559545'],
    [7, 'sha256:7acf469210241f066cf453703504dbb74219a9504b4fc71f20b518a9e1ee001d', 'sha256:f172ac8f0dad0dce65b80e5fdeec30ef7c21db9e5db4ac1b2d2f6fffd79cfbd8'],
    [40, 'sha256:18a812e759960bfaef13776cac9e7e9cbe5f0b3ce27b38158a0cc086009403b3', 'sha256:725bf1638649d2917d1892e5016e57afb46e834c67b1bc9a95b782e1bffc5a0f'],
  ];
  for (const [pad, expected, situation] of golden) {
    const work: CreativeWorkRecordV1 = {
      id: `example/work${'x'.repeat(pad)}`,
      creators: [{ name: 'Example Artist', role: 'creator' }],
      sourceUrl: 'https://example.org/a.svg',
      sourceHash: `sha256:${'0'.repeat(64)}`,
      rights: [{ declaration: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }],
    };
    const result = evaluateCreativeUses({ works: [work], uses: [placed(work.id)], context });
    assert.equal(result.fingerprint, expected, `padding class ${pad}`);
    assert.equal(result.situation, situation, `padding class ${pad}, situation`);
  }
});

test('a decision applies to the facts it was made about and to no others', () => {
  const sa: CreativeWorkRecordV1 = { ...artwork, rights: [{ declaration: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }] };
  const uses: CreativeUseV1[] = [{ work: sa.id, role: 'incorporated', operations: ['placed', 'recoloured'] }];
  const open = evaluateCreativeUses({ works: [sa], uses, context });
  assert.equal(open.status, 'actions-required');

  const decision: RightsDecisionV1 = { work: sa.id, kind: 'output-licence', licence: 'CC-BY-SA-4.0', fingerprint: open.situation };
  assert.equal(evaluateCreativeUses({ works: [sa], uses, context, decisions: [decision] }).status, 'ready');

  // The facts the choice was made about, changed one at a time. Each moves the
  // situation, so the stored choice stops answering and the card comes back.
  const elsewhere: [string, ReturnType<typeof evaluateCreativeUses>][] = [
    ['another operation', evaluateCreativeUses({ works: [sa], uses: [{ work: sa.id, role: 'incorporated', operations: ['placed', 'recoloured', 'cropped'] }], context, decisions: [decision] })],
    ['another format', evaluateCreativeUses({ works: [sa], uses, context: { ...context, delivery: { ...context.delivery, format: 'svg' } }, decisions: [decision] })],
    ['another audience', evaluateCreativeUses({ works: [sa], uses, context: { ...context, audience: 'public' }, decisions: [decision] })],
    ['another source revision', evaluateCreativeUses({ works: [{ ...sa, sourceHash: `sha256:${'d'.repeat(64)}` }], uses, context, decisions: [decision] })],
  ];
  for (const [what, result] of elsewhere) {
    assert.equal(result.status, 'actions-required', what);
    assert.ok(result.plan.unresolved.some((line) => line.includes('different facts')), `${what} says the old choice was about something else`);
  }

  const stale = evaluateCreativeUses({ works: [sa], uses, context, decisions: [{ ...decision, fingerprint: 'sha256:stale' }] });
  assert.equal(stale.status, 'actions-required', 'a decision from another situation resolves nothing');
  assert.deepEqual(stale.plan.unresolved, ['example/artwork: an earlier output-licence choice was made about different facts']);
});

test('two decisions about one work give the same answer in either order', () => {
  const sa: CreativeWorkRecordV1 = { ...artwork, rights: [{ declaration: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }] };
  const uses: CreativeUseV1[] = [{ work: sa.id, role: 'incorporated', operations: ['placed', 'recoloured'] }];
  const pair: RightsDecisionV1[] = [
    { work: sa.id, kind: 'output-licence', licence: 'CC-BY-SA-4.0' },
    { work: sa.id, kind: 'output-licence', licence: 'MIT' },
  ];
  const forwards = evaluateCreativeUses({ works: [sa], uses, context, decisions: pair });
  const backwards = evaluateCreativeUses({ works: [sa], uses, context, decisions: [...pair].reverse() });
  assert.equal(forwards.status, backwards.status);
  assert.equal(forwards.fingerprint, backwards.fingerprint);
});

test('two work records under one id are reported, never merged', () => {
  const one: CreativeWorkRecordV1 = { ...artwork, rights: [{ declaration: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }] };
  const two: CreativeWorkRecordV1 = { ...artwork, title: 'Other', rights: [{ declaration: 'MIT', url: 'https://opensource.org/license/mit', notices: ['Copyright 2024 Example'], assertedBy: 'source', evidence: 'native-metadata', status: 'parsed' }] };
  const forwards = evaluateCreativeUses({ works: [one, two], uses: [placed(one.id)], context });
  const backwards = evaluateCreativeUses({ works: [two, one], uses: [placed(one.id)], context });
  assert.equal(forwards.fingerprint, backwards.fingerprint, 'identical bytes do not imply identical grants, and order is not a fact');
  assert.deepEqual(forwards.uses, backwards.uses);
  assert.ok(forwards.issues.some((issue) => issue.rule === 'duplicate-work-id-v1'));
  assert.ok(forwards.plan.unresolved.includes('example/artwork: two records share this work id'));
});

test('a reviewed profile that forbids a use reports it, and nothing else does', () => {
  const forbidding: LicenceProfileV1 = {
    ...licenceProfile('CC-BY-4.0')!,
    id: 'Example-Restricted-1.0',
    name: 'Example Restricted 1.0',
    profileVersion: 'synthetic-limit',
    limits: [{ summary: 'This licence does not cover commercial use.', commercial: true }],
  };
  const work: CreativeWorkRecordV1 = { ...artwork, rights: [{ declaration: 'Example-Restricted-1.0', url: 'https://example.org/licence', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }] };
  const restricted = evaluateCreativeUses({
    works: [work],
    uses: [placed(work.id)],
    context: { ...context, commercial: true },
    extraProfiles: [forbidding],
  });
  assert.equal(restricted.status, 'use-not-covered');
  assert.equal(restricted.issues.find((issue) => issue.code === 'licence.use-not-covered')?.summary, 'This licence does not cover commercial use.');

  const unknownContext = evaluateCreativeUses({ works: [work], uses: [placed(work.id)], context: { ...context, commercial: 'unknown' }, extraProfiles: [forbidding] });
  assert.equal(unknownContext.status, 'ready', 'an unknown purpose is not inferred to be commercial');
  for (const id of ['CC-BY-4.0', 'CC-BY-SA-4.0', 'CC0-1.0', 'CC-PDDC', 'Apache-2.0', 'MIT', 'OFL-1.1']) {
    assert.deepEqual(licenceProfile(id)?.limits, [], `${id} forbids no use today`);
  }
});

test('a missing creator or licence link is reported as a gap, not as an infringement', () => {
  const incomplete: CreativeWorkRecordV1 = { ...artwork, creators: [] };
  const result = evaluateCreativeUses({ works: [incomplete], uses: [placed(incomplete.id)], context });
  assert.equal(result.status, 'unknown');
  const issue = result.issues.find((entry) => entry.code === 'attribution.source-missing');
  assert.equal(issue?.summary, 'This work needs a credit and part of it is not recorded.');
  assert.deepEqual(issue?.remedies.map((remedy) => remedy.kind), ['add-information']);
  assert.deepEqual(result.plan.unresolved, ['example/artwork: creator not recorded']);
});

test('the only operation being a conversion is a technical conversion, and a transformation input is not adapted', () => {
  const converted = evaluateCreativeUses({ works: [artwork], uses: [{ work: artwork.id, role: 'incorporated', operations: ['converted'] }], context });
  assert.equal(converted.uses[0]?.classification, 'technical-conversion');
  assert.equal(converted.uses[0]?.rule, 'technical-conversion-v1');

  const lut = evaluateCreativeUses({ works: [artwork], uses: [{ work: artwork.id, role: 'transformation', operations: ['placed', 'recoloured'] }], context });
  assert.equal(lut.uses[0]?.classification, 'unchanged');
  assert.equal(lut.uses[0]?.rule, 'transformation-input-v1');

  const empty = evaluateCreativeUses({ works: [artwork], uses: [{ work: artwork.id, role: 'incorporated', operations: [] }], context });
  assert.equal(empty.uses[0]?.classification, 'undetermined');
  assert.deepEqual(empty.plan.unresolved, ['example/artwork: the rules do not classify this use']);
});

test('a caller may raise a classification and may not lower one', () => {
  const raised = evaluateCreativeUses({ works: [artwork], uses: [{ ...placed(artwork.id), classification: 'adaptation' }], context });
  assert.equal(raised.uses[0]?.classification, 'adaptation');
  assert.equal(raised.uses[0]?.rule, 'caller-classification-kept-v1');
  const lowered = evaluateCreativeUses({
    works: [artwork],
    uses: [{ work: artwork.id, role: 'incorporated', operations: ['placed', 'recoloured'], classification: 'unchanged' }],
    context,
  });
  assert.equal(lowered.uses[0]?.classification, 'adaptation', 'a hand-written classification cannot discharge the rule');
});

test('one work placed many times groups into one issue, not one per placement', () => {
  const sa: CreativeWorkRecordV1 = { ...artwork, rights: [{ declaration: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }] };
  const result = evaluateCreativeUses({
    works: [sa],
    uses: [{ work: sa.id, role: 'incorporated', operations: ['placed', 'recoloured'], scope: { count: 300 } }],
    context,
  });
  assert.equal(result.issues.filter((issue) => issue.code === 'licence.adaptation-choice').length, 1);
  assert.equal(result.plan.humanActions.length, 1);
  // One remedy per licence on the compatible list, then the ways out that need
  // no licence at all.
  assert.deepEqual(result.plan.humanActions[0]?.remedies.map((remedy) => remedy.kind), ['output-licence', 'output-licence', 'output-licence', 'keep-original', 'replace-work', 'separate-permission']);
  assert.deepEqual(result.plan.humanActions[0]?.remedies.filter((remedy) => remedy.licence).map((remedy) => remedy.licence), ['CC-BY-SA-4.0', 'FAL-1.3', 'GPL-3.0-or-later']);
  assert.equal(result.plan.humanActions[0]?.remedies[1]?.label, 'Share the adaptation under Free Art License 1.3', 'a compatible licence names itself readably');
});

test('an acknowledgement records that a warning was seen and resolves nothing', () => {
  const sa: CreativeWorkRecordV1 = { ...artwork, rights: [{ declaration: 'CC-BY-SA-4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }] };
  const uses: CreativeUseV1[] = [{ work: sa.id, role: 'incorporated', operations: ['placed', 'recoloured'] }];
  const acknowledged = evaluateCreativeUses({ works: [sa], uses, context, decisions: [{ work: sa.id, kind: 'acknowledged' }] });
  assert.equal(acknowledged.status, 'actions-required');
  const wrongLicence = evaluateCreativeUses({ works: [sa], uses, context, decisions: [{ work: sa.id, kind: 'output-licence', licence: 'CC-BY-4.0' }] });
  assert.equal(wrongLicence.status, 'actions-required', 'a licence that is not on the compatible list resolves nothing');
  const permission = evaluateCreativeUses({ works: [sa], uses, context, decisions: [{ work: sa.id, kind: 'separate-permission', note: 'written permission on file' }] });
  assert.equal(permission.status, 'ready');
});

test('a notice the licensor supplied travels, and a notice the licence demands is a gap when absent', () => {
  // CC BY 4.0 section 3(a)(1)(A)(iv): a notice referring to the disclaimer of
  // warranties is retained IF SUPPLIED, so one that was recorded travels and a
  // work that carries none raises nothing.
  const supplied: CreativeWorkRecordV1 = { ...artwork, rights: [{ ...artwork.rights[0]!, notices: ['THE WORK IS PROVIDED AS-IS, WITHOUT WARRANTIES OF ANY KIND.'] }] };
  const carried = evaluateCreativeUses({ works: [supplied], uses: [placed(supplied.id)], context });
  assert.equal(carried.status, 'ready');
  assert.equal(carried.plan.required[0]?.noticeText, 'THE WORK IS PROVIDED AS-IS, WITHOUT WARRANTIES OF ANY KIND.');
  assert.equal(evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context }).plan.required[0]?.noticeText, undefined);
  assert.equal(evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context }).status, 'ready', 'CC BY asks for no notice of its own');

  // Apache 2.0 section 4(4) and the MIT permission notice do demand one, so a
  // work carrying none is a gap and nothing reads as ready.
  const apache: CreativeWorkRecordV1 = { ...artwork, rights: [{ declaration: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0', assertedBy: 'catalog', evidence: 'catalog-entry', status: 'parsed' }] };
  const result = evaluateCreativeUses({ works: [apache], uses: [placed(apache.id)], context });
  assert.equal(result.status, 'unknown');
  assert.equal(result.issues.find((issue) => issue.rule === 'notice-text-missing-v1')?.code, 'attribution.source-missing');
  assert.ok(result.plan.unresolved.includes('example/artwork: notice text not recorded'));
});

test('a profile version is recorded for every profile that shaped the plan', () => {
  const result = evaluateCreativeUses({ works: [artwork], uses: [placed(artwork.id)], context });
  assert.deepEqual(result.plan.profileVersions, { 'CC-BY-4.0': 'cc-by-4.0-2026-09-13' });
  assert.equal(result.plan.rulesVersion, RIGHTS_RULES_VERSION);
});
