// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_ROLES, ACCESS_LEVELS, abilitiesOf, accessRank, atLeast, audienceCeiling, clampRole, daysLeft,
  expiryInDays, grantLive, higherLevel, principalKey, readGeneralAccess, readShareGrant, readShareGroupDetail,
  readShareGroupSummary, readSharePolicy, readShareSettings, readShareState, rolesForAudience,
} from '../src/sharing-v1.ts';

test('the ladder orders every level and commenter sits between viewer and editor', () => {
  assert.deepEqual([...SHARE_ROLES], ['viewer', 'commenter', 'editor', 'manager']);
  for (let i = 1; i < ACCESS_LEVELS.length; i++) assert.ok(accessRank(ACCESS_LEVELS[i]) > accessRank(ACCESS_LEVELS[i - 1]));
  assert.ok(atLeast('commenter', 'viewer'));
  assert.ok(!atLeast('commenter', 'editor'));
  assert.equal(accessRank('admin'), 0, 'an unknown level ranks as none');
  assert.ok(!atLeast(undefined, 'viewer'));
  assert.equal(higherLevel('viewer', 'commenter'), 'commenter');
});

test('abilities follow the level and the share settings', () => {
  assert.deepEqual(abilitiesOf('none'), { view: false, comment: false, edit: false, export: false, share: false });
  assert.deepEqual(abilitiesOf('viewer'), { view: true, comment: true, edit: false, export: true, share: false });
  const quiet = { viewersCanComment: false, viewersCanExport: false };
  assert.deepEqual(abilitiesOf('viewer', quiet), { view: true, comment: false, edit: false, export: false, share: false });
  assert.deepEqual(abilitiesOf('commenter', quiet), { view: true, comment: true, edit: false, export: false, share: false });
  assert.equal(abilitiesOf('editor').share, false);
  assert.equal(abilitiesOf('editor', { editorsCanShare: true }).share, true);
  assert.equal(abilitiesOf('manager').share, true);
  assert.equal(abilitiesOf('owner', quiet).export, true);
});

test('audiences cap their roles: public is view only, the instance stops below manager', () => {
  assert.equal(audienceCeiling('restricted'), null);
  assert.equal(audienceCeiling('public', 'editor'), 'viewer');
  assert.equal(audienceCeiling('instance'), 'commenter');
  assert.equal(audienceCeiling('instance', 'editor'), 'editor');
  assert.equal(audienceCeiling('instance', 'manager'), 'editor');
  assert.deepEqual(rolesForAudience('instance'), ['viewer', 'commenter']);
  assert.deepEqual(rolesForAudience('public', 'editor'), ['viewer']);
  assert.deepEqual(rolesForAudience('restricted'), []);
  assert.equal(clampRole('editor', 'commenter'), 'commenter');
  assert.equal(clampRole('viewer', 'commenter'), 'viewer');
});

test('end dates: no date applies, a past date gives nothing, days round up', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  assert.ok(grantLive(undefined, now));
  assert.ok(grantLive('2026-10-07T12:00:01Z', now));
  assert.ok(!grantLive('2026-10-07T12:00:00Z', now));
  assert.ok(!grantLive('not a date', now));
  assert.equal(expiryInDays(7, now), '2026-10-14T12:00:00.000Z');
  assert.equal(daysLeft('2026-10-08T00:00:00Z', now), 1);
  assert.equal(daysLeft('2026-10-01T00:00:00Z', now), 0);
});

test('general access reads safely and clamps public to viewer', () => {
  assert.deepEqual(readGeneralAccess(null), { audience: 'restricted', role: 'viewer' });
  assert.deepEqual(readGeneralAccess({ audience: 'everyone', role: 'editor' }), { audience: 'restricted', role: 'viewer' });
  assert.deepEqual(readGeneralAccess({ audience: 'public', role: 'editor' }), { audience: 'public', role: 'viewer' });
  assert.deepEqual(readGeneralAccess({ audience: 'instance', role: 'commenter' }), { audience: 'instance', role: 'commenter' });
  assert.deepEqual(readGeneralAccess({ audience: 'instance', role: 'manager' }), { audience: 'instance', role: 'editor' });
  assert.deepEqual(readGeneralAccess({ audience: 'instance', role: 'boss' }), { audience: 'instance', role: 'viewer' });
});

test('settings keep booleans only', () => {
  assert.deepEqual(readShareSettings({ viewersCanComment: false, editorsCanShare: 'yes', extra: true }), { viewersCanComment: false });
  assert.deepEqual(readShareSettings([]), {});
});

test('grants need a known role and a readable principal', () => {
  assert.deepEqual(readShareGrant({ principal: { kind: 'group', name: ' brand ' }, role: 'editor' }),
    { principal: { kind: 'group', name: 'brand' }, role: 'editor' });
  assert.deepEqual(
    readShareGrant({ principal: { kind: 'custom-group', id: 'sg_1', name: 'Agency', memberCount: 4 }, role: 'commenter', expiresAt: '2026-10-14T00:00:00Z' }),
    { principal: { kind: 'custom-group', id: 'sg_1', name: 'Agency', memberCount: 4 }, role: 'commenter', expiresAt: '2026-10-14T00:00:00.000Z' });
  assert.equal(readShareGrant({ principal: { kind: 'group', name: 'x' }, role: 'owner' }), null);
  assert.equal(readShareGrant({ principal: { kind: 'robot', id: 'r' }, role: 'viewer' }), null);
  assert.equal(readShareGrant({ principal: { kind: 'custom-group', id: 'has space', name: 'x' }, role: 'viewer' }), null);
  const noDate = readShareGrant({ principal: { kind: 'group', name: 'x' }, role: 'viewer', expiresAt: 'soon' });
  assert.equal(noDate?.expiresAt, undefined);
  assert.equal(principalKey({ kind: 'group', name: 'x' }), 'group:x');
  assert.equal(principalKey({ kind: 'custom-group', id: 'sg_1', name: 'x' }), 'custom-group:sg_1');
});

test('policy fills safe defaults and always offers restricted', () => {
  assert.deepEqual(readSharePolicy(undefined), {
    audiences: ['restricted'], instanceMaxRole: 'commenter', roles: ['viewer', 'commenter', 'editor', 'manager'], customGroups: false,
  });
  assert.deepEqual(readSharePolicy({ audiences: ['instance', 'bogus'], instanceMaxRole: 'editor', roles: ['viewer', 'editor'], customGroups: true, maxGrantDays: 90 }), {
    audiences: ['restricted', 'instance'], instanceMaxRole: 'editor', roles: ['viewer', 'editor'], customGroups: true, maxGrantDays: 90,
  });
});

test('a share state drops bad grants, de-duplicates principals and bounds expiries', () => {
  const state = readShareState({
    general: { audience: 'instance', role: 'viewer' },
    grants: [
      { principal: { kind: 'group', name: 'brand' }, role: 'editor' },
      { principal: { kind: 'group', name: 'brand' }, role: 'viewer' },
      { principal: { kind: 'group' }, role: 'viewer' },
      'nonsense',
    ],
    expiries: { usr_a: '2026-10-14T00:00:00Z', 'bad id': '2026-10-14T00:00:00Z', usr_b: 'never' },
    settings: { viewersCanComment: true },
    policy: { audiences: ['restricted', 'instance'] },
    canManage: true,
  })!;
  assert.deepEqual(state.grants, [{ principal: { kind: 'group', name: 'brand' }, role: 'editor' }]);
  assert.deepEqual(state.expiries, { usr_a: '2026-10-14T00:00:00.000Z' });
  assert.equal(state.canManage, true);
  assert.equal(readShareState('x'), null);
  assert.equal(readShareState({ general: 'instance' }), null);
  assert.deepEqual(readShareState({})!.general, { audience: 'restricted', role: 'viewer' });
});

test('user-made groups read with bounded names and de-duplicated members', () => {
  assert.deepEqual(readShareGroupSummary({ id: 'sg_1', name: 'Agency reviewers', memberCount: 3, myRole: 'owner' }),
    { id: 'sg_1', name: 'Agency reviewers', memberCount: 3, myRole: 'owner' });
  assert.equal(readShareGroupSummary({ id: 'sg_1', name: 'x', myRole: 'boss' }), null);
  assert.equal(readShareGroupSummary({ id: 'sg_1', name: '   ', myRole: 'member' }), null);
  const long = readShareGroupSummary({ id: 'sg_2', name: 'n'.repeat(300), myRole: 'member' })!;
  assert.equal(long.name.length, 80);
  assert.equal(long.memberCount, 0);
  const detail = readShareGroupDetail({
    id: 'sg_1', name: 'Agency', memberCount: 2, myRole: 'manager',
    members: [{ id: 'usr_a', name: 'Ann', role: 'owner' }, { id: 'usr_a', name: 'Ann again' }, { id: 'usr_b', name: 'Bo' }, { name: 'nobody' }],
  })!;
  assert.deepEqual(detail.members, [{ id: 'usr_a', name: 'Ann', role: 'owner' }, { id: 'usr_b', name: 'Bo', role: 'member' }]);
});
