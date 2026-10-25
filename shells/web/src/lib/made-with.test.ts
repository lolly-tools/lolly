// SPDX-License-Identifier: MPL-2.0
/**
 * The design-system record as people read it (plans/319 A7): the one line the
 * export panel's card, the Design editor's info panel and Verify all show, and the
 * Recreate link that reopens a file in the version and colourway it records.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/lib/made-with.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designRecordEnvironment } from '../../../../engine/src/metadata.ts';
import { guidedByFact, madeWithFact, madeWithLine, madeWithWords, recreateHrefFor, recreateSystemId, recreateWithRecord, withDesignRecordParams } from './made-with.ts';

const RECORD = {
  designSystem: { id: 'acme', label: 'Acme & Co' },
  designVersion: '2026-10',
  themes: [
    { group: 'colourway', kind: 'colourway' as const, id: 'persimmon', name: 'Persimmon' },
    { group: 'density', id: 'roomy', name: 'Roomy' },
  ],
};

test('the record reads as one line, the label exactly as its owners typed it', () => {
  assert.equal(madeWithWords(RECORD), 'Acme & Co · Version 2026-10 · Colourway: Persimmon · density: Roomy');
  assert.equal(madeWithWords({ designSystem: { id: 'shipped', label: 'Lolly' } }), 'Lolly');
  assert.equal(madeWithWords({ themes: [{ group: '', id: 'a', name: 'A' }] }), 'Theme: A', 'a group with no id is a plain theme');
  assert.equal(madeWithWords(null), '');
  assert.equal(madeWithWords({}), '');
});

test('the design system joins a Recreate link only when this device holds it under the same id and label', () => {
  assert.equal(recreateSystemId(RECORD, [{ id: 'acme', label: 'Acme & Co' }]), 'acme');
  assert.equal(recreateSystemId(RECORD, [{ id: 'acme', label: ' Acme & Co ' }]), 'acme', 'whitespace is not a different name');
  assert.equal(recreateSystemId(RECORD, [{ id: 'acme', label: 'Another Acme' }]), null, 'a lookalike id never switches the device');
  assert.equal(recreateSystemId(RECORD, []), null);
  assert.equal(recreateSystemId({ designVersion: 'v2' }, [{ id: 'acme', label: 'Acme & Co' }]), null);
});

test('the Recreate link carries ds, designv and _themes after the seeded settings', () => {
  const href = withDesignRecordParams('#/tool/chart?title=Hi', RECORD, 'acme');
  const query = new URLSearchParams(href.split('?')[1]);
  assert.equal(query.get('title'), 'Hi');
  assert.equal(query.get('ds'), 'acme');
  assert.equal(query.get('designv'), '2026-10');
  assert.deepEqual(JSON.parse(query.get('_themes')!), { colourway: 'persimmon', density: 'roomy' });
  assert.equal(withDesignRecordParams('#/tool/chart', { designVersion: 'v2' }), '#/tool/chart?designv=v2', 'a link with no query gains one');
  assert.equal(withDesignRecordParams('#/tool/chart', RECORD).includes('ds='), false, 'no held system, no ds');
  assert.equal(withDesignRecordParams('#/tool/chart', null), '#/tool/chart');
});

test('Verify reads the record off the credential environment, and leaves a plain one alone', () => {
  const environment = { tool: 'Chart', ...designRecordEnvironment(RECORD) };
  const href = recreateWithRecord('#/tool/chart?title=Hi', environment, [{ id: 'acme', label: 'Acme & Co' }]);
  assert.match(href, /&ds=acme&designv=2026-10&_themes=/);
  assert.equal(recreateWithRecord('#/tool/chart?title=Hi', { tool: 'Chart' }, []), '#/tool/chart?title=Hi');
  assert.equal(recreateWithRecord('#/tool/chart', null, []), '#/tool/chart');
  // A forged id is dropped by the reader, so it can never become a ds= value.
  assert.equal(recreateWithRecord('#/tool/chart', { designSystem: 'ACME!', designSystemLabel: 'x' }, [{ id: 'ACME!', label: 'x' }]), '#/tool/chart');
});

test('Verify\'s fact line and Recreate link read the credential the report carries', async () => {
  const environment = { tool: 'Chart', ...designRecordEnvironment(RECORD) };
  assert.equal(madeWithFact(environment), 'Acme & Co · Version 2026-10 · Colourway: Persimmon · density: Roomy');
  assert.equal(madeWithFact({ tool: 'Chart' }), null, 'a credential with no record shows no fact');
  const held = { tokens: { list: async () => [{ id: 'acme', label: 'Acme & Co' }] } };
  assert.match(await recreateHrefFor('#/tool/chart', { environment }, held), /\?ds=acme&designv=2026-10/);
  assert.equal(await recreateHrefFor('#/tool/chart', { environment }, {}), `#/tool/chart?designv=2026-10&_themes=${encodeURIComponent('{"colourway":"persimmon","density":"roomy"}')}`,
    'a host that cannot list its systems still reopens the version and theme choices');
  const failing = { tokens: { list: async () => { throw new Error('no registry'); } } };
  assert.doesNotMatch(await recreateHrefFor('#/tool/chart', { environment }, failing), /ds=/);
  assert.equal(await recreateHrefFor('#/tool/chart', undefined, held), '#/tool/chart');
});

test('the Design editor line follows the runtime switch and its preview', async () => {
  const preview = { record: RECORD, description: 'Made with https://lolly.tools : Design (Persimmon colourway)', plainDescription: 'Made with https://lolly.tools : Design' };
  let on = true;
  const runtime = { madeWithPreview: async () => preview, madeWith: () => on };
  assert.deepEqual(await madeWithLine(runtime), { on: true, words: madeWithWords(RECORD), description: preview.description });
  on = false;
  assert.equal((await madeWithLine(runtime))!.description, preview.plainDescription);
  assert.equal(await madeWithLine({ madeWithPreview: async () => null, madeWith: () => true }), null);
  assert.equal(await madeWithLine({ madeWithPreview: async () => { throw new Error('x'); }, madeWith: () => true }), null);
});

test('brand skills (plan 323) read "Guided by" on the card line and as a Verify fact of their own', () => {
  const brandSkills = [
    { id: 'acme/skill/brand', name: 'acme-brand', revision: '1.0', sha256: '0f'.repeat(32) },
    { id: 'acme/skill/photography', name: 'acme-photography', revision: '1.2', sha256: 'ab'.repeat(32) },
  ];
  const record = { designSystem: { id: 'acme', label: 'Acme & Co' }, brandSkills };
  assert.equal(madeWithWords(record), 'Acme & Co · Guided by: acme-brand 1.0, acme-photography 1.2');
  assert.equal(madeWithWords(record, { skills: false }), 'Acme & Co');
  const env = { tool: 'Chart', ...designRecordEnvironment(record) };
  assert.equal(madeWithFact(env), 'Acme & Co', 'the Design system fact gives the system only');
  assert.equal(guidedByFact(env), 'acme-brand 1.0, acme-photography 1.2');
  assert.equal(guidedByFact({ tool: 'Chart', ...designRecordEnvironment({ designSystem: record.designSystem }) }), null);
  assert.equal(guidedByFact(null), null);
  for (const words of [madeWithWords(record), guidedByFact(env)!]) {
    assert.doesNotMatch(words, /compl|approv|check/i, 'guidance, never a verdict');
  }
});
