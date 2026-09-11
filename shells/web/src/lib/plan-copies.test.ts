// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { planCopies } from './plan-copies.ts';

const nameOf = (id: string): string => ({ qr: 'QR Code', map: 'Street Map' }[id] ?? id);

test('one copy each keeps the plain tool name', () => {
  const plan = planCopies([{ id: 'qr', n: 1 }, { id: 'map', n: 1 }], nameOf, 1000);
  assert.deepEqual(plan.map(p => p.label), ['QR Code', 'Street Map']);
  assert.deepEqual(plan.map(p => p.toolId), ['qr', 'map']);
});

test('multiple copies of one tool number from 1', () => {
  const plan = planCopies([{ id: 'qr', n: 3 }], nameOf, 500);
  assert.deepEqual(plan.map(p => p.label), ['QR Code 1', 'QR Code 2', 'QR Code 3']);
});

test('slots are unique across tools minted in the same tick', () => {
  const plan = planCopies([{ id: 'qr', n: 2 }, { id: 'map', n: 2 }], nameOf, 42);
  const slots = plan.map(p => p.slot);
  assert.equal(new Set(slots).size, slots.length, 'no two copies share a slot');
  // Each slot is `<toolId>:<running-stamp>`, so the stamp half strictly increases.
  assert.deepEqual(slots, ['qr:42', 'qr:43', 'map:44', 'map:45']);
});

test('a zero or negative count contributes nothing', () => {
  const plan = planCopies([{ id: 'qr', n: 0 }, { id: 'map', n: -1 }, { id: 'qr', n: 1 }], nameOf, 1);
  assert.deepEqual(plan.map(p => p.slot), ['qr:1']);
});
