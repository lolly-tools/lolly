// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { usageSystem, withUsageSystem, replaceUsageRule, removeUsageRule, usageDependencies } from './usage-model.ts';

test('guide edits preserve foreign extensions, unfamiliar roles and unsupported rules', () => {
  const system = usageSystem({}, 'Beacon');
  system.roles.push({ id: 'ribbon', label: 'Signal ribbon', resources: [{ type: 'token', path: 'geometry.signal' }] });
  system.rules.push({ id: 'unknown', label: 'Wave rhythm', kind: 'future-wave-spacing', roleIds: ['ribbon'], parameters: { spacing: 3 }, review: { state: 'draft' }, requirement: 'required', origin: { kind: 'source', reference: 'manual.pdf', locator: 'page 8' } });
  const doc = { untouched: { $value: 'kept' }, $extensions: { foreign: { complex: ['kept'] }, 'com.suse.lolly': { future: true } } };
  const updated = withUsageSystem(doc, system);
  assert.deepEqual(usageSystem(updated, 'Fallback'), system);
  assert.deepEqual(doc.$extensions, { foreign: { complex: ['kept'] }, 'com.suse.lolly': { future: true } });
  assert.equal((updated.$extensions as any)['com.suse.lolly'].future, true);
  const renamed = replaceUsageRule(system, { ...system.rules[0]!, label: 'New label' });
  assert.equal(system.rules[0]!.label, 'Wave rhythm');
  assert.deepEqual(renamed.rules[0]!.parameters, { spacing: 3 });
});

test('removing a rule updates guide groups and retains reusable brand resources', () => {
  const system = usageSystem({}, 'Beacon');
  system.roles.push({ id: 'voice', label: 'Voice', resources: [{ type: 'token', path: 'type.voice' }] });
  system.rules.push({ id: 'short', label: 'Short title', kind: 'text-length', roleIds: [], parameters: { slot: 'heading', max: 40 }, requirement: 'required', origin: { kind: 'manual', author: 'Studio' }, review: { state: 'draft' } });
  system.guide = { groups: [{ id: 'posters', label: 'Posters', roleIds: ['voice'], ruleIds: ['short'] }] };
  const next = removeUsageRule(system, 'short');
  assert.equal(next.rules.length, 0);
  assert.deepEqual(next.guide!.groups[0]!.ruleIds, []);
  assert.deepEqual(next.roles, system.roles);
  assert.equal(system.rules.length, 1);
});

test('future or malformed guide records cannot be silently replaced by a new guide', () => {
  const doc = { $extensions: { 'com.suse.lolly': { brandSystem: { schemaVersion: 2, future: true } } } };
  assert.throws(() => usageSystem(doc, 'Future'), /original guide has been kept/);
  assert.throws(() => withUsageSystem(doc, usageSystem({}, 'New')), /original guide has been kept/);
  assert.equal(doc.$extensions['com.suse.lolly'].brandSystem.schemaVersion, 2);
});

test('proof invalidation follows content and stored revisions, not ephemeral URLs or visit times', async () => {
  let version = '1', visited = 1;
  const host = { tokens: { activeRecord: async () => ({ id: 'test', headId: 'user/tokens/brand', importedFonts: ['user/font/voice'], lastUsedAt: visited++ }) }, assets: {
    _getUserRecord: async () => ({ version, checksum: version }),
    get: async () => ({ id: 'user/font/voice', type: 'font', format: 'ttf', url: `blob:${visited}`, version }),
  } } as unknown as Parameters<typeof usageDependencies>[0];
  const first = await usageDependencies(host, { value: 'before' });
  assert.equal(await usageDependencies(host, { value: 'before' }), first);
  assert.notEqual(await usageDependencies(host, { value: 'after' }), first);
  version = '2';
  assert.notEqual(await usageDependencies(host, { value: 'before' }), first);
});
