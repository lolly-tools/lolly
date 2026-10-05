// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetViewerSource, detectedViewerKind, readAssetViewerResponse } from './asset-viewer-source.ts';
test('the descriptor retains selected file identity and the original URL', () => {
  const ref = { id: 'ext/provider/asset?file=012345678901234567890123', type: 'data' as const, source: 'library' as const, format: 'pdf', version: 'revision-2', url: '/catalog/ext/provider/asset/attachment', meta: { thumbUrl: '/thumb', name: 'Second PDF' } };
  const descriptor = assetViewerSource(ref);
  assert.equal(descriptor.groupId, 'ext/provider/asset'); assert.equal(descriptor.fileId, '012345678901234567890123'); assert.equal(descriptor.originalUrl, ref.url); assert.equal(descriptor.thumbnail, '/thumb'); assert.equal(descriptor.kind, 'pdf'); assert.equal(descriptor.revision, 'revision-2');
});
test('content recognition handles generic MIME and rejects misleading extensions', () => {
  assert.equal(detectedViewerKind(new TextEncoder().encode('%PDF-1.7\n')), 'pdf');
  assert.equal(detectedViewerKind(new TextEncoder().encode('wOF2rest')), 'font');
  assert.equal(detectedViewerKind(new TextEncoder().encode('not a font or PDF')), 'existing');
});
test('a streaming response without length is capped and cancelled', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ pull(c) { c.enqueue(new Uint8Array(20)); }, cancel() { cancelled = true; } });
  await assert.rejects(readAssetViewerResponse(new Response(stream), new AbortController().signal, 30), /too large/); assert.equal(cancelled, true);
});
test('aborted and revoked reads never produce preview bytes', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(readAssetViewerResponse(new Response('small'), controller.signal), /abort/i);
  await assert.rejects(readAssetViewerResponse(new Response('', { status: 403 }), new AbortController().signal), /access/);
});
