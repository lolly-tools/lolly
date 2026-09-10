// SPDX-License-Identifier: MPL-2.0
/** lib/hidden-templates.ts - the per-user "hide this shipped starter" overlay; mirrors hidden-tools. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { isTemplateHidden, loadHiddenTemplates, saveHiddenTemplates } from './hidden-templates.ts';
import type { Profile } from '@lolly-tools/core/host-v1';

test('loadHiddenTemplates: absent / junk profiles read as empty', () => {
  assert.equal(loadHiddenTemplates(null).size, 0);
  assert.equal(loadHiddenTemplates(undefined).size, 0);
  assert.equal(loadHiddenTemplates({} as Profile).size, 0);
  assert.equal(loadHiddenTemplates({ hiddenTemplates: 'nope' } as unknown as Profile).size, 0);
});

test('loadHiddenTemplates: keeps shipped refs only - user refs, bare ids and junk drop', () => {
  const profile = { hiddenTemplates: ['design:poster', 'user:abc', 'poster', 42, null, 'chart:bars'] } as unknown as Profile;
  const set = loadHiddenTemplates(profile);
  assert.deepEqual([...set].sort(), ['chart:bars', 'design:poster']);
  assert.equal(isTemplateHidden(set, 'design', 'poster'), true);
  assert.equal(isTemplateHidden(set, 'design', 'carousel'), false);
});

test('saveHiddenTemplates: writes the set onto the profile, latches seeded, persists the same instance', async () => {
  const profile = { hiddenTemplates: ['old:one'] } as unknown as Profile;
  let persisted: Profile | null = null;
  const host = { profile: { set: async (p: Profile) => { persisted = p; } } };
  await saveHiddenTemplates(host as never, profile, new Set(['design:poster', 'user:junk', 'chart:bars']));
  assert.deepEqual(profile.hiddenTemplates?.sort(), ['chart:bars', 'design:poster']);
  assert.equal(profile.hiddenTemplatesSeeded, true);
  assert.equal(persisted, profile);
});

test('saveHiddenTemplates: a failed persist is non-fatal and still mutates the profile', async () => {
  const profile = {} as Profile;
  const host = { profile: { set: async () => { throw new Error('quota'); } } };
  await saveHiddenTemplates(host as never, profile, new Set(['design:poster']));
  assert.deepEqual(profile.hiddenTemplates, ['design:poster']);
});

const DEFAULTS = ['design:poster', 'chart:bars', 'user:not-a-default'];

test('loadHiddenTemplates: brand defaults merge into a fresh profile (shipped refs only)', () => {
  const set = loadHiddenTemplates({} as Profile, DEFAULTS);
  assert.deepEqual([...set].sort(), ['chart:bars', 'design:poster']);
  const withStored = loadHiddenTemplates({ hiddenTemplates: ['qr-code:wifi'] } as unknown as Profile, DEFAULTS);
  assert.deepEqual([...withStored].sort(), ['chart:bars', 'design:poster', 'qr-code:wifi']);
});

test('loadHiddenTemplates: once seeded the stored set is authoritative - an un-hidden default stays revealed', () => {
  const profile = { hiddenTemplates: ['chart:bars'], hiddenTemplatesSeeded: true } as unknown as Profile;
  assert.deepEqual([...loadHiddenTemplates(profile, DEFAULTS)], ['chart:bars']);
});
