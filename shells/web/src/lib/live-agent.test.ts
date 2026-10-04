// SPDX-License-Identifier: MPL-2.0
/**
 * lib/live-agent.ts: the editor end of live-v1 (plans/289 D1). A fake editor stands
 * in for Design, with a real undo stack, so the tests can check that an agent edit
 * is one entry and that the agent can only undo its own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_ERRORS, LIVE_LIMITS } from '@lolly-tools/core';
import { cleanNote, createLiveSession, documentRevision, type LiveEditor } from './live-agent.ts';

function fakeEditor(rows: unknown[] = [{ id: 'title', type: 'text', x: 0, y: 0, w: 100, h: 20, text: 'Hello' }]) {
  let current = structuredClone(rows);
  const stack: Array<{ label: string; before: unknown[] }> = [];
  let readOnly = false;
  const editor: LiveEditor & { stack: typeof stack; personEdits(next: unknown[]): void; lock(): void } = {
    tool: 'design', engine: '1.244.0', surface: 'web',
    rows: () => structuredClone(current),
    size: () => ({ width: 1200, height: 800 }),
    selection: () => ['title'],
    fieldDefault: (id, fallback) => (id === 'opacity' ? 1 : fallback),
    async commit(next, note) {
      if (JSON.stringify(next) === JSON.stringify(current)) return null;
      const entry = { label: `AI agent: ${note}`, before: current };
      stack.push(entry);
      current = structuredClone(next);
      return entry;
    },
    topEntry: () => stack[stack.length - 1] ?? null,
    undo() { const e = stack.pop(); if (e) current = e.before; },
    look: async () => ({ svg: '<svg xmlns="http://www.w3.org/2000/svg"/>', width: 1200, height: 800 }),
    readOnly: () => readOnly,
    stack,
    personEdits(next) { stack.push({ label: 'Move', before: current }); current = structuredClone(next); },
    lock() { readOnly = true; },
  };
  return editor;
}

let seq = 0;
const call = async (session: ReturnType<typeof createLiveSession>, method: string, params?: unknown) =>
  JSON.parse(await session.handle(JSON.stringify({ jsonrpc: '2.0', id: ++seq, method, ...(params ? { params } : {}) })));
const hello = (s: ReturnType<typeof createLiveSession>) => call(s, 'hello', { protocol: 'live-v1', client: 'Test agent' });

test('nothing but hello is answered before hello, and hello names the editor', async () => {
  const session = createLiveSession(fakeEditor());
  assert.equal((await call(session, 'document.get')).error.code, LIVE_ERRORS.notReady);
  assert.equal((await call(session, 'hello', { protocol: 'live-v2' })).error.code, LIVE_ERRORS.invalidParams);
  const reply = await hello(session);
  assert.deepEqual(reply.result, { protocol: 'live-v1', tool: 'design', engine: '1.244.0', surface: 'web' });
  assert.equal(session.client(), 'Test agent');
});

test('frames that are not requests are refused with the request id kept where there is one', async () => {
  const session = createLiveSession(fakeEditor());
  assert.equal(JSON.parse(await session.handle('not json')).error.code, LIVE_ERRORS.badRequest);
  assert.equal(JSON.parse(await session.handle('[1]')).error.code, LIVE_ERRORS.badRequest);
  const unknown = JSON.parse(await session.handle(JSON.stringify({ jsonrpc: '2.0', id: 7, method: 'files.write' })));
  assert.equal(unknown.id, 7);
  assert.equal(unknown.error.code, LIVE_ERRORS.methodNotFound);
  const big = JSON.parse(await session.handle(' '.repeat(LIVE_LIMITS.maxRequestBytes + 1)));
  assert.equal(big.error.code, LIVE_ERRORS.limit);
});

test('document.get returns rows, size, selection and a revision that follows the content', async () => {
  const editor = fakeEditor();
  const session = createLiveSession(editor);
  await hello(session);
  const doc = (await call(session, 'document.get')).result;
  assert.equal(doc.width, 1200);
  assert.deepEqual(doc.selection, ['title']);
  assert.equal(doc.rows.length, 1);
  assert.equal(doc.revision, documentRevision(editor.rows(), 1200, 800));
  editor.personEdits([{ ...editor.rows()[0] as object, x: 5 }]);
  assert.notEqual((await call(session, 'document.get')).result.revision, doc.revision);
});

test('document.apply runs operations then patches as ONE history entry with the agent note', async () => {
  const editor = fakeEditor();
  const session = createLiveSession(editor);
  await hello(session);
  const reply = await call(session, 'document.apply', {
    label: 'Add a subtitle\nunder the title',
    layerOperations: [{ op: 'add', afterId: 'title', layer: { id: 'sub', type: 'text', x: 0, y: 30, w: 100, h: 20, text: 'World' } }],
    layerPatches: [{ id: 'sub', set: { text: 'Everyone' } }],
  });
  assert.equal(reply.result.changed, true);
  assert.equal(reply.result.layers, 2);
  assert.equal(editor.stack.length, 1);
  assert.equal(editor.stack[0]!.label, 'AI agent: Add a subtitle under the title');
  assert.equal((editor.rows()[1] as { text: string }).text, 'Everyone');
});

test('a broken edit is refused whole, naming the path, and leaves the document alone', async () => {
  const editor = fakeEditor();
  const session = createLiveSession(editor);
  await hello(session);
  const before = editor.rows();
  const reply = await call(session, 'document.apply', {
    layerPatches: [{ id: 'title', set: { text: 'Changed' } }, { id: 'missing', set: { x: 1 } }],
  });
  assert.equal(reply.error.code, LIVE_ERRORS.refused);
  assert.match(reply.error.message, /\/layerPatches\/1\/id: layer "missing" does not exist/);
  assert.deepEqual(editor.rows(), before);
  assert.equal(editor.stack.length, 0);
  assert.equal((await call(session, 'document.apply', { layerPatches: [], extra: 1 })).error.code, LIVE_ERRORS.invalidParams);
  assert.equal((await call(session, 'document.apply', {})).error.code, LIVE_ERRORS.invalidParams);
});

test('ifRevision refuses an edit made against a stale read', async () => {
  const editor = fakeEditor();
  const session = createLiveSession(editor);
  await hello(session);
  const { revision } = (await call(session, 'document.get')).result;
  editor.personEdits([{ ...editor.rows()[0] as object, x: 40 }]);
  const reply = await call(session, 'document.apply', { ifRevision: revision, layerPatches: [{ id: 'title', set: { x: 0 } }] });
  assert.equal(reply.error.code, LIVE_ERRORS.refused);
  assert.match(reply.error.message, /changed since that revision/);
});

test('history.undo takes back the agent\'s own newest entry and never the person\'s', async () => {
  const editor = fakeEditor();
  const session = createLiveSession(editor);
  await hello(session);
  await call(session, 'document.apply', { layerPatches: [{ id: 'title', set: { text: 'Agent' } }] });
  editor.personEdits([{ ...editor.rows()[0] as object, x: 99 }]);
  const refused = await call(session, 'history.undo');
  assert.equal(refused.error.code, LIVE_ERRORS.notYours);
  assert.equal((editor.rows()[0] as { x: number }).x, 99, 'the person\'s move stays');
  editor.undo(); // the person undoes their own move
  const undone = await call(session, 'history.undo');
  assert.equal(undone.result.undone, true);
  assert.equal((editor.rows()[0] as { text: string }).text, 'Hello');
  assert.equal((await call(session, 'history.undo')).error.code, LIVE_ERRORS.notYours, 'nothing left to undo');
});

test('an edit that changes nothing makes no entry the agent could later undo', async () => {
  const editor = fakeEditor();
  const session = createLiveSession(editor);
  await hello(session);
  const reply = await call(session, 'document.apply', { layerPatches: [{ id: 'title', set: { text: 'Hello' } }] });
  assert.equal(reply.result.changed, false);
  assert.equal(editor.stack.length, 0);
});

test('limits: at most 500 edits an apply, at most 10 applies a second, read-only refuses', async () => {
  let clock = 0;
  const editor = fakeEditor();
  const session = createLiveSession(editor, { now: () => clock });
  await hello(session);
  const many = Array.from({ length: LIVE_LIMITS.maxEditsPerApply + 1 }, () => ({ id: 'title', set: { x: 1 } }));
  assert.equal((await call(session, 'document.apply', { layerPatches: many })).error.code, LIVE_ERRORS.limit);
  let refusedAt = -1;
  for (let i = 0; i < 40; i++) {
    const reply = await call(session, 'document.apply', { layerPatches: [{ id: 'title', set: { x: i } }] });
    if (reply.error) { refusedAt = i; break; }
  }
  assert.equal(refusedAt, 30, 'thirty applies in the three-second window, then refused');
  clock += 3500;
  assert.ok((await call(session, 'document.apply', { layerPatches: [{ id: 'title', set: { x: 500 } }] })).result);
  editor.lock();
  assert.equal((await call(session, 'document.apply', { layerPatches: [{ id: 'title', set: { x: 1 } }] })).error.code, LIVE_ERRORS.refused);
});

test('after close every request is refused', async () => {
  const session = createLiveSession(fakeEditor());
  await hello(session);
  session.close();
  assert.equal((await call(session, 'document.get')).error.code, LIVE_ERRORS.notReady);
});

test('look returns the editor render; a note is cleaned and capped', async () => {
  const session = createLiveSession(fakeEditor());
  await hello(session);
  assert.match((await call(session, 'look')).result.svg, /^<svg/);
  assert.equal(cleanNote('a\u0000b\u2028c   d'), 'a b c d');
  assert.equal(cleanNote('x'.repeat(200)).length, 80);
  assert.equal(cleanNote(42), '');
});

test('an authored add lands in global canvas coordinates, with its keys lowered (plan 291 W5)', async () => {
  const editor = fakeEditor([
    { id: 'slide1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'slide2', kind: 'frame', x: 2080, y: 1240.4, w: 1920, h: 1080, bg: '#101010' },
  ]);
  const session = createLiveSession(editor);
  await hello(session);
  const reply = await call(session, 'document.apply', {
    layerOperations: [
      { op: 'add', layer: { id: 'head', kind: 'text', $in: 'slide2', x: 120, y: '96', w: 900, h: 80, text: 'Hello', $style: { fontSize: 64, weight: 600 } } },
      { op: 'add', layer: { id: 'list', $in: 'slide2', $stack: { x: 120, y: 300, w: 600, h: 40, pitch: 60, item: [{ slot: 'text', kind: 'text' }], items: ['One', 'Two'] } } },
    ],
  });
  assert.equal(reply.result.changed, true);
  const rows = editor.rows() as Array<Record<string, unknown>>;
  const head = rows.find((r) => r.id === 'head')!;
  assert.equal(head.x, 2200);
  assert.equal(head.y, 1336);
  assert.equal(head.frame, 'slide2');
  assert.equal(head.fontSize, 64);
  assert.equal(head.weight, '600');
  assert.equal(head.fg, '#ffffff', 'no brief here: the ink is chosen by contrast with the dark artboard');
  assert.ok(Object.keys(head).every((k) => !k.startsWith('$')));
  const items = rows.filter((r) => typeof r.id === 'string' && (r.id as string).startsWith('list-'));
  assert.deepEqual(items.map((r) => [r.text, r.x, r.y]), [['One', 2200, 1540], ['Two', 2200, 1600]]);
  assert.ok(items.every((r) => r.z === undefined && r.frame === 'slide2'));
  // A multi-row add with an anchor is refused whole, with the caller's own index.
  const refused = await call(session, 'document.apply', {
    layerOperations: [{ op: 'add', afterId: 'head', layer: { id: 'more', $in: 'slide2', $stack: { x: 0, y: 0, w: 10, h: 10, pitch: 20, item: [{ slot: 'text', kind: 'text' }], items: ['a', 'b'] } } }],
  });
  assert.equal(refused.error.code, LIVE_ERRORS.refused);
  assert.match(refused.error.message, /^\/layerOperations\/0\/afterId: /);
});
