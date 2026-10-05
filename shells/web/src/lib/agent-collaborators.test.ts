// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { agentRosterFor } from './agent-collaborators.ts';
import { mountCollabPill } from '../components/collab-pill.ts';
import { mountAgentChanges } from '../components/agent-changes.ts';
import type { CollabParticipant, CollabSessionState } from './collab-session.ts';
import type { PresencePeer } from './collab-presence.ts';
import { readAgentPresence } from '@lolly-tools/core/agent-presence-v1';
import { createOpGuard } from '../collab/op-guard.ts';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/t/design', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, getComputedStyle: dom.window.getComputedStyle.bind(dom.window), MutationObserver: dom.window.MutationObserver, requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window) });
const person = (id: string, self = false): CollabParticipant => ({ clientId: id, userId: id, name: id, color: '#88ccff', colorIndex: self ? 0 : 1, isSelf: self, isHost: self, away: false, inviteeIndex: 1, role: 'writer' });

test('four busy agents fit the existing guarded presence lane', () => {
  const agents = readAgentPresence(Array.from({ length: 4 }, (_, index) => ({ id: String(index).repeat(128), name: 'A'.repeat(60), colorIndex: index, phase: 'working', activity: 'A'.repeat(80), change: { id: 'A'.repeat(128), label: 'A'.repeat(80), width: 1200, height: 800, targets: Array.from({ length: 50 }, (_, i) => ({ id: String(i).padStart(256, 'A'), kind: 'changed', x: 0, y: 0, w: 100, h: 100 })) } })));
  const result = createOpGuard({ inputs: [] }).checkPresence({ userId: 'Ada', name: 'Ada', color: '#88ccff', cursor: { x: 0, y: 0 }, selection: [], agents });
  assert.deepEqual(result.rejected, []); assert.ok(result.ok);
});

test('people and delegated agents share one roster, with controls only for local agents', () => {
  const stage = document.createElement('main'); document.body.appendChild(stage);
  const roster = agentRosterFor(stage);
  let state: CollabSessionState = { connection: 'live', role: 'writer', self: person('Ada', true), peers: [person('Bea')] };
  const listeners = new Set<() => void>();
  let raw: PresencePeer[] = [{ id: 'Bea', seq: 1, away: false, firstSeen: 0, lastSeen: 0, state: { userId: 'Bea', name: 'Bea', color: '#88ccff', agents: [{ id: 'remote', name: 'Bea assistant', colorIndex: 2, phase: 'working' }] } }];
  const detach = roster.attach({ state: () => state, subscribe(fn) { const changed = () => fn(state); listeners.add(changed); return () => { listeners.delete(changed); }; } }, () => raw);
  const paused: boolean[] = [];
  const agent = roster.join('My agent', { pause: value => paused.push(value), disconnect: () => agent.remove() });
  const pill = mountCollabPill(stage, { source: roster, reducedMotion: () => true, announce: () => {}, onPauseAgent: id => roster.pause(id), onDisconnectAgent: id => roster.disconnect(id) });
  try {
    assert.equal(roster.state().peers.length, 3);
    const remote = roster.state().peers.find(peer => peer.kind === 'agent' && peer.delegatedBy === 'Bea')!;
    assert.equal(remote.userId, 'Bea'); assert.match(remote.clientId, /^Bea:agent:/);
    pill.el.querySelector<HTMLButtonElement>('.collab-stack')!.click();
    assert.equal(document.querySelectorAll('.collab-roster-row').length, 4);
    assert.equal(document.querySelectorAll('[data-agent-action="pause"]').length, 1);
    assert.ok(document.querySelector('.collab-roster')!.textContent!.includes('AI agent'));
    const pause = document.querySelector<HTMLButtonElement>('[data-agent-action="pause"]')!; pause.focus(); pause.click();
    assert.deepEqual(paused, [true]); assert.equal(roster.local()[0]!.phase, 'paused');
    assert.equal((document.activeElement as HTMLElement).dataset.agentAction, 'pause');
    assert.equal(document.activeElement!.textContent, 'Resume agent');
    state = { ...state, peers: [] }; raw = []; for (const notify of listeners) notify();
    assert.equal(roster.state().peers.length, 1);
    document.querySelector<HTMLButtonElement>('[data-agent-action="disconnect"]')!.click();
    assert.equal(roster.local().length, 0);
  } finally { pill.destroy(); detach(); agent.remove(); stage.remove(); }
});

test('change outlines stay outside exports, expire, and reanchor after zoom', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const stage = document.createElement('main'), canvas = document.createElement('div');
  canvas.innerHTML = '<svg><text>Hello</text></svg>'; stage.appendChild(canvas); document.body.appendChild(stage);
  let scale = 1;
  canvas.getBoundingClientRect = () => ({ x: 100, y: 50, left: 100, top: 50, right: 100 + 1000 * scale, bottom: 50 + 500 * scale, width: 1000 * scale, height: 500 * scale, toJSON() {} });
  const roster = agentRosterFor(stage), agent = roster.join('Assistant', { pause() {}, disconnect() {} });
  const overlay = mountAgentChanges(stage, canvas, roster);
  try {
    const original = canvas.innerHTML;
    agent.update({ change: { id: 'change', label: 'Move heading', width: 1000, height: 500, targets: [{ id: 'title', kind: 'changed', x: 20, y: 30, w: 200, h: 60 }] } });
    const cue = stage.querySelector<HTMLElement>('.agent-change')!;
    assert.ok(cue); assert.equal(canvas.contains(cue), false); assert.equal(canvas.innerHTML, original);
    assert.equal(cue.style.width, '200px');
    scale = 2; overlay.reanchor(); assert.equal(cue.style.width, '400px');
    context.mock.timers.tick(4001); assert.equal(stage.querySelector('.agent-change'), null);
    agent.update({ activity: 'Still here' }); assert.equal(stage.querySelector('.agent-change'), null, 'heartbeats cannot replay a receipt');
  } finally { overlay.dispose(); agent.remove(); stage.remove(); context.mock.timers.reset(); }
});
