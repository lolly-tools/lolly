// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, strToU8 } from 'fflate';
import { declaredFileFacts, portableFileBatch, validateFileBatch, batchOutputReference, type LocalFileBatch } from '../shells/web/src/lib/file-batch-store.ts';
import { incompleteFileReport } from '../shells/web/src/lib/saved-file-operation.ts';
import { packFileHistory, unpackFileHistory } from '../shells/web/src/lib/file-history-backup.ts';
import type { BundleEntry } from '../shells/web/src/lib/bundle.ts';

function fixture(): LocalFileBatch {
  const file = new File(['a,b\n1,2'], 'source.csv', { type: 'text/csv' });
  const operationId = crypto.randomUUID();
  const request = { version: 1 as const, operation: 'convert', target: 'json', options: {} };
  return { version: 1, id: crypto.randomUUID(), request, createdAt: 1, leaseUntil: Date.now() + 1000, members: [{ operationId, source: { id: `file-source:${operationId}`, role: 'original', facts: declaredFileFacts(file) }, outputName: 'source.json', report: incompleteFileReport(file, request, 'cancelled', 'not-started', 'Cancelled before reading.') }] };
}
test('portable batch is bounded metadata, records unread sources honestly and excludes live authority', () => {
  const batch = fixture(); const portable = portableFileBatch(batch);
  validateFileBatch(portable);
  assert.equal(Object.hasOwn(portable, 'leaseUntil'), false);
  assert.equal(portable.members[0]!.source.facts.sha256, undefined);
  assert.equal(portable.members[0]!.source.facts.formatSource, 'declared');
  assert.equal(batchOutputReference(portable.members[0]!), undefined);
  assert.throws(() => validateFileBatch(batch), /Invalid/);
  for (const change of ['duplicate', 'too-many', 'path', 'role', 'wrong-size', 'wrong-target', 'extra-handle']) {
    const bad = structuredClone(portable);
    const member = bad.members[0]!;
    if (change === 'duplicate') bad.members.push(member);
    if (change === 'too-many') bad.members = Array(21).fill(member);
    if (change === 'path') member.outputName = '../unsafe.json';
    if (change === 'role') member.source.role = 'working';
    if (change === 'wrong-size') member.report!.inputs[0]!.size++;
    if (change === 'wrong-target') member.report!.options.target = 'xml';
    if (change === 'extra-handle') Object.assign(member, { handle: '/private/file' });
    assert.throws(() => validateFileBatch(bad), /Invalid|disagree/, change);
  }
});
test('a running batch is portable only as interrupted, without changing the live manifest', () => {
  const batch = fixture(); delete batch.members[0]!.report;
  assert.throws(() => validateFileBatch(portableFileBatch(batch)), /every file/);
  const copy = portableFileBatch(batch, true); validateFileBatch(copy);
  assert.equal(copy.members[0]!.report!.findings[0]!.code, 'operation-interrupted');
  assert.equal(batch.members[0]!.report, undefined); assert.ok(batch.leaseUntil > 0);
});
test('history v2 preserves full batches while continuing to read v1; duplicate/corrupt manifests fail preflight', async () => {
  const batch = portableFileBatch(fixture());
  const entries: Record<string, BundleEntry> = {};
  await packFileHistory({ assetVersions: [], operations: [], batches: [batch] }, entries);
  const files = Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, new Uint8Array(v instanceof Uint8Array ? v : v[0])]));
  const raw = JSON.parse(strFromU8(files['file-history.json']!)); assert.equal(raw.version, 2);
  assert.deepEqual((await unpackFileHistory(files))!.batches, [batch]);
  raw.batches.push(batch); files['file-history.json'] = strToU8(JSON.stringify(raw));
  await assert.rejects(unpackFileHistory(files), /Duplicate/);
  raw.batches = [batch, { ...batch, id: crypto.randomUUID() }]; files['file-history.json'] = strToU8(JSON.stringify(raw));
  await assert.rejects(unpackFileHistory(files), /Duplicate/);
  raw.version = 1; delete raw.batches; files['file-history.json'] = strToU8(JSON.stringify(raw));
  assert.equal((await unpackFileHistory(files))!.batches, undefined);
});
