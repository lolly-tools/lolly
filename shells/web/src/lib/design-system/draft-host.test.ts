// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMockHost } from '@lolly-tools/core/mock-host';
import { createDraftHost } from './draft-host.ts';

test('draft writes, snapshots and resolver mutations cannot reach the active host', async () => {
  const base = createMockHost();
  await base.state.save('work', { title: 'Keep' });
  const doc = { ink: { $type: 'color', $value: '#112233' } };
  const draft = createDraftHost(base, doc, 'Night');
  doc.ink.$value = '#fff';
  await draft.state.save('work', { title: 'Draft' });
  const loaded = await draft.state.load('work') as { title: string }; loaded.title = 'Changed';
  assert.deepEqual(await draft.state.load('work'), { title: 'Draft' });
  assert.deepEqual(await base.state.load('work'), { title: 'Keep' });
  assert.equal(await draft.tokens!.resolve('ink'), '#112233');
  const snapshot = await draft.tokens!.snapshot!(); snapshot.document = {};
  assert.equal(await draft.tokens!.resolve('ink'), '#112233');
  await assert.rejects(draft.export.download(new Blob(), 'draft.png'));
  await assert.rejects(draft.export.file(new Blob()));
  await assert.rejects(draft.assets.pick({}));
  await assert.rejects(draft.clipboard.writeText('draft'));
  assert.equal(base.inspect.exports.length, 0);
  assert.equal(draft.compose, undefined);
  assert.equal(draft.net, undefined);
});
