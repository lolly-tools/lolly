// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { PrivateFileResources } from '../src/file-resources.ts';
import { dispatch } from '../src/server.ts';
type Imported = { file: { id: string; facts: { sha256: string }; derivedFrom?: { id: string } } };
test('private handles isolate owners, return receipts without bytes, and delete only selected outputs', async () => {
  const files = new PrivateFileResources();
  try {
    const original = await files.call('alice', 'files_import', { name: '../table.csv', mime: 'text/csv', base64: Buffer.from('name,value\na,3').toString('base64') }) as Imported;
    await assert.rejects(files.call('bob', 'files_report', { id: original.file.id }), /not found/);
    await assert.rejects(files.read('bob', `lolly://files/${original.file.id}/content`), /not found/);
    const result = await files.call('alice', 'files_convert', { id: original.file.id, request: { version: 1, operation: 'convert', target: 'json', options: {} } }) as Imported & { report: { state: string } };
    assert.equal(result.report.state, 'succeeded'); assert.equal(result.file.derivedFrom!.id, original.file.id);
    assert.equal(JSON.stringify(result).includes('base64'), false);
    const resource = await files.read('alice', `lolly://files/${result.file.id}/content`);
    assert.deepEqual(JSON.parse(Buffer.from(resource.blob!, 'base64').toString()), [{ name: 'a', value: '3' }]);
    await files.call('alice', 'files_delete', { id: result.file.id });
    await assert.rejects(files.read('alice', `lolly://files/${result.file.id}/content`), /not found/);
    assert.ok(await files.call('alice', 'files_report', { id: original.file.id }));
    await assert.rejects(files.call('alice', 'files_import', { name: 'bad', base64: '!!!!' }), /base64/);
  } finally { await files.close(); }
});
test('transport dispatch refuses private resources without an explicit authenticated scope', async () => {
  const reply = await dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'files_list', arguments: {} } });
  assert.ok(reply && 'error' in reply);
  const resource = await dispatch({ jsonrpc: '2.0', id: 2, method: 'resources/read', params: { uri: 'lolly://files/00000000-0000-0000-0000-000000000000/content' } });
  assert.ok(resource && 'error' in resource);
});
