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
  assert.match(reply.result.documentId, /^doc:/);
  assert.deepEqual({ ...reply.result, documentId: undefined }, { protocol: 'live-v1', tool: 'design', engine: '1.244.0', surface: 'web', documentId: undefined });
  assert.equal(session.client(), 'Test agent');
});

test('a transaction retry returns its first receipt and refuses another payload with that id', async () => {
  const editor = fakeEditor(), session = createLiveSession(editor);
  await hello(session);
  const doc = (await call(session, 'document.get')).result;
  const params = { documentId: doc.documentId, ifRevision: doc.revision, transactionId: 'move-title', label: 'Move title', layerPatches: [{ id: 'title', set: { x: 50 } }] };
  const first = (await call(session, 'document.apply', params)).result;
  const repeat = (await call(session, 'document.apply', { ...params })).result;
  assert.equal(repeat.replayed, true); assert.equal(repeat.revision, first.revision); assert.deepEqual(first.changedIds, ['title']);
  assert.equal(editor.stack.length, 1);
  assert.match((await call(session, 'document.apply', { ...params, label: 'Different' })).error.message, /different edit/);
  assert.match((await call(session, 'document.apply', { ...params, documentId: 'another' })).error.message, /different document/);
});

test('an evicted transaction receipt is refused rather than applied again', async () => {
  const editor = fakeEditor(); let now = 0;
  const session = createLiveSession(editor, { now: () => now }); await hello(session);
  for (let i = 0; i < 129; i++) {
    now += 4000;
    const reply = await call(session, 'document.apply', { transactionId: `txn-${i}`, layerPatches: [{ id: 'title', set: { x: i + 1 } }] });
    assert.equal(reply.error, undefined);
  }
  const reply = await call(session, 'document.apply', { transactionId: 'txn-0', layerPatches: [{ id: 'title', set: { x: 1 } }] });
  assert.match(reply.error.message, /receipt has expired/); assert.equal(editor.stack.length, 129);
  assert.equal((editor.rows()[0] as { x: number }).x, 129);
});

test('shared runtime requests finish in order and a queued paused edit cannot land', async () => {
  const editor = fakeEditor();
  let release: () => void = () => {};
  const original = editor.commit;
  editor.commit = async (rows, label) => { const result = await original(rows, label); if (label === 'First') await new Promise<void>(resolve => { release = resolve; }); return result; };
  const one = createLiveSession(editor), two = createLiveSession(editor);
  await hello(one); await hello(two);
  const first = call(one, 'document.apply', { label: 'First', layerPatches: [{ id: 'title', set: { x: 10 } }] });
  await new Promise(resolve => setImmediate(resolve));
  const second = call(two, 'document.apply', { layerPatches: [{ id: 'title', set: { y: 20 } }] });
  two.pause(true); release(); await first;
  assert.match((await second).error.message, /paused/);
  assert.equal((editor.rows()[0] as { y: number }).y, 0);
  two.pause(false);
  await call(two, 'document.apply', { layerPatches: [{ id: 'title', set: { y: 20 } }] });
  assert.equal((editor.rows()[0] as { x: number }).x, 10);
  assert.equal(editor.stack.length, 2);
  assert.equal((await call(one, 'history.undo')).error.code, LIVE_ERRORS.notYours);
});

test('human edits and disconnect during an awaited brief fence the agent write', async () => {
  const editor = fakeEditor();
  let release: (value: { brief: null }) => void = () => {};
  editor.context = () => new Promise(resolve => { release = resolve; });
  const session = createLiveSession(editor); await hello(session);
  const revision = (await call(session, 'document.get')).result.revision;
  const pending = call(session, 'document.apply', { ifRevision: revision, layerPatches: [{ id: 'title', set: { text: 'Agent' } }] });
  await new Promise(resolve => setImmediate(resolve));
  editor.personEdits([{ ...editor.rows()[0] as object, text: 'Person' }]);
  release({ brief: null });
  assert.match((await pending).error.message, /changed since/);
  const next = call(session, 'document.apply', { layerPatches: [{ id: 'title', set: { text: 'Agent' } }] });
  await new Promise(resolve => setImmediate(resolve)); session.close(); release({ brief: null });
  assert.match((await next).error.message, /no longer/);
  assert.equal((editor.rows()[0] as { text: string }).text, 'Person');
});

test('a resize during rendering leaves the admitted receipt stable and reports the current revision', async () => {
  const editor = fakeEditor(); let width = 1200;
  editor.size = () => ({ width, height: 800 });
  const commit = editor.commit;
  editor.commit = async (rows, label) => { const entry = await commit(rows, label); width = 1600; return entry; };
  const session = createLiveSession(editor); await hello(session);
  const reply = await call(session, 'document.apply', { layerPatches: [{ id: 'title', set: { text: 'Agent' } }] });
  assert.equal(reply.result.revision, documentRevision(editor.rows(), 1200, 800));
  assert.equal(reply.result.currentRevision, documentRevision(editor.rows(), 1600, 800));
});

test('presence failure cannot turn an admitted edit into an error or lose its retry receipt', async context => {
  context.mock.method(console, 'warn', () => {});
  const editor = fakeEditor(), session = createLiveSession(editor, { onActivity() { throw new Error('Presence unavailable'); } });
  assert.equal((await hello(session)).error, undefined);
  const params = { transactionId: 'presence-error', layerPatches: [{ id: 'title', set: { text: 'Agent' } }] };
  assert.equal((await call(session, 'document.apply', params)).result.changed, true);
  assert.equal((await call(session, 'document.apply', params)).result.replayed, true);
  assert.equal(editor.stack.length, 1);
});

test('find and scoped reads page by stable id without returning every layer field', async () => {
  const editor = fakeEditor([{ id: 'frame', kind: 'frame', name: 'Slide 1' }, { id: 'title', kind: 'text', text: 'Hello team', frame: 'frame', fontSize: 60 }, { id: 'subtitle', kind: 'text', text: 'Hello world', frame: 'frame' }, { id: 'other', kind: 'text', text: 'Hello outside' }]);
  const session = createLiveSession(editor); await hello(session);
  const found = (await call(session, 'document.find', { query: 'HELLO', artboardId: 'frame', limit: 1 })).result;
  assert.equal(found.total, 2); assert.equal(found.nextOffset, 1); assert.equal(found.rows[0].fontSize, undefined);
  const selected = (await call(session, 'document.get', { selection: true, fields: ['text', 'fontSize'] })).result;
  assert.deepEqual(selected.rows, [{ id: 'title', text: 'Hello team', fontSize: 60 }]);
  assert.equal((await call(session, 'document.find', { limit: 501 })).error.code, LIVE_ERRORS.invalidParams);
});

test('create an alternative artboard and place text and generated image in one undo step', async () => {
  const editor = fakeEditor([{ id: 'slide', kind: 'frame', x: 0, y: 0, w: 800, h: 600 }, { id: 'title', kind: 'text', text: 'Original', x: 40, y: 40, w: 600, h: 100, frame: 'slide' }]);
  const session = createLiveSession(editor); await hello(session);
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==';
  const result = await call(session, 'document.apply', { label: 'Alternative slide', transactionId: 'alternative', layerOperations: [
    { op: 'duplicate', id: 'slide', newId: 'alternative', childIds: { title: 'alternative-title' } },
    { op: 'add', layer: { id: 'caption', kind: 'text', text: 'A new direction', $in: 'alternative', x: 40, y: 160, w: 600, h: 60 } },
    { op: 'add', layer: { id: 'picture', kind: 'image', image, $in: 'alternative', x: 40, y: 260, w: 300, h: 200 } },
  ], layerPatches: [{ id: 'alternative-title', set: { text: 'Alternative' } }] });
  assert.equal(result.error, undefined); assert.equal(editor.stack.length, 1);
  assert.equal((editor.rows().find(row => (row as { id: string }).id === 'title') as { text: string }).text, 'Original');
  const picture = editor.rows().find(row => (row as { id: string }).id === 'picture') as { frame: string; image: string };
  assert.equal(picture.frame, 'alternative'); assert.equal(picture.image, image);
  await call(session, 'history.undo'); assert.equal(editor.rows().length, 2);
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
