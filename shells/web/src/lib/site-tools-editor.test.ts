// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import type { LiveEditor } from './live-agent.ts';
import type { AgentControls } from './agent-collaborators.ts';
import { createSiteEditor } from './site-tools-editor.ts';

function fixture() {
  let rows: unknown[] = [{ id: 'title', kind: 'text', text: 'Hello', x: 0 }];
  let readOnly = false, controls: AgentControls | undefined, joins = 0, removed = 0;
  const history: Array<{ before: unknown[] }> = [];
  const editor: LiveEditor = {
    documentId: 'doc:test', tool: 'design', engine: 'test', surface: 'web', rows: () => structuredClone(rows),
    size: () => ({ width: 1200, height: 800 }), selection: () => ['title'], fieldDefault: (_id, fallback) => fallback,
    async commit(next) { const entry = { before: rows }; history.push(entry); rows = next; return entry; },
    topEntry: () => history.at(-1) ?? null, undo() { rows = history.pop()!.before; }, readOnly: () => readOnly,
    look: async () => ({ svg: '<svg/>', width: 1200, height: 800 }),
  };
  const roster = { join(_name: string, next: AgentControls) {
    joins++; controls = next; return { id: 'agent', update() {}, remove() { removed++; } };
  } };
  const port = createSiteEditor(async () => editor, roster, () => true);
  const changes = async (transactionId: string) => {
    const doc = await port.request('document.get', {}) as { documentId: string; revision: string };
    return { documentId: doc.documentId, ifRevision: doc.revision, transactionId, label: 'Move title', layerPatches: [{ id: 'title', set: { x: 25 } }] };
  };
  return { port, editor, history, changes, controls: () => controls!, counts: () => ({ joins, removed }), lock: () => { readOnly = true; },
    humanEdit() { history.push({ before: rows }); rows = [{ id: 'title', kind: 'text', x: 77 }]; } };
}

test('parallel document reads join once and repeated edits produce one history step', async () => {
  const f = fixture();
  await Promise.all([f.port.request('document.get', {}), f.port.request('document.context', {})]);
  assert.equal(f.counts().joins, 1);
  const args = await f.changes('move-title');
  await f.port.request('document.apply', args);
  assert.equal((await f.port.request('document.apply', args) as { replayed: boolean }).replayed, true);
  assert.equal(f.history.length, 1);
  assert.equal((await f.port.request('look', { documentId: 'doc:test' }) as { svg: string }).svg, '<svg/>');
  f.port.close(); assert.equal(f.counts().removed, 1);
});

test('pause permits reads but blocks writes; disconnect prevents future calls', async () => {
  const f = fixture(), args = await f.changes('paused');
  f.controls().pause(true); assert.equal(f.port.state().paused, true);
  await f.port.request('document.get', {});
  await assert.rejects(f.port.request('document.apply', args), /paused/);
  f.controls().pause(false); await f.port.request('document.apply', args);
  f.controls().disconnect(); assert.equal(f.port.state().closed, true);
  await assert.rejects(f.port.request('document.get', {}), /disconnected/);
  f.port.close(); assert.equal(f.counts().removed, 1);
});

test('read-only documents, stale revisions and wrong document ids are refused', async () => {
  const f = fixture(), args = await f.changes('stale');
  f.humanEdit(); await assert.rejects(f.port.request('document.apply', args), /changed/);
  await assert.rejects(f.port.request('document.get', { documentId: 'another' }), /different document/);
  f.lock(); await assert.rejects(f.port.request('document.apply', await f.changes('locked')), /read-only/);
  assert.equal(f.history.length, 1); f.port.close();
});

test('undo cannot take back a human change after an agent edit', async () => {
  const f = fixture();
  await f.port.request('document.apply', await f.changes('mine'));
  f.humanEdit();
  await assert.rejects(f.port.request('history.undo', { documentId: 'doc:test' }), /not this agent/);
  assert.equal(f.history.length, 2); f.port.close();
});

test('leaving during editor loading never joins a roster or revives the old document', async () => {
  let resolve!: (editor: LiveEditor) => void;
  const editor = fixture().editor; let joined = false;
  const port = createSiteEditor(() => new Promise(done => { resolve = done; }), { join() { joined = true; throw new Error('Old roster'); } }, () => true);
  const pending = port.request('document.get', {});
  port.close(); resolve(editor);
  await assert.rejects(pending, /disconnected/); assert.equal(joined, false);
});
