// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createP2PCollabHistory } from './rtc-history.ts';

const at = (n: number) => new Date(Date.UTC(2026, 8, 7, 10, n, 0)).toISOString();

test('captured P2P revisions list newest-first and read their frozen payload', async () => {
  const history = createP2PCollabHistory({ role: 'writer', host: true });
  const first = history.capture({ documentId: 'doc', toolId: 'design', label: 'Draft', actorId: 'peer-1', at: at(0), data: { title: 'old' } });
  const second = history.capture({ documentId: 'doc', toolId: 'design', label: 'Poster', actorId: 'peer-2', at: at(5), data: { title: 'new' } });
  assert.notEqual(first.id, second.id);

  const page = await history.list();
  assert.equal(page.entries[0]?.label, 'Poster');
  assert.equal(page.entries[1]?.label, 'Draft');
  assert.deepEqual(await history.read(first.id), { title: 'old' });
  // Save a copy hands back the same frozen payload; the durable write is the caller's.
  assert.deepEqual(await history.saveCopy(second.id), { title: 'new' });
  assert.equal(await history.read('p2p:404'), null);
});

test('a host writer still cannot restore over the live P2P document', () => {
  const history = createP2PCollabHistory({ role: 'writer', host: true });
  // Shared restore needs the negotiated barrier protocol (plan 221 section 9); until then
  // this is a read/copy view exactly like the Work adapter, whatever the policy allows.
  assert.equal(history.canRestore, false);
  assert.equal(history.canSaveCopy, true);
  assert.equal(typeof (history as { restore?: unknown }).restore, 'undefined');
});

test('the host shares its session; an invitee keeps memory-only history', () => {
  assert.equal(createP2PCollabHistory({ role: 'writer', host: true }).scope, 'shared');
  const invitee = createP2PCollabHistory({ role: 'observer', host: false });
  assert.equal(invitee.scope, 'memory');
  assert.equal(invitee.durability, 'session');
  assert.equal(invitee.canSaveCopy, true);
});

test('dispose drops every retained checkpoint so a remount begins empty', async () => {
  const history = createP2PCollabHistory({ role: 'writer', host: false });
  const entry = history.capture({ documentId: 'doc', toolId: 'design', actorId: 'peer-1', data: { title: 'x' } });
  assert.equal((await history.list()).entries.length, 1);
  history.dispose();
  assert.equal((await history.list()).entries.length, 0);
  assert.equal(await history.read(entry.id), null);
  // Capture after dispose is inert: a session that has left cannot grow its log.
  history.capture({ documentId: 'doc', toolId: 'design', actorId: 'peer-1', data: { title: 'y' } });
  assert.equal((await history.list()).entries.length, 0);
});

test('the memory log is bounded, dropping the oldest checkpoints first', async () => {
  const history = createP2PCollabHistory({ role: 'writer', host: true, limit: 3 });
  for (let i = 0; i < 5; i++) history.capture({ documentId: 'doc', toolId: 'design', label: `r${i}`, actorId: 'peer-1', data: { n: i } });
  const page = await history.list();
  assert.equal(page.entries.length, 3);
  assert.deepEqual(page.entries.map(e => e.label), ['r4', 'r3', 'r2']);
});

test('list honours a limit without dropping stored checkpoints', async () => {
  const history = createP2PCollabHistory({ role: 'writer', host: true });
  for (let i = 0; i < 4; i++) history.capture({ documentId: 'doc', toolId: 'design', label: `r${i}`, actorId: 'peer-1', data: { n: i } });
  assert.deepEqual((await history.list({ limit: 2 })).entries.map(e => e.label), ['r3', 'r2']);
  assert.equal((await history.list()).entries.length, 4);
});
