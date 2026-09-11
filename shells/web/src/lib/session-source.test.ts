// SPDX-License-Identifier: MPL-2.0
/**
 * session-source.ts - the generic external-session-source registry.
 *
 * Pure, DOM-free: dormant by default (undefined), single last-wins registration,
 * a working unregister that only clears if still current.
 *
 * Run directly:  node --test shells/web/src/lib/session-source.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSessionSource, registerSessionSource, _clearSessionSourceForTests, type SessionSource,
} from './session-source.ts';

const stub = (label: string): SessionSource => ({
  label,
  listProjects: async () => [],
  listSessions: async () => [],
  fetchSession: async () => null,
});

test('dormant by default (no control plane)', () => {
  _clearSessionSourceForTests();
  assert.equal(getSessionSource(), undefined);
});

test('register installs the source; unregister clears it', () => {
  _clearSessionSourceForTests();
  const off = registerSessionSource(stub('Acme'));
  assert.equal(getSessionSource()?.label, 'Acme');
  off();
  assert.equal(getSessionSource(), undefined);
});

test('last registration wins; a stale unregister is a no-op', () => {
  _clearSessionSourceForTests();
  const off1 = registerSessionSource(stub('First'));
  registerSessionSource(stub('Second'));
  assert.equal(getSessionSource()?.label, 'Second');
  off1(); // stale - must NOT clear the current (Second) source
  assert.equal(getSessionSource()?.label, 'Second');
});
