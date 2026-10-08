// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { RECENT_PROJECT_DAYS, isOwnProject, isRelationship, splitOwnProjects } from './team-project-listing.ts';

const NOW = Date.parse('2026-10-07T12:00:00Z');
const DAY = 86_400_000;

test('a relationship makes a shared project the person’s own; everyone and admin do not', () => {
  for (const via of ['owner', 'member', 'group', 'custom-group'] as const) assert.ok(isOwnProject({ via }, NOW), via);
  assert.ok(!isOwnProject({ via: 'everyone' }, NOW));
  assert.ok(!isOwnProject({ via: 'admin' }, NOW));
  assert.ok(isRelationship({}), 'an older source that says nothing keeps every project listed');
});

test('pinning keeps a project, hiding removes one, and a recent open lists it for 30 days', () => {
  assert.ok(isOwnProject({ via: 'everyone', listed: 'pinned' }, NOW));
  assert.ok(!isOwnProject({ via: 'member', listed: 'hidden' }, NOW), 'a person may hide even their own');
  assert.ok(isOwnProject({ via: 'everyone', lastOpenedAt: new Date(NOW - 2 * DAY).toISOString() }, NOW));
  assert.ok(!isOwnProject({ via: 'everyone', lastOpenedAt: new Date(NOW - (RECENT_PROJECT_DAYS + 1) * DAY).toISOString() }, NOW));
  assert.ok(!isOwnProject({ via: 'everyone', lastOpenedAt: 'never' }, NOW));
  assert.ok(!isOwnProject({ via: 'everyone', listed: 'hidden', lastOpenedAt: new Date(NOW).toISOString() }, NOW));
});

test('splitting keeps order on both sides', () => {
  const list = [
    { id: 'a', via: 'everyone' as const }, { id: 'b', via: 'owner' as const },
    { id: 'c', via: 'everyone' as const, listed: 'pinned' as const }, { id: 'd', via: 'admin' as const },
  ];
  const { own, other } = splitOwnProjects(list, NOW);
  assert.deepEqual(own.map((p) => p.id), ['b', 'c']);
  assert.deepEqual(other.map((p) => p.id), ['a', 'd']);
});
