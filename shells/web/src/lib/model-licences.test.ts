// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { modelLicence, modelLicenceFamilies, modelLicenceLine } from './model-licences.ts';
import { MODEL_PART_IDS, modelPartNote } from './model-parts.ts';

const MANIFEST = JSON.parse(readFileSync(new URL('../../models-manifest.json', import.meta.url), 'utf8')) as { url: string }[];
const FAMILIES = [...new Set(MANIFEST.map(f => f.url.split('/')[2]!))].sort();
const CONVERTER_TOKENS = ['none-stated', 'not-recorded', 'not-applicable'];
const BANNED = /rights cleared|legally safe|copyright verified|fully cleared|royalty-free therefore/i;

test('every family in models-manifest.json has a licence record, and no record is orphaned', () => {
  const missing = FAMILIES.filter(f => !modelLicence(f));
  assert.deepEqual(missing, [], 'add these families to shells/web/model-licences.json');
  const orphaned = modelLicenceFamilies().filter(f => !FAMILIES.includes(f));
  assert.deepEqual(orphaned, [], 'these records name a family the manifest no longer lists');
});

test('each record carries every field, filled', () => {
  for (const family of FAMILIES) {
    const r = modelLicence(family)!;
    for (const key of ['licence', 'url', 'convertedBy', 'converterLicence', 'note'] as const) {
      assert.ok(typeof r[key] === 'string' && r[key].trim(), `${family}.${key} must be a non-empty string`);
    }
    assert.match(r.url, /^https:\/\//, `${family}.url`);
    assert.ok(r.upstream.repo.trim() && r.upstream.revision.trim(), `${family}.upstream needs a repo and a revision`);
    assert.equal(typeof r.acceptRequired, 'boolean', `${family}.acceptRequired`);
  }
});

test('"the converter states no licence" is recorded explicitly, never left blank or implied', () => {
  for (const family of FAMILIES) {
    const r = modelLicence(family)!;
    const named = !CONVERTER_TOKENS.includes(r.converterLicence);
    assert.ok(named || CONVERTER_TOKENS.includes(r.converterLicence), family);
    // A converter that states a licence must be named by it, so a reader can see it differs or not.
    if (named) assert.match(r.converterLicence, /^[A-Za-z0-9.+-]+$/, `${family}.converterLicence should be an SPDX-style id`);
  }
  // The two known cases where the converter's repository carries no licence.
  assert.equal(modelLicence('whisper')!.converterLicence, 'none-stated');
  assert.equal(modelLicence('sing')!.converterLicence, 'none-stated');
  assert.match(modelLicence('whisper')!.note, /no licence tag/);
  assert.match(modelLicence('sing')!.note, /states no licence/);
});

test('a family whose terms carry use restrictions asks to show them before download', () => {
  assert.equal(modelLicence('sing')!.acceptRequired, true);
  for (const family of FAMILIES) {
    const r = modelLicence(family)!;
    if (r.offerLine) assert.equal(r.acceptRequired, true, `${family} shows a line, so it is flagged`);
  }
});

test('wording is the publisher stated record, never a clearance', () => {
  for (const family of FAMILIES) {
    const r = modelLicence(family)!;
    const text = [r.licence, r.note, r.offerLine ?? '', r.convertedBy].join(' ');
    assert.doesNotMatch(text, BANNED, family);
    assert.ok(!/[—§]/.test(text), `${family} has an em dash or section sign`);
  }
});

test('the offer and Profile line comes from the record', () => {
  assert.equal(modelLicenceLine('sing'), modelLicence('sing')!.offerLine);
  assert.equal(modelPartNote('sing'), modelLicence('sing')!.offerLine);
  assert.equal(modelLicenceLine('whisper'), undefined, 'no offerLine, no sentence');
  for (const id of MODEL_PART_IDS) if (id !== 'sing') assert.equal(modelPartNote(id), undefined, id);
});
