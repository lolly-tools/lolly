// SPDX-License-Identifier: MPL-2.0
/**
 * field-policy.ts - the generic per-field display-policy registry.
 *
 * Pure module state, no DOM: plain node:test.
 * Run directly:  node --test shells/web/src/lib/field-policy.test.ts
 */
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFieldPolicy, setFieldPolicy, setFieldPolicies, _clearFieldPoliciesForTests,
} from './field-policy.ts';

afterEach(() => _clearFieldPoliciesForTests());

test('dormant default: unknown field returns undefined', () => {
  assert.equal(getFieldPolicy('email'), undefined);
});

test('setFieldPolicy stores and returns a policy', () => {
  setFieldPolicy('email', { mode: 'locked', note: 'Managed by Acme', value: 'me@corp' });
  assert.deepEqual(getFieldPolicy('email'), { mode: 'locked', note: 'Managed by Acme', value: 'me@corp' });
});

test('setFieldPolicy(undefined) removes a policy', () => {
  setFieldPolicy('email', { mode: 'hidden' });
  assert.equal(getFieldPolicy('email')?.mode, 'hidden');
  setFieldPolicy('email', undefined);
  assert.equal(getFieldPolicy('email'), undefined);
});

test('setFieldPolicies replaces the whole registry (a dropped field is unlocked again)', () => {
  setFieldPolicies({ email: { mode: 'locked' }, phone: { mode: 'hidden' } });
  assert.equal(getFieldPolicy('email')?.mode, 'locked');
  assert.equal(getFieldPolicy('phone')?.mode, 'hidden');
  // A fresh set that omits `phone` must leave it with no policy.
  setFieldPolicies({ email: { mode: 'editable' } });
  assert.equal(getFieldPolicy('email')?.mode, 'editable');
  assert.equal(getFieldPolicy('phone'), undefined);
});

test('setFieldPolicies() with no argument clears back to the dormant default', () => {
  setFieldPolicies({ email: { mode: 'locked' } });
  setFieldPolicies();
  assert.equal(getFieldPolicy('email'), undefined);
});
