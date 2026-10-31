// SPDX-License-Identifier: MPL-2.0
/**
 * The person's own colourway, per design system (lib/colourway-pref.ts, plans/331).
 *
 * What these pin: the profile carries one choice per design system and nothing for
 * the canonical colourway; a record from another build or a damaged one reads as
 * absent rather than throwing; the active design system's id decides which choice
 * is read; and a host with no profile has no choice.
 *
 * Run directly:  node --test shells/web/src/lib/colourway-pref.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLOURWAYS_FIELD, activeSystemId, personalColourway, readColourwayChoices, setPersonalColourway,
} from './colourway-pref.ts';

function fakeHost(profile: Record<string, unknown> = {}, active: string | null = 'shipped') {
  let record: Record<string, unknown> = structuredClone(profile);
  const writes: Record<string, unknown>[] = [];
  return {
    get record() { return record; },
    writes,
    profile: {
      get: async () => record,
      set: async (next: object) => { record = structuredClone(next) as Record<string, unknown>; writes.push(record); },
    },
    tokens: { active: async () => (active ? { id: active } : null) },
  };
}

test('a stored record reads as one colourway per design system, and junk reads as absent', () => {
  assert.deepEqual(readColourwayChoices({ shipped: 'midnight', 'acme-2026': 'Beach colourway' }), { shipped: 'midnight', 'acme-2026': 'Beach colourway' });
  assert.deepEqual(readColourwayChoices(null), {});
  assert.deepEqual(readColourwayChoices('midnight'), {});
  assert.deepEqual(readColourwayChoices(['midnight']), {});
  assert.deepEqual(readColourwayChoices({ shipped: 7, 'Not An Id': 'beach', default: '', other: ' padded ' }), {});
  assert.deepEqual(readColourwayChoices({ shipped: 'x'.repeat(129) }), {}, 'an id longer than any design system writes');
  const many = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`system-${i}`, 'beach']));
  assert.equal(Object.keys(readColourwayChoices(many)).length, 64, 'a damaged record cannot grow without bound');
});

test('the choice read is the active design system\'s', async () => {
  const host = fakeHost({ [COLOURWAYS_FIELD]: { shipped: 'midnight', acme: 'persimmon' } });
  assert.equal(await activeSystemId(host), 'shipped');
  assert.equal(await personalColourway(host), 'midnight');
  assert.equal(await personalColourway(host, 'acme'), 'persimmon');
  assert.equal(await personalColourway(host, 'globex'), null);
  assert.equal(await personalColourway(fakeHost({ [COLOURWAYS_FIELD]: { shipped: 'midnight' } }, null)), null, 'no active design system, no choice');
  assert.equal(await personalColourway({ tokens: host.tokens }), null, 'a host with no profile has no choice');
  const broken = { profile: { get: async () => { throw new Error('offline'); } }, tokens: host.tokens };
  assert.equal(await personalColourway(broken), null);
});

test('saving keeps every other design system\'s choice, and clearing removes the field once empty', async () => {
  const host = fakeHost({ firstname: 'Ada', [COLOURWAYS_FIELD]: { acme: 'persimmon' } });
  await setPersonalColourway(host, 'shipped', 'midnight');
  assert.deepEqual(host.record[COLOURWAYS_FIELD], { acme: 'persimmon', shipped: 'midnight' });
  assert.equal(host.record.firstname, 'Ada', 'the rest of the profile is untouched');
  await setPersonalColourway(host, 'shipped', null);
  assert.deepEqual(host.record[COLOURWAYS_FIELD], { acme: 'persimmon' });
  await setPersonalColourway(host, 'acme', null);
  assert.equal(COLOURWAYS_FIELD in host.record, false, 'an empty map leaves no field behind');
  assert.deepEqual(Object.keys(host.record), ['firstname']);
});

test('a write the module cannot vouch for is not made', async () => {
  const host = fakeHost();
  await setPersonalColourway(host, 'Not An Id', 'midnight');
  await setPersonalColourway(host, 'shipped', '');
  assert.equal(host.writes.length, 0);
  const readOnly = { profile: { get: async () => ({}) } };
  await setPersonalColourway(readOnly, 'shipped', 'midnight');
});
