// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readAgentPresence } from '../src/agent-presence-v1.ts';
import { readPresenceFrame } from '../src/collab-presence-v1.ts';
import { liveInvitationUrl, readLiveInvitation, readLiveRelay } from '../src/live-invite-v1.ts';

test('delegated agents are bounded display data under the authenticated sender', () => {
  const agent = { id: 'bot', name: '<b>Agent</b>\nSmith', colorIndex: 999, phase: 'working', userId: 'spoof', change: { id: 'txn', label: 'Moved title', width: 1200, height: 800, targets: [{ id: 'title', kind: 'changed', x: 10, y: 20, w: 100, h: 40 }, { id: 'bad', kind: 'removed', x: Infinity, y: 0, w: 1, h: 1 }] } };
  const frame = readPresenceFrame({ v: 1, from: 'spoof', seq: 1, state: { agents: [agent, agent, { ...agent, id: 'two', phase: 'unknown' }] } }, { from: 'device', epoch: 'device', seq: 1, userId: 'member', name: 'Ada' })!;
  assert.equal(frame.from, 'device');
  const agents = frame.state!.agents!;
  assert.equal(agents.length, 1); assert.equal(agents[0]!.name, '<b>Agent</b> Smith');
  assert.equal(agents[0]!.colorIndex, 0); assert.equal(Object.hasOwn(agents[0]!, 'userId'), false);
  assert.equal(agents[0]!.change!.targets.length, 1);
  assert.equal(readAgentPresence(Array.from({ length: 100 }, (_, i) => ({ ...agent, id: String(i) }))).length, 4);
});

test('invitation secrets stay in fragments and endpoint credentials cannot be substituted', () => {
  const token = 'a'.repeat(43);
  const invite = liveInvitationUrl('https://relay.example/live', token);
  assert.deepEqual(readLiveInvitation(invite), { base: 'https://relay.example/live', token });
  assert.equal(new URL(invite).search, '');
  for (const value of ['https://user:pass@relay.example/live/invite', 'http://relay.example/live/invite', 'https://relay.example/other/invite', 'https://relay.example/live/invite?token=oops']) assert.equal(readLiveInvitation(`${value}#token=${token}`), null);
  assert.equal(readLiveRelay('/live', 'https://lolly.example'), 'https://lolly.example/live');
  assert.equal(readLiveRelay('http://localhost:8790/live/'), 'http://localhost:8790/live');
  for (const value of ['https://user:pass@relay.example/live', 'http://relay.example/live', 'https://relay.example/other', 'https://relay.example/live?token=oops', 'https://relay.example/live#token=oops']) assert.equal(readLiveRelay(value), null);
});
