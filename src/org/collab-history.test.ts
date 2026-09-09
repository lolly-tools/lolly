// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkCollabHistory } from './collab-history.ts';

test('Work refresh sees new revisions and copies use the actual tool identity', async () => {
  let calls = 0;
  let latest = 2;
  const history = createWorkCollabHistory('s/1', async (input, init) => {
    calls++;
    assert.equal(init?.cache, 'no-store');
    assert.equal(init?.credentials, 'include');
    if (input === '/api/v1/sessions/s%2F1') return Response.json({ toolId: 'chart', toolVersion: '3' });
    assert.equal(input, '/api/v1/sessions/s%2F1/revisions');
    return new Response(JSON.stringify({ revisions: [
      ...(latest === 3 ? [{ sessionId: 's/1', rev: 3, inputs: { title: 'newest' } }] : []),
      { sessionId: 's/1', rev: 2, inputs: { title: 'new' }, meta: { label: 'Poster' }, actor: 'u2', at: '2026-09-07T10:00:00.000Z' },
      { sessionId: 's/1', rev: 1, inputs: { title: 'old' }, meta: {}, actor: 'u1', at: '2026-09-07T09:00:00.000Z' },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const page = await history.list();
  assert.equal(page.entries[0]?.label, 'Poster');
  assert.equal(page.entries[0]?.toolId, 'chart');
  latest = 3;
  assert.equal((await history.list()).entries[0]?.revision, 3);
  const firstPage = await history.list({ limit: 1 });
  assert.equal(firstPage.before, 's/1:3');
  assert.deepEqual((await history.list({ before: firstPage.before })).entries.map(row => row.revision), [2, 1]);
  assert.deepEqual(await history.read('s/1:1'), { title: 'old', __toolId: 'chart', __label: 'Revision 1' });
  assert.equal(calls, 10, 'every action reaches the server again');
  assert.equal(history.canRestore, false);
});

test('access revoked after listing cannot be bypassed by reading or copying a cached payload', async () => {
  let denied = false;
  const history = createWorkCollabHistory('s', async input => {
    if (denied && String(input).endsWith('/revisions')) return new Response('', { status: 403 });
    return Response.json(String(input).endsWith('/revisions')
      ? { revisions: [{ sessionId: 's', rev: 1, inputs: { secret: 'private' } }] }
      : { toolId: 'gradient' });
  });
  assert.equal((await history.list()).entries.length, 1);
  denied = true;
  await assert.rejects(history.read('s:1'), /403/);
  await assert.rejects(history.saveCopy!('s:1'), /403/);
  await assert.rejects(history.list(), /403/);
});

test('malformed rows and rows for another session cannot be opened', async () => {
  const history = createWorkCollabHistory('s', async input => Response.json(String(input).endsWith('/revisions')
    ? { revisions: [null, [], { rev: '2' }, { rev: -1 }, { sessionId: 'other', rev: 1, inputs: {} },
      { rev: 3, inputs: [], meta: {} }, { rev: 4, inputs: { title: 'good' }, meta: { toolId: 'chart', toolVersion: '2' } }] }
    : { toolId: 'gradient' }));
  assert.deepEqual((await history.list()).entries.map(row => row.revision), [4, 3]);
  assert.equal(await history.read('s:1'), null);
  assert.equal(await history.read('s:3'), null);
  assert.deepEqual(await history.saveCopy!('s:4'), { title: 'good', __toolId: 'chart', __toolVersion: '2', __label: 'Revision 4' });
  assert.deepEqual((await history.list({ before: 's:expired' })).entries, []);
});

test('missing tool identity fails clearly instead of guessing Design', async () => {
  const history = createWorkCollabHistory('s', async () => Response.json({}));
  await assert.rejects(history.list(), /tool identity/);
});
