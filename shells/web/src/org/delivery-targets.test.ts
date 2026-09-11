// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sendTargetId, sendTargetsFor } from '../lib/send-target.ts';
import {
  applyOrgDeliveryTargets,
  clearOrgDeliveryTargets,
  createOrgDeliveryTarget,
  deliveryIdempotencyKey,
  type OrgDeliveryDestination,
} from './delivery-targets.ts';

const destination: OrgDeliveryDestination = {
  id: 'press',
  kind: 's3',
  label: 'Press archive',
  formats: ['PNG', 'pdf'],
  maxBytes: 1024,
  visibility: 'private',
};

const payload = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  name: 'launch-card',
  format: 'png',
  mime: 'image/png',
};

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('org destinations are export-only, provenance-required and removable as one projection', () => {
  applyOrgDeliveryTargets([destination], 'Example Cooperative');
  try {
    const offered = sendTargetsFor('png', 'export');
    assert.equal(offered.length, 1);
    assert.equal(sendTargetId(offered[0]!), 'org:press');
    assert.equal(offered[0]!.scope, 'organization');
    assert.equal(offered[0]!.requiresCredential, true);
    assert.match(offered[0]!.hint ?? '', /Example Cooperative/);
    assert.deepEqual(sendTargetsFor('png', 'asset'), []);
  } finally {
    clearOrgDeliveryTargets();
  }
  assert.deepEqual(sendTargetsFor('png', 'export'), []);
});

test('delivery idempotency is deterministic for the exact target, metadata and bytes', async () => {
  const first = await deliveryIdempotencyKey('press', payload);
  const same = await deliveryIdempotencyKey('press', { ...payload, bytes: payload.bytes.slice() });
  const changed = await deliveryIdempotencyKey('press', { ...payload, bytes: new Uint8Array([1, 2, 3, 5]) });
  assert.equal(first, same);
  assert.notEqual(first, changed);
  assert.match(first, /^shell-v1-[a-f0-9]{64}$/);
});

test('org target posts exact bytes with an idempotency key and returns a receipt', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const target = createOrgDeliveryTarget(destination, 'Example Cooperative', async (url, init) => {
    calls.push({ url: String(url), init });
    return json(201, { id: 'del_1', destinationId: 'press', state: 'delivered', url: 'https://files.example/card.png' });
  });
  const result = await target.send(payload);
  assert.deepEqual(result, { url: 'https://files.example/card.png', label: 'Delivered to Press archive' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, '/api/v1/destinations/press/deliveries?name=launch-card&format=png');
  assert.equal(calls[0]!.init?.method, 'POST');
  assert.deepEqual(
    new Uint8Array(calls[0]!.init?.body as ArrayBuffer),
    payload.bytes,
    'the signed bytes are not re-encoded',
  );
  const headers = calls[0]!.init!.headers as Record<string, string>;
  assert.equal(headers['content-type'], 'image/png');
  assert.match(headers['idempotency-key']!, /^shell-v1-/);
});

test('a second explicit send retries the idempotently returned failed record', async () => {
  const calls: string[] = [];
  const target = createOrgDeliveryTarget(destination, 'Example Cooperative', async (url) => {
    calls.push(String(url));
    if (calls.length === 1) return json(200, {
      id: 'del_retry', destinationId: 'press', state: 'failed', error: 'temporary outage',
    });
    return json(200, {
      id: 'del_retry', destinationId: 'press', state: 'delivered',
    });
  });
  assert.deepEqual(await target.send(payload), { label: 'Delivered to Press archive' });
  assert.equal(calls.length, 2);
  assert.equal(calls[1], '/api/v1/deliveries/del_retry/retry');
});

test('a review-bound destination reports approval without treating it as provider delivery', async () => {
  const target = createOrgDeliveryTarget(destination, 'Example Cooperative', async () => json(202, {
    id: 'del_review', destinationId: 'press', state: 'awaiting-approval', approvalId: 'apr_1',
  }));
  assert.deepEqual(await target.send(payload), { label: 'Approval requested for Press archive' });
});

test('server errors stay user-presentable and local size caps fail before network', async () => {
  let calls = 0;
  const failing = createOrgDeliveryTarget(destination, 'Example Cooperative', async () => {
    calls++;
    return json(422, { error: { code: 'NOT_LOLLY_EXPORT', message: 'Only signed Lolly exports may be delivered' } });
  });
  await assert.rejects(failing.send(payload), /Only signed Lolly exports/);
  assert.equal(calls, 1);

  const tiny = createOrgDeliveryTarget({ ...destination, maxBytes: 2 }, 'Example Cooperative', async () => {
    calls++;
    return json(201, {});
  });
  await assert.rejects(tiny.send(payload), /up to 2 bytes/);
  assert.equal(calls, 1, 'oversize payload never leaves the device');
});
