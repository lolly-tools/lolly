// SPDX-License-Identifier: MPL-2.0
/**
 * lib/hidden-tools.ts - the per-user "hide this tool" overlay store. Mirrors
 * lib/favourites.ts: profile-backed, tolerant of junk, best-effort persistence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadHiddenTools, saveHiddenTools } from './hidden-tools.ts';
import type { Profile } from '@lolly-tools/core/host-v1';

test('loadHiddenTools: absent / junk profiles read as empty', () => {
  assert.equal(loadHiddenTools(null).size, 0);
  assert.equal(loadHiddenTools(undefined).size, 0);
  assert.equal(loadHiddenTools({} as Profile).size, 0);
  assert.equal(loadHiddenTools({ hiddenTools: 'nope' } as unknown as Profile).size, 0);
});

test('loadHiddenTools: keeps strings (tool ids and view: keys), drops junk entries', () => {
  const profile = { hiddenTools: ['qr-code', 'view:verify', 42, null, 'street-map'] } as unknown as Profile;
  const set = loadHiddenTools(profile);
  assert.deepEqual([...set].sort(), ['qr-code', 'street-map', 'view:verify']);
});

test('saveHiddenTools: writes the set onto the profile and persists via host.profile.set', async () => {
  const profile = { hiddenTools: ['old'] } as unknown as Profile;
  let persisted: Profile | null = null;
  const host = { profile: { set: async (p: Profile) => { persisted = p; } } };
  await saveHiddenTools(host as never, profile, new Set(['a', 'view:b']));
  assert.deepEqual(profile.hiddenTools?.sort(), ['a', 'view:b']);
  assert.equal(persisted, profile);   // the SAME cached instance, so later reads see it
});

test('saveHiddenTools: a failed persist is non-fatal and still mutates the profile', async () => {
  const profile = {} as Profile;
  const host = { profile: { set: async () => { throw new Error('quota'); } } };
  await saveHiddenTools(host as never, profile, new Set(['x']));
  assert.deepEqual(profile.hiddenTools, ['x']);
});

// ─── shipped default-hidden set (the SUSE "start these hidden" curation) ───────

const DEFAULTS = ['3d', 'booth-studio', 'org-chart'];

test('loadHiddenTools: merges the brand defaults into a fresh (un-seeded) profile', () => {
  // A brand-new user: no hiddenTools, not seeded → the defaults ARE hidden.
  const set = loadHiddenTools({} as Profile, DEFAULTS);
  assert.deepEqual([...set].sort(), ['3d', 'booth-studio', 'org-chart']);
  // and they union with anything already stored (junk still dropped).
  const withStored = loadHiddenTools({ hiddenTools: ['qr-code', 7] } as unknown as Profile, DEFAULTS);
  assert.deepEqual([...withStored].sort(), ['3d', 'booth-studio', 'org-chart', 'qr-code']);
});

test('loadHiddenTools: once seeded, defaults are NOT re-merged - the stored set is authoritative', () => {
  // The user unhid a default; hiddenToolsSeeded latched true on that save. The default
  // must stay revealed, never creep back in.
  const profile = { hiddenTools: ['booth-studio'], hiddenToolsSeeded: true } as unknown as Profile;
  const set = loadHiddenTools(profile, DEFAULTS);
  assert.deepEqual([...set].sort(), ['booth-studio']);   // 3d + org-chart stay revealed
});

test('saveHiddenTools: latches hiddenToolsSeeded so the defaults are baked in once', async () => {
  const profile = {} as Profile;
  const host = { profile: { set: async () => {} } };
  await saveHiddenTools(host as never, profile, new Set(['3d']));
  assert.equal(profile.hiddenToolsSeeded, true);
});

test('default-hidden round-trip: un-hiding a default sticks across a reload', async () => {
  const host = { profile: { set: async () => {} } };
  // Fresh profile: the gallery reads the merged set (defaults hidden).
  const profile = {} as Profile;
  const shown = loadHiddenTools(profile, DEFAULTS);
  assert.ok(shown.has('org-chart'));
  // User un-hides org-chart → the gallery saves the current (merged) set minus it.
  shown.delete('org-chart');
  await saveHiddenTools(host as never, profile, shown);
  // Next load, still passing the same brand defaults: org-chart stays revealed.
  const reloaded = loadHiddenTools(profile, DEFAULTS);
  assert.ok(!reloaded.has('org-chart'), 'un-hidden default must not come back');
  assert.deepEqual([...reloaded].sort(), ['3d', 'booth-studio']);
});
