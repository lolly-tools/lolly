// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorkCollabHistory } from './collab-history.ts';

test('Work history maps server revisions and reads payloads on demand', async () => {
  let calls = 0;
  const history = createWorkCollabHistory('s/1', async (input) => {
    calls++;
    assert.equal(input, '/api/v1/sessions/s%2F1/revisions');
    return new Response(JSON.stringify({ revisions: [
      { sessionId: 's/1', rev: 2, inputs: { title: 'new' }, meta: { label: 'Poster' }, actor: 'u2', at: '2026-09-07T10:00:00.000Z' },
      { sessionId: 's/1', rev: 1, inputs: { title: 'old' }, meta: {}, actor: 'u1', at: '2026-09-07T09:00:00.000Z' },
    ] }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const page = await history.list();
  assert.equal(page.entries[0]?.label, 'Poster');
  assert.deepEqual(await history.read('s/1:1'), { title: 'old' });
  assert.equal(calls, 1);
  assert.equal(history.canRestore, false);
});
