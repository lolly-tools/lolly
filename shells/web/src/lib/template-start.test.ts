// SPDX-License-Identifier: MPL-2.0
/** lib/template-start.ts - the per-tool "Start with" setting. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { START_BLANK, loadTemplateStart, saveTemplateStart } from './template-start.ts';
import type { Profile } from '@lolly-tools/core/host-v1';

test('loadTemplateStart: absent = ask (null); blank; a full ref; junk reads as ask', () => {
  assert.equal(loadTemplateStart(null, 'design'), null);
  assert.equal(loadTemplateStart({} as Profile, 'design'), null);
  assert.equal(loadTemplateStart({ templateStart: { design: 'blank' } } as Profile, 'design'), START_BLANK);
  assert.equal(loadTemplateStart({ templateStart: { design: 'design:poster' } } as Profile, 'design'), 'design:poster');
  assert.equal(loadTemplateStart({ templateStart: { design: 'user:u1' } } as Profile, 'design'), 'user:u1');
  assert.equal(loadTemplateStart({ templateStart: { design: 'poster' } } as Profile, 'design'), null, 'a bare id is not a setting');
  assert.equal(loadTemplateStart({ templateStart: { design: 7 } } as unknown as Profile, 'design'), null);
  assert.equal(loadTemplateStart({ templateStart: 'nope' } as unknown as Profile, 'design'), null);
  assert.equal(loadTemplateStart({ templateStart: { design: 'blank' } } as Profile, 'chart'), null, 'per tool');
});

test('saveTemplateStart: sets, clears, refuses junk, persists the same instance', async () => {
  const profile = {} as Profile;
  let persisted = 0;
  const host = { profile: { set: async (p: Profile) => { persisted += p === profile ? 1 : 0; } } };
  await saveTemplateStart(host as never, profile, 'design', 'design:poster');
  assert.deepEqual(profile.templateStart, { design: 'design:poster' });
  await saveTemplateStart(host as never, profile, 'chart', START_BLANK);
  assert.deepEqual(profile.templateStart, { design: 'design:poster', chart: 'blank' });
  await saveTemplateStart(host as never, profile, 'design', 'poster');   // bare id: refused, nothing written
  assert.deepEqual(profile.templateStart, { design: 'design:poster', chart: 'blank' });
  assert.equal(persisted, 2);
  await saveTemplateStart(host as never, profile, 'design', null);
  assert.deepEqual(profile.templateStart, { chart: 'blank' });
  await saveTemplateStart(host as never, profile, 'chart', null);
  assert.equal(profile.templateStart, undefined, 'an empty map is removed');
});

test('saveTemplateStart: a failed persist is non-fatal', async () => {
  const profile = {} as Profile;
  const host = { profile: { set: async () => { throw new Error('quota'); } } };
  await saveTemplateStart(host as never, profile, 'design', 'blank');
  assert.deepEqual(profile.templateStart, { design: 'blank' });
});
